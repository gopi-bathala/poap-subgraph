import { Address, BigDecimal, BigInt, dataSource, Bytes, log, TypedMap} from "@graphprotocol/graph-ts";
import { AirAccount, AirContract, AirDailyAggregateEntity, AirDailyAggregateEntityAccount, AirDailyAggregateEntityStats, AirExtraData, AirNFTSaleStats, AirNFTSaleTransaction, AirToken } from "../../../generated/schema";
import { ERC721MetaData } from "../../../generated/Poap/ERC721MetaData"
import { getDayOpenTime, getDaysSinceEpoch } from "./datetime";
import { getUsdPrice } from "../prices";
import { ERC20 } from "../../../generated/Poap/ERC20";
import { BIG_INT_ONE } from "./constant";

export namespace poap {

    export class PoapOptions {
        transactionExtraData: TypedMap<string, TypedMap<string, string>>
		constructor(
			_transactionExtraData: TypedMap<string, TypedMap<string, string>>
		) {
			this.transactionExtraData = _transactionExtraData
		}
	}

    export function trackPoapAttendTransactions(
        txHash: string,
        fromArray: Address[],
        toArray: Address[],
        contractAddressArray: Address[],
        nftIdArray: BigInt[],
        eventIdArray: BigInt[],
        timestamp: BigInt,
        blockHeight: BigInt,
        protocolActionType: string,
        protocolType: string,
        network: string
    ): void {

        // log.info("processing tx {} {} ",[txHash, paymentTokenAddress.toHexString()]);

        //   if(fromArray.length == 0) {
        //     return;
        //   }

        // Payment Token
        // let paymentToken = getOrCreateAirToken(paymentTokenAddress.toHexString());
        // paymentToken.save();

        // todo formatted amount with decimal, utils.ts
        //let decimal = paymentToken.decimals;
        //let formattedAmount = paymentAmount.toBigDecimal().div(BigInt.fromI32(10).pow(paymentToken.decimals as u8).toBigDecimal());
        //let volumeInUSD = getUsdPrice(paymentTokenAddress, formattedAmount);
        let transactionCount = fromArray.length;
        for (let i = 0; i < transactionCount; i++) {
            let eventId = eventIdArray[i].toString();
            let contractAddress = contractAddressArray[i].toHexString();
            let toAddress = toArray[i].toHexString();
            let fromAddress = fromArray[i].toHexString();
            let nftId = nftIdArray[i];

            // SELL Event AggregatedEntity
             // todo call this function from getOrCreate Function
            // let sellActionEventAggregatedEntityId = getEventAggregatedEntityId(contractAddressArray[i].toHexString(), protocolActionType,eventIdArray[i].toString());
            // let sellActionEventAggregatedEntity = getOrCreateAirDailyAggregateEntity(sellActionEventAggregatedEntityId, timestamp, protocolActionType, protocolType);
            // sellActionEventAggregatedEntity.transactionCount = sellActionEventAggregatedEntity.transactionCount.plus(BIG_INT_ONE);
            // sellActionEventAggregatedEntity.volumeInUSD = sellActionEventAggregatedEntity.volumeInUSD.plus(volumeInUSD);
            // sellActionEventAggregatedEntity.updatedTimestamp = timestamp;
            // sellActionEventAggregatedEntity.blockHeight = blockHeight;

            // Buy Event Aggregated Entity
            let attendActionEventAggregatedEntityId = getEventAggregatedEntityId(contractAddress, protocolActionType, eventId);
            let attendActionEventAggregatedEntity = getOrCreateAirDailyAggregateEntity(attendActionEventAggregatedEntityId, timestamp, protocolActionType, protocolType, network);
            attendActionEventAggregatedEntity.transactionCount = attendActionEventAggregatedEntity.transactionCount.plus(BIG_INT_ONE);
            //buyActionEventAggregatedEntity.volumeInUSD = buyActionEventAggregatedEntity.volumeInUSD.plus(volumeInUSD);
            attendActionEventAggregatedEntity.updatedTimestamp = timestamp;
            attendActionEventAggregatedEntity.blockHeight = blockHeight;
            attendActionEventAggregatedEntity.eventId = eventId

            // Account 
            let buyerAccount = getOrCreateAirAccount(toAddress);
            let sellerAccount = getOrCreateAirAccount(fromAddress);

            // AggregatedEntity Account
           // let sellAggregatedEntityAccountId = getEventAggregatedAccountId(sellActionEventAggregatedEntityId, sellerAccount.id);
           // let sellAggregatedEntityAccount = getOrCreateAirDailyAggregateEntityAccount(sellAggregatedEntityAccountId, sellerAccount.id, sellActionEventAggregatedEntity.walletCount);
           // let nftVolumeInUSD = volumeInUSD.div(BigDecimal.fromString(fromArray.length.toString()));
           // sellAggregatedEntityAccount.volumeInUSD = sellAggregatedEntityAccount.volumeInUSD.plus(nftVolumeInUSD)
            //sellAggregatedEntityAccount.index = sellActionEventAggregatedEntity.walletCount.plus(BigInt.fromI32(1));

            let attendAggregatedEntityAccountId = getEventAggregatedAccountId(attendActionEventAggregatedEntityId, buyerAccount.id);
            let attendAggregatedEntityAccount = getOrCreateAirDailyAggregateEntityAccount(attendAggregatedEntityAccountId, buyerAccount.id, attendActionEventAggregatedEntity.walletCount);
           // buyAggregatedEntityAccount.volumeInUSD = buyAggregatedEntityAccount.volumeInUSD.plus(nftVolumeInUSD)
            //buyAggregatedEntityAccount.index = buyActionEventAggregatedEntity.walletCount.plus(BigInt.fromI32(1));

            let newBuyWalletCount = AirDailyAggregateEntityAccount.load(attendAggregatedEntityAccountId) == null ? 1 : 0;
            //let newSellWalletCount = AirDailyAggregateEntityAccount.load(sellAggregatedEntityAccountId) == null ? 1 : 0;

            attendActionEventAggregatedEntity.walletCount = attendActionEventAggregatedEntity.walletCount.plus(BigInt.fromI32(newBuyWalletCount));
            //sellActionEventAggregatedEntity.walletCount = sellActionEventAggregatedEntity.walletCount.plus(BigInt.fromI32(newSellWalletCount));

            //  Poap event dapp asset
            let attendToken = getOrCreateAirToken(contractAddress, eventId, network);
            attendToken.save();

            // Air Contract
            let contract = getOrCreateAirContract(contractAddressArray[i]);

            // AirDailyAggregateEntityStats
            //let sellEventAggregateEntityStatsId = getAirDailyAggregateEntityStatsId(sellActionEventAggregatedEntityId);
            //let sellEventAggregateEntityStats = getOrCreateAirDailyAggregateEntityStats(sellEventAggregateEntityStatsId);

            let attendEventAggregateEntityStatsId = getAirEventAggregateEntityStatsId(attendActionEventAggregatedEntityId);
            let attendEventAggregateEntityStats = getOrCreateAirDailyAggregateEntityStats(attendEventAggregateEntityStatsId);

            // attend Stat
            let attendStatId = getAirPOAPAttendStatsId(contractAddress, attendActionEventAggregatedEntityId);
            let attendStat = getOrCreateAirPOAPAttendStats(attendStatId);
            //saleStat.volumeInUSD = saleStat.volumeInUSD.plus(volumeInUSD);
            attendStat.transactionCount = attendStat.transactionCount.plus(BIG_INT_ONE);
            attendStat.walletCount = attendStat.walletCount.plus(BigInt.fromI32(newBuyWalletCount));

            // Transaction
            let transaction = getOrCreateAirPOAPAttendTransaction(
                getNFTSaleTransactionId(txHash, contractAddress, eventId, nftId)
            );
            transaction.type = protocolActionType;
            transaction.tokenId = nftId;
            transaction.eventId = BigInt.fromString(eventId)
            //transaction.paymentAmount = paymentAmount.div(BigInt.fromI32(fromArray.length)); // For bundle sale, equally divide the payment amount in all sale transaction
            
            // populate transaction extraData object 
            // if (options != null 
            //     && options.transactionExtraData != null 
            //     && options.transactionExtraData.entries.length > 0) {

            //     let txnExtraDataMaplength = options.transactionExtraData.entries.length;
            //     let extraDataArray = new Array<string>();
            //     for (let i = 0; i < txnExtraDataMaplength; i++) {
            //         let entry =  options.transactionExtraData.entries[i];
            //         let id = entry.key;
            //         let childMap = entry.value;
            //         for (let j = 0; j < childMap.entries.length; j++) {
            //             let name = childMap.entries[j].key ;
            //             let value = childMap.entries[j].value ;
            //             let airExtraData = new AirExtraData(id);
            //             airExtraData.name = name;
            //             airExtraData.value = value;
            //             airExtraData.save();
            //             extraDataArray.push(id);
            //         }
            //     }
            //     transaction.extraData = extraDataArray;
            // }
            //Build Relationship 
            attendStat.token = attendToken.id;
            // sellActionEventAggregatedEntity.stats = sellEventAggregateEntityStatsId;
            // sellActionEventAggregatedEntity.contract = contract.id

            attendActionEventAggregatedEntity.stats = attendEventAggregateEntityStatsId;
            attendActionEventAggregatedEntity.contract = contract.id

            //sellAggregatedEntityAccount.dailyAggregatedEntity = sellActionEventAggregatedEntityId;
            attendAggregatedEntityAccount.dailyAggregatedEntity = attendActionEventAggregatedEntityId;

            //sellEventAggregateEntityStats.protocolActionType = "SELL";
            //sellEventAggregateEntityStats.saleStat = saleStatId;

            attendEventAggregateEntityStats.protocolActionType = protocolActionType;
            attendEventAggregateEntityStats.attendStat = attendStatId;

            transaction.attendStat = attendStatId;
            transaction.transactionToken = attendToken.id;
            //transaction.paymentToken = paymentToken.id;
            transaction.to = buyerAccount.id;
            transaction.from = sellerAccount.id;
            transaction.hash = txHash;

            // Save Everything
            buyerAccount.save();
            sellerAccount.save();
            //sellAggregatedEntityAccount.save();
            attendAggregatedEntityAccount.save();
            contract.save();
            attendStat.save()
            transaction.save();
            // sellEventAggregateEntityStats.save()
            attendEventAggregateEntityStats.save();
            // sellActionEventAggregatedEntity.save();
            attendActionEventAggregatedEntity.save();
        }
    }

