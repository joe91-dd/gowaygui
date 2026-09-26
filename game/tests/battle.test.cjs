const test = require('node:test');
const assert = require('node:assert/strict');
const { createBattle, stepBattle, getBattleEvents, BATTLE_RULES, commandBattle } = require('../.test-build/core/battle.js');
const { SKILLS, ROLES } = require('../.test-build/core/data.js');

function turtle(role, skills = [], id = role) {
  return { id, role, name: ROLES[role].name, skills, innate: { attack:100, health:100, defense:100, growth:100 }, training: { attack:0, health:0, defense:0, growth:0 }, generation:0, bornAt:0, parentIds:[], locked:false };
}
function input(role, skills = [], slot = 0, id = role) { return { id, turtle:turtle(role, skills, id), level:1, slot }; }
function quiet(inputs) { const state=createBattle(0,1,inputs,{seed:123456789}); state.spawns=[{kind:'ink',time:1000,hpScale:1,attackScale:1}]; return state; }
function arena(inputs, kind='ink') {
  const state=createBattle(0,1,inputs,{seed:123456789});
  state.spawns=[{kind,time:0,hpScale:1000,attackScale:1}];
  state.units.forEach(unit=>Object.assign(unit,{x:100,z:100}));
  stepBattle(state,.05);
  const enemy=state.enemies[0];
  Object.assign(enemy,{distance:4,x:-5,z:0,speed:0,nextAttackTick:100000});
  state.units.forEach((unit,i)=>Object.assign(unit,{x:-5+i*.7,z:.6+i*.2}));
  getBattleEvents(state);
  return state;
}
const near=(actual,expected,epsilon=1e-7)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);
const fired=(unit,id)=>assert.ok((unit.skillActivations[id]||0)>0,`${id} never activated`);

test('skill catalogue contains fifty unique reachable skills',()=>{
  assert.equal(SKILLS.length,50); assert.equal(new Set(SKILLS.map(s=>s.id)).size,50);
  for(const skill of SKILLS) assert.ok(!skill.role || ROLES[skill.role]);
});

test('aptitude and growth formulas affect base stats; five passive modifiers remain additive to that base',()=>{
  const ordinary=createBattle(0,1,[input('stone')]).units[0];
  const boosted=createBattle(0,1,[input('stone',['strong','armor','resist','swift','reach'])]).units[0];
  near(boosted.maxHp,ordinary.maxHp*1.12); near(boosted.armor,ordinary.armor+15); near(boosted.resist,ordinary.resist+15);
  near(boosted.interval,ordinary.interval/1.12); near(boosted.range,ordinary.range+.3);
  const grown=input('spike'); grown.level=10; grown.turtle.innate.attack=60; grown.turtle.innate.growth=110;
  near(createBattle(0,1,[grown]).units[0].attack,54*.92*1.99);
});

test('invalid duplicates, more than twelve skills, incompatible skills and duplicate slots cannot enter battle',()=>{
  assert.throws(()=>createBattle(0,1,[input('leaf',['hold'])]));
  assert.throws(()=>createBattle(0,1,[input('stone',['armor','armor'])]));
  assert.throws(()=>createBattle(0,1,[input('stone',SKILLS.filter(s=>!s.role||s.role==='stone').slice(0,13).map(s=>s.id))]));
  assert.throws(()=>createBattle(0,1,[input('stone'),input('leaf')]));
});

test('openingShield absorbs damage and expires at six seconds; lastShield is once per wave',()=>{
  const state=arena([input('stone',['openingShield','lastShield'])]); const unit=state.units[0],enemy=state.enemies[0];
  near(unit.shield,unit.maxHp*.1);
  enemy.nextAttackTick=state.tick+1; const before=unit.hp; stepBattle(state,.05); near(unit.hp,before);
  enemy.nextAttackTick=100000; stepBattle(state,6); near(unit.shield,0);
  unit.hp=unit.maxHp*.31; enemy.attack=unit.maxHp*.03*1.4; enemy.nextAttackTick=state.tick+1;
  stepBattle(state,.05); near(unit.shield,unit.maxHp*.15); fired(unit,'lastShield');
  enemy.nextAttackTick=100000; stepBattle(state,5); enemy.nextAttackTick=state.tick+1; stepBattle(state,.05);
  near(unit.shield,0); assert.equal(unit.skillActivations.lastShield,1);
});

