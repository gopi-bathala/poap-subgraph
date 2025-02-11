import { Address, BigDecimal, BigInt, dataSource, Bytes, log, TypedMap} from "@graphprotocol/graph-ts";
import { AirAccount, AirContract, AirDailyAggregateEntity, AirDailyAggregateEntityAccount, AirDailyAggregateEntityStats, AirExtraData, AirNFTSaleStats, AirNFTSaleTransaction, AirToken } from "../../../generated/schema";
import { ERC721MetaData } from "../../../generated/Poap/ERC721MetaData"
import { getDayOpenTime, getDaysSinceEpoch } from "./datetime";
import { getUsdPrice } from "../prices";
import { ERC20 } from "../../../generated/Poap/ERC20";
import { BIG_INT_ONE } from "./constant";

export namespace nft {

    export class NftOptions {
        transactionExtraData: TypedMap<string, TypedMap<string, string>>
		constructor(
			_transactionExtraData: TypedMap<string, TypedMap<string, string>>
		) {
			this.transactionExtraData = _transactionExtraData
		}
	}

    export function trackNFTSaleTransactions(
        txHash: string,
        fromArray: Address[],
        toArray: Address[],
        contractAddressArray: Address[],
        nftIdArray: BigInt[],
        paymentTokenAddress: Address,
        paymentAmount: BigInt,
        timestamp: BigInt,
        blockHeight: BigInt,
        options: NftOptions 
    ): void {

        log.info("processing tx {} {} ",[txHash, paymentTokenAddress.toHexString()]);

          if(fromArray.length == 0) {
            return;
          }

        // Payment Token
        let paymentToken = getOrCreateAirToken(paymentTokenAddress.toHexString());
        paymentToken.save();

        // todo formatted amount with decimal, utils.ts
        let decimal = paymentToken.decimals;
        let formattedAmount = paymentAmount.toBigDecimal().div(BigInt.fromI32(10).pow(paymentToken.decimals as u8).toBigDecimal());
        let volumeInUSD = getUsdPrice(paymentTokenAddress, formattedAmount);
        let transactionCount = fromArray.length;
        for (let i = 0; i < transactionCount; i++) {

            // SELL Daily AggregatedEntity
             // todo call this function from getOrCreate Function
            let sellActionDailyAggregatedEntityId = getDailyAggregatedEntityId(contractAddressArray[i].toHexString(), timestamp, "SELL");
            let sellActionDailyAggregatedEntity = getOrCreateAirDailyAggregateEntity(sellActionDailyAggregatedEntityId, timestamp, "SELL");
            sellActionDailyAggregatedEntity.transactionCount = sellActionDailyAggregatedEntity.transactionCount.plus(BIG_INT_ONE);
            sellActionDailyAggregatedEntity.volumeInUSD = sellActionDailyAggregatedEntity.volumeInUSD.plus(volumeInUSD);
            sellActionDailyAggregatedEntity.updatedTimestamp = timestamp;
            sellActionDailyAggregatedEntity.blockHeight = blockHeight;

            // Buy Daily Aggregated Entity
            let buyActionDailyAggregatedEntityId = getDailyAggregatedEntityId(contractAddressArray[i].toHexString(), timestamp, "BUY");
            let buyActionDailyAggregatedEntity = getOrCreateAirDailyAggregateEntity(buyActionDailyAggregatedEntityId, timestamp, "BUY");
            buyActionDailyAggregatedEntity.transactionCount = buyActionDailyAggregatedEntity.transactionCount.plus(BIG_INT_ONE);
            buyActionDailyAggregatedEntity.volumeInUSD = buyActionDailyAggregatedEntity.volumeInUSD.plus(volumeInUSD);
            buyActionDailyAggregatedEntity.updatedTimestamp = timestamp;
            buyActionDailyAggregatedEntity.blockHeight = blockHeight;

            // Account 
            let buyerAccount = getOrCreateAirAccount(toArray[i].toHexString());
            let sellerAccount = getOrCreateAirAccount(fromArray[i].toHexString());

            // AggregatedEntity Account
            let sellAggregatedEntityAccountId = getDailyAggregatedAccountId(sellActionDailyAggregatedEntityId, sellerAccount.id);
            let sellAggregatedEntityAccount = getOrCreateAirDailyAggregateEntityAccount(sellAggregatedEntityAccountId, sellerAccount.id, sellActionDailyAggregatedEntity.walletCount);
            let nftVolumeInUSD = volumeInUSD.div(BigDecimal.fromString(fromArray.length.toString()));
            sellAggregatedEntityAccount.volumeInUSD = sellAggregatedEntityAccount.volumeInUSD.plus(nftVolumeInUSD)
            //sellAggregatedEntityAccount.index = sellActionDailyAggregatedEntity.walletCount.plus(BigInt.fromI32(1));

            let buyAggregatedEntityAccountId = getDailyAggregatedAccountId(buyActionDailyAggregatedEntityId, buyerAccount.id);
            let buyAggregatedEntityAccount = getOrCreateAirDailyAggregateEntityAccount(buyAggregatedEntityAccountId, buyerAccount.id, buyActionDailyAggregatedEntity.walletCount);
            buyAggregatedEntityAccount.volumeInUSD = buyAggregatedEntityAccount.volumeInUSD.plus(nftVolumeInUSD)
            //buyAggregatedEntityAccount.index = buyActionDailyAggregatedEntity.walletCount.plus(BigInt.fromI32(1));

            let newBuyWalletCount = AirDailyAggregateEntityAccount.load(buyAggregatedEntityAccountId) == null ? 1 : 0;
            let newSellWalletCount = AirDailyAggregateEntityAccount.load(sellAggregatedEntityAccountId) == null ? 1 : 0;

            buyActionDailyAggregatedEntity.walletCount = buyActionDailyAggregatedEntity.walletCount.plus(BigInt.fromI32(newBuyWalletCount));
            sellActionDailyAggregatedEntity.walletCount = sellActionDailyAggregatedEntity.walletCount.plus(BigInt.fromI32(newSellWalletCount));

            // Sale Token
            let saleToken = getOrCreateAirToken(contractAddressArray[i].toHexString());
            saleToken.save();

            // Air Contract
            let contract = getOrCreateAirContract(contractAddressArray[i]);

            // AirDailyAggregateEntityStats
            let sellDailyAggregateEntityStatsId = getAirDailyAggregateEntityStatsId(sellActionDailyAggregatedEntityId);
            let sellDailyAggregateEntityStats = getOrCreateAirDailyAggregateEntityStats(sellDailyAggregateEntityStatsId);

            let buyDailyAggregateEntityStatsId = getAirDailyAggregateEntityStatsId(buyActionDailyAggregatedEntityId);
            let buyDailyAggregateEntityStats = getOrCreateAirDailyAggregateEntityStats(buyDailyAggregateEntityStatsId);

            // Sale Stat
            let saleStatId = getAirNFTSaleStatsId(contractAddressArray[i].toHexString(), sellActionDailyAggregatedEntityId);
            let saleStat = getOrCreateAirNFTSaleStats(saleStatId);
            saleStat.volumeInUSD = saleStat.volumeInUSD.plus(volumeInUSD);
            saleStat.transactionCount = saleStat.transactionCount.plus(BIG_INT_ONE);
            saleStat.walletCount = saleStat.walletCount.plus(BigInt.fromI32(newBuyWalletCount + newSellWalletCount));

            // Transaction
            let transaction = getOrCreateAirNFTSaleTransaction(
                getNFTSaleTransactionId(txHash, contractAddressArray[i].toHexString(), nftIdArray[i])
            );
            transaction.type = "SALE";
            transaction.tokenId = nftIdArray[i];
            transaction.paymentAmount = paymentAmount.div(BigInt.fromI32(fromArray.length)); // For bundle sale, equally divide the payment amount in all sale transaction
            
            // populate transaction extraData object 
            if (options != null 
                && options.transactionExtraData != null 
                && options.transactionExtraData.entries.length > 0) {

                let txnExtraDataMaplength = options.transactionExtraData.entries.length;
                let extraDataArray = new Array<string>();
                for (let i = 0; i < txnExtraDataMaplength; i++) {
                    let entry =  options.transactionExtraData.entries[i]
                    let id = entry.key
                    let childMap = entry.value
                    for (let j = 0; j < childMap.entries.length; j++) {
                        let name = childMap.entries[j].key 
                        let value = childMap.entries[j].value 
                        let airExtraData = new AirExtraData(id)
                        airExtraData.name = name
                        airExtraData.value = value
                        airExtraData.save()
                        extraDataArray.push(id)
                    }
                }
                transaction.extraData = extraDataArray
            }
            //Build Relationship 
            saleStat.token = saleToken.id;
            sellActionDailyAggregatedEntity.stats = sellDailyAggregateEntityStatsId;
            sellActionDailyAggregatedEntity.contract = contract.id

            buyActionDailyAggregatedEntity.stats = buyDailyAggregateEntityStatsId;
            buyActionDailyAggregatedEntity.contract = contract.id

            sellAggregatedEntityAccount.dailyAggregatedEntity = sellActionDailyAggregatedEntityId;
            buyAggregatedEntityAccount.dailyAggregatedEntity = buyActionDailyAggregatedEntityId;

            sellDailyAggregateEntityStats.protocolActionType = "SELL";
            sellDailyAggregateEntityStats.saleStat = saleStatId;

            buyDailyAggregateEntityStats.protocolActionType = "BUY";
            buyDailyAggregateEntityStats.saleStat = saleStatId;

            transaction.saleStat = saleStatId;
            transaction.transactionToken = saleToken.id;
            transaction.paymentToken = paymentToken.id;
            transaction.to = buyerAccount.id;
            transaction.from = sellerAccount.id;
            transaction.hash = txHash;

            // Save Everything
            buyerAccount.save();
            sellerAccount.save();

            sellAggregatedEntityAccount.save();
            buyAggregatedEntityAccount.save();

            contract.save();

            saleStat.save()

            transaction.save();

            sellDailyAggregateEntityStats.save()
            buyDailyAggregateEntityStats.save();

            sellActionDailyAggregatedEntity.save();
            buyActionDailyAggregatedEntity.save();

        }

        log.warning("DONE {} ", [txHash])

    }

