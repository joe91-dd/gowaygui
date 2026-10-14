"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeExpeditionRun = initializeExpeditionRun;
exports.syncExpeditionRun = syncExpeditionRun;
exports.settleExpeditionRun = settleExpeditionRun;
const community_1 = require("./community");
const battle_1 = require("./battle");
const expeditionRules_1 = require("./expeditionRules");
const development_1 = require("./development");
const random_1 = require("./random");
const rewardBalance_1 = require("./rewardBalance");
const endlessRewards_1 = require("./endlessRewards");
const progression_1 = require("./progression");
const mail_1 = require("./mail");
const clone = (v) => JSON.parse(JSON.stringify(v));
function initializeExpeditionRun(s, r) {
    const templates = r.selectedSources.map(id => Object.values(r.units).find(u => u.savedId === id || u.loanId === id)?.turtle).filter((t) => !!t);
    if (!templates.length)
        throw Error('请先选择出战龟龟');
    const e = (0, expeditionRules_1.newExpedition)(r.mode === 'endless' ? 'endless' : 'chapter', r.levelId, [{ id: 'local-player', templates }]);
    r.expedition = e;
    if (r.mode === 'chapter')
        r.waveLimit = (0, expeditionRules_1.chapterWaves)(r.levelId);
    else
        delete r.waveLimit;
    delete r.bossRescuedWaves;
    r.merges = {};
    r.units = {};
    r.usedSources = templates.map(t => t.id).filter(id => !!s.collection[id]);
    r.recruitAvailable = false;
    r.rewardNodes = [];
    r.rewardLedger = [];
    const b = (0, battle_1.createBattle)(r.levelId, 1, [], { rulesVersion: '0.6', mode: r.mode, formationVersion: 2, expedition: e, seed: Math.floor((0, random_1.random)(s) * 4294967296) });
    b.units.forEach(u => u.placement = { x: u.x, z: u.z });
    b.autoSkills = s.settings.autoSkills ?? false;
    r.battle = b;
    syncExpeditionRun(r, b);
}
function syncExpeditionRun(r, b) {
    if (!b.expedition)
        throw Error('缺少局内征召规则');
    r.expedition = clone(b.expedition);
    r.wave = b.expedition.completed;
    r.battle = clone(b);
    const old = r.units;
    r.units = {};
    for (const u of b.units) {
        const template = b.expedition.players.flatMap(p => p.templates).find(t => t.id === u.turtleId);
        if (!template)
            throw Error('培养模板丢失');
        r.units[u.id] = { id: u.id, turtle: clone(template), sources: [], slot: u.slot, placement: clone(u.placement ?? { x: u.x, z: u.z }), level: u.level, fusionRank: u.fusionRank, fallen: !u.alive, ...(u.sleepUntilWave !== undefined ? { sleepUntilWave: u.sleepUntilWave } : {}) };
    }
}
function settleExpeditionRun(s, r, victory, now, generate) {
    if (s.results[r.id])
        return s.results[r.id];
    const e = r.battle?.expedition ?? r.expedition;
    r.wave = e.completed;
    const endless = r.mode === 'endless', p = (0, progression_1.progression)(s), day = (0, rewardBalance_1.rewardDay)(Math.max(now, s.clockHighWater));
    if (endless && (!p.endlessDaily || p.endlessDaily.day < day))
        p.endlessDaily = { day, waves: [] };
    const previousWave = endless ? Math.max(p.endlessDaily.bestWave ?? 0, ...p.endlessDaily.waves, ...Object.values(s.results).filter(v => v.mode === 'endless' && (0, rewardBalance_1.rewardDay)(v.at) === day).map(v => v.waves)) : 0;
    const cumulativeGold = (wave) => Math.floor(150 * wave * (1 + Math.min(1.5, Math.floor(wave / 10) * .15)));
    let baseGold = endless ? Math.max(0, cumulativeGold(r.wave) - cumulativeGold(previousWave)) : 100 * r.wave + (victory ? 300 + 80 * r.levelId : 0);
    const materials = {}, books = {}, progress = endless ? Math.max(0, Math.floor(r.wave / 5) - Math.floor(previousWave / 5)) : victory ? 1 + Math.floor(r.levelId / 10) : 0;
    for (let i = 0; i < progress; i++) {
        const keys = ['attack', 'health', 'defense', 'growth'];
        for (const key of endless ? keys : [keys[(r.levelId + i) % 4]]) {
            const n = endless ? (key === 'growth' ? 1 : 2) : 1;
            s.materials[key] += n;
            materials[key] = (materials[key] ?? 0) + n;
        }
    }
    let petRewards = [];
    if (!endless && victory) {
        const loot = (0, rewardBalance_1.campaignLoot)(s, r.levelId, 'chapter-' + r.id, now);
        petRewards = loot.pets;
        for (const g of loot.grants) {
            if (g.kind === 'gold')
                baseGold += g.amount;
            else if (g.kind === 'book') {
                s.skillBooks ?? (s.skillBooks = {});
                s.skillBooks[g.skillId] = (s.skillBooks[g.skillId] ?? 0) + g.amount;
                books[g.skillId] = (books[g.skillId] ?? 0) + g.amount;
            }
        }
        const mail = (0, mail_1.sendSystemMail)(s, 'chapter-pets:' + r.id, '第' + (r.levelId + 1) + '关 · 伙伴奖励', '本次通关获得随机4–5技能伙伴，整理背包后也可领取。', [], now);
        mail.pets = clone(petRewards);
    }
    if (endless) {
        (0, endlessRewards_1.grantDailyEndlessRewards)(s, r.wave, now);
        p.endlessDaily.bestWave = Math.max(previousWave, r.wave);
    }
    const first = victory && !endless && !s.cleared.includes(r.levelId), result = { runId: r.id, levelId: r.levelId, mode: r.mode, victory, waves: r.wave, baseGold, firstClearGold: first ? 500 : 0, combatSeconds: r.combatSeconds + (r.battle?.elapsed ?? 0), at: now, doubled: false, materials, skillBooks: books, broughtIds: [], petRewards };
    result.kills = r.battle?.kills ?? 0;
    result.mergeCount = e.mergeCount ?? 0;
    result.highestRank = e.highestRank ?? 1;
    result.buffCount = Object.values(e.players[0].buffs).reduce((n, v) => n + (v ?? 0), 0);
    result.previousBest = s.endlessBest?.waves ?? 0;
    result.contributions = r.battle?.contributions;
    if (endless && (!s.endlessBest || r.wave > s.endlessBest.waves))
        s.endlessBest = { waves: r.wave, at: now, team: clone(e.players[0].templates) };
    if (endless)
        result.bestWave = s.endlessBest?.waves ?? 0;
    r.lootIds = [];
    (0, community_1.finishLoans)(s, r.id);
    s.gold += baseGold + result.firstClearGold;
    s.results[r.id] = result;
    r.phase = 'result';
    delete r.battle;
    (0, development_1.grantExperience)(s, r.usedSources, endless ? Math.max(0, r.wave - previousWave) * 22 : r.wave * 15 + (victory ? 30 : 0));
    if (first) {
        s.cleared.push(r.levelId);
        s.unlockedLevel = Math.max(s.unlockedLevel, Math.min(49, r.levelId + 1));
    }
    if (victory && r.levelId === 0)
        s.tutorialDone = true;
    return result;
}