    export function getEventAggregatedEntityId(contractAddress: string, protocolActionType: string, eventId: string): string {
        return dataSource.network()
            .concat("-")
            .concat(contractAddress)
            .concat("-")
            .concat(protocolActionType.toString())
            .concat("-")
            .concat(eventId);
    }

    export function getNFTSaleTransactionId(txHash: string, contractAddress: string, eventId: string, nftId: BigInt): string {

        return dataSource.network()
            .concat("-")
            .concat(txHash)
            .concat("-")
            .concat(contractAddress)
            .concat("-")
            .concat(eventId)
            .concat("-")
            .concat(nftId.toString());
    }

    export function getAirPOAPAttendStatsId(contractAddress: string, eventAggregatedEntityId: string): string {

        return dataSource.network()
            .concat("-")
            .concat(eventAggregatedEntityId)
            .concat("-")
            .concat(contractAddress)

    }

    export function getEventAggregatedAccountId(eventAggregatedEntityId: string, accountId: string): string {
        return eventAggregatedEntityId.concat("-").concat(accountId);
    }

    export function getAirEventAggregateEntityStatsId(eventAggregatedEntityId: string): string {
        return eventAggregatedEntityId.concat("-").concat("stats");
    }

    export function getOrCreateAirContract(contractAddress: Address): AirContract {
        let entity = AirContract.load(contractAddress.toHexString());

        if (entity == null) {
            entity = new AirContract(contractAddress.toHexString());
            entity.address = contractAddress.toHexString();

        }
        return entity as AirContract;
    }