    export function getDailyAggregatedEntityId(contractAddress: string, timestamp: BigInt, protocolActionType: string): string {
        return dataSource.network()
            .concat("-")
            .concat(contractAddress)
            .concat("-")
            .concat(protocolActionType.toString())
            .concat("-")
            .concat(getDaysSinceEpoch(timestamp.toI32()));
    }

    export function getNFTSaleTransactionId(txHash: string, contractAddress: string, nftId: BigInt): string {

        return dataSource.network()
            .concat("-")
            .concat(txHash)
            .concat("-")
            .concat(contractAddress)
            .concat(nftId.toString());
    }

    export function getAirNFTSaleStatsId(contractAddress: string, dailyAggregatedEntityId: string): string {

        return dataSource.network()
            .concat("-")
            .concat(dailyAggregatedEntityId)
            .concat("-")
            .concat(contractAddress)

    }

    export function getDailyAggregatedAccountId(dailyAggregatedEntityId: string, accountId: string): string {
        return dailyAggregatedEntityId.concat("-").concat(accountId);
    }

    export function getAirDailyAggregateEntityStatsId(dailyAggregatedEntityId: string): string {
        return dailyAggregatedEntityId.concat("-").concat("stats");
    }

    export function getOrCreateAirContract(contractAddress: Address): AirContract {
        let entity = AirContract.load(contractAddress.toHexString());

        if (entity == null) {
            entity = new AirContract(contractAddress.toHexString());
            entity.address = contractAddress.toHexString();

        }
        return entity as AirContract;
    }

