const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle,duelActions,blockCapacity,replaceBattleUnit,moveBattleUnit}=require('../.test-build/core/battle.js');
const {startArena,stepArena}=require('../.test-build/core/arena.js');
const {initCommunity}=require('../.test-build/core/community.js');
const {skillsForRole,ROLES}=require('../.test-build/core/data.js');
const NOW=1788948000000,copy=x=>JSON.parse(JSON.stringify(x));
function input(role,skills,slot=0,id=role){const t=Object.values(makeInitialSave(NOW,41).collection).find(t=>t.role===role);return {id,turtle:{...t,id,skills},level:1,slot};}
function fight(role='stone',has=true){const b=createBattle(0,1,[input(role,has?['taunt']:['strong'])],{});b.rulesVersion='0.6';b.mode='chapter';b.spawns=Array.from({length:3},()=>({kind:'ink',time:0,hpScale:1000,attackScale:1}));b.units[0].actionUntilTick=100;stepBattle(b,.05);const u=b.units[0];Object.assign(u,{x:-5,z:1,nextAttackTick:1e6,actionUntilTick:0});for(const e of b.enemies)Object.assign(e,{x:-5,z:0,distance:4,speed:0,nextAttackTick:1e6});return b;}
test('taunt is universal passive and a tank can block exactly two during its three-second window',()=>{
 for(const role of Object.keys(ROLES))assert.ok(skillsForRole(role).includes('taunt'));
 const plain=fight('stone',false),b=fight();stepBattle(plain,.1);stepBattle(b,.1);
 assert.equal(plain.enemies.filter(e=>e.blockedBy).length,1);assert.equal(b.enemies.filter(e=>e.blockedBy).length,2);assert.equal(b.enemies.filter(e=>e.statuses.some(s=>s.kind==='taunt')).length,1);assert.equal(blockCapacity(b.units[0],b.tick),2);
 stepBattle(b,3);assert.equal(blockCapacity(b.units[0],b.tick),1);assert.ok(b.enemies.filter(e=>e.blockedBy).length<=1);assert.equal(b.units[0].skillActivations.taunt,1);
});
test('taunted enemies attack the living taunter rather than a nearer ally, and release dead targets',()=>{
 const b=fight('bubble'),u=b.units[0];u.z=.6;const ally=copy(u);ally.id='near';ally.turtleId='near';ally.skills=['swift'];ally.role='spike';ally.slot=1;ally.z=.1;b.units.push(ally);b.events=[];
 b.enemies[0].nextAttackTick=b.tick+1;stepBattle(b,.05);assert.equal(b.events.find(e=>e.type==='attack'&&e.sourceId===b.enemies[0].id).targetId,u.id);assert.equal(blockCapacity(u,b.tick),1);assert.ok(b.enemies.every(e=>!e.blockedBy));
 u.alive=false;u.hp=0;b.events=[];b.enemies[0].nextAttackTick=b.tick+1;stepBattle(b,.05);assert.equal(b.events.find(e=>e.type==='attack'&&e.sourceId===b.enemies[0].id).targetId,ally.id);
});
test('taunt cooldown survives moving, reserving and checkpoint restart without duplicate activation',()=>{
 const b=fight();stepBattle(b,.1);const u=b.units[0],until=u.cooldowns.taunt,window=u.tauntUntilTick,hp=u.hp;moveBattleUnit(b,u.id,1);const incoming=input('spike',['swift'],1,'reserve');assert.throws(()=>replaceBattleUnit(b,incoming),/冷却/);b.enemies.forEach(e=>e.nextAttackTick=1e6);stepBattle(b,8);replaceBattleUnit(b,incoming);assert.throws(()=>replaceBattleUnit(b,input('stone',['taunt'],1,u.id)),/冷却/);stepBattle(b,8);replaceBattleUnit(b,input('stone',['taunt'],1,u.id));const returned=b.units[0];assert.equal(returned.cooldowns.taunt,until);assert.equal(returned.tauntUntilTick,window);assert.equal(returned.hp,hp);
 const clone=copy(b);stepBattle(b,2);for(let i=0;i<40;i++)stepBattle(clone,.05);assert.deepEqual(b,clone);assert.equal(b.units[0].skillActivations.taunt,1);
});
test('arena uses the same taunt targeting and per-tank two-attacker blocking limit',()=>{
 const s=makeInitialSave(NOW,61);initCommunity(s,NOW);const a=startArena(s,NOW,s.community.arenaOrder.at(-2),Object.keys(s.collection)),d=a.defenders.find(u=>u.role==='stone');d.skills=['taunt'];d.nextAttackTick=1e6;Object.assign(d,a.battle.route[0]);
 a.defenders.filter(u=>u!==d).forEach(u=>{u.hp=0;u.alive=false;});a.attackers.forEach(u=>u.nextAttackTick=1e6);a.movers.forEach((m,i)=>m.enterTick=i<3?0:1000);stepArena(a,.15);
 assert.equal(a.movers.filter(m=>m.blockOwnerId===d.id&&m.blockUntilTick>a.battle.tick).length,2);assert.ok(a.attackers.some(u=>u.statuses.some(s=>s.kind==='taunt'&&s.sourceId===d.id)));
});
