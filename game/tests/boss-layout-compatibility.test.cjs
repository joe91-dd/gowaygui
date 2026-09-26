'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const build=process.env.GOWAYGUI_TEST_BUILD||path.join(__dirname,'../.test-build');
const {GameService,makeInitialSave}=require(path.join(build,'core/game.js'));
const {SAVE_KEY,BACKUP_KEY,SaveRepository,encodeSave,decodeSave,validateSave}=require(path.join(build,'core/save.js'));
const {createBattle,stepBattle}=require(path.join(build,'core/battle.js'));
const {validateBattle}=require(path.join(build,'core/battleValidation.js'));
const {LEGACY_BATTLE_MAPS:LEVELS,SKILL_BY_ID,skillsForRole}=require(path.join(build,'core/data.js'));
const {MemoryStorage}=require(path.join(build,'platform/storage.js'));
const clone=value=>JSON.parse(JSON.stringify(value));
const NOW=1788840000000;
// Frozen historical coordinates: fixtures must not call the new layout "legacy".
const OLD=[{x:-5,z:1},{x:-1,z:1},{x:3,z:1},{x:1,z:-3},{x:6,z:-1}];
const CURRENT=[{x:-5,z:1},{x:-1,z:1},{x:3,z:1},{x:1,z:-3},{x:6.62,z:-1.31}];
const ROUTE=[{x:-9,z:0},{x:-4,z:0},{x:0,z:0},{x:2,z:-2},{x:5,z:-2},{x:6,z:0},{x:9,z:0}];
const changed=slot=>slot===4;
function baseSave(){
  const save=makeInitialSave(NOW,0x73a114);
  save.unlockedLevel=4;save.cleared=[0,1,2,3];save.tutorialDone=true;save.tutorialStarted=true;save.idCounter=120;
  const ids=Object.keys(save.collection),stations=[2,4,0,1,3],units={};
  ids.forEach((id,i)=>{
    const turtle=save.collection[id];
    turtle.skills=[...new Set([...turtle.skills,...['openingShield','regen','encourage'].filter(s=>skillsForRole(turtle.role).includes(s))])];
    const active=skillsForRole(turtle.role).find(id=>SKILL_BY_ID[id].active);
    if(active&&!turtle.skills.includes(active))turtle.skills.push(active);
    const unitId=`u-legacy-${i}`;
    units[unitId]={id:unitId,turtle:clone(turtle),sources:[id],savedId:id,slot:stations[i],level:8};
  });
  const bench=clone(save.collection[ids[0]]);bench.id='t-legacy-bench';
  units['u-legacy-bench']={id:'u-legacy-bench',turtle:bench,sources:[],slot:null,level:4};
  save.run={id:'run-legacy',levelId:4,phase:'between',wave:8,coreHealth:20,goldEarned:64,combatSeconds:200,
    startedAt:NOW-300000,selectedSources:ids,usedSources:ids,units,merges:{},mergeWavesUsed:[],
    recruitAvailable:true,recruitCandidates:[],refreshUsed:false};
  validateSave(save);return save;
}
function inputs(run){return Object.values(run.units).filter(u=>!u.consumedBy&&u.slot!==null).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot}));}
function freezeOld(battle){
  battle.route=clone(ROUTE);
  for(const unit of battle.units)Object.assign(unit,OLD[unit.slot]);
  return battle;
}
function expectedMigration(save){
  const result=clone(save);
  if(result.run?.phase==='combat'&&result.run.levelId===4)
    for(const unit of result.run.battle.units)if(changed(unit.slot))Object.assign(unit,CURRENT[unit.slot]);
  return result;
}
function legacyCombat(){
  const save=baseSave(),r=save.run;
  const battle=createBattle(4,r.wave+1,inputs(r),{seed:9071,coreHealth:r.coreHealth});
  stepBattle(battle,3.375);
  assert.equal(battle.status,'fighting');assert.ok(battle.enemies.length>0);assert.ok(battle.events.length>0);
  const dead=battle.units.find(u=>u.slot===4);dead.hp=0;dead.alive=false;
  const caster=battle.units.find(u=>u.alive&&u.skills.some(id=>SKILL_BY_ID[id].active));
  battle.commands=[{type:'cast',unitId:caster.id,skillId:caster.skills.find(id=>SKILL_BY_ID[id].active)}];
  assert.ok(battle.pendingSeconds>0);validateBattle(battle);
  r.phase='combat';r.recruitAvailable=false;r.battle=freezeOld(battle);
  return save;
}
function open(save,backup){
  const storage=new MemoryStorage(),clock={now:()=>NOW};
  storage.setItem(SAVE_KEY,typeof save==='string'?save:encodeSave(save));
  if(backup!==undefined)storage.setItem(BACKUP_KEY,typeof backup==='string'?backup:encodeSave(backup));
  const repository=new SaveRepository(storage),service=new GameService(repository,clock);
  return {storage,clock,repository,service};
}
function phaseSave(phase){
  if(phase==='combat')return legacyCombat();
  const save=baseSave(),r=save.run;
  if(phase==='prep'){
    r.phase='prep';r.wave=0;r.goldEarned=0;r.combatSeconds=0;r.recruitAvailable=false;
    const first=Object.values(r.units).find(u=>u.slot===4);r.units={[first.id]:first};r.usedSources=[first.savedId];
    return save;
  }
  if(phase==='between')return save;
  const h=open(save);
  if(phase==='reveal'){
    const ids=inputs(r).slice(0,2).map(u=>u.id);h.service.merge('fixture:fixed-merge',...ids);
  }else h.service.abandonRun('fixture:settle');
  return h.service.snapshot;
}
function assertUnchangedOnThrow(h,action,pattern=/战斗|站位|布阵|档案/){
  const before=h.service.snapshot,disk=clone(h.storage.values);
  assert.throws(action,pattern);assert.deepEqual(h.service.snapshot,before);assert.deepEqual(h.storage.values,disk);
}