    export function getOrCreateAirDailyAggregateEntity(id: string, timestamp: BigInt, protocolActionType: string): AirDailyAggregateEntity {
        let entity = AirDailyAggregateEntity.load(id);

        if (entity == null) {
            entity = new AirDailyAggregateEntity(id);
            entity.volumeInUSD = BigDecimal.zero();
            entity.tokenCount = BigInt.fromString("1"); // Aggregation is done for one NFT collection
            entity.daySinceEpoch = BigInt.fromString(getDaysSinceEpoch(timestamp.toI32()));
            entity.startDayTimestamp = getDayOpenTime(timestamp);
            entity.walletCount = BigInt.zero();
            entity.transactionCount = BigInt.zero();
            entity.network = "MAINNET"; //todo remove hardcode, check massari 
            entity.updatedTimestamp = timestamp;
            entity.protocolType = "NFT_MARKET_PLACE";
            entity.protocolActionType = protocolActionType;

        }
        return entity as AirDailyAggregateEntity;
    }

    export function getOrCreateAirDailyAggregateEntityStats(id: string): AirDailyAggregateEntityStats {
        let entity = AirDailyAggregateEntityStats.load(id);

        if (entity == null) {
            entity = new AirDailyAggregateEntityStats(id);

        }
        return entity as AirDailyAggregateEntityStats;
    }

