import type {Role,Turtle} from '../core/types';
/** Presentation identity only. Saved role IDs and combat definitions never change. */
export const HERO_LOOK:Record<Role,{name:string;job:string;accent:string;gender:'男'|'女'}>={
  stone:{name:'岩盾',job:'肉盾',accent:'#C59758',gender:'男'},
  spike:{name:'叶灵',job:'射手',accent:'#42C590',gender:'女'},
  crystal:{name:'珊歌',job:'法师',accent:'#37C7EF',gender:'女'},
  leaf:{name:'阳光',job:'治疗',accent:'#F9C34D',gender:'男'},
  bubble:{name:'潮行',job:'召唤',accent:'#AD8FE8',gender:'男'},
};
export const visualName=(t:Pick<Turtle,'name'|'role'>):string=>t.name||HERO_LOOK[t.role].name;
