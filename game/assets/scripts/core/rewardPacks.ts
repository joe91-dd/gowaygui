import type {BookPackGrade,GameSave,RewardGrant,SkillId} from './types';
import {SKILLS} from './data';
import {random} from './random';
import {skillUnlocked} from './soloProgress';
export const PACK_NAMES:Record<BookPackGrade,string>={common:'通用技能随机礼包',precious:'珍贵技能随机礼包',active:'职业主动随机礼包',mastery:'职业专精随机礼包'};
export const PACK_COLORS:Record<BookPackGrade,string>={common:'#D9BD53',precious:'#D66059',active:'#D9A539',mastery:'#D9A539'};
export function packPool(grade:BookPackGrade):SkillId[]{return SKILLS.filter(s=>grade==='mastery'?s.specialization:grade==='active'?s.active:grade==='precious'?s.precious&&!s.specialization:!s.active&&!s.precious&&!s.specialization).map(s=>s.id);}
export function applyReward(s:GameSave,g:RewardGrant):void{
 if(g.kind==='gold')s.gold+=g.amount;else if(g.kind==='material')s.materials[g.material]+=g.amount;else if(g.kind==='book'){s.skillBooks??={};s.skillBooks[g.skillId]=(s.skillBooks[g.skillId]??0)+g.amount;}else{s.bookPacks??={};s.bookPacks[g.grade]=(s.bookPacks[g.grade]??0)+g.amount;}
}
export function openBookPack(s:GameSave,grade:BookPackGrade):SkillId{
 if(!PACK_NAMES[grade]||!(s.bookPacks?.[grade]))throw Error('这个礼包数量不足');
 const pool=packPool(grade).filter(id=>skillUnlocked(s,id));if(!pool.length)throw Error('请先通过主线或无尽解锁这类技能，再开启礼包');const skillId=pool[Math.floor(random(s)*pool.length)];s.bookPacks![grade]!--;applyReward(s,{kind:'book',skillId,amount:1});return skillId;
}
export const packForWave=(wave:number):BookPackGrade=>wave>=30?'active':'common';
export function validReward(g:RewardGrant):boolean{return !!g&&Number.isSafeInteger(g.amount)&&g.amount>0&&(g.kind==='gold'||g.kind==='material'&&['attack','health','defense','growth'].includes(g.material)||g.kind==='book'&&SKILLS.some(s=>s.id===g.skillId)||g.kind==='bookPack'&&!!PACK_NAMES[g.grade]);}
