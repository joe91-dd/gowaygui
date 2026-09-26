import {SCENE_GEOMETRY_DATA} from './sceneGeometryData';
import {sceneSlots,sceneGroundIssue,SCENE_REVISION} from './sceneGeometry';
import type {LevelDefinition,Point} from './types';
import {CORAL_SUBTITLES} from './coralStageGeometry';
import {BAMBOO_SUBTITLES} from './bambooStageGeometry';
import {CHAPTER_SUBTITLES} from './chapterStageGeometry';

/** Pixel registration for all fifty 1688 x 932 campaign paintings.
 * Camera (0,20,12): compensate its ground-plane foreshortening exactly once.
 * Rendering, navigation and free placement all use this transform. */
export const COAST_ART={width:1688,height:932,worldWidth:18,cameraSlope:12/20,floor:.045};
export const COAST_DEPTH=18*932/1688*Math.sqrt(1+COAST_ART.cameraSlope**2);
export function coastPoint(x:number,y:number):Point{return {x:(x/1688-.5)*18,z:(y/932-.5)*COAST_DEPTH+COAST_ART.floor*COAST_ART.cameraSlope};}
export function coastPixel(p:Point):{x:number;y:number}{return {x:(p.x/18+.5)*1688,y:((p.z-COAST_ART.floor*COAST_ART.cameraSlope)/COAST_DEPTH+.5)*932};}
export const COAST_PATH_PIXELS:number[][][][]=SCENE_GEOMETRY_DATA.slice(0,50).map(g=>g.routes.map(r=>r.map(([x,y])=>[x*1688/560,y*932/310])));
export function isCoastStage(m:LevelDefinition):boolean{return m.id>=0&&m.id<50&&m.sceneArt===`map-coast-stage-${m.id+1}`;}
export function coastGroundIssue(id:number,p:Point):string|undefined{return sceneGroundIssue(id,p);}
export function applyCoastStage(m:LevelDefinition):LevelDefinition{
 const routes=COAST_PATH_PIXELS[m.id].map(r=>r.map(([x,y])=>coastPoint(x,y)));
 const slots=sceneSlots(m.id);
 const chapter=m.id<5?{}:m.id<10?{name:`珊瑚潮汐${m.id-4}`,subtitle:CORAL_SUBTITLES[m.id-5]}:m.id<15?{name:`翠竹长湾${m.id-9}`,subtitle:BAMBOO_SUBTITLES[m.id-10]}:{name:`${CHAPTER_SUBTITLES[Math.floor((m.id-15)/5)]}${(m.id-15)%5+1}`,subtitle:CHAPTER_SUBTITLES[Math.floor((m.id-15)/5)]+' · 路线递进'};
 const labels=routes.length>1?(m.id===9?['回礁长路','北潮短路']:m.id===10?['上环潮线','下环潮线']:m.id===11?['西北潮线','西南潮线','北潮线']:m.id===13?['西北线','西南线','北线','南线']:routes.map((_,i)=>`第${i+1}路`)):undefined;
 return {...m,...chapter,layoutVersion:2,stationVersion:6,sceneRevision:SCENE_REVISION,route:routes[0],routes:routes.length>1?routes:undefined,routeLabels:labels,slots,sceneArt:`map-coast-stage-${m.id+1}`,sceneMirror:false};
}