test('regen starts after five undamaged seconds and is interrupted by another hit',()=>{
  const state=arena([input('stone',['regen'])]); const unit=state.units[0],enemy=state.enemies[0];
  unit.hp-=100; stepBattle(state,4.8); near(unit.hp,540); stepBattle(state,.2); near(unit.hp,546.4);
  enemy.nextAttackTick=state.tick+1; stepBattle(state,.05); enemy.nextAttackTick=100000; const hurt=unit.hp;
  stepBattle(state,4.9); near(unit.hp,hurt); stepBattle(state,.1); near(unit.hp,hurt+6.4);
});

test('encourage adds eight percent to nearby ally and multiple sources never stack',()=>{
  const state=arena([input('stone',['encourage'],0,'a'),input('spike',[],1,'shot'),input('stone',['encourage'],2,'b')]);
  state.units[0].x=-6; state.units[1].x=-5; state.units[2].x=-4;
  state.units[0].nextAttackTick=100000; state.units[2].nextAttackTick=100000;
  stepBattle(state,.05);
  const hit=getBattleEvents(state).find(e=>e.type==='damage'&&e.sourceId==='shot');
  near(hit.amount,54*1.08*(hit.critical?1.5:1));
  assert.ok(state.units[1].encouragedBy);
});

test('block probabilistically reduces direct damage and its actual mitigation matches events',()=>{
  const state=arena([input('stone',['block'])]); const unit=state.units[0],enemy=state.enemies[0];
  unit.maxHp=unit.hp=100000; unit.nextAttackTick=100000; enemy.attack=14; enemy.interval=.05; enemy.nextAttackTick=1;
  stepBattle(state,10);
  const hits=getBattleEvents(state).filter(e=>e.type==='damage'&&e.targetId===unit.id);
  assert.ok(hits.some(e=>Math.abs(e.amount-7)<1e-8)); assert.ok(hits.some(e=>Math.abs(e.amount-10)<1e-8));
  fired(unit,'block'); assert.equal(hits.length,200);
});

test('share and reflect form a bounded two-sink damage transaction without triggering each other',()=>{
  const state=arena([input('stone',['share','reflect'],0,'front'),input('stone',['share','reflect'],1,'back')]);
  const [front,back]=state.units,enemy=state.enemies[0];
  Object.assign(front,{x:-5,z:.5,nextAttackTick:100000}); Object.assign(back,{x:-5,z:1.5,nextAttackTick:100000});
  enemy.attack=100; enemy.nextAttackTick=state.tick+1;
  const enemyBefore=enemy.hp; stepBattle(state,.05); const events=getBattleEvents(state);
  near(front.maxHp-front.hp,100/1.4*.9); near(back.maxHp-back.hp,100/1.4*.1);
  near(enemyBefore-enemy.hp,100/1.4*.9*.15);
  assert.equal(events.filter(e=>e.skillId==='share'&&e.type==='damage').length,1);
  assert.equal(events.filter(e=>e.skillId==='reflect'&&e.type==='damage').length,1);
  assert.equal(back.skillActivations.reflect||0,0); assert.equal(front.skillActivations.share||0,0);
});

test('rock storm adds thirty armor for four seconds and channels without basic attacks',()=>{
  const state=arena([input('stone',['hold'])]); const unit=state.units[0],enemy=state.enemies[0];
  enemy.attack=100; enemy.nextAttackTick=state.tick+1; stepBattle(state,.05);
  near(unit.maxHp-unit.hp,100/1.7); fired(unit,'hold'); assert.equal(unit.attackCount,0);
  assert.ok(unit.actionUntilTick>state.tick); assert.equal(unit.cooldowns.hold-state.tick,24/.05);
});