test('boss has independent exact stations and route; every other level keeps its established coordinates',()=>{
  assert.deepEqual(LEVELS[4].slots,CURRENT);assert.deepEqual(LEVELS[4].route,ROUTE);
  const coral=[{x:-5,z:1},{x:-1,z:1},{x:3.395,z:1.099},{x:1,z:-3},{x:5.832,z:-.748}];
  for(const id of [0,1,2,3]){
    assert.deepEqual(LEVELS[id].slots,id===2?coral:OLD);
    assert.notEqual(LEVELS[4].slots,LEVELS[id].slots);
    LEVELS[4].slots.forEach((p,i)=>assert.notEqual(p,LEVELS[id].slots[i]));
  }
  const battle=createBattle(4,1,inputs(baseSave().run));validateBattle(battle);
  assert.deepEqual(battle.units.map(u=>({slot:u.slot,x:u.x,z:u.z})),inputs(baseSave().run).map(u=>({slot:u.slot,...CURRENT[u.slot]})));
  battle.units.find(u=>u.slot===4).x+=.25;assert.throws(()=>validateBattle(battle),/站位坐标/);
});

test('all five save phases preserve archives, reveal RNG and receipts; only combat coordinates change',()=>{
  for(const phase of ['prep','between','combat','reveal','result']){
    const original=phaseSave(phase),before=clone(original),decoded=decodeSave(encodeSave(original));
    assert.deepEqual(original,before);assert.deepEqual(decoded,expectedMigration(original));
    assert.equal(decoded.run.phase,phase);assert.equal(decoded.revision,original.revision);
    if(phase!=='combat')assert.deepEqual(decoded,original);
    const h=open(encodeSave(original));
    if(phase==='reveal'){
      const pending=h.service.snapshot.run.pendingMergeId,childId=h.service.snapshot.run.merges[pending].outputId;
      const child=clone(h.service.snapshot.run.units[childId]),rng=h.service.snapshot.rng;
      assert.deepEqual(h.service.reveal('resume:reveal'),child);
      assert.equal(h.service.snapshot.rng,rng);assert.equal(h.service.snapshot.run.phase,'between');
      assert.deepEqual(h.service.snapshot.collection,original.collection);
    }
    if(phase==='result'){
      const beforeResult=h.service.snapshot;
      h.service.abandonRun('fixture:settle');assert.deepEqual(h.service.snapshot,beforeResult);
      const reward=h.service.simulateAd('resume:double','doubleGold',h.service.snapshot.run.id);
      const paid=h.service.snapshot;
      const again=open(h.storage.getItem(SAVE_KEY));
      assert.equal(again.service.simulateAd('resume:double','doubleGold',paid.run.id),reward);
      assert.deepEqual(again.service.snapshot,paid);
    }
  }
});

