const test=require('node:test');
const assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {SaveRepository,SAVE_KEY,encodeSave,validateSave}=require('../.test-build/core/save.js');
const {createBattle,stepBattle,getBattleEvents,commandBattle}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {currentUnits,pendingTakeaways}=require('../.test-build/core/prototype.js');
const {turtleQuality,BOOK_WEIGHTS,prototypeSpawns,REWARD_WEIGHTS}=require('../.test-build/core/prototypeConfig.js');
const {skillsForRole}=require('../.test-build/core/data.js');
const NOW=1788900000000;
const copy=x=>JSON.parse(JSON.stringify(x));
// Each fixture is isolated memory. Extra capacity/inventory cases are explicit
// rule stimuli; the real-wave cases below use production combat and rewards.
function fixture(edit=()=>{}){
  const storage=new MemoryStorage(),initial=makeInitialSave(NOW,9137);edit(initial);
  storage.setItem(SAVE_KEY,encodeSave(initial));const clock={now:()=>NOW};let game=new GameService(new SaveRepository(storage),clock);
  return {storage,clock,get game(){return game;},restart(){game=new GameService(new SaveRepository(storage),clock);return game;}};
}
function begin(f,mode='chapter'){
  f.game.enablePrototype('v06:on');f.game.beginPrototypeRun('v06:run',0,Object.keys(f.game.snapshot.collection).slice(0,5),mode);
  return f.game.snapshot.run;
}
function startWave(f){const r=f.game.snapshot.run,b=createBattle(r.levelId,r.wave+1,currentUnits(r).filter(u=>u.slot!==null),{coreHealth:r.coreHealth,rulesVersion:'0.6',mode:r.mode,waveLimit:r.waveLimit});f.game.beginWave(`start:${r.id}:${r.wave+1}`,r.id,b);return b;}
function winWave(f){
  const b=startWave(f);for(let n=0;n<600&&b.status==='fighting';n++){
    b.units.forEach(u=>u.skills.forEach(id=>commandBattle(b,{type:'cast',unitId:u.id,skillId:id})));
    stepBattle(b,1);getBattleEvents(b);
  }
  assert.equal(b.status,'won','fixture must win through actual production combat');
  f.game.completeWave(`finish:${f.game.snapshot.run.id}:${b.wave}`,f.game.snapshot.run.id,b);return b;
}
const bench=f=>currentUnits(f.game.snapshot.run).filter(u=>u.benchSlot!==undefined);
function noMutation(f,action){const before=f.game.snapshot,raw=f.storage.getItem(SAVE_KEY);assert.throws(action);assert.deepEqual(f.game.snapshot,before);assert.equal(f.storage.getItem(SAVE_KEY),raw);}

test('new chapter runs pin five waves in all new chapters while old active runs keep their original length',()=>{
  const intro=fixture();assert.equal(begin(intro).waveLimit,5);intro.restart();assert.equal(intro.game.snapshot.run.waveLimit,5);
  const next=fixture(s=>{s.cleared=[0];s.unlockedLevel=1;});next.game.beginPrototypeRun('eight',1,Object.keys(next.game.snapshot.collection));
  assert.equal(next.game.snapshot.run.waveLimit,5);next.restart();validateSave(next.game.snapshot);
  const old=copy(next.game.snapshot);delete old.run.waveLimit;old.run.wave=9;old.run.phase='between';validateSave(old);
  next.storage.setItem(SAVE_KEY,encodeSave(old));assert.equal(next.restart().snapshot.run.wave,9);assert.equal(next.game.snapshot.run.waveLimit,undefined);
  const inputs=currentUnits(next.game.snapshot.run).filter(u=>u.slot!==null);
  assert.doesNotThrow(()=>createBattle(1,10,inputs,{rulesVersion:'0.6',mode:'chapter'}));
  assert.throws(()=>createBattle(1,9,inputs,{rulesVersion:'0.6',mode:'chapter',waveLimit:8}),/本局波数/);
  assert.ok(prototypeSpawns(4,8,false,8).some(s=>s.kind==='boss'),'shortened chapter keeps its final boss');
});

