const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const load=process.argv[2]?require('./test-built-core.cjs').loadBuiltCore(path.resolve(process.argv[2])).load:n=>require('../.test-build/core/'+n+'.js');
const plain=x=>JSON.parse(JSON.stringify(x));
const {BATTLE_MAPS}=load('data'),{scenePoint,scenePixel,sceneGroundIssue,sceneRoadDistance,SCENE_REVISION}=load('sceneGeometry');
const {placementIssue}=load('placement'),{createBattle,stepBattle,positionOnRoute}=load('battle'),{validateBattle}=load('battleValidation');
const {makeInitialSave}=load('game'),{migrateSceneBattle}=load('sceneMigration');
const {SCENE_GEOMETRY_DATA}=load('sceneGeometryData'),{PREVIOUS_SCENE_GEOMETRY}=load('sceneGeometryPrevious');
const crypto=require('node:crypto'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const row of JSON.parse(fs.readFileSync('tools/scene-registration-manifest.json','utf8')).maps){assert.equal(sha(fs.readFileSync('assets/resources/art-modern/'+row.art+'.png')),row.artSha256,'Artwork changed: review navigation and placement for '+row.art);assert.equal(sha(JSON.stringify(SCENE_GEOMETRY_DATA[row.id])),row.geometrySha256,'Geometry changed: review the artwork overlay for '+row.art);}
const pets=Object.values(makeInitialSave(1788830000000,731).collection).slice(0,5),rows=[];
for(const m of BATTLE_MAPS){
 assert.equal(m.sceneRevision,SCENE_REVISION);assert.equal(m.slots.length,16);
 for(let i=0;i<16;i++)assert.equal(placementIssue(m,m.slots[i],m.slots.filter((_,j)=>j!==i)),undefined,`map ${m.id} slot ${i}`);
 const routes=m.routes??[m.route],g=SCENE_GEOMETRY_DATA[m.id];
 for(const r of routes){
  if(m.id!==55)assert.ok(Math.hypot(r.at(-1).x-m.route.at(-1).x,r.at(-1).z-m.route.at(-1).z)<1e-6);
  for(const p of r){assert.ok(sceneGroundIssue(m.id,p),`map ${m.id} road accepts turtle`);assert.ok(sceneRoadDistance(m.id,p)<1e-6);const q=scenePixel(m.id,p),again=scenePoint(m.id,q.x,q.z);assert.ok(Math.hypot(p.x-again.x,p.z-again.z)<1e-9);}
 }
 for(const [x,y]of [[0,0],[559,300],[10,290]])assert.ok(sceneGroundIssue(m.id,scenePoint(m.id,x,y)));
 for(const [x,y]of g.obstacles)assert.ok(sceneGroundIssue(m.id,scenePoint(m.id,x,y)));
 // Continuous placement is not limited to the recommended points: sub-pixel offsets work too.
 let free=0;for(let y=80;y<220;y+=7)for(let x=90;x<480;x+=7){const p=scenePoint(m.id,x+.23,y+.71);if(!sceneGroundIssue(m.id,p)){free++;assert.equal(placementIssue(m,p),undefined);}}
 assert.ok(free>25,`map ${m.id} has too little usable ground`);
 const b=createBattle(m.id,1,pets.map((turtle,slot)=>({id:'audit-'+slot,turtle,slot,level:1})),{rulesVersion:'0.6',mode:m.id<50?'chapter':'endless',waveLimit:m.id<50?5:undefined});
 const lanes=new Set();let samples=0;
 if(m.id!==54&&m.id!==56){
  for(let t=0;t<450;t++){stepBattle(b,.1);for(const e of b.enemies.filter(e=>e.alive&&!e.mechanismOwner)){lanes.add(e.routeId??0);assert.ok(sceneRoadDistance(m.id,e)<1e-5,`map ${m.id} enemy ${e.id} off-road`);samples++;}}
  assert.equal(lanes.size,routes.length,`map ${m.id} unused route`);assert.ok(samples>0);validateBattle(b);
 }
 // Save migration from the exact released routes, preserving all non-geometric combat state.
 const legacy=createBattle(m.id,1,pets.map((turtle,slot)=>({id:'old-'+slot,turtle,slot,level:1})),{rulesVersion:'0.6',mode:'endless'}),old=PREVIOUS_SCENE_GEOMETRY[m.id];
 const len=r=>r.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-r[i].x,p.z-r[i].z),0);
 legacy.route=plain(old.route);legacy.routeLength=len(old.route);legacy.routes=old.routes?plain(old.routes):undefined;legacy.routeLengths=old.routes?.map(len);delete legacy.sceneRevision;
 legacy.units.forEach(u=>{Object.assign(u,old.slots[u.slot]);delete u.placement;});
 const before=legacy.units.map(u=>[u.id,u.hp,u.maxHp,u.attack,u.armor,u.skills]),rng=legacy.rng;
 assert.equal(migrateSceneBattle(legacy),true);assert.equal(legacy.sceneRevision,SCENE_REVISION);assert.equal(legacy.rng,rng);assert.deepEqual(legacy.units.map(u=>[u.id,u.hp,u.maxHp,u.attack,u.armor,u.skills]),before);validateBattle(legacy);assert.equal(migrateSceneBattle(legacy),false);
 rows.push({id:m.id,name:m.name,routes:routes.length,safeStations:16,freeGroundSamples:free,onRoadEnemySamples:samples});
}
const {createWorldBossFight,stepWorldBoss}=load('worldBoss');
for(let i=0;i<4;i++){const f=createWorldBossFight('audit','day',i,pets,1788830000000);stepWorldBoss(f,90);assert.equal(f.battle.tick,1800);assert.equal(f.phase,'result');assert.ok(sceneRoadDistance(56,f.battle.enemies[0])<1e-6);assert.ok(Math.hypot(f.battle.enemies[0].x-f.battle.route.at(-1).x,f.battle.enemies[0].z-f.battle.route.at(-1).z)<1e-7);}
const {startArena,stepArena}=load('arena'),{enablePrototype}=load('prototype'),{initCommunity}=load('community');
const s=makeInitialSave(1788830000000,731);enablePrototype(s);initCommunity(s,1788830000000);const opponent=Object.keys(s.community.aiPlayers)[0];const a=startArena(s,1788830000000,opponent,Object.keys(s.collection).slice(0,5),true);
for(let i=0;i<600;i++){stepArena(a,.05);for(const m of a.movers.filter(m=>m.enterTick<=a.battle.tick&&!m.waiting)){const u=a.attackers.find(u=>u.id===m.id);if(u.alive&&!m.escaped)assert.ok(sceneRoadDistance(54,u)<1e-6);}}
assert.ok(a.defenders.every(u=>!sceneGroundIssue(54,u.placement??u)));
const result={revision:SCENE_REVISION,maps:rows,worldBosses:4,worldBossSeconds:90,arenaChecked:true};
fs.mkdirSync('temp/all-scenes-audit-20260923',{recursive:true});fs.writeFileSync('temp/all-scenes-audit-20260923/'+(process.argv[2]?'built':'source')+'-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({maps:rows.length,stations:rows.reduce((n,r)=>n+r.safeStations,0),freeGroundSamples:rows.reduce((n,r)=>n+r.freeGroundSamples,0),enemySamples:rows.reduce((n,r)=>n+r.onRoadEnemySamples,0),worldBoss90s:true,arena:true}));

