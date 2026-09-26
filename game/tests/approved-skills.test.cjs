const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave,GameService}=require('../.test-build/core/game');
const {createBattle,stepBattle,positionOnRoute}=require('../.test-build/core/battle');
const {validateBattle}=require('../.test-build/core/battleValidation');
const {SaveRepository}=require('../.test-build/core/save');
const {MemoryStorage}=require('../.test-build/platform/storage');
const clone=x=>JSON.parse(JSON.stringify(x));
function field(skills,role='spike'){
 const t=Object.values(makeInitialSave(1788948000000,27).collection).find(t=>t.role===role);
 const b=createBattle(0,1,[{id:'u',slot:0,level:1,turtle:{...t,skills}}],{rulesVersion:'0.6',seed:89,waveLimit:5});
 b.autoSkills=false;b.spawns=[{kind:'ink',time:0,hpScale:1000,attackScale:1}];stepBattle(b,.05);
 const u=b.units[0],e=b.enemies[0];let near=0,d=Infinity;for(let i=0;i<b.routeLength;i+=.05){const p=positionOnRoute(b,i),a=Math.hypot(p.x-u.x,p.z-u.z);if(a<d){d=a;near=i}}
 Object.assign(e,positionOnRoute(b,near),{distance:near,speed:0,range:100,nextAttackTick:1e8});u.range=100;return b;
}
test('home lineup persists order and never starts a challenge or consumes stamina',()=>{
 const storage=new MemoryStorage(),svc=new GameService(new SaveRepository(storage),{now:()=>1788948000000}),before=svc.snapshot,ids=Object.keys(before.collection).reverse();
 svc.setHomeTeam('team',ids);const after=svc.snapshot;assert.deepEqual(after.homeTeam,ids);assert.equal(after.stamina,before.stamina);assert.equal(after.run,before.run);
 assert.deepEqual(new GameService(new SaveRepository(storage),{now:()=>1788948000000}).snapshot.homeTeam,ids);
 assert.throws(()=>svc.setHomeTeam('duplicate',[ids[0],ids[0]]));assert.throws(()=>svc.setHomeTeam('missing',['absent']));
});
test('capricious fate has both outcomes; the tenfold hit never removes more than half current HP',()=>{
 let lucky=0,heals=0;
 for(let i=0;i<1000&&(!lucky||!heals);i++){const b=field(['caprice']),u=b.units[0],e=b.enemies[0];b.rng=((i+1)*2654435761)>>>0;e.hp=e.maxHp*.4;const hp=e.hp;u.attack=1e6;u.nextAttackTick=b.tick;delete u.pendingAttack;b.events=[];stepBattle(b,.35);for(const ev of b.events){if(ev.skillId==='caprice'&&ev.type==='damage'){lucky++;assert.ok(ev.critical);assert.ok(ev.amount<=hp*.5+1e-7)}if(ev.skillId==='caprice'&&ev.type==='heal'){heals++;assert.ok(Math.abs(ev.amount-e.maxHp*.2)<1e-6)}}validateBattle(b);}
 assert.ok(lucky&&heals);
});
test('polymorph changes status, suppresses attacks, slows and restores after expiry',()=>{
 const b=field(['polymorph']),u=b.units[0],e=b.enemies[0];u.attack=1;e.attack=0;
 for(let i=0;i<400&&!e.statuses.some(s=>s.kind==='sheep');i++){u.nextAttackTick=b.tick;stepBattle(b,.35)}
 const sheep=e.statuses.find(s=>s.kind==='sheep');assert.ok(sheep);assert.ok(e.statuses.some(s=>s.kind==='slow'));u.nextAttackTick=1e8;e.nextAttackTick=0;
 const attacks=e.attackCount;stepBattle(b,.15);assert.equal(e.attackCount,attacks);const restored=clone(b);stepBattle(b,3);stepBattle(restored,3);assert.deepEqual(b,restored);assert.ok(!e.statuses.some(s=>s.kind==='sheep'));validateBattle(b);
});
test('fervor shortens active recovery; giant expires without health refill, including after save',()=>{
 const b=field(['fervor','giant','hold'],'stone'),u=b.units[0],e=b.enemies[0];u.nextAttackTick=1e8;e.attack=.01;e.interval=.05;e.nextAttackTick=0;u.hp=u.maxHp*.2;const base=u.maxHp;u.cooldowns.hold=10000;
 for(let i=0;i<400&&!u.giantBaseMaxHp;i++)stepBattle(b,.05);assert.ok(u.giantBaseMaxHp);assert.equal(u.maxHp,base*1.6);assert.ok(u.hp/u.maxHp<.3);const copied=clone(b);validateBattle(copied);
 for(let i=0;i<180;i++){stepBattle(b,.05);stepBattle(copied,.05)}assert.deepEqual(b,copied);assert.equal(u.maxHp,base);assert.equal(u.giantBaseMaxHp,undefined);assert.ok(u.cooldowns.hold<10000);assert.ok(!u.skillActivations.lifesteal&&!u.skillActivations.spellDrain);validateBattle(b);
});
