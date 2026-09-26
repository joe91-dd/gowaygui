import {SKILLS} from './data';
import {random} from './random';
import type {RandomState} from './random';
import type {BookPackGrade,SkillId,RewardGrant} from './types';
export const bookGrade=(id:SkillId):BookPackGrade=>{const s=SKILLS.find(x=>x.id===id)!;return s.specialization?'mastery':s.active?'active':s.precious?'precious':'common';};
export const BOOK_ODDS={activity:[.90,.10,0,0],elite:[.78,.20,0,.02],stage:[.70,.26,0,.04]} as const;
const GRADES:BookPackGrade[]=['common','active','mastery','precious'];
export function drawBookGrade(s:RandomState,pool:keyof typeof BOOK_ODDS='activity'):BookPackGrade{let roll=random(s);const odds=BOOK_ODDS[pool];for(let i=0;i<4;i++){roll-=odds[i];if(roll<0)return GRADES[i];}return 'common';}
export function policyBook(s:RandomState,pool:keyof typeof BOOK_ODDS='activity'):SkillId{const grade=drawBookGrade(s,pool),list=SKILLS.filter(x=>bookGrade(x.id)===grade);return list[Math.floor(random(s)*list.length)].id;}
export function bookChestReward(s:RandomState,advanced=false):RewardGrant{return {kind:'bookPack',grade:drawBookGrade(s,advanced?'stage':'elite'),amount:1};}
export const bookAllowed=(id:SkillId,source:'chapter'|'endless'|'raid'|'arena'|'world'|'stage'|'shop'):boolean=>source!=='chapter'&&(!['mastery','precious'].includes(bookGrade(id))||['raid','arena','world','stage'].includes(source));