test('critical raises expected actual direct-hit frequency above the same seed baseline',()=>{
  const run=skills=>{const state=arena([input('spike',skills)]);state.units[0].interval=.05;stepBattle(state,50);return getBattleEvents(state).filter(e=>e.type==='damage'&&e.critical).length;};
  const normal=run([]),critical=run(['critical']); assert.ok(critical>normal+40,`${normal}/${critical}`);
});

test('lifesteal and spellDrain use actual lost HP, respect a rolling one-second cap and ignore secondary damage',()=>{
  for(const [role,skill,ratio] of [['spike','lifesteal',.05],['crystal','spellDrain',.03]]) {
    const state=arena([input(role,[skill])]); const unit=state.units[0],enemy=state.enemies[0];
    unit.hp-=100; enemy.hp=1; stepBattle(state,.05);
    near(unit.hp,unit.maxHp-100+ratio); fired(unit,skill);
    const capped=arena([input(role,[skill])]); const c=capped.units[0]; c.hp=1;c.attack=10000;c.interval=.05;
    stepBattle(capped,.8); near(c.hp,1+c.maxHp*.02);
  }
  const state=arena([input('crystal',['spellDrain','bounce'])]);const unit=state.units[0];unit.hp-=100;
  state.enemies.push({...structuredClone(state.enemies[0]),id:'extra',x:-4.5,distance:4.5});
  stepBattle(state,.05);const events=getBattleEvents(state);const direct=events.find(e=>e.type==='damage'&&!e.secondary);
  near(unit.hp,unit.maxHp-100+direct.amount*.03);
});

test('combo produces one sixty-percent secondary hit on the fifth basic attack without incrementing attackCount',()=>{
  const state=arena([input('spike',['combo'])]); const unit=state.units[0]; unit.attackCount=4;
  stepBattle(state,.05);const events=getBattleEvents(state);const combo=events.filter(e=>e.type==='damage'&&e.skillId==='combo');
  assert.equal(unit.attackCount,5);assert.equal(combo.length,1);near(combo[0].amount,54*.6);fired(unit,'combo');
});

test('piercingShot uses 240 percent and ignores seventy percent armor after armor reduction',()=>{
  const state=arena([input('spike',['piercingShot'])],'armored');
  state.enemies[0].statuses=[{kind:'armorDown',amount:8,untilTick:500,sourceId:'bubble'}];
  stepBattle(state,.05);const hit=getBattleEvents(state).find(e=>e.type==='damage'&&e.skillId==='piercingShot');
  near(hit.amount,54*2.4*100/(100+52*.3)*(hit.critical?1.5:1));assert.equal(state.units[0].attackCount,0);
});

test('crystal base splash hits at most two neighbors, bounce has one distinct target and no recursive splash',()=>{
  const state=arena([input('crystal',['bounce'])]);const template=structuredClone(state.enemies[0]);
  for(let i=1;i<=5;i++)state.enemies.push({...structuredClone(template),id:`extra${i}`,x:-5+i*.1,distance:4+i*.1});
  stepBattle(state,.05);const hits=getBattleEvents(state).filter(e=>e.type==='damage');
  assert.equal(hits.length,4);assert.equal(hits.filter(e=>e.skillId==='bounce').length,1);
  assert.notEqual(hits.find(e=>e.skillId==='bounce').targetId,hits.find(e=>!e.secondary).targetId);
  near(hits.find(e=>e.skillId==='bounce').amount,45*.3);
});

