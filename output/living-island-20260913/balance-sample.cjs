const fs=require('node:fs');
const {makeInitialSave}=require('../../game/.test-build/core/game.js');
const {createBattle,stepBattle}=require('../../game/.test-build/core/battle.js');
const {SKILL_BY_ID}=require('../../game/.test-build/core/data.js');
const owned=Object.values(makeInitialSave(1788948000000,27).collection),pets=['stone','spike','crystal','leaf','bubble'].map(role=>owned.find(t=>t.role===role));
const builds={spread:['combo','scatter','extraTarget','critical','armor'],control:['root','pursuit','swift','armor','regen'],sustain:['armor','resist','reflect','regen','strong']};
const rows=[];
for(const id of [0,1,5,15,25,40,49])for(const [name,skills] of Object.entries(builds)){
 const inputs=pets.map((t,i)=>({id:t.id,slot:i,level:id===0?1:Math.min(10,2+Math.floor(id/5)),turtle:{...t,skills:Array.from(new Set(t.skills.filter(s=>SKILL_BY_ID[s].active).concat((t.role==='stone'?['armor','taunt','reflect','block','regen']:t.role==='leaf'?['doubleHeal','healShield','encourage','cleanse','swift']:skills).filter(s=>SKILL_BY_ID[s]))))}}));
 const b=createBattle(id,5,inputs,{rulesVersion:'0.6',mode:'chapter',waveLimit:5,seed:27});b.autoSkills=true;
 while(b.status==='fighting'&&b.elapsed<160)stepBattle(b,.25);
 rows.push({stage:id+1,build:name,level:inputs[0].level,result:b.status,seconds:Math.round(b.elapsed),core:b.coreHealth,kills:b.kills,leaks:b.leaked,survivors:b.units.filter(u=>u.alive).length});
}
fs.writeFileSync(__dirname+'/balance-sample.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
