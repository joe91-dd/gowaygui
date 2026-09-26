import type {Material,Role,SkillId,Traits,Turtle} from './types';
import {SKILLS} from './data';
import {random,weighted} from './random';
import type {RandomState} from './random';

export const TALENT_NAMES:Record<Material,string>={attack:'攻击天赋',health:'生命天赋',defense:'防御天赋',growth:'成长天赋'};
export const TALENT_KEYS:Material[]=['attack','health','defense','growth'];
export const TALENT_CAPS:Traits={attack:100,health:100,defense:100,growth:110};
export const ROLE_FOCUS:Record<Role,Material>={stone:'defense',spike:'attack',crystal:'attack',leaf:'health',bubble:'health'};
export const panelTalent=(t:Turtle,key:Material):number=>t.innate[key]+t.training[key];
export function initialTalents(s:RandomState,role:Role):Traits{
  const result={} as Traits;
  for(const key of TALENT_KEYS){
    const roll=random(s);
    if(key==='growth')result[key]=70+Math.floor(roll*41);
    else if(key===ROLE_FOCUS[role])result[key]=roll<.06?100:75+Math.floor(random(s)*25);
    else result[key]=60+Math.floor(random(s)*35);
  }
  return result;
}
/** Role preference affects birth only; all passive books/inheritance stay universal. */
export function initialSkills(s:RandomState,role:Role,count:number):SkillId[]{
  const pool=SKILLS.filter(x=>(!x.role||x.role===role)&&((s as RandomState&{rulesVersion?:string}).rulesVersion==='0.6'||!['fervor','caprice','polymorph','giant'].includes(x.id)));
  const picked:SkillId[]=[];
  while(picked.length<count&&picked.length<pool.length){
    const options=pool.filter(x=>!picked.includes(x.id)&&(!x.requires||picked.includes(x.requires))).map(x=>({value:x.id,probability:x.specialization?.15:x.precious?.15:x.role===role?5:!x.role?2:1}));
    const sum=options.reduce((n,x)=>n+x.probability,0);
    picked.push(weighted(s,options.map(x=>({...x,probability:x.probability/sum}))));
  }
  return picked;
}
const aptitudeDelta=[{value:-8,probability:.03},{value:-5,probability:.10},{value:-2,probability:.20},{value:0,probability:.34},{value:2,probability:.20},{value:5,probability:.10},{value:8,probability:.03}];
const growthDelta=[{value:-3,probability:.05},{value:-2,probability:.15},{value:-1,probability:.20},{value:0,probability:.20},{value:1,probability:.20},{value:2,probability:.15},{value:3,probability:.05}];
export function talentDistribution(a:Turtle,b:Turtle,key:Material):{value:number;probability:number}[]{
  const av=panelTalent(a,key),bv=panelTalent(b,key),weights=new Map<number,number>();
  const cap=TALENT_CAPS[key],fullParents=Number(av>=cap)+Number(bv>=cap);
  const fullChance=fullParents===2?.26:fullParents===1?.18:Math.max(av,bv)>=cap-6?.015:0;
  const bases=[{value:Math.max(av,bv),probability:.25},{value:Math.min(av,bv),probability:.15},{value:Math.round((av+bv)/2),probability:.60}];
  for(const base of bases)for(const delta of key==='growth'?growthDelta:aptitudeDelta){
    const value=Math.max(key==='growth'?70:60,Math.min(cap-1,base.value+delta.value));
    weights.set(value,(weights.get(value)??0)+base.probability*delta.probability*(1-fullChance));
  }
  if(fullChance>0)weights.set(cap,fullChance);
  return Array.from(weights,([value,probability])=>({value,probability})).sort((a,b)=>a.value-b.value);
}
export function inheritTalents(s:RandomState,a:Turtle,b:Turtle):Traits{
  return Object.fromEntries(TALENT_KEYS.map(key=>[key,weighted(s,talentDistribution(a,b,key))])) as unknown as Traits;
}