test('rich old combat migrates dead and living turtles without losing any other simulation field',()=>{
  const original=legacyCombat(),decoded=decodeSave(encodeSave(original));
  assert.ok(original.run.battle.units.some(u=>u.slot===4&&!u.alive));
  assert.ok(original.run.battle.units.some(u=>u.shields.length));
  assert.ok(original.run.battle.commands.length);assert.ok(original.run.battle.events.length);
  assert.deepEqual(decoded,expectedMigration(original));
  assert.equal(decoded.run.units['u-legacy-bench'].slot,null);
  assert.equal(decoded.run.battle.units.some(u=>u.id==='u-legacy-bench'),false);
  assert.throws(()=>validateSave(original),/站位坐标/);assert.throws(()=>validateBattle(original.run.battle),/站位坐标/);
  assert.doesNotThrow(()=>validateSave(decoded));assert.doesNotThrow(()=>validateBattle(decoded.run.battle));
});

test('known old/new pairs, partial occupancy and repeated old archive imports are idempotent',()=>{
  for(const occupied of [[4],[]]){
    const old=legacyCombat(),r=old.run;
    for(const u of Object.values(r.units))if(changed(u.slot)&&!occupied.includes(u.slot))u.slot=null;
    // Regenerate nonlayout simulation for this roster; historical coordinates remain literal OLD.
    r.battle=freezeOld(createBattle(4,r.wave+1,inputs(r),{seed:17}));
    // Both original and already-normalized inputs must survive repeated reads.
    const already=expectedMigration(old);assert.deepEqual(decodeSave(encodeSave(already)),already);
    const expected=expectedMigration(old),raw=encodeSave(old);
    let current=decodeSave(raw);assert.deepEqual(current,expected);
    for(let n=0;n<4;n++){current=decodeSave(encodeSave(current));assert.deepEqual(current,expected);}
    assert.deepEqual(decodeSave(raw),expected,'an older envelope remains migratable after later reads');
  }
});

test('checksum, full structure, route and exact coordinate pairs are checked before migration',()=>{
  const original=legacyCombat(),raw=encodeSave(original),envelope=JSON.parse(raw);
  const edited=JSON.parse(envelope.payload);edited.run.battle.units[0].x=999;envelope.payload=JSON.stringify(edited);
  assert.throws(()=>decodeSave(JSON.stringify(envelope)),/存档校验失败/);
  const mutations=[
    s=>s.run.battle.units[0].x=999,
    s=>{const u=s.run.battle.units.find(u=>u.slot===4);u.x=6;u.z=-1.31;},
    s=>{const u=s.run.battle.units.find(u=>u.slot===4);u.x=6.62;u.z=-1;},
    s=>Object.assign(s.run.battle.units.find(u=>u.slot===4),{x:5.832,z:-.748}),
    s=>Object.assign(s.run.battle.units.find(u=>u.slot===2),{x:3.395,z:1.099}),
    s=>s.run.battle.units[0].z=null,
    s=>s.run.battle.units[0].hp=-1,
    s=>{delete s.run.battle.units[0].statuses;},
    s=>{s.run.battle.route[0].x-=.5;s.run.battle.routeLength+=.5;},
    s=>{const a=s.run.battle.units.find(u=>u.slot===2),b=s.run.battle.units.find(u=>u.slot===4);a.slot=4;Object.assign(a,OLD[4]);b.slot=2;Object.assign(b,OLD[2]);},
    s=>{s.run.battle.units[0].turtleId='unrelated-archive';},
  ];
  for(const mutate of mutations){const save=clone(original);mutate(save);assert.throws(()=>decodeSave(encodeSave(save)),/损坏|站位|档案|路线/);}
});

