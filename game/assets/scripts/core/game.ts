import {syncExpeditionRun,settleExpeditionRun} from './expeditionRun';
import {expeditionAction} from './battle';
import type {BuffId} from './expeditionRules';
import type {AdKind, GameSave, Material, Role, RunMode, RunResult, RunState, RunTurtle, Settings, SkillId, Turtle} from './types';
import {recordTask,AccountParcel} from './taskPolicy';
import {accruePatrol,enablePatrol,claimPatrol,PatrolRewards} from './patrol';
import {BATTLE_MAPS, ECONOMY, LEVELS, ROLE_IDS, ROLES, SKILL_BY_ID,skillsForRole} from './data';
import {choose, random, sample} from './random';
import {FUSION_VERSION, generateFusion, previewFusion} from './fusion';
import {copy, requireRule, SaveRepository, validateSave,validateTurtle} from './save';
import {Clock, systemClock} from '../platform/storage';
import type {BattleState} from './battle';
import {moveBattleUnit} from './battle';
import {placementIssue,groundIssue,normalizedPoint} from './placement';
import {validateBattle} from './battleValidation';
import {applySkillBook} from './skillBooks';
import type {SkillBookReceipt} from './skillBooks';
import * as prototype from './prototype';
import {PROTOTYPE} from './prototypeConfig';
import {initialTalents,initialSkills} from './talents';
import {dispatchCommunity,assertAssetMovable,communityOf,refreshCommunity} from './community';
import type {CommunityAction,RaidSession,ArenaSession} from './communityTypes';
import {startArena,validateArenaCheckpoint,finishArena,matchArena} from './arena';
import {syncProgression,claimCodex,claimChest,claimArenaTier,discoverBattle,grantChest} from './progression';
import {startRaid,beginRaidWave,validateRaidCheckpoint,finishRaid,swapRaidPet,moveRaidStation} from './raids';
import {swapPetOrder} from './petOrder';
import {goldAmount,migrateEconomy} from './economy';
import {enableLiving} from './living';
import {levelInfo,initDevelopment,grantExperience,allocatePoints,resetPoints,trainingCost} from './development';
import {sendSystemMail,readMail,claimMail,deleteMail} from './mail';
import {openBookPack,applyReward,validReward} from './rewardPacks';
import {purchaseShop,purchaseShopPack,ShopPool,ShopReceipt,ShopPackId} from './shop';

