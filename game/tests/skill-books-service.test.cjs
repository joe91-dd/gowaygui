const test=require('node:test');
const assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave,decodeSave,validateSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {createBattle}=require('../.test-build/core/battle.js');

const NOW=1788830000000;
const clone=value=>JSON.parse(JSON.stringify(value));
// Controlled inventory exists ONLY in these independent MemoryStorage fixtures.
// It stimulates production rules/transactions; it does not prove book drops,
// reward frequencies or the live player economy. No browser/user save is read.
function fixture(books={hold:1},edit=()=>{}){
  const initial=makeInitialSave(NOW,0x6f73412);initial.unlockedLevel=4;
  for(const t of Object.values(initial.collection))t.skills=[...require("../.test-build/core/data.js").ROLES[t.role].starters];
  if(books===undefined)delete initial.skillBooks;else initial.skillBooks=clone(books);
  edit(initial);
  const storage=new MemoryStorage(),clock={now:()=>NOW};storage.setItem(SAVE_KEY,encodeSave(initial));
  return {storage,clock,initial,game:new GameService(new SaveRepository(storage),clock)};
}
function reopen(f){f.game=new GameService(new SaveRepository(f.storage),f.clock);return f.game;}
function units(g){return Object.values(g.snapshot.run.units).filter(u=>!u.consumedBy);}
function battleFor(g){const r=g.snapshot.run;return createBattle(r.levelId,r.wave+1,units(g).filter(u=>u.slot!==null),{coreHealth:r.coreHealth});}
// A validated wave-completion fixture reaches the collection transaction edge.
// Actual battle skill behavior is covered in skill-books.test.cjs; this helper
// is not an endless-mode reward or combat implementation.
function completeWave(g){
  const r=g.snapshot.run,number=r.wave+1,start=battleFor(g);
  g.beginWave(`books:start:${r.id}:${number}`,r.id,start);
  const done={...clone(start),spawns:[],spawnCursor:0,events:[],status:'won',tick:500,elapsed:25};
  g.completeWave(`books:finish:${r.id}:${number}`,r.id,done);
}
function prepareMerge(){
  const f=fixture(),ids=['t-1','t-2'];f.game.beginRun('books:prepare',1,ids);
  completeWave(f.game);f.game.recruit('books:recruit-b',{permanentId:ids[1]});
  while(f.game.snapshot.run.wave<4)completeWave(f.game);
  const [a,b]=units(f.game),child=f.game.merge('books:merge',a.id,b.id);
  return {...f,ids,child};
}
function rejectsWithoutMutation(f,command,turtleId,bookSkillId){
  const before=f.game.snapshot,raw=f.storage.getItem(SAVE_KEY);
  assert.throws(()=>f.game.learnSkillBook(command,turtleId,bookSkillId));
  assert.deepEqual(f.game.snapshot,before);assert.equal(f.storage.getItem(SAVE_KEY),raw);
}
const count=(save,id)=>save.skillBooks?.[id]??0;

test('missing or zero book inventory rejects consumption without advancing RNG or changing the save',()=>{
  for(const inventory of [{},{hold:0}]){
    const f=fixture(inventory);rejectsWithoutMutation(f,'books:none','t-1','hold');
  }
  const legacy=fixture({},s=>delete s.skillBooks);
  rejectsWithoutMutation(legacy,'books:legacy-none','t-1','hold');
});

test('owned, incompatible, nonexistent skills and a missing turtle are rejected before inventory or RNG changes',()=>{
  const cases=[
    [{strong:1},'t-1','strong'],
    [{greatHeal:1},'t-1','greatHeal'],
    [{hold:1},'t-4','hold'],
    [{hold:1},'t-1','unknown-skill'],
    [{hold:1},'missing-turtle','hold'],
  ];
  cases.forEach(([inventory,id,book],i)=>rejectsWithoutMutation(fixture(inventory),`books:invalid:${i}`,id,book));
});

test('prep, between, combat and unrevealed merge phases reject outside-run books without touching run snapshots',()=>{
  for(const phase of ['prep','between','combat','reveal']){
    let f;
    if(phase==='reveal')f=prepareMerge();
    else{
      f=fixture();f.game.beginRun('books:active-run',1,['t-1']);
      if(phase==='between')completeWave(f.game);
      if(phase==='combat')f.game.beginWave('books:active-wave',f.game.snapshot.run.id,battleFor(f.game));
    }
    assert.equal(f.game.snapshot.run.phase,phase);
    rejectsWithoutMutation(f,`books:reject:${phase}`,'t-1','hold');
    reopen(f);assert.equal(f.game.snapshot.run.phase,phase);
  }
});

