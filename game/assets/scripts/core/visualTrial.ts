import {makeInitialSave} from './game';
import {enablePrototype} from './prototype';
import {enableLiving} from './living';
import {createBattle} from './battle';
import type {Point,Role} from './types';

/** An isolated art acceptance battle. Never reads or writes an account/save repository. */
function roundedRoad(points:Point[]):Point[]{
 const out:Point[]=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const p=points[i],before=points[i-1],after=points[i+1],a=Math.hypot(p.x-before.x,p.z-before.z),b=Math.hypot(after.x-p.x,after.z-p.z),r=Math.min(.65,a*.35,b*.35);
  const start={x:p.x+(before.x-p.x)*r/a,z:p.z+(before.z-p.z)*r/a},end={x:p.x+(after.x-p.x)*r/b,z:p.z+(after.z-p.z)*r/b};
  for(let j=0;j<=6;j++){const t=j/6,q=1-t;out.push({x:q*q*start.x+2*q*t*p.x+t*t*end.x,z:q*q*start.z+2*q*t*p.z+t*t*end.z});}
 }
 out.push(points[points.length-1]);return out;
}
export const REVIEW_ROUTE:Point[]=roundedRoad([{x:-7.2,z:0},{x:-4.3,z:0},{x:-2.8,z:-1.8},{x:2.8,z:-1.8},{x:4.4,z:0},{x:7.0,z:0}]);
export const REVIEW_OBSTACLES=[{x:-6,z:2.9,r:.65},{x:-6.7,z:-2.5,r:.65},{x:5.7,z:2.8,r:.65},{x:5.9,z:-2.7,r:.6},{x:-4.5,z:-3.3,r:.6},{x:4.4,z:3.2,r:.65}];
export function reviewRoadDistance(p:Point):number{return Math.min(...REVIEW_ROUTE.slice(1).map((b,i)=>{const a=REVIEW_ROUTE[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}));}
export function reviewPlacement(p:Point,others:Point[]):string|undefined{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return '落点无效';
 if((p.x/8.1)**2+(p.z/4.0)**2>1)return '请放在岛内草地';
 if(reviewRoadDistance(p)<.82)return '怪物道路不可放置';
 if(p.x>5.8&&Math.abs(p.z)<1.7)return '守护灯塔附近不可放置';
 if(REVIEW_OBSTACLES.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<o.r+.4))return '树木与礁石附近不可放置';
 if(others.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<1.1))return '伙伴站位重叠';
 return undefined;
}
export function createVisualTrial(){
 const save=makeInitialSave(1789444800000,731);enablePrototype(save);enableLiving(save);
 const pets=(['stone','crystal'] as Role[]).map(role=>{const p=Object.values(save.collection).find(p=>p.role===role)!;return {...p,skills:role==='stone'?['hold','stoneMastery','strong','armor'] as typeof p.skills:['crystalCannon','crystalMastery','strong','swift'] as typeof p.skills};});
 const b=createBattle(0,1,pets.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1})),{rulesVersion:'0.6',seed:918});
 b.route=REVIEW_ROUTE.map(p=>({...p}));b.routeLength=REVIEW_ROUTE.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-REVIEW_ROUTE[i].x,p.z-REVIEW_ROUTE[i].z),0);b.routes=undefined;b.routeLengths=undefined;
 b.units.forEach((u,i)=>{u.x=i?1.1:-2.3;u.z=i?.7:-.8;u.placement={x:u.x,z:u.z};u.maxHp*=3;u.hp=u.maxHp;u.attack*=2.0;});
 b.spawns=Array.from({length:24},(_,i)=>({kind:'armored' as const,time:i*2.4,hpScale:1.25,attackScale:.55}));b.autoSkills=false;
 return b;
}
