const test=require('node:test');
const assert=require('node:assert/strict');
const {createBattle,stepBattle,getBattleEvents,BATTLE_RULES}=require('../.test-build/core/battle.js');
const {LEGACY_BATTLE_MAPS:LEVELS,ROLES}=require('../.test-build/core/data.js');

const SLOTS=[{x:-5,z:1},{x:-1,z:1},{x:3,z:1},{x:1,z:-3},{x:6,z:-1}];
const ROUTE=[{x:-9,z:-1},{x:-5,z:0},{x:-2,z:-2},{x:2,z:-2},{x:4,z:0},{x:7,z:0},{x:9,z:1}];
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function input(role,position,skills=[],id=role+'-'+position){
  return {id,slot:position-1,level:1,turtle:{id:'t-'+id,role,name:'',skills,
    innate:{attack:100,health:100,defense:100,growth:100},training:{attack:0,health:0,defense:0,growth:0},
    generation:0,bornAt:0,parentIds:[],locked:false}};
}
function positionsUnchanged(state){
  assert.deepEqual(LEVELS[3].slots,SLOTS);
  assert.deepEqual(LEVELS[3].route,ROUTE);
  assert.deepEqual(state.route,ROUTE);
  for(const unit of state.units)assert.deepEqual({x:unit.x,z:unit.z},SLOTS[unit.slot]);
}
function quiet(inputs){
  const state=createBattle(3,1,inputs,{seed:20260908});
  // Isolated healing/aura stimulus: postpone enemies, never move any ally or change a range.
  for(const spawn of state.spawns)spawn.time+=1000;
  positionsUnchanged(state);return state;
}
function oneTick(state){stepBattle(state,.05);positionsUnchanged(state);return getBattleEvents(state);}

test('adopted ranges retain exact fourth-level route/slots, stone blocking and reach increment',()=>{
  const state=quiet([input('stone',1,['reach']),input('spike',2,['reach']),input('crystal',3,['reach']),input('leaf',4,['reach']),input('bubble',5,['reach'])]);
  assert.deepEqual(Object.fromEntries(Object.entries(ROLES).map(([id,role])=>[id,role.range])),{stone:1.2,spike:5.6,crystal:4.6,leaf:4.5,bubble:4.6});
  assert.equal(BATTLE_RULES.encourageRange,4.5);assert.equal(BATTLE_RULES.shareRange,4.5);
  for(const unit of state.units)near(unit.range,ROLES[unit.role].range+.3);
  near(distance(SLOTS[0],SLOTS[1]),4);near(distance(SLOTS[3],SLOTS[1]),Math.sqrt(20));
});

test('stone1 plus crystal2 directly damages the first naturally blocked runner at the opening contact',()=>{
  const state=createBattle(3,2,[input('stone',1,ROLES.stone.starters),input('crystal',2,ROLES.crystal.starters)],{seed:20260908});
  const events=[];let first;
  while(state.tick<80&&!first){
    events.push(...oneTick(state));first=state.enemies.find(e=>e.alive&&e.blockedBy==='stone-1');
  }
  assert.ok(first,'natural wave-2 runner should reach the original stone1 blocking circle');
  assert.equal(first.kind,'runner');assert.equal(state.tick,47);
  near(first.x,-5.429875599465175);near(first.z,-.10746889986629393);
  assert.ok(distance(first,state.units[0])<=1.2);
  assert.ok(distance(first,state.units[1])>4.5&&distance(first,state.units[1])<4.6,'regression must exercise the old uncovered opening, not a later easy target');
  const direct=events.find(e=>e.type==='damage'&&e.sourceId==='crystal-2'&&e.targetId===first.id&&!e.secondary);
  assert.ok(direct&&direct.amount>0,'require actual direct damage to that first enemy, not splash or an unrelated attack counter');
  assert.ok(direct.tick<=state.tick);
  // Exact first segment/circle intersection bounds the earliest possible contact before tick quantization.
  const a=ROUTE[0],b=ROUTE[1],stone=SLOTS[0],length=distance(a,b),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
  const projection=(stone.x-a.x)*dx+(stone.z-a.z)*dz;
  const perpendicularSquared=distance(a,stone)**2-projection**2;
  const s=projection-Math.sqrt(1.2**2-perpendicularSquared),point={x:a.x+dx*s,z:a.z+dz*s};
  near(distance(point,SLOTS[1]),4.586844401545112,1e-6);
  assert.ok(distance(point,state.units[1])<state.units[1].range);
  // This checks opening coverage only, not a claim of whole-wave or chapter victory.
});

