const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game');
const {createBattle,stepBattle,positionOnRoute,commandBattle,canCommandBattle,moveBattleUnit,benchBattleUnit,replaceBattleUnit}=require('../.test-build/core/battle');
const {validateBattle}=require('../.test-build/core/battleValidation');
const {validateTurtle}=require('../.test-build/core/save');
const {applySkillBook,skillBookIssue}=require('../.test-build/core/skillBooks');
const {SKILL_BY_ID,skillsForRole,BATTLE_MAPS}=require('../.test-build/core/data');
const pet=(role,skills)=>({...Object.values(makeInitialSave(1788948000000,27).collection).find(t=>t.role===role),skills});
const clone=x=>JSON.parse(JSON.stringify(x));
function field(role,skills){
 const b=createBattle(0,1,[{id:'u',slot:0,level:1,turtle:pet(role,skills)}],{rulesVersion:'0.6',seed:89,waveLimit:5});
 b.autoSkills=false;b.spawns=[{kind:'ink',time:0,hpScale:1000,attackScale:1},{kind:'ink',time:9999,hpScale:1,attackScale:1}];stepBattle(b,.05);
 const u=b.units[0],e=b.enemies[0];let near=0,d=Infinity;for(let i=0;i<b.routeLength;i+=.05){const p=positionOnRoute(b,i),a=Math.hypot(p.x-u.x,p.z-u.z);if(a<d){d=a;near=i;}}
 Object.assign(e,positionOnRoute(b,near),{distance:near,speed:0,nextAttackTick:1e8});u.nextAttackTick=1e8;b.events=[];return b;
}
const cast=(b,id)=>{assert.ok(commandBattle(b,{type:'cast',unitId:'u',skillId:id}));stepBattle(b,.05);};
test('five specializations are profession-bound gold enhancements; legacy spirit saves survive',()=>{
 for(const [id,role,base] of [['stoneMastery','stone','hold'],['spikeMastery','spike','piercingShot'],['crystalMastery','crystal','crystalCannon'],['leafMastery','leaf','greatHeal'],['spirit','bubble','bubbleRing']]){
  assert.ok(SKILL_BY_ID[id].specialization);assert.equal(SKILL_BY_ID[id].requires,base);assert.ok(!SKILL_BY_ID[id].precious);
  const t=pet(role,[base,'strong','swift']);for(let i=1;i<30;i++){const result=applySkillBook({rng:i},t,id);assert.ok(result.turtle.skills.includes(base));assert.ok(result.turtle.skills.includes(id));assert.equal(result.turtle.skills.length,3);assert.notEqual(result.receipt.replacedSkillId,base);}
  const rng={rng:42};assert.throws(()=>applySkillBook(rng,pet(role,['strong','swift']),id));assert.equal(rng.rng,42);
  assert.ok(skillBookIssue(pet(role,[base]),id));assert.ok(skillBookIssue(pet(role==='stone'?'spike':'stone',['strong','swift']),id));
 }
 validateTurtle(pet('stone',['spirit','strong']));assert.ok(!skillsForRole('stone').includes('spirit'));
});
test('stationary rock storm deals eight pulses, blocks transfers, and survives reload',()=>{
 const b=field('stone',['hold','stoneMastery']),u=b.units[0],at={x:u.x,z:u.z},hp=b.enemies[0].hp;assert.equal(u.range,2.2);cast(b,'hold');validateBattle(b);
 const before=clone(b);assert.throws(()=>moveBattleUnit(b,'u',1),/风暴/);assert.throws(()=>benchBattleUnit(b,'u'),/风暴/);assert.throws(()=>replaceBattleUnit(b,{id:'new',slot:0,level:1,turtle:pet('spike',['piercingShot'])}),/风暴/);assert.deepEqual(b,before);
 const resumed=clone(b);for(let i=0;i<85;i++){stepBattle(b,.05);stepBattle(resumed,.05);}assert.deepEqual(b,resumed);assert.deepEqual({x:u.x,z:u.z},at);assert.ok(b.enemies[0].hp<hp);assert.equal(b.events.filter(e=>e.effect==='rockPulse').length,8);assert.equal(b.events.filter(e=>e.effect==='rockSplit').length,12);validateBattle(b);
});
test('arrow rain adds three area pulses to piercing shot',()=>{
 const b=field('spike',['piercingShot','spikeMastery']);cast(b,'piercingShot');stepBattle(b,3.3);assert.equal(b.events.filter(e=>e.effect==='arrowRain').length,3);assert.ok(b.events.some(e=>e.type==='damage'&&e.skillId==='spikeMastery'));validateBattle(b);
});
test('frost mastery extends storm to five pulses and shatters its frozen target after delay',()=>{
 const b=field('crystal',['crystalCannon','crystalMastery']);cast(b,'crystalCannon');assert.ok(b.enemies[0].statuses.some(s=>s.kind==='stun'));const resumed=clone(b);validateBattle(resumed);for(let i=0;i<108;i++){stepBattle(b,.05);stepBattle(resumed,.05);}assert.deepEqual(b,resumed);assert.equal(b.events.filter(e=>e.effect==='blizzardPulse').length,5);assert.ok(b.events.some(e=>e.effect==='shatter'));validateBattle(b);
});
test('healer revival preserves cooldown and cannot revive again during independent cooldown',()=>{
 const b=field('leaf',['greatHeal','leafMastery']),u=b.units[0],slots=BATTLE_MAPS[0].slots;
 const slot=slots.map((p,i)=>({i,d:Math.hypot(p.x-u.x,p.z-u.z)})).filter(p=>p.i!==0&&p.d<=3.5).sort((a,b)=>a.d-b.d)[0].i;
 const ally=createBattle(0,1,[{id:'ally',slot,level:1,turtle:pet('stone',['hold'])}],{rulesVersion:'0.6',waveLimit:5}).units[0];ally.alive=false;ally.hp=0;ally.cooldowns.hold=9999;b.units.push(ally);cast(b,'greatHeal');assert.ok(ally.alive);assert.equal(ally.hp,ally.maxHp*.4);assert.equal(ally.cooldowns.hold,9999);assert.equal(u.cooldowns.leafMastery,b.tick+1200);validateBattle(b);
 ally.alive=false;ally.hp=0;u.cooldowns.greatHeal=0;assert.ok(!canCommandBattle(b,{type:'cast',unitId:'u',skillId:'greatHeal'}));stepBattle(b,1.1);assert.ok(!canCommandBattle(b,{type:'cast',unitId:'u',skillId:'greatHeal'}));
});
test('spirit summons two invulnerable golems with landing stun, capped five-second lifetime',()=>{
 const b=field('bubble',['bubbleRing','spirit']);cast(b,'bubbleRing');stepBattle(b,.5);assert.equal(b.summons.filter(s=>s.alive).length,2);assert.ok(b.summons.every(s=>s.kind==='golem'));assert.ok(b.enemies[0].statuses.some(s=>s.kind==='stun'));validateBattle(b);stepBattle(b,5.1);assert.equal(b.summons.filter(s=>s.alive).length,0);
});
test('calm hastens active cooldown with an internal cooldown; extra targets do not multiply procs',()=>{
 const b=field('spike',['piercingShot','calm','scatter']),u=b.units[0];u.cooldowns.piercingShot=10000;u.interval=.05;
 for(let i=0;i<500&&!u.skillActivations.calm;i++){u.nextAttackTick=b.tick;stepBattle(b,.35);}assert.ok(u.skillActivations.calm);assert.ok(u.cooldowns.piercingShot<10000);const count=u.skillActivations.calm,deadline=u.cooldowns.calm;while(b.tick<deadline-1){u.nextAttackTick=b.tick;stepBattle(b,.05);}assert.equal(u.skillActivations.calm,count);validateBattle(b);
});