test('success consumes one matching book, preserves all other permanent fields and the next run receives the learned skill',()=>{
  const f=fixture({hold:2,regen:3}),before=f.game.snapshot;
  const receipt=f.game.learnSkillBook('books:learn','t-1','hold'),after=f.game.snapshot;
  assert.equal(count(after,'hold'),1);assert.equal(count(after,'regen'),3);
  assert.equal(after.gold,before.gold);assert.deepEqual(after.materials,before.materials);
  assert.equal(after.idCounter,before.idCounter);assert.equal(after.revision,before.revision+1);
  assert.notEqual(after.rng,before.rng);assert.deepEqual(after.history,before.history);
  assert.deepEqual(receipt.beforeSkills,before.collection['t-1'].skills);
  assert.deepEqual(receipt.afterSkills,after.collection['t-1'].skills);
  assert.equal(receipt.bookSkillId,'hold');assert.equal(receipt.turtleId,'t-1');
  assert.equal(receipt.replacedSkillId,receipt.beforeSkills[receipt.replacedIndex]);
  assert.equal(receipt.afterSkills[receipt.replacedIndex],'hold');
  assert.equal(receipt.afterSkills.length,receipt.beforeSkills.length);
  const {skills:oldSkills,...oldTurtle}=before.collection['t-1'];
  const {skills:newSkills,...newTurtle}=after.collection['t-1'];assert.deepEqual(newTurtle,oldTurtle);
  for(const id of Object.keys(before.collection).filter(id=>id!=='t-1'))assert.deepEqual(after.collection[id],before.collection[id]);
  f.game.beginRun('books:next-run',0,['t-1']);
  assert.deepEqual(units(f.game)[0].turtle.skills,receipt.afterSkills);
  assert.deepEqual(battleFor(f.game).units[0].skills,receipt.afterSkills);
});

test('restart and repeated command replay return the original receipt without another book, RNG draw or revision',()=>{
  const f=fixture({hold:2}),receipt=f.game.learnSkillBook('books:replay','t-1','hold'),committed=f.game.snapshot;
  const raw=f.storage.getItem(SAVE_KEY);reopen(f);
  assert.deepEqual(f.game.learnSkillBook('books:replay','t-1','hold'),receipt);
  assert.deepEqual(f.game.snapshot,committed);assert.equal(f.storage.getItem(SAVE_KEY),raw);
  rejectsWithoutMutation(f,'books:new-click-owned','t-1','hold');
  // External receipt mutations cannot edit either the journal or collection.
  const external=f.game.learnSkillBook('books:replay','t-1','hold');external.afterSkills[0]='greatHeal';
  assert.deepEqual(f.game.learnSkillBook('books:replay','t-1','hold'),receipt);
  assert.deepEqual(f.game.snapshot,committed);
});

test('a primary write failure rolls back skill, book, RNG and in-memory receipt; retry after restart applies once',()=>{
  const f=fixture(),before=f.game.snapshot,raw=f.storage.getItem(SAVE_KEY),set=f.storage.setItem.bind(f.storage);
  const expected=fixture().game.learnSkillBook('books:write-fail','t-1','hold');let fail=true;
  f.storage.setItem=(key,value)=>{if(key===SAVE_KEY&&fail){fail=false;throw new Error('book disk full');}set(key,value);};
  assert.throws(()=>f.game.learnSkillBook('books:write-fail','t-1','hold'),/disk full/);
  assert.deepEqual(f.game.snapshot,before);assert.equal(f.storage.getItem(SAVE_KEY),raw);
  reopen(f);assert.deepEqual(f.game.learnSkillBook('books:write-fail','t-1','hold'),expected);
  const committed=f.game.snapshot;reopen(f);
  assert.deepEqual(f.game.learnSkillBook('books:write-fail','t-1','hold'),expected);
  assert.deepEqual(f.game.snapshot,committed);assert.equal(count(committed,'hold'),0);
});

test('a write that persisted before throwing is recovered by its command receipt without duplicate consumption',()=>{
  const f=fixture({hold:2}),set=f.storage.setItem.bind(f.storage);let fail=true;
  f.storage.setItem=(key,value)=>{set(key,value);if(key===SAVE_KEY&&fail){fail=false;throw new Error('book acknowledgement lost');}};
  assert.throws(()=>f.game.learnSkillBook('books:lost-ack','t-1','hold'),/acknowledgement lost/);
  reopen(f);const committed=f.game.snapshot,receipt=f.game.learnSkillBook('books:lost-ack','t-1','hold');
  assert.deepEqual(f.game.snapshot,committed);assert.equal(count(committed,'hold'),1);
  assert.deepEqual(receipt.afterSkills,committed.collection['t-1'].skills);
});

test('a stale service cannot overwrite the committed book operation or consume a second inventory copy',()=>{
  const f=fixture({hold:2}),stale=new GameService(new SaveRepository(f.storage),f.clock),staleBefore=stale.snapshot;
  f.game.learnSkillBook('books:first-tab','t-1','hold');const raw=f.storage.getItem(SAVE_KEY);
  assert.throws(()=>stale.learnSkillBook('books:stale-tab','t-1','hold'),/另一个页面/);
  assert.deepEqual(stale.snapshot,staleBefore);assert.equal(f.storage.getItem(SAVE_KEY),raw);
  assert.equal(count(decodeSave(raw),'hold'),1);
});

