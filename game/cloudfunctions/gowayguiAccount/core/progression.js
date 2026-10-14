"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arenaLocked = exports.arenaWeeklyGrants = exports.arenaTierGrants = exports.arenaSettlementAt = exports.arenaTier = exports.arenaResetStars = exports.arenaRankLabel = exports.ARENA_TIERS = exports.arenaWeek = exports.arenaDay = void 0;
exports.progression = progression;
exports.grantChest = grantChest;
exports.claimChest = claimChest;
exports.discoverBattle = discoverBattle;
exports.syncProgression = syncProgression;
exports.recordArena = recordArena;
exports.claimArenaTier = claimArenaTier;
exports.claimCodex = claimCodex;
exports.validateProgression = validateProgression;
const runtimeQuery_1 = require("../platform/runtimeQuery");
const bookPolicy_1 = require("./bookPolicy");
const random_1 = require("./random");
const data_1 = require("./data");
const bossCatalog_1 = require("./bossCatalog");
const economy_1 = require("./economy");
const rewardPacks_1 = require("./rewardPacks");
const mail_1 = require("./mail");
const DAY = 86400000, OFFSET = 8 * 3600000;
const arenaDay = (now) => Math.floor((now + OFFSET) / DAY);
exports.arenaDay = arenaDay;
const arenaWeek = (now) => { const day = (0, exports.arenaDay)(now); return day - ((day + 3) % 7); };
exports.arenaWeek = arenaWeek;
exports.ARENA_TIERS = [{ name: '青铜', min: 0 }, { name: '白银', min: 9 }, { name: '黄金', min: 18 }, { name: '铂金', min: 27 }, { name: '钻石', min: 36 }, { name: '王者', min: 45 }];
const arenaRankLabel = (stars) => stars >= 45 ? '王者 ' + (stars - 45) + ' ★' : exports.ARENA_TIERS[Math.floor(Math.max(0, stars) / 9)].name + ' ' + (3 - Math.floor(Math.max(0, stars) % 9 / 3)) + ' · ' + '★'.repeat(Math.max(0, stars) % 3) + '☆'.repeat(3 - Math.max(0, stars) % 3);
exports.arenaRankLabel = arenaRankLabel;
const arenaResetStars = (stars) => stars >= 45 ? 27 : Math.max(0, stars - 18);
exports.arenaResetStars = arenaResetStars;
const arenaTier = (rating) => exports.ARENA_TIERS.reduce((n, t, i) => rating >= t.min ? i : n, 0);
exports.arenaTier = arenaTier;
const arenaSettlementAt = (now) => ((0, exports.arenaWeek)(now) + 6) * DAY - OFFSET + 22 * 3600000;
exports.arenaSettlementAt = arenaSettlementAt;
const arenaTierGrants = (s, tier) => [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, [250, 500, 1000, 1750, 2750, 4000][tier]) }, { kind: 'material', material: 'attack', amount: 5 + tier * 3 }, { kind: 'bookPack', grade: 'common', amount: [1, 2, 4, 6, 8, 16][tier] }];
exports.arenaTierGrants = arenaTierGrants;
const arenaWeeklyGrants = (s, tier) => [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, [800, 1500, 3000, 5000, 8000, 12000][tier]) }, { kind: 'material', material: 'growth', amount: 6 + tier * 4 }, { kind: 'bookPack', grade: 'common', amount: 5 + tier * 2 }, ...(tier >= 1 ? [{ kind: 'bookPack', grade: 'active', amount: tier }] : [])];
exports.arenaWeeklyGrants = arenaWeeklyGrants;
const arenaLocked = (now) => {
    if (typeof location !== 'undefined' && (0, runtimeQuery_1.runtimeQuery)().get('all-modes') === '1')
        return false;
    return (0, exports.arenaDay)(now) - (0, exports.arenaWeek)(now) === 6 && (now + OFFSET) % DAY >= 22 * 3600000;
};
exports.arenaLocked = arenaLocked;
function progression(s) {
    const p = s.progression ?? (s.progression = { version: 1, skills: [], bosses: [], codexClaims: [], chests: [], arena: { starVersion: 2, week: (0, exports.arenaWeek)(s.clockHighWater), rating: 0, best: 0, games: 0, lastDaily: (0, exports.arenaDay)(s.clockHighWater) - 1, weeklySettled: false, tierClaims: [] } });
    if (p.arena.starVersion !== 2) {
        const old = [0, 120, 300, 550, 850, 1200], convert = (value) => { const tier = old.reduce((n, min, i) => value >= min ? i : n, 0); return tier * 9 + (tier === 5 ? Math.floor((value - 1200) / 48) : Math.min(8, Math.floor((value - old[tier]) / (old[tier + 1] - old[tier]) * 9))); };
        p.arena.rating = convert(p.arena.rating);
        p.arena.best = convert(p.arena.best);
        p.arena.starVersion = 2;
    }
    return p;
}
function grantChest(s, id, title, stars, grants, at = s.clockHighWater) {
    const p = progression(s), existing = p.chests.find(c => c.id === id);
    if (existing)
        return existing;
    const chest = { id, title, stars, grants, at, claimed: false };
    p.chests.push(chest);
    return chest;
}
function claimChest(s, id) { const c = progression(s).chests.find(c => c.id === id); if (!c || c.claimed)
    throw Error('宝箱不存在或已领取'); const pets = (c.pets ?? []).filter(t => !s.collection[t.id]); if (Object.keys(s.collection).length + pets.length > s.capacity)
    throw Error('伙伴背包已满，请整理后领取；奖励已保存在宝箱中'); for (const t of pets)
    s.collection[t.id] = JSON.parse(JSON.stringify(t)); for (const g of c.grants)
    (0, rewardPacks_1.applyReward)(s, g); c.claimed = true; }
