'use strict';
const clone=require('./clone.cjs'),{isDeepStrictEqual}=require('node:util');
const check=(v,m)=>{if(!v)throw Error(m);};
const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='combatInputs'?undefined:v));
const same=(a,b)=>isDeepStrictEqual(normalized(a),normalized(b));
function createCombatVerifier(core,slot,now){
 const battle=require(core+'/battle.js'),arena=require(core+'/arena.js'),raid=require(core+'/raids.js');
 let ticks=0,inputs=0,fresh=false;
 function replay(current,next,kind){
  check(current&&next,'战斗检查点不存在，请重新进入挑战');
  const result=clone(current),b=kind==='battle'?result:result.battle,target=kind==='battle'?next:next.battle;
  check(b&&target&&Number.isSafeInteger(target.tick)&&target.tick>=b.tick,'战斗时间倒退或对局不匹配');
  const tape=target.combatInputs;
  check(Array.isArray(tape)&&tape.length<=8192,'缺少战斗操作记录，请更新游戏后重新开始挑战');
  b.combatInputs=undefined;
  const before=b.tick;
  for(const input of tape){
   check(++inputs<=30000,'本次同步的战斗操作过多，请分段同步');
   check(input&&Array.isArray(input.args)&&input.args.length<=4,'战斗操作格式错误');
   const settings=input.settings??{};
   check(settings.auto===undefined||typeof settings.auto==='boolean','自动技能设置无效');
   check(settings.manual===undefined||Array.isArray(settings.manual)&&settings.manual.length<=25&&settings.manual.every(x=>typeof x==='string'&&x.length<=160),'保留技能设置无效');
   check(settings.held===undefined||Array.isArray(settings.held)&&settings.held.length<=5&&settings.held.every(x=>['stone','spike','crystal','leaf','bubble'].includes(x)),'保留职业设置无效');
   if(settings.auto===undefined)delete b.autoSkills;else b.autoSkills=settings.auto;
   if(settings.manual===undefined)delete b.manualSkillTurtles;else b.manualSkillTurtles=clone(settings.manual);
   if(b.expedition){if(settings.held===undefined)delete b.expedition.heldRoles;else b.expedition.heldRoles=clone(settings.held);}
   const args=[...input.args];
   // JSON encodes an optional array argument as null. Clearing focus is an
   // explicit supported action, not a client-supplied result.
   if(input.op==='focusBattle'&&args[0]===null)args[0]=undefined;
   if(input.op==='settings'){check(!args.length,'技能设置无效');}
   else if(input.op==='getBattleEvents'){check(!args.length,'事件读取无效');battle.getBattleEvents(b);}
   else if(['commandBattle','focusBattle','commandAllSkills'].includes(input.op)){
    if(input.op==='commandBattle')check(args.length===1&&args[0]?.type==='cast','技能指令无效');
    if(kind==='arena')arena.withArenaPlayer(result,x=>battle[input.op](x,...args));else battle[input.op](b,...args);
   }else if(input.op===({battle:'stepBattle',raid:'stepRaid',arena:'stepArena'})[kind]){
    check(args.length===1&&Number.isFinite(args[0])&&args[0]>=0&&args[0]<=2,'战斗时间步无效');
    check(ticks+(b.tick-before)+Math.ceil(args[0]*20)<=20000,'单次战斗重放过长，请先同步');
    (kind==='battle'?battle:kind==='raid'?raid:arena)[input.op](result,args[0]);
   }else if(kind==='arena'&&['deployArenaPet','setArenaAutoDeploy'].includes(input.op)){
    check(args.length===1&&(input.op==='setArenaAutoDeploy'?typeof args[0]==='boolean':typeof args[0]==='string'),'派遣指令无效');arena[input.op](result,...args);
   }else if(kind==='raid'&&['swapRaidPet','moveRaidStation'].includes(input.op)){
    check(args[0]===0,'不能控制其他副本成员');raid[input.op](result,...args);
   }else throw Error('不允许的战斗操作');
  }
  check(!fresh||b.tick===before,'请等待服务器确认开战后再继续');ticks+=b.tick-before;
  check(same(result,next),'战斗结果与服务器重放不一致，未发放奖励');
  return result;
 }
 function verify(game,method,args){
  const s=game.snapshot;
  if(['beginWave','beginRaidWave','beginArena','beginArenaPractice','matchArena'].includes(method))fresh=true;
  if(method==='beginWave'){
   const r=s.run;check(r&&args[1]===r.id,'战斗局次不一致');
   let expected;
   if(r.expedition){expected=clone(r.battle);if(r.phase==='prep')expected.events=[];}
   else expected=battle.createBattle(r.levelId,r.wave+1,Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot!==null).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot,placement:u.placement,sleepUntilWave:u.sleepUntilWave,fallen:u.fallen})),{coreHealth:r.coreHealth,waveLimit:r.waveLimit,...(r.rulesVersion==='0.6'?{rulesVersion:'0.6',mode:r.mode}:{})});
   expected.autoSkills=s.settings.autoSkills??false;expected.manualSkillTurtles=[...(s.settings.manualSkillTurtles??[])];
   check(same(expected,args[2]),'开战阵容、随机种子或属性与服务器不一致');args[2]=expected;
  }
  const positions={checkpointBattle:2,completeWave:2,expeditionCommand:3,deployBench:3,placeUnit:3,moveUnit:3,merge:3};
  if(Object.hasOwnProperty.call(positions,method)&&args[positions[method]]){
   const i=positions[method];args[i]=replay(s.run?.battle,args[i],'battle');
  }
  const sessions={checkpointArena:['arena',1],finishArena:['arena',1],checkpointRaid:['raid',1],finishRaid:['raid',1],raidExpeditionCommand:['raid',3]};
  if(sessions[method]){const [kind,i]=sessions[method];if(args[i])args[i]=replay(s.community?.[kind],args[i],kind);}
 }
 function budget(save){
  const old=slot.combatBudget??{at:slot.at,credit:0},earned=old.active?Math.max(0,now-old.at)/1000*2:0;
  const credit=Math.min(600,(old.credit??0)+earned);
  check(ticks*.05<=credit+2,'战斗推进超过服务器允许的2倍速度，请校准时间后重试');
  const active=save.run?.phase==='combat'||save.community?.raid?.phase==='combat'||save.community?.arena?.phase==='combat';
  return {at:now,credit:fresh?0:credit-ticks*.05,active:!!active};
 }
 return {verify,budget};
}
module.exports={createCombatVerifier};
