const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { GameService } = require('../.test-build/core/game.js');
const { SaveRepository, SAVE_KEY, encodeSave, validateSave } = require('../.test-build/core/save.js');
const { MemoryStorage } = require('../.test-build/platform/storage.js');
const { createBattle, stepBattle, getBattleEvents } = require('../.test-build/core/battle.js');
const { LEVELS, ECONOMY } = require('../.test-build/core/data.js');

const ORDER = ['spike','stone','crystal','leaf','bubble'];
const SLOTS = { spike:0, stone:1, crystal:2, leaf:3, bubble:4 };
const START = Date.UTC(2026,8,8,0,0,0);
const clone = value => JSON.parse(JSON.stringify(value));

function harness(seed=731, initial) {
  const storage=new MemoryStorage();
  if(initial)storage.setItem(SAVE_KEY,encodeSave(initial));
  const clock={value:START,now(){return this.value;}};
  let serial=0;
  const h={storage,clock,seed,service:new GameService(new SaveRepository(storage),clock,seed),command:label=>`sim:${seed}:${++serial}:${label}`};
  h.restart=()=>{h.service=new GameService(new SaveRepository(storage),clock,seed);};
  return h;
}

function selected(h) {
  const collection=Object.values(h.service.snapshot.collection);
  return ORDER.map(role=>collection.filter(t=>t.role===role).sort((a,b)=>b.skills.length-a.skills.length||a.id.localeCompare(b.id))[0]?.id).filter(Boolean);
}
function arrange(h) {
  const units=Object.values(h.service.snapshot.run.units).filter(u=>!u.consumedBy);
  for(const unit of units)h.service.moveUnit(h.command('move'),unit.id,SLOTS[unit.turtle.role]);
}

/** Uses only service transactions for recruitment, levels, rewards, checkpoints and collection. */
function simulateLevel(h,levelId) {
  const before=h.service.snapshot;
  if(levelId>before.unlockedLevel)return {levelId,name:LEVELS[levelId].name,notAttempted:'previous level not cleared'};
  const originalSources=selected(h);
  const runId=h.service.beginRun(h.command('beginRun'),levelId,originalSources);
  const report={levelId,name:LEVELS[levelId].name,runId,startingGold:before.gold,startingStamina:before.stamina,waves:[],collected:[],checkpointRestores:0};
  for(let wave=1;wave<=LEVELS[levelId].waves;wave++) {
    arrange(h);
    const run=h.service.snapshot.run;
    const inputs=Object.values(run.units).filter(u=>!u.consumedBy&&u.slot!==null).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot}));
    assert.equal(inputs.length,Math.min(wave,5),'one turtle initially, at most one added between waves');
    let battle=createBattle(levelId,wave,inputs,{seed:(h.seed*10000+levelId*100+wave)>>>0,coreHealth:run.coreHealth});
    h.service.beginWave(h.command('beginWave'),runId,battle);
    stepBattle(battle,2.375);getBattleEvents(battle);
    const checkpointCommand=h.command('checkpoint');h.service.checkpointBattle(checkpointCommand,runId,battle);
    const uninterrupted=clone(battle);h.restart();battle=h.service.snapshot.run.battle;report.checkpointRestores++;
    assert.deepEqual(battle,uninterrupted);
    stepBattle(uninterrupted,300);stepBattle(battle,300);assert.deepEqual(battle,uninterrupted,'service restart must preserve battle trajectory');
    h.clock.value+=Math.round(battle.elapsed*1000);
    const boss=battle.enemies.find(enemy=>enemy.kind==='boss');
    const bossSummary=boss?{defeated:boss.hp<=0,leaked:!boss.alive&&boss.hp>0,remainingHp:boss.hp,maxHp:boss.maxHp,attackCount:boss.attackCount,
      allyHpDamage:battle.events.filter(e=>e.type==='damage'&&e.sourceId===boss.id&&battle.units.some(u=>u.id===e.targetId)).reduce((sum,e)=>sum+(e.amount||0),0),
      downedAllies:battle.units.filter(u=>!u.alive).map(u=>u.role)}:undefined;
    report.waves.push({wave,units:inputs.map(u=>({role:u.turtle.role,level:u.level,slot:u.slot,skills:[...u.turtle.skills]})),seconds:Number(battle.elapsed.toFixed(2)),status:battle.status,coreHealth:battle.coreHealth,kills:battle.kills,leaked:battle.leaked,...(boss?{boss:bossSummary}:{})});
    if(battle.status==='fighting') {
      h.service.checkpointBattle(h.command('stalledCheckpoint'),runId,battle);
      h.service.abandonRun(h.command('stalledAbandon'));
      report.failureWave=wave;report.reason='wave exceeded 302.375 simulated seconds';break;
    }
    const completedCommand=h.command('completeWave');h.service.completeWave(completedCommand,runId,battle);
    const committed=h.service.snapshot;h.service.completeWave(completedCommand,runId,battle);assert.deepEqual(h.service.snapshot,committed,'duplicate completion must not grant resources or levels');
    if(battle.status==='lost'){report.failureWave=wave;report.reason='core destroyed';break;}
    const current=h.service.snapshot.run;
    if(current.phase==='result')break;
    const next=originalSources.find(id=>!current.usedSources.includes(id));
    if(next)h.service.recruit(h.command('recruit'),{permanentId:next});
    h.clock.value+=LEVELS[levelId].preparationSeconds*1000;
  }
  // Only save real local upgrades that the service generated. Each replaces its own source.
  for(const unit of Object.values(h.service.snapshot.run.units).filter(u=>!u.consumedBy&&!u.savedId)) {
    const preview=h.service.collectionPreview(unit.id);
    if(preview.sources.length===1&&unit.turtle.skills.length>preview.sources[0].skills.length) {
      const t=h.service.collect(h.command('collectUpgrade'),unit.id);
      report.collected.push({role:t.role,id:t.id,skills:[...t.skills]});
    }
  }
  const after=h.service.snapshot,result=after.results[runId];
  report.victory=result.victory;report.completedWaves=result.waves;report.coreHealth=after.run.coreHealth;
  report.combatSeconds=Number(result.combatSeconds.toFixed(2));
  report.withPreparationSeconds=Number((result.combatSeconds+Math.max(0,report.waves.length-1)*LEVELS[levelId].preparationSeconds).toFixed(2));
  report.targetSeconds=LEVELS[levelId].targetSeconds;report.durationMeetsTarget=report.withPreparationSeconds>=report.targetSeconds[0]&&report.withPreparationSeconds<=report.targetSeconds[1];
  report.reward={baseGold:result.baseGold,firstClearGold:result.firstClearGold,total:result.baseGold+result.firstClearGold};
  report.endingGold=after.gold;report.endingStamina=after.stamina;report.collectionCount=Object.keys(after.collection).length;report.historyCount=Object.keys(after.history).length;
  validateSave(after);return report;
}