function discoverBattle(s, b) {
    if (!b)
        return;
    const p = progression(s);
    for (const id of b.history?.bossIds ?? [])
        if (!p.bosses.includes(id))
            p.bosses.push(id);
    const defeats = [...b.enemies.filter(e => e.bossId && !e.alive && e.hp <= 0), ...(b.history?.defeats ?? [])];
    for (const e of defeats)
        if (e.bossId) {
            if (!p.bosses.includes(e.bossId))
                p.bosses.push(e.bossId);
            if (b.faunaVersion !== 1 || b.mode === 'endless' && b.encounter !== 'raid')
                continue;
            const boss = bossCatalog_1.BOSSES.find(v => v.id === e.bossId);
            if (!boss)
                continue;
            const key = (b.encounter === 'raid' ? s.community?.raid?.id : s.run?.id) + ':' + b.wave + ':' + e.id;
            p.bossDropClaims ?? (p.bossDropClaims = []);
            if (p.bossDropClaims.includes(key))
                continue;
            p.bossDropClaims.push(key);
            const hash = (text) => { let n = 2166136261; for (const c of text)
                n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
            const mat = ['attack', 'health', 'defense', 'growth'][hash(boss.id) % 4];
            s.gold += (0, economy_1.goldAmount)(s, 10 + boss.tier * 6);
            s.materials[mat] += 1 + Math.floor(boss.tier / 2);
            if (boss.dropBook && (0, bookPolicy_1.bookAllowed)(boss.dropBook, b.encounter === 'raid' ? 'raid' : b.mode === 'endless' ? 'endless' : 'chapter') && hash(key + ':loot') / 4294967296 < (0, bossCatalog_1.bossDropChance)(boss.tier)) {
                s.skillBooks ?? (s.skillBooks = {});
                s.skillBooks[boss.dropBook] = (s.skillBooks[boss.dropBook] ?? 0) + 1;
            }
        }
}
function syncProgression(s, now) {
    const p = progression(s);
    const skills = new Set(p.skills);
    for (const t of Object.values(s.collection))
        for (const id of t.skills)
            skills.add(id);
    for (const [id, count] of Object.entries(s.skillBooks ?? {}))
        if (count)
            skills.add(id);
    if (s.run)
        for (const u of Object.values(s.run.units))
            for (const id of u.turtle.skills)
                skills.add(id);
    p.skills = Array.from(skills);
    discoverBattle(s, s.run?.battle);
    discoverBattle(s, s.community?.raid?.battle);
    const a = p.arena, week = (0, exports.arenaWeek)(now), day = (0, exports.arenaDay)(now), todayCut = day * DAY - OFFSET + 22 * 3600000, lastCut = now >= todayCut ? day : day - 1;
    const awardWeekly = () => { if (a.games > 0 && !a.weeklySettled) {
        const tier = (0, exports.arenaTier)(a.rating), at = (a.week + 6) * DAY - OFFSET + 22 * 3600000, grants = (0, exports.arenaWeeklyGrants)(s, tier);
        if (s.livingVersion)
            (0, mail_1.sendSystemMail)(s, 'arena-week:' + a.week, '竞技场周结算 · ' + exports.ARENA_TIERS[tier].name, '本周赛季已经结算。感谢你与伙伴并肩作战，附件为本周最终段位奖励。', grants, at, 'arena');
        else
            grantChest(s, 'arena-week:' + a.week, '赛季结算 · ' + exports.ARENA_TIERS[tier].name, Math.min(3, 1 + Math.floor(tier / 2)), grants, at);
    } a.weeklySettled = true; };
    // Catch up only the latest eligible daily reward, never fabricate days with no participation.
    const eligibleCut = Math.min(lastCut, a.week + 6);
    if (eligibleCut > a.lastDaily) {
        if (a.games > 0) {
            const rank = (s.community?.arenaOrder.indexOf('local-player') ?? 8) + 1;
            grantChest(s, 'arena-day:' + eligibleCut, '每日排名 · 第' + rank + '名', 1, [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, Math.max(40, 160 - rank * 12)) }], eligibleCut * DAY - OFFSET + 22 * 3600000);
        }
        a.lastDaily = lastCut;
    }
    if (week > a.week) {
        awardWeekly();
        a.week = week;
        a.rating = (0, exports.arenaResetStars)(a.rating);
        a.best = a.rating;
        a.games = 0;
        a.weeklySettled = false;
        a.tierClaims = [];
        if (s.community) {
            s.community.arenaOrder = s.community.arenaOrder.filter(id => id !== 'local-player').concat('local-player');
        }
    }
    if ((0, exports.arenaLocked)(now))
        awardWeekly();
}
function recordArena(s, victory, draw) { const a = progression(s).arena; a.games++; a.rating = Math.max(0, a.rating + (draw ? 0 : victory ? 1 : -1)); a.best = Math.max(a.best, a.rating); if (victory && !draw && (0, random_1.random)(s) < .35)
    (0, rewardPacks_1.applyReward)(s, { kind: 'book', skillId: (0, bookPolicy_1.policyBook)(s, 'elite'), amount: 1 }); }
