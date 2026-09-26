import type {Listing} from './communityTypes';
import type {Role} from './types';
import {ROLES,SKILL_BY_ID} from './data';
export interface MarketFilter {kind:'trade'|'rental';ownerId:string;mine:boolean;asset:'all'|'pet'|'book';role:'all'|Role;search:string;sort:'asc'|'desc'}
/** Pure filtering keeps all options active together and never changes listing ownership. */
export function filterMarket(listings:Listing[],f:MarketFilter):Listing[]{
  const needle=f.search.trim().toLocaleLowerCase();
  return listings.filter(l=>l.status==='listed'&&(f.kind==='rental'?l.kind==='rental':l.kind!=='rental')&&(f.mine?l.ownerId===f.ownerId:l.ownerId!==f.ownerId))
    .filter(l=>f.kind==='rental'?f.role==='all'||l.pet?.role===f.role:f.asset==='all'||l.kind===f.asset)
    .filter(l=>!needle||(l.pet?`${l.pet.name} ${ROLES[l.pet.role].name} ${ROLES[l.pet.role].job}`:SKILL_BY_ID[l.skillId!].name).toLocaleLowerCase().includes(needle))
    .sort((a,b)=>(f.sort==='asc'?a.price-b.price:b.price-a.price)||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
}
