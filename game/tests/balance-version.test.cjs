const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const current=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {makeInitialSave,GameService}=require('../.test-build/core/game.js');
const {encodeSave,decodeSave,SaveRepository,SAVE_KEY,BACKUP_KEY}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const data=require('../.test-build/core/data.js');
const clone=value=>JSON.parse(JSON.stringify(value));

let ts;
for(const file of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(file);break;}catch{}
}
if(!ts)throw new Error('Historical balance tests require the installed TypeScript compiler');
const fixtureRoot=path.join(__dirname,'fixtures/balance-v1');
const provenance=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'provenance.json'),'utf8'));
const modules={};
function historical(name){
  if(modules[name])return modules[name].exports;
  const entry=provenance.files.find(item=>item.fixture===name+'.ts.txt');assert.ok(entry);
  const bytes=fs.readFileSync(path.join(fixtureRoot,entry.fixture));
  // Git may normalize this text fixture on Windows; compare its recorded LF bytes.
  const text=bytes.toString('utf8').replace(/\r\n/g,'\n');
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'),entry.sha256,'historical rules fixture must not drift');
  const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};modules[name]=module;
  vm.runInNewContext(code,{module,exports:module.exports,require(id){assert.ok(id.startsWith('./'));return historical(id.slice(2));}});
  return module.exports;
}
const old=historical('battle');
const NOW=1788840000000;
const builds={stone:['strong','armor','encourage','share','reflect'],spike:['reach','swift','critical'],crystal:['bounce','resist'],leaf:['reach','doubleHeal'],bubble:['steady','shredArmor']};
function scenario(levelId=3){
  const save=makeInitialSave(NOW,9071);save.unlockedLevel=4;
  const turtles=Object.values(save.collection),order={stone:0,leaf:1,crystal:2,bubble:3,spike:4};
  const units={};
  for(const turtle of turtles){turtle.skills=[...builds[turtle.role]];const id='unit-'+turtle.role;units[id]={id,turtle:clone(turtle),level:5,slot:order[turtle.role],sources:[turtle.id],savedId:turtle.id};}
  const ids=turtles.map(t=>t.id);
  const inputs=Object.values(units).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot}));
  const battle=clone(old.createBattle(levelId,6,clone(inputs),{seed:77113}));
  old.stepBattle(battle,9.375);assert.equal(battle.status,'fighting');
  assert.equal(battle.balanceVersion,undefined);
  save.run={id:'historical-range-run',levelId,phase:'combat',wave:5,coreHealth:20,goldEarned:40,combatSeconds:175,
    startedAt:NOW-300000,selectedSources:ids,usedSources:ids,units,merges:{},mergeWavesUsed:[],recruitAvailable:false,
    recruitCandidates:[],refreshUsed:false,battle:clone(battle)};
  return {save,battle:save.run.battle,inputs};
}

test('frozen and current core retain old range rules across all five levels after known layout normalization',()=>{
  for(let levelId=0;levelId<5;levelId++){
    // Tutorial has five waves; exercise its last wave with the same true old code.
    const seed=scenario(levelId===0?1:levelId),inputs=seed.inputs;
    let legacy=clone(old.createBattle(levelId,levelId===0?5:6,clone(inputs),{seed:77113}));
    old.stepBattle(legacy,9.375);let resumed=clone(legacy);
    if(levelId===4){
      assert.throws(()=>validateBattle(resumed),/站位坐标/);
      const save=clone(seed.save);save.run.battle=resumed;
      resumed=decodeSave(encodeSave(save)).run.battle;
      // Normalize only the approved layout in the independent old-engine reference.
      // This compares old ranges on the same new layout, not the old route trajectory.
      for(const unit of legacy.units)if(unit.slot===4)Object.assign(unit,{x:6.62,z:-1.31});
      assert.deepEqual(resumed,clone(legacy));assert.equal(resumed.balanceVersion,undefined);
    }
    validateBattle(resumed);old.stepBattle(legacy,300);current.stepBattle(resumed,300);
    assert.deepEqual(clone(resumed),clone(legacy),`level ${levelId}: HP, RNG, events and timing must retain old rules`);
  }
});

for(const fromBackup of [false,true])test(`historical ${fromBackup?'backup':'primary'} load preserves ranges/version without writes; next wave gets current parameters`,()=>{
  const {save,battle}=scenario(),raw=encodeSave(save),storage=new MemoryStorage();
  if(fromBackup){storage.setItem(SAVE_KEY,'broken primary');storage.setItem(BACKUP_KEY,raw);}else storage.setItem(SAVE_KEY,raw);
  const before=clone(storage.values),service=new GameService(new SaveRepository(storage),{now:()=>NOW});
  assert.deepEqual(storage.values,before);assert.deepEqual(service.snapshot.run.battle,battle);
  assert.equal(service.snapshot.run.battle.balanceVersion,undefined);
  const paused=clone(service.snapshot.run.battle);service.checkpointBattle('legacy:pause',save.run.id,paused);
  const again=new GameService(new SaveRepository(storage),{now:()=>NOW});
  assert.deepEqual(again.snapshot.run.battle,paused);assert.equal(again.snapshot.gold,save.gold);assert.equal(again.snapshot.stamina,save.stamina);
  const resumed=clone(again.snapshot.run.battle),expected=clone(paused);old.stepBattle(expected,300);current.stepBattle(resumed,300);
  assert.deepEqual(resumed,clone(expected));assert.equal(resumed.status,'won');
  again.completeWave('legacy:finish',save.run.id,resumed);
  const run=again.snapshot.run,inputs=Object.values(run.units).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot}));
  const next=current.createBattle(run.levelId,run.wave+1,inputs,{coreHealth:run.coreHealth,seed:77114});
  assert.equal(next.balanceVersion,2);
  for(const unit of next.units)assert.equal(unit.range,data.ROLES[unit.role].range+(unit.skills.includes('reach')?.3:0));
  again.beginWave('new:wave',run.id,next);
  assert.deepEqual(decodeSave(storage.getItem(SAVE_KEY)).run.battle,next);
});

test('unsupported balance markers cannot be decoded or committed and cannot damage a valid save',()=>{
  const {save}=scenario();
  const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(save));
  const service=new GameService(new SaveRepository(storage),{now:()=>NOW}),before=service.snapshot,disk=clone(storage.values);
  for(const marker of [null,0,1,3,'2',false]){
    const bad=clone(save);bad.run.battle.balanceVersion=marker;
    assert.throws(()=>decodeSave(encodeSave(bad)),/平衡版本/);
    assert.throws(()=>service.checkpointBattle('invalid:'+String(marker),save.run.id,bad.run.battle),/平衡版本/);
    assert.deepEqual(service.snapshot,before);assert.deepEqual(storage.values,disk);
  }
  const currentState=clone(save);currentState.run.battle.balanceVersion=2;assert.doesNotThrow(()=>decodeSave(encodeSave(currentState)));
});
