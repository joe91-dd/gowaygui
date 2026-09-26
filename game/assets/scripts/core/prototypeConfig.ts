import {policyBook} from './bookPolicy';
import type {EnemyKind, RewardGrant, Role, SkillId, Spawn, Turtle} from './types';
import {BATTLE_MAPS, SKILLS} from './data';
import {random,sample} from './random';
import type {RandomState} from './random';
import {tacticalSpawns} from './waveTactics';
import {RELEASE_BALANCE} from './releaseBalance';

/** V0.6 Gameplay Prototype initial values, not a claim of final balance. */
export const PROTOTYPE = {
  version:'0.6' as const, capacity:50, benchSize:5, lockFusionResult:true, outsideFusionRule:'keep-one' as const,
  endless:{map:50,unlockAfter:1,waveGold:4,rewardEvery:5,stageEvery:10,
    countStart:7,countEvery:2,countCap:24,spawnSeconds:22,healthStart:.85,healthGrowth:1.07,linearAfter:60},
  chapter:{startCounts:[6,11,12,13,14],additionalPerWave:.8},
  quality:{weights:{count:45,build:15,aptitude:20,growth:20},thresholds:[0,25,42,58,76]},
};
export const QUALITY_NAMES=['良好','优秀','珍稀','卓越','史诗','传说','完美'] as const;
export const QUALITY_COLORS=['#39A873','#318ED3','#9464CC','#D6BE35','#E68B35','#D95252','#C99C38'];
// Distinct book weights: ordinary packs exclude active skills; fine packs favor
// role builds and add rare active books. Random choice nodes use the full pool.
export const BOOK_WEIGHTS:Record<SkillId,{normal:number;ordinary:number;fine:number;quality:number}>={
  calm:{normal:1,ordinary:0,fine:2,quality:1},
  stoneMastery:{normal:1,ordinary:0,fine:2,quality:1},spikeMastery:{normal:1,ordinary:0,fine:2,quality:1},crystalMastery:{normal:1,ordinary:0,fine:2,quality:1},leafMastery:{normal:1,ordinary:0,fine:2,quality:1},
  fervor:{normal:1,ordinary:0,fine:2,quality:1},caprice:{normal:1,ordinary:0,fine:2,quality:.8},polymorph:{normal:1,ordinary:0,fine:2,quality:1},giant:{normal:1,ordinary:0,fine:2,quality:1},
  scatter:{normal:1,ordinary:0,fine:2,quality:1},daze:{normal:1,ordinary:0,fine:2,quality:.8},
  arcane:{normal:1,ordinary:0,fine:2,quality:1},holyLight:{normal:1,ordinary:0,fine:2,quality:.95},
  spirit:{normal:1,ordinary:0,fine:2,quality:1},counterStorm:{normal:1,ordinary:0,fine:2,quality:1},
  pursuit:{normal:4,ordinary:3,fine:4,quality:.8},
  taunt:{normal:4,ordinary:5,fine:3,quality:.65},
  rebirth:{normal:2,ordinary:1,fine:4,quality:.85},sleep:{normal:3,ordinary:2,fine:3,quality:.65},extraTarget:{normal:2,ordinary:1,fine:4,quality:.9},
  strong:{normal:12,ordinary:12,fine:2,quality:.45},armor:{normal:12,ordinary:12,fine:2,quality:.45},
  resist:{normal:12,ordinary:12,fine:2,quality:.45},swift:{normal:7,ordinary:7,fine:3,quality:.75},
  reach:{normal:10,ordinary:10,fine:2,quality:.5},steady:{normal:12,ordinary:12,fine:1,quality:.3},
  regen:{normal:8,ordinary:8,fine:2,quality:.5},openingShield:{normal:9,ordinary:9,fine:2,quality:.5},
  lastShield:{normal:7,ordinary:7,fine:2,quality:.6},encourage:{normal:5,ordinary:5,fine:3,quality:.75},
  block:{normal:7,ordinary:7,fine:3,quality:.6},reflect:{normal:6,ordinary:6,fine:3,quality:.65},
  share:{normal:4,ordinary:4,fine:4,quality:.8},hold:{normal:1,ordinary:0,fine:2,quality:.9},
  critical:{normal:7,ordinary:7,fine:3,quality:.6},lifesteal:{normal:5,ordinary:5,fine:3,quality:.65},
  combo:{normal:3,ordinary:3,fine:4,quality:.85},piercingShot:{normal:1,ordinary:0,fine:2,quality:.9},
  bounce:{normal:6,ordinary:6,fine:3,quality:.65},spellDrain:{normal:6,ordinary:6,fine:3,quality:.6},
  shredResist:{normal:4,ordinary:4,fine:4,quality:.8},crystalCannon:{normal:1,ordinary:0,fine:2,quality:.9},
  doubleHeal:{normal:6,ordinary:6,fine:3,quality:.7},healShield:{normal:3,ordinary:3,fine:4,quality:.85},
  cleanse:{normal:4,ordinary:4,fine:4,quality:.8},greatHeal:{normal:1,ordinary:0,fine:2,quality:.9},
  shredArmor:{normal:6,ordinary:6,fine:3,quality:.7},root:{normal:4,ordinary:4,fine:4,quality:.8},
  weaken:{normal:5,ordinary:5,fine:3,quality:.7},bubbleRing:{normal:1,ordinary:0,fine:2,quality:.9},
};
export const QUALITY_PAIRS:Partial<Record<Role,[SkillId,SkillId][]>>={
  stone:[['armor','block'],['strong','share'],['reflect','hold']],spike:[['swift','combo'],['critical','lifesteal']],
  crystal:[['bounce','shredResist'],['crystalCannon','shredResist']],leaf:[['doubleHeal','healShield'],['swift','doubleHeal']],
  bubble:[['swift','root'],['shredArmor','weaken']],
};
const bounded=(n:number)=>Math.max(0,Math.min(1,n));
export function turtleQuality(t:Turtle):{score:number;tier:number;name:string;color:string}{
  const weights=PROTOTYPE.quality.weights,skills=t.skills;
  const individual=skills.reduce((sum,id)=>sum+BOOK_WEIGHTS[id].quality,0)/Math.max(1,skills.length);
  const pairs=(QUALITY_PAIRS[t.role]??[]).filter(pair=>pair.every(id=>skills.includes(id))).length;
  const aptitude=(['attack','health','defense'] as const).reduce((sum,key)=>sum+bounded((t.innate[key]+t.training[key]-60)/40),0)/3;
  const score=Math.round(100*(weights.count*skills.length/12+weights.build*bounded(individual+pairs*.1)
    +weights.aptitude*aptitude+weights.growth*bounded((t.innate.growth+t.training.growth-70)/40)))/100;
  const tier=Math.max(0,Math.min(6,skills.length-6));
  return {score,tier,name:QUALITY_NAMES[tier],color:QUALITY_COLORS[tier]};
}
export function drawBook(s:RandomState,pool:'normal'|'ordinary'|'fine'='normal'):SkillId{
  return policyBook(s,pool==='fine'?'elite':'activity');
}
export const REWARD_WEIGHTS={gold:50,attack:12,health:12,defense:12,growth:8,book:6};
export function drawReward(s:RandomState,wave:number):RewardGrant{
  let roll=random(s)*100;
  for(const [kind,weight] of Object.entries(REWARD_WEIGHTS)){
    roll-=weight;if(roll>=0)continue;
    if(kind==='gold')return {kind:'gold',amount:15+Math.min(15,Math.floor(wave/10)*5)};
    if(kind==='book')return {kind:'book',skillId:drawBook(s),amount:1};
    return {kind:'material',material:kind as 'attack'|'health'|'defense'|'growth',amount:1};
  }
  throw new Error('奖励权重配置不完整');
}
export const EXTRA_DRAW_COSTS=[0,20,35,55,80] as const;
export function rewardBoard(s:RandomState,wave:number,balanced=false):RewardGrant[]{
  const scale=Math.min(50,Math.floor(wave/10)*5);
  const foods=sample(s,['attack','health','defense','growth'] as const,2);
  const resources:RewardGrant[]=foods.map(material=>({kind:'material' as const,material,amount:1}));
  if(balanced&&random(s)<.65)resources[1]={kind:'book',skillId:drawBook(s,'ordinary'),amount:1,pack:'ordinary'};
  return [{kind:'gold',amount:15+scale},{kind:'gold',amount:40+scale},...resources,{kind:'book',skillId:drawBook(s),amount:1}];
}
export const STAGE_REWARDS=[
  {wave:10,gold:35,aptitude:1,growth:0,pack:undefined},
  {wave:20,gold:35,aptitude:0,growth:1,pack:'ordinary' as const},
  {wave:30,gold:50,aptitude:1,growth:1,pack:'fine' as const},
];
export const CURRENT_STAGE_REWARDS=[
  {wave:10,gold:35,aptitude:0,growth:0,pack:'ordinary' as const},
  {wave:20,gold:35,aptitude:0,growth:1,pack:'ordinary' as const},
  {wave:30,gold:50,aptitude:1,growth:0,pack:'fine' as const},
];
export function stageRewards(s:RandomState,wave:number,balanced=false):RewardGrant[]{
  if(wave%PROTOTYPE.endless.stageEvery!==0)return [];
  const rows=balanced?CURRENT_STAGE_REWARDS:STAGE_REWARDS,row=rows[(wave/10-1)%rows.length],cycle=Math.floor((wave-1)/30);
  const grants:RewardGrant[]=[{kind:'gold',amount:row.gold+Math.min(50,cycle*10)}];
  if(row.aptitude)grants.push({kind:'material',material:(['attack','health','defense'] as const)[Math.floor(random(s)*3)],amount:row.aptitude});
  if(row.growth)grants.push({kind:'material',material:'growth',amount:row.growth});
  if(row.pack)grants.push({kind:'book',skillId:drawBook(s,row.pack),amount:1,pack:row.pack});
  return grants;
}
export function prototypeSpawns(levelId:number,wave:number,endless=false,waveLimit?:number):Spawn[]{
  const level=BATTLE_MAPS[levelId];if(!level||!Number.isSafeInteger(wave)||wave<1||!endless&&wave>level.waves)throw new Error('无效波次');
  if(!endless&&levelId<50&&waveLimit===5){
    const c=RELEASE_BALANCE.chapter,tutorial=levelId===0,duration=tutorial?31+wave*2:c.spawnSecondsBase+wave*c.spawnSecondsPerWave;
    const count=tutorial?14+wave*3:16+Math.floor(levelId/10)+wave*3;
    const scale=tutorial?level.difficulty*Math.pow(1.10,wave-1)*1.8:(c.healthBase+levelId*c.healthPerLevel)*Math.pow(c.healthWaveGrowth,wave-1);
    const regular:Spawn[]=Array.from({length:count},(_,i)=>({kind:'ink',time:i*duration/(count-1),hpScale:scale,attackScale:Math.sqrt(scale)*(tutorial?1.3:.95)}));
    regular.push({kind:'boss',time:tutorial?duration:duration-7,hpScale:scale*(wave===5?(tutorial?.36:.44):(tutorial?.20:.24)),attackScale:tutorial?Math.sqrt(scale)*(wave===5?1.05:.7):(.28+levelId*.0055)*(wave===5?1.3:1)});
    return tacticalSpawns(regular,levelId,wave);
  }
  const c=PROTOTYPE.endless,phase=(wave-1)%10+1;
  let count=endless?Math.min(c.countCap,c.countStart+Math.floor((wave-1)/c.countEvery)):(PROTOTYPE.chapter.startCounts[levelId]??Math.min(16,12+Math.floor(levelId/12)))+Math.floor((wave-1)*PROTOTYPE.chapter.additionalPerWave);
  const duration=endless?c.spawnSeconds:level.spawnDuration;
  const pool:EnemyKind[]=levelId===0&&!endless&&wave===1?['ink','ink','runner']:
    phase<=4?['ink','runner','armored','ink']:phase<=7?['ink','mist','runner','mist']:['runner','snail','armored','mist'];
  if(!endless&&levelId>=1&&wave>=3)pool.push('snail');
  const scale=endless?c.healthStart*Math.pow(c.healthGrowth,Math.min(wave,c.linearAfter)-1)*(wave>c.linearAfter?1+.07*(wave-c.linearAfter):1):level.difficulty*Math.pow(1.07,wave-1);
  const boss=endless?wave%10===0:(levelId+1)%5===0&&wave===(waveLimit??level.waves);
  if(boss&&endless)count=Math.ceil(count/2);
  const spawns:Spawn[]=Array.from({length:count},(_,i)=>({kind:pool[(i+wave)%pool.length],time:i*duration/Math.max(1,count-1),hpScale:scale,attackScale:Math.sqrt(scale)*(levelId===0&&!endless?1.05:1.2)}));
  if(wave%5===0&&!boss)spawns.push({kind:'elite',time:duration*.6,hpScale:scale*.7,attackScale:Math.sqrt(scale)*(levelId===0&&!endless?1.05:1.2)});
  if(boss)spawns.push({kind:'boss',time:duration,hpScale:endless?scale:levelId===4?1:scale*.45,attackScale:endless?Math.sqrt(scale):Math.sqrt(scale)*1.2});
  return !endless&&levelId<50?tacticalSpawns(spawns,levelId,wave):spawns;
}


