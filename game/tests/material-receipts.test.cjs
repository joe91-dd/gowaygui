const test=require('node:test');
const assert=require('node:assert/strict');
const {harness,simulateChapter,simulateLevel}=require('../tools/simulate-chapter.cjs');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle}=require('../.test-build/core/battle.js');
const {SAVE_KEY,encodeSave,decodeSave,validateSave}=require('../.test-build/core/save.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const MATERIALS=['attack','health','defense','growth'];

test('real five-stage progression records the exact first-clear materials actually added to inventory',()=>{
  const {report}=simulateChapter(731);
  let previous=makeInitialSave(0,731).materials;
  const expected=['health','attack','attack','attack','growth'];
  assert.equal(report.archives.length,5);
  for(const archive of report.archives){
    const save=archive.save,result=save.results[save.run.id];
    assert.ok(result.victory);
    assert.deepEqual(result.materials,{[expected[archive.levelId]]:1});
    for(const kind of MATERIALS)assert.equal(save.materials[kind]-previous[kind],result.materials[kind]||0);
    assert.deepEqual(decodeSave(archive.envelope).results[result.runId],result);
    previous=save.materials;
  }
});

test('restart, duplicate final callback and gold doubling preserve material receipts without granting again',()=>{
  const h=harness(731),first=simulateLevel(h,0),runId=first.runId;
  const settled=h.service.snapshot,receipt=settled.results[runId],inventory=settled.materials;
  const finalCommand=Object.entries(settled.commands).filter(([,c])=>c.kind==='completeWave').at(-1)[0];
  h.restart();
  // The acknowledged command receipt is replayed; its original battle cannot be required again after restart.
  h.service.completeWave(finalCommand,runId,{});
  assert.deepEqual(h.service.snapshot.results[runId],receipt);
  assert.deepEqual(h.service.snapshot.materials,inventory);
  assert.throws(()=>h.service.completeWave('materials:late-new-command',runId,{}));
  assert.deepEqual(h.service.snapshot.materials,inventory);
  h.service.simulateAd('materials:double','doubleGold',runId);h.restart();
  h.service.simulateAd('materials:double','doubleGold',runId);
  assert.deepEqual(h.service.snapshot.results[runId].materials,receipt.materials);
  assert.deepEqual(h.service.snapshot.materials,inventory);
  const again=simulateLevel(h,0);
  assert.ok(again.victory);
  assert.deepEqual(h.service.snapshot.results[again.runId].materials,{});
  assert.deepEqual(h.service.snapshot.materials,inventory);
});

// Domain settlement fixture; actual combat and five-stage grants are covered above.
function finalTutorialWave(h){
  const ids=Object.keys(h.service.snapshot.collection),runId=h.service.beginRun('materials:start',0,ids);
  let finished;
  for(let wave=1;wave<=5;wave++){
    const r=h.service.snapshot.run,units=Object.values(r.units).filter(u=>!u.consumedBy&&u.slot!==null);
    const start=createBattle(0,wave,units,{coreHealth:r.coreHealth});
    h.service.beginWave(`materials:begin:${wave}`,runId,start);
    finished={...clone(start),spawns:[],spawnCursor:0,events:[],status:'won',tick:500,elapsed:25};
    if(wave<5)h.service.completeWave(`materials:finish:${wave}`,runId,finished);
  }
  return {runId,finished};
}

test('a failed settlement commit cannot add inventory without its receipt; retry grants once',()=>{
  const h=harness(91),{runId,finished}=finalTutorialWave(h),before=h.service.snapshot;
  const set=h.storage.setItem.bind(h.storage);let fail=true;
  h.storage.setItem=(key,value)=>{if(key===SAVE_KEY&&fail){fail=false;throw new Error('material settlement disk full');}set(key,value);};
  assert.throws(()=>h.service.completeWave('materials:final',runId,finished),/disk full/);
  assert.deepEqual(h.service.snapshot,before);
  assert.deepEqual(decodeSave(h.storage.getItem(SAVE_KEY)),before);
  h.restart();h.service.completeWave('materials:final',runId,finished);h.restart();
  h.service.completeWave('materials:final',runId,finished);
  assert.deepEqual(h.service.snapshot.results[runId].materials,{health:1});
  assert.equal(h.service.snapshot.materials.health,before.materials.health+1);
});

test('legacy missing material receipts remain unknown across decode, a new transaction and restart',()=>{
  const h=harness(17),{runId,finished}=finalTutorialWave(h);
  h.service.completeWave('materials:final',runId,finished);
  const legacy=h.service.snapshot;delete legacy.results[runId].materials;
  const next=harness(29,legacy),inventory=clone(legacy.materials);
  assert.equal(next.service.snapshot.results[runId].materials,undefined);
  next.service.updateSettings('materials:legacy-settings',{music:.4});next.restart();
  assert.equal(next.service.snapshot.results[runId].materials,undefined);
  assert.equal(Object.hasOwn(decodeSave(next.storage.getItem(SAVE_KEY)).results[runId],'materials'),false);
  assert.deepEqual(next.service.snapshot.materials,inventory);
});

test('material receipt validation rejects malformed maps, unknown materials and invalid counts',()=>{
  const h=harness(39),runId=h.service.beginRun('materials:validation-start',0,['t-1']);
  h.service.abandonRun('materials:validation-abandon');const save=h.service.snapshot;
  const invalid=[null,[],true,3,'growth',{gold:1},{growth:0},{health:-1},{attack:1.5},{defense:'1'},{growth:Number.MAX_SAFE_INTEGER+1},JSON.parse('{"__proto__":1}')];
  for(const materials of invalid){
    const broken=clone(save);broken.results[runId].materials=materials;
    assert.throws(()=>validateSave(broken),/材料收据/);
    assert.throws(()=>decodeSave(encodeSave(broken)),/材料收据/);
  }
  const brokenCommand=clone(save);brokenCommand.commands['materials:validation-abandon'].result.materials={growth:-1};
  assert.throws(()=>validateSave(brokenCommand),/材料收据/);
  const empty=clone(save);empty.results[runId].materials={};assert.doesNotThrow(()=>validateSave(empty));
});

test('abandoning records a known empty grant and replays the same receipt after restart',()=>{
  const h=harness(51),before=h.service.snapshot.materials;
  const runId=h.service.beginRun('materials:abandon-start',0,['t-1']);
  const receipt=h.service.abandonRun('materials:abandon');
  assert.deepEqual(receipt.materials,{});h.restart();
  assert.deepEqual(h.service.abandonRun('materials:abandon'),receipt);
  assert.deepEqual(h.service.abandonRun('materials:abandon-new-command'),receipt);
  assert.deepEqual(h.service.snapshot.results[runId],receipt);
  assert.deepEqual(h.service.snapshot.materials,before);
});
