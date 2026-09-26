import {editablePet} from './petAccess';
import type {Aptitude,GameSave,Material,Turtle} from './types';
import {ROLES} from './data';
import {goldAmount} from './economy';
import {RELEASE_BALANCE} from './releaseBalance';

export const PET_LEVEL_CAP=50;
/** New ranges apply to migrated pets; historical battle snapshots keep their own values. */
export const petRange=(t:Turtle)=>t.development?(t.role==='stone'?2.8:ROLES[t.role].range):ROLES[t.role].range;
export const levelCost=(level:number)=>60+12*level+2*level*level;
export function levelInfo(t:Turtle):{level:number;current:number;needed:number;available:number}{
 let xp=t.development?.xp??0,level=1;
 while(level<PET_LEVEL_CAP&&xp>=levelCost(level)){xp-=levelCost(level);level++;}
 const used=Object.values(t.development?.points??{}).reduce((n,v)=>n+v,0);
 return {level,current:level===PET_LEVEL_CAP?0:xp,needed:level===PET_LEVEL_CAP?0:levelCost(level),available:(level-1)*3-used};
}
export const maxPetXp=()=>Array.from({length:49},(_,i)=>levelCost(i+1)).reduce((a,b)=>a+b,0);
export function initDevelopment(t:Turtle):void{t.development??={version:1,xp:0,points:{attack:0,health:0,defense:0}};}
export function grantExperience(s:GameSave,ids:string[],amount:number):void{
 if(!s.livingVersion)return;if(!Number.isSafeInteger(amount)||amount<0)throw Error('经验数量无效');
 for(const id of new Set(ids)){const t=s.collection[id];if(!t)continue;initDevelopment(t);t.development!.xp=Math.min(maxPetXp(),t.development!.xp+amount);}
}
export function developmentBonus(t:Turtle):{attack:number;health:number;armor:number;resist:number}{
 if(!t.development)return {attack:1,health:1,armor:0,resist:0};
 const {level}=levelInfo(t),p=t.development.points,g=(t.innate.growth+t.training.growth)/100;
 const talent=(k:Aptitude)=>(t.innate[k]+t.training[k])/100;
 return {attack:1+(level-1)*.005+p.attack*.01*(.75+.25*talent('attack'))*g,health:1+(level-1)*.004+p.health*.009*(.75+.25*talent('health'))*g,armor:p.defense*.4*(.75+.25*talent('defense'))*g,resist:p.defense*.32*(.75+.25*talent('defense'))*g};
}
export function petPanel(t:Turtle):{attack:number;health:number;defense:number;resist:number}{
 const r=ROLES[t.role],b=developmentBonus(t),apt=(k:Aptitude)=>.8+.2*(t.innate[k]+t.training[k])/100;
 return {attack:Math.round(r.attack*apt('attack')*b.attack),health:Math.round(r.health*apt('health')*b.health*(t.skills.includes('strong')?1.12:1)),defense:Math.round(r.armor*apt('defense')+b.armor+(t.skills.includes('armor')?15:0)),resist:Math.round(r.resist*apt('defense')+b.resist+(t.skills.includes('resist')?15:0))};
}
export function allocatePoints(s:GameSave,id:string,add:Record<Aptitude,number>):void{
 const t=editablePet(s,id);if(!t)throw Error('伙伴不存在、租借到期或正在参战');initDevelopment(t);
 const keys:Aptitude[]=['attack','health','defense'];if(!add||Object.keys(add).length!==3||keys.some(k=>!Number.isSafeInteger(add[k])||add[k]<0))throw Error('加点方案无效');
 const sum=keys.reduce((n,k)=>n+add[k],0);if(sum<1||sum>levelInfo(t).available)throw Error('可分配属性点不足');
 keys.forEach(k=>t.development!.points[k]+=add[k]);
}
export const resetPointCost=(s:GameSave,t:Turtle)=>goldAmount(s,20+levelInfo(t).level*2);
export function resetPoints(s:GameSave,id:string):void{
 const t=editablePet(s,id);if(!t?.development||!Object.values(t.development.points).some(n=>n>0))throw Error('这只伙伴还没有分配属性点');
 const cost=resetPointCost(s,t);if(s.gold<cost)throw Error('金币不足');s.gold-=cost;t.development.points={attack:0,health:0,defense:0};
}
/** A training item advances one of the fifty visible star ticks. */
export const talentTicks=(t:Turtle,key:Material)=>Math.max(0,Math.min(50,t.innate[key]+t.training[key]-(key==='growth'?60:50)));
export function trainingCost(s:GameSave,t:Turtle,key:Material):number{const c=RELEASE_BALANCE.training,star=Math.floor(talentTicks(t,key)/10);return goldAmount(s,s.livingVersion?(key==='growth'?c.growthBase+c.growthPerStar*star:c.aptitudeBase+c.aptitudePerStar*star):key==='growth'?300:100);}
export function validateDevelopment(t:Turtle):void{
 const d=t.development;if(!d)return;
 if(d.version!==1||!Number.isSafeInteger(d.xp)||d.xp<0||d.xp>maxPetXp()||!d.points||Object.keys(d.points).length!==3||(['attack','health','defense'] as const).some(k=>!Number.isSafeInteger(d.points[k])||d.points[k]<0)||levelInfo(t).available<0)throw Error('伙伴经验或加点资料损坏');
}
