const assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./test-built-core.cjs').loadBuiltCore('build/approved-mode-scenes-20260923').load;
const current=process.argv[2]?require('./test-built-core.cjs').loadBuiltCore(process.argv[2]).load:n=>require('../.test-build/core/'+n+'.js');
const {GameService,makeInitialSave}=load('game'),{MemoryStorage}=load('storage'),{SaveRepository,SAVE_KEY,encodeSave}=load('save'),{createBattle,stepBattle}=load('battle');
const {decodeSave,encodeSave:encodeNew}=current('save'),{sceneGroundIssue}=current('sceneGeometry');
const plain=x=>JSON.parse(JSON.stringify(x));let cases=0;
for(const id of [0,5,10,15,28,31,32,49]){
 const storage=new MemoryStorage(),initial=makeInitialSave(1788830000000,731);initial.unlockedLevel=49;
 storage.setItem(SAVE_KEY,encodeSave(initial));const game=new GameService(new SaveRepository(storage),{now:()=>1788830000000});game.enablePrototype('on');game.beginPrototypeRun('go',id,Object.keys(game.snapshot.collection).slice(0,5));
 let old=game.snapshot;
 const map=load('data').BATTLE_MAPS[id],field=Object.values(old.run.units).filter(u=>u.slot!==null),others=field.slice(1).map(u=>map.slots[u.slot]);let custom;
 for(let z=-3;z<3&&!custom;z+=.3)for(let x=-6;x<6;x+=.3){const p={x,z};if(!load('placement').placementIssue(map,p,others)&&sceneGroundIssue(id,p)){custom=p;break;}}
 if(custom){game.placeUnit('old-free-point',field[0].id,custom);old=game.snapshot;const prep=decodeSave(encodeSave(old));assert.ok(!sceneGroundIssue(id,prep.run.units[field[0].id].placement));}
 const b=createBattle(id,1,Object.values(old.run.units).filter(u=>u.slot!==null),{rulesVersion:'0.6',mode:'chapter',waveLimit:5});game.beginWave('fight',old.run.id,b);stepBattle(b,5);game.checkpointBattle('save',old.run.id,b);old=plain(game.snapshot);
 const raw=encodeSave(old),fixed=decodeSave(raw);assert.equal(fixed.gold,old.gold);assert.deepEqual(plain(fixed.collection),old.collection);assert.equal(fixed.run.battle.tick,old.run.battle.tick);assert.equal(fixed.run.battle.rng,old.run.battle.rng);assert.deepEqual(plain(fixed.run.battle.units.map(u=>u.hp)),old.run.battle.units.map(u=>u.hp));assert.ok(fixed.run.battle.units.every(u=>!sceneGroundIssue(id,u.placement??u)));
 assert.deepEqual(plain(decodeSave(encodeNew(fixed))),plain(fixed));cases++;console.log('Saved battle upgraded:',id+1);
}
console.log('Released-save migration preserves collection, health, wave clock and random state:',cases);
