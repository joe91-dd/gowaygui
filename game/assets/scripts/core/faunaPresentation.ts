import {FAUNA_MODELS} from './faunaCatalog';
import {BOSSES} from './bossCatalog';
import {enemyG1,worldG1} from './enemyG1Catalog';
/** One approved base mesh per species; grade materials are selected per actor. */
export const BOSS_VISUALS=BOSSES.map(b=>({key:enemyG1(b.assetId!)!.key,height:2,ability:b.ability}));
export const WORLD_VISUALS=Array.from({length:4},(_,i)=>({key:worldG1(i).key,height:2,ability:worldG1(i).effect}));
export function bossVisualKey(index:number):string{return BOSS_VISUALS[Math.max(0,index)%BOSS_VISUALS.length].key;}
export function worldVisualKey(index:number):string{return worldG1(index).key;}
export function faunaVisual(key:string){return enemyG1(key)??FAUNA_MODELS.find(m=>m.key===key);}
export function faunaBase(key:string){const approved=enemyG1(key);return approved?{...approved,sourceName:approved.name}:FAUNA_MODELS.find(m=>m.key===key);}