for(const skills of [['doubleHeal'],['reach','doubleHeal']])test(`leaf4 ${skills.join('+')} heals fixed slots2/3 but excludes the more injured slot1`,()=>{
  const state=quiet([input('stone',1),input('crystal',2),input('spike',3),input('leaf',4,skills)]);
  const [outside,first,second,healer]=state.units;
  outside.hp=outside.maxHp*.01;first.hp=first.maxHp*.25;second.hp=second.maxHp*.5;
  const before=state.units.map(u=>u.hp),events=oneTick(state);
  const heals=events.filter(e=>e.type==='heal'&&e.sourceId===healer.id);
  assert.deepEqual(heals.map(e=>e.targetId),[first.id,second.id]);
  near(first.hp-before[1],40);near(second.hp-before[2],14);near(outside.hp,before[0]);
  assert.equal(healer.attackCount,1);assert.equal(healer.skillActivations.doubleHeal,1);
  assert.ok(distance(healer,first)<healer.range&&distance(healer,second)<healer.range);
  assert.ok(distance(healer,outside)>healer.range);
});

test('leaf4 with starter reach cannot heal slot1 when that is the only injured unit',()=>{
  const state=quiet([input('stone',1),input('leaf',4,ROLES.leaf.starters)]);
  state.units[0].hp=1;
  assert.equal(oneTick(state).filter(e=>e.type==='heal').length,0);
  assert.equal(state.units[1].attackCount,0);assert.equal(state.units[0].hp,1);
});

test('encourage on fixed slot3 selects nearer slot5 and changes real healing by eight percent',()=>{
  const state=quiet([input('stone',3,['encourage'],'source'),input('leaf',5,[],'z-nearest'),input('bubble',2,[],'a-farther'),input('crystal',4,[],'b-farthest')]);
  const [source,nearest,farther,farthest]=state.units;
  nearest.hp-=100;const before=nearest.hp;
  const heals=oneTick(state).filter(e=>e.type==='heal');
  assert.equal(source.auraTargetId,nearest.id);assert.equal(nearest.encouragedBy,source.id);
  assert.equal(farther.encouragedBy,undefined);assert.equal(farthest.encouragedBy,undefined);
  near(heals.find(e=>e.sourceId===nearest.id).amount,40*1.08);near(nearest.hp-before,40*1.08);
  nearest.alive=false;nearest.hp=0;oneTick(state);assert.equal(source.auraTargetId,farther.id);
  farther.alive=false;farther.hp=0;oneTick(state);assert.equal(source.auraTargetId,farthest.id);
  farthest.alive=false;farthest.hp=0;oneTick(state);assert.equal(source.auraTargetId,undefined);
});

test('encourage uses stable IDs for equal-distance fixed slots and cannot reach a remote slot',()=>{
  const state=quiet([input('stone',2,['encourage'],'source'),input('leaf',1,[],'z-tied'),input('crystal',3,[],'a-tied'),input('bubble',4,[],'0-farther')]);
  oneTick(state);assert.equal(state.units[0].auraTargetId,'a-tied');
  state.units[2].alive=false;state.units[2].hp=0;oneTick(state);assert.equal(state.units[0].auraTargetId,'z-tied');
  const isolated=quiet([input('stone',1,['encourage'],'far-source'),input('leaf',4,[],'far-target')]);
  oneTick(isolated);assert.equal(isolated.units[0].auraTargetId,undefined);assert.equal(isolated.units[1].encouragedBy,undefined);
});

