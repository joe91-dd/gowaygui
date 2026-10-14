"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCommunity = validateCommunity;
const placement_1 = require("./placement");
const data_1 = require("./data");
const battleValidation_1 = require("./battleValidation");
function validateCommunity(s, pet) {
    const c = s.community;
    if (c === undefined)
        return;
    const ok = (condition, message) => { if (!condition)
        throw new Error(`海岛广场存档损坏：${message}`); };
    const n = (x, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
    const strings = (x, max = 10000) => Array.isArray(x) && x.length <= max && x.every(v => typeof v === 'string') && new Set(x).size === x.length;
    ok(c.version === 1 && c.playerId === 'local-player' && typeof c.name === 'string' && c.name.length >= 1 && c.name.length <= 16, '账号');
    ok(c.aiPlayers && typeof c.aiPlayers === 'object' && Object.keys(c.aiPlayers).length === 8, 'AI岛主');
    const owners = new Set(['local-player', ...Object.keys(c.aiPlayers)]), bodies = new Set(Object.keys(s.collection));
    for (const [key, a] of Object.entries(c.aiPlayers)) {
        ok(a.id === key && a.ai === true && typeof a.name === 'string' && n(a.gold) && a.pets && a.books, 'AI资料');
        for (const [id, t] of Object.entries(a.pets)) {
            pet(t);
            ok(t.id === id && !bodies.has(id), '本体重复');
            bodies.add(id);
        }
        for (const [key, count] of Object.entries(a.books))
            ok(!!data_1.SKILL_BY_ID[key] && n(count), 'AI技能书');
        ok(strings(a.assists, 3), 'AI援助栏');
    }
    for (const list of [c.friends, c.blocked])
        ok(strings(list, 8) && list.every(id => c.aiPlayers[id]), '好友关系');
    ok(strings(c.assists, 3) && c.assists.every(id => s.collection[id]), '援助宠物');
    ok(strings(c.hiddenPets) && typeof c.hideRankings === 'boolean', '上榜设置');
    ok(strings(c.arenaOrder, 9) && c.arenaOrder.length === 9 && c.arenaOrder.every(id => owners.has(id)), '竞技排行');
    ok(strings(c.arenaDefense, 5) && strings(c.arenaAttack, 5), '竞技阵容');
    ok(c.daily && /^\d{4}-\d{2}-\d{2}$/.test(c.daily.day) && n(c.daily.borrowed, 0, 5) && n(c.daily.listed, 0, 5) && Object.values(c.daily.petRentals).every(v => n(v, 0, 5)), '每日租赁次数');
    ok(Array.isArray(c.messages) && c.messages.length <= 200, '聊天记录');
    for (const m of c.messages)
        ok(typeof m.id === 'string' && owners.has(m.from) && (owners.has(m.to) || m.to === 'world') && typeof m.text === 'string' && m.text.length >= 1 && m.text.length <= 120 && n(m.at), '聊天内容');
    ok(Array.isArray(c.listings) && new Set(c.listings.map(l => l.id)).size === c.listings.length, '交易条目');
    for (const l of c.listings) {
        ok(owners.has(l.ownerId) && n(l.price, 1, s.economyVersion ? 100000000000 : 100000000) && n(l.createdAt) && ['listed', 'sold', 'cancelled'].includes(l.status) && ['pet', 'book', 'rental'].includes(l.kind), '交易资料');
        if (l.kind === 'book')
            ok(l.skillId && data_1.SKILL_BY_ID[l.skillId], '交易技能书');
        else {
            ok(l.pet, '交易宠物缺失');
            pet(l.pet);
            if (l.kind === 'pet' && l.status === 'listed') {
                ok(!bodies.has(l.pet.id), '上架宠物未托管');
                bodies.add(l.pet.id);
            }
        }
    }
    ok(Array.isArray(c.loans) && new Set(c.loans.map(l => l.id)).size === c.loans.length, '借用清单');
    for (const l of c.loans) {
        pet(l.turtle);
        ok((owners.has(l.ownerId) || l.kind === 'rental' && typeof l.ownerId === 'string' && l.ownerId.length <= 160 && typeof l.serverListingId === 'string' && /^[a-f0-9-]{36}$/.test(l.serverListingId)) && typeof l.originalId === 'string' && l.id === l.turtle.id && n(l.createdAt) && l.expiresAt === l.createdAt + 3600000 && typeof l.finished === 'boolean' && ['friend', 'rental'].includes(l.kind) && !s.collection[l.turtle.id], '借用归属');
    }
    ok(Array.isArray(c.receipts), '交易账本');
    for (const r of c.receipts) {
        const denomination = r.taxDenomination ?? 1;
        ok((denomination === 1 || denomination === 1000 && s.economyVersion === 2 || denomination === 100 && s.economyVersion === 3) && typeof r.id === 'string' && owners.has(r.otherId) && n(r.gross, 1) && r.tax === Math.ceil(r.gross / denomination * .2) * denomination && r.net === r.gross - r.tax && n(r.at), '交易税费');
    }
    ok(n(c.scoreCounter) && c.scoreArrivals, '评分先后');
    for (const row of Object.values(c.scoreArrivals))
        ok(Number.isFinite(row.score) && row.score >= 0 && row.score <= 100 && n(row.order, 1, c.scoreCounter) && n(row.at), '评分记录');
    ok(!(c.raid && !c.raid.settled && c.arena && !c.arena.settled), '同时进行两场挑战');
    if (c.raid) {
        const r = c.raid;
        const map = r.battle ? (0, data_1.battleMap)(r.battle) : (r.mapVersion === 6 ? data_1.BATTLE_MAPS : r.mapVersion === 5 ? data_1.LEGACY_PAINTED_MAPS : data_1.LEGACY_EXPANDED_MAPS)[r.tier === 3 ? 55 : 51 + r.tier];
        ok(n(r.tier, 0, 3) && n(r.wave, 0, r.expeditionVersion ? 20 : 10) && Number.isFinite(r.seconds) && r.seconds >= 0 && n(r.coreHealth, 0, 20) && r.members.length === (r.expeditionVersion ? 2 : 5), '副本');
        ok(r.fallen === undefined || strings(r.fallen, 25), '副本倒下状态');
        ok(!(0, placement_1.fieldIssue)(map, r.members.map((m, i) => ({ slot: m.station ?? i, placement: m.placement }))), '副本自由落点非法');
        const stations = r.members.map((m, i) => m.station ?? i);
        ok(stations.every(slot => n(slot, 0, map.slots.length - 1)) && new Set(stations).size === r.members.length, '副本站位');
        for (const m of r.members)
            ok(m.moveReadyTick === undefined || n(m.moveReadyTick, 0, (r.battle?.tick ?? 0) + 160) || r.phase !== 'combat' && n(m.moveReadyTick), '副本移动冷却');
        for (const m of r.members) {
            ok(owners.has(m.ownerId) && m.roster.length === 5 && new Set(m.roster.map(p => p.id)).size === 5 && (!m.activeId || m.roster.some(p => p.id === m.activeId)), '副本队伍');
            m.roster.forEach(p => { pet(p.turtle); ok(owners.has(p.ownerId) && typeof p.originalId === 'string', '副本本体来源'); });
        }
        ok(['prep', 'between', 'combat', 'result'].includes(r.phase) && typeof r.settled === 'boolean' && (r.phase === 'result') === r.settled, '副本阶段');
        if (r.phase === 'combat') {
            ok(r.battle && r.battle.encounter === 'raid', '副本战斗');
            (0, battleValidation_1.validateBattle)(r.battle);
        }
        else if (r.expeditionVersion && r.phase === 'prep') {
            ok(r.battle?.tick === 0, '副本备战');
            (0, battleValidation_1.validateBattle)(r.battle);
        }
        else
            ok(r.battle === undefined, '副本战斗阶段不一致');
    }
    if (c.arena) {
        const a = c.arena;
        ok(owners.has(a.opponentId) && a.attackers.length === 5 && a.defenders.length === 5 && a.movers.length === 5 && n(a.passed, 0, 5) && Number.isFinite(a.seconds) && a.seconds >= 0 && ['combat', 'result'].includes(a.phase) && typeof a.settled === 'boolean', '竞技场');
        for (const u of a.attackers.concat(a.defenders))
            ok(typeof u.id === 'string' && Number.isFinite(u.maxHp) && u.maxHp > 0 && Number.isFinite(u.hp) && u.hp >= 0 && u.hp <= u.maxHp && u.skills.length <= 12 && u.skills.every(id => data_1.SKILL_BY_ID[id]), '竞技场伙伴');
        ok(a.battle && n(a.battle.tick, 0, 2400) && a.battle.duelUnits === undefined && a.battle.duelTeamA === undefined, '竞技场帧');
    }
}