test('V0.6 starts five original individuals on field plus five independent bench slots, and old saves remain recoverable',()=>{
  const f=fixture(),old=f.game.snapshot,run=begin(f);
  assert.equal(run.rulesVersion,'0.6');assert.equal(f.game.snapshot.capacity,50);
  assert.equal(currentUnits(run).filter(u=>u.slot!==null).length,5);assert.equal(bench(f).length,5);
  assert.equal(new Set(currentUnits(run).map(u=>u.turtle.id)).size,10);assert.deepEqual(f.game.snapshot.collection,old.collection);
  assert.equal(f.game.snapshot.stamina,old.stamina);f.restart();validateSave(f.game.snapshot);
});
test('empty original formation is allowed before chapter deployment, but an empty battlefield cannot start',()=>{
  const f=fixture();f.game.beginPrototypeRun('empty:begin',0,[]);assert.equal(bench(f).length,5);
  noMutation(f,()=>f.game.beginWave('empty:start',f.game.snapshot.run.id,createBattle(0,1,[],{rulesVersion:'0.6',mode:'chapter'})));
  f.game.deployBench('empty:deploy',bench(f)[0].id,0);assert.equal(currentUnits(f.game.snapshot.run).filter(u=>u.slot!==null).length,1);
});
test('one real completed wave retains locked bench individuals and refreshes only unlocked or empty slots',()=>{
  const f=fixture();begin(f);const before=bench(f),saved=copy(f.game.snapshot.collection);
  f.game.lockBench('lock:one',before[0].id,true);f.game.deployBench('deploy:one',before[1].id,4);
  assert.equal(bench(f).length,5);assert.ok(bench(f).some(u=>u.savedId&&u.benchLocked));winWave(f);
  const after=bench(f);assert.equal(after.length,5);assert.ok(after.some(u=>u.id===before[0].id));
  for(const old of before.slice(2))assert.ok(!after.some(u=>u.id===old.id));
  assert.deepEqual(f.game.snapshot.collection,saved);f.restart();assert.equal(bench(f).length,5);
});
test('in-wave replacement parks the original; re-entry after save keeps its HP, cooldowns and one-shot skill state',()=>{
  const f=fixture();const run=begin(f),original=currentUnits(run).find(u=>u.slot===0),incoming=bench(f)[0];
  const b=startWave(f);stepBattle(b,3);getBattleEvents(b);
  f.game.deployBench('inwave:deploy',incoming.id,0,b);const after=f.game.snapshot.run;
  assert.equal(after.units[original.id].removed,undefined);assert.equal(after.units[original.id].benchSlot,incoming.benchSlot);assert.ok(after.units[original.id].benchLocked);assert.ok(f.game.snapshot.collection[original.savedId]);
  assert.equal(after.battle.units.length,5);assert.ok(after.battle.benchUnits.some(u=>u.id===original.id));
  assert.ok(after.battle.units.some(u=>u.id===incoming.id));validateBattle(after.battle);f.restart();
  const cached=copy(after.battle.benchUnits.find(u=>u.id===original.id));
  f.game.deployBench('inwave:again',original.id,1,f.game.snapshot.run.battle);
  const restored=f.game.snapshot.run.battle.units.find(u=>u.id===original.id);
  assert.equal(restored.actionUntilTick,after.battle.tick+20);assert.equal(restored.moveReadyTick,after.battle.tick+160);const restoredStats={...restored,slot:cached.slot,x:cached.x,z:cached.z,actionUntilTick:cached.actionUntilTick};delete restoredStats.moveReadyTick;assert.deepEqual(restoredStats,cached);f.restart();
  const resumed=f.game.snapshot.run.battle;stepBattle(resumed,2);validateBattle(resumed);
});
test('bench fusion consumes A and B, leaves one empty slot and persists a fixed result across reveal and restart',()=>{
  const f=fixture();begin(f);const [a,b]=bench(f),collection=copy(f.game.snapshot.collection);
  const child=f.game.merge('bench:fuse',a.id,b.id),fixed=copy(child),rng=f.game.snapshot.rng;
  assert.equal(bench(f).length,4);assert.equal(f.game.snapshot.run.phase,'reveal');f.restart();
  assert.deepEqual(f.game.merge('bench:fuse',a.id,b.id),fixed);assert.equal(f.game.snapshot.rng,rng);
  f.game.reveal('bench:reveal');assert.equal(f.game.snapshot.run.phase,'prep');assert.deepEqual(f.game.snapshot.collection,collection);
  noMutation(f,()=>f.game.merge('bench:reuse',a.id,b.id));
  assert.ok(f.game.snapshot.run.units[child.id].benchLocked);
});
test('fusion during a real wave restores that exact combat checkpoint after revelation',()=>{
  const f=fixture();begin(f);const [a,b]=bench(f),battle=startWave(f);stepBattle(battle,2.5);getBattleEvents(battle);
  f.game.merge('combat:fuse',a.id,b.id,battle);assert.equal(f.game.snapshot.run.resumeAfterReveal,'combat');f.restart();
  f.game.reveal('combat:reveal');assert.equal(f.game.snapshot.run.phase,'combat');assert.deepEqual(f.game.snapshot.run.battle,battle);
});
test('a full real chapter returns only final valid new turtles, never duplicates originals or brings back replaced/refreshed parents',()=>{
  const f=fixture();begin(f);const original=copy(f.game.snapshot.collection),removed=bench(f)[0];
  f.game.deployBench('chapter:deploy',removed.id,4);
  while(f.game.snapshot.run.phase!=='result')winWave(f);
  const s=f.game.snapshot,r=s.run,result=s.results[r.id];assert.equal(result.victory,true);
  const finalNew=currentUnits(r).filter(u=>!Object.hasOwn(original,u.turtle.id));
  assert.equal(result.broughtIds.length,finalNew.length);assert.ok(result.broughtIds.length<=10);
  for(const [id,t] of Object.entries(original))assert.deepEqual(s.collection[id],t);
  for(const id of result.broughtIds)assert.ok(s.collection[id]);
  for(const u of Object.values(r.units).filter(u=>u.removed==='refresh'))assert.ok(!s.collection[u.turtle.id]);
  assert.equal(Object.keys(s.history).length,0);assert.equal(pendingTakeaways(s).length,0);
  f.restart();assert.deepEqual(f.game.snapshot.collection,s.collection);
  f.game.beginPrototypeRun('chapter:second',0,Object.keys(s.collection).slice(-5));assert.equal(f.game.snapshot.run.wave,0);
});
test('abandoning preserves originals and wave gold but gives no chapter turtle carry reward',()=>{
  const f=fixture();begin(f);const collection=copy(f.game.snapshot.collection);winWave(f);
  const result=f.game.abandonRun('loss:end');assert.equal(result.victory,false);assert.equal(result.baseGold,8);
  assert.deepEqual(f.game.snapshot.collection,collection);assert.equal(pendingTakeaways(f.game.snapshot).length,0);
});
test('50 capacity keeps surplus new turtles pending, supports explicit discard, and never erases existing assets',()=>{
  const f=fixture(s=>{for(let i=5;i<49;i++){const t=copy(s.collection['t-1']);t.id=`capacity-${i}`;s.collection[t.id]=t;}});
  const original=copy(f.game.snapshot.collection);begin(f);while(f.game.snapshot.run.phase!=='result')winWave(f);
  assert.equal(Object.keys(f.game.snapshot.collection).length,50);assert.equal(pendingTakeaways(f.game.snapshot).length,4);
  noMutation(f,()=>f.game.beginPrototypeRun('full:next',0,['t-1']));
  noMutation(f,()=>f.game.takeHome('full:claim',pendingTakeaways(f.game.snapshot)[0].id));
  for(const u of pendingTakeaways(f.game.snapshot))f.game.discardTakeaway(`discard:${u.id}`,u.id);
  for(const [id,t] of Object.entries(original))assert.deepEqual(f.game.snapshot.collection[id],t);
  f.game.beginPrototypeRun('full:next',0,['t-1']);
});
test('pre-existing collections over 50 are retained without permission to add more',()=>{
  const f=fixture(s=>{for(let i=5;i<56;i++){const t=copy(s.collection['t-1']);t.id=`old-${i}`;s.collection[t.id]=t;}});
  f.game.enablePrototype('overflow:enable');assert.equal(Object.keys(f.game.snapshot.collection).length,56);assert.equal(f.game.snapshot.capacity,50);
  f.restart();f.game.releaseTurtle('overflow:release','old-55');assert.equal(Object.keys(f.game.snapshot.collection).length,55);
});
for(const choice of ['A','B','C'])test(`outside fusion keeps exactly ${choice}, consumes the other choices, and cannot redraw after restart`,()=>{
  const f=fixture();f.game.enablePrototype('out:on');const original=f.game.snapshot.collection;
  const event=f.game.startOutsideFusion('out:start','t-1','t-2'),rng=f.game.snapshot.rng;f.restart();
  assert.deepEqual(f.game.startOutsideFusion('out:start','t-1','t-2'),event);assert.equal(f.game.snapshot.rng,rng);
  noMutation(f,()=>f.game.train('out:train','t-1','health'));noMutation(f,()=>f.game.beginPrototypeRun('out:run',0,['t-3']));
  noMutation(f,()=>f.game.keepOutsideFusion('out:early',choice));
  f.game.revealOutsideFusion('out:reveal');f.restart();const kept=f.game.keepOutsideFusion('out:keep',choice);
  assert.equal(Object.keys(f.game.snapshot.collection).length,4);assert.equal(Object.keys(f.game.snapshot.history).length,0);
  assert.deepEqual(kept,choice==='C'?event.candidate:original[choice==='A'?'t-1':'t-2']);
  const committed=f.game.snapshot;f.restart();assert.deepEqual(f.game.keepOutsideFusion('out:keep',choice),kept);assert.deepEqual(f.game.snapshot,committed);
  noMutation(f,()=>f.game.startOutsideFusion('out:reuse','t-1','t-2'));
});
test('skill-book outcome is fixed and saved before reveal; restart and skipped animation cannot reroll it',()=>{
  const f=fixture(s=>{s.skillBooks={hold:2};s.collection['t-1'].skills=['strong','armor'];});f.game.enablePrototype('book:on');
  const receipt=f.game.learnSkillBook('book:learn','t-1','hold'),after=f.game.snapshot;
  assert.deepEqual(after.bookReveal.receipt,receipt);assert.equal(after.skillBooks.hold,1);f.restart();
  noMutation(f,()=>f.game.beginPrototypeRun('book:run',0,['t-1']));
  f.game.finishBookReveal('book:done');assert.equal(f.game.snapshot.bookReveal,undefined);assert.equal(f.game.snapshot.rng,after.rng);
  assert.deepEqual(f.game.learnSkillBook('book:learn','t-1','hold'),receipt);assert.equal(f.game.snapshot.skillBooks.hold,1);
});
test('quality is a configurable display reference; rename and quality evaluation never mutate skills or probabilities',()=>{
  const f=fixture(),t=f.game.snapshot.collection['t-1'],before=copy(t),quality=turtleQuality(t);
  assert.ok(quality.tier>=0&&quality.tier<=4);assert.deepEqual(t,before);
  f.game.rename('name:change',t.id,'岩岩');assert.deepEqual(turtleQuality(f.game.snapshot.collection[t.id]),quality);
  assert.equal(Object.values(REWARD_WEIGHTS).reduce((a,b)=>a+b,0),100);
  assert.ok(new Set(Object.values(BOOK_WEIGHTS).map(w=>w.normal)).size>3);
  assert.ok(prototypeSpawns(4,40,true)[0].hpScale>prototypeSpawns(4,10,true)[0].hpScale);
});
test('a real starter-team endless run chooses fixed rewards, earns a stage book, dies, saves resources, learns and starts again',()=>{
  // Only the already-cleared entry prerequisite is supplied; turtles, stats,
  // waves, drop weights and rewards are unchanged production initial values.
  const f=fixture(s=>{s.cleared=[0,1];s.unlockedLevel=2;s.tutorialDone=true;s.tutorialStarted=true;});
  f.game.enablePrototype('v06:on');f.game.enableIncrement('current-economy-and-rewards');
  const initial=copy(f.game.snapshot);begin(f,'endless');assert.equal(f.game.snapshot.stamina,initial.stamina);
  let selectedCount=0;
  for(let wave=1;wave<=80&&f.game.snapshot.run.phase!=='result';wave++){
    const b=startWave(f);
    for(let second=0;second<900&&b.status==='fighting';second++){
      b.units.forEach(u=>u.skills.forEach(id=>commandBattle(b,{type:'cast',unitId:u.id,skillId:id})));
      stepBattle(b,1);getBattleEvents(b);
    }
    assert.notEqual(b.status,'fighting');const runId=f.game.snapshot.run.id;
    f.game.completeWave(`endless:complete:${wave}`,runId,b);
    const node=f.game.snapshot.run.rewardNodes.find(n=>n.chosen===undefined);
    if(node){
      assert.equal(node.choices.length,5);const fixed=copy(node),beforeRng=f.game.snapshot.rng;f.restart();
      assert.deepEqual(f.game.snapshot.run.rewardNodes.find(n=>n.wave===node.wave),fixed);
      noMutation(f,()=>f.game.abandonRun(`endless:pending:${wave}`));
      const index=(node.randomIndex+1)%5;
      const grant=f.game.chooseEndlessReward(`endless:choice:${wave}`,wave,index),committed=f.game.snapshot;
      assert.deepEqual(grant,node.choices[node.randomIndex],'caller choice cannot override the pre-saved random result');
      assert.equal(committed.rng,beforeRng);f.restart();
      assert.deepEqual(f.game.chooseEndlessReward(`endless:choice:${wave}`,wave,index),grant);
      assert.deepEqual(f.game.snapshot,committed);f.game.closeEndlessReward(`endless:forfeit:${wave}`,wave);selectedCount++;
    }
  }
  const s=f.game.snapshot,r=s.run,result=s.results[r.id];assert.equal(r.phase,'result');assert.equal(result.victory,false);
  // Multi-direction defense changes the fixed starter team's ceiling. Still
  // require actual completion of a book milestone and multiple reward boards.
  assert.ok(result.waves>=10,`starter wave ${result.waves}`);assert.ok(selectedCount>=2);assert.ok(result.stages.some(row=>row.grants.some(g=>g.kind==='book'&&g.pack==='ordinary')));
  assert.equal(result.bestWave,result.waves);assert.equal(s.endlessBest.waves,result.waves);assert.equal(s.stamina,initial.stamina);
  assert.deepEqual(s.collection,initial.collection);assert.equal(pendingTakeaways(s).length,0);
  assert.equal(s.gold,initial.gold+result.baseGold);
  for(const key of ['attack','health','defense','growth'])assert.equal(s.materials[key],initial.materials[key]+(result.materials[key]??0));
  assert.ok(Object.values(result.skillBooks).reduce((a,b)=>a+b,0)>=1);f.restart();
  assert.deepEqual(f.game.abandonRun('endless:duplicate-end'),result);
  const book=Object.keys(s.skillBooks).find(id=>s.skillBooks[id]>0&&Object.values(s.collection).some(t=>skillsForRole(t.role).includes(id)&&!t.skills.includes(id)));
  assert.ok(book,'this deterministic real run must have an applicable earned book');
  const turtle=Object.values(s.collection).find(t=>skillsForRole(t.role).includes(book)&&!t.skills.includes(book));
  const learned=f.game.learnSkillBook('endless:learn-earned',turtle.id,book);f.restart();f.game.finishBookReveal('endless:reveal-earned');
  // Random boards may grant only books/coins before defeat; retained starter
  // food remains usable and its conservation is checked above.
  const material=['attack','health','defense'].find(m=>result.materials[m]>0)??['attack','health','defense'].find(m=>initial.materials[m]>0);
  assert.ok(material);f.game.train('endless:train-earned',turtle.id,material);f.restart();
  const trained=f.game.snapshot.collection[turtle.id];assert.equal(trained.training[material],turtle.training[material]+1);
  assert.deepEqual(trained.skills,learned.afterSkills);
  f.game.beginPrototypeRun('endless:second',4,[turtle.id],'endless');assert.deepEqual(currentUnits(f.game.snapshot.run)[0].turtle,trained);
});
test('outside fusion write failure preserves both parents and retries the same seed once',()=>{
  const f=fixture();f.game.enablePrototype('write:on');const before=f.game.snapshot,raw=f.storage.getItem(SAVE_KEY),set=f.storage.setItem.bind(f.storage);let fail=true;
  f.storage.setItem=(key,value)=>{if(key===SAVE_KEY&&fail){fail=false;throw new Error('disk full');}set(key,value);};
  assert.throws(()=>f.game.startOutsideFusion('write:start','t-1','t-2'),/disk full/);
  assert.deepEqual(f.game.snapshot,before);assert.equal(f.storage.getItem(SAVE_KEY),raw);f.restart();
  const e=f.game.startOutsideFusion('write:start','t-1','t-2');f.restart();assert.deepEqual(f.game.startOutsideFusion('write:start','t-1','t-2'),e);
});
test('one simulation second at 2X equals two at 1X, without additional attacks or wave rewards',()=>{
  const f=fixture();begin(f);const a=startWave(f),b=copy(a);
  for(let i=0;i<200;i++)stepBattle(a,.05);
  for(let i=0;i<100;i++)stepBattle(b,.1);
  assert.deepEqual(a,b);const before=f.game.snapshot;
  f.game.setBattleSpeed('speed:2',2);assert.equal(f.game.snapshot.run.speed,2);
  assert.equal(f.game.snapshot.gold,before.gold);assert.equal(f.game.snapshot.run.goldEarned,before.run.goldEarned);
  f.restart();assert.equal(f.game.snapshot.run.speed,2);
});