test('shredResist refreshes five resistance reduction without stacking; blizzard starts with an 80 percent pulse',()=>{
  const state=arena([input('crystal',['shredResist','crystalCannon'])],'mist'); stepBattle(state,.05);
  const unit=state.units[0],enemy=state.enemies[0],hit=getBattleEvents(state).find(e=>e.skillId==='crystalCannon'&&e.type==='damage');
  near(hit.amount,45*.8/1.6*(hit.critical?1.5:1));
  stepBattle(state,4);assert.equal(enemy.statuses.filter(s=>s.kind==='resistDown').length,1);near(enemy.statuses.find(s=>s.kind==='resistDown').amount,5);
  fired(unit,'shredResist');fired(unit,'crystalCannon');
});

test('leaf basic prioritizes lowest HP ratio and doubleHeal restores a different ally at thirty-five percent',()=>{
  const state=quiet([input('leaf',['doubleHeal'],0,'healer'),input('stone',[],1,'a'),input('spike',[],2,'b')]);
  const [healer,a,b]=state.units; healer.x=a.x=b.x=0;healer.z=a.z=b.z=0;a.hp=a.maxHp*.2;b.hp=b.maxHp*.4;
  const ah=a.hp,bh=b.hp;stepBattle(state,.05);near(a.hp-ah,40);near(b.hp-bh,14);fired(healer,'doubleHeal');
});

test('healShield converts only effective healing, caps total shields, and expires after four seconds',()=>{
  const state=quiet([input('leaf',['healShield'])]);const unit=state.units[0];unit.hp-=10;
  stepBattle(state,.05);near(unit.hp,unit.maxHp);near(unit.shield,1.5);fired(unit,'healShield');
  unit.attack=100000;unit.interval=.05;unit.hp=1;stepBattle(state,.05);unit.nextAttackTick=state.tick+1;stepBattle(state,.05);
  assert.ok(unit.shield<=unit.maxHp*.4);unit.nextAttackTick=100000;stepBattle(state,4.1);near(unit.shield,0);
});

test('cleanse removes one control before weakness and cannot repeat within eight seconds',()=>{
  const state=quiet([input('leaf',['cleanse'],0,'healer'),input('stone',[],1,'ally')]);const [healer,ally]=state.units;
  healer.x=ally.x=0;healer.z=ally.z=0;ally.hp-=100;
  ally.statuses=[{kind:'weaken',amount:.15,untilTick:500,sourceId:'enemy'},{kind:'stun',amount:1,untilTick:500,sourceId:'enemy'}];
  stepBattle(state,.05);assert.ok(!ally.statuses.some(s=>s.kind==='stun'));assert.ok(ally.statuses.some(s=>s.kind==='weaken'));fired(healer,'cleanse');
  stepBattle(state,7.9);assert.ok(ally.statuses.some(s=>s.kind==='weaken'));stepBattle(state,1.7);assert.ok(!ally.statuses.some(s=>s.kind==='weaken'));
});

test('greatHeal heals every living ally by 220 percent only once someone falls below sixty percent',()=>{
  const state=quiet([input('leaf',['greatHeal'],0,'healer'),input('stone',[],1,'ally')]); const [healer,ally]=state.units;
  healer.hp-=100;ally.hp-=100;stepBattle(state,.05);assert.equal(healer.skillActivations.greatHeal||0,0);
  ally.hp=ally.maxHp*.4;const before=ally.hp;stepBattle(state,.05);near(ally.hp-before,88);fired(healer,'greatHeal');
});

test('bubble basic slow and sixth-shot root, armor reduction and weaken all have actual effects',()=>{
  const state=arena([input('bubble',['root','shredArmor','weaken'])],'armored');const unit=state.units[0],enemy=state.enemies[0];unit.attackCount=5;
  stepBattle(state,.05);
  for(const id of ['root','shredArmor','weaken'])fired(unit,id);
  near(enemy.statuses.find(s=>s.kind==='armorDown').amount,8);near(enemy.statuses.find(s=>s.kind==='weaken').amount,.08);
  near(enemy.statuses.find(s=>s.kind==='slow').amount,.25);assert.ok(enemy.statuses.some(s=>s.kind==='root'));
  const before=unit.hp;enemy.nextAttackTick=state.tick+1;stepBattle(state,.05);near(before-unit.hp,24*.92/1.1);
});

