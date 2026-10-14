import type {GameSave,SkillId} from './types';
import {SKILLS} from './data';
import type {BuffId} from './expeditionRules';

export interface SoloProgress {version:1;difficulty:1|2|3;best:[number,number,number];claims:string[];testPackClaims:string[]}
export const BASIC_SKILLS:SkillId[]=['strong','armor','resist','swift','reach','steady','regen','openingShield','lastShield','encourage','block','hold','piercingShot','crystalCannon','greatHeal','bubbleRing'];
export const BASIC_BUFFS:BuffId[]=['attack','defense','health','range','haste','regen','speed','guard'];
export const soloChapter=(s:GameSave)=>s.cleared.length?Math.max(...s.cleared)+1:0;
export const soloFusion=(s:GameSave)=>Math.max(0,...Object.values(s.collection).map(t=>t.skills.length),...Object.values(s.history).map(t=>t.turtle.skills.length));
export const soloBest=(s:GameSave)=>Math.max(0,...(s.solo?.best??[0,0,0]));
export function skillUnlocked(s:Partial<GameSave>,id:SkillId):boolean{
 if(!s.solo)return true;
 const skill=SKILLS.find(x=>x.id===id);if(!skill||skill.specialization)return false;
 if(BASIC_SKILLS.includes(id))return true;
 const chapter=s.cleared?.length?Math.max(...s.cleared)+1:0,best=Math.max(...s.solo.best);
 return skill.precious?chapter>=20||best>=30:chapter>=5||best>=10;
}
export function unlockedBuffs(s:GameSave):BuffId[]{
 const ids=[...BASIC_BUFFS],chapter=soloChapter(s),best=soloBest(s);
 if(chapter>=5||best>=10)ids.push('drain','crit','tidePierce','crystalBurst','healingTide');
 if(chapter>=10||best>=20)ids.push('waveGrowth','killAttack','killDefense','killHealth','treasury');
 if(chapter>=20||best>=30)ids.push('desperate','phoenix','tauntGuard','cleanseSurge');
 return ids;
}
export const difficultyUnlocked=(s:GameSave,d:1|2|3)=>d===1?soloChapter(s)>=2:d===2?(s.solo?.best[0]??0)>=15:(s.solo?.best[1]??0)>=25;
export const SOLO_MILESTONES=[
 {id:'chapter2',name:'初识海湾',kind:'chapter',target:2,detail:'开启无尽难度 I',gold:300},
 {id:'chapter5',name:'海湾守护者',kind:'chapter',target:5,detail:'扩充基础技能与职业祝福',gold:500},
 {id:'chapter10',name:'珊瑚领航员',kind:'chapter',target:10,detail:'解锁成长类祝福',gold:800},
 {id:'chapter20',name:'日光远航',kind:'chapter',target:20,detail:'解锁珍贵技能与稀有祝福',gold:1200},
 {id:'chapter50',name:'终焉守护',kind:'chapter',target:50,detail:'完成全部主线',gold:3000},
 {id:'endless10',name:'乘风破浪',kind:'endless',target:10,detail:'扩充技能与职业祝福',gold:500},
 {id:'endless20',name:'不息浪潮',kind:'endless',target:20,detail:'解锁成长类祝福',gold:900},
 {id:'endless30',name:'深海意志',kind:'endless',target:30,detail:'解锁珍贵技能与稀有祝福',gold:1500},
 {id:'fusion6',name:'初次蜕变',kind:'fusion',target:6,detail:'拥有一只 6 技能伙伴',gold:500},
 {id:'fusion8',name:'卓越伙伴',kind:'fusion',target:8,detail:'拥有一只 8 技能伙伴',gold:1000},
 {id:'fusion10',name:'传奇伙伴',kind:'fusion',target:10,detail:'拥有一只 10 技能伙伴',gold:1800},
 {id:'fusion12',name:'完美共鸣',kind:'fusion',target:12,detail:'拥有一只 12 技能伙伴',gold:3000},
] as const;
export const milestoneValue=(s:GameSave,kind:string)=>kind==='chapter'?soloChapter(s):kind==='endless'?soloBest(s):soloFusion(s);
export function enableSolo(s:GameSave):void{
 if(s.solo)return;s.solo={version:1,difficulty:1,best:[0,0,0],claims:[],testPackClaims:[]};
 // Separate solo saves begin with the same five recognizable four-skill classes.
 if(!s.cleared.length&&!s.run)for(const t of Object.values(s.collection)){
  const active=SKILLS.find(x=>x.role===t.role&&x.active&&!x.specialization)!.id;
  t.skills=[active,'strong','armor',t.role==='leaf'?'regen':'swift'];
 }
}
