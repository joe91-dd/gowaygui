"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossMaterial = bossMaterial;
exports.bossLootText = bossLootText;
exports.skillSources = skillSources;
exports.enemyBasicText = enemyBasicText;
exports.monsterCombatText = monsterCombatText;
exports.encounterPages = encounterPages;
const bookPolicy_1 = require("./bookPolicy");
const bossCatalog_1 = require("./bossCatalog");
const data_1 = require("./data");
const enemyCombat_1 = require("./enemyCombat");
const enemyG1Catalog_1 = require("./enemyG1Catalog");
function bossMaterial(b) { let n = 2166136261; for (const c of b.id)
    n = Math.imul(n ^ c.charCodeAt(0), 16777619); return ['attack', 'health', 'defense', 'growth'][(n >>> 0) % 4]; }
function bossLootText(b) {
    const base = `击败：金币、${data_1.MATERIAL_NAMES[bossMaterial(b)]} ×${1 + Math.floor(b.tier / 2)}`;
    if (b.id.startsWith('raid-'))
        return base + '\n' + (b.dropBook && (0, bookPolicy_1.bookAllowed)(b.dropBook, 'raid') ? '额外技能书：' + data_1.SKILL_BY_ID[b.dropBook].name + '（' + Math.round((0, bossCatalog_1.bossDropChance)(b.tier) * 100) + '%）' : '无额外技能书；通关另领副本奖励');
    return base + '\n关卡技能书按通关奖励；无尽仅按里程碑领奖';
}
function skillSources(id) {
    const grade = (0, bookPolicy_1.bookGrade)(id);
    return grade === 'precious' ? '伙伴可能自带或合宠继承；珍贵书仅由技能书合成产出或玩家交易\n基础概率0.5%，每10祝福点 +0.5个百分点；每次合成 +1点\n满200点后下次必出，出珍贵清零；挑战、巡海及商城不产出' : grade === 'mastery' ? '仅在局内合成至3阶时获得对应职业专精，强化职业主动\n专精仅本局有效；不产出专精书，不能通过技能书学习或合成' : grade === 'active' ? '无尽里程碑、副本通关、竞技场、世界挑战的对应奖励\n商城技能招募 / 对应礼包、技能书合成、玩家市场\n不是每次挑战必得；具体数量和概率以对应奖励说明为准' : '关卡通关、无尽里程碑、副本、竞技场、世界挑战、巡海\n商城技能招募 / 对应礼包、技能书合成、玩家市场、任务奖励\n各来源概率不同，请查看对应奖励说明';
}
function enemyBasicText(key) {
    const p = (0, enemyCombat_1.enemyCombat)(key), names = { claw: '挥钳 / 挥爪', bite: '咬击', headbutt: '顶撞', punch: '拳击', tentacle: '触手抽打', sting: '刺击', inkBolt: '墨弹', spikeBolt: '尖刺', frostBolt: '冰弹', fireBolt: '火弹', sparkBolt: '电光弹' };
    return `普攻：${names[p.basic]} · ${p.ranged ? '远程' : '近战'}${p.magic ? '法术' : '物理'}`;
}
function monsterCombatText(key) {
    const p = (0, enemyCombat_1.enemyCombat)(key), kind = (0, enemyG1Catalog_1.enemyG1)(key)?.kind, traits = { runner: '疾行型：移动较快，控制后集火。', armored: '重甲型：适合用法术或破甲应对。', mist: '咒术型：适合用物理输出应对。', snail: '远程型：保护后排，及时调位。', elite: '精英型：保留控制打断蓄力。', ink: '集群型：群攻与额外目标更有效。', boss: '首领型：留意预警并分散站位。' };
    return [enemyBasicText(key), (0, enemyCombat_1.enemySkillDetail)(key), `技能基础间隔 ${p.cooldown}秒（需目标在范围内）`, kind ? traits[kind] : ''].join('\n');
}
function encounterPages(b) { const list = (0, bossCatalog_1.bossEncounters)(b.id), pages = []; for (let i = 0; i < list.length; i += 4)
    pages.push(list.slice(i, i + 4).join('\n')); return pages.length ? pages : ['尚未开放']; }
