const test=require('node:test'),assert=require('node:assert/strict');
const {LEVELS,BATTLE_MAPS}=require('../.test-build/core/data.js');
const {HARD_STAGES}=require('../.test-build/core/campaign.js');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
test('50 sequential chapters have 50 unique routes, ten themes and all requested hard stages',()=>{
 assert.equal(LEVELS.length,50);assert.equal(new Set(LEVELS.map(l=>JSON.stringify(l.route))).size,50);
 assert.deepEqual(LEVELS.filter(l=>l.hard).map(l=>l.id+1),HARD_STAGES);
 LEVELS.forEach((l,i)=>{assert.equal(l.id,i);assert.equal(l.sceneTheme,Math.floor(i/5));if(i>4)assert.ok(l.difficulty>LEVELS[i-1].difficulty);});
 assert.equal(new Set(BATTLE_MAPS.slice(50).map(l=>JSON.stringify(l.route))).size,7);
});
test('every chapter and independent challenge map creates a valid real simulation checkpoint',()=>{
 const turtles=Object.values(makeInitialSave(1788948000000,731).collection);
 for(const map of BATTLE_MAPS){const b=createBattle(map.id,1,turtles.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1})),{rulesVersion:'0.6',mode:map.id>=50?'endless':'chapter'});b.autoSkills=true;validateBattle(b);stepBattle(b,2);validateBattle(b);assert.ok(b.spawns.length>=6);}
});