test('skill-count progression improves 1–8 results while all reachable 9–12 rates are exactly preserved',()=>{
  const {countDistribution,legacyCountDistribution}=require('../.test-build/core/fusion.js');
  const chance=(d,k)=>d.find(e=>e.value===k)?.probability??0;
  assert.equal(chance(countDistribution(1,1,2),2),.65);
  for(let a=1;a<=12;a++)for(let b=1;b<=12;b++)for(let pool=Math.min(a,b);pool<=14;pool++){
    const now=countDistribution(a,b,pool),old=legacyCountDistribution(a,b,pool);
    for(let k=9;k<=12;k++)assert.equal(chance(now,k),chance(old,k));
    assert.deepEqual(now,countDistribution(b,a,pool));
  }
  for(let n=2;n<=8;n++){
    const pool=Math.min(n*2,14),now=countDistribution(n,n,pool),old=legacyCountDistribution(n,n,pool);
    const keep=d=>d.filter(e=>e.value>=n).reduce((sum,e)=>sum+e.probability,0);
    assert.ok(keep(now)>keep(old),`more probability to maintain or improve ${n}+${n}`);
  }
});

test('five field positions swap during combat without healing or resetting attacks, and full bench accepts an exchange',()=>{
  const f=fixture();begin(f);const originals=copy(f.game.snapshot.collection),b=startWave(f);stepBattle(b,4);getBattleEvents(b);
  const a=copy(b.units[0]),other=copy(b.units[1]);f.game.moveUnit('swap:field',a.id,other.slot,b);
  const after=f.game.snapshot.run.battle,aa=after.units.find(u=>u.id===a.id),bb=after.units.find(u=>u.id===other.id);
  for(const [next,prev] of [[aa,a],[bb,other]]){assert.equal(next.transfer.ends,after.tick+20);assert.equal(next.moveReadyTick,after.tick+160);const stats={...next,slot:prev.slot,x:prev.x,z:prev.z,actionUntilTick:prev.actionUntilTick};delete stats.transfer;delete stats.moveReadyTick;assert.equal(stats.pendingAttack,undefined);const expected={...prev};delete expected.pendingAttack;assert.deepEqual(stats,expected);}assert.throws(()=>f.game.moveUnit('swap:blocked',a.id,0,after),/冷却/);stepBattle(after,8);
  const target=bench(f)[2];f.game.moveUnit('swap:bench',a.id,null,after,target.benchSlot);
  assert.equal(bench(f).length,5);assert.equal(f.game.snapshot.run.units[a.id].benchSlot,target.benchSlot);
  assert.equal(f.game.snapshot.run.units[target.id].slot,other.slot);assert.deepEqual(f.game.snapshot.collection,originals);f.restart();validateSave(f.game.snapshot);
  const corrupt=f.game.snapshot;corrupt.run.battle.benchUnits[0].hp=NaN;assert.throws(()=>validateSave(corrupt));
  const rebound=f.game.snapshot;rebound.run.battle.benchUnits[0].turtleId='not-its-archive';assert.throws(()=>validateSave(rebound));
});

