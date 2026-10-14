// Uses the actual browser preview roster, including its long-range crystal build.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.COAST_CORE||'../.test-coast/core';const core=n=>require(path.resolve(__dirname,root,n));
const B=core('battle'),R=core('expeditionRules'),{allMapsReviewSave}=core('allMapsReview');
const templates=Object.values(allMapsReviewSave(1790424000000,false,true).collection);
function solo(role,slot,seed=41){
 const map=0,exp=R.newExpedition('chapter',map,[{id:'local-player',templates}]),t=templates.find(t=>t.role===role);
 const b=B.createBattle(map,1,[{id:'field-solo',ownerId:'local-player',turtle:t,level:1,slot,placement:R.expeditionSlots(map)[slot],fusionRank:3}],{seed,rulesVersion:'0.6',mode:'chapter',formationVersion:2,expedition:exp});b.autoSkills=true;
 let seen=0,incoming=0,entranceKills=0;const waves=[];
 for(let n=0;n<14000&&b.status==='fighting';n++){
  const p=b.expedition.players[0];if(p.choices.length){const order=['range','attack','speed','crystalBurst','tidePierce','drain','regen'];B.expeditionAction(b,p.id,'buff',{buff:order.find(x=>p.choices.includes(x))??p.choices[0]});}
  B.stepBattle(b,.1);
  for(const e of b.events.filter(e=>e.id>seen)){seen=e.id;if(e.type==='damage'&&e.targetId==='field-solo')incoming+=e.amount??0;if(e.type==='defeat'&&e.targetId?.startsWith('enemy')){const enemy=b.enemies.find(v=>v.id===e.targetId);if(enemy?.distance<5)entranceKills++;}}
  if(!waves.includes(b.wave))waves.push(b.wave);
 }
 return {role,slot:slot+1,status:b.status,wave:b.wave,core:b.coreHealth,hp:Math.round(b.units[0].hp),incoming:Math.round(incoming),entranceKills,seconds:Math.round(b.elapsed)};
}
if(require.main===module){const quick=process.argv.includes('--quick'),rows=[];for(const role of ['stone','spike','crystal','leaf','bubble'])for(const slot of quick?[2,3]:Array.from({length:12},(_,i)=>i)){const r=solo(role,slot);rows.push(r);console.log(JSON.stringify(r));}
 const out=path.resolve(__dirname,'../temp/coast-spawncamp-20260927');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,(process.env.COAST_REPORT||'solo')+'.json'),JSON.stringify(rows,null,2));
 if(process.argv.includes('--assert'))assert.equal(rows.filter(r=>r.status==='won').length,0,'a single stationary rank-three starter can still solo all ten waves');
}
module.exports={solo,templates};
