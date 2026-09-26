import type {Point,Spawn,Turtle,SkillId} from './types';
import type {BattleState,BattleUnit,BattleEnemy} from './battle';
import {sceneGroundIssue,scenePoint,sceneSlots,sceneRoutes} from './sceneGeometry';
import {random} from './random';
import {SCENE_GEOMETRY_DATA} from './sceneGeometryData';
export type BuffId='attack'|'defense'|'health'|'range'|'haste'|'drain'|'speed'|'regen'|'crit'|'guard'|'desperate'|'phoenix'|'waveGrowth'|'killAttack'|'killDefense'|'killHealth'|'treasury'|'tauntGuard'|'cleanseSurge';
export const BUFFS:Record<BuffId,{name:string;description:string;rare?:boolean;cap?:number}>={
 tauntGuard:{name:'迎潮壁垒',rare:true,description:'受龟龟嘲讽的怪物被击败时，为嘲讽者提供2%最大生命的护盾，持续4秒；叠层提高护盾，单次最多8%'},
 cleanseSurge:{name:'净潮回生',rare:true,description:'成功净化时，额外恢复目标8%最大生命；叠层每层 +4%，最多20%'},
 attack:{name:'破浪之力',description:'全队攻击 +8%'},defense:{name:'礁岩护甲',description:'全队双防 +10%'},health:{name:'潮汐体魄',description:'全队生命上限 +10%'},range:{name:'远眺海风',description:'攻击/治疗范围 +1 格，最多 +2 格',cap:2},haste:{name:'灵潮回响',description:'主动冷却恢复速度 +10%，最多 +30%',cap:3},drain:{name:'噬浪汲取',description:'造成伤害的 2% 转为生命，最多 20%'},speed:{name:'疾风浪涌',description:'攻击速度 +6%，最多 +60%'},regen:{name:'复苏海露',description:'每秒回复 0.4% 最大生命，最多 3%'},crit:{name:'锐芒星砂',description:'暴击率 +4%，总暴击率最多 60%'},guard:{name:'海幕守护',description:'受到伤害降低 4%，乘算叠加，最多 40%'},
 desperate:{name:'绝境潮生',rare:true,description:'每波首次低于30%生命，攻击/双防/生命上限/治疗提升25%，吸血 +5%，持续8秒；叠层每层再 +10% 与 +2%吸血'},phoenix:{name:'不灭珍珠',rare:true,description:'抵挡一次致死伤害并无敌3秒，冷却60秒；叠层每层多恢复10%生命'},waveGrowth:{name:'乘潮而长',rare:true,description:'此后每清一波，攻击/生命/双防 +2%（每层）'},killAttack:{name:'猎潮锋芒',rare:true,description:'此后全队每击败一怪，攻击 +0.15%（每层）'},killDefense:{name:'积礁成垒',rare:true,description:'此后全队每击败一怪，双防 +0.2%（每层）'},killHealth:{name:'百川归海',rare:true,description:'此后全队每击败一怪，生命上限 +0.2%（每层）'},treasury:{name:'聚宝潮心',rare:true,description:'每持有100干粮，全队攻击/双防/生命 +2%（每层），最多 +40%'}
};
export interface ExpeditionPlayer {id:string;templates:Turtle[];coins:number;earned:number;spent:number;recruited:number;buffs:Partial<Record<BuffId,number>>;growth:{attack:number;defense:number;health:number};choices:BuffId[];pending:number;slots:number[]}
export interface ExpeditionState {version:1|2;coastTrial?:1;heldRoles?:string[];kind:'chapter'|'endless'|'raid';limit:number;completed:number;cost:number;cap:number;serial:number;bossAwards:number[];players:ExpeditionPlayer[];nextWaveTick?:number}
export const isCoastTrial=(s:BattleState)=>s.expedition?.coastTrial===1&&s.levelId<5;
export const combatScale=(s:BattleState)=>isCoastTrial(s)?10:1;
export const trialWaveCounts=[6,10,16,24,32,40,48,56,64,72];
/** Route zero opens alone; every later entrance is introduced before simultaneous pressure. */
export function trialFronts(s:BattleState,spawns:Spawn[]):Spawn[]{
 if(!isCoastTrial(s)||!s.routes)return spawns;
 const lanes=s.routes.length,w=s.wave;
 return spawns.map((spawn,i)=>({...spawn,routeId:w<=2?0:w===3?Math.min(1,lanes-1):w===4?(i<Math.ceil((spawns.length-1)/2)?0:Math.min(1,lanes-1)):Math.floor(i/3)%lanes}));
}
export function trialHint(s:BattleState):string{
 if(s.wave<=2)return '单路小队 · 先征召补齐火力，再考虑合成';
 if(s.wave===3&&s.routes&&s.routes.length>1)return '另一入口来袭 · 长按换位覆盖新路线';
 return s.levelId>=3?'红圈先躲，紫网可净化/打断 · 保留救场技能':s.levelId>=2?'红圈锁定后换位 · 开盾肉盾可承受重击':s.levelId>=1?'重甲精英来袭 · 同阶合成提高火力':'怪群逐步增多 · 拐角群攻，干粮够了就征召';
}
export const chapterWaves=(id:number)=>id<10?10:id<30?15:20;
export const regularCount=(wave:number)=>Math.min(38,16+wave*2);
export const legacyRecruitCost=(waves:number)=>Math.max(20,Math.floor(Array.from({length:waves},(_,i)=>regularCount(i+1)*2+20).reduce((a,b)=>a+b,0)/20));
export const recruitCost=(waves:number)=>Math.ceil(legacyRecruitCost(waves)/10)*10;
const cache=new Map<number,Point[]>();
/** Fixed, legal, spacious stations; old saves keep their previous station geometry. */
export function expeditionSlots(id:number):Point[]{
 const prior=cache.get(id);if(prior)return prior;
 const count=id===50?30:id>=51&&id!==54&&id!==56?24:12,half=count/2,points:Point[]=[];
 const courtyard=id===51?[...SCENE_GEOMETRY_DATA[id].routes[0],...[...SCENE_GEOMETRY_DATA[id].routes[1]].reverse()]:undefined;
 const interior=(x:number,y:number)=>{if(!courtyard)return true;let inside=false;for(let i=0,j=courtyard.length-1;i<courtyard.length;j=i++){const a=courtyard[i],b=courtyard[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 for(let y=72;y<=230;y+=3)for(let x=62;x<=505;x+=3){if(id===51&&(x<100||y>198)||!interior(x,y))continue;const p=scenePoint(id,x,y);if(!sceneGroundIssue(id,p))points.push(p);}
 let result:Point[]=[];
 const sorted=[...points].sort((a,b)=>a.z-b.z),mid=(sorted[Math.floor(sorted.length/2)]?.z??0);
 for(let seed=0;seed<12;seed++){
  const chosen:Point[]=[];let complete=true;
  for(const side of [-1,1]){
   const candidates=points.filter(p=>side<0?p.z<mid-.2:p.z>=mid+.2);
   candidates.sort((a,b)=>seed<2?(a.x-b.x)*(seed?1:-1):seed<4?(a.z-b.z)*(seed===2?1:-1):((Math.sin(a.x*13+a.z*7+seed*93)*10000)%1)-((Math.sin(b.x*13+b.z*7+seed*93)*10000)%1));
   const sidePoints:Point[]=[];for(const p of candidates)if(chosen.concat(sidePoints).every(q=>Math.hypot(q.x-p.x,q.z-p.z)>=1.005))sidePoints.push(p);
   // Spread the chosen fixed stations across the available shore.
   const picked:Point[]=[];while(picked.length<half&&sidePoints.length){sidePoints.sort((a,b)=>{const score=(p:Point)=>Math.min(4,...picked.map(q=>Math.hypot(q.x-p.x,q.z-p.z)));return score(b)-score(a);});picked.push(sidePoints.shift()!);}
   if(picked.length<half)complete=false;chosen.push(...picked);
  }
  if(chosen.length>result.length)result=chosen;if(complete){result=chosen;break;}
 }
 if(result.length<count&&id!==50)throw Error('地图 '+id+' 的合法站位不足 '+count+' 个');
 cache.set(id,result);return result;
}
export const buffCount=(s:BattleState,u:BattleUnit,id:BuffId)=>s.expedition?.players.find(p=>p.id===u.ownerId)?.buffs[id]??0;
export function newExpedition(kind:ExpeditionState['kind'],map:number,players:{id:string;templates:Turtle[]}[],limit=chapterWaves(map)):ExpeditionState{
 const n=expeditionSlots(map).length,cost=kind==='endless'?50:recruitCost(limit);
 return {version:2,...(kind==='chapter'&&map<5?{coastTrial:1 as const}:{}),kind,limit:kind==='endless'?0:limit,completed:0,cost,cap:kind==='endless'?0:20,serial:0,bossAwards:[],players:players.map((p,i)=>({...p,templates:JSON.parse(JSON.stringify(p.templates)),coins:cost*2,earned:0,spent:0,recruited:0,buffs:{},growth:{attack:0,defense:0,health:0},choices:[],pending:0,slots:Array.from({length:n/players.length},(_,j)=>i*n/players.length+j)}))};
}
export function expeditionSpawns(s:BattleState):Spawn[]{
 const e=s.expedition!,w=s.wave,level=e.kind==='chapter'?s.levelId:e.kind==='raid'?(s.levelId===55?3:s.levelId-51)*8:0;
 if(isCoastTrial(s)){
  const n=trialWaveCounts[Math.min(9,w-1)],duration=16+w*2,scale=.48*(1+level*.09)*Math.pow(1.15,w-1);
  const spawns:Spawn[]=Array.from({length:n},(_,i)=>{
   const elite=level>=1&&w>=3&&i===Math.floor(n*.66),controller=level>=3&&w>=4&&i===Math.floor(n*.4);
   const kind=elite?'elite':controller?'mist':w>=4&&i%9===7?'armored':i%5===4?'runner':'ink';
   return {bounty:true,kind,time:s.elapsed+2+i*duration/n,hpScale:scale*(elite?1.1:controller?1.6:1),attackScale:(w<=2?.4:.75+level*.12)*Math.sqrt(scale)};
  });
  spawns.push({bounty:true,kind:'boss',time:s.elapsed+duration+5,hpScale:scale*(w<=2?.16:.27+.025*w),attackScale:(w<=2?.55:1.4+level*.16)*Math.sqrt(scale)});
  return spawns;
 }
 const scale=(.55+level*.055)*Math.pow(1.095,Math.min(w-1,60))*(w>61?1+(w-61)*.12:1),n=regularCount(w),duration=18+Math.min(10,w*.5);
 const kinds=['ink','runner','armored','mist','snail'] as const;
 return [...Array.from({length:n},(_,i)=>({bounty:true,kind:kinds[(i+w)%Math.min(5,2+Math.floor((w+level)/4))],time:s.elapsed+1+i*duration/n,hpScale:scale,attackScale:Math.sqrt(scale)*.6})),{bounty:true,kind:'boss' as const,time:s.elapsed+duration+1,hpScale:scale*.27,attackScale:Math.sqrt(scale)*.65}];
}
function offer(s:BattleState,p:ExpeditionPlayer):void{
 if(p.choices.length||!p.pending)return;
 const pool=(Object.keys(BUFFS) as BuffId[]).filter(id=>(isCoastTrial(s)||!['tauntGuard','cleanseSurge'].includes(id))&&(!BUFFS[id].cap||(p.buffs[id]??0)<BUFFS[id].cap!));
 for(let n=0;n<3;n++){const total=pool.reduce((v,id)=>v+(BUFFS[id].rare?2:12),0);let roll=random(s)*total,index=0;for(;index<pool.length-1;index++){roll-=BUFFS[pool[index]].rare?2:12;if(roll<0)break;}p.choices.push(pool.splice(index,1)[0]);}
}
export function chooseExpeditionBuff(s:BattleState,owner:string,id:BuffId):void{
 const e=s.expedition,p=e?.players.find(v=>v.id===owner);if(!p||!p.choices.includes(id))throw Error('祝福选项已更新');p.buffs[id]=(p.buffs[id]??0)+1;p.choices=[];p.pending--;offer(s,p);applyExpeditionStats(s);
}
export function expeditionKill(s:BattleState,target:BattleEnemy):void{
 const e=s.expedition;if(!e||target.mechanismOwner||!target.expeditionBounty)return;
 for(const p of e.players){const gold=target.kind==='boss'?20:isCoastTrial(s)&&s.wave<=2?8:2;p.coins+=gold;p.earned+=gold;
  p.growth.attack+=.0015*(p.buffs.killAttack??0);p.growth.defense+=.002*(p.buffs.killDefense??0);p.growth.health+=.002*(p.buffs.killHealth??0);
 }
 if(target.kind==='boss'&&!e.bossAwards.includes(s.wave)){e.bossAwards.push(s.wave);for(const p of e.players){p.pending++;offer(s,p);}}
}
export function expeditionWaveCleared(s:BattleState):void{
 const e=s.expedition!;if(e.completed>=s.wave)return;e.completed=s.wave;
 for(const p of e.players)for(const key of ['attack','health','defense'] as const)p.growth[key]+=.02*(p.buffs.waveGrowth??0);
 e.nextWaveTick=s.tick+30;applyExpeditionStats(s);
}
export const expeditionPaused=(s:BattleState)=>!!s.expedition?.players.some(p=>p.choices.length);
export function applyExpeditionStats(s:BattleState):void{
 if(!s.expedition)return;
 for(const u of s.units){const p=s.expedition.players.find(p=>p.id===u.ownerId);if(!p)continue;
  u.expeditionBase??={attack:u.attack,health:u.maxHp,armor:u.armor,resist:u.resist,range:u.range,interval:u.interval};const base=u.expeditionBase,b=p.buffs,rank=u.fusionRank===3?(isCoastTrial(s)?5.5:3.5):u.fusionRank===2?(isCoastTrial(s)?2.4:1.85):1;
  const low=(u.desperateUntil??0)>s.tick?(.25+.10*((b.desperate??1)-1)):0,treasury=Math.min(.4,Math.floor(p.coins/100)*.02*(b.treasury??0));
  const scale=(key:'attack'|'health'|'defense',per:number)=>rank*(1+(b[key]??0)*per+Math.min(3,p.growth[key])+treasury+low);
  const health=base.health*scale('health',.10),ratio=u.hp/u.maxHp;u.hp=Math.min(health,Math.max(0,ratio*health));u.maxHp=health;u.attack=base.attack*scale('attack',.08);u.armor=base.armor*scale('defense',.10);u.resist=base.resist*scale('defense',.10);u.range=base.range+Math.min(2,b.range??0);u.interval=base.interval/(1+Math.min(.6,(b.speed??0)*.06));
 }
}
export function tickExpeditionBuffs(s:BattleState):void{
 if(!s.expedition)return;
 for(const u of s.units){if(!u.alive)continue;const desperate=buffCount(s,u,'desperate');
  if(desperate&&u.hp/u.maxHp<.3&&u.desperateWave!==s.wave){u.desperateWave=s.wave;u.desperateUntil=s.tick+160;}
  if(s.tick%20===0){const regen=Math.min(.03,buffCount(s,u,'regen')*.004);u.hp=Math.min(u.maxHp,u.hp+u.maxHp*regen);}
 }
 if(s.tick%5===0)applyExpeditionStats(s);
}
export const ADVANCED_ACTIVE:Record<string,SkillId>={stone:'stoneMastery',spike:'spikeMastery',crystal:'crystalMastery',leaf:'leafMastery',bubble:'spirit'};

/** Spread the opening team along the actual lanes, with the healer supporting allies. */
export function openingStations(map:number,roles:string[],allowed=expeditionSlots(map).map((_,i)=>i)):number[]{
 const slots=expeditionSlots(map),samples=sceneRoutes(map).flatMap(r=>r.slice(1).flatMap((b,i)=>{const a=r[i],n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.35));return Array.from({length:n},(_,j)=>({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n}));})),coverage=samples.map(()=>0),result:number[]=[];
 const order=roles.map((role,i)=>({role,i})).sort((a,b)=>Number(a.role==='leaf')-Number(b.role==='leaf'));
 for(const {role,i}of order){const range=role==='stone'?2.2:role==='leaf'?3.5:3.2;
  const options=allowed.filter(slot=>!result.includes(slot));options.sort((a,b)=>{const score=(slot:number)=>role==='leaf'?result.filter(n=>n!==undefined).reduce((sum,n)=>sum+(Math.hypot(slots[n].x-slots[slot].x,slots[n].z-slots[slot].z)<range?1:0),0):samples.reduce((sum,p,k)=>sum+(Math.hypot(p.x-slots[slot].x,p.z-slots[slot].z)<range?(1+.3*k/samples.length)/(1+coverage[k]):0),0);return score(b)-score(a)||a-b;});
  const slot=options[0];result[i]=slot;if(role!=='leaf')samples.forEach((p,k)=>{if(Math.hypot(p.x-slots[slot].x,p.z-slots[slot].z)<range)coverage[k]++;});
 }return result;
}
