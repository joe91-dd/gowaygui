const test=require('node:test');
const assert=require('node:assert/strict');
const {applySkillBook}=require('../.test-build/core/skillBooks.js');
const {skillsForRole}=require('../.test-build/core/data.js');
const {createBattle,stepBattle,getBattleEvents,commandBattle}=require('../.test-build/core/battle.js');

const clone=value=>JSON.parse(JSON.stringify(value));
function turtle(role='stone',skills=['armor','steady']){
  return {id:'t-book-parent',role,name:'小团',skills:[...skills],
    innate:{attack:84,health:88,defense:82,growth:99},training:{attack:3,health:2,defense:1,growth:2},
    generation:7,bornAt:1788830000000,parentIds:['t-ancestor-a','t-ancestor-b'],locked:true};
}
function battleFor(t){return createBattle(0,1,[{id:'u-book',turtle:t,level:4,slot:0}],{seed:913});}
function deepFreeze(value){
  for(const child of Object.values(value))if(child&&typeof child==='object')deepFreeze(child);
  return Object.freeze(value);
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('a successful application returns a complete receipt and a new turtle, preserving identity, traits and origins',()=>{
  const source=deepFreeze(turtle()),before=clone(source),state={rng:0x6f73412};
  const {receipt,turtle:result}=applySkillBook(state,source,'hold');
  assert.deepEqual(source,before);assert.notEqual(state.rng,0x6f73412);
  const {skills:oldSkills,...oldDetails}=before,{skills:newSkills,...newDetails}=result;
  assert.deepEqual(newDetails,oldDetails);assert.equal(newSkills.length,oldSkills.length);
  assert.equal(newSkills.filter((id,index)=>id!==oldSkills[index]).length,1);
  assert.deepEqual(receipt,{turtleId:source.id,bookSkillId:'hold',replacedSkillId:oldSkills[receipt.replacedIndex],
    replacedIndex:receipt.replacedIndex,beforeSkills:oldSkills,afterSkills:newSkills});
  assert.equal(newSkills[receipt.replacedIndex],'hold');
  // Neither a UI editing the receipt nor the new archive can mutate a run snapshot.
  result.innate.attack++;result.training.health++;result.parentIds.push('later');
  result.skills[0]='regen';receipt.beforeSkills[0]='reach';receipt.afterSkills[0]='openingShield';
  assert.deepEqual(source,before);assert.notDeepEqual(receipt.afterSkills,result.skills);
});

test('one-skill and twelve-skill turtles retain their exact skill count without duplicates',()=>{
  for(const count of [1,12]){
    const allowed=skillsForRole('stone'),source=turtle('stone',allowed.slice(0,count));
    const result=applySkillBook({rng:0x719231},source,'hold');
    assert.equal(result.turtle.skills.length,count);assert.equal(new Set(result.turtle.skills).size,count);
    assert.ok(result.turtle.skills.includes('hold'));assert.doesNotThrow(()=>battleFor(result.turtle));
    assert.deepEqual(source.skills,allowed.slice(0,count));
  }
});

test('fixed state reproduces the same replacement and every existing position is reachable',()=>{
  const source=turtle('stone',skillsForRole('stone').slice(0,12)),a={rng:0x712346},b={rng:0x712346};
  assert.deepEqual(applySkillBook(a,source,'hold'),applySkillBook(b,clone(source),'hold'));assert.deepEqual(a,b);
  const seen=new Set(),state={rng:0x813271};
  for(let attempt=0;attempt<256&&seen.size<12;attempt++){
    const result=applySkillBook(state,source,'hold');seen.add(result.receipt.replacedIndex);
    assert.ok(result.receipt.replacedIndex>=0&&result.receipt.replacedIndex<12);
  }
  assert.deepEqual([...seen].sort((x,y)=>x-y),Array.from({length:12},(_,i)=>i));
});

test('already-owned, incompatible or nonexistent book requests leave both RNG and turtle unchanged',()=>{
  for(const [source,book,error] of [
    [turtle(),'armor',/已经拥有/],
    [turtle(),'greatHeal',/不适合/],
    [turtle('leaf',['reach','doubleHeal']),'hold',/不适合/],
    [turtle(),'not-a-skill',/不适合/],
  ]){
    const state={rng:0x543712},before=clone(source),rng=clone(state);
    assert.throws(()=>applySkillBook(state,source,book),error);
    assert.deepEqual(source,before);assert.deepEqual(state,rng);
  }
});

test('invalid existing skill lists are rejected before randomness and cannot create a thirteenth slot',()=>{
  for(const skills of [[],['armor','armor'],['greatHeal'],skillsForRole('stone').slice(0,13)]){
    const source=turtle('stone',skills),before=clone(source),state={rng:71};
    assert.throws(()=>applySkillBook(state,source,'hold'),/现有技能/);
    assert.deepEqual(source,before);assert.equal(state.rng,71);
  }
});

test('a common shield book changes real battle protection and expires through the real battle clock',()=>{
  const source=turtle('stone',['armor']),existing=battleFor(source),snapshot=clone(existing);
  const applied=applySkillBook({rng:72},source,'openingShield'),next=battleFor(applied.turtle);
  assert.equal(existing.units[0].shield,0);near(next.units[0].shield,next.units[0].maxHp*.1);
  near(existing.units[0].armor-next.units[0].armor,15);
  assert.ok(getBattleEvents(next).some(e=>e.type==='shield'&&e.skillId==='openingShield'&&e.amount>0));
  // Keep a legitimate future spawn so the real engine continues past shield expiry.
  next.spawns=[{kind:'ink',time:10,hpScale:1,attackScale:1}];stepBattle(next,6.05);
  near(next.units[0].shield,0);
  assert.deepEqual(existing,snapshot);assert.deepEqual(source.skills,['armor']);
});

test('an active heal book produces real healing and cooldowns, and replacing it removes casting permission',()=>{
  const source=turtle('leaf',['reach']),before=battleFor(source);
  const applied=applySkillBook({rng:73},source,'greatHeal'),after=battleFor(applied.turtle);
  for(const state of [before,after]){
    state.spawns=[{kind:'ink',time:10,hpScale:1,attackScale:1}];state.units[0].hp=state.units[0].maxHp*.3;
  }
  const beforeHp=before.units[0].hp,afterHp=after.units[0].hp;
  assert.equal(commandBattle(before,{type:'cast',unitId:'u-book',skillId:'greatHeal'}),false);
  assert.equal(commandBattle(after,{type:'cast',unitId:'u-book',skillId:'greatHeal'}),true);
  stepBattle(before,.05);stepBattle(after,.05);
  near(before.units[0].hp-beforeHp,before.units[0].attack);
  near(after.units[0].hp-afterHp,after.units[0].attack*2.2);
  assert.equal(after.units[0].skillActivations.greatHeal,1);assert.ok(after.units[0].cooldowns.greatHeal>after.tick);
  assert.ok(getBattleEvents(after).some(e=>e.type==='heal'&&e.skillId==='greatHeal'&&e.amount>0));
  const replaced=applySkillBook({rng:74},applied.turtle,'armor'),without=battleFor(replaced.turtle);
  assert.equal(replaced.receipt.replacedSkillId,'greatHeal');
  assert.equal(commandBattle(without,{type:'cast',unitId:'u-book',skillId:'greatHeal'}),false);
  assert.equal(without.units[0].skills.includes('greatHeal'),false);
});
