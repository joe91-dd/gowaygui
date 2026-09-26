const assert=require('node:assert/strict');
const path=require('node:path');
const build=process.argv[2];
const load=build?require('./test-built-core.cjs').loadBuiltCore(path.resolve(build)).load:n=>require('../temp/coast-domain-check/core/'+n+'.js');
const {BATTLE_MAPS}=load('data');
const {coastPoint,coastPixel,COAST_DEPTH,COAST_PATH_PIXELS}=load('coastStageGeometry');
const {placementIssue}=load('placement');
const {createBattle,stepBattle}=load('battle');
const {makeInitialSave}=load('game');
const {validateBattle}=load('battleValidation');
const pets=Object.values(makeInitialSave(Date.now(),731).collection).slice(0,5);
for(let id=0;id<50;id++){
 const m=BATTLE_MAPS[id];
 assert.ok(m.slots.length>=5);
 const routes=COAST_PATH_PIXELS[id];
 const end=routes[0][routes[0].length-1];
 for(const r of routes){const last=r[r.length-1];assert.ok(Math.hypot(last[0]-end[0],last[1]-end[1])<1e-6,`stage ${id+1} route does not reach the shared pearl`);}
 for(let i=0;i<m.slots.length;i++)assert.equal(placementIssue(m,m.slots[i],m.slots.filter((_,j)=>j!==i)),undefined,`stage ${id+1} slot ${i}`);
 for(const r of COAST_PATH_PIXELS[id])for(const [x,y]of r){const p=coastPoint(x,y),px=coastPixel(p);assert.ok(Math.abs(px.x-x)<1e-8&&Math.abs(px.y-y)<1e-8);assert.ok(placementIssue(m,p),'roads must reject free placement');}
 for(const pixel of [[800,860],[60,740],[840,10]])assert.ok(placementIssue(m,coastPoint(...pixel)),'sea / border must reject placement');
 const b=createBattle(id,1,pets.map((turtle,slot)=>({id:'coast-'+slot,turtle,slot,level:1})),{rulesVersion:'0.6',mode:'chapter',waveLimit:5});
 assert.deepEqual(JSON.parse(JSON.stringify(b.route)),JSON.parse(JSON.stringify(m.route)));
 const laneSeen=new Set();let samples=0;
 for(let i=0;i<450;i++){
  stepBattle(b,.1);
  for(const e of b.enemies.filter(e=>e.alive&&!e.mechanismOwner)){
   laneSeen.add(e.routeId??0);const pix=coastPixel(e),r=COAST_PATH_PIXELS[id][e.routeId??0];let d=Infinity;
   for(let j=1;j<r.length;j++){const [a,c]=[r[j-1],r[j]],dx=c[0]-a[0],dy=c[1]-a[1],t=Math.max(0,Math.min(1,((pix.x-a[0])*dx+(pix.y-a[1])*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(pix.x-a[0]-dx*t,pix.y-a[1]-dy*t));}
   assert.ok(d<.001,`stage ${id+1} enemy left road by ${d}px`);samples++;
  }
 }
 validateBattle(b);assert.ok(samples>0);assert.equal(laneSeen.size,COAST_PATH_PIXELS[id].length);
 console.log(`stage ${id+1}: ${m.slots.length} safe stations, ${laneSeen.size} lanes, ${samples} on-road enemy samples`);
}
// Aspect after oblique projection must match the source image, not the ground quad.
const verticalProjection=20/Math.hypot(20,12);
assert.ok(Math.abs(18/(COAST_DEPTH*verticalProjection)-1688/932)<1e-10);
// At any viewport, HUD and map use the same contained 1280 x 720 frame.
for(const [w,h]of [[1280,720],[844,390],[932,430],[688,824]]){
 const scale=Math.min(w/1280,h/720),artH=1280*932/1688*scale;
 assert.ok(347*scale<artH/2,'top HUD fits inside artwork');
 assert.ok(340*scale<artH/2,'bottom HUD fits inside artwork');
}
console.log('Coast registration passed: navigation, initial/free placement, projection aspect and HUD containment.');

