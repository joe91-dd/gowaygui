const test=require('node:test'),assert=require('node:assert/strict');
const built=process.env.GOWAYGUI_BATTLE_BUILD?require('../tools/test-built-core.cjs').loadBuiltCore(process.env.GOWAYGUI_BATTLE_BUILD):undefined;
const {GameService,makeInitialSave}=built?built.load('game'):require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave}=built?built.load('save'):require('../.test-build/core/save.js');
const {MemoryStorage}=built?built.load('storage'):require('../.test-build/platform/storage.js');
const now=1789545600000;
for(const old of ['chapter','raid','arena'])for(const next of ['chapter','endless','raid','arena','practice'])test(`${old} to ${next} settles and starts atomically, including duplicate commands`,()=>{
 const storage=new MemoryStorage(),s=makeInitialSave(now,1234);s.cleared=[0,1];s.unlockedLevel=2;storage.setItem(SAVE_KEY,encodeSave(s));
 const game=new GameService(new SaveRepository(storage),{now:()=>now});game.enablePrototype('enable');game.communityAction('init',{kind:'init'});const ids=Object.keys(game.snapshot.collection),opponent=game.snapshot.community.arenaOrder.at(-2);
 const start=(mode,key,replace=false,invalid=false)=>mode==='raid'?game.beginRaid(key,0,invalid?[]:ids,replace):mode==='arena'?game.beginArena(key,invalid?'missing':opponent,ids,replace):mode==='practice'?game.beginArenaPractice(key,invalid?'missing':opponent,replace):game.beginPrototypeRun(key,invalid?99:1,invalid?[]:ids,mode,replace);
 start(old,'old');const before=game.snapshot,raw=storage.getItem(SAVE_KEY);
 assert.throws(()=>start(next,'blocked'));assert.deepEqual(game.snapshot,before);assert.equal(storage.getItem(SAVE_KEY),raw);
 assert.throws(()=>start(next,'invalid',true,true));assert.deepEqual(game.snapshot,before);assert.equal(storage.getItem(SAVE_KEY),raw);
 const result=start(next,'new',true),after=game.snapshot;assert.deepEqual(start(next,'new',true),result);assert.deepEqual(game.snapshot,after);
 if(old==='chapter')assert.equal(after.results[before.run.id].victory,false);
 if(next==='chapter'||next==='endless')assert.equal(after.run.mode,next);else assert.equal(after.community[next==='practice'?'arena':next].settled,false);
 const reloaded=new GameService(new SaveRepository(storage),{now:()=>now});assert.deepEqual(reloaded.snapshot,after);
});