const emptyTraining=()=>({attack:0,health:0,defense:0,growth:0});
const chinaDay=(now:number)=>new Date(now+8*3600000).toISOString().slice(0,10);
const nextId=(s:GameSave,prefix:string)=>`${prefix}-${++s.idCounter}`;
const live=prototype.currentUnits;
export function displayName(t:Turtle):string{return t.name||ROLES[t.role].name;}
export function makeInitialSave(now:number,seed:number):GameSave{
  const s:GameSave={schema:1,revision:0,idCounter:0,rng:seed>>>0,createdAt:now,clockHighWater:now,
    gold:300,stamina:30,staminaAt:now,materials:{attack:2,health:2,defense:2,growth:1},
    collection:{},history:{},capacity:ECONOMY.capacity,unlockedLevel:0,cleared:[],tutorialDone:false,tutorialStarted:false,
    settings:{music:.65,effects:.8,quality:'high',reducedMotion:false,autoSkills:true,manualSkillTurtles:[]},
    dailyAds:{day:chinaDay(now),total:0,counts:{stamina:0,doubleGold:0,refresh:0}},results:{},commands:{}};
  for(const role of ROLE_IDS){
    const id=nextId(s,'t');
    const active=skillsForRole(role).find(id=>SKILL_BY_ID[id].active)!;
    const passive=initialSkills(s,role,2).find(id=>!SKILL_BY_ID[id].active)??ROLES[role].starters[0];
    s.collection[id]={id,role,name:'',skills:[...new Set([active,passive,...ROLES[role].starters,'strong','armor','regen'] as SkillId[])].slice(0,4),innate:initialTalents(s,role),training:emptyTraining(),generation:0,bornAt:now,parentIds:[],locked:false};
  }
  validateSave(s);return s;
}
function updateTime(s:GameSave,wallNow:number):number{
  requireRule(Number.isFinite(wallNow)&&wallNow>=0,'设备时间不可用');
  const now=Math.max(s.clockHighWater,Math.floor(wallNow));s.clockHighWater=now;
  accruePatrol(s,now);
  const gain=Math.floor(Math.max(0,now-s.staminaAt)/ECONOMY.staminaIntervalMs);
  if(s.stamina>=ECONOMY.staminaCap)s.staminaAt=now;
  else if(gain>0){s.stamina=Math.min(ECONOMY.staminaCap,s.stamina+gain);s.staminaAt=s.stamina>=ECONOMY.staminaCap?now:s.staminaAt+gain*ECONOMY.staminaIntervalMs;}
  const day=chinaDay(now);
  if(day>s.dailyAds.day)s.dailyAds={day,total:0,counts:{stamina:0,doubleGold:0,refresh:0}};
  return now;
}
function freshTurtle(s:GameSave,now:number,role:Role=choose(s,ROLE_IDS)):Turtle{
  const skills=initialSkills(s,role,1+Math.floor(random(s)*3));
  return {id:nextId(s,'t'),role,name:'',skills,innate:initialTalents(s,role),training:emptyTraining(),generation:0,bornAt:now,parentIds:[],locked:false};
}
function rescueBoss(s:GameSave,r:RunState,battle:BattleState,now:number):boolean{
  if(r.bossRescuedWaves===undefined||r.mode!=='chapter'||r.bossRescuedWaves.includes(battle.wave)||!battle.enemies.some(e=>e.kind==='boss'&&!e.alive&&e.hp<=0))return false;
  r.bossRescuedWaves.push(battle.wave);
  prototype.refreshBench(s,r,now,(save,at)=>{
    const t=freshTurtle(save,at),roll=random(save),last=battle.wave===5;
    const count=last?(roll<.2?3:roll<.7?4:5):(roll<.25?2:roll<.75?3:4);
    t.skills=initialSkills(save,t.role,count);
    for(const key of ['attack','health','defense'] as const)t.innate[key]=t.innate[key]===100?100:Math.min(99,t.innate[key]+(last?10:5));
    t.innate.growth=Math.min(110,t.innate.growth+(last?3:1));return t;
  });return true;
}
function migratePreparedMaps(s:GameSave):void{
 const r=s.run;
 if(r?.rulesVersion==='0.6'&&['prep','between'].includes(r.phase)&&!r.battle&&r.mapVersion!==6){r.mapVersion=6;let slot=0;for(const u of Object.values(r.units)){delete u.placement;if(!u.consumedBy&&!u.removed&&u.slot!==null)u.slot=slot++;u.level=levelInfo(u.turtle).level;}}
 const raid=s.community?.raid;if(raid&&['prep','between'].includes(raid.phase)&&raid.mapVersion!==6){raid.mapVersion=6;raid.members.forEach((m,i)=>{m.station=i;delete m.placement;});}
}
function runOf(s:GameSave,phases?:RunState['phase'][]):RunState{
  requireRule(s.run,'当前没有进行中的关卡');
  if(phases)requireRule(phases.includes(s.run.phase),'请先完成当前操作');
  return s.run;
}
function unitOf(r:RunState,id:string):RunTurtle{const u=r.units[id];requireRule(u&&!u.consumedBy&&!u.removed,'这只龟已经消耗或退出本局');return u;}
function ensureHome(s:GameSave):void{requireRule(!s.shop?.pending,'请先查看商城结果');prototype.checkOutsideReady(s);}
function availableSlot(r:RunState):number|null{const occupied=new Set(live(r).map(u=>u.slot));for(let n=0;n<5;n++)if(!occupied.has(n))return n;return null;}
function enterPermanent(s:GameSave,r:RunState,id:string):RunTurtle{
  const saved=s.collection[id];
  requireRule(saved&&r.selectedSources.includes(id),'这只龟不在本次出战名单');
  requireRule(!r.usedSources.includes(id),'同一永久来源每局只能进入一次');
  const u:RunTurtle={id:nextId(s,'u'),turtle:copy(saved),sources:[id],savedId:id,slot:availableSlot(r),level:levelInfo(saved).level};
  r.units[u.id]=u;r.usedSources.push(id);return u;
}
function updateLocalLevel(_s:GameSave,u:RunTurtle,_legacy=false):void{
  u.level=levelInfo(u.turtle).level;
}
function checkBattle(r:RunState,runId:string,battle:BattleState):void{
  validateBattle(battle);
  requireRule(r.id===runId&&battle.levelId===r.levelId&&(r.expedition?!!battle.expedition&&battle.expedition.kind===r.expedition.kind:battle.wave===r.wave+1),'这条战斗回调不属于当前局次或波次');
  requireRule(r.rulesVersion===battle.rulesVersion&&(r.rulesVersion!=='0.6'||r.mode===battle.mode),'战斗规则版本与对局不一致');
  requireRule(battle.coreHealth<=r.coreHealth,'战斗不能额外增加核心耐久');
  if(r.battle)requireRule(battle.tick>=r.battle.tick,'不能用较早的战斗进度覆盖当前检查点');
  if(r.expedition)requireRule(JSON.stringify(battle.expedition!.players.map(p=>({id:p.id,templates:p.templates,slots:p.slots})))===JSON.stringify(r.expedition.players.map(p=>({id:p.id,templates:p.templates,slots:p.slots}))),'局外培养来源和站位归属不能改变');
  const expected=live(r).filter(u=>u.slot!==null).map(u=>u.id).sort();
  requireRule(JSON.stringify(battle.units.map(u=>u.id).sort())===JSON.stringify(expected),'战斗伙伴与布阵不一致');
  for(const unit of battle.units){
    const source=r.units[unit.id];
    requireRule(JSON.stringify(source?.placement)===JSON.stringify(unit.placement),'战斗自由落点与布阵不一致');
    requireRule(source&&!source.consumedBy&&source.slot===unit.slot&&source.turtle.id===unit.turtleId,'战斗伙伴与站位或档案不一致');
  }
}

