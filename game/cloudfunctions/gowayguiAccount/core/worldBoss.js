"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORLD_RANK_TIERS = exports.worldTierGrants = exports.WORLD_DAMAGE_TIERS = exports.WORLD_BOSSES = exports.worldBossUnlocked = exports.WORLD_BOSS_UNLOCK_LEVEL = exports.WORLD_BOSS_ATTEMPTS = exports.WORLD_BOSS_SECONDS = exports.WORLD_BOSS_MAP = void 0;
exports.worldRankGrants = worldRankGrants;
exports.worldBossDay = worldBossDay;
exports.createWorldBossFight = createWorldBossFight;
exports.stepWorldBoss = stepWorldBoss;
exports.worldBossAction = worldBossAction;
const deterministicMath_1 = require("./deterministicMath");
const expeditionRules_1 = require("./expeditionRules");
const battle_1 = require("./battle");
const data_1 = require("./data");
const placement_1 = require("./placement");
const challengeRoster_1 = require("./challengeRoster");
exports.WORLD_BOSS_MAP = 56, exports.WORLD_BOSS_SECONDS = 90, exports.WORLD_BOSS_ATTEMPTS = Infinity;
exports.WORLD_BOSS_UNLOCK_LEVEL = 5;
const worldBossUnlocked = (cleared) => cleared.includes(exports.WORLD_BOSS_UNLOCK_LEVEL - 1);
exports.worldBossUnlocked = worldBossUnlocked;
exports.WORLD_BOSSES = [
    { name: '负岳玄鳌', art: 'world-boss-leviathan', subtitle: '负岳崩岩 · 圆形地刺', counter: '低头蓄力后掀起岩刺。离开圆形落点，物法混合输出更稳定。', abilityId: 'raid-h01', armor: 38, resist: 38, attack: 26, color: '#51C8D8' },
    { name: '万触渊主', art: 'world-boss-crab', subtitle: '万触鞭挞 · 直线横贯', counter: '触手朝锁定方向猛甩。调离长条预警，物理输出更有效。', abilityId: 'raid-h02', armor: 18, resist: 75, attack: 27, color: '#9982D5' },
    { name: '焚潮巨猿', art: 'world-boss-kraken', subtitle: '焚潮震击 · 圆形冲击', counter: '双臂支撑，低头蓄力后向前撞击。提前移出落点，法师适合对付熔甲。', abilityId: 'raid-h03', armor: 75, resist: 18, attack: 29, color: '#E67B51' },
    { name: '星冠狮鹫', art: 'world-boss-tortoise', subtitle: '星冠寒息 · 扇形喷吐', counter: '抬首展翼后喷出寒息。向扇形两侧转移，避免正面聚集。', abilityId: 'raid-h04', armor: 55, resist: 45, attack: 25, color: '#70C6AC' },
];
exports.WORLD_DAMAGE_TIERS = [2000, 4000, 6000, 9000, 12000, 16000, 21000, 27000, 35000, 45000];
const worldTierGrants = (tier) => [
    { kind: 'gold', amount: [8000, 12000, 18000, 25000, 34000, 45000, 60000, 80000, 105000, 140000][tier] },
    { kind: 'material', material: ['attack', 'health', 'defense', 'growth'][tier % 4], amount: 1 + Math.floor(tier / 2) },
    { kind: 'bookPack', grade: tier >= 8 ? 'active' : 'common', amount: tier >= 5 && tier <= 7 ? 2 : 1 },
];
exports.worldTierGrants = worldTierGrants;
exports.WORLD_RANK_TIERS = [
    { max: 1, name: '第 1 名', gold: 200000, growth: 10, books: 24 },
    { max: 3, name: '第 2–3 名', gold: 150000, growth: 8, books: 12 },
    { max: 10, name: '第 4–10 名', gold: 100000, growth: 6, books: 6 },
    { max: 50, name: '第 11–50 名', gold: 60000, growth: 4, books: 3 },
    { max: 100, name: '第 51–100 名', gold: 40000, growth: 2, books: 1 },
    { max: Number.MAX_SAFE_INTEGER, name: '其余参与者', gold: 20000, growth: 1, books: 0 },
];
function worldRankGrants(rank) { const p = exports.WORLD_RANK_TIERS.find(p => rank <= p.max); return [{ kind: 'gold', amount: p.gold }, { kind: 'material', material: 'growth', amount: p.growth }, ...(p.books ? [{ kind: 'bookPack', grade: 'common', amount: p.books }] : [])]; }
const DAY = 86400000, OFFSET = 8 * 3600000;
function worldBossDay(now) { const number = Math.floor((now + OFFSET) / DAY), start = number * DAY - OFFSET, closes = start + 22 * 3600000; return { key: new Date(start + OFFSET).toISOString().slice(0, 10), number, bossIndex: ((number % exports.WORLD_BOSSES.length) + exports.WORLD_BOSSES.length) % exports.WORLD_BOSSES.length, closes, next: start + DAY, canStart: now >= start && now + exports.WORLD_BOSS_SECONDS * 1000 <= closes }; }
function pathLength(route) { return route.slice(1).reduce((sum, p, i) => sum + (0, deterministicMath_1.simulationHypot)(p.x - route[i].x, p.z - route[i].z), 0); }
function pathPoint(route, distance) { let left = Math.max(0, distance); for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], length = (0, deterministicMath_1.simulationHypot)(b.x - a.x, b.z - a.z);
    if (left <= length) {
        const f = length < 1e-6 ? 0 : left / length;
        return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    left -= length;
} return { ...route[route.length - 1] }; }
function createWorldBossFight(id, day, index, roster, now, placements) {
    const issue = (0, challengeRoster_1.challengeRosterIssue)(roster);
    if (issue)
        throw Error(issue);
    const map = { ...data_1.BATTLE_MAPS[exports.WORLD_BOSS_MAP], slots: (0, expeditionRules_1.expeditionSlots)(exports.WORLD_BOSS_MAP) }, positions = placements ?? map.slots.slice(0, 5);
    if (positions.length !== 5)
        throw Error('布阵资料无效');
    positions.forEach((p, i) => { const issue = (0, placement_1.placementIssue)(map, p, positions.filter((_, j) => j !== i)); if (issue)
        throw Error(issue); });
    const b = (0, battle_1.createBattle)(54, 1, roster.map((turtle, slot) => ({ id: turtle.id, turtle, slot, level: 1 })), { rulesVersion: '0.6', mode: 'endless', formationVersion: 2 });
    b.levelId = exports.WORLD_BOSS_MAP;
    b.route = map.route.map(p => ({ ...p }));
    b.routeLength = pathLength(b.route);
    b.routes = undefined;
    b.routeLengths = undefined;
    b.spawns = [];
    b.spawnCursor = 0;
    b.events = [];
    b.commands = [];
    b.faunaVersion = 1;
    b.stationVersion = map.stationVersion;
    b.layoutVersion = 2;
    b.autoSkills = true;
    b.units.forEach((u, i) => { const slot = map.slots.findIndex(p => (0, deterministicMath_1.simulationHypot)(p.x - positions[i].x, p.z - positions[i].z) < .01); if (slot < 0)
        throw Error('请使用世界BOSS的12个固定站位'); Object.assign(u, positions[i], { slot, placement: { ...positions[i] } }); });
    const def = exports.WORLD_BOSSES[index];
    if (!def)
        throw Error('世界首领不存在');
    const boss = { id: 'world-boss', kind: 'boss', bossId: def.abilityId, worldBossIndex: index, x: map.route[0].x, z: map.route[0].z, distance: 0, hp: 1e9, maxHp: 1e9, attack: def.attack, armor: def.armor, resist: def.resist, speed: 0, range: 3.4, interval: 2.8, leak: 0, alive: true, statuses: [], nextAttackTick: 80, actionUntilTick: 0, attackCount: 0, controlWindowUntilTick: 0, controlCount: 0, summoned: true, abilityReadyTick: 160 };
    b.enemies = [boss];
    return { id, day, bossIndex: index, startedAt: now, endsAt: now + 90000, roster: JSON.parse(JSON.stringify(roster)), battle: b, damage: 0, phase: 'combat' };
}
function stepWorldBoss(f, seconds) {
    if (f.phase !== 'combat')
        return;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 90)
        throw Error('挑战时间无效');
    let remaining = Math.min(seconds, 90 - f.battle.elapsed - f.battle.pendingSeconds);
    while (remaining > 1e-8 && f.phase === 'combat') {
        const b = f.battle, boss = b.enemies[0], dt = Math.min(.05, remaining), last = b.nextEventId - 1;
        // Heavy world bosses keep a readable, straight-through march. The progress
        // is tied to the deterministic 1,800 ticks so the boss reaches the exact
        // pearl endpoint at 90 seconds on every playback speed.
        const targetTick = Math.min(1800, b.tick + Math.floor((b.pendingSeconds + dt + 1e-9) / .05));
        boss.distance = Math.min(b.routeLength, targetTick / 1800 * b.routeLength);
        Object.assign(boss, pathPoint(b.route, boss.distance));
        (0, battle_1.stepBattle)(b, dt);
        for (const e of b.events)
            if (e.id > last && e.type === 'damage' && e.targetId === 'world-boss')
                f.damage += Math.max(0, e.amount ?? 0);
        boss.distance = Math.min(b.routeLength, b.tick / 1800 * b.routeLength);
        Object.assign(boss, pathPoint(b.route, boss.distance));
        remaining -= dt;
        if (b.tick >= 1800 || b.status !== 'fighting') {
            f.phase = 'result';
            f.finishedAt = f.startedAt + b.elapsed * 1000;
            b.status = 'won';
        }
    }
    f.damage = Math.round(f.damage * 1000) / 1000;
}
function worldBossAction(f, action, body) {
    if (f.phase !== 'combat')
        throw Error('挑战已经结束');
    const b = f.battle;
    if (action === 'operationPause' || action === 'operationResume') {
        f.operationPaused = action === 'operationPause';
        return;
    }
    if (action === 'focus') {
        if (!(0, battle_1.focusBattle)(b, body.targetId))
            throw Error('集火目标已失效');
        return;
    }
    if (action === 'settings') {
        b.autoSkills = !!body.auto;
        b.manualSkillTurtles = body.held?.filter(id => b.units.some(u => u.turtleId === id)) ?? [];
        return;
    }
    if (action === 'cast') {
        if (!body.command || !(0, battle_1.commandBattle)(b, body.command))
            throw Error('技能尚未就绪或目标不在范围内');
        return;
    }
    if (action === 'move') {
        const u = b.units.find(u => u.id === body.unitId);
        if (!u || !body.point)
            throw Error('伙伴或落点不存在');
        let p = body.point;
        if (b.formationVersion === 2) {
            const slots = (0, expeditionRules_1.expeditionSlots)(exports.WORLD_BOSS_MAP), slot = slots.map((q, i) => ({ i, d: (0, deterministicMath_1.simulationHypot)(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d)[0];
            if (slot.d > 1)
                throw Error('请放到固定站位点');
            const other = b.units.find(v => v !== u && v.slot === slot.i);
            (0, battle_1.moveBattleUnit)(b, u.id, slot.i);
            return;
        }
        const other = b.units.find(v => v !== u && (0, deterministicMath_1.simulationHypot)((v.placement ?? v).x - p.x, (v.placement ?? v).z - p.z) < .78);
        (0, battle_1.moveBattleUnit)(b, u.id, other?.slot ?? u.slot, other ? undefined : p);
        return;
    }
    throw Error('不支持的挑战操作');
}