function naturalSnailAtLowerBend(inputs){
  const state=createBattle(3,3,inputs,{seed:20260908});
  // Diagnostic enemy has extra HP so it reaches the bend; all ally coordinates/ranges are untouched.
  // When a stone occupies slot1, two enemies fill its real blocking capacity; a third walks through.
  const count=inputs.some(u=>u.turtle.role==='stone'&&u.slot===0)?3:1;
  state.spawns=Array.from({length:count},()=>({kind:'snail',time:0,hpScale:1000,attackScale:1}));
  for(const unit of state.units)unit.nextAttackTick=100000;
  oneTick(state);
  for(const enemy of state.enemies)enemy.nextAttackTick=100000;
  const enemy=state.enemies.at(-1);
  while(enemy.distance<10.7&&state.tick<1000)oneTick(state);
  assert.ok(enemy.distance>=10.7&&enemy.distance<10.8);
  near(enemy.z,-2);assert.ok(enemy.x>.9&&enemy.x<1.1);
  enemy.attack=100;getBattleEvents(state);
  return {state,enemy};
}
function receiveOneSnailHit(state,enemy){
  enemy.nextAttackTick=state.tick+1;
  return oneTick(state).filter(e=>e.type==='damage'&&e.sourceId===enemy.id);
}

test('share from fixed slot2 transfers ten percent of a real enemy hit on nearest slot4',()=>{
  const {state,enemy}=naturalSnailAtLowerBend([input('stone',2,['share'],'sharer'),input('bubble',4,[],'patient')]);
  const [source,patient]=state.units,before=state.units.map(u=>u.hp);
  const hits=receiveOneSnailHit(state,enemy),mitigated=100*100/(100+patient.armor);
  near(distance(source,patient),Math.sqrt(20));
  near(before[0]-source.hp,mitigated*.1);near(before[1]-patient.hp,mitigated*.9);
  assert.equal(source.skillActivations.share,1);
  assert.equal(hits.filter(e=>e.skillId==='share'&&e.targetId===source.id).length,1);
  assert.equal(hits.filter(e=>!e.secondary&&e.targetId===patient.id).length,1);
  near(hits.reduce((sum,e)=>sum+e.amount,0),mitigated);
});

test('share respects nearest living friend: an in-range but non-nearest patient is not protected',()=>{
  const {state,enemy}=naturalSnailAtLowerBend([input('stone',2,['share'],'sharer'),input('bubble',4,[],'patient'),input('crystal',3,[],'nearer')]);
  const [source,patient,nearer]=state.units,before=state.units.map(u=>u.hp);
  const first=receiveOneSnailHit(state,enemy),mitigated=100*100/(100+patient.armor);
  assert.ok(distance(source,nearer)<distance(source,patient));
  near(source.hp,before[0]);near(before[1]-patient.hp,mitigated);
  assert.equal(first.filter(e=>e.skillId==='share').length,0);
  nearer.alive=false;nearer.hp=0;
  assert.equal(receiveOneSnailHit(state,enemy).filter(e=>e.skillId==='share').length,1);
});

test('share on fixed slot1 cannot transfer a hit from slot4 outside 4.5',()=>{
  const {state,enemy}=naturalSnailAtLowerBend([input('stone',1,['share'],'far-sharer'),input('bubble',4,[],'patient')]);
  const before=state.units[0].hp;
  const hits=receiveOneSnailHit(state,enemy);
  assert.equal(hits.filter(e=>e.skillId==='share').length,0);near(state.units[0].hp,before);
  assert.ok(hits.some(e=>e.targetId==='patient'&&!e.secondary));
});
