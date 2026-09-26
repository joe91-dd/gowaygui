import type {Point} from './types';
import {SCENE_GEOMETRY_DATA} from './sceneGeometryData';
export const SCENE_REVISION=2026092301;
export const SCENE_FOOTPRINT=.46;
export const SCENE_FLOOR=.045;
const FOOT=SCENE_FOOTPRINT*560/18;
export function sceneDepth(id:number):number{return 18*(id<50?932/1688:941/1672)*Math.sqrt(1+.6*.6);}
export function scenePoint(id:number,x:number,y:number):Point{return {x:(x/560-.5)*18,z:(y/310-.5)*sceneDepth(id)+SCENE_FLOOR*.6};}
export function scenePixel(id:number,p:Point):Point{return {x:(p.x/18+.5)*560,z:((p.z-SCENE_FLOOR*.6)/sceneDepth(id)+.5)*310};}
function segment(x:number,y:number,a:number[],b:number[]):number{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function inside(x:number,y:number,poly:number[][]):boolean{let ok=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])ok=!ok;}return ok;}
export function sceneRoadDistance(id:number,p:Point):number{const q=scenePixel(id,p);let d=Infinity;for(const r of SCENE_GEOMETRY_DATA[id].routes)for(let i=1;i<r.length;i++)d=Math.min(d,segment(q.x,q.z,r[i-1],r[i]));return d;}
export function sceneGroundIssue(id:number,p:Point):string|undefined{
 const g=SCENE_GEOMETRY_DATA[id];if(!g||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return '请选择地图上的位置';
 const {x,z:y}=scenePixel(id,p);
 if(!inside(x,y,g.land)||g.land.some((a,i)=>segment(x,y,a,g.land[(i+1)%g.land.length])<FOOT))return '请放到能完整站下伙伴的陆地上';
 if(sceneRoadDistance(id,p)<g.roadHalfWidth+FOOT)return '请避开怪物通行路线';
 if(g.obstacles.some(([a,b,rx,ry])=>((x-a)/(rx+FOOT))**2+((y-b)/(ry+FOOT))**2<1))return '这里有岩石、树木或建筑，请换到旁边空地';
 const end=g.routes[0][g.routes[0].length-1];if(id!==55&&Math.hypot(x-end[0],y-end[1])<31)return '请给守护珍珠留出空间';
}
export const sceneRoutes=(id:number):Point[][]=>SCENE_GEOMETRY_DATA[id].routes.map(r=>r.map(([x,y])=>scenePoint(id,x,y)));
export const sceneSlots=(id:number):Point[]=>SCENE_GEOMETRY_DATA[id].slots.map(([x,y])=>scenePoint(id,x,y));
export function safeScenePoint(id:number,target:Point,occupied:Point[]=[]):Point{
 const valid=(p:Point)=>!sceneGroundIssue(id,p)&&occupied.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>=SCENE_FOOTPRINT*2+.08);
 if(valid(target))return {...target};
 const options=sceneSlots(id).filter(valid).sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));
 if(!options.length)throw Error('当前战场没有足够的合法站位');return {...options[0]};
}
