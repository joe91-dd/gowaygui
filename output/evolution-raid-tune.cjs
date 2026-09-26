const {makeInitialSave}=require('../game/.test-build/core/game.js');
const {getBattleEvents}=require('../game/.test-build/core/battle.js');
const {startRaid,beginRaidWave,stepRaid}=require('../game/.test-build/core/raids.js');
const packs={stone:['hold','armor','resist','block','regen','reflect','taunt','counterStorm'],spike:['piercingShot','scatter','extraTarget','combo','critical','swift','reach','lifesteal'],crystal:['crystalCannon','arcane','extraTarget','swift','spellDrain','bounce','root','strong'],leaf:['greatHeal','doubleHeal','healShield','encourage','cleanse','holyLight','regen','armor'],bubble:['bubbleRing','spirit','swift','resist','strong','regen','lastShield','encourage']};
for(const tuning of [.12,.2,.35])for(const count of [4,8]){
 const s=makeInitialSave(Date.now(),42),pets=Object.values(s.collection).slice(0,5);for(const t of pets){t.skills=packs[t.role].slice(0,count);t.innate={attack:100,health:100,defense:100,growth:110};}
 startRaid(s,Date.now(),3,pets.map(x=>x.id));const r=s.community.raid; // one active turtle per member, with real AI relocation and reserves
 for(const m of r.members)for(const p of m.roster){p.turtle.skills=packs[p.turtle.role].slice(0,count);}
 beginRaidWave(s);r.battle.autoSkills=true;r.battle.controlledUnitIds=undefined;
 r.battle.spawns=r.battle.spawns.filter((p,i)=>i<240).map(p=>({...p,time:p.time/.82,hpScale:p.hpScale*tuning,attackScale:p.attackScale*.20}));
 while(r.battle.status==='fighting'){stepRaid(r,5);getBattleEvents(r.battle);}
 console.log(JSON.stringify({tuning,skills:count,status:r.battle.status,remaining:r.battle.enemies.filter(e=>e.alive).length,kills:r.battle.kills,alive:r.battle.units.filter(u=>u.alive).length}));
}
