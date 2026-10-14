import type {Spawn} from './types';
import type {ExpeditionState,ExpeditionPlayer} from './expeditionRules';

/** Versioned per-player ledger: old in-progress runs retain their original economy. */
export const expeditionRecruitCost=(e:ExpeditionState,p:ExpeditionPlayer)=>e.economyVersion===1?40+10*p.recruited:e.cost;
export const recruitmentSpent=(count:number)=>40*count+5*count*(count-1);
const coastBudget=[100,120,170,210,260,300,340,380,430,470];
export function waveRationBudget(e:ExpeditionState,wave:number):number {
 if(e.kind==='endless'){
  const block=Math.floor((wave-1)/10),from=block*12;
  const total=recruitmentSpent(from+12)-recruitmentSpent(from);
  const weights=Array.from({length:10},(_,i)=>6+i),sum=weights.reduce((a,b)=>a+b,0);
  const parts=weights.map(v=>Math.floor(total*v/sum/10)*10);
  for(let left=total-parts.reduce((a,b)=>a+b,0),i=9;left>0;left-=10,i=(i+9)%10)parts[i]+=10;
  return parts[(wave-1)%10];
 }
 if(e.limit===10)return coastBudget[Math.min(wave-1,9)];
 if(wave<=2)return wave===1?100:120;
 const n=e.limit-2,weights=Array.from({length:n},(_,i)=>.6+.8*i/(n-1)),sum=weights.reduce((a,b)=>a+b,0);
 const parts=weights.map(v=>Math.floor(2560*v/sum/10)*10);
 for(let left=2560-parts.reduce((a,b)=>a+b,0),i=n-1;left>0;left-=10,i=(i+n-1)%n)parts[i]+=10;
 return parts[wave-3];
}
export function waveClearRations(e:ExpeditionState,wave:number):number {
 if(e.economyVersion!==1)return 0;
 if(e.coastTrial)return 30;
 const pool=waveRationBudget(e,wave);return pool-Math.floor(pool*.7)-Math.floor(pool*.2);
}
/** Assign bounty to individual spawns, so leaked enemies never pay a redistributed kill reward. */
export function rationBounties(e:ExpeditionState,wave:number,spawns:Spawn[]):Spawn[]{
 if(e.economyVersion!==1)return spawns;
 if(e.coastTrial)return spawns.map(s=>({...s,rations:s.kind==='boss'?(wave<=2?40:60):s.kind==='elite'?15:5}));
 const pool=waveRationBudget(e,wave),regular=spawns.filter(s=>s.kind!=='boss'),weight=(s:Spawn)=>s.kind==='elite'?3:1,total=regular.reduce((a,s)=>a+weight(s),0);
 let used=0,seen=0;return spawns.map(s=>{
  if(s.kind==='boss')return {...s,rations:Math.floor(pool*.2)};
  const end=Math.floor(Math.floor(pool*.7)*(seen+=weight(s))/total),rations=end-used;used=end;return {...s,rations};
 });
}
