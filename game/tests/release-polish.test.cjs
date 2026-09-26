const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle,commandBattle,getBattleEvents,positionOnRoute}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {SaveRepository,validateSave}=require('../.test-build/core/save.js');
const {currentUnits}=require('../.test-build/core/prototype.js');
const {prototypeSpawns}=require('../.test-build/core/prototypeConfig.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function input(role,skills,slot=0){const t=Object.values(makeInitialSave(1788948000000,27).collection).find(x=>x.role===role);return{id:role,slot,level:1,turtle:{...t,skills}};}
function field(role,skills,n=3){const b=createBattle(0,1,[input(role,skills)],{rulesVersion:'0.6',mode:'chapter',waveLimit:5,seed:274});b.autoSkills=false;b.units[0].nextAttackTick=10000;b.spawns=Array.from({length:n},()=>({kind:'ink',time:0,hpScale:500,attackScale:1}));stepBattle(b,.05);const u=b.units[0];let best=0,distance=Infinity;for(let d=0;d<b.routeLength;d+=.1){const p=positionOnRoute(b,d),delta=Math.hypot(p.x-u.x,p.z-u.z);if(delta<distance){best=d;distance=delta;}}for(const e of b.enemies)Object.assign(e,positionOnRoute(b,best),{distance:best,speed:0,range:1,nextAttackTick:1e6});return b;}
test('summons retain inherited stats, enemy damage, two-pet cap and lifetime across JSON save',()=>{
 const b=field('bubble',['bubbleRing']);const u=b.units[0];assert.ok(commandBattle(b,{type:'cast',unitId:u.id,skillId:'bubbleRing',point:{x:u.x,z:u.z}}));stepBattle(b,.05);
 assert.equal(b.summons.length,2);assert.equal(b.units.length,1);for(const p of b.summons){assert.equal(p.maxHp,u.maxHp*.35);assert.equal(p.attack,u.attack*.4);}
 const e=b.enemies[0];e.range=100;e.nextAttackTick=0;stepBattle(b,.05);assert.ok(b.summons.some(p=>p.hp<p.maxHp));
 getBattleEvents(b);validateBattle(b);const resumed=clone(b);for(let i=0;i<260;i++){stepBattle(b,.05);stepBattle(resumed,.05);getBattleEvents(b);getBattleEvents(resumed);validateBattle(b);}assert.deepEqual(b,resumed);assert.equal(b.summons.filter(p=>p.alive).length,0);
});
test('spirit golems land before damage, are immune and expire after five seconds',()=>{
 const b=field('bubble',['bubbleRing','spirit']),u=b.units[0];commandBattle(b,{type:'cast',unitId:u.id,skillId:'bubbleRing',point:{x:u.x,z:u.z}});stepBattle(b,.05);const born=b.tick;
 assert.ok(b.summons.every(p=>p.kind==='golem'));assert.ok(!b.events.some(e=>e.type==='damage'&&e.skillId==='spirit'));
 b.enemies.forEach(e=>{e.range=100;e.nextAttackTick=0;});stepBattle(b,.5);assert.ok(b.summons.every(p=>p.hp===p.maxHp));assert.ok(b.events.some(e=>e.type==='skill'&&e.effect==='landing'));
 while(b.tick<born+100)stepBattle(b,.05);assert.equal(b.summons.filter(p=>p.alive).length,0);validateBattle(b);
});
test('blizzard hits a bounded area in three pulses and never damages a distant enemy',()=>{
 const b=field('crystal',['crystalCannon','arcane'],4),u=b.units[0];b.enemies[3].distance=b.routeLength-1;Object.assign(b.enemies[3],positionOnRoute(b,b.routeLength-1));const far=b.enemies[3].hp;
 assert.ok(commandBattle(b,{type:'cast',unitId:u.id,skillId:'crystalCannon',point:{x:b.enemies[0].x,z:b.enemies[0].z}}));stepBattle(b,.05);const resumed=clone(b);
 stepBattle(b,3);stepBattle(resumed,3);assert.deepEqual(b,resumed);assert.equal(b.enemies[3].hp,far);
 const hits=b.events.filter(e=>e.type==='damage'&&e.skillId==='crystalCannon');assert.equal(hits.length,9);assert.ok(hits.every(e=>Math.abs(e.amount-u.attack*.8*1.2/(1+8/100))<1e-7));validateBattle(b);
});
test('scatter and extraTarget produce four distinct basic targets without recursion',()=>{
 const b=field('spike',['scatter','extraTarget'],6),u=b.units[0];u.nextAttackTick=0;stepBattle(b,.4);const hits=b.events.filter(e=>e.type==='damage');assert.equal(new Set(hits.map(e=>e.targetId)).size,4);assert.equal(hits.filter(e=>e.skillId==='scatter').length,2);assert.equal(hits.filter(e=>e.skillId==='extraTarget').length,1);
});
test('all normal chapter configurations have five bosses; final boss has stronger scaling',()=>{
 for(let level=0;level<50;level++){const bosses=[];for(let wave=1;wave<=5;wave++){const spawns=prototypeSpawns(level,wave,false,5);const boss=spawns.filter(s=>s.kind==='boss');assert.equal(boss.length,1);assert.ok(spawns.length>=10);bosses.push(boss[0]);}assert.ok(bosses[4].hpScale>bosses[3].hpScale);}
});
test('boss rescue refreshes unlocked slots exactly once and keeps old save resumes usable',()=>{
 const storage=new MemoryStorage(),service=new GameService(new SaveRepository(storage),{now:()=>1788948000000});service.beginPrototypeRun('start',0,Object.keys(service.snapshot.collection));let r=service.snapshot.run;
 const locked=currentUnits(r).find(u=>u.benchSlot===0);service.lockBench('lock',locked.id,true);r=service.snapshot.run;
 const b=createBattle(0,1,currentUnits(r).filter(u=>u.slot!==null),{rulesVersion:'0.6',mode:'chapter',waveLimit:r.waveLimit,seed:88});service.beginWave('begin',r.id,b);
 // Deterministic legal boss-death checkpoint; verifies reward transactions independently of combat balance.
 b.spawns=[{kind:'boss',time:0,hpScale:1,attackScale:0}];stepBattle(b,.05);b.enemies[0].hp=0;b.enemies[0].alive=false;b.kills=1;getBattleEvents(b);
 service.checkpointBattle('rescue',r.id,b);const after=service.snapshot;assert.deepEqual(after.run.bossRescuedWaves,[1]);assert.ok(currentUnits(after.run).some(u=>u.id===locked.id));
 const bench=currentUnits(after.run).filter(u=>u.benchSlot!==undefined);assert.ok(bench.filter(u=>u.id!==locked.id).every(u=>u.turtle.skills.length>=2));
 service.checkpointBattle('repeat',r.id,after.run.battle);assert.deepEqual(currentUnits(service.snapshot.run),currentUnits(after.run));validateSave(service.snapshot);
 const restored=new GameService(new SaveRepository(storage),{now:()=>1788948000000});assert.deepEqual(restored.snapshot.run.bossRescuedWaves,[1]);
});
test('avatar selection persists locally and invalid image data cannot commit',()=>{
 const storage=new MemoryStorage(),s=new GameService(new SaveRepository(storage),{now:()=>1788948000000});s.updateAvatar('role',{role:'stone'});assert.equal(new GameService(new SaveRepository(storage),{now:()=>1788948000000}).snapshot.avatar.role,'stone');
 const before=clone(s.snapshot);assert.throws(()=>s.updateAvatar('bad',{role:'bubble',image:'https://example.com/picture'}));assert.deepEqual(s.snapshot,before);
 s.updateAvatar('photo',{role:'crystal',image:'data:image/jpeg;base64,AAAA'});validateSave(s.snapshot);const broken=clone(s.snapshot);broken.avatar.image='data:text/html;base64,AAAA';assert.throws(()=>validateSave(broken));
});
test('holy light procs from regeneration and reduces the next actual hit by ten percent',()=>{
 const b=field('stone',['holyLight','regen'],1),u=b.units[0];u.hp=u.maxHp*.2;
 for(let i=0;i<600&&!u.holyUntilTick;i++)stepBattle(b,.05);
 assert.ok(u.holyUntilTick>b.tick);assert.equal(u.holyUntilTick-b.tick,60);assert.equal(u.holyReadyTick-b.tick,120);
 const plain=clone(b);plain.units[0].holyUntilTick=0;
 for(const x of [b,plain]){x.units[0].nextRegenTick=100000;x.units[0].nextAttackTick=100000;x.enemies[0].nextAttackTick=0;x.enemies[0].range=100;x.enemies[0].attack=40;getBattleEvents(x);}
 stepBattle(b,.05);stepBattle(plain,.05);const hit=x=>x.events.find(e=>e.type==='damage'&&e.targetId===u.id).amount;assert.ok(Math.abs(hit(b)/hit(plain)-.9)<1e-8);validateBattle(b);
});
test('daze slows the taunted enemy and counter storm obeys its three-second cooldown',()=>{
 const b=field('stone',['taunt','daze','counterStorm'],2),u=b.units[0];u.maxHp=10000;u.hp=10000;
 b.enemies.forEach(e=>{e.range=100;e.attack=1;e.interval=.05;e.nextAttackTick=0;});
 for(let i=0;i<300;i++)stepBattle(b,.05);
 assert.ok(u.skillActivations.daze>0);const triggers=b.events.filter(e=>e.type==='skill'&&e.skillId==='counterStorm');assert.ok(triggers.length>=2);
 for(let i=1;i<triggers.length;i++)assert.ok(triggers[i].tick-triggers[i-1].tick>=60);
 assert.ok(triggers.every(e=>e.amount>=1&&e.amount<=3));validateBattle(b);
});
test('new station bases clear every road while old active layouts keep their exact coordinates',()=>{
 const {BATTLE_MAPS,LEGACY_TACTICAL_MAPS,battleMap}=require('../.test-build/core/data.js');
 for(const map of BATTLE_MAPS.slice(0,54))for(const p of map.slots)for(const route of map.routes??[map.route])for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));assert.ok(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)>=1.08-1e-8,`map ${map.id}`);
 }
 const b=createBattle(0,1,[input('stone',['hold'])],{rulesVersion:'0.6',waveLimit:5});delete b.stationVersion;Object.assign(b.units[0],LEGACY_TACTICAL_MAPS[0].slots[0]);validateBattle(b);assert.equal(battleMap(b),LEGACY_TACTICAL_MAPS[0]);
 const resumed=clone(b);stepBattle(b,.5);stepBattle(resumed,.5);assert.deepEqual(b,resumed);assert.deepEqual({x:b.units[0].x,z:b.units[0].z},LEGACY_TACTICAL_MAPS[0].slots[0]);
});
