import type {GameSave,RewardGrant,Turtle} from './types';
import {applyReward,validReward} from './rewardPacks';
export interface SystemMail {pets?:Turtle[];id:string;title:string;body:string;sentAt:number;grants:RewardGrant[];read:boolean;claimed:boolean;source:'system'|'arena'|'room'}
export interface Mailbox {version:1;items:SystemMail[]}
export function mailbox(s:GameSave):Mailbox{return s.mailbox??={version:1,items:[]};}
export function sendSystemMail(s:GameSave,id:string,title:string,body:string,grants:RewardGrant[],sentAt=s.clockHighWater,source:SystemMail['source']='system'):SystemMail{
 const box=mailbox(s),prior=box.items.find(m=>m.id===id);if(prior)return prior;
 const mail:SystemMail={id,title,body,grants,sentAt,source,read:false,claimed:false};box.items.push(mail);return mail;
}
export function readMail(s:GameSave,id:string):void{const m=mailbox(s).items.find(m=>m.id===id);if(!m)throw Error('邮件不存在');m.read=true;}
export function claimMail(s:GameSave,id:string):void{const m=mailbox(s).items.find(m=>m.id===id);if(!m)throw Error('邮件不存在');if(m.claimed)return;const pets=(m.pets??[]).filter(t=>!s.collection[t.id]);if(Object.keys(s.collection).length+pets.length>s.capacity)throw Error('龟龟收藏已满，请整理后再领取');for(const t of pets)s.collection[t.id]=JSON.parse(JSON.stringify(t));for(const g of m.grants)applyReward(s,g);m.read=true;m.claimed=true;}
export function deleteMail(s:GameSave,id:string):void{const box=mailbox(s),m=box.items.find(m=>m.id===id);if(!m)return;if(!m.claimed&&(m.grants.length||m.pets?.length))throw Error('请先领取附件');box.items=box.items.filter(m=>m.id!==id);}
export function validateMailbox(s:GameSave):void{const box=s.mailbox;if(!box)return;const ids=new Set<string>();if(box.version!==1||!Array.isArray(box.items))throw Error('邮箱资料损坏');for(const m of box.items){if(!m||typeof m.id!=='string'||ids.has(m.id)||typeof m.title!=='string'||m.title.length>100||typeof m.body!=='string'||m.body.length>4000||!Number.isSafeInteger(m.sentAt)||m.sentAt<0||typeof m.read!=='boolean'||typeof m.claimed!=='boolean'||!['system','arena','room'].includes(m.source)||!Array.isArray(m.grants)||!m.grants.every(validReward))throw Error('系统邮件资料损坏');ids.add(m.id);}}
