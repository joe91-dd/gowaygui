"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUnits = void 0;
exports.pendingTakeaways = pendingTakeaways;
exports.enablePrototype = enablePrototype;
exports.checkOutsideReady = checkOutsideReady;
exports.refreshBench = refreshBench;
exports.lockBench = lockBench;
exports.deployBench = deployBench;
exports.movePrototypeUnit = movePrototypeUnit;
exports.mergeBench = mergeBench;
exports.recordEndlessWave = recordEndlessWave;
exports.hasPendingReward = hasPendingReward;
exports.remainingRewardIndices = remainingRewardIndices;
exports.rewardPrice = rewardPrice;
exports.prepareEndlessReward = prepareEndlessReward;
exports.chooseEndlessReward = chooseEndlessReward;
exports.buyEndlessReward = buyEndlessReward;
exports.closeEndlessReward = closeEndlessReward;
exports.carryTurtle = carryTurtle;
exports.discardTakeaway = discardTakeaway;
exports.settlePrototype = settlePrototype;
exports.startOutsideFusion = startOutsideFusion;
exports.keepOutsideFusion = keepOutsideFusion;
exports.releaseCollected = releaseCollected;
exports.startPrototypeRun = startPrototypeRun;
const expeditionRun_1 = require("./expeditionRun");
const sceneGeometry_1 = require("./sceneGeometry");
const endlessRewards_1 = require("./endlessRewards");
const rewardBalance_1 = require("./rewardBalance");
const mail_1 = require("./mail");
const development_1 = require("./development");
const progression_1 = require("./progression");
const economy_1 = require("./economy");
const dailyAccess_1 = require("./dailyAccess");
const rewardPacks_1 = require("./rewardPacks");
const development_2 = require("./development");
const data_1 = require("./data");
const fusion_1 = require("./fusion");
const save_1 = require("./save");
const prototypeConfig_1 = require("./prototypeConfig");
const battle_1 = require("./battle");
const random_1 = require("./random");
const community_1 = require("./community");
const allocate = (s, prefix) => `${prefix}-${++s.idCounter}`;
const currentUnits = (r) => Object.values(r.units).filter(u => !u.consumedBy && !u.removed);
exports.currentUnits = currentUnits;
function pendingTakeaways(s) {
    const r = s.run;
    if (r?.expedition)
        return r.phase === 'result' ? (r.lootIds ?? []).map(id => r.units[id]).filter(u => u && !u.savedId && !u.removed) : [];
    return r?.rulesVersion === '0.6' && r.mode === 'chapter' && r.phase === 'result' && s.results[r.id]?.victory ?
        (0, exports.currentUnits)(r).filter(u => !u.savedId && !u.loanId) : [];
}
function enablePrototype(s) {
    if (s.rulesVersion === '0.6')
        return;
    s.rulesVersion = '0.6';
    s.capacity = prototypeConfig_1.PROTOTYPE.capacity;
    if (Object.keys(s.collection).length > s.capacity)
        s.legacyCollectionAllowance = Object.keys(s.collection).length;
}
function checkOutsideReady(s) {
    (0, save_1.requireRule)(!s.shop?.pending, '请先查看商城结果');
    (0, save_1.requireRule)(!(0, community_1.communityBusy)(s), '请先结束副本或竞技场挑战');
    (0, save_1.requireRule)(!s.run || s.run.phase === 'result', '请先结束当前挑战');
    (0, save_1.requireRule)(!s.outsideFusion, '请先完成上次合成的三选一');
    (0, save_1.requireRule)(!s.bookReveal, '请先揭晓已学习的技能');
}
function prototypeRun(s) {
    const r = s.run;
    (0, save_1.requireRule)(r?.rulesVersion === '0.6', '这不是新版对局');
    return r;
}
function benchUnit(r, id) {
    const u = (0, exports.currentUnits)(r).find(u => u.id === id);
    (0, save_1.requireRule)(u && u.slot === null && u.benchSlot !== undefined, '请选择当前备战槽里的伙伴');
    return u;
}
function refreshBench(s, r, now, generate) {
    (0, save_1.requireRule)(r.mode === 'chapter', '无尽使用资源奖励');
    for (let slot = 0; slot < prototypeConfig_1.PROTOTYPE.benchSize; slot++) {
        const old = (0, exports.currentUnits)(r).find(u => u.benchSlot === slot);
        if (old?.benchLocked)
            continue;
        if (old) {
            if (r.battle)
                (0, battle_1.retireBenchedBattleUnit)(r.battle, old.id);
            old.removed = 'refresh';
            delete old.benchSlot;
        }
        const u = { id: allocate(s, 'u'), turtle: generate(s, now), sources: [], slot: null, benchSlot: slot, benchLocked: false, level: 1 };
        r.units[u.id] = u;
    }
}
function startLegacyPrototypeRun(s, now, levelId, selected, mode, generate) {
    checkOutsideReady(s);
    (0, save_1.requireRule)(pendingTakeaways(s).length === 0, '请先整理上局待带回的伙伴');
    enablePrototype(s);
    (0, save_1.requireRule)(mode === 'chapter' || mode === 'endless', '挑战模式不存在');
    if (mode === 'endless') {
        (0, save_1.requireRule)(s.cleared.includes(prototypeConfig_1.PROTOTYPE.endless.unlockAfter), '先通关潮汐小径，再挑战无尽海湾');
        levelId = prototypeConfig_1.PROTOTYPE.endless.map;
    }
    else
        (0, save_1.requireRule)(data_1.LEVELS[levelId] && levelId <= s.unlockedLevel, '请先通过前一关');
    (0, save_1.requireRule)(selected.length <= 5 && new Set(selected).size === selected.length && selected.every(id => !!s.collection[id] || s.community?.loans.some(l => l.id === id)), '最多选择五只不同的收藏伙伴');
    (0, save_1.requireRule)(mode === 'chapter' || selected.length > 0, '无尽至少需要一只收藏伙伴');
    if (mode === 'endless')
        (0, dailyAccess_1.consumeAttempt)(s, 'endless', now);
    if (mode === 'chapter') {
        const free = levelId === 0 && !s.tutorialStarted;
        (0, save_1.requireRule)(free || s.stamina >= data_1.ECONOMY.staminaCost, '体力不足，休息片刻再来吧');
        if (!free)
            s.stamina -= data_1.ECONOMY.staminaCost;
        if (levelId === 0)
            s.tutorialStarted = true;
    }
    const r = { id: allocate(s, 'run'), rulesVersion: '0.6', mapVersion: 6, sceneRevision: sceneGeometry_1.SCENE_REVISION, mode, speed: 1, levelId, phase: 'prep', wave: 0, coreHealth: 20, ...(mode === 'chapter' ? { waveLimit: 5, bossRescuedWaves: [] } : {}),
        goldEarned: 0, combatSeconds: 0, startedAt: now, selectedSources: [...selected], usedSources: [...selected], units: {}, merges: {},
        mergeWavesUsed: [], recruitAvailable: false, recruitCandidates: [], refreshUsed: false, rewardNodes: [], rewardLedger: [] };
    const pets = selected.length ? (0, community_1.choosePets)(s, selected, now) : [];
    (0, community_1.reserveLoans)(s, pets, r.id);
    pets.forEach((p, slot) => { const u = { id: allocate(s, 'u'), turtle: (0, save_1.copy)(p.turtle), sources: p.loanId ? [] : [p.id], ...(p.loanId ? { loanId: p.loanId } : { savedId: p.id }), slot, level: (0, development_1.levelInfo)(p.turtle).level }; r.units[u.id] = u; });
    if (mode === 'chapter')
        refreshBench(s, r, now, generate);
    s.run = r;
    return r;
}
function lockBench(s, id, locked) {
    const r = prototypeRun(s);
    (0, save_1.requireRule)(['prep', 'between', 'combat'].includes(r.phase), '请先完成当前操作');
    benchUnit(r, id).benchLocked = !!locked;
}
function deployBench(s, id, slot, placement) {
    const r = prototypeRun(s);
    (0, save_1.requireRule)(['prep', 'between', 'combat'].includes(r.phase), '请先完成当前操作');
    (0, save_1.requireRule)(Number.isInteger(slot) && slot >= 0 && !!data_1.BATTLE_MAPS[r.levelId].slots[slot], '上场位置不存在');
    const incoming = benchUnit(r, id);
    const old = (0, exports.currentUnits)(r).find(u => u.slot === slot);
    (0, save_1.requireRule)(!!old || (0, exports.currentUnits)(r).filter(u => u.slot !== null).length < 5, '场上最多五只，请选择要替换的伙伴');
    if (r.phase === 'combat') {
        (0, save_1.requireRule)(r.battle?.status === 'fighting', '本波已经结束');
        (0, battle_1.replaceBattleUnit)(r.battle, { id: incoming.id, turtle: incoming.turtle, level: incoming.level, slot, placement: placement ?? old?.placement, sleepUntilWave: incoming.sleepUntilWave, fallen: incoming.fallen });
    }
    if (old) {
        old.slot = null;
        old.benchSlot = incoming.benchSlot;
        old.benchLocked = true;
    }
    incoming.placement = placement ?? old?.placement;
    if (incoming.placement === undefined)
        delete incoming.placement;
    incoming.slot = slot;
    delete incoming.benchSlot;
    incoming.benchLocked = false;
}
function movePrototypeUnit(s, id, slot, benchSlot) {
    const r = prototypeRun(s), u = (0, exports.currentUnits)(r).find(u => u.id === id);
    (0, save_1.requireRule)(u && ['prep', 'between', 'combat'].includes(r.phase), '当前不能调整伙伴');
    if (slot !== null) {
        (0, save_1.requireRule)(Number.isInteger(slot) && slot >= 0 && !!data_1.BATTLE_MAPS[r.levelId].slots[slot], '上场位置不存在');
        if (u.slot === null) {
            deployBench(s, id, slot);
            return;
        }
        if (r.phase === 'combat') {
            (0, save_1.requireRule)(r.battle, '战斗快照缺失');
            (0, battle_1.moveBattleUnit)(r.battle, id, slot);
        }
        const other = (0, exports.currentUnits)(r).find(v => v.id !== id && v.slot === slot), oldPoint = u.placement;
        u.placement = other?.placement;
        if (u.placement === undefined)
            delete u.placement;
        if (other) {
            other.slot = u.slot;
            other.placement = oldPoint;
            if (other.placement === undefined)
                delete other.placement;
        }
        u.slot = slot;
        return;
    }
    (0, save_1.requireRule)(u.slot !== null, '这位伙伴已经在备战槽');
    const target = benchSlot ?? Array.from({ length: 5 }, (_, i) => i).find(i => !(0, exports.currentUnits)(r).some(v => v.benchSlot === i));
    (0, save_1.requireRule)(target !== undefined && Number.isInteger(target) && target >= 0 && target < 5, '备战槽已满');
    const occupant = (0, exports.currentUnits)(r).find(v => v.benchSlot === target);
    if (occupant) {
        deployBench(s, occupant.id, u.slot);
        return;
    }
    if (r.phase === 'combat') {
        (0, save_1.requireRule)((0, exports.currentUnits)(r).filter(v => v.slot !== null).length > 1 && r.battle, '战斗中至少留一位伙伴上场');
        (0, battle_1.benchBattleUnit)(r.battle, u.id);
    }
    u.slot = null;
    u.benchSlot = target;
    u.benchLocked = true;
}
function mergeBench(s, now, aId, bId, allowPermanent = false) {
    const r = prototypeRun(s);
    (0, save_1.requireRule)(r.mode === 'chapter' && ['prep', 'between', 'combat'].includes(r.phase), '当前不能合成备战伙伴');
    (0, save_1.requireRule)(aId !== bId, '请选择两只不同的备战伙伴');
    const a = benchUnit(r, aId), b = benchUnit(r, bId), eventId = allocate(s, 'merge');
    (0, save_1.requireRule)(!a.loanId && !b.loanId, '援助和租赁伙伴不能参与合成');
    const originals = [a, b].filter(u => u.savedId).map(u => u.savedId);
    (0, save_1.requireRule)(!originals.length || allowPermanent, '建议回家再合，战斗中合成有损失本体的风险');
    (0, save_1.requireRule)(originals.every(id => s.collection[id] && !s.collection[id].locked), '请回海岛解锁参与合成的收藏伙伴');
    originals.forEach(id => (0, community_1.assertAssetMovable)(s, id));
    const turtle = (0, fusion_1.generateFusion)(s, a.turtle, b.turtle, allocate(s, 't'), now);
    const result = { id: allocate(s, 'u'), turtle, sources: [], slot: null, benchSlot: a.benchSlot,
        benchLocked: prototypeConfig_1.PROTOTYPE.lockFusionResult, level: (0, development_1.levelInfo)(turtle).level };
    a.consumedBy = eventId;
    b.consumedBy = eventId;
    delete a.benchSlot;
    delete b.benchSlot;
    for (const id of originals)
        delete s.collection[id];
    if (r.battle) {
        (0, battle_1.retireBenchedBattleUnit)(r.battle, a.id);
        (0, battle_1.retireBenchedBattleUnit)(r.battle, b.id);
    }
    r.units[result.id] = result;
    r.merges[eventId] = { id: eventId, inputIds: [aId, bId], outputId: result.id, originalSources: originals,
        wave: r.wave, revealed: false, probabilityVersion: fusion_1.FUSION_VERSION };
    r.resumeAfterReveal = r.phase;
    r.pendingMergeId = eventId;
    r.phase = 'reveal';
    return result;
}
function recordEndlessWave(s, r) {
    const ledger = r.rewardLedger;
    for (const grant of (0, economy_1.goldGrants)(s, (0, prototypeConfig_1.stageRewards)(s, r.wave, !!s.economyVersion)))
        ledger.push({ wave: r.wave, source: 'stage', grant });
    if (r.wave % prototypeConfig_1.PROTOTYPE.endless.rewardEvery === 0) {
        const choices = (0, economy_1.goldGrants)(s, (0, prototypeConfig_1.rewardBoard)(s, r.wave, !!s.economyVersion));
        r.rewardNodes.push({ wave: r.wave, choices, format: 'stop-and-open', opened: [], closed: false, drawing: true, spentGold: 0, randomIndex: Math.floor((0, random_1.random)(s) * 5) });
    }
}
function hasPendingReward(node) { return node.format === 'stop-and-open' ? !node.closed : node.chosen === undefined; }
function remainingRewardIndices(node) { return node.choices.map((_, i) => i).filter(i => !node.opened?.includes(i)); }
function rewardPrice(node, all = false) {
    const count = node.opened?.length ?? 0;
    if (!count || node.closed)
        return 0;
    return all ? Math.ceil(prototypeConfig_1.EXTRA_DRAW_COSTS.slice(count).reduce((a, b) => a + b, 0) * .9) : prototypeConfig_1.EXTRA_DRAW_COSTS[count];
}
function rewardNode(s, wave) {
    const r = prototypeRun(s), node = r.rewardNodes?.find(n => n.wave === wave);
    (0, save_1.requireRule)(r.mode === 'endless' && r.phase === 'between' && node && hasPendingReward(node), '没有待处理的奖励');
    return node;
}
function prepareEndlessReward(s, wave) {
    const node = rewardNode(s, wave);
    (0, save_1.requireRule)(node.format !== 'stop-and-open' || node.drawing, '请先选择继续开奖或放弃');
    if (node.randomIndex === undefined) {
        const remaining = remainingRewardIndices(node);
        node.randomIndex = remaining[Math.floor((0, random_1.random)(s) * remaining.length)];
    }
}
function chooseEndlessReward(s, wave, _legacyIndex) {
    const node = rewardNode(s, wave);
    prepareEndlessReward(s, wave);
    const index = node.randomIndex;
    if (node.format === 'stop-and-open') {
        (0, save_1.requireRule)(node.drawing && !node.opened.includes(index), '这份奖励已经领取');
        node.opened.push(index);
        node.drawing = false;
        node.closed = node.opened.length === 5;
        node.chosen ?? (node.chosen = index);
        s.run.rewardLedger.push({ wave, source: 'choice', index, grant: (0, save_1.copy)(node.choices[index]) });
    }
    else {
        node.chosen = index;
        s.run.rewardLedger.push({ wave, source: 'choice', grant: (0, save_1.copy)(node.choices[index]) });
    }
    return (0, save_1.copy)(node.choices[index]);
}
function buyEndlessReward(s, wave, all = false) {
    const node = rewardNode(s, wave);
    (0, save_1.requireRule)(node.format === 'stop-and-open' && !node.drawing && node.opened.length > 0, '请先暂停揭晓当前奖励');
    const cost = (0, economy_1.goldAmount)(s, rewardPrice(node, all));
    (0, save_1.requireRule)(s.gold >= cost, '金币不足');
    s.gold -= cost;
    node.spentGold += cost;
    const remaining = remainingRewardIndices(node);
    if (all) {
        const grants = remaining.map(index => { node.opened.push(index); const grant = (0, save_1.copy)(node.choices[index]); s.run.rewardLedger.push({ wave, source: 'choice', index, grant }); return grant; });
        node.closed = true;
        return grants;
    }
    node.randomIndex = remaining[Math.floor((0, random_1.random)(s) * remaining.length)];
    node.drawing = true;
    return [];
}
function closeEndlessReward(s, wave) {
    const node = rewardNode(s, wave);
    (0, save_1.requireRule)(node.format === 'stop-and-open' && !node.drawing, '请先暂停揭晓已开始的奖励');
    node.closed = true;
}
function grantPermanent(s, g, materials, books) {
    if (g.kind === 'gold')
        return g.amount;
    if (g.kind === 'material') {
        s.materials[g.material] += g.amount;
        materials[g.material] = (materials[g.material] ?? 0) + g.amount;
    }
    else if (g.kind === 'bookPack') {
        (0, rewardPacks_1.applyReward)(s, g);
    }
    else {
        s.skillBooks ?? (s.skillBooks = {});
        s.skillBooks[g.skillId] = (s.skillBooks[g.skillId] ?? 0) + g.amount;
        books[g.skillId] = (books[g.skillId] ?? 0) + g.amount;
    }
    return 0;
}
function carryTurtle(s, id) {
    var _a;
    const r = prototypeRun(s), u = r.units[id];
    (0, save_1.requireRule)(u, '找不到待带回伙伴');
    if (u.savedId) {
        (0, save_1.requireRule)(s.collection[u.savedId], '该伙伴已被整理');
        return s.collection[u.savedId];
    }
    (0, save_1.requireRule)(pendingTakeaways(s).some(x => x.id === id), '这只龟不是通关时的有效新伙伴');
    (0, save_1.requireRule)(Object.keys(s.collection).length < prototypeConfig_1.PROTOTYPE.capacity, '收藏已满五十只，请先整理或放弃新伙伴');
    (0, save_1.requireRule)(!s.collection[u.turtle.id] && !s.history[u.turtle.id], '该个体档案已存在');
    const t = (0, save_1.copy)(u.turtle);
    t.locked = false;
    s.collection[t.id] = t;
    u.savedId = t.id;
    u.sources = [t.id];
    (_a = s.results[r.id]).broughtIds ?? (_a.broughtIds = []);
    s.results[r.id].broughtIds.push(t.id);
    return t;
}
function discardTakeaway(s, id) {
    const u = pendingTakeaways(s).find(u => u.id === id);
    (0, save_1.requireRule)(u, '找不到待整理的新伙伴');
    u.removed = 'discard';
    u.slot = null;
    delete u.benchSlot;
}
function settlePrototype(s, r, victory, now) {
    if (s.results[r.id])
        return s.results[r.id];
    (0, save_1.requireRule)(!r.rewardNodes?.some(hasPendingReward), '请先揭晓本波随机奖励');
    (0, progression_1.discoverBattle)(s, r.battle);
    const endless = r.mode === 'endless', first = !endless && victory && !s.cleared.includes(r.levelId);
    const materials = {}, books = {};
    let baseGold = r.goldEarned + (!endless && victory ? (0, economy_1.goldAmount)(s, data_1.ECONOMY.clearGold) : 0);
    const stages = [];
    for (const item of r.rewardLedger ?? []) {
        baseGold += grantPermanent(s, item.grant, materials, books);
        if (item.source === 'stage') {
            let row = stages.find(x => x.wave === item.wave);
            if (!row) {
                row = { wave: item.wave, grants: [] };
                stages.push(row);
            }
            row.grants.push((0, save_1.copy)(item.grant));
        }
    }
    if (first) {
        const material = r.levelId === 0 ? 'health' : r.levelId === 4 ? 'growth' : 'attack';
        grantPermanent(s, { kind: 'material', material, amount: 1 }, materials, books);
    }
    if (!endless && victory) {
        const material = ['attack', 'health', 'defense', 'attack', 'growth'][r.levelId % 5];
        grantPermanent(s, { kind: 'material', material, amount: 1 }, materials, books);
        const loot = (0, rewardBalance_1.campaignLoot)(s, r.levelId, 'chapter-' + r.id, now);
        for (const g of loot.grants)
            baseGold += grantPermanent(s, g, materials, books);
        const mail = (0, mail_1.sendSystemMail)(s, 'chapter-pets:' + r.id, '第' + (r.levelId + 1) + '关 · 伙伴奖励', '本次通关获得随机4–5技能伙伴。背包满时可保留邮件，整理后领取。', [], now);
        mail.pets = loot.pets;
    }
    if (endless && (!s.endlessBest || r.wave > s.endlessBest.waves))
        s.endlessBest = { waves: r.wave, at: now, team: (0, exports.currentUnits)(r).filter(u => u.slot !== null).map(u => (0, save_1.copy)(u.turtle)) };
    const result = { runId: r.id, mode: r.mode, levelId: r.levelId, victory, waves: r.wave, baseGold,
        firstClearGold: first ? (0, economy_1.goldAmount)(s, data_1.ECONOMY.firstClearGold) : 0, combatSeconds: r.combatSeconds, at: now, doubled: false, materials, skillBooks: books, stages, broughtIds: [],
        ...(endless ? { bestWave: s.endlessBest?.waves ?? 0 } : {}), ...(r.contributions ? { contributions: (0, save_1.copy)(r.contributions) } : {}) };
    if (s.livingVersion) {
        (0, development_2.grantExperience)(s, r.usedSources, (!endless && victory ? 50 : 0));
    }
    if (endless)
        (0, endlessRewards_1.grantDailyEndlessRewards)(s, r.wave, now);
    (0, community_1.finishLoans)(s, r.id);
    s.gold += baseGold + result.firstClearGold;
    s.results[r.id] = result;
    r.phase = 'result';
    delete r.battle;
    delete r.resumeAfterReveal;
    r.recruitAvailable = false;
    r.recruitCandidates = [];
    if (first) {
        s.cleared.push(r.levelId);
        s.unlockedLevel = Math.min(data_1.LEVELS.length - 1, Math.max(s.unlockedLevel, r.levelId + 1));
    }
    if (!endless && victory && r.levelId === 0)
        s.tutorialDone = true;
    for (const u of pendingTakeaways(s)) {
        if (Object.keys(s.collection).length >= prototypeConfig_1.PROTOTYPE.capacity)
            break;
        carryTurtle(s, u.id);
    }
    return result;
}
function startOutsideFusion(s, now, aId, bId) {
    checkOutsideReady(s);
    (0, save_1.requireRule)(pendingTakeaways(s).length === 0, '请先整理上局伙伴');
    enablePrototype(s);
    const a = s.collection[aId], b = s.collection[bId];
    (0, save_1.requireRule)(a && b && aId !== bId, '请选择两只不同的收藏伙伴');
    (0, community_1.assertAssetMovable)(s, aId);
    (0, community_1.assertAssetMovable)(s, bId);
    (0, save_1.requireRule)(!a.locked && !b.locked, '请先解锁参与合成的收藏伙伴');
    const id = allocate(s, 'outside'), candidate = (0, fusion_1.generateFusion)(s, a, b, allocate(s, 't'), now);
    const event = { id, rule: prototypeConfig_1.PROTOTYPE.outsideFusionRule, inputIds: [aId, bId], parents: [(0, save_1.copy)(a), (0, save_1.copy)(b)], candidate, revealed: false, probabilityVersion: fusion_1.FUSION_VERSION };
    s.outsideFusion = event;
    return event;
}
function keepOutsideFusion(s, choice) {
    const event = s.outsideFusion;
    (0, save_1.requireRule)(event && event.revealed, '请先完整揭晓合成结果');
    (0, save_1.requireRule)(['A', 'B', 'C'].includes(choice), '请选择留下 A、B 或 C');
    (0, save_1.requireRule)(event.inputIds.every(id => !!s.collection[id]), '合成亲本资料丢失');
    const keeper = (0, save_1.copy)(choice === 'C' ? event.candidate : event.parents[choice === 'A' ? 0 : 1]);
    for (const id of event.inputIds)
        delete s.collection[id];
    s.collection[keeper.id] = keeper;
    delete s.outsideFusion;
    return keeper;
}
function releaseCollected(s, id) {
    checkOutsideReady(s);
    const t = s.collection[id];
    (0, save_1.requireRule)(t && !t.locked, '请先解锁要放弃的伙伴');
    (0, save_1.requireRule)(Object.keys(s.collection).length > 1, '至少保留一位伙伴');
    (0, community_1.assertAssetMovable)(s, id);
    delete s.collection[id];
}
function startPrototypeRun(s, now, levelId, selected, mode, generate) { const r = startLegacyPrototypeRun(s, now, levelId, selected, mode, generate); (0, expeditionRun_1.initializeExpeditionRun)(s, r); return r; }