test('permanent parents require explicit consent; confirmed in-run fusion consumes originals atomically and survives restart',()=>{
  const f=fixture();begin(f);const old=copy(f.game.snapshot.collection),[x,y]=bench(f);
  f.game.deployBench('risk:parkA',x.id,0);f.game.deployBench('risk:parkB',y.id,1);
  const [a,b]=bench(f).filter(u=>u.savedId);assert.equal(bench(f).length,5);
  noMutation(f,()=>f.game.merge('risk:no-consent',a.id,b.id));
  const before=f.game.snapshot,raw=f.storage.getItem(SAVE_KEY),set=f.storage.setItem.bind(f.storage);let fail=true;
  f.storage.setItem=(key,value)=>{if(key===SAVE_KEY&&fail){fail=false;throw new Error('disk full');}set(key,value);};
  assert.throws(()=>f.game.merge('risk:confirmed',a.id,b.id,undefined,true),/disk full/);
  assert.deepEqual(f.game.snapshot,before);assert.equal(f.storage.getItem(SAVE_KEY),raw);
  const child=f.game.merge('risk:confirmed',a.id,b.id,undefined,true),fixed=f.game.snapshot;f.restart();
  assert.deepEqual(f.game.merge('risk:confirmed',a.id,b.id,undefined,true),child);assert.deepEqual(f.game.snapshot,fixed);
  assert.equal(f.game.snapshot.collection[a.savedId],undefined);assert.equal(f.game.snapshot.collection[b.savedId],undefined);
  assert.equal(Object.keys(f.game.snapshot.collection).length,Object.keys(old).length-2);
  f.game.reveal('risk:reveal');f.game.abandonRun('risk:abandon');
  assert.equal(f.game.snapshot.collection[child.turtle.id],undefined);assert.equal(f.game.snapshot.collection[a.savedId],undefined);f.restart();validateSave(f.game.snapshot);
});