/** All permanent mutations go through a persisted, idempotent transaction. */
export class GameService {
  private state:GameSave;
  constructor(private readonly repository:SaveRepository,private readonly clock:Clock=systemClock,seed=Date.now()){
    this.state=repository.open(()=>makeInitialSave(Math.floor(clock.now()),seed));
  }
  get snapshot():GameSave{return copy(this.state);}
  enablePatrol(commandId:string):void{if(!this.state.patrol)this.transact(commandId,'enablePatrol',(save,now)=>enablePatrol(save,now));}
  claimPatrol(commandId:string):PatrolRewards{return this.transact(commandId,'claimPatrol',save=>claimPatrol(save));}
  enableIncrement(commandId:string):void{if(!this.state.economyVersion)this.transact(commandId,'economyV2',s=>migrateEconomy(s));}
  enableLiving(commandId:string):void{if(!this.state.livingVersion)this.transact(commandId,'livingV1',s=>enableLiving(s));}
  allocatePetPoints(commandId:string,id:string,points:Record<import('./types').Aptitude,number>):void{this.transact(commandId,'allocate',s=>{ensureHome(s);allocatePoints(s,id,points);});}
  resetPetPoints(commandId:string,id:string):void{this.transact(commandId,'resetPoints',s=>{ensureHome(s);resetPoints(s,id);});}
  readMail(commandId:string,id:string):void{this.transact(commandId,'readMail',s=>readMail(s,id));}
  claimMail(commandId:string,id:string):void{this.transact(commandId,'claimMail',s=>claimMail(s,id));}
  deleteMail(commandId:string,id:string):void{this.transact(commandId,'deleteMail',s=>deleteMail(s,id));}
  openBookPack(commandId:string,grade:import('./types').BookPackGrade):SkillId{return this.transact(commandId,'openPack',s=>openBookPack(s,grade));}
  receiveRoomMail(commandId:string,mail:Omit<import('./roomTypes').RoomMail,'clientId'>):void{this.transact(commandId,'roomMail',s=>{
    requireRule(mail.id.length<180&&Number.isSafeInteger(mail.xp)&&mail.xp>=0&&mail.xp<100000,'房间结算资料无效');
    if(s.mailbox?.items.some(m=>m.id===mail.id))return;
    const received=sendSystemMail(s,mail.id,mail.title,mail.body,mail.grants,mail.at,mail.id.startsWith('system:')?'system':'room');if(mail.pets){requireRule(Array.isArray(mail.pets)&&mail.pets.length<=5,'伙伴奖励无效');mail.pets.forEach(validateTurtle);received.pets=copy(mail.pets);}grantExperience(s,mail.petIds,mail.xp);
    if(mail.chest){grantChest(s,'raid:'+mail.id,mail.chest.title,mail.chest.stars,mail.chest.grants,mail.at);if(s.livingVersion)recordTask(s,'roomChallenge',commandId,mail.at);}
  });}
  purchaseShop(commandId:string,pool:ShopPool,count:1|10):ShopReceipt{return this.transact(commandId,'shop:'+pool+':'+count,(s,now)=>purchaseShop(s,now,commandId,pool,count,freshTurtle));}
  purchaseShopPack(commandId:string,pack:ShopPackId):ShopReceipt{return this.transact(commandId,'shopPack:'+pack,(s,now)=>purchaseShopPack(s,now,commandId,pack,freshTurtle));}
  finishShopReveal(commandId:string):void{this.transact(commandId,'shopReveal',s=>{requireRule(s.shop?.pending,'没有待领取的商城结果');delete s.shop!.pending;});}
  private transact<T>(commandId:string,kind:string,action:(s:GameSave,now:number)=>T):T{
    requireRule(/^[a-zA-Z0-9:_-]{1,160}$/.test(commandId)&&!['__proto__','constructor','prototype'].includes(commandId),'操作编号不合法');
    const previous=Object.prototype.hasOwnProperty.call(this.state.commands,commandId)?this.state.commands[commandId]:undefined;
    if(previous){requireRule(previous.kind===kind,'操作编号已用于其他动作');return copy(previous.result) as T;}
    const next=copy(this.state),now=updateTime(next,this.clock.now());
    syncProgression(next,now);
    migratePreparedMaps(next);
    const result=action(next,now);
    migratePreparedMaps(next);

    if(next.livingVersion)recordTask(next,kind,commandId,now);
    if(next.livingVersion)for(const t of Object.values(next.collection))initDevelopment(t);
    syncProgression(next,now);
    // Clock/checkpoint writes have monotonic state checks and no reward. They need no permanent receipt.
    if(kind!=='clock'&&kind!=='checkpoint')next.commands[commandId]={kind,result:result===undefined?null:copy(result)};
    if(next.community)refreshCommunity(next,now);
    next.revision++;this.repository.commit(next);this.state=next;
    return result===undefined?result:copy(result);
  }
  receiveAccountParcel(parcel:AccountParcel):void{this.transact(parcel.id,'accountReward',s=>{
    requireRule(parcel.id.startsWith('account:')&&Array.isArray(parcel.pets)&&parcel.pets.length<=4&&Array.isArray(parcel.grants)&&parcel.grants.length<=8&&parcel.grants.every(validReward),'账号奖励资料无效');
    parcel.pets.forEach(validateTurtle);const fresh=parcel.pets.filter(t=>!s.collection[t.id]);requireRule(Object.keys(s.collection).length+fresh.length<=s.capacity,'龟龟背包空间不足，奖励仍保存在任务待领取中，请整理后再领');
    for(const t of fresh)s.collection[t.id]=copy(t);for(const grant of parcel.grants)applyReward(s,grant);
    const mail=sendSystemMail(s,parcel.id,parcel.title,parcel.body+(fresh.length?' 已获得 '+fresh.length+' 只伙伴，请到龟龟背包查看。':''),[]);mail.claimed=true;
  });}
  receiveAdReward(receipt:string,kind:AdKind|'supplies',context?:string):void{
    requireRule(/^[a-f0-9]{48}$/.test(receipt),'广告奖励凭证无效');
    if(kind==='supplies')this.transact('verifiedAd:'+receipt,'adSupplies',s=>{s.gold+=1200;s.materials.growth++;});
    else this.simulateAd('verifiedAd:'+receipt,kind,context);
  }
  communityAction(commandId:string,action:CommunityAction):unknown{return this.transact(commandId,'community:'+action.kind,(s,now)=>dispatchCommunity(s,now,action));}
  beginRaid(commandId:string,tier:number,ids:string[],replacePending=false):RaidSession{return this.transact(commandId,'beginRaid',(s,now)=>{if(replacePending)this.endPendingBattles(s,now);return startRaid(s,now,tier,ids);});}
  beginArena(commandId:string,opponentId:string,ids:string[],replacePending=false):ArenaSession{return this.transact(commandId,'beginArena',(s,now)=>{if(replacePending)this.endPendingBattles(s,now);return startArena(s,now,opponentId,ids);});}
  beginArenaPractice(commandId:string,opponentId:string,replacePending=false):ArenaSession{return this.transact(commandId,'arenaPractice',(s,now)=>{if(replacePending)this.endPendingBattles(s,now);return startArena(s,now,opponentId,communityOf(s).arenaDefense,true);});}
  checkpointArena(commandId:string,next:ArenaSession):void{this.transact(commandId,'checkpoint',s=>{const a=communityOf(s).arena;requireRule(a,'没有竞技场');validateArenaCheckpoint(a,next);s.community!.arena=copy(next);});}
  finishArena(commandId:string,next:ArenaSession,abandon=false):ArenaSession{return this.transact(commandId,'finishArena',s=>finishArena(s,next,abandon));}
  selectRaidPet(commandId:string,id:string):void{this.transact(commandId,'raidSwap',s=>{const r=communityOf(s).raid;requireRule(r&&r.phase!=='combat','当前请在战斗中轮换');swapRaidPet(r,0,id);});}
  selectRaidStation(commandId:string,station:number,point?:import('./types').Point):void{this.transact(commandId,'raidStation',s=>{const r=communityOf(s).raid;requireRule(r&&r.phase!=='combat','当前请在战斗中调整站位');moveRaidStation(r,0,station,point);});}
  raidExpeditionCommand(commandId:string,action:'recruit'|'merge'|'move'|'buff',args:{a?:string;b?:string;slot?:number;buff?:BuffId},next?:RaidSession):void{this.transact(commandId,'raidExpedition:'+action,s=>{const r=s.community?.raid;requireRule(r?.expeditionVersion&&r.battle,'副本尚未开始');if(next){validateRaidCheckpoint(r,next);Object.assign(r,copy(next));}expeditionAction(r.battle!,r.members[0].ownerId,action,args);});}
  beginRaidWave(commandId:string){return this.transact(commandId,'beginRaidWave',s=>beginRaidWave(s));}
  checkpointRaid(commandId:string,next:RaidSession):void{this.transact(commandId,'checkpoint',s=>{const r=communityOf(s).raid;requireRule(r,'没有副本');validateRaidCheckpoint(r,next);s.community!.raid=copy(next);});}
  finishRaid(commandId:string,next:RaidSession,abandon=false):RaidSession{return this.transact(commandId,'finishRaid',s=>{discoverBattle(s,next.battle);return finishRaid(s,next,abandon);});}
  claimCodex(commandId:string,kind:"skill"|"boss",id:string):number{return this.transact(commandId,"codex",s=>claimCodex(s,kind,id));}
  claimChest(commandId:string,id:string):void{this.transact(commandId,"chest",s=>claimChest(s,id));}
  claimArenaTier(commandId:string,tier:number):void{this.transact(commandId,"tier",s=>claimArenaTier(s,tier));}
  matchArena(commandId:string,ids:string[],replacePending=false):ArenaSession{return this.transact(commandId,'matchArena',(s,now)=>{if(replacePending)this.endPendingBattles(s,now);return startArena(s,now,matchArena(s),ids);});}
  refreshClock(commandId:string):void{this.transact(commandId,'clock',()=>null);}
  enablePrototype(commandId:string):void{
    if(this.state.rulesVersion==='0.6')return;
    this.transact(commandId,'enableV06',s=>prototype.enablePrototype(s));
  }
  beginPrototypeRun(commandId:string,levelId:number,selected:string[],mode:RunMode='chapter',replacePending=false):string{
    return this.transact(commandId,'beginV06',(s,now)=>{
      if(replacePending)this.endPendingBattles(s,now);
      return prototype.startPrototypeRun(s,now,levelId,selected,mode,freshTurtle).id;
    });
  }
  expeditionCommand(commandId:string,action:'recruit'|'merge'|'move'|'buff',args:{a?:string;b?:string;slot?:number;buff?:BuffId},battle?:BattleState):void{
    this.transact(commandId,'expedition:'+action,s=>{const r=runOf(s,['prep','combat']);requireRule(r.expedition&&r.battle,'当前不是征召战斗');if(battle){checkBattle(r,r.id,battle);syncExpeditionRun(r,battle);}const b=r.battle!;expeditionAction(b,'local-player',action,args);syncExpeditionRun(r,b);});
  }
  lockBench(commandId:string,id:string,locked:boolean):void{this.transact(commandId,'benchLock',s=>prototype.lockBench(s,id,locked));}
  setHomeTeam(commandId:string,ids:string[]):void{
    this.transact(commandId,'homeTeam',s=>{requireRule(ids.length===Math.min(5,Object.keys(s.collection).length)&&ids.length>0&&new Set(ids).size===ids.length,'请选择五只不同的首发伙伴；不足五只时全部上阵');for(const id of ids){requireRule(!!s.collection[id],'伙伴不在收藏中');}s.homeTeam=[...ids];});
  }
  swapCollectionOrder(commandId:string,a:string,b:string):void{this.transact(commandId,'petOrder',s=>swapPetOrder(s,a,b));}
  deployBench(commandId:string,id:string,slot:number,battle?:BattleState):void{
    this.transact(commandId,'deploy',s=>{const r=runOf(s);requireRule(!r.expedition,'征召玩法没有备战席');if(r.phase==='combat'){requireRule(battle,'请先保存当前战斗');checkBattle(r,r.id,battle);r.battle=copy(battle);}prototype.deployBench(s,id,slot);});
  }
  setBattleSpeed(commandId:string,speed:1|2):void{
    this.transact(commandId,'speed',s=>{const r=runOf(s);requireRule(r.rulesVersion==='0.6'&&(speed===1||speed===2),'速度只能选择 1X 或 2X');r.speed=speed;});
  }
  prepareEndlessReward(commandId:string,wave:number):void{this.transact(commandId,'endlessDraw',s=>prototype.prepareEndlessReward(s,wave));}
  chooseEndlessReward(commandId:string,wave:number,index?:number){return this.transact(commandId,'endlessReward',s=>prototype.chooseEndlessReward(s,wave,index));}
  buyEndlessReward(commandId:string,wave:number,all=false){return this.transact(commandId,'endlessBuy',s=>prototype.buyEndlessReward(s,wave,all));}
  closeEndlessReward(commandId:string,wave:number):void{this.transact(commandId,'endlessClose',s=>prototype.closeEndlessReward(s,wave));}
  takeHome(commandId:string,id:string):Turtle{return this.transact(commandId,'takeHome',s=>prototype.carryTurtle(s,id));}
  discardTakeaway(commandId:string,id:string):void{this.transact(commandId,'discardTakeaway',s=>prototype.discardTakeaway(s,id));}
  releaseTurtle(commandId:string,id:string):void{this.transact(commandId,'release',s=>prototype.releaseCollected(s,id));}
  startOutsideFusion(commandId:string,aId:string,bId:string){return this.transact(commandId,'outsideFusion',(s,now)=>prototype.startOutsideFusion(s,now,aId,bId));}
  revealOutsideFusion(commandId:string):Turtle{
    return this.transact(commandId,'outsideReveal',s=>{const e=s.outsideFusion;requireRule(e,'没有待揭晓的局外合成');e.revealed=true;return e.candidate;});
  }
  keepOutsideFusion(commandId:string,choice:'A'|'B'|'C'):Turtle{return this.transact(commandId,'outsideKeep',s=>prototype.keepOutsideFusion(s,choice));}
  finishBookReveal(commandId:string):void{this.transact(commandId,'bookReveal',s=>{requireRule(s.bookReveal,'没有待揭晓的技能书');delete s.bookReveal;});}
  updateAvatar(commandId:string,avatar:{role:Role;image?:string}):void{
    this.transact(commandId,'avatar',s=>{
      requireRule(ROLE_IDS.includes(avatar.role),'头像角色不存在');
      requireRule(avatar.image===undefined||avatar.image.length<=360000&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar.image),'头像格式或大小不合适');
      s.avatar={...avatar};
    });
  }
  updateSettings(commandId:string,settings:Partial<Settings>):Settings{
    return this.transact(commandId,'settings',s=>{
      const next={...s.settings,...settings};
      requireRule(Number.isFinite(next.music)&&next.music>=0&&next.music<=1&&Number.isFinite(next.effects)&&next.effects>=0&&next.effects<=1,'音量应在0到100%之间');
      requireRule(['high','low'].includes(next.quality)&&typeof next.reducedMotion==='boolean','画面设置不正确');
      requireRule(next.autoSkills===undefined||typeof next.autoSkills==='boolean','自动施法设置不正确');
      requireRule(next.manualSkillTurtles===undefined||Array.isArray(next.manualSkillTurtles)&&next.manualSkillTurtles.length<=100&&next.manualSkillTurtles.every(id=>typeof id==='string'&&id.length<128),'手动技能设置不正确');
      s.settings=next;return next;
    });
  }
  rename(commandId:string,id:string,name:string):void{
    this.transact(commandId,'rename',s=>{ensureHome(s);const t=s.collection[id];requireRule(t,'找不到这只龟');name=name.trim();requireRule(Array.from(name).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?1:2),0)<=12&&!/[\x00-\x1f]/.test(name),'名字最多6个汉字或12个英文字符');t.name=name;});
  }
  setLocked(commandId:string,id:string,locked:boolean):void{
    this.transact(commandId,'lock',s=>{requireRule(!s.outsideFusion&&!s.bookReveal,'请先完成当前揭晓与选择');const t=s.collection[id];requireRule(t,'找不到这只龟');t.locked=!!locked;});
  }
  train(commandId:string,id:string,material:Material):Turtle{
    return this.transact(commandId,'train',s=>{
      ensureHome(s);const t=s.collection[id];requireRule(t,'找不到这只龟');
      requireRule(['attack','health','defense','growth'].includes(material),'培养项目不存在');
      const growth=material==='growth',cap=s.livingVersion?(growth?20:40):(growth?5:10),max=growth?110:100,cost=trainingCost(s,t,material);
      requireRule(t.training[material]<cap&&t.innate[material]+t.training[material]<max,'这项培养已达到上限');
      requireRule(s.gold>=cost&&s.materials[material]>=1,'金币或培养材料不足');
      s.gold-=cost;s.materials[material]--;t.training[material]++;return t;
    });
  }
  learnSkillBook(commandId:string,id:string,bookSkillId:SkillId):SkillBookReceipt{
    return this.transact(commandId,'skillBook',s=>{
      ensureHome(s);const turtle=s.collection[id];requireRule(turtle,'找不到这只龟');
      const books=s.skillBooks,count=books?.[bookSkillId];
      requireRule(books&&typeof count==='number'&&Number.isSafeInteger(count)&&count>0,'这本技能书数量不足');
      const application=applySkillBook(s,turtle,bookSkillId);
      // This transaction consumes the actual book once. No extra price or supply
      // is invented here; any future change to those needs an economic rule.
      books[bookSkillId]=count-1;s.collection[id]=application.turtle;
      if(s.rulesVersion==='0.6')s.bookReveal={commandId,receipt:copy(application.receipt),turtle:copy(application.turtle)};
      // Finished runs deliberately keep their earlier individuals and fixed
      // offspring. Later collection archives the then-current permanent source.
      return application.receipt;
    });
  }
  beginRun(commandId:string,levelId:number,selectedSources:string[],replacePending=false):string{
    return this.transact(commandId,'beginRun',(s,now)=>{
      if(replacePending)this.endPendingBattles(s,now);
      ensureHome(s);const level=LEVELS[levelId];requireRule(level&&levelId<=s.unlockedLevel,'请先通过前一关');
      requireRule(selectedSources.length>=1&&selectedSources.length<=5&&new Set(selectedSources).size===selectedSources.length&&selectedSources.every(id=>!!s.collection[id]),'请选择一至五只不同的伙伴');
      const free=levelId===0&&!s.tutorialStarted;
      requireRule(free||s.stamina>=ECONOMY.staminaCost,'体力不足，休息片刻再来吧');
      if(!free)s.stamina-=ECONOMY.staminaCost;
      if(levelId===0)s.tutorialStarted=true;
      const r:RunState={id:nextId(s,'run'),levelId,phase:'prep',wave:0,coreHealth:20,goldEarned:0,combatSeconds:0,startedAt:now,
        selectedSources:[...selectedSources],usedSources:[],units:{},merges:{},mergeWavesUsed:[],recruitAvailable:false,recruitCandidates:[],refreshUsed:false};
      enterPermanent(s,r,selectedSources[0]);s.run=r;return r.id;
    });
  }
  recruit(commandId:string,choice:{permanentId:string}|{candidateId:string}):RunTurtle{
    return this.transact(commandId,'recruit',s=>{
      const r=runOf(s,['prep','between']);requireRule(r.recruitAvailable,'本波加入机会已经使用');
      requireRule(live(r).length<10,'本局最多十只龟，请先合成腾出位置');
      let u:RunTurtle;
      if('permanentId' in choice)u=enterPermanent(s,r,choice.permanentId);
      else{
        const t=r.recruitCandidates.find(t=>t.id===choice.candidateId);requireRule(t,'候选已经更新');
        u={id:nextId(s,'u'),turtle:copy(t),sources:[],slot:availableSlot(r),level:1};r.units[u.id]=u;
      }
      r.recruitAvailable=false;r.recruitCandidates=[];return u;
    });
  }
  placeUnit(commandId:string,id:string,point:import('./types').Point,battle?:BattleState):void{
    this.transact(commandId,'place',s=>{
      const r=runOf(s,['prep','between','combat']);requireRule(!r.expedition,'请长按伙伴拖到固定站位');requireRule(r.rulesVersion==='0.6','此旧版对局请先结束后再自由布阵');
      if(r.phase==='combat'){requireRule(battle,'请先保存当前战斗');checkBattle(r,r.id,battle);r.battle=copy(battle);}
      const u=unitOf(r,id),others=live(r).filter(v=>v.id!==id&&v.slot!==null),map=BATTLE_MAPS[r.levelId],p=normalizedPoint(point);
      const occupied=others.find(v=>{const at=v.placement??map.slots[v.slot!];return Math.hypot(at.x-p.x,at.z-p.z)<.78;});
      if(occupied){prototype.movePrototypeUnit(s,id,occupied.slot!);return;}
      requireRule(!placementIssue(map,p,others.map(v=>v.placement??map.slots[v.slot!])),placementIssue(map,p,others.map(v=>v.placement??map.slots[v.slot!]))??'这里不能摆放');
      if(u.slot===null){const slot=map.slots.findIndex((_,i)=>!others.some(v=>v.slot===i));requireRule(others.length<5&&slot>=0,'已上阵五只，请先换下一只伙伴');prototype.deployBench(s,id,slot,p);}
      else{if(r.phase==='combat')moveBattleUnit(r.battle!,id,u.slot,p);u.placement=p;}
    });
  }
  moveUnit(commandId:string,id:string,slot:number|null,battle?:BattleState,benchSlot?:number):void{
    this.transact(commandId,'move',s=>{
      if(s.run?.rulesVersion==='0.6'){
        const r=s.run;requireRule(!r.expedition,'请使用局内征召、换位和同阶合成');if(r.phase==='combat'){requireRule(battle,'请先保存当前战斗');checkBattle(r,r.id,battle);r.battle=copy(battle);}
        prototype.movePrototypeUnit(s,id,slot,benchSlot);return;
      }
      const r=runOf(s,['prep','between']),u=unitOf(r,id);requireRule(slot===null||(Number.isInteger(slot)&&slot>=0&&slot<5),'布阵位置不存在');
      const other=slot===null?undefined:live(r).find(v=>v.id!==u.id&&v.slot===slot);
      if(other)other.slot=u.slot;u.slot=slot;
      requireRule(live(r).some(v=>v.slot!==null),'至少保留一只龟在场');
      requireRule(live(r).filter(v=>v.slot===null).length<=5,'替补席已满，最多五只替补');
    });
  }
  /** Called by the battle adapter after constructing the deterministic wave state. */
  beginWave(commandId:string,runId:string,battle:BattleState):void{
    this.transact(commandId,'beginWave',s=>{
      const r=runOf(s,['prep','between']);requireRule((r.mode==='endless'||r.wave<(r.waveLimit??BATTLE_MAPS[r.levelId].waves))&&live(r).some(u=>u.slot!==null),'没有可出战伙伴');
      requireRule(!r.rewardNodes?.some(prototype.hasPendingReward),'请先揭晓本波随机奖励');
      for(const unit of battle.units){const source=r.units[unit.id],sleeping=source?.sleepUntilWave;if(source?.fallen&&sleeping===undefined)requireRule(!unit.alive&&unit.hp===0,'伙伴已倒下，本局不能再次出战');if(sleeping!==undefined&&sleeping>battle.wave)requireRule(!unit.alive&&unit.hp===0&&unit.sleepUntilWave===sleeping,'伙伴尚未从沉睡苏醒');}
      checkBattle(r,runId,battle);requireRule(battle.status==='fighting'&&battle.tick===0,'新波次必须从准备状态开始');
      r.phase='combat';r.battle=copy(battle);r.recruitAvailable=false;r.recruitCandidates=[];
    });
  }
  checkpointBattle(commandId:string,runId:string,battle:BattleState):void{
    this.transact(commandId,'checkpoint',(s,now)=>{const r=runOf(s,['combat']);checkBattle(r,runId,battle);discoverBattle(s,battle);if(r.expedition)syncExpeditionRun(r,battle);else{r.battle=copy(battle);rescueBoss(s,r,r.battle,now);}});
  }
  completeWave(commandId:string,runId:string,battle:BattleState):void{
    this.transact(commandId,'completeWave',(s,now)=>{
      const r=runOf(s,['combat']);checkBattle(r,runId,battle);requireRule(battle.status==='won'||battle.status==='lost','这一波战斗尚未结束');discoverBattle(s,battle);
      if(r.expedition){syncExpeditionRun(r,battle);settleExpeditionRun(s,r,battle.status==='won',now,freshTurtle);return;}
      r.contributions??={};for(const [id,row] of Object.entries(battle.contributions??{})){const total=r.contributions[id]??={name:row.name,damage:0,healing:0,shield:0,reflected:0,rebirths:0};for(const key of ['damage','healing','shield','reflected','rebirths'] as const)total[key]+=row[key];}
      for(const actor of battle.units.concat(battle.benchUnits??[])){const u=r.units[actor.id];if(u){if(r.rulesVersion==='0.6')u.fallen=!actor.alive;if(actor.sleepUntilWave!==undefined)u.sleepUntilWave=actor.sleepUntilWave;else delete u.sleepUntilWave;}}
      if(r.bossRescuedWaves!==undefined){r.battle=copy(battle);rescueBoss(s,r,r.battle,now);}
      r.coreHealth=battle.coreHealth;r.combatSeconds+=battle.elapsed;delete r.battle;
      if(battle.status==='lost'){this.settle(s,r,false,now);return;}
      r.wave++;grantExperience(s,r.usedSources,r.mode==='endless'?10+Math.min(60,r.wave)*2:22+r.levelId*2+r.wave*3);for(const u of live(r)){const owned=u.savedId?s.collection[u.savedId]:undefined;if(owned?.development)u.turtle.development=copy(owned.development);}
      r.goldEarned+=goldAmount(s,r.mode==='endless'?PROTOTYPE.endless.waveGold:ECONOMY.waveGold);live(r).forEach(u=>updateLocalLevel(s,u,r.rulesVersion==='0.6'));
      if(r.rulesVersion==='0.6'){
        if(r.mode==='endless')prototype.recordEndlessWave(s,r);
        else if(r.wave===(r.waveLimit??BATTLE_MAPS[r.levelId].waves)){this.settle(s,r,true,now);return;}
        r.phase='between';if(r.mode==='chapter'&&r.bossRescuedWaves===undefined)prototype.refreshBench(s,r,now,freshTurtle);return;
      }
      if(r.wave===BATTLE_MAPS[r.levelId].waves){this.settle(s,r,true,now);return;}
      r.phase='between';r.recruitAvailable=true;r.recruitCandidates=Array.from({length:3},()=>freshTurtle(s,now));
    });
  }
  mergePreview(aId:string,bId:string){
    const r=runOf(this.state,this.state.run?.rulesVersion==='0.6'?['prep','between','combat']:['between']);
    if(r.rulesVersion==='0.6')requireRule(unitOf(r,aId).benchSlot!==undefined&&unitOf(r,bId).benchSlot!==undefined,'请选择两只备战伙伴');
    return previewFusion(unitOf(r,aId).turtle,unitOf(r,bId).turtle);
  }
  merge(commandId:string,aId:string,bId:string,battle?:BattleState,allowPermanent=false):RunTurtle{
    return this.transact(commandId,'merge',(s,now)=>{
      if(s.run?.rulesVersion==='0.6'){
        const r=s.run;requireRule(!r.expedition,'请使用局内征召、换位和同阶合成');if(r.phase==='combat'){requireRule(battle,'请先保存当前战斗');checkBattle(r,r.id,battle);r.battle=copy(battle);}
        return prototype.mergeBench(s,now,aId,bId,allowPermanent);
      }
      const r=runOf(s,['between']);requireRule(aId!==bId,'请选择两只不同的龟');
      requireRule(BATTLE_MAPS[r.levelId].mergeWaves.includes(r.wave)&&!r.mergeWavesUsed.includes(r.wave),'当前波次没有合成机会');
      const a=unitOf(r,aId),b=unitOf(r,bId),sources=[...a.sources,...b.sources];
      requireRule(new Set(sources).size===sources.length,'同一来源不能参与两次');
      const eventId=nextId(s,'merge');
      const turtle=generateFusion(s,a.turtle,b.turtle,nextId(s,'t'),now);
      const output:RunTurtle={id:nextId(s,'u'),turtle,sources,slot:a.slot??b.slot,level:levelInfo(turtle).level};
      a.consumedBy=eventId;b.consumedBy=eventId;r.units[output.id]=output;
      r.merges[eventId]={id:eventId,inputIds:[aId,bId],outputId:output.id,originalSources:[...sources],wave:r.wave,revealed:false,probabilityVersion:FUSION_VERSION};
      r.mergeWavesUsed.push(r.wave);r.pendingMergeId=eventId;r.phase='reveal';return output;
    });
  }
  reveal(commandId:string):RunTurtle{
    return this.transact(commandId,'reveal',s=>{
      const r=runOf(s,['reveal']),id=r.pendingMergeId;requireRule(id,'没有等待揭晓的结果');
      const event=r.merges[id];event.revealed=true;delete r.pendingMergeId;r.phase=r.resumeAfterReveal??'between';delete r.resumeAfterReveal;return unitOf(r,event.outputId);
    });
  }
  collectionPreview(unitId:string):{candidate:Turtle;sources:Turtle[];alreadySaved:boolean;lockedSources:string[]}{
    const r=runOf(this.state,['prep','between','result']),u=unitOf(r,unitId);
    const sources=u.sources.map(id=>this.state.collection[id]).filter((t):t is Turtle=>!!t);
    return copy({candidate:u.turtle,sources,alreadySaved:!!u.savedId,lockedSources:sources.filter(t=>t.locked).map(t=>t.id)});
  }
  collect(commandId:string,unitId:string):Turtle{
    return this.transact(commandId,'collect',(s,now)=>{
      const r=runOf(s,['prep','between','result']),u=unitOf(r,unitId);
      if(r.rulesVersion==='0.6')return prototype.carryTurtle(s,unitId);
      if(u.savedId){const saved=s.collection[u.savedId];requireRule(saved,'这个旧档案已在新版收藏中整理');return saved;}
      requireRule(u.sources.every(id=>!!s.collection[id]),'来源档案发生了变化，请重新比较');
      requireRule(u.sources.every(id=>!s.collection[id].locked),'来源中有已锁定的龟，请先解锁后再确认收录');
      requireRule(Object.keys(s.collection).length-u.sources.length+1<=s.capacity,'收藏空间不足');
      requireRule(!s.collection[u.turtle.id]&&!s.history[u.turtle.id],'新龟的档案编号已存在');
      const t=copy(u.turtle);t.locked=false;
      for(const id of u.sources){s.history[id]={turtle:copy(s.collection[id]),retiredAt:now,replacementId:t.id,eventId:commandId};delete s.collection[id];}
      s.collection[t.id]=t;u.sources=[t.id];u.savedId=t.id;u.turtle=copy(t);
      if(!r.usedSources.includes(t.id))r.usedSources.push(t.id);
      const event=Object.values(r.merges).find(e=>e.outputId===u.id);if(event)event.collectedId=t.id;
      return t;
    });
  }
  abandonRun(commandId:string):RunResult{
    return this.transact(commandId,'abandon',(s,now)=>this.abandonCurrentRun(s,now));
  }
  private abandonCurrentRun(s:GameSave,now:number):RunResult{
    const r=runOf(s);if(r.phase==='result')return s.results[r.id];
    // A fixed reveal survives abandoning: the candidate remains in the result screen for collection.
    if(r.pendingMergeId){r.merges[r.pendingMergeId].revealed=true;delete r.pendingMergeId;}
    if(r.expedition)return settleExpeditionRun(s,r,false,now,freshTurtle);
    if(r.rulesVersion==='0.6'&&r.battle){r.combatSeconds+=r.battle.elapsed;delete r.battle;}
    return this.settle(s,r,false,now);
  }
  /** Settlement and replacement share one transaction, so a rejected new run preserves the old battle. */
  private endPendingBattles(s:GameSave,now:number):void{
    if(s.community?.raid&&!s.community.raid.settled){discoverBattle(s,s.community.raid.battle);finishRaid(s,s.community.raid,true);}
    if(s.community?.arena&&!s.community.arena.settled)finishArena(s,s.community.arena,true);
    if(s.run&&s.run.phase!=='result')this.abandonCurrentRun(s,now);
  }
  private settle(s:GameSave,r:RunState,victory:boolean,now:number):RunResult{
    if(r.rulesVersion==='0.6')return prototype.settlePrototype(s,r,victory,now);
    if(s.results[r.id])return s.results[r.id];
    const first=victory&&!s.cleared.includes(r.levelId),baseGold=r.goldEarned+(victory?goldAmount(s,ECONOMY.clearGold):0);
    const materials:NonNullable<RunResult['materials']>={};
    if(first){
      const material:Material=ROLE_IDS[r.levelId]==='stone'?'health':r.levelId===4?'growth':'attack';
      materials[material]=1;s.materials[material]++;
    }
    const result:RunResult={runId:r.id,levelId:r.levelId,victory,waves:r.wave,baseGold,firstClearGold:first?goldAmount(s,ECONOMY.firstClearGold):0,combatSeconds:r.combatSeconds,at:now,doubled:false,materials};
    s.gold+=baseGold+result.firstClearGold;s.results[r.id]=result;r.phase='result';delete r.battle;r.recruitAvailable=false;r.recruitCandidates=[];
    if(first){s.cleared.push(r.levelId);s.unlockedLevel=Math.min(LEVELS.length-1,Math.max(s.unlockedLevel,r.levelId+1));}
    if(victory&&r.levelId===0)s.tutorialDone=true;return result;
  }
  simulateAd(commandId:string,kind:AdKind,resultRunId?:string):number{
    return this.transact(commandId,'ad:'+kind,(s,now)=>{
      requireRule(['stamina','doubleGold','refresh'].includes(kind),'奖励入口不存在');
      requireRule(!s.run||['prep','between','result'].includes(s.run.phase),'请先完成当前战斗或揭晓');
      requireRule(s.dailyAds.total<ECONOMY.dailyAdCap&&s.dailyAds.counts[kind]<ECONOMY.adKindCap,'今天的体验奖励次数已用完');
      let reward=0;
      if(kind==='stamina'){requireRule(s.stamina<ECONOMY.staminaCap,'体力已满');reward=Math.min(5,ECONOMY.staminaCap-s.stamina);s.stamina+=reward;if(s.stamina===ECONOMY.staminaCap)s.staminaAt=now;}
      else if(kind==='doubleGold'){
        const result=resultRunId?s.results[resultRunId]:undefined;requireRule(result&&!result.doubled&&result.baseGold>0,'本次金币已翻倍或没有可翻倍金币');
        result.doubled=true;reward=result.baseGold;s.gold+=reward;
      }else{
        const r=runOf(s,['prep','between']);requireRule(r.recruitAvailable&&!r.refreshUsed&&r.recruitCandidates.length>0,'本局更换机会已用完或当前没有候选');
        r.recruitCandidates=Array.from({length:3},()=>freshTurtle(s,now));r.refreshUsed=true;reward=1;
      }
      s.dailyAds.counts[kind]++;s.dailyAds.total++;return reward;
    });
  }
}
