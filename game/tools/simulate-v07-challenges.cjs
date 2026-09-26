const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {stepRaid,swapRaidPet,RAIDS}=require('../.test-build/core/raids.js');
const {getBattleEvents}=require('../.test-build/core/battle.js');
const fs=require('node:fs'),path=require('node:path');
const NOW=1788948000000;
const builds={
stone:['strong','armor','resist','regen','openingShield','lastShield','block','reflect','share','hold','rebirth','extraTarget'],
spike:['strong','armor','resist','swift','reach','critical','lifesteal','combo','extraTarget','rebirth','piercingShot','regen'],
crystal:['strong','armor','resist','swift','reach','critical','bounce','spellDrain','shredResist','crystalCannon','extraTarget','rebirth'],
leaf:['strong','armor','resist','swift','reach','regen','doubleHeal','healShield','cleanse','greatHeal','extraTarget','rebirth'],
bubble:['strong','armor','resist','swift','reach','shredArmor','root','weaken','bubbleRing','extraTarget','spellDrain','rebirth']};
const rows=[];
for(const mature of [false,true])for(let tier=0;tier<3;tier++){
  const store=new MemoryStorage(),s=makeInitialSave(NOW,9137);if(mature)for(const t of Object.values(s.collection)){t.skills=builds[t.role];t.innate={attack:100,health:100,defense:100,growth:110};}
  store.setItem(SAVE_KEY,encodeSave(s));const g=new GameService(new SaveRepository(store),{now:()=>NOW});g.enablePrototype('v');g.communityAction('init',{kind:'init'});g.beginRaid('start',tier,['t-2','t-1','t-3','t-4','t-5']);let r=g.snapshot.community.raid,guard=0;
  while(!r.settled&&guard++<20){g.beginRaidWave('wave'+r.wave);r=g.snapshot.community.raid;
    for(let sec=0;sec<600&&r.battle.status==='fighting';sec++){
      const actor=r.battle.units.find(u=>u.id===r.members[0].activeId);
      if(!actor?.alive||actor.hp/actor.maxHp<.2){const alternative=r.members[0].roster.find(p=>p.id!==actor?.id&&!(r.sleep[p.id]>r.wave+1)&&(!r.battle.benchUnits?.find(u=>u.id===p.id)||r.battle.benchUnits.find(u=>u.id===p.id).alive));if(alternative)try{swapRaidPet(r,0,alternative.id);}catch{}}
      stepRaid(r,1);getBattleEvents(r.battle);
    }
    if(r.battle.status==='fighting')throw Error('Raid did not terminate');r=g.finishRaid('finish'+r.wave,r);
  }
  rows.push({mature,tier,waves:r.wave,seconds:r.seconds,coreHealth:r.coreHealth,victory:r.victory,rewards:r.rewards});
}
const target=path.resolve(__dirname,'../../docs/reports/v07-raid-simulation.json');fs.writeFileSync(target,JSON.stringify({configuration:RAIDS,note:'Isolated fixtures: starter vs explicit perfect twelve-skill player roster, four explicit eight-skill local AI teammates; player opens with shooter. Not a browser playthrough.',rows},null,2));console.log(JSON.stringify(rows,null,2));
