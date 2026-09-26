import type {GameSave,Turtle} from './types';
import {visiblePets} from './petAccess';
import {turtleQuality} from './prototypeConfig';
import {levelInfo} from './development';
import {requireRule} from './save';

export function orderedPets(s:GameSave,ownedOnly=false):Turtle[]{
 const rank=new Map((s.collectionOrder??[]).map((id,i)=>[id,i]));
 return (ownedOnly?Object.values(s.collection):visiblePets(s)).sort((a,b)=>
  (rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity)||turtleQuality(b).tier-turtleQuality(a).tier||levelInfo(b).level-levelInfo(a).level||a.id.localeCompare(b.id));
}
/** Display order only: never exchanges identities, ownership, stats or deployed slots. */
export function swapPetOrder(s:GameSave,a:string,b:string):void{
 const ids=orderedPets(s).map(t=>t.id),i=ids.indexOf(a),j=ids.indexOf(b);
 requireRule(i>=0&&j>=0,'伙伴已不在背包中，请重新选择');
 [ids[i],ids[j]]=[ids[j],ids[i]];s.collectionOrder=ids;
}
