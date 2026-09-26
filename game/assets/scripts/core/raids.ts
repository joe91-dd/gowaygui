import {initialTalents,initialSkills} from './talents';
import {random} from './random';
import {sendSystemMail} from './mail';
import {SKILLS,ROLE_IDS} from './data';
import {newExpedition,expeditionSlots,chooseExpeditionBuff,openingStations} from './expeditionRules';
import {expeditionAction} from './battle';
import {SCENE_REVISION} from './sceneGeometry';
import {migrateSceneRaid} from './sceneMigration';
import {chapterFronts} from './tacticalMaps';
import {bookChestReward} from './bookPolicy';
import {placementIssue,normalizedPoint} from './placement';
import {grantChest,discoverBattle} from './progression';
import {goldAmount} from './economy';
import {applyReward} from './rewardPacks';
import {grantExperience,levelInfo} from './development';
import type {GameSave,RewardGrant} from './types';
import type {PetChoice,RaidSession,RaidMember} from './communityTypes';
import {createBattle,replaceBattleUnit,benchBattleUnit,moveBattleUnit,stepBattle} from './battle';
import {BATTLE_MAPS} from './data';
import {assignFronts} from './multiFront';
import type {BattleState} from './battle';
import {validateBattle} from './battleValidation';
import {communityOf,initCommunity,ensureCommunityHome,choosePets,reserveLoans,finishLoans,LOCAL_PLAYER} from './community';
import {copy,requireRule} from './save';
import {prototypeSpawns,drawBook} from './prototypeConfig';

