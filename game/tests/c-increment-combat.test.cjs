const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {initCommunity}=require('../.test-build/core/community.js');
const {startArena,stepArena,arenaOutcome,finishArena}=require('../.test-build/core/arena.js');
const {createBattle,stepBattle,commandBattle,commandAllSkills,legalSkillTargets}=require('../.test-build/core/battle.js');
const NOW=1788948000000,copy=x=>JSON.parse(JSON.stringify(x));
test('C auto skill toggle leaves basic attacks on and repeatedly casts after cooldown, then stops',()=>{
 const b=battle(),u=b.units[1];b.autoSkills=false;u.nextAttackTick=0;stepBattle(b,.4);
 assert.ok(u.attackCount>0);assert.equal(u.skillActivations.piercingShot,undefined);
 b.autoSkills=true;stepBattle(b,24);assert.ok(u.skillActivations.piercingShot>=2);
 b.autoSkills=false;const count=u.skillActivations.piercingShot;stepBattle(b,25);assert.equal(u.skillActivations.piercingShot,count);
 u.actionUntilTick=0;assert.ok(commandBattle(b,{type:'cast',unitId:u.id,skillId:'piercingShot'}));stepBattle(b,.05);assert.equal(u.skillActivations.piercingShot,count+1);
});
test('C disabling our active skills does not disable the opposing arena AI',()=>{
 const {duelActions}=require('../.test-build/core/battle.js'),b=battle(),ours=b.units[1],opponent=copy(b.units[1]);opponent.id='opponent';opponent.x=1;
 b.controlledUnitIds=[ours.id];b.autoSkills=false;duelActions(b,[ours],[opponent]);
 assert.equal(ours.skillActivations.piercingShot,undefined);assert.equal(opponent.skillActivations.piercingShot,1);
});
test('C automatic casting preference persists on reload and invalid settings cannot commit',()=>{
 const {GameService}=require('../.test-build/core/game.js'),{MemoryStorage}=require('../.test-build/platform/storage.js'),{SaveRepository}=require('../.test-build/core/save.js');
 const storage=new MemoryStorage(),repo=new SaveRepository(storage),g=new GameService(repo,{now:()=>NOW});
 g.updateSettings('enable-auto',{autoSkills:true});assert.equal(new GameService(new SaveRepository(storage),{now:()=>NOW}).snapshot.settings.autoSkills,true);
 const before=g.snapshot.revision;assert.throws(()=>g.updateSettings('bad-auto',{autoSkills:'true'}));assert.equal(g.snapshot.revision,before);
 g.updateSettings('disable-auto',{autoSkills:false});assert.equal(new GameService(new SaveRepository(storage),{now:()=>NOW}).snapshot.settings.autoSkills,false);
});
function arena(){const s=makeInitialSave(NOW,83);initCommunity(s,NOW);const id=s.community.arenaOrder.at(-2);return {s,a:startArena(s,NOW,id,Object.keys(s.collection))};}
test('C arena does not stop when only two attackers can still break through, including queued entrants',()=>{
 const {a}=arena();a.attackers.slice(0,3).forEach(u=>{u.alive=false;u.hp=0;});
 stepArena(a,.05);assert.equal(a.phase,'combat');assert.equal(arenaOutcome(a),undefined);
 a.attackers[3].alive=false;a.attackers[3].hp=0;stepArena(a,.05);assert.equal(a.phase,'combat');
 a.attackers[4].alive=false;a.attackers[4].hp=0;stepArena(a,.05);assert.equal(a.phase,'result');assert.equal(a.victory,false);
});
test('C arena waits for the remaining fighters after three have escaped, and defeated defenders yield victory',()=>{
 const {a}=arena();a.movers.slice(0,3).forEach(m=>m.escaped=true);a.passed=3;assert.equal(arenaOutcome(a),undefined);
 a.defenders.forEach(u=>{u.alive=false;u.hp=0;});assert.equal(arenaOutcome(a).attackWon,true);
});
test('C arena timeout is a draw and forged early settlement is rejected',()=>{
 const {s,a}=arena(),early=copy(a);early.phase='result';assert.throws(()=>finishArena(s,early),/还有有效伙伴/);
 a.battle.tick=2400;a.seconds=120;a.phase='result';const settled=finishArena(s,a);assert.equal(settled.draw,true);assert.equal(settled.victory,false);assert.equal(settled.rankAfter,settled.rankBefore);
});
function battle(){const s=makeInitialSave(NOW,17),skills=['hold','piercingShot','crystalCannon','greatHeal','bubbleRing'];
 const b=createBattle(0,1,Object.values(s.collection).map((t,i)=>({id:t.id,turtle:{...t,skills:[skills[i]]},level:1,slot:i})),{rulesVersion:'0.6',mode:'chapter'});
 b.spawns=[{kind:'ink',time:0,hpScale:100,attackScale:0},{kind:'ink',time:0,hpScale:100,attackScale:0}];b.units.forEach(u=>u.actionUntilTick=1000);stepBattle(b,.05);
 b.route=[{x:.5,z:0},{x:10,z:0}];b.routeLength=9.5;
 b.units.forEach(u=>{u.x=0;u.z=0;u.actionUntilTick=0;u.nextAttackTick=1e6;});b.enemies.forEach((e,i)=>{e.x=i+.5;e.z=0;e.distance=i;e.speed=0;e.nextAttackTick=1e6;});return b;
}
test('C manual skill rejects ally, dead and out-of-range targets without queuing or consuming cooldown',()=>{
 const b=battle(),u=b.units[1],c={type:'cast',unitId:u.id,skillId:'piercingShot'},before=copy(b);
 assert.equal(commandBattle(b,{...c,targetId:b.units[0].id}),false);assert.deepEqual(b,before);
 b.enemies[0].alive=false;assert.equal(commandBattle(b,{...c,targetId:b.enemies[0].id}),false);
 b.enemies[1].x=90;assert.equal(commandBattle(b,{...c,targetId:b.enemies[1].id}),false);assert.equal(b.commands.length,0);
});
test('C manual target survives queue and never silently retargets after death',()=>{
 const b=battle(),u=b.units[1],e=b.enemies[0];assert.ok(commandBattle(b,{type:'cast',unitId:u.id,skillId:'piercingShot',targetId:e.id}));
 e.alive=false;stepBattle(b,.05);assert.equal(u.cooldowns.piercingShot,undefined);assert.equal(u.skillActivations.piercingShot,undefined);
});
test('C one-click queues only ready legal skills once; heal remains a full-team skill',()=>{
 const b=battle();b.units[0].hp-=20;b.units[2].cooldowns.crystalCannon=100;b.units[4].alive=false;b.units[4].hp=0;
 assert.equal(commandAllSkills(b),3);assert.equal(commandAllSkills(b),0);assert.equal(b.commands.length,3);
 const restored=copy(b);stepBattle(b,.05);stepBattle(restored,.05);assert.deepEqual(b,restored);
 assert.equal(b.units[2].skillActivations.crystalCannon,undefined);assert.equal(b.units[3].skillActivations.greatHeal,1);
});
test('C summoning area permits empty in-range ground and rejects invalid coordinates',()=>{
 const b=battle(),u=b.units[4],c={type:'cast',unitId:u.id,skillId:'bubbleRing'};
 assert.equal(commandBattle(b,{...c,point:{x:NaN,z:0}}),false);assert.equal(commandBattle(b,{...c,point:{x:90,z:0}}),false);
 assert.ok(commandBattle(b,{...c,point:{x:u.x,z:u.z+2.5}}));stepBattle(b,.05);
 assert.equal(b.summons.filter(p=>p.alive).length,2);
});
