import {bookAllowed,bookChestReward,policyBook} from './bookPolicy';
import {random} from './random';
import type {GameSave,SkillId,RewardGrant} from './types';
import type {BattleState} from './battle';
import {SKILLS,SKILL_BY_ID} from './data';
import {BOSSES,bossDropChance} from './bossCatalog';
import {goldAmount} from './economy';
import {applyReward,validReward} from './rewardPacks';
import {sendSystemMail} from './mail';

export interface RewardChest {id:string;title:string;stars:number;grants:RewardGrant[];at:number;claimed:boolean}
export interface ProgressionState {version:1;bossDropClaims?:string[];skills:string[];bosses:string[];codexClaims:string[];chests:RewardChest[];arena:{starVersion?:2;week:number;rating:number;best:number;games:number;lastDaily:number;weeklySettled:boolean;tierClaims:number[]}}
const DAY=86400000,OFFSET=8*3600000;
export const arenaDay=(now:number)=>Math.floor((now+OFFSET)/DAY);
export const arenaWeek=(now:number)=>{const day=arenaDay(now);return day-((day+3)%7);};
export const ARENA_TIERS=[{name:'青铜',min:0},{name:'白银',min:9},{name:'黄金',min:18},{name:'铂金',min:27},{name:'钻石',min:36},{name:'王者',min:45}];
export const arenaRankLabel=(stars:number):string=>stars>=45?'王者 '+(stars-45)+' ★':ARENA_TIERS[Math.floor(Math.max(0,stars)/9)].name+' '+(3-Math.floor(Math.max(0,stars)%9/3))+' · '+'★'.repeat(Math.max(0,stars)%3)+'☆'.repeat(3-Math.max(0,stars)%3);
export const arenaResetStars=(stars:number):number=>stars>=45?27:Math.max(0,stars-18);
export const arenaTier=(rating:number)=>ARENA_TIERS.reduce((n,t,i)=>rating>=t.min?i:n,0);
export const arenaSettlementAt=(now:number)=>(arenaWeek(now)+6)*DAY-OFFSET+22*3600000;
export const arenaWeeklyGrants=(s:GameSave,tier:number):RewardGrant[]=>[{kind:'gold',amount:goldAmount(s,180+tier*130)},{kind:'material',material:'growth',amount:1+tier},...(s.livingVersion?[{kind:'bookPack' as const,grade:tier>=5?'precious' as const:tier>=4?'mastery' as const:tier>=2?'active' as const:'common' as const,amount:1}]:[])];
export const arenaLocked=(now:number)=>{
 if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('all-modes')==='1')return false;
 return arenaDay(now)-arenaWeek(now)===6&&(now+OFFSET)%DAY>=22*3600000;
};
export function progression(s:GameSave):ProgressionState{
 const p=s.progression??={version:1,skills:[],bosses:[],codexClaims:[],chests:[],arena:{starVersion:2,week:arenaWeek(s.clockHighWater),rating:0,best:0,games:0,lastDaily:arenaDay(s.clockHighWater)-1,weeklySettled:false,tierClaims:[]}};
 if(p.arena.starVersion!==2){const old=[0,120,300,550,850,1200],convert=(value:number)=>{const tier=old.reduce((n,min,i)=>value>=min?i:n,0);return tier*9+(tier===5?Math.floor((value-1200)/48):Math.min(8,Math.floor((value-old[tier])/(old[tier+1]-old[tier])*9)));};p.arena.rating=convert(p.arena.rating);p.arena.best=convert(p.arena.best);p.arena.starVersion=2;}
 return p;
}
export function grantChest(s:GameSave,id:string,title:string,stars:number,grants:RewardGrant[],at=s.clockHighWater):RewardChest{
 const p=progression(s),existing=p.chests.find(c=>c.id===id);if(existing)return existing;
 const chest={id,title,stars,grants,at,claimed:false};p.chests.push(chest);return chest;
}
export function claimChest(s:GameSave,id:string):void{const c=progression(s).chests.find(c=>c.id===id);if(!c||c.claimed)throw Error('宝箱不存在或已领取');for(const g of c.grants)applyReward(s,g);c.claimed=true;}
export function discoverBattle(s:GameSave,b?:BattleState):void{
 if(!b)return;const p=progression(s);
 for(const e of b.enemies)if(e.bossId&&!e.alive&&e.hp<=0){
  if(!p.bosses.includes(e.bossId))p.bosses.push(e.bossId);
  if(b.faunaVersion!==1)continue;
  const boss=BOSSES.find(v=>v.id===e.bossId);if(!boss)continue;
  const key=(b.encounter==='raid'?s.community?.raid?.id:s.run?.id)+':'+b.wave+':'+e.id;p.bossDropClaims??=[];
  if(p.bossDropClaims.includes(key))continue;p.bossDropClaims.push(key);
  const hash=(text:string)=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  const mat=(['attack','health','defense','growth'] as const)[hash(boss.id)%4];
  s.gold+=goldAmount(s,10+boss.tier*6);s.materials[mat]+=1+Math.floor(boss.tier/2);
  if(boss.dropBook&&bookAllowed(boss.dropBook,b.encounter==='raid'?'raid':b.mode==='endless'?'endless':'chapter')&&hash(key+':loot')/4294967296<bossDropChance(boss.tier)){s.skillBooks??={};s.skillBooks[boss.dropBook]=(s.skillBooks[boss.dropBook]??0)+1;}
 }
}
export function syncProgression(s:GameSave,now:number):void{
 const p=progression(s);const skills=new Set(p.skills);
 for(const t of Object.values(s.collection))for(const id of t.skills)skills.add(id);
 for(const [id,count] of Object.entries(s.skillBooks??{}))if(count)skills.add(id);
 if(s.run)for(const u of Object.values(s.run.units))for(const id of u.turtle.skills)skills.add(id);
 p.skills=Array.from(skills);
 discoverBattle(s,s.run?.battle);discoverBattle(s,s.community?.raid?.battle);
 const a=p.arena,week=arenaWeek(now),day=arenaDay(now),todayCut=day*DAY-OFFSET+22*3600000,lastCut=now>=todayCut?day:day-1;
 const awardWeekly=()=>{if(a.games>0&&!a.weeklySettled){const tier=arenaTier(a.rating),at=(a.week+6)*DAY-OFFSET+22*3600000,grants=arenaWeeklyGrants(s,tier);if(s.livingVersion)sendSystemMail(s,'arena-week:'+a.week,'竞技场周结算 · '+ARENA_TIERS[tier].name,'本周赛季已经结算。感谢你与伙伴并肩作战，附件为本周最终段位奖励。',grants,at,'arena');else grantChest(s,'arena-week:'+a.week,'赛季结算 · '+ARENA_TIERS[tier].name,Math.min(3,1+Math.floor(tier/2)),grants,at);}a.weeklySettled=true;};
 // Catch up only the latest eligible daily reward, never fabricate days with no participation.
 const eligibleCut=Math.min(lastCut,a.week+6);
 if(eligibleCut>a.lastDaily){if(a.games>0){const rank=(s.community?.arenaOrder.indexOf('local-player')??8)+1;grantChest(s,'arena-day:'+eligibleCut,'每日排名 · 第'+rank+'名',1,[{kind:'gold',amount:goldAmount(s,Math.max(40,160-rank*12))}],eligibleCut*DAY-OFFSET+22*3600000);}a.lastDaily=lastCut;}
 if(week>a.week){awardWeekly();a.week=week;a.rating=arenaResetStars(a.rating);a.best=a.rating;a.games=0;a.weeklySettled=false;a.tierClaims=[];if(s.community){s.community.arenaOrder=s.community.arenaOrder.filter(id=>id!=='local-player').concat('local-player');}}
 if(arenaLocked(now))awardWeekly();
}
export function recordArena(s:GameSave,victory:boolean,draw:boolean):void{const a=progression(s).arena;a.games++;a.rating=Math.max(0,a.rating+(draw?0:victory?1:-1));a.best=Math.max(a.best,a.rating);if(victory&&!draw&&random(s)<.35)applyReward(s,{kind:'book',skillId:policyBook(s,'elite'),amount:1});}
export function claimArenaTier(s:GameSave,tier:number):void{const a=progression(s).arena;if(!Number.isInteger(tier)||tier<0||tier>=ARENA_TIERS.length||a.best<ARENA_TIERS[tier].min||a.tierClaims.includes(tier)||a.games===0)throw Error('尚未达到该段位，或奖励已经领取');a.tierClaims.push(tier);const c=grantChest(s,`arena-tier:${a.week}:${tier}`,ARENA_TIERS[tier].name+'段位宝箱',Math.min(3,1+Math.floor(tier/2)),[{kind:'gold',amount:goldAmount(s,80+tier*90)},{kind:'material',material:'attack',amount:1+tier}]);claimChest(s,c.id);}
export function claimCodex(s:GameSave,kind:'skill'|'boss',id:string):number{const p=progression(s),key=kind+':'+id,list=kind==='skill'?p.skills:p.bosses;if(!list.includes(id)||p.codexClaims.includes(key))throw Error('尚未解锁或已领取');const skill=SKILL_BY_ID[id as SkillId],boss=BOSSES.find(b=>b.id===id);if(kind==='skill'?!skill:!boss)throw Error('图鉴条目不存在');const amount=goldAmount(s,kind==='boss'?100+(boss?.tier??0)*50:(skill?.active||skill?.specialization)?60:skill?.precious?40:20);p.codexClaims.push(key);s.gold+=amount;return amount;}
export function validateProgression(s:GameSave):void{const p=s.progression;if(!p)return;const check=(ok:unknown)=>{if(!ok)throw Error('成就与赛季资料损坏');},integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
 check(p.version===1);if(p.bossDropClaims)check(Array.isArray(p.bossDropClaims)&&new Set(p.bossDropClaims).size===p.bossDropClaims.length&&p.bossDropClaims.every(x=>typeof x==='string'));for(const list of [p.skills,p.bosses,p.codexClaims])check(Array.isArray(list)&&new Set(list).size===list.length&&list.every(x=>typeof x==='string'));
 check(p.skills.every(id=>SKILLS.some(x=>x.id===id))&&p.bosses.every(id=>BOSSES.some(b=>b.id===id)));
 check(Array.isArray(p.chests)&&new Set(p.chests.map(c=>c.id)).size===p.chests.length);
 for(const c of p.chests){check(typeof c.id==='string'&&typeof c.title==='string'&&integer(c.stars)&&c.stars<=3&&integer(c.at)&&typeof c.claimed==='boolean'&&Array.isArray(c.grants));for(const g of c.grants)check(validReward(g));}
 const a=p.arena;check(a.starVersion===undefined||a.starVersion===2);check(a&&[a.rating,a.best,a.games].every(integer)&&Number.isSafeInteger(a.week)&&Number.isSafeInteger(a.lastDaily)&&typeof a.weeklySettled==='boolean'&&Array.isArray(a.tierClaims)&&new Set(a.tierClaims).size===a.tierClaims.length&&a.tierClaims.every(n=>integer(n)&&n<6));
}