    export function getOrCreateAirNFTSaleStats(id: string): AirNFTSaleStats {
        let entity = AirNFTSaleStats.load(id);

        if (entity == null) {
            entity = new AirNFTSaleStats(id);
            entity.volumeInUSD = BigDecimal.zero();
            entity.walletCount = BigInt.zero();
            entity.transactionCount = BigInt.zero();
            entity.tokenCount = BigInt.fromString("1"); // Aggregation is done for one NFT collection

        }
        return entity as AirNFTSaleStats;
    }

    export function getOrCreateAirAccount(id: string): AirAccount {
        let entity = AirAccount.load(id);

        if (entity == null) {
            entity = new AirAccount(id);
            entity.address = id;
        }
        return entity as AirAccount;
    }

    export function getOrCreateAirDailyAggregateEntityAccount(id: string, accountId: string, walletCount: BigInt): AirDailyAggregateEntityAccount {

        let entity = AirDailyAggregateEntityAccount.load(id);

        if (entity == null) {
            entity = new AirDailyAggregateEntityAccount(id);
            entity.volumeInUSD = BigDecimal.zero();
            entity.account = accountId;
            entity.index = walletCount.plus(BIG_INT_ONE);

        }
        return entity as AirDailyAggregateEntityAccount;
    }

    function supportsInterface(contract: ERC721MetaData, interfaceId: string, expected: boolean = true): boolean {
        let supports = contract.try_supportsInterface(Bytes.fromByteArray(Bytes.fromHexString(interfaceId)));
        return !supports.reverted && supports.value == expected;
    }
    export function getOrCreateAirToken(id: string): AirToken {

        let entity = AirToken.load(id); //todo add network

        log.info("address token {},", [id]);
        if (entity == null) {
            entity = new AirToken(id)
            entity.address = id
            entity.standard = "ERC20";

            let contract = ERC721MetaData.bind(Address.fromString(id));  //todo should we do 1155? 

            let supportsEIP165Identifier = supportsInterface(contract, '0x01ffc9a7'); // ?
            let supportsEIP721Identifier = supportsInterface(contract, '0x80ac58cd');
            let supportsNullIdentifierFalse = supportsInterface(contract, '0x00000000', false);
            let supportsEIP721 = supportsEIP165Identifier && supportsEIP721Identifier && supportsNullIdentifierFalse;

            log.info(" support interface debug  {} {} {} {} {}",[
                id,
                supportsEIP165Identifier.toString(),
                supportsEIP721Identifier.toString(),
                supportsNullIdentifierFalse.toString(),
                supportsEIP721.toString()
            ]);
            if (supportsEIP721) {
                entity.standard = "ERC721";;
            }

            //todo convert to enums
            if (!supportsEIP721) {
                let erc20Contract = ERC20.bind(Address.fromString(id));
                let decimals = erc20Contract.try_decimals();
                entity.decimals = 18;
                if (!decimals.reverted) {
                    entity.standard = "ERC20";
                    entity.decimals = decimals.value;
                }

                let totalSupply = erc20Contract.try_totalSupply(); //todo double confirm
                if (!totalSupply.reverted) {
                    entity.totalSupply = totalSupply.value;
                }
            }


            // todo handle base currency (check messari) 
            let symbol = contract.try_symbol();
            if (!symbol.reverted) {
                entity.symbol = symbol.value;
            }

            let name = contract.try_name();
            if (!name.reverted) {
                entity.name = name.value;
            }


        }
        return entity as AirToken
    }

    export function getOrCreateAirNFTSaleTransaction(id: string): AirNFTSaleTransaction {

        let transaction = AirNFTSaleTransaction.load(id);

        if (transaction == null) {
            transaction = new AirNFTSaleTransaction(id);
        }

        return transaction as AirNFTSaleTransaction;

    }

}