function claimArenaTier(s, tier) { const a = progression(s).arena; if (!Number.isInteger(tier) || tier < 0 || tier >= exports.ARENA_TIERS.length || a.best < exports.ARENA_TIERS[tier].min || a.tierClaims.includes(tier) || a.games === 0)
    throw Error('尚未达到该段位，或奖励已经领取'); a.tierClaims.push(tier); const c = grantChest(s, `arena-tier:${a.week}:${tier}`, exports.ARENA_TIERS[tier].name + '段位宝箱', Math.min(3, 1 + Math.floor(tier / 2)), (0, exports.arenaTierGrants)(s, tier)); claimChest(s, c.id); }
function claimCodex(s, kind, id) { const p = progression(s), key = kind + ':' + id, list = kind === 'skill' ? p.skills : p.bosses; if (!list.includes(id) || p.codexClaims.includes(key))
    throw Error('尚未解锁或已领取'); const skill = data_1.SKILL_BY_ID[id], boss = bossCatalog_1.BOSSES.find(b => b.id === id); if (kind === 'skill' ? !skill : !boss)
    throw Error('图鉴条目不存在'); const amount = (0, economy_1.goldAmount)(s, kind === 'boss' ? 100 + (boss?.tier ?? 0) * 50 : (skill?.active || skill?.specialization) ? 60 : skill?.precious ? 40 : 20); p.codexClaims.push(key); s.gold += amount; return amount; }
function validateProgression(s) {
    const p = s.progression;
    if (!p)
        return;
    const check = (ok) => { if (!ok)
        throw Error('成就与赛季资料损坏'); }, integer = (n) => Number.isSafeInteger(n) && n >= 0;
    check(p.version === 1);
    if (p.bossDropClaims)
        check(Array.isArray(p.bossDropClaims) && new Set(p.bossDropClaims).size === p.bossDropClaims.length && p.bossDropClaims.every(x => typeof x === 'string'));
    for (const list of [p.skills, p.bosses, p.codexClaims])
        check(Array.isArray(list) && new Set(list).size === list.length && list.every(x => typeof x === 'string'));
    check(p.skills.every(id => data_1.SKILLS.some(x => x.id === id)) && p.bosses.every(id => bossCatalog_1.BOSSES.some(b => b.id === id)));
    check(Array.isArray(p.chests) && new Set(p.chests.map(c => c.id)).size === p.chests.length);
    if (p.endlessDaily) {
        check(p.endlessDaily.bestWave === undefined || integer(p.endlessDaily.bestWave));
        check(/^\d{4}-\d{2}-\d{2}$/.test(p.endlessDaily.day) && Array.isArray(p.endlessDaily.waves) && new Set(p.endlessDaily.waves).size === p.endlessDaily.waves.length && p.endlessDaily.waves.every(n => Number.isSafeInteger(n) && n >= 5));
    }
    for (const c of p.chests) {
        check(typeof c.id === 'string' && typeof c.title === 'string' && integer(c.stars) && c.stars <= 3 && integer(c.at) && typeof c.claimed === 'boolean' && Array.isArray(c.grants));
        for (const g of c.grants)
            check((0, rewardPacks_1.validReward)(g));
    }
    const a = p.arena;
    check(a.starVersion === undefined || a.starVersion === 2);
    check(a && [a.rating, a.best, a.games].every(integer) && Number.isSafeInteger(a.week) && Number.isSafeInteger(a.lastDaily) && typeof a.weeklySettled === 'boolean' && Array.isArray(a.tierClaims) && new Set(a.tierClaims).size === a.tierClaims.length && a.tierClaims.every(n => integer(n) && n < 6));
}
