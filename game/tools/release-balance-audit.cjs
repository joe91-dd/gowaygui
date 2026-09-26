// Runs the real fixed-tick simulation. Auto play is a baseline, not a human playtest.
const fs=require('node:fs'),path=require('node:path');
const {makeInitialSave}=require('../.test-build/core/game.js'),{createBattle,stepBattle}=require('../.test-build/core/battle.js'),{initDevelopment,levelCost}=require('../.test-build/core/development.js'),{BATTLE_MAPS}=require('../.test-build/core/data.js');
const builds={
 stone:['hold','taunt','armor','regen','block','reflect','strong','stoneMastery','counterStorm','rebirth','lastShield','resist'],
 spike:['piercingShot','combo','extraTarget','swift','shredArmor','scatter','critical','spikeMastery','pursuit','lifesteal','calm','openingShield'],
 crystal:['crystalCannon','bounce','root','shredResist','extraTarget','arcane','swift','crystalMastery','spellDrain','pursuit','calm','rebirth'],
 leaf:['greatHeal','doubleHeal','healShield','cleanse','encourage','strong','swift','leafMastery','holyLight','regen','armor','lastShield'],
 bubble:['bubbleRing','root','shredArmor','weaken','extraTarget','swift','arcane','spirit','calm','strong','rebirth','openingShield']};
const profiles=[{name:'初始2技能/L1',skills:2,level:1},{name:'4技能/L10',skills:4,level:10},{name:'6技能/L20',skills:6,level:20},{name:'8技能/L30',skills:8,level:30},{name:'12技能/L50',skills:12,level:50}];
const levels=[0,1,4,9,14,24,34,44,49],seeds=[93,371,817],report=[];
for(const id of levels)for(const profile of profiles){
 let results=[];
 for(const seed of seeds){
  const pets=Object.values(makeInitialSave(1789430400000,seed).collection);
  for(const t of pets){initDevelopment(t);t.skills=builds[t.role].slice(0,profile.skills);t.innate={attack:80,health:80,defense:80,growth:100};t.development.xp=Array.from({length:profile.level-1},(_,i)=>levelCost(i+1)).reduce((a,b)=>a+b,0);t.development.points[t.role==='stone'?'health':t.role==='bubble'?'defense':'attack']=(profile.level-1)*3;}
  let hp=20,seconds=0,cleared=0,fallen=new Set(),kills=0,total=0;
  for(let wave=1;wave<=5&&hp>0;wave++){
   const b=createBattle(id,wave,pets.map((t,slot)=>({id:t.id,turtle:t,slot,level:Math.min(10,1+wave-1),fallen:fallen.has(t.id)})),{rulesVersion:'0.6',mode:'chapter',waveLimit:5,coreHealth:hp,seed:seed+wave*311+id});b.autoSkills=true;total+=b.spawns.length;
   while(b.status==='fighting'&&b.elapsed<240)stepBattle(b,.5);
   hp=b.coreHealth;seconds+=b.elapsed;kills+=b.kills;fallen=new Set(b.units.filter(u=>!u.alive).map(u=>u.id));if(b.status==='won')cleared++;else break;
  }
  results.push({cleared,hp,seconds:Math.round(seconds),kills,total});
 }
 report.push({level:id+1,profile:profile.name,wins:results.filter(r=>r.cleared===5).length,seeds:seeds.length,meanHp:Math.round(results.reduce((n,r)=>n+r.hp,0)/seeds.length),seconds:Math.round(results.reduce((n,r)=>n+r.seconds,0)/seeds.length),cleared:results.map(r=>r.cleared).join('/'),results});
}
const out=path.resolve(__dirname,'../../output/release-polish-20260915/balance-simulation.json');fs.writeFileSync(out,JSON.stringify({scope:'135 runs; 5 waves; fixed first 5 stations; no swaps or reposition; role builds and talent held constant; all skills auto; failed runs included in duration; no human timing claim',report},null,2));console.table(report.map(({results,...r})=>r));
