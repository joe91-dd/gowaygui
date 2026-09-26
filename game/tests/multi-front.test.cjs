const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle,positionOnRoute,legalSkillTargets}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {frontPlan,assignFronts}=require('../.test-build/core/multiFront.js');
const {prototypeSpawns}=require('../.test-build/core/prototypeConfig.js');
const {BATTLE_MAPS}=require('../.test-build/core/data.js');
const {startRaid,beginRaidWave,moveRaidStation,swapRaidPet,validateRaidCheckpoint,stepRaid}=require('../.test-build/core/raids.js');
const copy=x=>JSON.parse(JSON.stringify(x)),NOW=1788948000000;
const inputs=()=>Object.values(makeInitialSave(NOW,731).collection).map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1}));
test('multi-front escalation divides the wave population and starts simultaneous groups at distinct entrances',()=>{
 assert.deepEqual([1,4,10,20].map(w=>frontPlan(50,w).length),[1,2,3,4]);
 assert.deepEqual([51,52,53].map(id=>frontPlan(id,6).length),[2,3,4]);
 for(const id of [50,51,52,53])for(const wave of [1,4,10,20]){
  const old=prototypeSpawns(id,wave,true),plan=assignFronts(old,id,wave);assert.equal(plan.length,old.length);
  assert.equal(plan.reduce((s,p)=>s+p.hpScale,0),old.reduce((s,p)=>s+p.hpScale,0));
  const lanes=frontPlan(id,wave);assert.equal(new Set(plan.filter(p=>p.time===plan[0].time).map(p=>p.routeId)).size,lanes.length);
  assert.ok(plan.every(p=>lanes.includes(p.routeId)));
 }
});
test('four-front movement, route-specific leaks and restart recovery stay deterministic',()=>{
 const a=createBattle(50,20,[],{rulesVersion:'0.6',mode:'endless'});a.spawns=a.spawns.slice(0,4);stepBattle(a,.5);
 assert.equal(a.enemies.length,4);assert.equal(new Set(a.enemies.map(e=>e.routeId)).size,4);
 for(const e of a.enemies)assert.deepEqual({x:e.x,z:e.z},positionOnRoute(a,e.distance,e.routeId));
 validateBattle(a);const b=copy(a);for(let i=0;i<120;i++)stepBattle(a,.25);stepBattle(b,30);assert.deepEqual(a,b);validateBattle(a);assert.equal(a.status,'won');assert.equal(a.leaked,4);assert.equal(a.coreHealth,16);
});
test('malformed route identities or geometry are rejected and old single-route snapshots remain readable',()=>{
 const a=createBattle(50,10,inputs(),{rulesVersion:'0.6',mode:'endless'});stepBattle(a,.5);validateBattle(a);
 for(const mutate of [b=>b.enemies[0].routeId=99,b=>b.spawns[0].routeId=-1,b=>b.routes[0][0].x++,b=>b.routeLengths[0]++]){const b=copy(a);mutate(b);assert.throws(()=>validateBattle(b));}
 const old=createBattle(50,1,inputs(),{rulesVersion:'0.6',mode:'endless'});delete old.routes;delete old.routeLengths;old.spawns.forEach(p=>delete p.routeId);old.units.forEach(u=>Object.assign(u,BATTLE_MAPS[50].legacySlots[u.slot]));stepBattle(old,2);validateBattle(old);
});
test('target urgency compares distance to the goal across lanes rather than distance already walked',()=>{
 const b=createBattle(50,20,inputs(),{rulesVersion:'0.6',mode:'endless'});stepBattle(b,.5);const u=b.units[1];u.range=100;b.stationVersion=3;
 const [a,c]=b.enemies;a.routeId=0;a.distance=b.routeLengths[0]-3;c.routeId=1;c.distance=b.routeLengths[1]-1;
 b.enemies=[a,c];assert.equal(legalSkillTargets(b,u,'pierce')[0].id,c.id);
});
test('raid repositioning preserves one-per-member, injury, cooldown and reserve state',()=>{
 const s=makeInitialSave(NOW,731);startRaid(s,NOW,0,Object.keys(s.collection));const r=s.community.raid;
 assert.equal(BATTLE_MAPS[51].slots.length,16);moveRaidStation(r,0,1);assert.equal(r.members[0].station,1);assert.equal(r.members[1].station,0,'occupied drop swaps both positions');moveRaidStation(r,0,6);beginRaidWave(s);
 const b=r.battle,u=b.units.find(u=>u.id===r.members[0].activeId);u.hp-=20;const skill=u.skills[0];u.cooldowns[skill]=80;const initialHp=u.hp;
 moveRaidStation(r,0,8);assert.equal(u.hp,initialHp);assert.equal(u.cooldowns[skill],80);assert.equal(u.slot,8);assert.equal(b.units.length,5);assert.throws(()=>moveRaidStation(r,0,7),/冷却/);
 const first=r.members[0].activeId,second=r.members[0].roster[1].id;assert.throws(()=>swapRaidPet(r,0,second),/冷却/);for(const spawn of b.spawns)spawn.time+=100;for(const ally of b.units){ally.nextAttackTick=10000;ally.actionUntilTick=10000;}stepBattle(b,8);swapRaidPet(r,0,second);assert.throws(()=>swapRaidPet(r,0,first),/冷却/);stepBattle(b,8);swapRaidPet(r,0,first);assert.equal(b.units.find(u=>u.id===first).hp,initialHp);assert.equal(b.units.find(u=>u.id===first).slot,8);assert.equal(b.units.length,5);
 validateBattle(b);validateRaidCheckpoint(copy(r),r);const bad=copy(r);bad.members[1].station=8;assert.throws(()=>validateRaidCheckpoint(r,bad),/站位/);
});
test('AI supports multiple lanes without taking the player station and resumes the same actions after reload',()=>{
 const s=makeInitialSave(NOW,1327);startRaid(s,NOW,2,Object.keys(s.collection));beginRaidWave(s);const a=s.community.raid;a.battle.autoSkills=true;const b=copy(a),station=a.members[0].station;
 for(let i=0;i<40&&a.battle.status==='fighting';i++)stepRaid(a,.5);
 for(let i=0;i<400&&b.battle.status==='fighting';i++)stepRaid(b,.05);
 assert.deepEqual(a,b);assert.equal(a.members[0].station,station);assert.equal(new Set(a.members.map(m=>m.station)).size,5);assert.equal(a.battle.units.length,5);validateRaidCheckpoint(copy(s.community.raid),a);
});
