import {paintedLayout,legacyPaintedLayout,ROAD_PLACEMENT_CLEARANCE} from './paintedMaps';
import type {LevelDefinition,Point} from './types';
import {mapBounds,mapTheme,routeClearance} from './mapPresentation';
import {coastPoint} from './approvedCoast';
import {isCoastStage,coastGroundIssue} from './coastStageGeometry';
import {isModeStage,modeGroundIssue} from './modeStageGeometry';
export {hudPlacementIssue} from './hudPlacement';

export const FOOTPRINT=.46;
export interface MapProp extends Point {tile:number;height:number;radius:number}
/** The renderer and placement checks share exactly the same live landmarks. */
export function mapProps(m:LevelDefinition):MapProp[]{
 if(isCoastStage(m)||isModeStage(m))return [];
 if(m.sceneArt){
  // Decoration never becomes a gameplay obstacle. The live route and free
  // placement field remain authoritative for themed maps.
  if((m.stationVersion??0)>=6)return paintedLayout(m.id)!.rocks.map((p,i)=>({...p,tile:i%2?4:3,height:.30}));
  return [];
 }
 if(m.id===0||m.id===56)return [];
 const {rx,rz}=mapBounds(m),theme=mapTheme(m),result:MapProp[]=[];let i=0;
 for(let x=-rx*.75;x<rx*.8;x+=2.15)for(let z=-rz*.72;z<rz*.78;z+=1.85,i++){
  if((i*7+m.id)%5>1)continue;
  const p={x:x+.22*Math.sin(z*3+m.id),z};
  if(routeClearance(m,p)<1.05||m.slots.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<1.2))continue;
  const tile=theme.props[(i+m.id)%theme.props.length];result.push({...p,tile,height:i%6===0?1.35:.95,radius:[0,1,10].includes(tile)?.42:.55});
 }return result;
}
const coastLand=[[110,60],[1470,60],[1610,330],[1600,770],[1280,835],[730,790],[420,650],[220,540],[140,310]].map(([x,y])=>coastPoint(x,y));
const coastRocks=[[405,265,55],[700,160,48],[880,160,45],[1110,430,40],[708,535,39],[1220,750,42],[275,480,40]].map(([x,y,r])=>({...coastPoint(x,y),radius:r/1672*18}));
function inside(p:Point,poly:Point[]):boolean{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;
 }return yes;}
export function groundIssue(m:LevelDefinition,p:Point):string|undefined{
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return '请选择地图上的位置';
 if(isCoastStage(m))return coastGroundIssue(m.id,p);
 if(isModeStage(m))return modeGroundIssue(m.id,p);
 const {rx,rz}=mapBounds(m);
 if(m.sceneArt?(Math.abs(p.x)>8.65||Math.abs(p.z)>4.72):m.id===0?!inside(p,coastLand):Math.pow(Math.abs(p.x)/(rx*.87),4)+Math.pow(Math.abs(p.z)/(rz*.87),4)>1)return '这里是海面或岸边，请放到陆地上';
 if(routeClearance(m,p)<((m.stationVersion??0)>=6?ROAD_PLACEMENT_CLEARANCE:.76))return '请避开怪物通行路线';
 if((m.id===0&&!m.sceneArt?coastRocks:mapProps(m)).some(o=>Math.hypot(o.x-p.x,o.z-p.z)<o.radius+FOOTPRINT))return '这里有岩石或树木，请换个位置';
 const guard=m.id===55&&!m.sceneArt?{x:0,z:0}:m.route[m.route.length-1];
 if(m.id!==56&&Math.hypot(p.x-guard.x,p.z-guard.z)<1.05)return '请给守护珍珠留出空间';
}
export function placementIssue(m:LevelDefinition,p:Point,others:Point[]=[]):string|undefined{
 return groundIssue(m,p)??(others.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<FOOTPRINT*2+.08)?'伙伴之间需要留出一点空间':undefined);
}
export function normalizedPoint(p:Point):Point{return {x:Math.round(p.x*1000)/1000,z:Math.round(p.z*1000)/1000};}
export function fieldIssue(m:LevelDefinition,units:{slot:number;placement?:Point}[]):string|undefined{
 for(const u of units)if(u.placement!==undefined){const issue=placementIssue(m,u.placement,units.filter(o=>o!==u).map(o=>o.placement??m.slots[o.slot]).filter(Boolean));if(issue)return issue;}
}

/** Dropping on a fielded teammate exchanges the two endpoints, not their identities. */
export function exchangePlacementIssue(m:LevelDefinition,p:Point,source:Point|undefined,others:Point[]):string|undefined{
 const target=others.find(o=>Math.hypot(o.x-p.x,o.z-p.z)<.78);
 if(!target)return placementIssue(m,p,others);
 const rest=others.filter(o=>o!==target);
 return placementIssue(m,target,rest)??(source?placementIssue(m,source,[...rest,target]):undefined);
}
