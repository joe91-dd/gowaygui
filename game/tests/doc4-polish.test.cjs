const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {BATTLE_MAPS,LEGACY_APPROVED_MAPS,battleMap,SKILL_BY_ID}=require('../.test-build/core/data.js');
const {mapTheme,routeClearance,mapBounds}=require('../.test-build/core/mapPresentation.js');
const {turtleQuality,QUALITY_COLORS}=require('../.test-build/core/prototypeConfig.js');
const {createBattle,skillCastRange,legalSkillTargets,commandBattle}=require('../.test-build/core/battle.js');
const pets=Object.values(makeInitialSave(1788948000000,71).collection);
const input=role=>{const t=pets.find(t=>t.role===role);return {id:role,slot:pets.indexOf(t),level:1,turtle:t};};
test('Doc4 seven frame colors follow skill count independent of aptitude',()=>{
 const ids=Object.keys(SKILL_BY_ID),t=pets[0];
 for(let count=1;count<=12;count++)for(const aptitude of [10,100]){
  const q=turtleQuality({...t,skills:ids.slice(0,count),innate:{...t.innate,attack:aptitude}});
  assert.equal(q.color,QUALITY_COLORS[Math.max(0,count-6)]);
 }
 assert.equal(new Set(QUALITY_COLORS).size,7);
});
test('Doc4 all modes have themes; each five chapters share art and preserve actual routes',()=>{
 assert.equal(BATTLE_MAPS.length,57);
 for(const m of BATTLE_MAPS.filter(m=>m.id<55)){
  assert.ok(mapTheme(m));assert.deepEqual(m.routes,LEGACY_APPROVED_MAPS[m.id].routes);assert.deepEqual(m.route,LEGACY_APPROVED_MAPS[m.id].route);
  const bounds=mapBounds(m);assert.ok(bounds.rx>0&&bounds.rz>0);
  if(m.id<50)assert.equal(mapTheme(m),mapTheme(BATTLE_MAPS[Math.floor(m.id/5)*5]));
  if(m.id===54)continue;
  assert.ok(m.slots.length>=12&&m.slots.length<=16);
  for(const p of m.slots)assert.ok(routeClearance(m,p)>=1.08-1e-8,`${m.id}: station overlaps road`);
  assert.deepEqual(m.slots.slice(0,LEGACY_APPROVED_MAPS[m.id].slots.length),LEGACY_APPROVED_MAPS[m.id].slots);
  assert.equal(battleMap({levelId:m.id,layoutVersion:2,stationVersion:3}),LEGACY_APPROVED_MAPS[m.id]);
 }
 assert.equal(new Set(BATTLE_MAPS.slice(50).map(m=>mapTheme(m).name)).size,6);
});
test('Doc4 cast distance is role specific and invalid ground release consumes nothing',()=>{
 const b=createBattle(0,1,pets.map(t=>input(t.role)),{rulesVersion:'0.6',mode:'chapter',waveLimit:5});
 for(const u of b.units)assert.equal(skillCastRange(b,u),Math.min(u.range,{stone:2.2,spike:3.8,crystal:3.6,leaf:3.5,bubble:2.8}[u.role]));
 const u=b.units.find(u=>u.role==='bubble'),before=JSON.stringify(b);
 assert.equal(commandBattle(b,{type:'cast',unitId:u.id,skillId:'bubbleRing',point:{x:u.x+2.81,z:u.z}}),false);assert.equal(JSON.stringify(b),before);
 assert.equal(commandBattle(b,{type:'cast',unitId:u.id,skillId:'bubbleRing',point:{x:u.x+2.7,z:u.z}}),true);
});
test('Doc4 healer excludes distant allies while legacy saved battles preserve range',()=>{
 const b=createBattle(0,1,[input('leaf'),input('stone')],{rulesVersion:'0.6',mode:'chapter',waveLimit:5}),healer=b.units.find(u=>u.role==='leaf'),ally=b.units.find(u=>u.role==='stone');
 ally.hp-=100;ally.x=healer.x+3.6;ally.z=healer.z;
 assert.ok(!legalSkillTargets(b,healer,'greatHeal').includes(ally));
 ally.x=healer.x+3.4;assert.ok(legalSkillTargets(b,healer,'greatHeal').includes(ally));
 b.stationVersion=3;ally.x=healer.x+20;assert.ok(legalSkillTargets(b,healer,'greatHeal').includes(ally));assert.equal(skillCastRange(b,healer),healer.range);
});
