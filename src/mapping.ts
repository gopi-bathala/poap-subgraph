import {
  ethereum, BigInt, Address, log, TypedMap
} from '@graphprotocol/graph-ts'

import {
  EventToken as EventTokenEvent,
  Poap,
  Transfer   as TransferEvent,
} from '../generated/Poap/Poap'

import * as airstack from "./modules/airstack"
import {  BIGINT_ZERO , ZERO_ADDRESS, ZERO_ADDRESS_STRING} from "./modules/prices/common/constants";

const POAP_CONTRACT_ADDRESS = Address.fromString("0x22C1f6050E56d2876009903609a2cC3fEf83B415");

export function handleTransfer(ev: TransferEvent): void {

  // call airstack function to populate schemas
  let txHashString = ev.transaction.hash.toHex();
  let seller = ev.params.from;
  let buyer = ev.params.to;
  let tokenId = ev.params.tokenId;
  let blockTimestamp = ev.block.timestamp;
  let blockHeight = ev.block.number

  // do smart contract call to get eventid
  let poapContractAddress = Poap.bind(POAP_CONTRACT_ADDRESS);
  let eventId = poapContractAddress.tokenEvent(tokenId)
  //let tokenURI =  poapContractAddress.tokenURI(tokenId)

  log.warning("data for contract call tx: {} logindex: {}  from:  {} to: {} contract: {} tokenId: {} blockTimestamp {} eventId {}  blockHeight {}", [
    txHashString,
    ev.logIndex.toString(),
    seller.toHex(),
    buyer.toHex(),
    POAP_CONTRACT_ADDRESS.toHex(),
    tokenId.toString(),
    blockTimestamp.toString(),
    eventId.toString(),
    blockHeight.toString()
  ]);

  let extraDataMap = new TypedMap<string, string>()
  extraDataMap.set("eventId", eventId.toString())

  let id =  "transactionExtraData-" + ev.transaction.hash.toHex() + "-" + ev.transactionLogIndex.toString()
  let map = new TypedMap<string, TypedMap<string, string>>();
  map.set(id, extraDataMap)
  let nftOptions = new airstack.nft.NftOptions(map)
  
  airstack.nft.trackNFTSaleTransactions(
    txHashString,
    [seller],
    [buyer],
    [POAP_CONTRACT_ADDRESS],
    [ev.params.tokenId],
    ZERO_ADDRESS,
    BIGINT_ZERO,
    blockTimestamp,
    blockHeight,
    nftOptions
  ); 
}
