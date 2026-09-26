const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.env.GOWAYGUI_TEST_BUILD||path.join(__dirname,'../.test-build');
const {BATTLE_MAPS,LEGACY_PAINTED_MAPS,battleMap}=require(path.join(base,'core/data.js'));
const {battleThemeIndex}=require(path.join(base,'core/battleThemes.js'));
const {groundIssue,placementIssue}=require(path.join(base,'core/placement.js'));
const {paintedLayout,ROAD_PLACEMENT_CLEARANCE}=require(path.join(base,'core/paintedMaps.js'));
const {routeClearance}=require(path.join(base,'core/mapPresentation.js'));

test('all 57 battle maps have legal spaced defaults and actual shared render routes',()=>{
 assert.equal(BATTLE_MAPS.length,57);
 for(const m of BATTLE_MAPS){
  assert.equal(m.stationVersion,6);assert.equal(m.layoutVersion,2);assert.deepEqual(m.route,paintedLayout(m.id).routes[0]);
  assert.ok(m.slots.length>=5);
  m.slots.forEach((p,i)=>assert.equal(placementIssue(m,p,m.slots.filter((_,j)=>j!==i)),undefined,`${m.id}/${i}`));
  for(const route of m.routes??[m.route])for(const p of route)assert.ok(groundIssue(m,p),'road must reject deployment');
 }
});
test('continuous placement includes arbitrary non-anchor points and large off-road regions',()=>{
 for(const m of BATTLE_MAPS){
  const cells=new Set();let count=0;
  for(let y=0;y<34;y++)for(let x=0;x<76;x++){
   const p={x:-7.5+x*.2,z:-3.45+y*.2};
   if(!groundIssue(m,p)){cells.add(x+','+y);count++;assert.ok(routeClearance(m,p)>=ROAD_PLACEMENT_CLEARANCE);}
  }
  let largest=0;
  while(cells.size){const seed=cells.values().next().value,queue=[seed];cells.delete(seed);let size=0;
   for(let i=0;i<queue.length;i++){size++;const [x,y]=queue[i].split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(x+dx)+','+(y+dy);if(cells.delete(k))queue.push(k);}}
   largest=Math.max(largest,size);
  }
  assert.ok(count>800,`map ${m.id} only ${count} free cells`);
  assert.ok(largest>250,`map ${m.id} largest field only ${largest} cells`);
 }
});
test('chapter groups share themes but offer five different routes',()=>{
 for(let chapter=0;chapter<10;chapter++){
  const maps=BATTLE_MAPS.slice(chapter*5,chapter*5+5);
  assert.equal(new Set(maps.map(m=>battleThemeIndex(m.id))).size,1);
  assert.equal(new Set(maps.map(m=>JSON.stringify(m.routes??m.route))).size,5);
 }
 assert.equal(new Set([51,52,53,54,55].map(id=>battleThemeIndex(id))).size,5);
 assert.equal(new Set([0,1,2,3].map(b=>battleThemeIndex(56,1,b))).size,4);
 assert.equal(new Set([1,6,11,16,21].map(w=>battleThemeIndex(50,w))).size,5);
});
test('saved version 5 battles retain their original route and slots',()=>{
 for(const old of LEGACY_PAINTED_MAPS){const selected=battleMap({levelId:old.id,layoutVersion:2,stationVersion:5});assert.deepEqual(selected.route,old.route);assert.deepEqual(selected.slots,old.slots);}
});
test('arena queued entrants and stopped leaders never stack active models',()=>{
 const {allMapsReviewSave}=require(path.join(base,'core/allMapsReview.js'));
 const {startArena,stepArena}=require(path.join(base,'core/arena.js'));
 const s=allMapsReviewSave(Date.now()),opponent=Object.keys(s.community.aiPlayers)[0];
 const a=startArena(s,Date.now(),opponent,Object.keys(s.collection).slice(0,5),true);
 for(const u of [...a.attackers,...a.defenders]){u.attack=0;u.maxHp=u.hp=100000;u.skills=[];u.statuses=[];}
 for(let tick=0;tick<700&&a.phase==='combat';tick++){
  if(tick===65)a.attackers[0].statuses.push({kind:'root',untilTick:a.battle.tick+80,amount:1});
  stepArena(a,.05);
  const active=a.battle.enemies.filter(e=>e.alive);
  for(let i=0;i<active.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(active[i].x-active[j].x,active[i].z-active[j].z)>=1.09,'overlapping arena entrants');
 }
 assert.ok(a.battle.tick>100);
});