test('opening an old primary is read-only, keeps revision/raw CAS and then commits normally',()=>{
  const original=legacyCombat(),raw=encodeSave(original),backup=encodeSave(phaseSave('between'));
  const storage=new MemoryStorage();storage.setItem(SAVE_KEY,raw);storage.setItem(BACKUP_KEY,backup);
  const realSet=storage.setItem.bind(storage),writes=[];storage.setItem=(key,value)=>{writes.push(key);realSet(key,value);};
  const repo=new SaveRepository(storage),service=new GameService(repo,{now:()=>NOW});
  const opened=service.snapshot;
  assert.deepEqual(writes,[]);assert.equal(repo.recoveredFromBackup,false);
  assert.equal(storage.getItem(SAVE_KEY),raw);assert.equal(storage.getItem(BACKUP_KEY),backup);
  assert.equal(opened.revision,original.revision);assert.deepEqual(opened,expectedMigration(original));
  service.refreshClock('migration:first-write');
  assert.deepEqual(writes,[BACKUP_KEY,SAVE_KEY]);assert.equal(service.snapshot.revision,opened.revision+1);
  assert.deepEqual(decodeSave(storage.getItem(BACKUP_KEY)),opened);
  assert.deepEqual(decodeSave(storage.getItem(SAVE_KEY)),service.snapshot);
});

test('old combat backup recovers without clearing either raw value on open; two bad saves stay preserved',()=>{
  const old=legacyCombat(),raw=encodeSave(old),h=open('broken-primary',raw);
  assert.equal(h.repository.recoveredFromBackup,true);assert.deepEqual(h.service.snapshot,expectedMigration(old));
  assert.equal(h.storage.getItem(SAVE_KEY),'broken-primary');assert.equal(h.storage.getItem(BACKUP_KEY),raw);
  h.service.refreshClock('recovery:write');
  assert.deepEqual(decodeSave(h.storage.getItem(SAVE_KEY)),h.service.snapshot);
  const damaged=clone(old);damaged.run.battle.units[0].x=999;
  const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(damaged));storage.setItem(BACKUP_KEY,'broken-backup');
  const before=clone(storage.values);
  assert.throws(()=>new GameService(new SaveRepository(storage),{now:()=>NOW}),e=>e.code==='SAVE_RECOVERY');
  assert.deepEqual(storage.values,before);
});

test('backup/primary write failures and lost acknowledgement keep migration and atomic commit semantics',()=>{
  for(const failAt of [BACKUP_KEY,SAVE_KEY]){
    const old=legacyCombat(),h=open(old),before=h.service.snapshot,raw=h.storage.getItem(SAVE_KEY);
    const realSet=h.storage.setItem.bind(h.storage);let fail=true;
    h.storage.setItem=(key,value)=>{if(key===failAt&&fail){fail=false;throw new Error('disk full');}realSet(key,value);};
    assert.throws(()=>h.service.refreshClock('failure:clock'),/disk full/);
    assert.deepEqual(h.service.snapshot,before);assert.equal(h.storage.getItem(SAVE_KEY),raw);
    const reopened=new GameService(new SaveRepository(h.storage),h.clock);assert.deepEqual(reopened.snapshot,before);
    reopened.refreshClock('failure:retry');assert.equal(reopened.snapshot.revision,before.revision+1);
  }
  const h=open(legacyCombat()),realSet=h.storage.setItem.bind(h.storage),before=h.service.snapshot;let once=true;
  h.storage.setItem=(key,value)=>{realSet(key,value);if(key===SAVE_KEY&&once){once=false;throw new Error('lost acknowledgement');}};
  assert.throws(()=>h.service.updateSettings('ack:settings',{music:.23}),/lost acknowledgement/);
  assert.deepEqual(h.service.snapshot,before);
  const again=new GameService(new SaveRepository(h.storage),h.clock),committed=again.snapshot;
  assert.equal(committed.settings.music,.23);assert.equal(committed.revision,before.revision+1);
  again.updateSettings('ack:settings',{music:.23});assert.deepEqual(again.snapshot,committed);
});

