import {expeditionSlots} from './expeditionRules';
import {migrateSceneSave} from './sceneMigration';
import {groundIssue,placementIssue,fieldIssue} from './placement';
import {validatePatrol} from './patrol';
import {validateDevelopment} from './development';
import {validateMailbox} from './mail';
import {validReward,PACK_NAMES} from './rewardPacks';
import {goldAmount} from './economy';
import {validateProgression} from './progression';
import {validateTaskJournal} from './taskPolicy';
import {GameSave, Turtle} from './types';

import {validateCommunity} from './communityValidation';
import {LEGACY_EXPANDED_MAPS,BATTLE_MAPS,LEGACY_PAINTED_MAPS, LEVELS, ROLES, SKILLS, skillsForRole} from './data';
import {KeyValueStorage} from '../platform/storage';
import {migrateLegacyLayoutCoordinates, validateBattle, validateBattleForSaveDecode} from './battleValidation';

export const SAVE_KEY='gowaygui.local.chapter1.v1';
export const BACKUP_KEY=SAVE_KEY+'.backup';
export function copy<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
export class GameError extends Error {
  constructor(public readonly code:string,message:string){super(message);this.name='GameError';}
}
export function requireRule(condition:unknown,message:string,code='RULE'):asserts condition {
  if(!condition)throw new GameError(code,message);
}
function integer(n:unknown,min:number,max=Number.MAX_SAFE_INTEGER):boolean{
  return typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
}
const bookSkills=new Set<string>(SKILLS.map(skill=>skill.id));
function validateSkillBookInventory(value:unknown):void{
  // Do not fabricate grants when an older save has no book inventory.
  if(value===undefined)return;
  requireRule(value&&typeof value==='object'&&!Array.isArray(value),'技能书库存损坏','SAVE');
  for(const [id,count] of Object.entries(value))requireRule(bookSkills.has(id)&&integer(count,0),'技能书库存损坏','SAVE');
}
function validateSkillBookReceipt(value:unknown):void{
  requireRule(value&&typeof value==='object'&&!Array.isArray(value),'技能书学习收据损坏','SAVE');
  const r=value as import('./skillBooks').SkillBookReceipt;
  requireRule(typeof r.turtleId==='string'&&r.turtleId.length>0&&bookSkills.has(r.bookSkillId)&&bookSkills.has(r.replacedSkillId),'技能书学习收据损坏','SAVE');
  for(const skills of [r.beforeSkills,r.afterSkills])requireRule(Array.isArray(skills)&&skills.length>=1&&skills.length<=12&&new Set(skills).size===skills.length&&skills.every(id=>bookSkills.has(id)),'技能书学习收据损坏','SAVE');
  requireRule(r.beforeSkills.length===r.afterSkills.length&&integer(r.replacedIndex,0,r.beforeSkills.length-1)
    &&r.beforeSkills[r.replacedIndex]===r.replacedSkillId&&!r.beforeSkills.includes(r.bookSkillId)
    &&r.afterSkills.every((id,index)=>id===(index===r.replacedIndex?r.bookSkillId:r.beforeSkills[index])),'技能书学习收据损坏','SAVE');
}
function validateContributions(value:unknown):void{
  if(value===undefined)return;
  requireRule(!!value&&typeof value==='object'&&!Array.isArray(value),'战斗表现资料损坏','SAVE');
  for(const [id,raw] of Object.entries(value as Record<string,unknown>)){
    requireRule(id.length>0&&!!raw&&typeof raw==='object'&&!Array.isArray(raw),'战斗表现资料损坏','SAVE');
    const row=raw as Record<string,unknown>;
    requireRule(typeof row.name==='string'&&row.name.length>0&&row.name.length<=100,'战斗表现名称损坏','SAVE');
    for(const key of ['damage','healing','shield','reflected'])requireRule(typeof row[key]==='number'&&Number.isFinite(row[key])&&(row[key] as number)>=0,'战斗表现数值损坏','SAVE');
    requireRule(integer(row.rebirths as number,0),'重生次数损坏','SAVE');
  }
}
function validateMaterialReceipt(result:unknown):void{
  requireRule(result&&typeof result==='object'&&!Array.isArray(result),'结算收据损坏','SAVE');
  validateContributions((result as {contributions?:unknown}).contributions);
  const materials=(result as {materials?:unknown}).materials;
  // Legacy saves did not record per-run materials. Do not invent a historical grant from current balance data.
  if(materials===undefined)return;
  requireRule(materials&&typeof materials==='object'&&!Array.isArray(materials),'结算材料收据损坏','SAVE');
  for(const [id,count] of Object.entries(materials)){
    requireRule(['attack','health','defense','growth'].includes(id)&&integer(count,1),'结算材料收据损坏','SAVE');
  }
}
function validateGrant(value:unknown):void{
  requireRule(value&&typeof value==='object'&&!Array.isArray(value),'奖励资料损坏','SAVE');
  const g=value as import('./types').RewardGrant;requireRule(integer(g.amount,1),'奖励数量损坏','SAVE');
  if(g.kind==='gold')return;if(g.kind==='bookPack'){requireRule(validReward(g),'技能礼包损坏','SAVE');return;}
  if(g.kind==='material'){requireRule(['attack','health','defense','growth'].includes(g.material),'奖励材料损坏','SAVE');return;}
  requireRule(g.kind==='book'&&bookSkills.has(g.skillId)&&(g.pack===undefined||g.pack==='ordinary'||g.pack==='fine'),'技能书奖励损坏','SAVE');
}
function validatePrototypeState(s:GameSave):void{
  requireRule(s.rulesVersion===undefined||s.rulesVersion==='0.6','玩法存档版本不受支持','SAVE');
  if(s.rulesVersion===undefined){requireRule(!s.outsideFusion&&!s.bookReveal&&!s.endlessBest,'旧存档包含新版未启用区域','SAVE');return;}
  requireRule(s.capacity===50,'新版收藏上限应为五十只','SAVE');
  if(s.legacyCollectionAllowance!==undefined)requireRule(integer(s.legacyCollectionAllowance,51,1000),'旧收藏保留额度损坏','SAVE');
  requireRule(!s.outsideFusion||!s.bookReveal,'不能同时存在两种待揭晓事务','SAVE');
  if(s.outsideFusion){
    const e=s.outsideFusion;requireRule(!s.run||s.run.phase==='result','进行中对局不能包含局外合成','SAVE');
    requireRule(e.rule==='keep-one'&&typeof e.id==='string'&&e.id.length>0&&typeof e.revealed==='boolean'&&typeof e.probabilityVersion==='string','局外合成记录损坏','SAVE');
    requireRule(Array.isArray(e.inputIds)&&e.inputIds.length===2&&e.inputIds[0]!==e.inputIds[1]&&Array.isArray(e.parents)&&e.parents.length===2,'局外合成亲本损坏','SAVE');
    e.parents.forEach((t,i)=>{validateTurtle(t);requireRule(t.id===e.inputIds[i]&&JSON.stringify(s.collection[t.id])===JSON.stringify(t),'待选择亲本被改变','SAVE');});
    validateTurtle(e.candidate);requireRule(!s.collection[e.candidate.id]&&!s.history[e.candidate.id]&&!e.inputIds.includes(e.candidate.id),'合成结果编号重复','SAVE');
  }
  if(s.bookReveal){
    const e=s.bookReveal;requireRule(!s.run||s.run.phase==='result','进行中对局不能包含局外技能书','SAVE');
    validateSkillBookReceipt(e.receipt);validateTurtle(e.turtle);
    requireRule(e.receipt.turtleId===e.turtle.id&&JSON.stringify(e.receipt.afterSkills)===JSON.stringify(e.turtle.skills)
      &&JSON.stringify(s.collection[e.turtle.id])===JSON.stringify(e.turtle)&&s.commands[e.commandId]?.kind==='skillBook'
      &&JSON.stringify(s.commands[e.commandId].result)===JSON.stringify(e.receipt),'技能书待揭晓记录损坏','SAVE');
  }
  if(s.endlessBest){requireRule(integer(s.endlessBest.waves,0)&&integer(s.endlessBest.at,0)&&Array.isArray(s.endlessBest.team)&&s.endlessBest.team.length<=5,'无尽纪录损坏','SAVE');s.endlessBest.team.forEach(validateTurtle);}
  for(const result of Object.values(s.results)){
    if(result.mode!==undefined)requireRule(result.mode==='chapter'||result.mode==='endless','结算模式损坏','SAVE');
    validateSkillBookInventory(result.skillBooks);
    if(result.stages!==undefined){requireRule(Array.isArray(result.stages),'阶段收据损坏','SAVE');for(const row of result.stages){requireRule(integer(row.wave,1)&&Array.isArray(row.grants),'阶段奖励损坏','SAVE');row.grants.forEach(validateGrant);}}
    if(result.broughtIds!==undefined)requireRule(Array.isArray(result.broughtIds)&&new Set(result.broughtIds).size===result.broughtIds.length&&result.broughtIds.every(id=>typeof id==='string'),'带回记录损坏','SAVE');
  }
}
export function validateTurtle(t:Turtle):void{
  if(t)validateDevelopment(t);
  requireRule(t&&typeof t.id==='string'&&t.id.length>0&&ROLES[t.role],'龟资料不完整','SAVE');
  const allowed=skillsForRole(t.role,true);
  requireRule(Array.isArray(t.skills)&&t.skills.length>=1&&t.skills.length<=12&&new Set(t.skills).size===t.skills.length&&t.skills.every(s=>allowed.includes(s)),'龟技能资料损坏','SAVE');
  requireRule(t.innate&&t.training,'龟天赋资料不完整','SAVE');
  for(const key of ['attack','health','defense','growth'] as const){
    const growth=key==='growth';
    requireRule(integer(t.innate[key],growth?70:60,growth?110:100)&&integer(t.training[key],0,t.development?(growth?20:40):(growth?5:10))&&t.innate[key]+t.training[key]<=(growth?115:110),'龟天赋资料损坏','SAVE');
  }
  requireRule(integer(t.generation,0)&&typeof t.name==='string'&&t.name.length<=16&&Array.isArray(t.parentIds),'龟档案资料损坏','SAVE');
}
function validateShop(s:GameSave):void{
  requireRule(s.economyVersion===undefined||s.economyVersion===2||s.economyVersion===3,'金币版本损坏','SAVE');
  if(!s.shop)return;const shop=s.shop;
  requireRule(Number.isSafeInteger(shop.turtleCount)&&shop.turtleCount>=0&&Number.isSafeInteger(shop.bookCount)&&shop.bookCount>=0,'商城保底计数损坏','SAVE');
  const packIds=['turtleBasic','turtleAdvanced','bookRandom','bookAttack','materialRandom','materialFixed'];
  if(shop.daily){requireRule(/^\d{4}-\d{2}-\d{2}$/.test(shop.daily.day)&&!!shop.daily.counts&&typeof shop.daily.counts==='object','商城每日次数损坏','SAVE');for(const [id,count] of Object.entries(shop.daily.counts))requireRule(packIds.includes(id)&&Number.isInteger(count)&&count>=0&&count<=20,'商城每日次数损坏','SAVE');}
  const p=shop.pending;if(!p)return;
  requireRule(!s.outsideFusion&&!s.bookReveal&&(!s.run||s.run.phase==='result'),'商城揭晓与其他事务冲突','SAVE');
  requireRule(typeof p.id==='string'&&p.id.length>0&&['turtle','book','pack'].includes(p.pool)&&(p.count===1||p.count===10)&&Array.isArray(p.draws)&&(p.pool==='pack'?p.count===1&&packIds.includes(p.packId!)&&p.draws.length>=1&&p.draws.length<=4:p.draws.length===p.count&&p.packId===undefined)&&Number.isSafeInteger(p.cost)&&p.cost>=0&&Number.isSafeInteger(p.at)&&p.at>=0,'商城结果损坏','SAVE');
  const turtleResult=p.pool==='turtle'||p.pool==='pack'&&(p.packId==='turtleBasic'||p.packId==='turtleAdvanced'),materialResult=p.pool==='pack'&&(p.packId==='materialRandom'||p.packId==='materialFixed');
  if(p.pool==='pack'){requireRule(p.draws.every(d=>d.guarantee==='normal')&&(materialResult||p.draws.length===1),'礼包结果损坏','SAVE');if(materialResult)requireRule(new Set(p.draws.map(d=>d.material)).size===p.draws.length&&p.draws.reduce((sum,d)=>sum+(d.amount??0),0)===(p.packId==='materialFixed'?32:20)&&(p.packId!=='materialFixed'||p.draws.length===4&&p.draws.every(d=>d.amount===8)),'材料礼包份数损坏','SAVE');}
  for(const draw of p.draws){
    requireRule(['normal','ten','hundred'].includes(draw.guarantee),'商城保底记录损坏','SAVE');
    if(turtleResult){requireRule(!!draw.turtle&&!draw.skillId&&!draw.material,'商城伙伴结果损坏','SAVE');validateTurtle(draw.turtle!);requireRule(!!s.collection[draw.turtle!.id],'商城伙伴未入收藏','SAVE');}
    else if(materialResult)requireRule(!draw.turtle&&!draw.skillId&&['attack','health','defense','growth'].includes(draw.material!)&&Number.isSafeInteger(draw.amount)&&draw.amount!>0&&s.materials[draw.material!]>=draw.amount!,'商城材料未入库存','SAVE');
    else requireRule(!draw.turtle&&!draw.material&&SKILLS.some(x=>x.id===draw.skillId)&&(s.skillBooks?.[draw.skillId!]??0)>0,'商城技能书未入库存','SAVE');
  }
}
export function validateSave(s:GameSave):void{

  validateSaveState(s,false);
}
function validateSaveState(s:GameSave,allowLegacyLayoutSlots:boolean):void{
  if(s.solo){const v=s.solo;requireRule(v.version===1&&[1,2,3].includes(v.difficulty)&&Array.isArray(v.best)&&v.best.length===3&&v.best.every(n=>integer(n,0))&&Array.isArray(v.claims)&&new Set(v.claims).size===v.claims.length&&v.claims.every(x=>typeof x==='string')&&Array.isArray(v.testPackClaims),'单机进度损坏','SAVE');}
  if(s.collectionOrder!==undefined)requireRule(Array.isArray(s.collectionOrder)&&s.collectionOrder.length<=10000&&new Set(s.collectionOrder).size===s.collectionOrder.length&&s.collectionOrder.every(id=>typeof id==='string'&&id.length>0&&id.length<200),'伙伴排序资料损坏','SAVE');
  if(s.homeTeam!==undefined)requireRule(Array.isArray(s.homeTeam)&&s.homeTeam.length>0&&s.homeTeam.length<=5&&new Set(s.homeTeam).size===s.homeTeam.length&&s.homeTeam.every(id=>typeof id==='string'&&id.length>0&&id.length<200),'首发阵容资料损坏','SAVE');
  if(s.avatar)requireRule(!!ROLES[s.avatar.role]&&(s.avatar.image===undefined||typeof s.avatar.image==='string'&&s.avatar.image.length<=360000&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.avatar.image)),'头像资料损坏','SAVE');
  requireRule(s&&s.schema===1&&integer(s.revision,0)&&integer(s.idCounter,0)&&integer(s.rng,0,4294967295),'存档版本或随机状态不正确','SAVE');
  validateShop(s);
  validatePatrol(s,validateTurtle);
  requireRule(integer(s.gold,0)&&integer(s.stamina,0,30)&&integer(s.staminaAt,0)&&integer(s.clockHighWater,0),'金币或体力资料损坏','SAVE');
  requireRule(s.settings?.autoSkills===undefined||typeof s.settings.autoSkills==='boolean','自动施法设置损坏','SAVE');
  requireRule(s.settings?.manualSkillTurtles===undefined||Array.isArray(s.settings.manualSkillTurtles)&&s.settings.manualSkillTurtles.length<=100&&s.settings.manualSkillTurtles.every(id=>typeof id==='string'&&id.length<128),'手动技能设置损坏','SAVE');
  requireRule(integer(s.capacity,1,1000)&&s.collection&&s.history&&s.commands&&s.results,'存档缺少档案区域','SAVE');
  requireRule(integer(s.unlockedLevel,0,LEVELS.length-1)&&Array.isArray(s.cleared)&&new Set(s.cleared).size===s.cleared.length&&s.cleared.every(n=>integer(n,0,LEVELS.length-1)),'关卡进度损坏','SAVE');
  requireRule(typeof s.tutorialStarted==='boolean'&&typeof s.tutorialDone==='boolean','教学进度损坏','SAVE');
  requireRule(s.settings&&Number.isFinite(s.settings.music)&&s.settings.music>=0&&s.settings.music<=1&&Number.isFinite(s.settings.effects)&&s.settings.effects>=0&&s.settings.effects<=1,'声音设置损坏','SAVE');
  for(const m of ['attack','health','defense','growth'] as const)requireRule(s.materials&&integer(s.materials[m],0),'培养材料资料损坏','SAVE');
  validateSkillBookInventory(s.skillBooks);
  for(const result of Object.values(s.results))validateMaterialReceipt(result);
  for(const receipt of Object.values(s.commands))if(receipt.kind==='abandon')validateMaterialReceipt(receipt.result);
  for(const receipt of Object.values(s.commands))if(receipt.kind==='skillBook')validateSkillBookReceipt(receipt.result);
  validatePrototypeState(s);validateCommunity(s,validateTurtle);validateProgression(s);validateMailbox(s);for(const mail of s.mailbox?.items??[])if(mail.pets){requireRule(Array.isArray(mail.pets)&&mail.pets.length<=5,'邮件伙伴损坏','SAVE');mail.pets.forEach(validateTurtle);}validateTaskJournal(s);requireRule(s.livingVersion===undefined||s.livingVersion===1,'成长版本损坏','SAVE');if(s.bookPacks)for(const [grade,count] of Object.entries(s.bookPacks))requireRule(!!PACK_NAMES[grade as keyof typeof PACK_NAMES]&&integer(count,0),'技能礼包背包损坏','SAVE');
  requireRule(Object.keys(s.collection).length<=Math.max(s.capacity,s.legacyCollectionAllowance??0),'收藏数量超出上限','SAVE');
  for(const [id,t] of Object.entries(s.collection)){validateTurtle(t);requireRule(id===t.id&&!s.history[id],'收藏和历史档案冲突','SAVE');}
  for(const [id,h] of Object.entries(s.history)){validateTurtle(h.turtle);requireRule(id===h.turtle.id&&!!h.replacementId&&!!h.eventId,'历史档案缺少来源','SAVE');}
  requireRule(s.dailyAds&&typeof s.dailyAds.day==='string'&&integer(s.dailyAds.total,0,6),'每日奖励资料损坏','SAVE');
  let adTotal=0;
  for(const kind of ['stamina','doubleGold','refresh'] as const){requireRule(integer(s.dailyAds.counts[kind],0,3),'奖励次数损坏','SAVE');adTotal+=s.dailyAds.counts[kind];}
  requireRule(adTotal===s.dailyAds.total,'奖励总次数不一致','SAVE');
  if(s.run){
    const r=s.run, slots=new Set<number>(),sources=new Set<string>(),benchSlots=new Set<number>();
    validateContributions(r.contributions);
    requireRule(r.rulesVersion===undefined||r.rulesVersion==='0.6'&&s.rulesVersion==='0.6','本局玩法版本损坏','SAVE');
    const v06=r.rulesVersion==='0.6',finished=s.rulesVersion==='0.6'&&r.phase==='result';
    if(r.bossRescuedWaves!==undefined)requireRule(Array.isArray(r.bossRescuedWaves)&&r.bossRescuedWaves.length<=5&&new Set(r.bossRescuedWaves).size===r.bossRescuedWaves.length&&r.bossRescuedWaves.every(w=>integer(w,1,5)),'解救记录损坏','SAVE');
    if(r.waveLimit!==undefined)requireRule(v06&&r.mode==='chapter'&&(r.expedition?[10,15,20].includes(r.waveLimit):(r.waveLimit===5||r.levelId>0&&r.waveLimit===8))&&r.wave<=r.waveLimit,'本局波数损坏','SAVE');
    requireRule(!!BATTLE_MAPS[r.levelId]&&integer(r.wave,0,r.expedition||v06&&r.mode==='endless'?Number.MAX_SAFE_INTEGER:BATTLE_MAPS[r.levelId].waves)&&integer(r.coreHealth,0,20)&&integer(r.goldEarned,0),'本局进度损坏','SAVE');
    if(v06){
      requireRule((r.mode==='chapter'||r.mode==='endless')&&(r.speed===1||r.speed===2),'新版挑战资料损坏','SAVE');
      requireRule(Array.isArray(r.rewardNodes)&&Array.isArray(r.rewardLedger),'资源奖励账本缺失','SAVE');
      const waves=new Set<number>();
      for(const node of r.rewardNodes){
        requireRule(r.mode==='endless'&&integer(node.wave,1,r.wave)&&node.wave%5===0&&!waves.has(node.wave)&&Array.isArray(node.choices)&&node.choices.length===5,'奖励候选损坏','SAVE');waves.add(node.wave);node.choices.forEach(validateGrant);
        if(node.chosen!==undefined)requireRule(integer(node.chosen,0,4),'奖励选择损坏','SAVE');
        if(node.randomIndex!==undefined)requireRule(integer(node.randomIndex,0,4)&&(node.format==='stop-and-open'||node.chosen===undefined||node.chosen===node.randomIndex),'随机奖励结果损坏','SAVE');
        const entries=r.rewardLedger.filter(e=>e.source==='choice'&&e.wave===node.wave);
        if(node.format==='stop-and-open'){
          requireRule(Array.isArray(node.opened)&&node.opened.length<=5&&new Set(node.opened).size===node.opened.length&&node.opened.every(i=>integer(i,0,4))&&typeof node.closed==='boolean'&&typeof node.drawing==='boolean'&&integer(node.spentGold,0),'开奖记录损坏','SAVE');
          requireRule(node.chosen===node.opened[0]&&(!node.closed||!node.drawing)&&(!node.drawing||node.randomIndex!==undefined&&!node.opened.includes(node.randomIndex))&&(node.opened.length<5||node.closed),'开奖阶段损坏','SAVE');
          requireRule(entries.length===node.opened.length&&entries.every((e,i)=>e.index===node.opened![i]&&JSON.stringify(e.grant)===JSON.stringify(node.choices[e.index!])),'开奖与奖励账本不一致','SAVE');
          const costs=[0,20,35,55,80],max=costs.slice(0,node.opened.length+(node.drawing?1:0)).reduce((a,b)=>a+b,0);
          requireRule(node.spentGold!<=goldAmount(s,max),'开奖费用损坏','SAVE');
        }else{
          requireRule(node.format===undefined,'奖励格式不受支持','SAVE');
          requireRule(node.chosen===undefined?entries.length===0:entries.length===1&&JSON.stringify(entries[0].grant)===JSON.stringify(node.choices[node.chosen]),'奖励选择与账本不一致','SAVE');
        }
      }
      for(const entry of r.rewardLedger){requireRule(r.mode==='endless'&&integer(entry.wave,1,r.wave)&&(entry.source==='stage'&&entry.wave%10===0||entry.source==='choice'&&waves.has(entry.wave)),'奖励账本节点损坏','SAVE');validateGrant(entry.grant);}
      if(r.resumeAfterReveal!==undefined)requireRule(r.phase==='reveal'&&['prep','between','combat'].includes(r.resumeAfterReveal),'揭晓恢复阶段损坏','SAVE');
    }
    requireRule(['prep','combat','between','reveal','result'].includes(r.phase)&&Array.isArray(r.usedSources)&&new Set(r.usedSources).size===r.usedSources.length,'本局状态损坏','SAVE');
    requireRule(Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed).length<=(r.expedition?expeditionSlots(r.levelId).length+5:10),'本局伙伴超过十只','SAVE');
    requireRule(Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot===null).length<=5,'替补超过五只','SAVE');
    for(const [id,u] of Object.entries(r.units)){
      validateTurtle(u.turtle);
      requireRule(id===u.id&&integer(u.level,1,50)&&Array.isArray(u.sources)&&new Set(u.sources).size===u.sources.length,'本局伙伴资料损坏','SAVE');
      if(u.placement!==undefined)requireRule(!groundIssue((r.mapVersion===6?BATTLE_MAPS:r.mapVersion===5?LEGACY_PAINTED_MAPS:LEGACY_EXPANDED_MAPS)[r.levelId],u.placement),'自由落点无效','SAVE');
      if(u.fallen!==undefined)requireRule(typeof u.fallen==='boolean','倒下状态损坏','SAVE');
      if(u.sleepUntilWave!==undefined)requireRule(integer(u.sleepUntilWave,1),'沉睡波次损坏','SAVE');
      if(u.consumedBy){requireRule(!!r.merges[u.consumedBy],'合成消耗记录丢失','SAVE');continue;}
      if(u.removed){requireRule(v06&&['refresh','replaced','discard'].includes(u.removed)&&u.slot===null&&u.benchSlot===undefined,'离场记录损坏','SAVE');continue;}
      if(u.slot!==null){requireRule(integer(u.slot,0,(r.expedition?expeditionSlots(r.levelId):BATTLE_MAPS[r.levelId].slots).length-1)&&!slots.has(u.slot)&&slots.size<(r.expedition?expeditionSlots(r.levelId).length:5),'布阵位置重复或超过五只','SAVE');slots.add(u.slot);}
      if(v06){
        if(u.slot===null){requireRule(integer(u.benchSlot,0,4)&&!benchSlots.has(u.benchSlot!)&&typeof u.benchLocked==='boolean','备战槽损坏','SAVE');benchSlots.add(u.benchSlot!);}
        else requireRule(u.benchSlot===undefined,'在场伙伴不能占用备战槽','SAVE');
      }else requireRule(u.benchSlot===undefined&&!u.removed,'旧对局包含新版备战资料','SAVE');
      for(const source of u.sources){requireRule((finished||s.collection[source])&&!sources.has(source),'永久来源丢失或被重复使用','SAVE');sources.add(source);}
      if(u.loanId)requireRule(v06&&!u.savedId&&!u.sources.length&&s.community?.loans.some(l=>l.id===u.loanId&&l.turtle.id===u.turtle.id&&l.usedBy===r.id),'借用来源损坏','SAVE');
      if(u.savedId)requireRule((finished||s.collection[u.savedId])&&u.sources.length===1&&u.sources[0]===u.savedId&&u.turtle.id===u.savedId,'已收录伙伴来源错误','SAVE');
    }
    requireRule(!fieldIssue((r.mapVersion===6?BATTLE_MAPS:r.mapVersion===5?LEGACY_PAINTED_MAPS:LEGACY_EXPANDED_MAPS)[r.levelId],Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot!==null) as {slot:number;placement?:import('./types').Point}[]),'自由布阵重叠或非法','SAVE');
    if(r.pendingMergeId)requireRule(r.phase==='reveal'&&r.merges[r.pendingMergeId]&&!r.merges[r.pendingMergeId].revealed,'揭晓记录错误','SAVE');
    requireRule(r.phase!=='reveal'||!!r.pendingMergeId,'揭晓缺少固定结果','SAVE');
    if(r.phase==='combat'||r.expedition&&r.phase==='prep'||v06&&r.phase==='reveal'&&r.resumeAfterReveal==='combat'){
      if(allowLegacyLayoutSlots)validateBattleForSaveDecode(r.battle);else validateBattle(r.battle);
      requireRule(r.battle.levelId===r.levelId&&(r.expedition?r.battle.expedition?.completed===r.wave:r.battle.wave===r.wave+1)&&r.battle.coreHealth<=r.coreHealth,'战斗快照与本局进度不一致','SAVE');
      requireRule(r.battle.rulesVersion===r.rulesVersion&&(!v06||r.battle.mode===r.mode),'战斗快照玩法版本不一致','SAVE');
      const field=Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot!==null).map(u=>u.id).sort();
      requireRule(JSON.stringify(r.battle.units.map(u=>u.id).sort())===JSON.stringify(field),'战斗快照与布阵不一致','SAVE');
      for(const unit of r.battle.units){
        const source=r.units[unit.id];requireRule(JSON.stringify(source?.placement)===JSON.stringify(unit.placement),'战斗自由落点与本局不一致','SAVE');
        requireRule(source&&!source.consumedBy&&source.slot===unit.slot&&source.turtle.id===unit.turtleId,'战斗快照与伙伴站位或档案不一致','SAVE');
      }
      for(const unit of r.battle.benchUnits??[]){
        const source=r.units[unit.id];
        requireRule(source&&!source.consumedBy&&!source.removed&&source.slot===null&&source.benchSlot!==undefined&&source.turtle.id===unit.turtleId,'备战快照与伙伴不一致','SAVE');
      }
    }
    for(const e of Object.values(r.merges))requireRule(r.units[e.outputId]&&e.inputIds.every(id=>r.units[id]?.consumedBy===e.id)&&e.originalSources.length===new Set(e.originalSources).size,'合成来源记录错误','SAVE');
  }
}
/** Damage detection only; a checksum does not provide anti-cheat or authentication. */
function checksum(payload:string):string{
  let h=2166136261;
  for(let i=0;i<payload.length;i++)h=Math.imul(h^payload.charCodeAt(i),16777619);
  return (h>>>0).toString(16).padStart(8,'0');
}
export function encodeSave(save:GameSave):string{const payload=JSON.stringify(save);return JSON.stringify({format:1,payload,checksum:checksum(payload)});}
export function decodeSave(raw:string):GameSave{
  const envelope=JSON.parse(raw);
  requireRule(envelope.format===1&&typeof envelope.payload==='string'&&envelope.checksum===checksum(envelope.payload),'存档校验失败','SAVE');
  const save=JSON.parse(envelope.payload) as GameSave;
  // Checksum is verified before the narrowly scoped known-geometry migration.
  // Full structure, economy, roster and combat invariants are checked immediately afterward.
  // The parsed object is independent of loadedRaw; reading never writes or increments revision.
  migrateSceneSave(save);
  validateSaveState(save,true);
  if(save.run?.phase==='combat')migrateLegacyLayoutCoordinates(save.run.battle!);
  validateSave(save);return save;
}
export class SaveRepository {
  private static committing=new WeakSet<KeyValueStorage>();
  recoveredFromBackup=false;
  private loadedRaw:string|null=null;
  private committed:GameSave|null=null;
  constructor(private readonly storage:KeyValueStorage){}
  open(create:()=>GameSave):GameSave{
    const raw=this.storage.getItem(SAVE_KEY),backup=this.storage.getItem(BACKUP_KEY);this.loadedRaw=raw;
    if(raw){try{this.committed=decodeSave(raw);}catch{/* Try the previous committed snapshot. */}}
    if(!this.committed&&backup){try{this.committed=decodeSave(backup);this.recoveredFromBackup=true;}catch{/* Preserve damaged saves for explicit recovery. */}}
    if(!this.committed){
      requireRule(raw===null&&backup===null,'本地存档和备份均无法读取。资料已保留，请先导出修复，不会自动清空。','SAVE_RECOVERY');
      const fresh=create();validateSave(fresh);const encoded=encodeSave(fresh);
      this.storage.setItem(SAVE_KEY,encoded);this.loadedRaw=encoded;this.committed=copy(fresh);
    }
    return copy(this.committed);
  }
  commit(next:GameSave):void{
    requireRule(!SaveRepository.committing.has(this.storage),'存档正在由另一个操作提交，请稍后重试。','SAVE_CONFLICT');
    SaveRepository.committing.add(this.storage);
    try{
    requireRule(this.committed,'存档尚未打开','SAVE');validateSave(next);
    requireRule(next.revision===this.committed.revision+1,'存档版本冲突','SAVE_CONFLICT');
    requireRule(this.storage.getItem(SAVE_KEY)===this.loadedRaw,'另一个页面已经更新存档，请重新打开本页面。','SAVE_CONFLICT');
    const encoded=encodeSave(next);
    // The primary key is the commit point. Before it succeeds, the in-memory save stays unchanged.
    this.storage.setItem(BACKUP_KEY,encodeSave(this.committed));
    this.storage.setItem(SAVE_KEY,encoded);
    this.loadedRaw=encoded;this.committed=copy(next);
    }finally{SaveRepository.committing.delete(this.storage);}
  }
}
