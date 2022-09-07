import {
  ethereum, BigInt, Address, log, TypedMap
} from '@graphprotocol/graph-ts'

import {
  EventToken as EventTokenEvent,
  Poap,
  Transfer   as TransferEvent,
} from '../generated/Poap/Poap'

import {
  Token,
  Event,
  Account,
  Transfer
} from '../generated/schema'

import * as airstack from "./modules/airstack"
import {  BIGINT_ZERO , ZERO_ADDRESS, ZERO_ADDRESS_STRING} from "./modules/prices/common/constants";
import {AirExtraData } from "../generated/schema";

const POAP_CONTRACT_ADDRESS = Address.fromString("0x22C1f6050E56d2876009903609a2cC3fEf83B415");

function createEventID(event: ethereum.Event): string
{
  return event.block.number.toString().concat('-').concat(event.logIndex.toString());
}

// This handler always run after the transfer handler
export function handleEventToken(ev: EventTokenEvent): void
{
  let event = Event.load(ev.params.eventId.toString());
  if (event == null) {
    event               = new Event(ev.params.eventId.toString());
    event.tokenCount    = BigInt.fromI32(0);
    event.tokenMints    = BigInt.fromI32(0);
    event.transferCount = BigInt.fromI32(0);
    event.created       = ev.block.timestamp
  }
  event.tokenCount = event.tokenCount.plus(BigInt.fromI32(1));
  event.tokenMints = event.tokenMints.plus(BigInt.fromI32(1));
  event.transferCount = event.transferCount.plus(BigInt.fromI32(1));
  event.save();
  
  let token = Token.load(ev.params.tokenId.toString());
  if (token != null) {
    token.event         = event.id;
    token.mintOrder   = event.tokenMints;
    token.save()
  }
}

export function handleTransfer(ev: TransferEvent): void {
  let from     = Account.load(ev.params.from.toHex());
  if (from == null) {
    from              = new Account(ev.params.from.toHex());
    // The from account at least has to own one token
    from.tokensOwned  = BigInt.fromI32(1);
  }
  // Don't subtracts from the ZERO_ADDRESS (it's the one that mint the token)
  // Avoid negative values
  if(from.id != ZERO_ADDRESS_STRING) {
    from.tokensOwned.minus(BigInt.fromI32(1));
  }
  from.save();

  let to       = Account.load(ev.params.to.toHex());
  if (to == null) {
    to              = new Account(ev.params.to.toHex());
    to.tokensOwned  = BigInt.fromI32(0);
  }
  to.tokensOwned.plus(BigInt.fromI32(1));
  to.save();

  let token    = Token.load(ev.params.tokenId.toString());
  if (token == null) {
    token               = new Token(ev.params.tokenId.toString());
    token.transferCount = BigInt.fromI32(0);
    token.created       = ev.block.timestamp
  }
  token.owner = to.id;
  token.transferCount.plus(BigInt.fromI32(1));
  token.save();
  
  if (token.event != null) {
    let event = Event.load(token.event!);
    if(event != null) {
      // Add one transfer
      event.transferCount.plus(BigInt.fromI32(1));
      // Burning the token
      if(to.id == ZERO_ADDRESS_STRING) {
        event.tokenCount.minus(BigInt.fromI32(1));
        // Subtract all the transfers from the burned token
        event.transferCount.minus(token.transferCount);
      }
      event.save();
    }
  }
  let transfer = new Transfer(createEventID(ev));
  transfer.token       = token.id;
  transfer.from        = from.id;
  transfer.to          = to.id;
  transfer.transaction = ev.transaction.hash;
  transfer.timestamp   = ev.block.timestamp;
  transfer.save();

  // call airstack function to populate schemas
  let txHashString = ev.transaction.hash.toHex();
  let seller = ev.params.from;
  let buyer = ev.params.to;
  let tokenId = ev.params.tokenId;
  let blockTimestamp = ev.block.timestamp;

  // do smart contract call to get eventid
  let poapContractAddress = Poap.bind(POAP_CONTRACT_ADDRESS);
  let eventId = poapContractAddress.tokenEvent(tokenId)
  //let tokenURI =  poapContractAddress.tokenURI(tokenId)

  // log.warning("data for contract call tx: {} logindex: {}  from:  {} to: {} contract: {} tokenId: {} blockTimestamp {} eventId {}  tokenURL {}", [
  //   txHashString,
  //   ev.logIndex.toString(),
  //   seller.toHex(),
  //   buyer.toHex(),
  //   POAP_CONTRACT_ADDRESS.toHex(),
  //   tokenId.toString(),
  //   blockTimestamp.toString(),
  //   eventId.toString(),
  //   tokenURI
  // ]);

  // let extraData = new AirExtraData(ev.id)
  // extraData.name = "eventid"
  // extraData.value = event.id

  let extraDataMap = new TypedMap<string, string>()
  extraDataMap.set("eventId", eventId.toString())
  //extraDataMap.set("tokenURI", tokenURI)

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
    nftOptions
  ); 
}
