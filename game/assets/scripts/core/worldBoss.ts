import {expeditionSlots} from './expeditionRules';
import {createBattle,stepBattle,moveBattleUnit,commandBattle,focusBattle} from './battle';
import type {BattleState,BattleEnemy,BattleCommand} from './battle';
import type {Turtle,Point,RewardGrant} from './types';
import {BATTLE_MAPS} from './data';
import {placementIssue} from './placement';

export const WORLD_BOSS_MAP=56,WORLD_BOSS_SECONDS=90,WORLD_BOSS_ATTEMPTS=3;
export const WORLD_BOSSES=[
 {name:'负岳玄鳌',art:'world-boss-leviathan',subtitle:'潮汐重锤 · 留意蓄力落点',counter:'重锤蓄力后破甲，及时调位避开；物法混合输出更稳定。',abilityId:'raid-h01',armor:38,resist:38,attack:26,color:'#51C8D8'},
 {name:'万触渊主',art:'world-boss-crab',subtitle:'噬光虹吸 · 分散站位',counter:'虹吸命中后恢复自身生命。分散站位或打断蓄力，物理输出更有效。',abilityId:'raid-h02',armor:18,resist:75,attack:27,color:'#9982D5'},
 {name:'焚潮巨猿',art:'world-boss-kraken',subtitle:'熔甲震荡 · 法术破防',counter:'坚硬熔甲抵御物理伤害，震荡会削弱护盾。法师和治疗更有价值。',abilityId:'raid-h03',armor:75,resist:18,attack:29,color:'#E67B51'},
 {name:'星冠狮鹫',art:'world-boss-tortoise',subtitle:'霜晶禁锢 · 净化接力',counter:'霜晶冲击会冻结伙伴。保留净化、治疗，移动避开预警落点。',abilityId:'raid-h04',armor:55,resist:45,attack:25,color:'#70C6AC'},
] as const;
export const WORLD_DAMAGE_TIERS=[2000,4000,6000,9000,12000,16000,21000,27000,35000,45000];
export const worldTierGrants=(tier:number):RewardGrant[]=>[
 {kind:'gold',amount:[300,450,650,900,1200,1600,2100,2800,3600,4800][tier]},
 {kind:'material',material:(['attack','health','defense','growth'] as const)[tier%4],amount:2+Math.floor(tier/2)},
 ...(tier===2||tier===4?[{kind:'bookPack' as const,grade:'common' as const,amount:1}]:tier===6?[{kind:'bookPack' as const,grade:'active' as const,amount:1}]:tier===8?[{kind:'bookPack' as const,grade:'mastery' as const,amount:1}]:tier===9?[{kind:'bookPack' as const,grade:'precious' as const,amount:1}]:[]),
];
export const WORLD_RANK_TIERS=[
 {max:1,name:'第 1 名',gold:8000,grade:'precious',books:1},
 {max:3,name:'第 2–3 名',gold:6000,grade:'mastery',books:1},
 {max:10,name:'第 4–10 名',gold:4000,grade:'active',books:2},
 {max:50,name:'第 11–50 名',gold:2500,grade:'active',books:1},
 {max:100,name:'第 51–100 名',gold:1500,grade:'common',books:2},
 {max:Number.MAX_SAFE_INTEGER,name:'其余参与者',gold:800,grade:'common',books:1},
] as const;
export function worldRankGrants(rank:number):RewardGrant[]{const p=WORLD_RANK_TIERS.find(p=>rank<=p.max)!;return [{kind:'gold',amount:p.gold},{kind:'bookPack',grade:p.grade,amount:p.books}];}
const DAY=86400000,OFFSET=8*3600000;
export function worldBossDay(now:number){const number=Math.floor((now+OFFSET)/DAY),start=number*DAY-OFFSET,closes=start+22*3600000;return {key:new Date(start+OFFSET).toISOString().slice(0,10),number,bossIndex:((number%WORLD_BOSSES.length)+WORLD_BOSSES.length)%WORLD_BOSSES.length,closes,next:start+DAY,canStart:now>=start&&now+WORLD_BOSS_SECONDS*1000<=closes};}
export interface WorldBossFight {id:string;day:string;bossIndex:number;startedAt:number;endsAt:number;roster:Turtle[];battle:BattleState;damage:number;phase:'combat'|'result';operationPaused?:boolean;finishedAt?:number}
export interface WorldBossRank {id:string;name:string;damage:number;rank:number;own?:boolean;showcase?:Turtle[];rotate?:boolean;roster?:Turtle[]}
export interface WorldBossView {day:string;bossIndex:number;closes:number;next:number;serverTime:number;canStart:boolean;attempts:number;best:number;rank?:number;claimed:number[];ranking:WorldBossRank[];participants:number;fight?:WorldBossFight}
function pathLength(route:Point[]):number{return route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.z-route[i].z),0);}
function pathPoint(route:Point[],distance:number):Point{let left=Math.max(0,distance);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(left<=length){const f=length<1e-6?0:left/length;return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};}left-=length;}return {...route[route.length-1]};}
export function createWorldBossFight(id:string,day:string,index:number,roster:Turtle[],now:number,placements?:Point[]):WorldBossFight{
 if(roster.length!==5||new Set(roster.map(t=>t.id)).size!==5)throw Error('请选择五只不同的自有伙伴');
 const map={...BATTLE_MAPS[WORLD_BOSS_MAP],slots:expeditionSlots(WORLD_BOSS_MAP)},positions=placements??map.slots.slice(0,5);
 if(positions.length!==5)throw Error('布阵资料无效');
 positions.forEach((p,i)=>{const issue=placementIssue(map,p,positions.filter((_,j)=>j!==i));if(issue)throw Error(issue);});
 const b=createBattle(54,1,roster.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1})),{rulesVersion:'0.6',mode:'endless',formationVersion:2});
 b.levelId=WORLD_BOSS_MAP;b.route=map.route.map(p=>({...p}));b.routeLength=pathLength(b.route);b.routes=undefined;b.routeLengths=undefined;b.spawns=[];b.spawnCursor=0;b.events=[];b.commands=[];b.faunaVersion=1;b.stationVersion=map.stationVersion;b.layoutVersion=2;b.autoSkills=true;
 b.units.forEach((u,i)=>{const slot=map.slots.findIndex(p=>Math.hypot(p.x-positions[i].x,p.z-positions[i].z)<.01);if(slot<0)throw Error('请使用世界BOSS的12个固定站位');Object.assign(u,positions[i],{slot,placement:{...positions[i]}});});
 const def=WORLD_BOSSES[index];if(!def)throw Error('世界首领不存在');
 const boss:BattleEnemy={id:'world-boss',kind:'boss',bossId:def.abilityId,worldBossIndex:index,x:map.route[0].x,z:map.route[0].z,distance:0,hp:1e9,maxHp:1e9,attack:def.attack,armor:def.armor,resist:def.resist,speed:0,range:3.4,interval:2.8,leak:0,alive:true,statuses:[],nextAttackTick:80,actionUntilTick:0,attackCount:0,controlWindowUntilTick:0,controlCount:0,summoned:true,abilityReadyTick:160};
 b.enemies=[boss];return {id,day,bossIndex:index,startedAt:now,endsAt:now+90000,roster:JSON.parse(JSON.stringify(roster)),battle:b,damage:0,phase:'combat'};
}
export function stepWorldBoss(f:WorldBossFight,seconds:number):void{
 if(f.phase!=='combat')return;if(!Number.isFinite(seconds)||seconds<0||seconds>90)throw Error('挑战时间无效');
 let remaining=Math.min(seconds,90-f.battle.elapsed-f.battle.pendingSeconds);
 while(remaining>1e-8&&f.phase==='combat'){
  const b=f.battle,boss=b.enemies[0],dt=Math.min(.05,remaining),last=b.nextEventId-1;
  // Heavy world bosses keep a readable, straight-through march. The progress
  // is tied to the deterministic 1,800 ticks so the boss reaches the exact
  // pearl endpoint at 90 seconds on every playback speed.
  const targetTick=Math.min(1800,b.tick+Math.floor((b.pendingSeconds+dt+1e-9)/.05));
  boss.distance=Math.min(b.routeLength,targetTick/1800*b.routeLength);Object.assign(boss,pathPoint(b.route,boss.distance));
  stepBattle(b,dt);for(const e of b.events)if(e.id>last&&e.type==='damage'&&e.targetId==='world-boss')f.damage+=Math.max(0,e.amount??0);
  boss.distance=Math.min(b.routeLength,b.tick/1800*b.routeLength);Object.assign(boss,pathPoint(b.route,boss.distance));
  remaining-=dt;if(b.tick>=1800||b.status!=='fighting'){f.phase='result';f.finishedAt=f.startedAt+b.elapsed*1000;b.status='won';}
 }
 f.damage=Math.round(f.damage*1000)/1000;
}
export function worldBossAction(f:WorldBossFight,action:string,body:{targetId?:string;point?:Point;unitId?:string;auto?:boolean;held?:string[];command?:BattleCommand}):void{
 if(f.phase!=='combat')throw Error('挑战已经结束');const b=f.battle;
 if(action==='operationPause'||action==='operationResume'){f.operationPaused=action==='operationPause';return;}
 if(action==='focus'){if(!focusBattle(b,body.targetId))throw Error('集火目标已失效');return;}
 if(action==='settings'){b.autoSkills=!!body.auto;b.manualSkillTurtles=body.held?.filter(id=>b.units.some(u=>u.turtleId===id))??[];return;}
 if(action==='cast'){if(!body.command||!commandBattle(b,body.command))throw Error('技能尚未就绪或目标不在范围内');return;}
 if(action==='move'){const u=b.units.find(u=>u.id===body.unitId);if(!u||!body.point)throw Error('伙伴或落点不存在');let p=body.point;if(b.formationVersion===2){const slots=expeditionSlots(WORLD_BOSS_MAP),slot=slots.map((q,i)=>({i,d:Math.hypot(q.x-p.x,q.z-p.z)})).sort((a,b)=>a.d-b.d)[0];if(slot.d>1)throw Error('请放到固定站位点');const other=b.units.find(v=>v!==u&&v.slot===slot.i);moveBattleUnit(b,u.id,slot.i);return;}const other=b.units.find(v=>v!==u&&Math.hypot((v.placement??v).x-p.x,(v.placement??v).z-p.z)<.78);moveBattleUnit(b,u.id,other?.slot??u.slot,other?undefined:p);return;}
 throw Error('不支持的挑战操作');
}
