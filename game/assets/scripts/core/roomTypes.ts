import type {Turtle,RewardGrant} from './types';
import type {RaidSession} from './communityTypes';
export interface RoomMember {clientId:string;name:string;ai:boolean;ready:boolean;online:boolean;roster:Turtle[];auto:boolean;held:string[]}
export interface RoomView {speed?:1|2;id:string;code:string;tier:number;host:string;me:string;matching:boolean;phase:string;revision:number;createdAt:number;members:RoomMember[];raid?:RaidSession}
export interface RoomMail {pets?:Turtle[];id:string;clientId:string;title:string;body:string;grants:RewardGrant[];chest?:{title:string;stars:number;grants:RewardGrant[]};xp:number;petIds:string[];at:number}
export interface RoomState {playerId:string;room:RoomView|null;invitations:{roomId:string;code:string;name:string;tier:number;at:number}[];mail:RoomMail[];online:{id:string;name:string;inRoom:boolean}[]}
