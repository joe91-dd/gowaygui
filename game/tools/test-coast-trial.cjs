const assert=require('node:assert/strict'),fs=require('node:fs');
const C=n=>require('../.test-coast/core/'+n),{allMapsReviewSave}=C('allMapsReview'),B=C('battle'),R=C('expeditionRules'),{validateBattle}=C('battleValidation');
function fresh(map,seed=41){const templates=Object.values(allMapsReviewSave(1790424000000,false,true).collection);return B.createBattle(map,1,[],{seed,rulesVersion:'0.6',mode:'chapter',formationVersion:2,expedition:R.newExpedition('chapter',map,[{id:'local-player',templates}])});}
function act(b,type,args={}){B.expeditionAction(b,b.expedition.players[0].id,type,args);}
function place(b){const alive=b.units.filter(u=>u.alive),slots=R.openingStations(b.levelId,alive.map(u=>u.role));alive.forEach((u,i)=>{if(!b.units.some(v=>v!==u&&v.slot===slots[i]))try{act(b,'move',{a:u.id,slot:slots[i]});}catch{}});}
function sim(map,seed,active=true,stop=10){const b=fresh(map,seed);act(b,'recruit');act(b,'recruit');place(b);b.autoSkills=true;let offers=0,merges=0,dodges=0,casts=0,peak=0,seen=0,dead=0,lastWave=0,incoming=0,healing=0;
 for(let n=0;n<24000&&b.status==='fighting'&&(stop===10||b.expedition.completed<stop);n++){
  const p=b.expedition.players[0];if(p.choices.length){act(b,'buff',{buff:['range','attack','speed'].find(x=>p.choices.includes(x))??p.choices[0]});offers++;}
  if(n%5===0){
   if(p.coins>=C('expeditionEconomy').expeditionRecruitCost(b.expedition,p)&&p.recruited<20&&b.units.length<12){act(b,'recruit');place(b);}
   const live=b.units.filter(u=>u.alive),a=live.find(u=>live.length>=6&&u.fusionRank<3&&live.some(v=>v!==u&&v.role===u.role&&v.fusionRank===u.fusionRank));
   if(active&&a){const target=live.find(v=>v!==a&&v.role===a.role&&v.fusionRank===a.fusionRank);try{act(b,'move',{a:a.id,slot:target.slot});merges++;}catch{}}
   const threats=b.enemies.filter(e=>active&&e.alive&&e.cast).map(e=>e.cast);
   for(const u of b.units.filter(u=>u.alive&&threats.some(t=>Math.hypot(t.x-u.x,t.z-u.z)<=1.25))){const candidates=R.expeditionSlots(map).map((v,slot)=>({...v,slot})).filter(v=>!b.units.some(o=>o.slot===v.slot)&&threats.every(t=>Math.hypot(t.x-v.x,t.z-v.z)>1.55)).sort((a,c)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(c.x-u.x,c.z-u.z));if(candidates[0])try{act(b,'move',{a:u.id,slot:candidates[0].slot});dodges++;}catch{}}
  }
  B.stepBattle(b,.1);peak=Math.max(peak,b.enemies.filter(e=>e.alive).length);for(const e of b.events.filter(e=>e.id>seen)){if(e.effect?.startsWith('bossTell-'))casts++;if(e.type==='defeat'&&e.targetId?.startsWith('field-'))dead++;if(e.type==='damage'&&e.targetId?.startsWith('field-'))incoming+=e.amount??0;if(e.type==='heal'&&e.targetId?.startsWith('field-')&&e.sourceId!==e.targetId)healing+=e.amount??0;seen=e.id;}if(b.wave!==lastWave){if(active)place(b);validateBattle(b);lastWave=b.wave;}
 }
 validateBattle(b);return {map:map+1,seed,active,status:b.status,wave:b.wave,completed:b.expedition.completed,core:b.coreHealth,recruits:b.expedition.players[0].recruited,offers,merges,dodges,casts,dead,peak,incoming:Math.round(incoming),healing:Math.round(healing),seconds:Math.round(b.elapsed)};
}
if(process.argv.includes('--sim')){const result=[];for(let map=0;map<5;map++){for(const active of [true,false]){const r=sim(map,41,active);result.push(r);console.log(JSON.stringify(r));}}fs.writeFileSync('temp/coast-trial-20260926/simulation.json',JSON.stringify(result,null,2));process.exit();}
for(let map=0;map<5;map++){const b=fresh(map);assert.equal(b.expedition.coastTrial,1);assert.equal(b.units.length,0);assert.equal(b.spawns.filter(v=>v.kind!=='boss').length,6);assert.equal(new Set(b.spawns.map(s=>s.routeId??0)).size,1);for(let w=1;w<=10;w++){b.wave=w;const sp=R.trialFronts(b,R.expeditionSpawns(b));assert.equal(sp.filter(s=>s.kind!=='boss').length,R.trialWaveCounts[w-1]);assert.equal(sp.filter(s=>s.kind==='boss').length,1);if(w<=2)assert.ok(sp.every(s=>(s.routeId??0)===0));if(w>=5&&b.routes)assert.equal(new Set(sp.map(s=>s.routeId)).size,b.routes.length);}}
assert.equal(fresh(5).expedition.coastTrial,undefined);
const b=fresh(0);act(b,'recruit');act(b,'recruit');validateBattle(b);const roles=b.units.map(u=>u.role);assert.ok(roles.some(r=>r!=='leaf'));const before=b.units[0],target=b.units[1];act(b,'move',{a:before.id,slot:target.slot});assert.equal(b.units[0].fusionRank,2);assert.ok(b.units[0].attack>400);validateBattle(b);
console.log('PASS isolated first-five version, empty board, 6→72 counts, staged entrances, recruit/fusion/validation');
module.exports={fresh,sim,act,place};


