const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {BATTLE_MAPS,LEGACY_BATTLE_MAPS,SKILL_BY_ID}=require('../.test-build/core/data.js');
const {createBattle,stepBattle,moveBattleUnit,replaceBattleUnit,commandBattle,positionOnRoute}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {pathLength}=require('../.test-build/core/multiFront.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function input(role='stone',skills=['hold','rebirth'],slot=0,id=role){const t=Object.values(makeInitialSave(1788948000000,71).collection).find(t=>t.role===role);return{id,slot,level:1,turtle:{...t,id:'pet-'+id,skills}};}
function quiet(inputs){const b=createBattle(0,1,inputs,{rulesVersion:'0.6',mode:'chapter'});b.spawns.forEach(s=>s.time+=500);b.autoSkills=false;return b;}

test('50 modern maps extend real paths 1.6–2.2 times and offer 12–16 stations, never six simultaneous turtles',()=>{
  for(const m of BATTLE_MAPS.slice(0,50)){
    const ratio=pathLength(m.route)/pathLength(LEGACY_BATTLE_MAPS[m.id].route);assert.ok(ratio>=1.6&&ratio<=2.2,`${m.id}: ${ratio}`);
    assert.ok(m.slots.length>=12&&m.slots.length<=16);assert.equal(m.layoutVersion,2);
    const b=createBattle(m.id,1,[input('stone',['hold'],8)],{rulesVersion:'0.6'});validateBattle(b);
    assert.throws(()=>createBattle(m.id,1,Array.from({length:6},(_,i)=>input('stone',[],i,String(i))),{rulesVersion:'0.6'}),/五只/);
  }
});
test('all five starter professions receive a legal active without raising their two-skill count',()=>{
  for(const seed of [1,29,1001])for(const t of Object.values(makeInitialSave(1788948000000,seed).collection)){
    assert.equal(t.skills.length,2);const act=t.skills.filter(id=>SKILL_BY_ID[id].active);assert.equal(act.length,1);assert.equal(SKILL_BY_ID[act[0]].role,t.role);
  }
});
test('movement takes one simulation second and eight-second cooldown survives a save halfway through',()=>{
  const b=quiet([input()]),u=b.units[0],old={x:u.x,z:u.z};u.hp-=40;u.cooldowns.hold=900;u.rebirthUsed=true;
  moveBattleUnit(b,u.id,8);assert.deepEqual({x:u.x,z:u.z},old);assert.equal(u.slot,8);assert.throws(()=>moveBattleUnit(b,u.id,7),/冷却/);
  stepBattle(b,.5);const p=BATTLE_MAPS[0].slots[8];assert.ok(Math.abs(u.x-(old.x+p.x)/2)<1e-7);validateBattle(b);
  const resumed=clone(b);stepBattle(b,.5);stepBattle(resumed,.5);assert.deepEqual(b,resumed);assert.deepEqual({x:u.x,z:u.z},p);
  assert.equal(u.hp,u.maxHp-40);assert.equal(u.cooldowns.hold,900);assert.equal(u.rebirthUsed,true);assert.equal(u.transfer,undefined);
  stepBattle(b,7);moveBattleUnit(b,u.id,7);validateBattle(b);
});
test('swapping into a free station still enforces five field actors; bench return preserves HP and active state',()=>{
  const b=quiet(Array.from({length:5},(_,i)=>input('stone',['hold','rebirth'],i,'s'+i))),u=b.units[0];u.hp=120;u.cooldowns.hold=1000;u.rebirthUsed=true;
  assert.throws(()=>replaceBattleUnit(b,input('spike',['piercingShot'],8,'reserve')),/五只/);
  replaceBattleUnit(b,input('spike',['piercingShot'],0,'reserve'));assert.equal(b.benchUnits[0].hp,120);
  assert.throws(()=>replaceBattleUnit(b,input('stone',['hold'],0,'s0')),/冷却/);stepBattle(b,8);
  replaceBattleUnit(b,input('stone',['hold'],0,'s0'));const returned=b.units.find(u=>u.id==='s0');assert.equal(returned.hp,120);assert.equal(returned.cooldowns.hold,1000);assert.equal(returned.rebirthUsed,true);validateBattle(b);
});
test('manual hold affects only the selected turtle and no-target cast consumes no cooldown',()=>{
  const b=quiet([input('spike',['piercingShot'])]),u=b.units[0];b.autoSkills=true;b.manualSkillTurtles=[u.turtleId];
  assert.equal(commandBattle(b,{type:'cast',unitId:u.id,skillId:'piercingShot'}),false);assert.deepEqual(u.cooldowns,{});
  b.spawns=[{kind:'ink',time:0,hpScale:100,attackScale:0}];stepBattle(b,.05);const e=b.enemies[0];e.speed=0;Object.assign(u,positionOnRoute(b,e.distance));
  stepBattle(b,.1);assert.equal(u.skillActivations.piercingShot,undefined);assert.ok(commandBattle(b,{type:'cast',unitId:u.id,skillId:'piercingShot'}));stepBattle(b,.05);assert.equal(u.skillActivations.piercingShot,1);
});
test('pursuit visibly amplifies controlled-target damage, while mage active hits a bounded cluster',()=>{
  function stimulus(skills){const b=quiet([input('crystal',skills)]);b.spawns=Array.from({length:5},()=>({kind:'ink',time:0,hpScale:100,attackScale:0}));b.units[0].nextAttackTick=999;stepBattle(b,.05);const u=b.units[0];Object.assign(u,positionOnRoute(b,0));u.nextAttackTick=1;for(const e of b.enemies){e.speed=0;e.statuses=[{kind:'slow',amount:.25,untilTick:100,sourceId:u.id}];}b.events=[];return b;}
  const plain=stimulus([]),chase=stimulus(['pursuit']);stepBattle(plain,.35);stepBattle(chase,.35);
  const damage=b=>b.events.filter(e=>e.type==='damage').reduce((n,e)=>n+e.amount,0);assert.ok(Math.abs(damage(chase)/damage(plain)-1.18)<1e-8);
  const burst=stimulus(['crystalCannon']);assert.ok(commandBattle(burst,{type:'cast',unitId:burst.units[0].id,skillId:'crystalCannon'}));stepBattle(burst,.05);
  const hits=burst.events.filter(e=>e.type==='damage'&&e.skillId==='crystalCannon');assert.equal(new Set(hits.map(e=>e.targetId)).size,5);
  assert.ok(Math.abs(burst.contributions.crystal.damage-hits.reduce((n,e)=>n+e.amount,0))<1e-8);
});

test('a modern shot has a wind-up, launch and impact; saving mid-flight preserves the same result',()=>{
  const b=quiet([input('spike',['swift'],5)]),u=b.units[0];u.nextAttackTick=999;
  b.spawns=[{kind:'ink',time:0,hpScale:100,attackScale:0}];stepBattle(b,.05);
  const enemy=b.enemies[0];enemy.speed=0;u.nextAttackTick=0;b.events=[];
  const hp=enemy.hp;stepBattle(b,.05);assert.equal(enemy.hp,hp);assert.ok(b.events.some(e=>e.sourceId===u.id&&e.effect==='windup'));
  stepBattle(b,.15);assert.equal(enemy.hp,hp);assert.equal(u.pendingAttack.launched,true);validateBattle(b);
  const restored=clone(b);stepBattle(b,.15);stepBattle(restored,.15);assert.deepEqual(b,restored);assert.ok(enemy.hp<hp);assert.equal(u.pendingAttack,undefined);validateBattle(b);
  u.nextAttackTick=0;stepBattle(b,.05);assert.ok(u.pendingAttack);moveBattleUnit(b,u.id,8);assert.equal(u.pendingAttack,undefined,'moving cancels the old shot without resetting the attack clock');
});