test('bubbleRing summons two damageable allies instead of rooting enemies',()=>{
  const state=arena([input('bubble',['bubbleRing'])]);stepBattle(state,.05);
  assert.equal(state.summons.filter(p=>p.alive).length,2);assert.equal(getBattleEvents(state).filter(e=>e.type==='control').length,0);
  const u=state.units[0];for(const p of state.summons){near(p.maxHp,u.maxHp*.35);near(p.attack,u.attack*.4);}
});

test('steady reduces actual boss stun time; bosses summon once at half health',()=>{
  const state=arena([input('stone',['steady'])],'boss');const unit=state.units[0],enemy=state.enemies[0];
  enemy.attackCount=2;enemy.nextAttackTick=state.tick+1;enemy.hp=enemy.maxHp*.49;
  stepBattle(state,.05);const control=getBattleEvents(state).find(e=>e.type==='control');near(control.amount,.64);fired(unit,'steady');
  assert.equal(state.enemies.length,3);stepBattle(state,.1);assert.equal(state.enemies.length,3);
});

test('twelve valid skills are all active in one battle with no hidden six-slot equipment limit',()=>{
  const skills=['strong','armor','resist','swift','reach','steady','regen','openingShield','lastShield','encourage','block','reflect'];
  const state=arena([input('stone',skills,0,'legend'),input('leaf',[],1,'friend')]); const unit=state.units[0],enemy=state.enemies[0];
  state.units[1].nextAttackTick=100000;unit.hp=unit.maxHp*.25;enemy.attack=.5;enemy.interval=.05;enemy.nextAttackTick=1;
  const boss={...structuredClone(enemy),id:'boss-test',kind:'boss',range:3,attack:.1,attackCount:2,summoned:true};state.enemies.push(boss);
  stepBattle(state,15);
  for(const e of state.enemies)e.nextAttackTick=100000;
  stepBattle(state,7);
  assert.equal(unit.skills.length,12);for(const id of skills)fired(unit,id);
  assert.ok(unit.alive);assert.ok(getBattleEvents(state).length<4096);
});

test('fixed ticks and serialized RNG restore exactly the same trajectory after interruption',()=>{
  const state=createBattle(2,5,[input('stone',['block','reflect'],0),input('spike',['critical','combo'],1),input('crystal',['bounce'],2),input('leaf',['doubleHeal'],3),input('bubble',['root'],4)],{seed:1357});
  stepBattle(state,8.375);const resumed=JSON.parse(JSON.stringify(state));
  for(let i=0;i<120;i++){stepBattle(state,.125);stepBattle(resumed,.125);}
  assert.deepEqual(resumed,state);
  const a=quiet([input('stone')]),b=structuredClone(a);stepBattle(a,1);for(let i=0;i<10;i++)stepBattle(b,.1);assert.deepEqual(a,b);
});

test('a defeated unit leaves this wave and recovers at the next createBattle; leaks deduct configured core damage',()=>{
  const state=arena([input('stone')]);const unit=state.units[0],enemy=state.enemies[0];unit.hp=1;enemy.nextAttackTick=state.tick+1;
  stepBattle(state,.05);assert.equal(unit.alive,false);const count=unit.attackCount;stepBattle(state,2);assert.equal(unit.attackCount,count);
  const next=createBattle(0,2,[input('stone')],{coreHealth:17});near(next.units[0].hp,next.units[0].maxHp);assert.equal(next.coreHealth,17);
  const empty=createBattle(0,1,[]);stepBattle(empty,120);assert.equal(empty.status,'won');assert.equal(empty.coreHealth,17);assert.equal(empty.leaked,3);
  const loss=createBattle(0,1,[],{coreHealth:1});stepBattle(loss,120);assert.equal(loss.status,'lost');assert.equal(loss.coreHealth,0);
});

