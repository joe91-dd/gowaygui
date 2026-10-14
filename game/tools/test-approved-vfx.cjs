const assert=require('node:assert/strict');
const {fixture}=require('./test-coast-mechanics.cjs');
const B=require('../.test-coast/core/battle');
const {validateBattle}=require('../.test-coast/core/battleValidation');
function ready(role,skills=[]){const f=fixture(role);f.u.skills=skills;f.u.nextAttackTick=0;f.u.attackCount=0;f.u.hp=f.u.maxHp;f.b.events=[];f.e.x=f.u.x+1;f.e.z=f.u.z;f.u.range=6;return f;}
function shot(f,seconds=.4){B.stepBattle(f.b,seconds);return f.b.events.filter(e=>e.type==='attack'&&e.effect!=='windup');}
function more(f,n){for(let i=0;i<n;i++)f.b.enemies.push({...structuredClone(f.e),id:'extra-'+i,x:f.u.x+1.5+i*.15,z:f.u.z+.3+i*.25,statuses:[],distance:10+i});}
for(const [skills,count]of [[[],1],[['extraTarget'],2],[['scatter'],3],[['scatter','extraTarget'],4]]){
 const f=ready('spike',skills);more(f,5);const events=shot(f);assert.equal(events.length,count,skills.join('+'));assert.equal(new Set(events.map(e=>e.targetId)).size,count);
}
{
 const f=ready('spike',['bounce']);more(f,1);const events=shot(f),first=f.b.enemies.find(e=>e.id===events[0].targetId),bounce=events.find(e=>e.skillId==='bounce');assert.equal(bounce.fromX,first.x);assert.equal(bounce.fromZ,first.z);assert.notEqual(bounce.fromX,f.u.x);
}
{
 const f=ready('spike',['combo']);f.u.attackCount=4;const events=shot(f);assert.equal(events.length,2);assert.equal(events[0].targetId,events[1].targetId);assert.equal(events[1].skillId,'combo');
}
{
 const f=ready('leaf');const hp=f.e.hp;shot(f);assert.ok(f.e.hp<hp,'healthy party: healer attacks enemy');assert.ok(f.b.events.some(e=>e.type==='attack'&&e.effect==='leaf'));
}
{
 const f=ready('leaf',['doubleHeal','extraTarget']);const allies=Array.from({length:3},(_,i)=>({...structuredClone(f.u),id:'patient-'+i,turtleId:'t-'+i,x:f.u.x-.3-i*.15,hp:f.u.maxHp*.2,skills:[],nextAttackTick:99999}));f.b.units.push(...allies);const hp=f.e.hp;shot(f);assert.equal(f.e.hp,hp,'injured party: healing keeps priority');assert.equal(new Set(f.b.events.filter(e=>e.type==='heal').map(e=>e.targetId)).size,3,'three distinct healing recipients');
}
{
 const f=fixture('leaf');f.u.nextAttackTick=0;f.u.hp=f.u.maxHp;delete f.u.pendingAttack;B.stepBattle(f.b,.05);assert.equal(f.u.pendingAttack.healing,false);validateBattle(f.b);validateBattle(JSON.parse(JSON.stringify(f.b)));f.u.hp=f.u.maxHp*.5;B.stepBattle(f.b,.35);assert.ok(f.b.events.some(e=>e.type==='damage'&&e.targetId===f.e.id),'committed hostile projectile does not change into a heal');
}
{
 const f=ready('crystal');more(f,2);shot(f);assert.ok(f.b.events.some(e=>e.effect==='splash'&&e.radius>0));
}
{
 const f=ready('spike',['critical']);const opponent={...structuredClone(f.u),id:'duel-opponent',x:f.u.x+1,hp:1e8,maxHp:1e8,skills:[],nextAttackTick:999999};
 assert.deepEqual(B.turtleEnemy(f.u).turtleSkills,['critical']);
 for(let i=0;i<8;i++){f.b.tick++;B.duelActions(f.b,[f.u],[opponent]);}
 assert.ok(opponent.hp<opponent.maxHp,'arena windup must land before the next attack interval');
 assert.ok(f.b.events.some(e=>e.type==='damage'&&e.targetId===opponent.id&&typeof e.critical==='boolean'),'arena preserves critical metadata');
}
console.log('PASS: visible 1/2/3/4 target volleys, bounce origin, same-target combo, healer attack/heal priority, committed projectile type, 3 healing links, splash metadata, arena windup and critical metadata.');
