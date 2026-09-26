const fs=require('node:fs');const {save}=require('./analyze-increment-balance.cjs');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const {RAID_BALANCE,startRaid,beginRaidWave,stepRaid,finishRaid,swapRaidPet}=require('../.test-build/core/raids.js');
if(process.env.RAID_TRIAL)JSON.parse(process.env.RAID_TRIAL).forEach((health,i)=>RAID_BALANCE[i].health=health);
const report={scope:'Synthetic fixed five turtles; automatic actives. No reroll or fusion. Raids switch owner reserves below 30% health; AI uses normal support logic.',endless:[],raids:[]};
for(const profile of ['two','six','twelve']){const s=save(profile,9137),turtles=Object.values(s.collection),fallen=new Set(),sleep={};let health=20,seconds=0,waves=0;
 for(let wave=1;wave<=100;wave++){const b=createBattle(50,wave,turtles.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:Math.min(10,wave),fallen:fallen.has(turtle.id),sleepUntilWave:sleep[turtle.id]})),{coreHealth:health,rulesVersion:'0.6',mode:'endless'});b.autoSkills=true;
  while(b.status==='fighting'&&b.elapsed<300)stepBattle(b,.5);health=b.coreHealth;seconds+=b.elapsed;for(const u of b.units){if(!u.alive)fallen.add(u.id);else fallen.delete(u.id);if(u.sleepUntilWave)sleep[u.id]=u.sleepUntilWave;else delete sleep[u.id];}if(b.status!=='won')break;waves++;}
 report.endless.push({profile,waves,seconds:Math.round(seconds)});
}
for(let tier=0;tier<3;tier++){const s=save('twelve',8142);if(process.env.RAID_OWNER_CRYSTALS){const t=Object.values(s.collection).find(t=>t.role==='crystal');s.collection=Object.fromEntries(Array.from({length:5},(_,i)=>{const p=JSON.parse(JSON.stringify(t));p.id='crystal-'+i;return [p.id,p];}));}startRaid(s,1788948000000,tier,Object.keys(s.collection));let r=s.community.raid;swapRaidPet(r,0,r.members[0].roster.find(p=>p.turtle.role==='crystal').id);
 while(!r.settled){beginRaidWave(s);r=s.community.raid;
  while(r.battle.status==='fighting'&&r.battle.elapsed<300){stepRaid(r,.5);const mine=r.members[0],u=r.battle.units.find(u=>u.id===mine.activeId);
   if(!u||!u.alive||u.hp/u.maxHp<.3){const next=mine.roster.filter(p=>p.id!==mine.activeId&&!r.fallen.includes(p.id)).filter(p=>!r.battle.benchUnits?.some(u=>u.id===p.id&&(!u.alive||u.hp/u.maxHp<.4))).sort((a,b)=>['crystal','spike','stone','leaf','bubble'].indexOf(a.turtle.role)-['crystal','spike','stone','leaf','bubble'].indexOf(b.turtle.role))[0];if(next)swapRaidPet(r,0,next.id);}
  }if(r.battle.status==='fighting')throw new Error('stalled');finishRaid(s,r);r=s.community.raid;
 }report.raids.push({tier,ownerRoster:process.env.RAID_OWNER_CRYSTALS?'five synthetic crystal turtles':'five different roles',healthMultiplier:RAID_BALANCE[tier].health,won:r.victory,waves:r.wave,seconds:Math.round(r.seconds)});
}
fs.writeFileSync(__dirname+'/../temp/multifront-balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