test('new callbacks and direct repository commits cannot put old or arbitrary coordinates back',()=>{
  const prep=phaseSave('prep'),h=open(prep),r=h.service.snapshot.run;
  const current=createBattle(4,1,inputs(r)),old=freezeOld(clone(current));
  assertUnchangedOnThrow(h,()=>h.service.beginWave('strict:old-begin',r.id,old));
  h.service.beginWave('strict:begin',r.id,current);
  const checkpoint=clone(current);stepBattle(checkpoint,.375);
  h.service.checkpointBattle('strict:checkpoint',r.id,checkpoint);
  const stale=freezeOld(clone(checkpoint));stepBattle(stale,.2);
  assertUnchangedOnThrow(h,()=>h.service.checkpointBattle('strict:late-old',r.id,stale));
  const arbitrary=clone(stale);arbitrary.units[0].x=999;
  assertUnchangedOnThrow(h,()=>h.service.checkpointBattle('strict:arbitrary',r.id,arbitrary));
  const finished=clone(stale);finished.status='lost';finished.coreHealth=0;finished.pendingSeconds=0;
  assertUnchangedOnThrow(h,()=>h.service.completeWave('strict:old-finish',r.id,finished));
  const direct=h.service.snapshot;direct.revision++;direct.run.battle=stale;
  const disk=clone(h.storage.values);assert.throws(()=>h.repository.commit(direct),/站位坐标/);assert.deepEqual(h.storage.values,disk);
  const mismatched=clone(checkpoint);mismatched.units[0].slot=0;Object.assign(mismatched.units[0],CURRENT[0]);
  assertUnchangedOnThrow(h,()=>h.service.checkpointBattle('strict:wrong-slot',r.id,mismatched));
  const wrongArchive=clone(checkpoint);wrongArchive.units[0].turtleId='different-archive';
  assertUnchangedOnThrow(h,()=>h.service.checkpointBattle('strict:wrong-archive',r.id,wrongArchive));
});

test('normalized mid-wave restoration continues identically to the same state with only coordinates updated',()=>{
  const old=legacyCombat(),expected=expectedMigration(old),h=open(old);
  const reference=clone(expected.run.battle),restored=h.service.snapshot.run.battle;
  for(let i=0;i<45;i++){
    const dt=[.025,.075,.125][i%3];stepBattle(reference,dt);stepBattle(restored,dt);
    assert.doesNotThrow(()=>validateBattle(restored));assert.deepEqual(restored,reference);
  }
  h.service.checkpointBattle('resume:checkpoint',h.service.snapshot.run.id,restored);
  const reopened=open(h.storage.getItem(SAVE_KEY));assert.deepEqual(reopened.service.snapshot.run.battle,reference);
  const earlier=clone(expected.run.battle);
  assertUnchangedOnThrow(reopened,()=>reopened.service.checkpointBattle('resume:earlier',expected.run.id,earlier),/较早/);
});

test('won and lost old combat snapshots await normal settlement without replaying or repeating rewards',()=>{
  for(const outcome of ['won','lost']){
    const save=baseSave(),r=save.run;r.wave=11;r.goldEarned=88;r.combatSeconds=250;
    // Real simulation produces terminal states; fixture freezes only the historical layout.
    const battle=freezeOld(createBattle(4,12,inputs(r),{seed:271,coreHealth:outcome==='lost'?1:20}));
    if(outcome==='lost')for(const unit of battle.units){unit.hp=0;unit.alive=false;}
    for(let i=0;i<600&&battle.status==='fighting';i++)stepBattle(battle,.5);
    assert.equal(battle.status,outcome);
    r.phase='combat';r.coreHealth=outcome==='lost'?1:20;r.battle=battle;
    const h=open(save),restored=h.service.snapshot;
    assert.deepEqual(restored,expectedMigration(save));assert.equal(restored.run.battle.status,outcome);
    const id=`terminal:${outcome}`;
    h.service.completeWave(id,r.id,restored.run.battle);
    const completed=h.service.snapshot;assert.equal(completed.run.battle,undefined);
    assert.equal(completed.run.phase,'result');assert.equal(completed.results[r.id].victory,outcome==='won');
    const again=open(h.storage.getItem(SAVE_KEY));
    again.service.completeWave(id,r.id,{});assert.deepEqual(again.service.snapshot,completed);
  }
});

