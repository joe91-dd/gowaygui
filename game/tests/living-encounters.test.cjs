const test=require('node:test'),assert=require('node:assert/strict');
const {createBattle,stepBattle,getBattleEvents}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
function encounter(kind){const b=createBattle(5,1,[],{rulesVersion:'0.6',mode:'chapter',waveLimit:5,seed:13});b.spawns=Array.from({length:6},(_,i)=>({kind,time:i*.05,hpScale:1,attackScale:1,routeId:0}));stepBattle(b,.4);return b;}
test('trait enemies checkpoint and resume deterministically; old snapshots do not gain traits',()=>{
 for(const kind of ['runner','snail','armored']){const b=encounter(kind);assert.ok(b.enemies.some(e=>e.trait));validateBattle(b);const copy=JSON.parse(JSON.stringify(b));stepBattle(b,4);stepBattle(copy,4);assert.deepEqual(copy,b);validateBattle(b);}
 const old=createBattle(5,1,[],{rulesVersion:'0.6',seed:5});delete old.encounterVersion;stepBattle(old,5);assert.ok(old.enemies.every(e=>!e.trait));
});
test('mender heals only injured living neighbors, capped at max HP',()=>{
 const b=encounter('snail'),healer=b.enemies.find(e=>e.trait==='mender'),target=b.enemies.find(e=>!e.trait);target.hp=target.maxHp*.5;const before=target.hp;healer.traitReadyTick=b.tick+1;
 stepBattle(b,.05);assert.ok(target.hp>before&&target.hp<=target.maxHp);assert.ok(getBattleEvents(b).some(e=>e.effect==='enemyMend'));validateBattle(b);
});
test('sheep prevents the special enemy ability from firing',()=>{
 const b=encounter('armored'),e=b.enemies.find(e=>e.trait==='bulwark');e.traitReadyTick=b.tick+1;e.statuses.push({kind:'sheep',amount:1,untilTick:b.tick+50,sourceId:e.id});getBattleEvents(b);stepBattle(b,.1);assert.ok(!getBattleEvents(b).some(e=>e.effect==='shellBrace'));
});
