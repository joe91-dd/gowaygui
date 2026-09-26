const fs=require('node:fs'),path=require('node:path');
const {makeInitialSave}=require('../.test-build/core/game.js');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const {LEVELS,skillsForRole}=require('../.test-build/core/data.js');
const {initialSkills}=require('../.test-build/core/talents.js');
const {initCommunity}=require('../.test-build/core/community.js');
const {startArena,stepArena}=require('../.test-build/core/arena.js');
const {startRaid,beginRaidWave,stepRaid,finishRaid}=require('../.test-build/core/raids.js');
const NOW=1788948000000;
const builds={stone:['strong','armor','resist','block','share','reflect','hold','regen','lastShield','rebirth','sleep','reach'],spike:['swift','reach','critical','lifesteal','combo','extraTarget','piercingShot','strong','armor','resist','rebirth','regen'],crystal:['swift','reach','bounce','shredResist','spellDrain','extraTarget','crystalCannon','strong','armor','resist','rebirth','regen'],leaf:['swift','reach','strong','doubleHeal','healShield','cleanse','extraTarget','greatHeal','armor','resist','rebirth','regen'],bubble:['swift','reach','root','weaken','shredArmor','extraTarget','bubbleRing','strong','armor','resist','rebirth','regen']};
function save(profile,seed){const s=makeInitialSave(NOW,seed);s.settings.autoSkills=true;initCommunity(s,NOW);for(const t of Object.values(s.collection)){if(profile==='six')t.skills=initialSkills(s,t.role,6);if(profile==='twelve'){t.skills=builds[t.role];t.innate={attack:100,health:100,defense:100,growth:110};}if(t.skills.some(id=>!skillsForRole(t.role).includes(id)))throw new Error('bad fixture');}return s;}
function chapter(s,id){const turtles=Object.values(s.collection),fallen=new Set(),sleep={},level=LEVELS[id];let health=20,seconds=0,waves=0;
 for(let wave=1;wave<=level.waves;wave++){const b=createBattle(id,wave,turtles.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:Math.min(10,wave),fallen:fallen.has(turtle.id),sleepUntilWave:sleep[turtle.id]})),{seed:1000+wave,coreHealth:health,rulesVersion:'0.6',mode:'chapter'});b.autoSkills=true;
  while(b.status==='fighting'&&b.elapsed<300)stepBattle(b,.5);health=b.coreHealth;seconds+=b.elapsed;for(const u of b.units){if(!u.alive)fallen.add(u.id);else fallen.delete(u.id);if(u.sleepUntilWave)sleep[u.id]=u.sleepUntilWave;else delete sleep[u.id];}if(b.status!=='won')return {id:id+1,won:false,waves,seconds:Math.round(seconds),health};waves++;}
 return {id:id+1,won:true,waves,seconds:Math.round(seconds+(waves-1)*level.preparationSeconds),health};}
if(require.main===module){const report={scope:'Deterministic fixed-roster probes; no rerolls, deployment optimization, manual targeting or fusion. Synthetic 12-skill fixtures are not player grants.',chapter:{},arena:[],raids:[]};
for(const profile of ['two','six','twelve']){const s=save(profile,8142);report.chapter[profile]=LEVELS.map(l=>chapter(s,l.id));}
for(const profile of ['two','six','twelve']){const s=save(profile,8142),opponent=s.community.arenaOrder.at(-2),a=startArena(s,NOW,opponent,Object.keys(s.collection));while(a.phase==='combat')stepArena(a,.5);report.arena.push({profile,victory:a.victory,draw:a.draw,passed:a.passed,seconds:a.seconds,aliveA:a.attackers.filter(u=>u.alive).length,aliveD:a.defenders.filter(u=>u.alive).length});}
for(let tier=0;tier<3;tier++){const s=save('twelve',8142);startRaid(s,NOW,tier,Object.keys(s.collection));let r=s.community.raid;while(!r.settled){beginRaidWave(s);r=s.community.raid;while(r.battle.status==='fighting'&&r.battle.elapsed<300)stepRaid(r,.5);if(r.battle.status==='fighting')throw new Error('raid stalled');r=finishRaid(s,r);r=s.community.raid;}report.raids.push({tier,victory:r.victory,waves:r.wave,seconds:r.seconds});}
const out=path.join(__dirname,'../temp/increment-balance.json');fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({file:out,chapter:Object.fromEntries(Object.entries(report.chapter).map(([k,rows])=>[k,{wins:rows.filter(r=>r.won).length,firstFailure:rows.find(r=>!r.won),final:rows.at(-1)}])),arena:report.arena,raids:report.raids},null,2));

}
module.exports={save,chapter,builds};