export const raidMapId=(tier:number)=>tier===3?55:51+tier;
export const RAIDS=[
  {name:'碎礁洞穴',waves:10,baseWave:16,gold:300,food:3,books:1,description:'双口分路，从第一波开始双路夹击；互相补位守住潮汐灯塔'},
  {name:'深潮遗迹',waves:15,baseWave:20,gold:600,food:5,books:2,description:'双庭回廊，敌人沿两侧绕行；治疗与控制照顾中央交汇区域'},
  {name:'巨钳王庭',waves:20,baseWave:21,gold:1000,food:8,books:3,description:'双路围攻，快慢敌群轮流压境；分路拦截并轮换支援'},
  {name:'双环潮狱',waves:20,baseWave:22,gold:1200,food:9,books:3,description:'双人各守一岸；连续20波首领与祝福考验协作'},
] as const;
export const RAID_BALANCE=[{health:.9,boss:.62},{health:1.15,boss:.60},{health:1.3,boss:.58},{health:1.35,boss:.65}] as const;
export function startRaid(s:GameSave,now:number,tier:number,selection:string[]):RaidSession{
  initCommunity(s,now);ensureCommunityHome(s);requireRule(Number.isInteger(tier)&&!!RAIDS[tier],'副本不存在');
  const pets=choosePets(s,selection,now);requireRule(pets.length===5,'副本需备战五只伙伴');requireRule(pets.every(p=>!p.loanId),'借用和租赁的龟仅可用于关卡、无尽模式；副本只能使用自有龟');
  const c=communityOf(s),sessionId=`raid-${++s.idCounter}`;
  const members:RaidMember[]=[{ownerId:LOCAL_PLAYER,name:c.name,ai:false,roster:pets,activeId:pets[0].id}];
  const bots=Object.values(c.aiPlayers).slice(0,1),focus=['spike','crystal','leaf','bubble'];
  bots.forEach((ai,i)=>{
    const roster:PetChoice[]=Object.values(ai.pets).slice(0,5).map(t=>({id:`${ai.id}:${t.id}`,ownerId:ai.id,originalId:t.id,turtle:copy(t)}));
    // Local teammates stand in for prepared players; these copies never enter the market or collection.
    for(const p of roster){const t=p.turtle,extras=(['strong','armor','resist','rebirth','regen','lastShield'] as const).filter(id=>!t.skills.includes(id));t.skills=t.skills.concat(extras).slice(0,tier===0?10:12);t.innate={attack:95+Math.min(1,tier)*5,health:95+Math.min(1,tier)*5,defense:95+Math.min(1,tier)*5,growth:110};}
    requireRule(roster.length===5,'AI队友需要完整五只备战伙伴');
    const chosen=roster.find(t=>t.turtle.role===focus[i])??roster[0];members.push({ownerId:ai.id,name:ai.name,ai:true,roster,activeId:chosen.id});
  });
  // At party creation the body owner's preferred active turtle wins a source conflict.
  for(const m of members){const chosen=m.roster.find(t=>t.id===m.activeId)!;if(chosen.ownerId!==m.ownerId&&members.some(owner=>owner.ownerId===chosen.ownerId&&owner.roster.some(t=>t.id===owner.activeId&&t.originalId===chosen.originalId))){const substitute=m.roster.find(t=>t.ownerId===m.ownerId);requireRule(substitute,'主人正在使用借来的龟，请备一只自有替补');m.activeId=substitute.id;}}
  members.forEach((m,i)=>{m.station=i;m.moveReadyTick=0;});
  reserveLoans(s,pets,sessionId);
  const raid:RaidSession={expeditionVersion:1,mapVersion:6,sceneRevision:SCENE_REVISION,id:sessionId,tier,phase:'prep',wave:0,seconds:0,coreHealth:20,members,sleep:{},fallen:[],settled:false,startedAt:now};c.raid=raid;raid.battle=raidBattle(raid);return copy(raid);
}
export const raidPets=(r:RaidSession):PetChoice[]=>r.members.flatMap(m=>m.roster);
/** An occupied landing swaps both positions, preserving each member's identity and resources. */
export function swapRaidPositions(r:RaidSession,a:number,b:number):void{
 const one=r.members[a],two=r.members[b];requireRule(one&&two&&a!==b&&['prep','between','combat'].includes(r.phase),'当前不能交换位置');
 const slotA=one.station??a,slotB=two.station??b,pointA=one.placement,pointB=two.placement;
 if(r.phase==='combat'){const battle=r.battle!;requireRule(battle.tick>=(one.moveReadyTick??0)&&battle.tick>=(two.moveReadyTick??0),'双方调位冷却结束后才能互换');moveBattleUnit(battle,one.activeId,slotB);one.moveReadyTick=two.moveReadyTick=battle.tick+160;}
 one.station=slotB;two.station=slotA;one.placement=pointB;two.placement=pointA;if(!pointB)delete one.placement;if(!pointA)delete two.placement;
}
function choice(r:RaidSession,id:string):PetChoice{const p=raidPets(r).find(t=>t.id===id);requireRule(p,'找不到副本伙伴');return p;}
export function raidBattle(r:RaidSession):BattleState{
  migrateSceneRaid(r);
  if(r.expeditionVersion){if(r.battle?.expedition)return copy(r.battle);const id=raidMapId(r.tier),e=newExpedition('raid',id,r.members.map(m=>({id:m.ownerId,templates:m.roster.map(p=>p.turtle)})),RAIDS[r.tier].waves);const b=createBattle(id,1,[],{rulesVersion:'0.6',mode:'endless',formationVersion:2,expedition:e,seed:Array.from(r.id).reduce((v,c)=>Math.imul(v^c.charCodeAt(0),16777619)>>>0,2166136261)});b.encounter='raid';return b;}
  requireRule(r.phase==='prep'||r.phase==='between','请先完成本波');const row=RAIDS[r.tier];
  if(r.mapVersion!==6){r.mapVersion=6;r.members.forEach((m,i)=>{m.station=i;delete m.placement;});}
  const b=createBattle(raidMapId(r.tier),r.wave+1,r.members.map((m,i)=>({m,slot:m.station??i})).filter(x=>x.m.activeId).map(({m,slot})=>{const p=choice(r,m.activeId);return {id:p.id,turtle:p.turtle,slot,placement:m.placement,level:levelInfo(p.turtle).level,sleepUntilWave:r.sleep[p.id],fallen:r.fallen?.includes(p.id)};}),{rulesVersion:'0.6',mode:'endless',coreHealth:r.coreHealth});
  b.encounter='raid';b.spawns=prototypeSpawns(raidMapId(r.tier),row.baseWave+r.wave,true);
  const strength=RAID_BALANCE[r.tier].health;for(const spawn of b.spawns){spawn.hpScale*=strength;spawn.attackScale*=Math.sqrt(strength);}
  if(r.wave===row.waves-1&&!b.spawns.some(x=>x.kind==='boss'))b.spawns.push({kind:'boss',time:22,hpScale:Math.pow(1.07,row.baseWave-1)*strength,attackScale:Math.sqrt(Math.pow(1.07,row.baseWave-1)*strength)});
  for(const spawn of b.spawns)if(spawn.kind==='boss')spawn.hpScale*=RAID_BALANCE[r.tier].boss;
  b.spawns=chapterFronts(b.spawns,BATTLE_MAPS[raidMapId(r.tier)],r.wave+1);
  if(r.tier===3){b.spawns=Array.from({length:240},(_,i)=>({kind:(i%60===59?'boss':['ink','runner','armored','mist','snail','elite'][i%6]) as import('./types').EnemyKind,time:i*(.58/.82),hpScale:(.63+Math.floor(i/50)*.1925)*(i%60===59?.5:1),attackScale:.26+Math.floor(i/50)*.028}));}
  if(r.tier===3)b.spawns=chapterFronts(b.spawns,BATTLE_MAPS[55],r.wave+1);
  return b;
}
export function beginRaidWave(s:GameSave):BattleState{const r=communityOf(s).raid;requireRule(r&&!r.settled,'没有副本挑战');const b=raidBattle(r);r.members.forEach(m=>m.moveReadyTick=0);b.autoSkills=s.settings.autoSkills??false;b.controlledUnitIds=r.expeditionVersion?b.units.filter(u=>u.ownerId===r.members[0].ownerId).map(u=>u.id):r.members[0].roster.map(p=>p.id);r.battle=copy(b);r.phase='combat';return b;}
/** Member ownership stays fixed when a turtle moves; no teammate can be displaced. */
export function moveRaidStation(r:RaidSession,memberIndex:number,station:number,point?:import('./types').Point):void{
  const m=r.members[memberIndex],map=BATTLE_MAPS[raidMapId(r.tier)];
  requireRule(m&&['prep','between','combat'].includes(r.phase),'当前不能调整站位');
  requireRule(Number.isInteger(station)&&station>=0&&!!map.slots[station],'站位不存在');
  const occupied=r.members.findIndex((other,i)=>i!==memberIndex&&(point?Math.hypot((other.placement??map.slots[other.station??i]).x-point.x,(other.placement??map.slots[other.station??i]).z-point.z)<.78:(other.station??i)===station));if(occupied>=0){swapRaidPositions(r,memberIndex,occupied);return;}
  if(point){const issue=placementIssue(map,point,r.members.filter((_,i)=>i!==memberIndex).map(o=>o.placement??map.slots[o.station??r.members.indexOf(o)]));requireRule(!issue,issue??'这里不能摆放');}
  if((m.station??memberIndex)===station&&!point)return;
  if(r.phase==='combat'){
    const b=r.battle!,u=b.units.find(u=>u.id===m.activeId);
    requireRule(b.status==='fighting'&&u?.alive,'先换上一只可战斗的龟');
    requireRule(b.tick>=(m.moveReadyTick??0),'移动冷却中，每 8 秒可调整一次');
    moveBattleUnit(b,m.activeId,station,point);u.actionUntilTick=Math.max(u.actionUntilTick,b.tick+12);m.moveReadyTick=b.tick+160;
  }
  m.station=station;m.placement=point?normalizedPoint(point):undefined;if(m.placement===undefined)delete m.placement;
}
/** Party-wide source identity is checked before any position changes. Owner priority can force a borrowed copy back to reserve. */
export function swapRaidPet(r:RaidSession,memberIndex:number,id:string):void{
  requireRule(['prep','between','combat'].includes(r.phase),'本次副本已结束');const member=r.members[memberIndex],pet=member?.roster.find(p=>p.id===id);requireRule(member&&pet,'这位伙伴不在该成员的备战栏');
  requireRule((r.sleep[id]??0)<=r.wave+1,'伙伴仍在沉睡');
  requireRule(!r.fallen?.includes(id)||r.sleep[id]!==undefined&&r.sleep[id]<=r.wave+1,'伙伴已倒下，本次副本无法再上场');
  const conflict=r.members.findIndex(m=>m!==member&&m.roster.some(p=>p.id===m.activeId&&p.ownerId===pet.ownerId&&p.originalId===pet.originalId));
  if(conflict>=0){
    requireRule(pet.ownerId===member.ownerId,'同一本体已上场，优先主人使用');
    const other=r.members[conflict],substitute=other.roster.find(p=>p.ownerId===other.ownerId&&p.originalId!==pet.originalId&&(r.sleep[p.id]??0)<=r.wave+1&&(!r.fallen?.includes(p.id)||r.sleep[p.id]!==undefined&&r.sleep[p.id]<=r.wave+1)&&p.id!==other.activeId&&(!r.battle?.benchUnits?.find(u=>u.id===p.id)||r.battle!.benchUnits!.find(u=>u.id===p.id)!.alive));
    if(substitute)swapRaidPet(r,conflict,substitute.id);else{if(r.battle&&r.phase==='combat')benchBattleUnit(r.battle,other.activeId);other.activeId='';}
  }
  if(member.activeId===id)return;
  if(r.phase==='combat'){
    requireRule(r.battle?.status==='fighting','本波已结束');
    const cached=r.battle.benchUnits?.find(u=>u.id===id);requireRule(!cached||cached.alive,'伙伴本波已倒下');
    replaceBattleUnit(r.battle,{id:pet.id,turtle:pet.turtle,slot:member.station??memberIndex,placement:member.placement,level:10,sleepUntilWave:r.sleep[id],fallen:r.fallen?.includes(id)});
  }
  member.activeId=id;
}
export function stepRaid(r:RaidSession,dt:number):void{
  migrateSceneRaid(r);
  if(r.expeditionVersion&&r.battle){for(const m of r.members.filter(m=>m.ai)){const p=r.battle.expedition!.players.find(p=>p.id===m.ownerId)!;if(p.choices.length)chooseExpeditionBuff(r.battle,m.ownerId,p.choices[0]);if(r.battle.tick%100===0&&!r.battle.expedition!.players.some(p=>p.choices.length)){try{const units=r.battle.units.filter(u=>u.ownerId===m.ownerId&&u.alive),a=units.find(u=>units.length>=8&&(u.fusionRank??1)<3&&units.some(v=>v!==u&&v.role===u.role&&v.fusionRank===u.fusionRank));if(a){const b=units.find(u=>u!==a&&u.role===a.role&&u.fusionRank===a.fusionRank)!;expeditionAction(r.battle,m.ownerId,'merge',{a:a.id,b:b.id});}else expeditionAction(r.battle,m.ownerId,'recruit');}catch{}}}stepBattle(r.battle,dt);r.wave=r.battle.expedition!.completed;return;}
  requireRule(Number.isFinite(dt)&&dt>=0&&dt<=3600,'副本推进时间无效');requireRule(r.phase==='combat'&&r.battle,'副本尚未开始');
  const b=r.battle,total=Math.round((b.pendingSeconds+dt)*1e12)/1e12,ticks=Math.floor((total+1e-9)/.05);b.pendingSeconds=0;
  for(let i=0;i<ticks&&b.status==='fighting';i++)raidTick(r);
  b.pendingSeconds=b.status==='fighting'?Math.max(0,Math.round((total-ticks*.05)*1e12)/1e12):0;
}
function raidTick(r:RaidSession):void{
  requireRule(r.phase==='combat'&&r.battle,'副本尚未开始');const before=r.battle.tick;
  stepBattle(r.battle,.05);
  if(r.battle.status!=='fighting')return;
  if(Math.floor(before/20)!==Math.floor(r.battle.tick/20)){
    r.members.forEach((m,i)=>{if(!m.ai)return;const active=r.battle!.units.find(u=>u.id===m.activeId);if(active?.alive&&active.hp/active.maxHp>=.22)return;
      const replacement=m.roster.filter(p=>p.id!==m.activeId&&(r.sleep[p.id]??0)<=r.wave+1&&(!r.fallen?.includes(p.id)||r.sleep[p.id]!==undefined&&r.sleep[p.id]<=r.wave+1)).find(p=>{const cache=r.battle!.benchUnits?.find(u=>u.id===p.id);return !cache||cache.alive&&cache.hp/cache.maxHp>.4;});
      if(replacement)try{swapRaidPet(r,i,replacement.id);}catch{/* A source conflict keeps the current pet rather than duplicating it. */}
    });
    if(Math.floor(before/100)!==Math.floor(r.battle.tick/100)){
      const b=r.battle,map=BATTLE_MAPS[raidMapId(r.tier)];
      r.members.forEach((m,i)=>{const u=b.units.find(u=>u.id===m.activeId);if(!m.ai||!u?.alive||b.tick<Math.max(m.moveReadyTick??0,u.moveReadyTick??0))return;
        const occupied=new Set(r.members.filter(x=>x!==m).map(x=>x.station??r.members.indexOf(x)));
        const score=(slot:number)=>{const p=map.slots[slot];return u.role==='leaf'?b.units.filter(a=>a.alive&&a.id!==u.id&&Math.hypot(a.x-p.x,a.z-p.z)<=u.range).reduce((v,a)=>v+1+(1-a.hp/a.maxHp)*3,0):b.enemies.filter(e=>e.alive&&Math.hypot(e.x-p.x,e.z-p.z)<=u.range).reduce((v,e)=>v+(e.kind==='boss'?3:1),0);};
        const current=m.station??i,best=map.slots.map((_,slot)=>slot).filter(slot=>!occupied.has(slot)&&!placementIssue(map,map.slots[slot],r.members.filter(o=>o!==m).map((o)=>o.placement??map.slots[o.station??r.members.indexOf(o)]))).sort((a,b)=>score(b)-score(a)||a-b)[0];
        if(best!==undefined&&score(best)>score(current)+1)try{moveRaidStation(r,i,best);}catch{/* A spell or transfer keeps the AI in place. */}
      });
    }
  }
}
export function validateRaidCheckpoint(current:RaidSession,next:RaidSession):void{
  if(current.expeditionVersion){requireRule(next.expeditionVersion===1&&current.id===next.id&&current.tier===next.tier&&next.battle&&next.battle.tick>=(current.battle?.tick??0),'副本进度不一致');requireRule(JSON.stringify(current.members.map(m=>m.roster))===JSON.stringify(next.members.map(m=>m.roster)),'培养来源不能改变');validateBattle(next.battle);requireRule(next.battle.expedition?.kind==='raid'&&next.battle.coreHealth<=current.coreHealth,'副本数据不一致');return;}

  requireRule(current.id===next.id&&current.tier===next.tier&&current.wave===next.wave&&current.phase==='combat'&&next.phase==='combat'&&!!next.battle,'副本检查点不属于当前挑战');
  requireRule(JSON.stringify(current.members.map(m=>m.roster))===JSON.stringify(next.members.map(m=>m.roster)),'副本备战资料不一致');
  validateBattle(next.battle);requireRule(next.battle.encounter==='raid'&&next.battle.wave===next.wave+1&&next.battle.tick>=(current.battle?.tick??0)&&next.battle.coreHealth<=current.coreHealth,'副本战斗进度不一致');
  const activeKeys=new Set<string>();
  const stations=new Set<number>();
  next.members.forEach((m,i)=>{const station=m.station??i;requireRule(Number.isInteger(station)&&!!BATTLE_MAPS[raidMapId(next.tier)].slots[station]&&!stations.has(station),'副本站位重复或不存在');stations.add(station);requireRule(Number.isSafeInteger(m.moveReadyTick??0)&&(m.moveReadyTick??0)>=0&&(m.moveReadyTick??0)<=next.battle!.tick+160,'移动冷却无效');const p=m.roster.find(t=>t.id===m.activeId),u=next.battle!.units.find(t=>t.slot===station);if(!m.activeId){requireRule(!u,'已换下的站位仍有伙伴');return;}requireRule(p&&u?.id===p.id&&u.turtleId===p.turtle.id,'副本站位与队伍不一致');requireRule(JSON.stringify(m.placement)===JSON.stringify(u?.placement),'副本落点与伙伴不一致');const key=`${p.ownerId}:${p.originalId}`;requireRule(!activeKeys.has(key),'同一本体不能同时上场');activeKeys.add(key);});
}
function grant(s:GameSave,g:RewardGrant):void{applyReward(s,g);}
export function finishRaid(s:GameSave,next:RaidSession,abandon=false):RaidSession{
  const r=communityOf(s).raid;requireRule(r&&!r.settled,'副本已结算');
  if(r.phase==='combat'){validateRaidCheckpoint(r,next);Object.assign(r,copy(next));}
  if(!abandon){
    requireRule(r.battle&&r.battle.status!=='fighting','这一波尚未结束');r.seconds+=r.battle.elapsed;r.coreHealth=r.battle.coreHealth;
    for(const u of r.battle.units.concat(r.battle.benchUnits??[])){r.fallen=(r.fallen??[]).filter(id=>id!==u.id);if(!u.alive)r.fallen.push(u.id);if(u.sleepUntilWave!==undefined)r.sleep[u.id]=u.sleepUntilWave;else delete r.sleep[u.id];}
    discoverBattle(s,r.battle);if(r.tier===3&&!r.expeditionVersion)r.remaining=r.battle.enemies.filter(e=>e.alive).length;
    const won=r.battle.status==='won';if(r.expeditionVersion)r.wave=r.battle.expedition!.completed;else if(won)r.wave++;
    delete r.battle;
    if(won&&r.wave<RAIDS[r.tier].waves){r.phase='between';return copy(r);}
    r.victory=won;
  }else{r.victory=false;if(r.battle)r.seconds+=r.battle.elapsed;delete r.battle;}
  r.phase='result';r.settled=true;r.rewards=[];
  if(r.victory){const config=RAIDS[r.tier];r.rewards=[{kind:'gold',amount:goldAmount(s,config.gold)},...(['attack','health','defense','growth'] as const).map(material=>({kind:'material' as const,material,amount:config.food})),...Array.from({length:config.books},()=>({kind:'book' as const,skillId:drawBook(s,'ordinary'),amount:1}))];for(const g of r.rewards)grant(s,g);}
  if(!r.victory&&r.wave>0){const amount=Math.floor(RAIDS[r.tier].gold*.08*r.wave/RAIDS[r.tier].waves);if(amount>0){const reward:RewardGrant={kind:'gold',amount:goldAmount(s,amount)};r.rewards.push(reward);grant(s,reward);}}
  if(r.victory){r.stars=r.tier===3&&!r.expeditionVersion?((r.remaining??0)<=5?3:(r.remaining??0)<=10?2:1):r.coreHealth===20?3:r.coreHealth>=12?2:1;
   r.chestId=grantChest(s,'raid:'+r.id,'副本 '+r.stars+' 星宝箱',r.stars,[{kind:'gold',amount:goldAmount(s,RAIDS[r.tier].gold*r.stars/5)},{kind:'material',material:'growth',amount:r.stars},s.livingVersion?bookChestReward(s,r.stars===3):{kind:'book',skillId:drawBook(s,r.stars===3?'fine':'ordinary'),amount:1}]).id;}
  if(r.victory&&r.expeditionVersion){
   const common=SKILLS.filter(v=>!v.specialization&&!v.precious&&!v.active),rare=SKILLS.filter(v=>v.precious&&!v.specialization);for(let i=0;i<=r.tier;i++){const pool=random(s)<.05+.02*r.tier?rare:common,book=pool[Math.floor(random(s)*pool.length)],reward:RewardGrant={kind:'book',skillId:book.id,amount:1};r.rewards.push(reward);grant(s,reward);}
   r.petRewards=Array.from({length:1+Math.floor(r.tier/2)},()=>{const role=ROLE_IDS[Math.floor(random(s)*ROLE_IDS.length)],id='raid-loot-'+r.id+'-'+(++s.idCounter),skills=initialSkills(s,role,4+r.tier).filter(id=>!SKILLS.find(v=>v.id===id)!.specialization),active=SKILLS.find(v=>v.role===role&&v.active)!.id;return {id,role,name:'',skills:[...new Set([active,...skills])].slice(0,4+r.tier),innate:initialTalents(s,role),training:{attack:0,health:0,defense:0,growth:0},generation:0,bornAt:s.clockHighWater,parentIds:[],locked:false};});
   if(!r.id.startsWith('online:')){const mail=sendSystemMail(s,'raid-pets:'+r.id,RAIDS[r.tier].name+' · 伙伴奖励','获得 '+r.petRewards.length+' 只随机造型和技能的龟龟，领取后加入收藏。',[]);mail.pets=copy(r.petRewards);}
  }
  grantExperience(s,r.members[0].roster.map(p=>p.originalId),r.wave*(16+r.tier*8)+(r.victory?60:0));
  finishLoans(s,r.id);return copy(r);
}
