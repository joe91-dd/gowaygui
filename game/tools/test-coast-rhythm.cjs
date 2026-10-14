const assert=require('node:assert/strict'),{fixture,tell}=require('./test-coast-mechanics.cjs'),{fresh,act}=require('./test-coast-trial.cjs');
const B=require('../.test-coast/core/battle'),R=require('../.test-coast/core/expeditionRules'),{validateBattle}=require('../.test-coast/core/battleValidation');
function ally(b,role,slot){const t=b.expedition.players[0].templates.find(t=>t.role===role);const u=B.createBattle(b.levelId,1,[{id:'field-ally-'+slot,ownerId:'local-player',turtle:t,slot,placement:R.expeditionSlots(b.levelId)[slot],level:1,fusionRank:1}],{seed:42,rulesVersion:'0.6',mode:'chapter',formationVersion:2,expedition:b.expedition}).units[0];b.units.push(u);return u;}
for(let map=0;map<5;map++){
 const b=fresh(map);for(let wave=1;wave<=10;wave++){b.wave=wave;const sp=R.expeditionSpawns(b),normal=sp.filter(s=>s.kind!=='boss'),boss=sp.find(s=>s.kind==='boss');
  assert.ok(sp.every((s,i)=>!i||s.time>=sp[i-1].time),'spawn order must remain chronological');assert.ok(boss.time<=normal.at(-1).time+.6);
  if(wave>=3){assert.ok(normal.some(s=>s.kind==='snail'));assert.ok(normal.at(-1).time-normal[0].time<25,'packs must finish spawning promptly');}
 }
 for(let seed=1;seed<=20;seed++){const start=fresh(map,seed);act(start,'recruit');act(start,'recruit');assert.ok(start.units.some(u=>['spike','crystal'].includes(u.role)),'two recruits must include available damage role');}
}
let {b,u,e}=fixture('crystal');tell(e,u,b);B.commandBattle(b,{type:'cast',unitId:u.id,skillId:'crystalCannon',point:{x:e.x,z:e.z}});B.stepBattle(b,.1);assert.ok(e.statuses.some(s=>s.kind==='armorDown'&&s.amount===250));assert.ok(e.statuses.some(s=>s.kind==='resistDown'&&s.amount===250));validateBattle(b);
// Fusion splash/piercing are basic attacks, not premature rank-three active unlocks.
function hits(role,rank,buff){const f=fixture(role);const {b,u,e}=f;u.fusionRank=rank;u.skills=[];u.skillActivations={};u.cooldowns={};u.attack=500;u.expeditionBase.attack=500;u.nextAttackTick=b.tick;delete u.pendingAttack;
 if(buff)b.expedition.players[0].buffs[buff]=1;
 e.x=u.x+.6;e.z=u.z;e.armor=e.resist=0;e.distance=5;
 for(let i=0;i<4;i++){const x={...structuredClone(e),id:'enemy-1-'+b.nextEnemyId++,x:u.x+1+i*.2,z:u.z,distance:4-i*.1};b.enemies.push(x);}
 const seen=b.nextEventId;B.stepBattle(b,.4);return new Set(b.events.filter(v=>v.id>=seen&&v.type==='damage'&&v.sourceId===u.id).map(v=>v.targetId)).size;}
assert.equal(hits('spike',1),1);assert.equal(hits('spike',2),2);assert.equal(hits('spike',3),3);assert.equal(hits('spike',1,'tidePierce'),3);
assert.equal(hits('spike',2,'tidePierce'),4);assert.equal(hits('spike',3,'tidePierce'),5);
assert.equal(hits('crystal',1),3);assert.equal(hits('crystal',2),4);assert.equal(hits('crystal',2,'crystalBurst'),5);
// A real healing attack with overflow must survive a save/reload without inventing a learned skill.
({b,u,e}=fixture('leaf'));u.skills=['greatHeal'];u.skillActivations={};u.cooldowns={};u.hp-=1;u.nextAttackTick=b.tick;b.expedition.players[0].buffs.healingTide=1;b.expedition.bossAwards=[1];B.stepBattle(b,.4);
assert.ok(u.shield>0&&u.shield<=u.maxHp*.06);assert.ok(u.shields.some(s=>s.buffId==='healingTide'));assert.equal(u.skillActivations.healShield,undefined);validateBattle(b);const saved=structuredClone(b);validateBattle(saved);
B.stepBattle(saved,3.2);assert.equal(saved.units[0].shield,0,'overflow shield expires');
const corrupt=structuredClone(b);corrupt.expedition.players[0].buffs={attack:1};assert.throws(()=>validateBattle(corrupt),/护盾祝福来源/,'unowned buff shield rejected');
// Same incoming attacks and tank, only healing switched on/off. No enemy HP/attack nerf in the healer case.
function pressure(healing){const {b,u,e}=fixture('stone');u.skills=['hold'];u.skillActivations={};u.cooldowns={};u.nextAttackTick=99999;
 const slot=R.expeditionSlots(2).map((p,slot)=>({p,slot})).filter(v=>v.slot!==u.slot).sort((a,c)=>Math.hypot(a.p.x-u.x,a.p.z-u.z)-Math.hypot(c.p.x-u.x,c.p.z-u.z))[0].slot;
 const nurse=ally(b,'leaf',slot);nurse.skills=['greatHeal'];nurse.range=5;nurse.expeditionBase.range=5;nurse.nextAttackTick=healing?b.tick:99999;
 e.attack=900;e.interval=1.7;e.range=1.3;e.actionUntilTick=0;e.nextAttackTick=b.tick;e.blockedBy=u.id;e.attackCount=0;e.speed=0;e.statuses=[{kind:'root',amount:1,untilTick:b.tick+600,sourceId:e.id}];
 let seen=b.nextEventId,healed=0;for(let i=0;i<250&&u.alive;i++){B.stepBattle(b,.1);for(const event of b.events.filter(v=>v.id>=seen)){if(event.type==='heal'&&event.sourceId===nurse.id)healed+=event.amount;seen=event.id+1;}}
 return {alive:u.alive,hp:Math.round(u.hp),healed:Math.round(healed)};}
const noHeal=pressure(false),withHeal=pressure(true);assert.equal(noHeal.alive,false);assert.equal(withHeal.alive,true);assert.ok(withHeal.healed>3000);console.log('Healer comparison',JSON.stringify({noHeal,withHeal}));
// Non-trial schedules remain byte-for-byte equal to the previous combat core.
const fs=require('node:fs'),path=require('node:path'),oldPath=path.resolve(__dirname,'../temp/coast-rhythm-20260927/baseline/core/expeditionRules.js');
if(fs.existsSync(oldPath)){const old=require(oldPath);for(const map of [5,14,49,50,51,52,53,54,55,56]){const b=fresh(map);for(const wave of [1,5,10]){b.wave=wave;assert.deepEqual(R.expeditionSpawns(b),old.expeditionSpawns(b));}}}
console.log('PASS pack timing, opening roles, interrupt reward, rank-two mechanics, build buffs, shield persistence and healer survival value');