test('optimistic concurrency survives read-only migration and rejects another page stale state',()=>{
  const old=legacyCombat(),h=open(old),second=new GameService(new SaveRepository(h.storage),h.clock);
  h.service.refreshClock('tabs:first');const disk=h.storage.getItem(SAVE_KEY),before=second.snapshot;
  assert.throws(()=>second.refreshClock('tabs:stale'),/另一个页面/);
  assert.deepEqual(second.snapshot,before);assert.equal(h.storage.getItem(SAVE_KEY),disk);
  const latest=new GameService(new SaveRepository(h.storage),h.clock);latest.refreshClock('tabs:reopen');
  assert.equal(latest.snapshot.revision,h.service.snapshot.revision+1);
});

test('an old combat envelope remains supported after the level has already been cleared',()=>{
  const old=legacyCombat();old.cleared=[0,1,2,3,4];old.unlockedLevel=4;
  old.results.previous={runId:'previous',levelId:4,victory:true,waves:12,baseGold:100,firstClearGold:100,combatSeconds:250,at:NOW-1000,doubled:true,materials:{attack:1}};
  const expected=expectedMigration(old),raw=encodeSave(old);
  assert.deepEqual(decodeSave(raw),expected);
  const recovered=open('damaged-newer-primary',raw);assert.deepEqual(recovered.service.snapshot,expected);
  recovered.service.refreshClock('future:write');
  assert.deepEqual(decodeSave(raw),expected,'reading a later version never disables old archive compatibility');
});

// Load the actual pre-range-change source without altering historical fixture bytes or the shared build.
function historicalV1(){
  const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
  let ts;
  for(const file of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
    try{ts=require(file);break;}catch{}
  }
  assert.ok(ts,'The installed TypeScript compiler is required for the frozen v1 fixture');
  const dir=path.join(__dirname,'fixtures/balance-v1'),provenance=JSON.parse(fs.readFileSync(path.join(dir,'provenance.json'),'utf8')),modules={};
  function load(name){
    if(modules[name])return modules[name].exports;
    const entry=provenance.files.find(p=>p.fixture===name+'.ts.txt');assert.ok(entry);
    const source=fs.readFileSync(path.join(dir,entry.fixture),'utf8').replace(/\r\n/g,'\n');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.sha256);
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    const module={exports:{}};modules[name]=module;
    vm.runInNewContext(code,{module,exports:module.exports,require(id){assert.ok(id.startsWith('./'));return load(id.slice(2));}});
    return module.exports;
  }
  return load('battle');
}

