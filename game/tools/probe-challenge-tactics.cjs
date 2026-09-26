const fs=require('node:fs');const {save,chapter}=require('./analyze-increment-balance.cjs');
const {startRaid,beginRaidWave,stepRaid,finishRaid,swapRaidPet}=require('../.test-build/core/raids.js');
const setups=[['stone','spike','crystal','leaf','bubble'],['spike','crystal','crystal','leaf','spike'],['stone','crystal','crystal','leaf','spike'],['stone','spike','spike','leaf','crystal']];
const rows=[];for(const roles of setups){const s=save('twelve',8142),original=Object.values(s.collection);s.collection=Object.fromEntries(roles.map((role,i)=>{const t=JSON.parse(JSON.stringify(original.find(t=>t.role===role)));t.id='test-'+i;return [t.id,t];}));rows.push({roles,...chapter(s,49)});}
const raids=[];for(let tier=0;tier<3;tier++){const s=save('twelve',8142);startRaid(s,1788948000000,tier,Object.keys(s.collection));let r=s.community.raid;swapRaidPet(r,0,r.members[0].roster.find(p=>p.turtle.role==='crystal').id);
 while(!r.settled){beginRaidWave(s);r=s.community.raid;
  while(r.battle.status==='fighting'&&r.battle.elapsed<300){stepRaid(r,.5);const mine=r.members[0],u=r.battle.units.find(u=>u.id===mine.activeId);
   if(!u||!u.alive||u.hp/u.maxHp<.3){const replacement=mine.roster.filter(p=>p.id!==mine.activeId&&!r.fallen.includes(p.id)).filter(p=>!r.battle.benchUnits?.some(u=>u.id===p.id&&(!u.alive||u.hp/u.maxHp<.4))).sort((a,b)=>['crystal','spike','stone','leaf','bubble'].indexOf(a.turtle.role)-['crystal','spike','stone','leaf','bubble'].indexOf(b.turtle.role))[0];if(replacement)swapRaidPet(r,0,replacement.id);}
  }if(r.battle.status==='fighting')throw new Error('stalled');finishRaid(s,r);r=s.community.raid;
 }raids.push({tier,won:r.victory,waves:r.wave,seconds:Math.round(r.seconds)});
}
const report={scope:'Synthetic fully built turtles. Chapter team compositions vary; raids use visible manual reserves and rotate below 30% HP.',rows,raids};fs.writeFileSync(__dirname+'/../temp/increment-tactics.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