test('stone briefly blocks one; other mobile enemies move past',()=>{
  const state=arena([input('stone')]);const template=structuredClone(state.enemies[0]);state.units[0].nextAttackTick=100000;
  state.enemies[0].speed=1;for(let i=1;i<3;i++)state.enemies.push({...structuredClone(template),id:`extra${i}`,speed:1});
  stepBattle(state,.05);assert.equal(state.enemies.filter(e=>e.blockedBy).length,1);assert.equal(state.enemies.filter(e=>e.distance>4).length,2);
});

test('event consumption and manual cast requests do not duplicate simulation actions',()=>{
  const state=arena([input('spike',['piercingShot'])]);assert.ok(commandBattle(state,{type:'cast',unitId:'spike',skillId:'piercingShot'}));assert.ok(!commandBattle(state,{type:'cast',unitId:'spike',skillId:'piercingShot'}));
  stepBattle(state,.05);assert.equal(getBattleEvents(state).filter(e=>e.type==='skill'&&e.skillId==='piercingShot').length,1);assert.deepEqual(getBattleEvents(state),[]);
  assert.ok(!commandBattle(state,{type:'cast',unitId:'spike',skillId:'piercingShot'}));assert.equal(state.commands.length,0);
  const hp=state.enemies[0].hp;stepBattle(state,0);near(state.enemies[0].hp,hp);
});

test('ranged enemies resume route movement after their firing animation and cannot camp forever outside tower reach',()=>{
  const state=arena([input('stone')],'snail');const enemy=state.enemies[0],unit=state.units[0];
  Object.assign(enemy,{x:-8,z:0,distance:1,speed:.8,nextAttackTick:1});unit.nextAttackTick=100000;
  stepBattle(state,5);assert.ok(enemy.distance>3);assert.ok(enemy.attackCount>0);
});

test('scheduled elite spawns at its own timestamp instead of waiting behind a later ordinary enemy',()=>{
  const state=createBattle(1,5,[]);assert.ok(state.spawns.every((spawn,i)=>i===0||spawn.time>=state.spawns[i-1].time));
  stepBattle(state,13.25);assert.ok(state.enemies.some(enemy=>enemy.kind==='elite'));
  const event=getBattleEvents(state).find(e=>e.type==='spawn'&&e.effect==='elite');assert.equal(event.tick,264);
});

test('a four-skill ordinary team completes tutorial and three ordinary levels within their total duration targets',()=>{
  const {LEVELS}=require('../.test-build/core/data.js');
  const builds={stone:['strong','armor','block','hold'],spike:['swift','critical','combo','piercingShot'],crystal:['resist','bounce','shredResist','crystalCannon'],leaf:['reach','doubleHeal','healShield','greatHeal'],bubble:['steady','shredArmor','root','bubbleRing']};
  for(const level of LEVELS.slice(0,4)) {
    let hp=20,seconds=0;
    for(let wave=1;wave<=level.waves;wave++) {
      const units=Object.keys(ROLES).map((role,i)=>{const u=input(role,builds[role],[1,0,2,3,4][i]);u.level=Math.min(wave,10);u.turtle.innate.attack=u.turtle.innate.health=u.turtle.innate.defense=80;return u;});
      const state=createBattle(level.id,wave,units,{seed:wave+42,coreHealth:hp});stepBattle(state,180);
      assert.equal(state.status,'won',`${level.name} wave ${wave}`);hp=state.coreHealth;seconds+=state.elapsed;
    }
    seconds+=(level.waves-1)*level.preparationSeconds;
    assert.ok(seconds>=level.targetSeconds[0]&&seconds<=level.targetSeconds[1],`${level.name}: ${seconds}`);
  }
});

