const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./test-coast-mechanics.cjs'),{fresh}=require('./test-coast-trial.cjs'),B=require('../.test-coast/core/battle'),R=require('../.test-coast/core/expeditionRules');
const b=fresh(0);for(const wave of [1,2,4,5,10]){b.wave=wave;const spawns=R.expeditionSpawns(b);if(wave<=2)assert.ok(spawns.every(s=>!['armored','mist','elite'].includes(s.kind)));if(wave>=4)for(const kind of ['armored','mist'])assert.ok(spawns.some(s=>s.kind===kind));if(wave>=5)assert.equal(spawns.filter(s=>s.kind==='elite').length,wave>=9?2:1);assert.ok(spawns.filter(s=>['ink','runner','snail'].includes(s.kind)).length>spawns.length/2);}
const finalWave=fresh(0);finalWave.wave=9;finalWave.expedition.completed=8;finalWave.spawns=R.expeditionSpawns(finalWave);B.stepBattle(finalWave,finalWave.spawns.find(s=>s.kind==='boss').time+.1);assert.equal(finalWave.enemies.find(e=>e.kind==='boss').leak,10);assert.ok(R.trialHint(finalWave).includes('10守护'));
const f=fixture('crystal',0),u=f.u,e=f.e;u.hp=u.maxHp*.3;u.skills=['crystalCannon'];u.skillActivations={};u.cooldowns={};u.nextAttackTick=f.b.tick;f.b.expedition.players[0].buffs.drain=10;
for(let i=0;i<5;i++)f.b.enemies.push({...structuredClone(e),id:'enemy-1-'+f.b.nextEnemyId++,x:e.x+i*.08});
const before=u.hp;B.stepBattle(f.b,.4);assert.ok(u.hp>before);assert.ok(u.hp-before<=u.maxHp*.02+1e-6,'AoE life steal must share the one-second recovery budget');
u.nextAttackTick=f.b.tick;B.stepBattle(f.b,.4);assert.ok(u.hp-before<=u.maxHp*.02+1e-6,'another attack inside the window cannot reset the budget');
u.nextAttackTick=99999;B.stepBattle(f.b,1);u.nextAttackTick=f.b.tick;const later=u.hp;B.stepBattle(f.b,.4);assert.ok(u.hp>later,'life steal resumes after its rolling window');
const oldFile=path.resolve(__dirname,'../.server-build-rhythm/core/expeditionRules.js');
if(fs.existsSync(oldFile)){const old=require(oldFile);for(const map of [1,2,3,4,5,14,49,50,51,52,53,54,55,56]){const state=fresh(map);for(const wave of [1,4,5,7,10]){state.wave=wave;assert.deepEqual(R.expeditionSpawns(state),old.expeditionSpawns(state),'other map schedule changed: '+map);}}}
console.log('PASS first-map gradual guards, clearable majority, bounded AoE life steal, other-map schedule regression');
