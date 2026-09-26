import {SCENE_GEOMETRY_DATA} from './sceneGeometryData';
import {sceneSlots,sceneGroundIssue,sceneRoadDistance,SCENE_REVISION,scenePoint} from './sceneGeometry';
import type {LevelDefinition,Point} from './types';

/** Approved 23 September mode paintings. One pixel registration is shared by
 * ground rendering, navigation, recommended stations and free placement. */
export const MODE_ART={width:1672,height:941,worldWidth:18,slope:.6,floor:.045};
export const MODE_DEPTH=18*941/1672*Math.sqrt(1+.6*.6);
type Pixel=number[];
export const modePoint=(x:number,y:number):Point=>({x:(x/1672-.5)*18,z:(y/941-.5)*MODE_DEPTH+.027});
export const modePixel=(p:Point)=>({x:(p.x/18+.5)*1672,y:((p.z-.027)/MODE_DEPTH+.5)*941});
export const isModeStage=(m:LevelDefinition):boolean=>m.id>=50&&m.id<=56&&m.sceneArt===`map-mode-scene-${m.id}`;
export const MODE_PATH_PIXELS:Record<number,number[][][]>=Object.fromEntries(SCENE_GEOMETRY_DATA.slice(50).map(g=>[g.id,g.routes.map(r=>r.map(([x,y])=>[x*1672/560,y*941/310]))]));
export function modeRoadDistance(id:number,x:number,y:number):number{let distance=Infinity;for(const route of MODE_PATH_PIXELS[id])for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return distance;}
export function modeGroundIssue(id:number,p:Point):string|undefined{return sceneGroundIssue(id,p);}
export function applyModeStage(m:LevelDefinition):LevelDefinition{
 const paths=MODE_PATH_PIXELS[m.id];if(!paths)return m;
 const routes=paths.map(r=>r.map(([x,y])=>modePoint(x,y))),slots=sceneSlots(m.id);
 return {...m,layoutVersion:2,stationVersion:6,sceneRevision:SCENE_REVISION,sceneArt:`map-mode-scene-${m.id}`,sceneMirror:false,route:routes[0],routes:routes.length>1?routes:undefined,routeLabels:routes.length>1?(m.id===51?['北礁入口','南礁入口']:['外庭长路','内庭近路']):undefined,slots};
}
