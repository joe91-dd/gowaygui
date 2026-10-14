const assert=require('node:assert/strict');
const C=n=>require('../.test-coast/core/'+n),B=C('battle'),R=C('expeditionRules'),V=C('battleValidation');
const templates=Object.values(C('allMapsReview').allMapsReviewSave(1790424000000,false,true).collection);
function fresh(map=0){const kind=map===50?'endless':map>=51?'raid':'chapter',limit=kind==='raid'?[10,15,20,20][map===55?3:map-51]:R.chapterWaves(map);return B.createBattle(map,1,[],{rulesVersion:'0.6',mode:kind==='endless'?'endless':'chapter',formationVersion:2,seed:41,expedition:R.newExpedition(kind,map,Array.from({length:kind==='raid'?2:1},(_,i)=>({id:'p'+i,templates})),limit)});}
function freeze(b){for(const e of b.enemies){e.speed=0;e.attack=0;e.nextAttackTick=999999;e.abilityReadyTick=999999;e.actionUntilTick=999999;delete e.cast;delete e.slam;e.traitReadyTick=999999;}}
function until(b,tick){while(b.tick<tick&&b.status==='fighting'){freeze(b);B.stepBattle(b,.05);}}
// Every wave-based scene advances with surviving monsters and survives serialization.
for(const map of [...Array.from({length:50},(_,i)=>i),50,51,52,53,55]){
 const b=fresh(map),due=b.expedition.nextWaveTick;until(b,due-1);assert.equal(b.wave,1);assert.ok(b.enemies.some(e=>e.alive));until(b,due+20);assert.equal(b.wave,2,'map '+map+' timed wave');assert.ok(b.enemies.some(e=>e.alive&&e.originWave===1));assert.ok(b.enemies.some(e=>e.alive&&e.originWave===2));assert.equal(b.expedition.completed,0);V.validateBattle(JSON.parse(JSON.stringify(b)));
}
const b=fresh();until(b,b.expedition.nextWaveTick+1);until(b,Math.ceil(Math.max(...b.spawns.map(s=>s.time))*20)+1);freeze(b);
const boss1=b.enemies.find(e=>e.kind==='boss'&&e.originWave===1),boss2=b.enemies.find(e=>e.kind==='boss'&&e.originWave===2);assert.ok(boss1&&boss2);
const defeat=e=>{e.alive=false;e.hp=0;b.kills++;R.expeditionKill(b,e);};
defeat(boss2);defeat(boss1);assert.deepEqual(b.expedition.bossAwards,[2,1],'overlapping bosses award their own wave');
while(b.expedition.players[0].choices.length){const p=b.expedition.players[0];R.chooseExpeditionBuff(b,p.id,p.choices[0]);}
for(const e of b.enemies.filter(e=>e.alive&&e.originWave===2))defeat(e);B.stepBattle(b,.05);assert.ok(b.expedition.clearedWaves.includes(2));assert.ok(!b.expedition.clearedWaves.includes(1));
const paid=b.expedition.players[0].earned;B.stepBattle(b,.05);assert.equal(b.expedition.players[0].earned,paid,'wave reward once');V.validateBattle(b);
// Choice pause freezes the clock. Pausing never eats the next scheduled wave.
const paused=fresh();paused.expedition.players[0].choices=['attack','defense','health'];const before=paused.tick;B.stepBattle(paused,30);assert.equal(paused.tick,before);
// Restore an old checkpoint without re-paying completed waves.
const old=fresh();delete old.expedition.cadenceVersion;delete old.expedition.clearedWaves;old.expedition.completed=0;B.stepBattle(old,.05);assert.equal(old.expedition.cadenceVersion,1);V.validateBattle(old);
until(old,50);old.events.push({id:old.nextEventId++,tick:old.tick,type:'attack',sourceId:old.enemies[0].id,targetId:old.enemies[0].id,fromX:-3,fromZ:-1});V.validateBattle(JSON.parse(JSON.stringify(old)));
// Starting the final wave is not victory: all residual waves must be resolved first.
const final=fresh();while(final.wave<10)until(final,final.expedition.nextWaveTick+1);until(final,Math.ceil(Math.max(...final.spawns.map(s=>s.time))*20)+1);assert.equal(final.status,'fighting');
for(const e of final.enemies){e.alive=false;e.hp=0;}final.kills=final.enemies.length;B.stepBattle(final,.05);assert.equal(final.status,'won');assert.equal(final.expedition.completed,10);V.validateBattle(final);
// All new combat instances use the same short melee / ranged baselines.
for(const map of [0,20,50,51,54,56])for(const t of templates){const input={id:t.id,turtle:{...t,skills:t.skills.filter(id=>id!=='reach')},level:1,slot:0};const actor=B.createBattle(map,1,[input],{rulesVersion:'0.6'}).units[0];assert.equal(actor.range,t.role==='stone'?1.2:2.4);}
// The user explicitly retained revival as a rank-three specialization.
for(const rank of [1,3]){
 const x=fresh(),slots=R.expeditionSlots(0),a=slots.findIndex((p,i)=>slots.some((q,j)=>j!==i&&Math.hypot(p.x-q.x,p.z-q.z)<2.4)),j=slots.findIndex((p,i)=>i!==a&&Math.hypot(p.x-slots[a].x,p.z-slots[a].z)<2.4);
 assert.ok(j>=0);const leaf=templates.find(t=>t.role==='leaf'),stone=templates.find(t=>t.role==='stone');
 const f=B.createBattle(0,1,[{id:'healer',ownerId:'p0',turtle:leaf,level:1,slot:a,placement:slots[a],fusionRank:rank},{id:'fallen',ownerId:'p0',turtle:stone,level:1,slot:j,placement:slots[j],fusionRank:1}],{rulesVersion:'0.6',formationVersion:2,expedition:x.expedition});
 f.units[1].alive=false;f.units[1].hp=0;B.stepBattle(f,.05);assert.equal(f.units[1].alive,rank===3);if(rank===3)assert.ok(f.events.some(e=>e.effect==='revive'));V.validateBattle(f);
}
console.log('PASS: 55 wave maps timed overlap, persistent enemies, per-wave boss rewards, out-of-order clear exactly once, choice pause, save migration, ranges across all modes, rank-three-only revival.');