function simulateChapter(seed=731) {
  const h=harness(seed),initial=clone(h.service.snapshot);
  const report={seed,description:'Fresh save: five permanent 2-skill / 76-aptitude / 1.00-growth turtles; one enters first, one per interval; save only real service-generated skill upgrades; no ads or injected stats.',initial: {gold:initial.gold,stamina:initial.stamina,roster:Object.values(initial.collection).map(t=>({role:t.role,skills:t.skills,innate:t.innate}))},levels:[],archives:[]};
  // Historical five-stage calibration; the 50-stage suite is tested independently.
  for(const level of LEVELS.slice(0,5)) {
    const result=simulateLevel(h,level.id);report.levels.push(result);
    if(result.notAttempted)break;
    report.archives.push({levelId:level.id,save:clone(h.service.snapshot),envelope:h.storage.getItem(SAVE_KEY)});
    if(!result.victory)break;
  }
  report.finalSave=clone(h.service.snapshot);return {h,report};
}

function simulateMatureBoss(previous, seed=1731) {
  const save=clone(previous.finalSave);
  const builds={stone:['strong','armor','block','reflect','share','hold'],spike:['swift','critical','combo','lifesteal','piercingShot','reach'],crystal:['bounce','shredResist','spellDrain','crystalCannon','reach'],leaf:['reach','doubleHeal','healShield','cleanse','greatHeal'],bubble:['shredArmor','root','weaken','bubbleRing']};
  if(save.unlockedLevel<4)return {notAttempted:'fresh progression did not unlock the boss; no artificial unlock applied'};
  // Explicit separate fixture, never presented as achievements of the first playthrough.
  for(const turtle of Object.values(save.collection)){turtle.skills=[...builds[turtle.role]];turtle.generation=Math.max(1,turtle.generation);}
  save.commands={};
  const h=harness(seed,save);h.clock.value=save.clockHighWater;const training=[];
  const wants=[['spike','attack'],['crystal','attack'],['spike','attack'],['crystal','attack'],['spike','attack'],['stone','health'],['stone','health'],['stone','defense'],['spike','growth']];
  for(const [role,material] of wants) {
    const current=h.service.snapshot,id=Object.values(current.collection).find(t=>t.role===role).id;
    const cost=material==='growth'?ECONOMY.growthCost:ECONOMY.aptitudeCost;
    if(current.gold>=cost&&current.materials[material]>0){h.service.train(h.command('training'),id,material);training.push({role,material,cost});}
  }
  if(h.service.snapshot.stamina<5){h.clock.value+=5*ECONOMY.staminaIntervalMs;h.service.refreshClock(h.command('rest'))}
  const starting=h.service.snapshot;
  const level=simulateLevel(h,4);
  return {seed,description:'Separate explicit 4–6-skill archive fixture representing later fusion progress; no claim these skills were earned in the first run. Inherited V07 random birth talents; training paid through GameService using only previously earned gold/materials; first wave still one turtle.',training,startingGold:starting.gold,roster:Object.values(starting.collection).map(t=>({role:t.role,skills:t.skills,innate:t.innate,training:t.training})),level,finalSave:h.service.snapshot,envelope:h.storage.getItem(SAVE_KEY)};
}

function main() {
  const fresh=simulateChapter();const mature=simulateMatureBoss(fresh.report);
  const output=path.resolve(__dirname,'../../docs/reports/chapter-simulation');fs.mkdirSync(output,{recursive:true});
  for(const archive of fresh.report.archives){fs.writeFileSync(path.join(output,`fresh-after-level-${archive.levelId}.save.json`),archive.envelope);}
  if(mature.envelope)fs.writeFileSync(path.join(output,'mature-after-boss.save.json'),mature.envelope);
  const report={generatedAt:new Date().toISOString(),fresh:{...fresh.report,archives:fresh.report.archives.map(a=>({levelId:a.levelId,path:`fresh-after-level-${a.levelId}.save.json`}))},mature};
  delete report.fresh.finalSave;delete report.mature.finalSave;delete report.mature.envelope;
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const summary=({levelId,victory,completedWaves,failureWave,combatSeconds,withPreparationSeconds,coreHealth,reward,notAttempted})=>({levelId,victory,completedWaves,failureWave,combatSeconds,withPreparationSeconds,coreHealth,reward,notAttempted});
  console.log(JSON.stringify({fresh:report.fresh.levels.map(summary),mature:report.mature.level?summary(report.mature.level):report.mature,output},null,2));
}
module.exports={harness,simulateLevel,simulateChapter,simulateMatureBoss};
if(require.main===module)main();
