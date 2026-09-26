const fs=require('node:fs'),path=require('node:path');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const {BATTLE_MAPS}=require('../.test-build/core/data.js');
const {pathLength}=require('../.test-build/core/multiFront.js');
const report=[];
for(const id of [0,1,2,3,4,9,14,24,29,34,39,44,45,46,47,48,49]){
 for(const growth of ['starter','focused']){
  const pets=Object.values(makeInitialSave(1788948000000,93).collection);
  if(growth==='focused')for(const t of pets){t.innate={attack:95,health:95,defense:95,growth:107};t.skills=t.role==='stone'?['hold','taunt','armor','block','reflect','regen']:t.role==='spike'?['piercingShot','swift','combo','critical','extraTarget','pursuit']:t.role==='crystal'?['crystalCannon','bounce','extraTarget','shredResist','pursuit','critical']:t.role==='leaf'?['greatHeal','doubleHeal','healShield','cleanse','encourage','strong']:['bubbleRing','root','shredArmor','extraTarget','weaken','pursuit'];}
  let hp=20,seconds=0,cleared=0,fallen=new Set();const waveLimit=id===0?5:8;
  for(let wave=1;wave<=waveLimit&&hp>0;wave++){
   const b=createBattle(id,wave,pets.map((t,slot)=>({id:t.id,turtle:t,slot,level:Math.min(10,wave),fallen:fallen.has(t.id)})),{rulesVersion:'0.6',mode:'chapter',waveLimit,coreHealth:hp,seed:wave*311+id});b.autoSkills=true;
   while(b.status==='fighting'&&b.elapsed<240)stepBattle(b,.5);
   hp=b.coreHealth;seconds+=b.elapsed;fallen=new Set(b.units.filter(u=>!u.alive).map(u=>u.id));if(b.status==='won')cleared++;else break;
  }
  report.push({id:id+1,growth,cleared,total:waveLimit,hp,combat:Math.round(seconds),withPrep:Math.round(seconds+Math.max(0,cleared-1)*BATTLE_MAPS[id].preparationSeconds),routeLength:Math.round(pathLength(BATTLE_MAPS[id].route))});
 }
}
fs.mkdirSync(path.join(__dirname,'../temp'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../temp/modern-balance.json'),JSON.stringify({scope:'Deterministic auto-cast baseline; fixed first-five stations, no player repositioning, no reserve replacement. Not a human playtime claim.',report},null,2));console.table(report);
