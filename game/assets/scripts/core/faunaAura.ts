import {enemyG1Grade} from './enemyG1Catalog';
export const FAUNA_AURAS = [
 {name:'碧焰',color:'#4DACEB',highlight:'#DDFBFF'},
 {name:'紫潮',color:'#AC77DD',highlight:'#F1DEFF'},
 {name:'橙焰',color:'#E79A48',highlight:'#FFF0CA'},
 {name:'赤潮',color:'#DE6456',highlight:'#FFE9DD'},
 {name:'鎏金',color:'#EAC254',highlight:'#FFF5D6'},
] as const;
export function faunaAuraGrade(kind:string,level=0,bossTier?:number,world=false,wave=1):number{
 if(world)return 4;
 if(bossTier!==undefined)return Math.max(0,Math.min(4,Math.floor(bossTier)));
 return kind==='elite'?enemyG1Grade(level,wave):0;
}
