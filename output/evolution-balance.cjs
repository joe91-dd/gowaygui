const {makeInitialSave}=require('../game/.test-build/core/game.js');
const {createBattle,stepBattle,getBattleEvents}=require('../game/.test-build/core/battle.js');
const {startRaid,raidBattle}=require('../game/.test-build/core/raids.js');
const packs={stone:['hold','armor','resist','block','regen','reflect','taunt','counterStorm'],spike:['piercingShot','scatter','extraTarget','combo','critical','swift','reach','lifesteal'],crystal:['crystalCannon','arcane','extraTarget','swift','spellDrain','bounce','root','strong'],leaf:['greatHeal','doubleHeal','healShield','encourage','cleanse','holyLight','regen','armor'],bubble:['bubbleRing','spirit','swift','resist','strong','regen','lastShield','encourage']};
for(const count of [4,8]){
 const s=makeInitialSave(Date.now(),42);const inputs=Object.values(s.collection).slice(0,5).map((t,i)=>{t.skills=packs[t.role].slice(0,count);t.innate={attack:100,health:100,defense:100,growth:110};return{id:t.id,turtle:t,slot:({stone:0,spike:2,crystal:1,leaf:4,bubble:3})[t.role],level:10};});
 const r=startRaid(s,Date.now(),3,inputs.map(x=>x.id));const plan=raidBattle(r).spawns;
 const b=createBattle(55,1,inputs,{rulesVersion:'0.6',mode:'endless'});b.spawns=plan;b.autoSkills=true;
 while(b.status==='fighting'){stepBattle(b,5);getBattleEvents(b);}
 console.log(JSON.stringify({skills:count,status:b.status,seconds:b.elapsed,remaining:b.enemies.filter(e=>e.alive).length,kills:b.kills,alive:b.units.filter(u=>u.alive).length}));
}