    export function getOrCreateAirDailyAggregateEntity(id: string, timestamp: BigInt, protocolActionType: string, protocolType:string, network: string): AirDailyAggregateEntity {
        let entity = AirDailyAggregateEntity.load(id);

        if (entity == null) {
            entity = new AirDailyAggregateEntity(id);
            entity.volumeInUSD = BigDecimal.zero();
            entity.tokenCount = BigInt.fromString("1");
            entity.daySinceEpoch = BigInt.fromString(getDaysSinceEpoch(timestamp.toI32()));
            entity.startDayTimestamp = getDayOpenTime(timestamp);
            entity.walletCount = BigInt.zero();
            entity.transactionCount = BigInt.zero();
            entity.network = network; 
            entity.updatedTimestamp = timestamp;
            entity.protocolType = protocolType;
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

    export function getOrCreateAirPOAPAttendStats(id: string): AirNFTSaleStats {
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
    export function getOrCreateAirToken(address: string, eventId:string, network: string): AirToken {
        let id = address + "-" + network +"-" + eventId;
        let entity = AirToken.load(id); 
        log.info("address token {},", [address]);
        if (entity == null) {
            entity = new AirToken(id)
            entity.address = address
            entity.standard = "ERC721";
            entity.name = eventId
            entity.symbol= "POAP"
        }
        return entity as AirToken
    }

    export function getOrCreateAirPOAPAttendTransaction(id: string): AirNFTSaleTransaction {

        let transaction = AirNFTSaleTransaction.load(id);

        if (transaction == null) {
            transaction = new AirNFTSaleTransaction(id);
        }

        return transaction as AirNFTSaleTransaction;

    }

}