import {initializeExpeditionRun} from './expeditionRun';
import {SCENE_REVISION} from './sceneGeometry';
import {endlessMilestoneWaves} from './endlessRewards';
import {bookChestReward} from './bookPolicy';
import {levelInfo} from './development';
import {grantChest,discoverBattle} from './progression';
import type {GameSave, Material, OutsideFusion, RewardGrant, RunMode, RunResult, RunState, RunTurtle, SkillId, Turtle, RewardNode} from './types';
import {goldAmount,goldGrants} from './economy';
import {applyReward,packForWave} from './rewardPacks';
import {grantExperience} from './development';
import {ECONOMY, LEVELS,BATTLE_MAPS} from './data';
import {FUSION_VERSION, generateFusion} from './fusion';
import {copy, requireRule} from './save';
import {PROTOTYPE, drawReward, stageRewards, rewardBoard, EXTRA_DRAW_COSTS} from './prototypeConfig';
import {replaceBattleUnit,benchBattleUnit,moveBattleUnit,retireBenchedBattleUnit} from './battle';
import {random} from './random';
import {communityBusy,choosePets,reserveLoans,finishLoans,assertAssetMovable} from './community';

type Generator=(s:GameSave,now:number)=>Turtle;
const allocate=(s:GameSave,prefix:string)=>`${prefix}-${++s.idCounter}`;
export const currentUnits=(r:RunState):RunTurtle[]=>Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed);
export function pendingTakeaways(s:GameSave):RunTurtle[]{
  const r=s.run;
  if(r?.expedition)return r.phase==='result'?(r.lootIds??[]).map(id=>r.units[id]).filter(u=>u&&!u.savedId&&!u.removed):[];
  return r?.rulesVersion==='0.6'&&r.mode==='chapter'&&r.phase==='result'&&s.results[r.id]?.victory?
    currentUnits(r).filter(u=>!u.savedId&&!u.loanId):[];
}
export function enablePrototype(s:GameSave):void{
  if(s.rulesVersion==='0.6')return;
  s.rulesVersion='0.6';s.capacity=PROTOTYPE.capacity;
  if(Object.keys(s.collection).length>s.capacity)s.legacyCollectionAllowance=Object.keys(s.collection).length;
}
export function checkOutsideReady(s:GameSave):void{
  requireRule(!s.shop?.pending,'请先查看商城结果');
  requireRule(!communityBusy(s),'请先结束副本或竞技场挑战');
  requireRule(!s.run||s.run.phase==='result','请先结束当前挑战');
  requireRule(!s.outsideFusion,'请先完成上次合成的三选一');
  requireRule(!s.bookReveal,'请先揭晓已学习的技能');
}
function prototypeRun(s:GameSave):RunState{
  const r=s.run;requireRule(r?.rulesVersion==='0.6','这不是新版对局');return r;
}
function benchUnit(r:RunState,id:string):RunTurtle{
  const u=currentUnits(r).find(u=>u.id===id);requireRule(u&&u.slot===null&&u.benchSlot!==undefined,'请选择当前备战槽里的伙伴');return u;
}
export function refreshBench(s:GameSave,r:RunState,now:number,generate:Generator):void{
  requireRule(r.mode==='chapter','无尽使用资源奖励');
  for(let slot=0;slot<PROTOTYPE.benchSize;slot++){
    const old=currentUnits(r).find(u=>u.benchSlot===slot);
    if(old?.benchLocked)continue;
    if(old){if(r.battle)retireBenchedBattleUnit(r.battle,old.id);old.removed='refresh';delete old.benchSlot;}
    const u:RunTurtle={id:allocate(s,'u'),turtle:generate(s,now),sources:[],slot:null,benchSlot:slot,benchLocked:false,level:1};
    r.units[u.id]=u;
  }
}
function startLegacyPrototypeRun(s:GameSave,now:number,levelId:number,selected:string[],mode:RunMode,generate:Generator):RunState{
  checkOutsideReady(s);requireRule(pendingTakeaways(s).length===0,'请先整理上局待带回的伙伴');enablePrototype(s);
  requireRule(mode==='chapter'||mode==='endless','挑战模式不存在');
  if(mode==='endless'){
    requireRule(s.cleared.includes(PROTOTYPE.endless.unlockAfter),'先通关潮汐小径，再挑战无尽海湾');levelId=PROTOTYPE.endless.map;
  }else requireRule(LEVELS[levelId]&&levelId<=s.unlockedLevel,'请先通过前一关');
  requireRule(selected.length<=5&&new Set(selected).size===selected.length&&selected.every(id=>!!s.collection[id]||s.community?.loans.some(l=>l.id===id)),'最多选择五只不同的收藏伙伴');
  requireRule(mode==='chapter'||selected.length>0,'无尽至少需要一只收藏伙伴');
  if(mode==='chapter'){
    const free=!!s.solo||levelId===0&&!s.tutorialStarted;requireRule(free||s.stamina>=ECONOMY.staminaCost,'体力不足，休息片刻再来吧');
    if(!free)s.stamina-=ECONOMY.staminaCost;if(levelId===0)s.tutorialStarted=true;
  }
  const r:RunState={id:allocate(s,'run'),rulesVersion:'0.6',mapVersion:6,sceneRevision:SCENE_REVISION,mode,speed:1,levelId,phase:'prep',wave:0,coreHealth:20,...(mode==='chapter'?{waveLimit:5,bossRescuedWaves:[]}:{}),
    goldEarned:0,combatSeconds:0,startedAt:now,selectedSources:[...selected],usedSources:[...selected],units:{},merges:{},
    mergeWavesUsed:[],recruitAvailable:false,recruitCandidates:[],refreshUsed:false,rewardNodes:[],rewardLedger:[]};
  const pets=selected.length?choosePets(s,selected,now):[];reserveLoans(s,pets,r.id);
  pets.forEach((p,slot)=>{const u:RunTurtle={id:allocate(s,'u'),turtle:copy(p.turtle),sources:p.loanId?[]:[p.id],...(p.loanId?{loanId:p.loanId}:{savedId:p.id}),slot,level:levelInfo(p.turtle).level};r.units[u.id]=u;});
  if(mode==='chapter')refreshBench(s,r,now,generate);s.run=r;return r;
}
export function lockBench(s:GameSave,id:string,locked:boolean):void{
  const r=prototypeRun(s);requireRule(['prep','between','combat'].includes(r.phase),'请先完成当前操作');
  benchUnit(r,id).benchLocked=!!locked;
}
export function deployBench(s:GameSave,id:string,slot:number,placement?:import('./types').Point):void{
  const r=prototypeRun(s);requireRule(['prep','between','combat'].includes(r.phase),'请先完成当前操作');
  requireRule(Number.isInteger(slot)&&slot>=0&&!!BATTLE_MAPS[r.levelId].slots[slot],'上场位置不存在');const incoming=benchUnit(r,id);
  const old=currentUnits(r).find(u=>u.slot===slot);
  requireRule(!!old||currentUnits(r).filter(u=>u.slot!==null).length<5,'场上最多五只，请选择要替换的伙伴');
  if(r.phase==='combat'){
    requireRule(r.battle?.status==='fighting','本波已经结束');
      replaceBattleUnit(r.battle,{id:incoming.id,turtle:incoming.turtle,level:incoming.level,slot,placement:placement??old?.placement,sleepUntilWave:incoming.sleepUntilWave,fallen:incoming.fallen});
  }
  if(old){old.slot=null;old.benchSlot=incoming.benchSlot;old.benchLocked=true;}
    incoming.placement=placement??old?.placement;if(incoming.placement===undefined)delete incoming.placement;incoming.slot=slot;delete incoming.benchSlot;incoming.benchLocked=false;
}
export function movePrototypeUnit(s:GameSave,id:string,slot:number|null,benchSlot?:number):void{
  const r=prototypeRun(s),u=currentUnits(r).find(u=>u.id===id);
  requireRule(u&&['prep','between','combat'].includes(r.phase),'当前不能调整伙伴');
  if(slot!==null){
    requireRule(Number.isInteger(slot)&&slot>=0&&!!BATTLE_MAPS[r.levelId].slots[slot],'上场位置不存在');
    if(u.slot===null){deployBench(s,id,slot);return;}
    if(r.phase==='combat'){requireRule(r.battle,'战斗快照缺失');moveBattleUnit(r.battle,id,slot);}
      const other=currentUnits(r).find(v=>v.id!==id&&v.slot===slot),oldPoint=u.placement;u.placement=other?.placement;if(u.placement===undefined)delete u.placement;if(other){other.slot=u.slot;other.placement=oldPoint;if(other.placement===undefined)delete other.placement;}u.slot=slot;return;
  }
  requireRule(u.slot!==null,'这位伙伴已经在备战槽');
  const target=benchSlot??Array.from({length:5},(_,i)=>i).find(i=>!currentUnits(r).some(v=>v.benchSlot===i));
  requireRule(target!==undefined&&Number.isInteger(target)&&target>=0&&target<5,'备战槽已满');
  const occupant=currentUnits(r).find(v=>v.benchSlot===target);
  if(occupant){deployBench(s,occupant.id,u.slot);return;}
  if(r.phase==='combat'){
    requireRule(currentUnits(r).filter(v=>v.slot!==null).length>1&&r.battle,'战斗中至少留一位伙伴上场');benchBattleUnit(r.battle,u.id);
  }
  u.slot=null;u.benchSlot=target;u.benchLocked=true;
}
export function mergeBench(s:GameSave,now:number,aId:string,bId:string,allowPermanent=false):RunTurtle{
  const r=prototypeRun(s);requireRule(r.mode==='chapter'&&['prep','between','combat'].includes(r.phase),'当前不能合成备战伙伴');
  requireRule(aId!==bId,'请选择两只不同的备战伙伴');const a=benchUnit(r,aId),b=benchUnit(r,bId),eventId=allocate(s,'merge');
  requireRule(!a.loanId&&!b.loanId,'援助和租赁伙伴不能参与合成');
  const originals=[a,b].filter(u=>u.savedId).map(u=>u.savedId!);
  requireRule(!originals.length||allowPermanent,'建议回家再合，战斗中合成有损失本体的风险');
  requireRule(originals.every(id=>s.collection[id]&&!s.collection[id].locked),'请回海岛解锁参与合成的收藏伙伴');
  originals.forEach(id=>assertAssetMovable(s,id));
  const turtle=generateFusion(s,a.turtle,b.turtle,allocate(s,'t'),now);
  const result:RunTurtle={id:allocate(s,'u'),turtle,sources:[],slot:null,benchSlot:a.benchSlot,
    benchLocked:PROTOTYPE.lockFusionResult,level:levelInfo(turtle).level};
  a.consumedBy=eventId;b.consumedBy=eventId;delete a.benchSlot;delete b.benchSlot;
  for(const id of originals)delete s.collection[id];
  if(r.battle){retireBenchedBattleUnit(r.battle,a.id);retireBenchedBattleUnit(r.battle,b.id);}
  r.units[result.id]=result;r.merges[eventId]={id:eventId,inputIds:[aId,bId],outputId:result.id,originalSources:originals,
    wave:r.wave,revealed:false,probabilityVersion:FUSION_VERSION};
  r.resumeAfterReveal=r.phase as 'prep'|'between'|'combat';r.pendingMergeId=eventId;r.phase='reveal';return result;
}
export function recordEndlessWave(s:GameSave,r:RunState):void{
  const ledger=r.rewardLedger!;
  for(const grant of goldGrants(s,stageRewards(s,r.wave,!!s.economyVersion)))ledger.push({wave:r.wave,source:'stage',grant});
  if(r.wave%PROTOTYPE.endless.rewardEvery===0){const choices=goldGrants(s,rewardBoard(s,r.wave,!!s.economyVersion));r.rewardNodes!.push({wave:r.wave,choices,format:'stop-and-open',opened:[],closed:false,drawing:true,spentGold:0,randomIndex:Math.floor(random(s)*5)});}
}
export function hasPendingReward(node:RewardNode):boolean{return node.format==='stop-and-open'?!node.closed:node.chosen===undefined;}
export function remainingRewardIndices(node:RewardNode):number[]{return node.choices.map((_,i)=>i).filter(i=>!node.opened?.includes(i));}
export function rewardPrice(node:RewardNode,all=false):number{
  const count=node.opened?.length??0;if(!count||node.closed)return 0;
  return all?Math.ceil(EXTRA_DRAW_COSTS.slice(count).reduce<number>((a,b)=>a+b,0)*.9):EXTRA_DRAW_COSTS[count];
}
function rewardNode(s:GameSave,wave:number):RewardNode{
  const r=prototypeRun(s),node=r.rewardNodes?.find(n=>n.wave===wave);
  requireRule(r.mode==='endless'&&r.phase==='between'&&node&&hasPendingReward(node),'没有待处理的奖励');return node;
}
export function prepareEndlessReward(s:GameSave,wave:number):void{
  const node=rewardNode(s,wave);requireRule(node.format!=='stop-and-open'||node.drawing,'请先选择继续开奖或放弃');
  if(node.randomIndex===undefined){const remaining=remainingRewardIndices(node);node.randomIndex=remaining[Math.floor(random(s)*remaining.length)];}
}
export function chooseEndlessReward(s:GameSave,wave:number,_legacyIndex?:number):RewardGrant{
  const node=rewardNode(s,wave);prepareEndlessReward(s,wave);const index=node.randomIndex!;
  if(node.format==='stop-and-open'){
    requireRule(node.drawing&&!node.opened!.includes(index),'这份奖励已经领取');
    node.opened!.push(index);node.drawing=false;node.closed=node.opened!.length===5;
    node.chosen??=index;s.run!.rewardLedger!.push({wave,source:'choice',index,grant:copy(node.choices[index])});
  }else{node.chosen=index;s.run!.rewardLedger!.push({wave,source:'choice',grant:copy(node.choices[index])});}
  return copy(node.choices[index]);
}
export function buyEndlessReward(s:GameSave,wave:number,all=false):RewardGrant[]{
  const node=rewardNode(s,wave);requireRule(node.format==='stop-and-open'&&!node.drawing&&node.opened!.length>0,'请先暂停揭晓当前奖励');
  const cost=goldAmount(s,rewardPrice(node,all));requireRule(s.gold>=cost,'金币不足');
  s.gold-=cost;node.spentGold!+=cost;const remaining=remainingRewardIndices(node);
  if(all){
    const grants=remaining.map(index=>{node.opened!.push(index);const grant=copy(node.choices[index]);s.run!.rewardLedger!.push({wave,source:'choice',index,grant});return grant;});
    node.closed=true;return grants;
  }
  node.randomIndex=remaining[Math.floor(random(s)*remaining.length)];node.drawing=true;return [];
}
export function closeEndlessReward(s:GameSave,wave:number):void{
  const node=rewardNode(s,wave);requireRule(node.format==='stop-and-open'&&!node.drawing,'请先暂停揭晓已开始的奖励');node.closed=true;
}
function grantPermanent(s:GameSave,g:RewardGrant,materials:Partial<Record<Material,number>>,books:Partial<Record<SkillId,number>>):number{
  if(g.kind==='gold')return g.amount;
  if(g.kind==='material'){s.materials[g.material]+=g.amount;materials[g.material]=(materials[g.material]??0)+g.amount;}
  else if(g.kind==='bookPack'){applyReward(s,g);}else{s.skillBooks??={};s.skillBooks[g.skillId]=(s.skillBooks[g.skillId]??0)+g.amount;books[g.skillId]=(books[g.skillId]??0)+g.amount;}
  return 0;
}
export function carryTurtle(s:GameSave,id:string):Turtle{
  const r=prototypeRun(s),u=r.units[id];requireRule(u,'找不到待带回伙伴');
  if(u.savedId){requireRule(s.collection[u.savedId],'该伙伴已被整理');return s.collection[u.savedId];}
  requireRule(pendingTakeaways(s).some(x=>x.id===id),'这只龟不是通关时的有效新伙伴');
  requireRule(Object.keys(s.collection).length<PROTOTYPE.capacity,'收藏已满五十只，请先整理或放弃新伙伴');
  requireRule(!s.collection[u.turtle.id]&&!s.history[u.turtle.id],'该个体档案已存在');
  const t=copy(u.turtle);t.locked=false;s.collection[t.id]=t;u.savedId=t.id;u.sources=[t.id];
  s.results[r.id].broughtIds??=[];s.results[r.id].broughtIds!.push(t.id);return t;
}
export function discardTakeaway(s:GameSave,id:string):void{
  const u=pendingTakeaways(s).find(u=>u.id===id);requireRule(u,'找不到待整理的新伙伴');u.removed='discard';u.slot=null;delete u.benchSlot;
}
export function settlePrototype(s:GameSave,r:RunState,victory:boolean,now:number):RunResult{
  if(s.results[r.id])return s.results[r.id];
  requireRule(!r.rewardNodes?.some(hasPendingReward),'请先揭晓本波随机奖励');
  discoverBattle(s,r.battle);
  const endless=r.mode==='endless',first=!endless&&victory&&!s.cleared.includes(r.levelId);
  const materials:Partial<Record<Material,number>>={},books:Partial<Record<SkillId,number>>={};
  let baseGold=r.goldEarned+(!endless&&victory?goldAmount(s,ECONOMY.clearGold):0);
  const stages:NonNullable<RunResult['stages']>=[];
  for(const item of r.rewardLedger??[]){
    baseGold+=grantPermanent(s,item.grant,materials,books);
    if(item.source==='stage'){let row=stages.find(x=>x.wave===item.wave);if(!row){row={wave:item.wave,grants:[]};stages.push(row);}row.grants.push(copy(item.grant));}
  }
  if(first){const material:Material=r.levelId===0?'health':r.levelId===4?'growth':'attack';grantPermanent(s,{kind:'material',material,amount:1},materials,books);}
  if(!endless&&victory){
    const material:Material=(['attack','health','defense','attack','growth'] as const)[r.levelId%5];
    grantPermanent(s,{kind:'material',material,amount:1},materials,books);
    // Campaign progression rewards pets and training materials; books come from activities.
  }
  if(endless&&(!s.endlessBest||r.wave>s.endlessBest.waves))s.endlessBest={waves:r.wave,at:now,team:currentUnits(r).filter(u=>u.slot!==null).map(u=>copy(u.turtle))};
  const result:RunResult={runId:r.id,mode:r.mode,levelId:r.levelId,victory,waves:r.wave,baseGold,
    firstClearGold:first?goldAmount(s,ECONOMY.firstClearGold):0,combatSeconds:r.combatSeconds,at:now,doubled:false,materials,skillBooks:books,stages,broughtIds:[],
    ...(endless?{bestWave:s.endlessBest?.waves??0}:{}),...(r.contributions?{contributions:copy(r.contributions)}:{})};
  if(s.livingVersion){grantExperience(s,r.usedSources,(!endless&&victory?50:0));}
  if(endless&&r.wave>0){const floor=r.wave,stars=Math.min(3,1+Math.floor(floor/20));result.chestId=grantChest(s,'endless:'+r.id,'无尽 '+floor+' 层宝箱',stars,[{kind:'gold',amount:goldAmount(s,20*floor)},{kind:'material',material:'growth',amount:Math.max(1,Math.floor(floor/5))},...(s.livingVersion?[{kind:'bookPack' as const,grade:packForWave(floor),amount:Math.max(1,Math.floor(floor/20))}]:[])],now).id;}
  if(s.livingVersion&&endless)for(const wave of endlessMilestoneWaves(r.wave))grantChest(s,'endless:'+r.id+':'+wave,wave+'波里程宝箱',Math.min(3,1+Math.floor(wave/30)),[{kind:'gold',amount:goldAmount(s,30+wave*5)},bookChestReward(s,wave>=60)],now);
  finishLoans(s,r.id);s.gold+=baseGold+result.firstClearGold;s.results[r.id]=result;r.phase='result';delete r.battle;delete r.resumeAfterReveal;
  r.recruitAvailable=false;r.recruitCandidates=[];
  if(first){s.cleared.push(r.levelId);s.unlockedLevel=Math.min(LEVELS.length-1,Math.max(s.unlockedLevel,r.levelId+1));}
  if(!endless&&victory&&r.levelId===0)s.tutorialDone=true;
  for(const u of pendingTakeaways(s)){if(Object.keys(s.collection).length>=PROTOTYPE.capacity)break;carryTurtle(s,u.id);}
  return result;
}
export function startOutsideFusion(s:GameSave,now:number,aId:string,bId:string):OutsideFusion{
  checkOutsideReady(s);requireRule(pendingTakeaways(s).length===0,'请先整理上局伙伴');enablePrototype(s);
  const a=s.collection[aId],b=s.collection[bId];requireRule(a&&b&&aId!==bId,'请选择两只不同的收藏伙伴');
  assertAssetMovable(s,aId);assertAssetMovable(s,bId);
  requireRule(!a.locked&&!b.locked,'请先解锁参与合成的收藏伙伴');
  const id=allocate(s,'outside'),candidate=generateFusion(s,a,b,allocate(s,'t'),now);
  const event:OutsideFusion={id,rule:PROTOTYPE.outsideFusionRule,inputIds:[aId,bId],parents:[copy(a),copy(b)],candidate,revealed:false,probabilityVersion:FUSION_VERSION};
  s.outsideFusion=event;return event;
}
export function keepOutsideFusion(s:GameSave,choice:'A'|'B'|'C'):Turtle{
  const event=s.outsideFusion;requireRule(event&&event.revealed,'请先完整揭晓合成结果');
  requireRule(['A','B','C'].includes(choice),'请选择留下 A、B 或 C');
  requireRule(event.inputIds.every(id=>!!s.collection[id]),'合成亲本资料丢失');
  const keeper=copy(choice==='C'?event.candidate:event.parents[choice==='A'?0:1]);
  for(const id of event.inputIds)delete s.collection[id];s.collection[keeper.id]=keeper;delete s.outsideFusion;return keeper;
}
export function releaseCollected(s:GameSave,id:string):void{
  checkOutsideReady(s);const t=s.collection[id];requireRule(t&&!t.locked,'请先解锁要放弃的伙伴');
  requireRule(Object.keys(s.collection).length>1,'至少保留一位伙伴');
  assertAssetMovable(s,id);delete s.collection[id];
}

export function startPrototypeRun(s:GameSave,now:number,levelId:number,selected:string[],mode:RunMode,generate:Generator):RunState{const r=startLegacyPrototypeRun(s,now,levelId,selected,mode,generate);initializeExpeditionRun(s,r);return r;}
