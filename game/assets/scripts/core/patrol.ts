import type {GameSave,Material,SkillId,Turtle} from './types';
import {ROLE_IDS,SKILLS} from './data';
import {bookGrade} from './bookPolicy';
import {choose,random,weighted} from './random';
import {initialSkills,initialTalents} from './talents';
import {goldAmount} from './economy';
function ensurePatrol(condition:unknown,message:string,code='RULE'):asserts condition {
  if(!condition)throw Object.assign(new Error(message),{code});
}

export const PATROL={minuteMs:60000,capMinutes:720,encounterMinutes:30,materialChance:.30,bookChance:.03,turtleChance:.01} as const;
export interface PatrolRewards {gold:number;materials:Partial<Record<Material,number>>;books:Partial<Record<SkillId,number>>;pets:Turtle[]}
export interface PatrolState extends PatrolRewards {version:1;lastAt:number;bankMs:number;creditedMinutes:number;encounterMinutes:number;rng:number}
export const patrolGoldPerMinute=(save:GameSave):number=>Math.max(1,Math.round(goldAmount(save,1)/5));
export function enablePatrol(save:GameSave,now:number):void{
  save.patrol??={version:1,lastAt:now,bankMs:0,creditedMinutes:0,encounterMinutes:0,rng:(save.rng^Math.floor(now)^0x71a2c483)>>>0,gold:0,materials:{},books:{},pets:[]};
}
function encounter(save:GameSave,patrol:PatrolState,at:number):void{
  const roll=random(patrol);
  if(roll<PATROL.materialChance){
    const material=weighted<Material>(patrol,[{value:'attack',probability:.3},{value:'health',probability:.3},{value:'defense',probability:.25},{value:'growth',probability:.15}]);
    patrol.materials[material]=(patrol.materials[material]??0)+1;
  }else if(roll<PATROL.materialChance+PATROL.bookChance){
    const skill=choose(patrol,SKILLS.filter(item=>bookGrade(item.id)==='common')).id;
    patrol.books[skill]=(patrol.books[skill]??0)+1;
  }else if(roll<PATROL.materialChance+PATROL.bookChance+PATROL.turtleChance){
    const role=choose(patrol,ROLE_IDS),count=weighted(patrol,[{value:1,probability:.5},{value:2,probability:.3},{value:3,probability:.15},{value:4,probability:.04},{value:5,probability:.01}]);
    const generator={rng:patrol.rng,rulesVersion:save.rulesVersion};
    const pet:Turtle={id:`patrol-${++save.idCounter}`,role,name:'',skills:initialSkills(generator,role,count),innate:initialTalents(generator,role),training:{attack:0,health:0,defense:0,growth:0},generation:0,bornAt:at,parentIds:[],locked:false};
    patrol.rng=generator.rng;patrol.pets.push(pet);
  }
}
export function accruePatrol(save:GameSave,now:number):void{
  const patrol=save.patrol;if(!patrol)return;
  const at=Math.max(patrol.lastAt,now),previous=patrol.bankMs;
  patrol.bankMs=Math.min(PATROL.capMinutes*PATROL.minuteMs,previous+at-patrol.lastAt);
  const minutes=Math.floor(patrol.bankMs/PATROL.minuteMs),rate=patrolGoldPerMinute(save);
  for(let minute=patrol.creditedMinutes+1;minute<=minutes;minute++){
    patrol.gold+=rate;patrol.encounterMinutes++;
    if(patrol.encounterMinutes===PATROL.encounterMinutes){patrol.encounterMinutes=0;encounter(save,patrol,patrol.lastAt+minute*PATROL.minuteMs-previous);}
  }
  patrol.creditedMinutes=minutes;patrol.lastAt=at;
}
export function claimPatrol(save:GameSave):PatrolRewards{
  const patrol=save.patrol;
  ensurePatrol(patrol&&patrol.gold>0,'还未满一分钟，请稍后领取');
  ensurePatrol(Object.keys(save.collection).length+patrol.pets.length<=save.capacity,`龟龟背包空间不足，请留出${patrol.pets.length}个空位；巡海收获会完整保留`);
  const rewards:PatrolRewards={gold:patrol.gold,materials:patrol.materials,books:patrol.books,pets:patrol.pets};
  ensurePatrol(Number.isSafeInteger(save.gold+rewards.gold),'金币已达到安全上限');
  save.gold+=rewards.gold;
  for(const [key,amount] of Object.entries(rewards.materials))save.materials[key as Material]+=amount!;
  save.skillBooks??={};for(const [key,amount] of Object.entries(rewards.books))save.skillBooks[key as SkillId]=(save.skillBooks[key as SkillId]??0)+amount!;
  for(const pet of rewards.pets)save.collection[pet.id]=pet;
  patrol.gold=0;patrol.materials={};patrol.books={};patrol.pets=[];
  patrol.bankMs%=PATROL.minuteMs;patrol.creditedMinutes=0;
  return rewards;
}
export function validatePatrol(save:GameSave,validatePet:(pet:Turtle)=>void):void{
  const patrol=save.patrol;if(patrol===undefined)return;
  const integer=(value:unknown,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
  ensurePatrol(patrol&&patrol.version===1&&integer(patrol.lastAt,save.clockHighWater)&&integer(patrol.bankMs,PATROL.capMinutes*PATROL.minuteMs)&&integer(patrol.creditedMinutes,PATROL.capMinutes)&&patrol.creditedMinutes===Math.floor(patrol.bankMs/PATROL.minuteMs)&&integer(patrol.encounterMinutes,29)&&integer(patrol.rng,4294967295)&&integer(patrol.gold),'巡海累计资料损坏','SAVE');
  ensurePatrol(patrol.materials&&typeof patrol.materials==='object'&&!Array.isArray(patrol.materials)&&patrol.books&&typeof patrol.books==='object'&&!Array.isArray(patrol.books)&&Array.isArray(patrol.pets),'巡海收获资料损坏','SAVE');
  let count=patrol.pets.length;
  for(const [key,amount] of Object.entries(patrol.materials)){ensurePatrol(['attack','health','defense','growth'].includes(key)&&integer(amount,24)&&amount!>0,'巡海培养肉资料损坏','SAVE');count+=amount!;}
  for(const [key,amount] of Object.entries(patrol.books)){ensurePatrol(SKILLS.some(skill=>skill.id===key&&bookGrade(skill.id)==='common')&&integer(amount,24)&&amount!>0,'巡海技能书资料损坏','SAVE');count+=amount!;}
  ensurePatrol(count<=Math.ceil(patrol.creditedMinutes/30)&&new Set(patrol.pets.map(pet=>pet.id)).size===patrol.pets.length,'巡海奖励数量损坏','SAVE');
  for(const pet of patrol.pets){validatePet(pet);ensurePatrol(pet.skills.length<=5&&!save.collection[pet.id]&&!save.history[pet.id]&&pet.id.startsWith('patrol-'),'巡海伙伴资料损坏','SAVE');}
}