test('range-v1/v2 and original/current boss layout are independent on primary, backup, continuation and next wave',()=>{
  const old=historicalV1(),{BATTLE_RULES}=require(path.join(build,'core/battle.js'));
  const builds={stone:['strong','armor','encourage','share','reflect'],spike:['reach','swift','critical'],crystal:['bounce','resist'],leaf:['reach','doubleHeal'],bubble:['steady','shredArmor']};
  for(const version of [undefined,2])for(const layout of ['old','current'])for(const fromBackup of [false,true]){
    const save=baseSave(),r=save.run;r.wave=5;r.recruitAvailable=false;
    for(const unit of Object.values(r.units))if(unit.slot!==null)unit.turtle.skills=[...builds[unit.turtle.role]];
    const engine=version===undefined?old:{createBattle,stepBattle};
    // The historical v1 engine constructs its real original coordinates/ranges/absent marker.
    // The current engine's same v2 rules are run at frozen old coordinates before serialization.
    let battle=clone(engine.createBattle(4,6,clone(inputs(r)),{seed:77113}));
    freezeOld(battle);engine.stepBattle(battle,9.375);
    battle=clone(battle);assert.equal(battle.status,'fighting');assert.equal(battle.balanceVersion,version);
    r.phase='combat';r.battle=battle;
    if(layout==='current')Object.assign(battle.units.find(u=>u.slot===4),CURRENT[4]);
    const original=clone(save),raw=encodeSave(save),storage=new MemoryStorage();
    storage.setItem(SAVE_KEY,fromBackup?'damaged-primary':raw);
    storage.setItem(BACKUP_KEY,fromBackup?raw:encodeSave(phaseSave('between')));
    const disk=clone(storage.values),realSet=storage.setItem.bind(storage),writes=[];
    storage.setItem=(key,value)=>{writes.push(key);realSet(key,value);};
    const repo=new SaveRepository(storage),service=new GameService(repo,{now:()=>NOW});
    assert.deepEqual(writes,[]);assert.deepEqual(storage.values,disk);assert.equal(repo.recoveredFromBackup,fromBackup);
    const normalized=expectedMigration(original),restored=service.snapshot;
    assert.deepEqual(restored,normalized);assert.equal(restored.run.battle.balanceVersion,version);
    assert.equal(Object.hasOwn(restored.run.battle,'balanceVersion'),version===2);
    assert.deepEqual(restored.run.battle.units.map(u=>u.range),battle.units.map(u=>u.range));
    for(const unit of battle.units)assert.equal(unit.range,
      (version===undefined?{stone:1.2,spike:4.5,crystal:4,leaf:4,bubble:4}[unit.role]:require(path.join(build,'core/data.js')).ROLES[unit.role].range)+(unit.skills.includes('reach')?.3:0));
    service.checkpointBattle('range:pause',r.id,restored.run.battle);
    const again=new GameService(new SaveRepository(storage),{now:()=>NOW});
    assert.deepEqual(again.snapshot.run.battle,restored.run.battle);
    const reference=clone(restored.run.battle),resumed=clone(reference);
    for(const dt of [.025,.075,.125,1.1,3.25]){engine.stepBattle(reference,dt);stepBattle(resumed,dt);assert.deepEqual(resumed,clone(reference));}
    engine.stepBattle(reference,300);stepBattle(resumed,300);assert.deepEqual(resumed,clone(reference));assert.equal(resumed.status,'won');
    again.completeWave('range:finish',r.id,resumed);
    const nextRun=again.snapshot.run,next=createBattle(4,nextRun.wave+1,inputs(nextRun),{seed:77114,coreHealth:nextRun.coreHealth});
    assert.equal(next.balanceVersion,2);
    for(const unit of next.units){
      assert.equal(unit.range,require(path.join(build,'core/data.js')).ROLES[unit.role].range+(unit.skills.includes('reach')?.3:0));
      assert.deepEqual({x:unit.x,z:unit.z},CURRENT[unit.slot]);
    }
    again.beginWave('range:next',r.id,next);assert.deepEqual(decodeSave(storage.getItem(SAVE_KEY)).run.battle,next);
    for(const marker of [null,0,1,3,'2',false]){
      const invalid=clone(original);invalid.run.battle.balanceVersion=marker;
      assert.throws(()=>decodeSave(encodeSave(invalid)),/平衡版本/);
    }
  }
  assert.equal(BATTLE_RULES.encourageRange,4.5);assert.equal(BATTLE_RULES.shareRange,4.5);
});

test('boss migration keeps live fifth-unit state and real boss summon state, while layout histories cannot cross levels',()=>{
  const save=baseSave(),r=save.run;r.wave=11;r.phase='combat';
  const battle=freezeOld(createBattle(4,12,inputs(r),{seed:317}));
  for(let i=0;i<600&&battle.status==='fighting'&&!battle.enemies.some(e=>e.kind==='boss'&&e.summoned);i++)stepBattle(battle,.1);
  const boss=battle.enemies.find(e=>e.kind==='boss');assert.ok(boss?.summoned,'Real simulation reaches the boss summon event');
  assert.ok(battle.units.find(u=>u.slot===4).alive);r.battle=battle;
  const expected=expectedMigration(save),decoded=decodeSave(encodeSave(save));assert.deepEqual(decoded,expected);
  assert.deepEqual(decoded.run.battle.enemies,battle.enemies);assert.deepEqual(decoded.run.battle.events,battle.events);
  // Fifth-level unchanged slot2 must stay (3,1), although it is also a known old coral point.
  assert.deepEqual({x:decoded.run.battle.units.find(u=>u.slot===2).x,z:decoded.run.battle.units.find(u=>u.slot===2).z},OLD[2]);
  const coral=baseSave();coral.run.levelId=2;coral.run.wave=5;coral.run.phase='combat';
  coral.run.battle=createBattle(2,6,inputs(coral.run),{seed:5});
  Object.assign(coral.run.battle.units.find(u=>u.slot===4),CURRENT[4]);
  assert.throws(()=>decodeSave(encodeSave(coral)),/站位坐标/);
  const empty=makeInitialSave(NOW,8);assert.deepEqual(decodeSave(encodeSave(empty)),empty);
});
