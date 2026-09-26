const test=require('node:test'),assert=require('node:assert/strict');
const core='../.test-build/core/';
const {BATTLE_MAPS}=require(core+'data');
const {MODE_PATH_PIXELS,modePoint,modePixel,modeGroundIssue}=require(core+'modeStageGeometry');
const {placementIssue}=require(core+'placement');
const {makeInitialSave}=require(core+'game');
const {enablePrototype}=require(core+'prototype');
const {enableLiving}=require(core+'living');
const {startRaid,raidBattle,stepRaid}=require(core+'raids');
const {createWorldBossFight,stepWorldBoss}=require(core+'worldBoss');
const now=Date.parse('2026-09-23T12:00:00+08:00');
function save(){const s=makeInitialSave(now,731);enablePrototype(s);enableLiving(s);return s;}
for(let id=50;id<=56;id++)test('approved scene '+id+' shares artwork, road and valid free ground',()=>{
 const m=BATTLE_MAPS[id];assert.equal(m.sceneArt,'map-mode-scene-'+id);assert.equal(m.stationVersion,6);assert.equal(m.layoutVersion,2);assert.ok(m.slots.length>=8);
 for(const [i,p]of m.slots.entries())assert.equal(placementIssue(m,p,m.slots.filter((_,j)=>j!==i)),undefined,'station '+i);
 for(const r of MODE_PATH_PIXELS[id])for(const [x,y]of r){const p=modePoint(x,y),q=modePixel(p);assert.ok(Math.abs(q.x-x)<1e-8&&Math.abs(q.y-y)<1e-8);assert.ok(modeGroundIssue(id,p),'the visible road is not placeable');}
 assert.ok(modeGroundIssue(id,modePoint(30,850)),'ocean must reject placement');
 const free=m.slots[0],offset={x:free.x+.015,z:free.z+.015};assert.equal(placementIssue(m,offset),undefined,'free placement is not restricted to station centers');
});
test('single, double-entry and closed-loop topology remains mode-specific',()=>{
 assert.equal(BATTLE_MAPS[51].routes.length,2);assert.notDeepEqual(BATTLE_MAPS[51].routes[0][0],BATTLE_MAPS[51].routes[1][0]);
 for(const id of [51,52,53]){const paths=BATTLE_MAPS[id].routes;assert.deepEqual(paths[0].at(-1),paths[1].at(-1));}
 const loop=BATTLE_MAPS[55].route;assert.deepEqual(loop[0],loop.at(-1));
 for(const id of [54,56])assert.equal(BATTLE_MAPS[id].route.length,2);
});
for(let tier=0;tier<4;tier++)test('raid '+tier+' starts with 5 legal allies and emits enemies on registered routes',()=>{
 const s=save(),r=startRaid(s,now,tier,Object.keys(s.collection).slice(0,5));r.battle=raidBattle(r);r.phase='combat';
 const b=r.battle,m=BATTLE_MAPS[b.levelId];assert.equal(b.units.length,5);
 b.units.forEach((u,i)=>assert.equal(placementIssue(m,u,b.units.filter((_,j)=>j!==i)),undefined));
 stepRaid(r,2);assert.ok(b.enemies.length>0);assert.ok(b.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.z)));
 if(tier===0)assert.equal(new Set(b.spawns.map(x=>x.routeId??0)).size,2,'both visible entrances get spawn assignments');
});
test('all world boss variants reach the actual pearl at exactly 90 seconds',()=>{
 const roster=Object.values(save().collection).slice(0,5),map=BATTLE_MAPS[56];
 for(let i=0;i<4;i++){const f=createWorldBossFight('review-'+i,'2026-09-23',i,roster,now);assert.equal(f.battle.enemies.length,1);stepWorldBoss(f,45);const boss=f.battle.enemies[0];assert.ok(Math.abs(boss.distance/f.battle.routeLength-.5)<1e-7);stepWorldBoss(f,45);assert.equal(f.battle.tick,1800);assert.equal(f.phase,'result');assert.ok(Math.hypot(boss.x-map.route.at(-1).x,boss.z-map.route.at(-1).z)<1e-7);assert.ok(f.damage>0);}
});
