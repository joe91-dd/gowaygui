import type {Turtle,SkillId,RewardGrant} from './types';
import type {BattleState,BattleUnit} from './battle';

export interface IslandPlayer {id:string;name:string;ai:boolean;gold:number;pets:Record<string,Turtle>;books:Partial<Record<SkillId,number>>;assists:string[];chapter:number;chapterSeconds:number;endless:number;endlessSeconds:number}
export interface ChatLine {id:string;from:string;to:string;text:string;at:number}
export interface Listing {id:string;ownerId:string;kind:'pet'|'book'|'rental';pet?:Turtle;skillId?:SkillId;price:number;createdAt:number;status:'listed'|'sold'|'cancelled';buyerId?:string;tax?:number}
export interface Loan {id:string;ownerId:string;originalId:string;turtle:Turtle;kind:'friend'|'rental';createdAt:number;expiresAt:number;usedBy?:string;finished:boolean}
export interface MarketReceipt {id:string;kind:'buy'|'sell'|'rent'|'rentalIncome';listingId:string;gross:number;tax:number;net:number;at:number;otherId:string;taxDenomination?:1000|100}
export interface PetChoice {id:string;ownerId:string;originalId:string;turtle:Turtle;loanId?:string}
export interface RaidMember {ownerId:string;name:string;ai:boolean;roster:PetChoice[];activeId:string;station?:number;placement?:import('./types').Point;moveReadyTick?:number}
export interface RaidSession {
  expeditionVersion?:1;petRewards?:Turtle[];
  operationOwners?:string[];
  mapVersion?:5|6;sceneRevision?:number;
  timed?:boolean;chestId?:string;stars?:number;remaining?:number;id:string;tier:number;phase:'prep'|'combat'|'between'|'result';wave:number;seconds:number;coreHealth:number;members:RaidMember[];sleep:Record<string,number>;fallen?:string[];battle?:BattleState;victory?:boolean;rewards?:RewardGrant[];settled:boolean;startedAt:number}
export interface ArenaMover {id:string;distance:number;enterTick:number;escaped:boolean;waiting?:boolean;blockUntilTick?:number;blockUsed?:boolean;blockOwnerId?:string}
export interface ArenaSession {
  seasonWeek?:number;ratingBefore?:number;ratingAfter?:number;practice?:boolean;defending?:boolean;autoDeploy?:boolean;id:string;opponentId:string;phase:'combat'|'result';attackers:BattleUnit[];defenders:BattleUnit[];movers:ArenaMover[];battle:BattleState;passed:number;seconds:number;victory?:boolean;draw?:boolean;endReason?:'eliminated'|'route-complete'|'timeout'|'abandoned';settled:boolean;rankBefore:number;rankAfter?:number;startedAt:number}
export interface CommunityState {
  showcase?:{ids:string[];rotate:boolean};
  version:1;playerId:'local-player';name:string;aiPlayers:Record<string,IslandPlayer>;friends:string[];blocked:string[];assists:string[];
  messages:ChatLine[];listings:Listing[];loans:Loan[];receipts:MarketReceipt[];
  daily:{day:string;borrowed:number;listed:number;petRentals:Record<string,number>};
  hideRankings:boolean;hiddenPets:string[];scoreArrivals:Record<string,{score:number;order:number;at:number}>;scoreCounter:number;
  arenaOrder:string[];arenaDefense:string[];arenaAttack:string[];raid?:RaidSession;arena?:ArenaSession;
}
export type CommunityAction =
  | {kind:'showcase';ids:string[];rotate:boolean}
  | {kind:'init'|'refresh'} | {kind:'renamePlayer';name:string}
  | {kind:'friend';id:string;action:'add'|'remove'|'block'|'unblock'}
  | {kind:'chat';to:string;text:string} | {kind:'assists';ids:string[]}
  | {kind:'borrow';ownerId:string;petId:string}
  | {kind:'list';asset:'pet'|'book'|'rental';id:string;price:number}
  | {kind:'cancelListing'|'buy'|'rent'|'aiPurchase';id:string}
  | {kind:'rankVisibility';hidden:boolean;petId?:string}
  | {kind:'arenaDefense'|'arenaAttack';ids:string[]};