test('locked permanent parents cannot be consumed even after the warning is confirmed',()=>{
  const f=fixture(s=>s.collection['t-1'].locked=true);begin(f);const x=bench(f)[0];f.game.deployBench('lock:park',x.id,0);
  const a=bench(f).find(u=>u.savedId==='t-1'),b=bench(f).find(u=>!u.savedId);
  noMutation(f,()=>f.game.merge('lock:risk',a.id,b.id,undefined,true));
});

test('legacy unchosen reward nodes migrate to one saved random outcome and cannot be redirected by an index',()=>{
  const f=fixture(s=>{s.cleared=[0,1];s.unlockedLevel=2;});begin(f,'endless');for(let i=0;i<5;i++)winWave(f);
  const s=f.game.snapshot;for(const key of ['randomIndex','format','opened','closed','drawing','spentGold'])delete s.run.rewardNodes[0][key];f.storage.setItem(SAVE_KEY,encodeSave(s));f.restart();
  f.game.prepareEndlessReward('legacy:draw',5);const fixed=f.game.snapshot.run.rewardNodes[0],rng=f.game.snapshot.rng;f.restart();
  f.game.prepareEndlessReward('legacy:draw',5);assert.equal(f.game.snapshot.rng,rng);
  const grant=f.game.chooseEndlessReward('legacy:receive',5,(fixed.randomIndex+1)%5);assert.deepEqual(grant,fixed.choices[fixed.randomIndex]);
  const after=f.game.snapshot;assert.deepEqual(f.game.chooseEndlessReward('legacy:receive',5,99),grant);assert.deepEqual(f.game.snapshot,after);
  noMutation(f,()=>f.game.chooseEndlessReward('legacy:twice',5));
  const invalid=f.game.snapshot;invalid.run.rewardNodes[0].randomIndex=(fixed.randomIndex+1)%5;assert.throws(()=>validateSave(invalid));
});

test('replacing an active run is atomic when stamina is insufficient, and endless uses the requested mode',()=>{
 const f=fixture(s=>{s.stamina=0;s.cleared=[0,1];s.unlockedLevel=2;});
 begin(f);const old=f.game.snapshot.run.id;
 noMutation(f,()=>f.game.beginPrototypeRun('replace:no-energy',1,['t-1'],'chapter',true));
 assert.equal(f.game.snapshot.run.id,old);assert.equal(f.game.snapshot.run.phase,'prep');
 const id=f.game.beginPrototypeRun('replace:endless',0,['t-2','t-1'],'endless',true);
 assert.equal(f.game.snapshot.run.mode,'endless');assert.deepEqual(f.game.snapshot.run.selectedSources,['t-2','t-1']);
 assert.equal(f.game.snapshot.results[old].victory,false);assert.equal(f.game.snapshot.stamina,0);
 const before=f.game.snapshot;assert.equal(f.game.beginPrototypeRun('replace:endless',0,['t-2','t-1'],'endless',true),id);
 assert.deepEqual(f.game.snapshot,before);f.restart();assert.deepEqual(f.game.snapshot.run,before.run);
});