test('in result, collecting an old savedId snapshot or replaying its older receipt cannot roll back a book',()=>{
  const f=fixture();f.game.beginRun('books:saved-run',0,['t-1']);const u=units(f.game)[0];
  const oldReceipt=f.game.collect('books:old-collect',u.id);f.game.abandonRun('books:saved-result');
  const runBefore=f.game.snapshot.run;
  const learned=f.game.learnSkillBook('books:result-learn','t-1','hold'),saved=f.game.snapshot.collection['t-1'];
  assert.deepEqual(f.game.snapshot.run,runBefore);assert.equal(f.game.snapshot.run.units[u.id].savedId,'t-1');
  assert.deepEqual(f.game.snapshot.run.units[u.id].turtle.skills,learned.beforeSkills);
  reopen(f);assert.deepEqual(f.game.collect('books:collect-again',u.id),saved);
  assert.deepEqual(f.game.collect('books:old-collect',u.id),oldReceipt);
  assert.deepEqual(f.game.snapshot.collection['t-1'],saved);assert.deepEqual(f.game.snapshot.run,runBefore);
  assert.equal(count(f.game.snapshot,'hold'),0);assert.equal(Object.keys(f.game.snapshot.history).length,0);
});

test('a fixed uncollected C remains unchanged after result-booking A, then collects the latest A into history without a refund',()=>{
  const f=prepareMerge(),fixed=clone(f.child.turtle);f.game.abandonRun('books:merge-result');
  const oldRun=f.game.snapshot.run,beforeB=f.game.snapshot.collection['t-2'];
  const learned=f.game.learnSkillBook('books:ancestor-learn','t-1','hold'),latestA=f.game.snapshot.collection['t-1'];
  assert.deepEqual(f.game.snapshot.run,oldRun);assert.deepEqual(f.game.snapshot.run.units[f.child.id].turtle,fixed);
  const preview=f.game.collectionPreview(f.child.id);
  assert.deepEqual(preview.candidate,fixed);assert.deepEqual(preview.sources.find(t=>t.id==='t-1'),latestA);
  assert.deepEqual(latestA.skills,learned.afterSkills);reopen(f);
  const collected=f.game.collect('books:collect-fixed',f.child.id);
  assert.deepEqual(collected,fixed);assert.deepEqual(f.game.snapshot.history['t-1'].turtle,latestA);
  assert.deepEqual(f.game.snapshot.history['t-2'].turtle,beforeB);
  assert.equal(f.game.snapshot.history['t-1'].replacementId,fixed.id);
  assert.equal(f.game.snapshot.collection['t-1'],undefined);assert.equal(count(f.game.snapshot,'hold'),0);
  assert.deepEqual(f.game.snapshot.run.units[f.child.id].sources,[fixed.id]);
  const committed=f.game.snapshot;reopen(f);f.game.collect('books:collect-fixed',f.child.id);
  assert.deepEqual(f.game.snapshot,committed);
});

test('legacy saves missing book inventory reopen and survive an unrelated transaction without receiving books',()=>{
  const f=fixture({},s=>delete s.skillBooks),raw=f.storage.getItem(SAVE_KEY);
  assert.equal(count(f.game.snapshot,'hold'),0);assert.equal(f.storage.getItem(SAVE_KEY),raw);
  f.game.updateSettings('books:legacy-settings',{effects:.4});reopen(f);
  assert.equal(count(f.game.snapshot,'hold'),0);
  assert.equal(Object.values(f.game.snapshot.skillBooks??{}).reduce((sum,n)=>sum+n,0),0);
  rejectsWithoutMutation(f,'books:legacy-after-settings','t-1','hold');
});

test('malformed present book inventories are rejected by validation and decoding, while zero and empty maps are valid',()=>{
  const base=makeInitialSave(NOW,91);
  const bad=[null,[],true,3,'hold',{unknownSkill:1},{hold:-1},{hold:1.5},{hold:'1'},
    {hold:null},{hold:Number.MAX_SAFE_INTEGER+1},JSON.parse('{"__proto__":1}')];
  for(const inventory of bad){
    const save=clone(base);save.skillBooks=inventory;
    assert.throws(()=>validateSave(save),`inventory=${JSON.stringify(inventory)}`);
    assert.throws(()=>decodeSave(encodeSave(save)),`decode inventory=${JSON.stringify(inventory)}`);
  }
  for(const inventory of [{},{hold:0},{hold:2,regen:1}]){
    const save=clone(base);save.skillBooks=inventory;
    assert.doesNotThrow(()=>validateSave(save));assert.deepEqual(decodeSave(encodeSave(save)).skillBooks,inventory);
  }
});
