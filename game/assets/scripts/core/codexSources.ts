import {bookGrade} from './bookPolicy';
import {BOSSES,bossDropChance,bossEncounters,BossDefinition} from './bossCatalog';
import {MATERIAL_NAMES,SKILL_BY_ID} from './data';
import type {SkillId} from './types';
export function bossMaterial(b:BossDefinition):'attack'|'health'|'defense'|'growth'{let n=2166136261;for(const c of b.id)n=Math.imul(n^c.charCodeAt(0),16777619);return (['attack','health','defense','growth'] as const)[(n>>>0)%4];}
export function bossLootText(b:BossDefinition):string{return `必得：金币、${MATERIAL_NAMES[bossMaterial(b)]} ×${1+Math.floor(b.tier/2)}\n活动限定掉落（普通关卡除外）：${SKILL_BY_ID[b.dropBook!]?.name??'技能'}（${Math.round(bossDropChance(b.tier)*100)}%）`;}
export function skillSources(id:SkillId):string{
 const grade=bookGrade(id);return grade==='precious'?'副本 / 竞技场胜利 / 世界挑战 / 高难阶段宝箱\n高级活动技能池 2%，高难阶段池 4%\n同品质内随机；普通关卡与商城不产出':grade==='mastery'?'副本 / 竞技场胜利 / 世界挑战 / 阶段宝箱\n高级活动技能池 8%，高难阶段池 12%\n同品质内随机；普通关卡与商城不产出':grade==='active'?'无尽 / 副本 / 竞技场 / 世界挑战 / 活动 / 技能招募\n基础活动书池 10%，高级活动书池 20%\n普通关卡不产出；同品质内随机':'无尽 / 副本 / 竞技场 / 世界挑战 / 活动 / 技能招募\n基础活动书池 90%，高级活动书池 70%\n普通关卡不产出；同品质内随机';
}
export function encounterPages(b:BossDefinition):string[]{const list=bossEncounters(b.id),pages:string[]=[];for(let i=0;i<list.length;i+=4)pages.push(list.slice(i,i+4).join('\n'));return pages.length?pages:['尚未开放'];}
