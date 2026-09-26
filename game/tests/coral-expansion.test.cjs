const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game');
const {createBattle,stepBattle,moveBattleUnit,replaceBattleUnit,positionOnRoute}=require('../.test-build/core/battle');
const {BOSSES,bossFor,bossEncounters}=require('../.test-build/core/bossCatalog');
const {BATTLE_MAPS}=require('../.test-build/core/data');
const {placementIssue,fieldIssue}=require('../.test-build/core/placement');
const {validateBattle}=require('../.test-build/core/battleValidation');
const {SaveRepository,validateSave,encodeSave,decodeSave}=require('../.test-build/core/save');
const {MemoryStorage}=require('../.test-build/platform/storage');
const {discoverBattle}=require('../.test-build/core/progression');
const clone=x=>JSON.parse(JSON.stringify(x)),now=1789401600000;
function points(map,others=[]){const out=[];for(let x=-8;x<8;x+=.2)for(let z=-4;z<4;z+=.2){const p={x:Math.round(x*100)/100,z:Math.round(z*100)/100};if(!placementIssue(map,p,others))out.push(p);}return out;}
function team(){return Object.values(makeInitialSave(now,55).collection).slice(0,5).map((t,i)=>({id:t.id,turtle:t,slot:i,level:1}));}
test('48 distinct bosses have exact tier counts, unique art cells and real campaign encounters',()=>{
 assert.deepEqual(Array.from({length:6},(_,i)=>BOSSES.filter(b=>b.tier===i).length),[10,10,8,8,6,6]);assert.equal(new Set(BOSSES.map(b=>b.id)).size,48);assert.equal(new Set(BOSSES.filter(b=>b.art).map(b=>b.art+':'+b.cell)).size,42);
 const found=new Set();for(let l=0;l<50;l++)for(let w=1;w<=5;w++)found.add(bossFor(l,w).id);assert.equal(found.size,48);for(const b of BOSSES){assert.ok(bossEncounters(b.id).length);assert.ok(b.ability&&b.dropBook);}
});
test('free placement survives a half-complete transfer and rejects route, sea, overlap without mutation',()=>{
 const inputs=team(),b=createBattle(0,1,inputs,{rulesVersion:'0.6',waveLimit:5});b.autoSkills=false;b.units.forEach(u=>u.nextAttackTick=1e8);b.spawns=[{time:999,kind:'ink',hpScale:1,attackScale:1}];
 const u=b.units[0],p=points(BATTLE_MAPS[0],b.units.slice(1))[25];assert.ok(p);u.hp-=12;u.cooldowns.hold=999;
 moveBattleUnit(b,u.id,u.slot,p);stepBattle(b,.5);validateBattle(b);const restored=clone(b);stepBattle(b,.5);stepBattle(restored,.5);assert.deepEqual(b,restored);assert.deepEqual({x:u.x,z:u.z},p);assert.equal(u.cooldowns.hold,999);assert.equal(u.hp,u.maxHp-12);
 const before=clone(b);for(const invalid of [b.route[0],{x:100,z:100},b.units[1]]){assert.throws(()=>moveBattleUnit(b,u.id,u.slot,invalid));assert.deepEqual(b,before);}assert.throws(()=>moveBattleUnit(b,u.id,u.slot,points(BATTLE_MAPS[0],b.units)[0]),/冷却/);
 assert.ok(fieldIssue(BATTLE_MAPS[0],[{slot:0,placement:p},{slot:1,placement:p}]));
});
test('service saves free land coordinates through start, checkpoint and reload',()=>{
 const storage=new MemoryStorage(),g=new GameService(new SaveRepository(storage),{now:()=>now},55),ids=Object.keys(g.snapshot.collection);g.beginPrototypeRun('start',0,ids,'chapter');
 let r=g.snapshot.run,units=Object.values(r.units).filter(u=>u.slot!==null),u=units[0],p=points(BATTLE_MAPS[0],units.slice(1).map(v=>BATTLE_MAPS[0].slots[v.slot]))[40];
 g.placeUnit('place',u.id,p);r=g.snapshot.run;units=Object.values(r.units).filter(u=>u.slot!==null);const b=createBattle(0,1,units,{rulesVersion:'0.6',waveLimit:5});g.beginWave('begin',r.id,b);stepBattle(b,.2);g.checkpointBattle('checkpoint',r.id,b);validateSave(g.snapshot);
 const loaded=new GameService(new SaveRepository(storage),{now:()=>now});assert.deepEqual(loaded.snapshot.run.units[u.id].placement,p);assert.deepEqual(loaded.snapshot.run.battle.units[0].placement,p);
 const bad=clone(g.snapshot);bad.run.units[u.id].placement={x:99,z:99};assert.throws(()=>validateSave(bad));
});
test('boss loot is an idempotent persisted receipt, escape gives nothing',()=>{
 const s=makeInitialSave(now,9);s.run={id:'proof'};const b={faunaVersion:1,wave:1,enemies:[{id:'enemy-1-1',bossId:BOSSES[0].id,alive:false,hp:1}]},gold=s.gold;
 discoverBattle(s,b);assert.equal(s.gold,gold);b.enemies[0].hp=0;discoverBattle(s,b);assert.ok(s.gold>gold);const once=clone(s);discoverBattle(s,b);assert.deepEqual(s,once);const reload=clone(s);discoverBattle(reload,b);assert.deepEqual(reload,s);
});
test('boss telegraph deals damage only after its windup and is interrupted by control',()=>{
 const b=createBattle(0,1,team(),{rulesVersion:'0.6',waveLimit:5});b.autoSkills=false;b.spawns=[{kind:'boss',time:0,hpScale:100,attackScale:1},{kind:'ink',time:999,hpScale:1,attackScale:1}];stepBattle(b,.05);
 const e=b.enemies[0],u=b.units[0];let progress=0,d=Infinity;for(let x=0;x<b.routeLength;x+=.05){const p=positionOnRoute(b,x),distance=Math.hypot(u.x-p.x,u.z-p.z);if(distance<d){d=distance;progress=x;}}
 Object.assign(e,positionOnRoute(b,progress),{distance:progress,speed:0,nextAttackTick:1e8,abilityReadyTick:b.tick});b.units.forEach(u=>u.nextAttackTick=1e8);stepBattle(b,.05);assert.ok(e.cast);const hp=u.hp;stepBattle(b,.5);assert.equal(u.hp,hp);validateBattle(b);
 const cancelled=clone(b);cancelled.enemies[0].statuses.push({kind:'stun',amount:1,untilTick:b.tick+50,sourceId:u.id});stepBattle(cancelled,.05);assert.equal(cancelled.enemies[0].cast,undefined);assert.ok(cancelled.events.some(e=>e.effect==='castInterrupted'));
 stepBattle(b,1);assert.ok(u.hp<hp);validateBattle(b);
});
