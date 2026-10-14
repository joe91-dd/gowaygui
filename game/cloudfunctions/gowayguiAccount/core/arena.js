"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARENA_DEFENSE_POINTS = void 0;
exports.matchArena = matchArena;
exports.startArena = startArena;
exports.deployArenaPet = deployArenaPet;
exports.setArenaAutoDeploy = setArenaAutoDeploy;
exports.withArenaPlayer = withArenaPlayer;
exports.arenaOutcome = arenaOutcome;
exports.stepArena = stepArena;
exports.validateArenaCheckpoint = validateArenaCheckpoint;
exports.finishArena = finishArena;
const deterministicMath_1 = require("./deterministicMath");
const combatTape_1 = require("./combatTape");
const economy_1 = require("./economy");
const challengeRoster_1 = require("./challengeRoster");
const mail_1 = require("./mail");
const dailyAccess_1 = require("./dailyAccess");
const sceneMigration_1 = require("./sceneMigration");
const development_1 = require("./development");
const progression_1 = require("./progression");
function matchArena(s) { const c = (0, community_1.communityOf)(s), rank = c.arenaOrder.indexOf(community_1.LOCAL_PLAYER); const candidates = c.arenaOrder.filter(id => id !== community_1.LOCAL_PLAYER && c.aiPlayers[id]).sort((a, b) => Math.abs(c.arenaOrder.indexOf(a) - rank) - Math.abs(c.arenaOrder.indexOf(b) - rank)); if (!candidates.length)
    throw Error('暂时没有合适的对手'); return candidates[(0, progression_1.progression)(s).arena.games % Math.min(3, candidates.length)]; }
const battle_1 = require("./battle");
const community_1 = require("./community");
const save_1 = require("./save");
const sceneGeometry_1 = require("./sceneGeometry");
// Both sides use the same pet stats. Put the defense close enough to the road
// for overlapping fire and support; generic PvE slots leave half the team idle.
// Healer in the middle of the lower row covers every ally, including the tank.
exports.ARENA_DEFENSE_POINTS = [[230, 103.5], [310, 166.5], [270, 103.5], [270, 166.5], [310, 103.5]].map(([x, y]) => (0, sceneGeometry_1.scenePoint)(54, x, y));
const UNDEPLOYED = Number.MAX_SAFE_INTEGER;
const AUTO_ENTRY_TICKS = 30;
function startArena(s, now, opponentId, selection, practice = false) {
    (0, community_1.initCommunity)(s, now);
    (0, community_1.ensureCommunityHome)(s);
    const c = (0, community_1.communityOf)(s), rank = c.arenaOrder.indexOf(community_1.LOCAL_PLAYER), opponentRank = c.arenaOrder.indexOf(opponentId);
    (0, save_1.requireRule)(practice || !(0, progression_1.arenaLocked)(now), '本周赛季已结算，周一开启新赛季');
    (0, save_1.requireRule)(practice || opponentRank >= 0 && opponentId !== community_1.LOCAL_PLAYER && Math.abs(rank - opponentRank) <= 3, '匹配对手需在相近排名范围');
    const pets = (0, community_1.choosePets)(s, selection, now);
    (0, save_1.requireRule)(pets.length === 5, '竞技场进攻需要五只伙伴');
    (0, save_1.requireRule)(pets.every(p => !p.loanId), '借用和租赁的龟仅可用于关卡、无尽模式；竞技场只能使用自有龟');
    const rosterIssue = (0, challengeRoster_1.challengeRosterIssue)(pets.map(p => p.turtle));
    (0, save_1.requireRule)(!rosterIssue, rosterIssue ?? '阵容不符合要求');
    const opponent = c.aiPlayers[opponentId];
    (0, save_1.requireRule)(opponent, '当前只能挑战本地AI对手');
    if (practice)
        (0, save_1.requireRule)(pets.every(p => !p.loanId), '防守仅能使用自有龟');
    const defense = practice ? pets.map(p => p.turtle) : Object.values(opponent.pets).slice(0, 5);
    (0, save_1.requireRule)(defense.length === 5, '对方防守阵容不完整');
    const battle = (0, battle_1.createBattle)(54, 1, defense.map((turtle, slot) => ({ id: `def:${turtle.id}`, turtle, slot, level: 10, placement: exports.ARENA_DEFENSE_POINTS[slot] })), { rulesVersion: '0.6', mode: 'endless', formationVersion: 2 });
    const attackers = practice ? Object.values(opponent.pets).slice(0, 5).map(turtle => ({ id: turtle.id, turtle })) : pets;
    const attack = (0, battle_1.createBattle)(54, 1, attackers.map((p, slot) => ({ id: `atk:${p.id}`, turtle: p.turtle, slot, level: 10 })), { rulesVersion: '0.6', mode: 'endless', formationVersion: 2 });
    // Arena-only endurance, calibrated for allies sharing one straight route.
    // Both teams use 1.47x (formerly 1.75x); pets, movement speed and PvE are unchanged.
    if (s.livingVersion)
        for (const u of [...attack.units, ...battle.units]) {
            u.maxHp *= 1.47;
            u.hp *= 1.47;
            for (const shield of u.shields)
                shield.amount *= 1.47;
            u.shield *= 1.47;
        }
    for (const u of [...attack.units, ...battle.units])
        if (u.role === 'stone')
            u.range *= 1.5;
    battle.arenaVersion = 1;
    battle.spawns = [];
    battle.spawnCursor = 0;
    battle.events = [];
    battle.nextEventId = 1;
    if (!practice)
        (0, dailyAccess_1.consumeAttempt)(s, 'arena', now);
    const id = `arena-${++s.idCounter}`;
    if (!practice)
        (0, community_1.reserveLoans)(s, pets, id);
    const arena = { seasonWeek: (0, progression_1.progression)(s).arena.week, ratingBefore: (0, progression_1.progression)(s).arena.rating, autoDeploy: practice, ...(practice ? { practice: true, defending: true } : {}), id, opponentId, phase: 'combat', attackers: attack.units, defenders: battle.units, movers: attack.units.map((u, i) => ({ id: u.id, distance: 0, enterTick: practice ? 1 + i * AUTO_ENTRY_TICKS : UNDEPLOYED, escaped: false })), battle, passed: 0, seconds: 0, settled: false, rankBefore: rank + 1, startedAt: now };
    battle.autoSkills = s.settings.autoSkills ?? false;
    battle.controlledUnitIds = (practice ? arena.defenders : arena.attackers).map(u => u.id);
    if (!practice)
        c.arenaAttack = [...selection];
    c.arena = arena;
    return (0, save_1.copy)(arena);
}
function deployArenaPet(a, id) {
    return (0, combatTape_1.traceCombat)(a.battle, 'deployArenaPet', [id], () => {
        (0, save_1.requireRule)(a.phase === 'combat' && !a.defending, '当前不能派出进攻伙伴');
        const u = a.attackers.find(u => u.id === id || u.turtleId === id), m = u && a.movers.find(m => m.id === u.id);
        (0, save_1.requireRule)(u && m && u.alive && !m.escaped, '该伙伴已倒下或已完成路线');
        (0, save_1.requireRule)(m.enterTick > a.battle.tick, '该伙伴已经出场或正在等待入口');
        m.enterTick = a.battle.tick + 1;
        m.waiting = false;
        m.deployOrder = 1 + Math.max(0, ...a.movers.map(m => m.deployOrder ?? 0));
    });
}
function setArenaAutoDeploy(a, enabled) {
    return (0, combatTape_1.traceCombat)(a.battle, 'setArenaAutoDeploy', [enabled], () => {
        (0, save_1.requireRule)(a.phase === 'combat' && !a.defending, '当前不能切换进攻出场方式');
        a.autoDeploy = enabled;
        let next = a.battle.tick + 1;
        for (const m of a.movers) {
            if (m.escaped || m.enterTick <= a.battle.tick && !m.waiting || !a.attackers.find(u => u.id === m.id)?.alive)
                continue;
            m.enterTick = enabled ? next : UNDEPLOYED;
            m.waiting = false;
            next += AUTO_ENTRY_TICKS;
            delete m.enteredTick;
            if (enabled)
                m.deployOrder = 1 + Math.max(0, ...a.movers.map(m => m.deployOrder ?? 0));
            else
                delete m.deployOrder;
        }
    });
}
function along(route, value) {
    let remaining = value;
    for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i], length = (0, deterministicMath_1.simulationHypot)(a.x - b.x, a.z - b.z);
        if (remaining <= length) {
            const n = remaining / length;
            return { x: a.x + (b.x - a.x) * n, z: a.z + (b.z - a.z) * n };
        }
        remaining -= length;
    }
    return { ...route[route.length - 1] };
}
// Allies share the route freely. Ignore lateral offsets in older saved fights.
function arenaPoint(a, m) { return along(a.battle.route, m.distance); }
function withArenaPlayer(a, action) {
    const b = a.battle, units = b.units, enemies = b.enemies;
    b.controlledUnitIds = (a.defending ? a.defenders : a.attackers).map(u => u.id);
    b.units = a.defending ? a.defenders : a.attackers.filter(u => a.movers.some(m => m.id === u.id && m.enterTick <= b.tick && !m.escaped && !m.waiting));
    b.enemies = (a.defending ? a.attackers.filter(u => a.movers.some(m => m.id === u.id && m.enterTick <= b.tick && !m.escaped && !m.waiting)) : a.defenders).map(u => (0, battle_1.turtleEnemy)(u));
    try {
        return action(b);
    }
    finally {
        b.units = units;
        b.enemies = enemies;
    }
}
/** Count the whole roster, including queued entrants and a successful rebirth.
 * Escaped attackers have completed their route; they are not dead defenders. */
function arenaOutcome(a) {
    const defendingAlive = a.defenders.some(u => u.alive && u.hp > 0);
    const remaining = a.attackers.some(u => u.alive && u.hp > 0 && !a.movers.find(m => m.id === u.id)?.escaped);
    if (!defendingAlive)
        return { attackWon: true, draw: false, reason: 'eliminated' };
    if (!remaining)
        return { attackWon: a.passed >= 3, draw: false, reason: a.passed ? 'route-complete' : 'eliminated' };
    // A safety limit is a draw, never a fabricated defeat of surviving units.
    if (a.battle.tick >= 2400)
        return { attackWon: false, draw: true, reason: 'timeout' };
    return undefined;
}
function stepArena(a, dt) {
    return (0, combatTape_1.traceCombat)(a.battle, 'stepArena', [dt], () => {
        (0, sceneMigration_1.migrateSceneArena)(a);
        (0, save_1.requireRule)(Number.isFinite(dt) && dt >= 0 && dt <= 10, '竞技场推进时间不合法');
        if (a.phase !== 'combat')
            return;
        const b = a.battle;
        // Planning time is free. Once the first pet enters, the 120-second match runs.
        if (b.arenaVersion === 1 && b.tick === 0 && a.movers.every(m => m.enterTick === UNDEPLOYED) && !arenaOutcome(a))
            return;
        b.pendingSeconds += dt;
        while (b.pendingSeconds + 1e-9 >= .05 && a.phase === 'combat') {
            b.pendingSeconds = Math.max(0, b.pendingSeconds - .05);
            b.tick++;
            b.elapsed = b.tick * .05;
            a.seconds = b.elapsed;
            if ((b.stationVersion ?? 0) >= 6)
                for (const [i, m] of a.movers.entries()) {
                    if (m.distance > 0 || m.enterTick > b.tick || m.escaped)
                        continue;
                    const ahead = b.arenaVersion === 1 ? a.movers.filter((other, j) => other !== m && other.enterTick <= b.tick && (other.enterTick < m.enterTick || other.enterTick === m.enterTick && (other.deployOrder ?? j) < (m.deployOrder ?? i))) : a.movers.slice(0, i);
                    m.waiting = ahead.some(other => !other.escaped && a.attackers.find(u => u.id === other.id)?.alive && (other.waiting || other.enterTick > b.tick || (b.arenaVersion === 1 ? b.tick - (other.enteredTick ?? other.enterTick) < 25 : other.distance < 1.12)));
                    if (!m.waiting)
                        m.enteredTick ?? (m.enteredTick = b.tick);
                }
            const active = a.attackers.filter(u => a.movers.some(m => m.id === u.id && m.enterTick <= b.tick && !m.escaped && !m.waiting));
            const blockedCounts = {};
            // Existing interceptions reserve their defender's capacity before a newly
            // arriving turtle is considered, regardless of manual deployment order.
            const movementOrder = [...active].sort((u, v) => { const x = a.movers.find(m => m.id === u.id), y = a.movers.find(m => m.id === v.id); return Number((y.blockUntilTick ?? 0) > b.tick) - Number((x.blockUntilTick ?? 0) > b.tick) || y.distance - x.distance; });
            for (const u of movementOrder) {
                const mover = a.movers.find(m => m.id === u.id);
                if (!u.alive)
                    continue;
                Object.assign(u, arenaPoint(a, mover));
                const eligible = (d) => d.alive && d.role === 'stone' && (0, deterministicMath_1.simulationHypot)(d.x - u.x, d.z - u.z) <= (b.arenaVersion === 1 ? d.range : 1.2) && (blockedCounts[d.id] ?? 0) < (0, battle_1.blockCapacity)(d, b.tick);
                let stone = (mover.blockUntilTick ?? 0) > b.tick ? a.defenders.find(d => (!mover.blockOwnerId || d.id === mover.blockOwnerId) && eligible(d)) : undefined;
                if (!stone && !mover.blockUsed) {
                    stone = a.defenders.find(eligible);
                    if (stone) {
                        mover.blockUsed = true;
                        mover.blockUntilTick = b.tick + (b.arenaVersion === 1 ? 160 : 60);
                    }
                }
                if (stone) {
                    mover.blockOwnerId = stone.id;
                    blockedCounts[stone.id] = (blockedCounts[stone.id] ?? 0) + 1;
                }
                else if ((mover.blockUntilTick ?? 0) > b.tick)
                    mover.blockUntilTick = b.tick;
                const rooted = u.statuses.some(s => ['stun', 'root', 'web'].includes(s.kind) && s.untilTick > b.tick), slow = (0, battle_1.battleSlow)(u.statuses, b.tick);
                // Friendly bodies must not turn one intercepted turtle into a five-pet
                // roadblock. Attacks/casts do not immobilize a walking arena attacker.
                if (!rooted && (mover.blockUntilTick ?? 0) <= b.tick) {
                    let next = mover.distance + .9 * (1 - Math.min(battle_1.BATTLE_RULES.slowCap, slow)) * .05;
                    if ((b.stationVersion ?? 0) >= 6 && b.arenaVersion !== 1) {
                        const i = a.movers.indexOf(mover);
                        for (const other of a.movers)
                            if (other !== mover && !other.escaped && !other.waiting && other.enterTick <= b.tick && a.attackers.find(unit => unit.id === other.id)?.alive && (other.distance > mover.distance || other.distance === mover.distance && a.movers.indexOf(other) < i))
                                next = Math.min(next, Math.max(mover.distance, other.distance - 1.1));
                    }
                    mover.distance = next;
                }
                Object.assign(u, arenaPoint(a, mover));
                if (mover.distance >= b.routeLength) {
                    mover.escaped = true;
                    a.passed++;
                }
            }
            (0, battle_1.duelActions)(b, a.attackers.filter(u => a.movers.some(m => m.id === u.id && m.enterTick <= b.tick && !m.escaped && !m.waiting)), a.defenders, b.arenaVersion === 1 ? new Map(a.movers.map(m => [m.id, m.distance])) : undefined);
            const outcome = arenaOutcome(a);
            if (outcome) {
                a.draw = outcome.draw;
                a.endReason = outcome.reason;
                a.victory = !outcome.draw && (a.defending ? !outcome.attackWon : outcome.attackWon);
                a.phase = 'result';
                b.status = a.victory ? 'won' : 'lost';
            }
        }
        b.units = a.defenders;
        b.enemies = a.attackers.filter(u => a.movers.some(m => m.id === u.id && m.enterTick <= b.tick && !m.waiting)).map(u => {
            const m = a.movers.find(m => m.id === u.id), e = (0, battle_1.turtleEnemy)(u, m.distance);
            e.statuses = (0, save_1.copy)(u.statuses);
            if (m.escaped)
                e.alive = false;
            return e;
        });
        b.kills = b.enemies.filter(e => !e.alive).length;
        b.leaked = a.passed;
        b.nextEnemyId = b.enemies.length + 1;
    });
}
function validateArenaCheckpoint(current, next) {
    (0, save_1.requireRule)(current.id === next.id && current.opponentId === next.opponentId && !current.settled && next.battle.tick >= current.battle.tick && next.battle.tick <= 2400, '竞技场检查点不属于当前挑战');
    (0, save_1.requireRule)(current.practice === next.practice && current.defending === next.defending && current.battle.arenaVersion === next.battle.arenaVersion, '竞技场双方身份和交战规则不能改变');
    (0, save_1.requireRule)(next.autoDeploy === undefined || typeof next.autoDeploy === 'boolean', '竞技场出场模式损坏');
    (0, save_1.requireRule)(next.movers.every(m => m.deployOrder === undefined || Number.isSafeInteger(m.deployOrder) && m.deployOrder >= 0), '竞技场派遣次序损坏');
    (0, save_1.requireRule)(next.movers.every(m => (m.enteredTick === undefined || Number.isSafeInteger(m.enteredTick) && m.enteredTick >= 0 && m.enteredTick <= next.battle.tick) && (m.passOffset === undefined || Number.isFinite(m.passOffset) && Math.abs(m.passOffset) <= .95)), '竞技场入场或绕行资料损坏');
    (0, save_1.requireRule)(next.attackers.length === 5 && next.defenders.length === 5 && next.movers.length === 5, '竞技场阵容损坏');
    for (const team of ['attackers', 'defenders'])
        next[team].forEach((u, i) => {
            const old = current[team][i];
            (0, save_1.requireRule)(u.id === old.id && u.turtleId === old.turtleId && u.role === old.role && u.maxHp === old.maxHp && JSON.stringify(u.skills) === JSON.stringify(old.skills), '竞技场战斗中不能调整队伍');
            (0, save_1.requireRule)(Number.isFinite(u.hp) && u.hp >= 0 && u.hp <= u.maxHp && typeof u.alive === 'boolean' && (!u.alive || u.hp > 0), '竞技场生命资料损坏');
        });
    (0, save_1.requireRule)(Number.isSafeInteger(next.passed) && next.passed === next.movers.filter(m => m.escaped).length && next.passed <= 5 && next.seconds === next.battle.tick * .05, '竞技场进度损坏');
    next.movers.forEach((m, i) => (0, save_1.requireRule)(m.id === current.movers[i].id && Number.isSafeInteger(m.enterTick) && (m.enterTick === current.movers[i].enterTick || m.enterTick >= current.battle.tick) && Number.isFinite(m.distance) && m.distance >= 0 && m.distance <= next.battle.routeLength + .1, '竞技场出场顺序或行进资料损坏'));
}
function finishArena(s, next, abandon = false) {
    const c = (0, community_1.communityOf)(s), current = c.arena;
    (0, save_1.requireRule)(current, '没有竞技场挑战');
    validateArenaCheckpoint(current, next);
    (0, save_1.requireRule)(!current.settled, '竞技场已结算');
    const outcome = arenaOutcome(next);
    (0, save_1.requireRule)(abandon || next.phase === 'result' && !!outcome, '竞技场还有有效伙伴，战斗尚未结束');
    const a = (0, save_1.copy)(next);
    a.phase = 'result';
    a.draw = !abandon && !!outcome?.draw;
    a.endReason = abandon ? 'abandoned' : outcome.reason;
    a.victory = !abandon && !a.draw && (a.defending ? !outcome.attackWon : outcome.attackWon);
    a.settled = true;
    const sameSeason = a.seasonWeek === undefined || a.seasonWeek === (0, progression_1.progression)(s).arena.week;
    if (!a.practice && sameSeason && !(0, progression_1.progression)(s).arena.weeklySettled) {
        (0, progression_1.recordArena)(s, !!a.victory, !!a.draw);
        a.ratingAfter = (0, progression_1.progression)(s).arena.rating;
    }
    if (a.victory && !a.practice && sameSeason && !(0, progression_1.progression)(s).arena.weeklySettled) {
        const ours = c.arenaOrder.indexOf(community_1.LOCAL_PLAYER), theirs = c.arenaOrder.indexOf(a.opponentId);
        if (theirs >= 0 && theirs < ours) {
            c.arenaOrder.splice(ours, 1);
            c.arenaOrder.splice(theirs, 0, community_1.LOCAL_PLAYER);
        }
    }
    if (!a.practice) {
        (0, development_1.grantExperience)(s, c.arenaAttack, a.victory ? 110 : abandon ? 0 : 45);
        if (!abandon) {
            const quality = Math.min(3, Math.floor((a.ratingAfter ?? 1000) / 400));
            a.rewards = [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, a.victory ? 12 + quality * 4 : 4) }, { kind: 'material', material: 'growth', amount: a.victory ? 2 + quality : 1 }];
            if (a.victory && (0, progression_1.progression)(s).arena.games % 3 === 0)
                a.rewards.push({ kind: 'bookPack', grade: quality >= 3 ? 'active' : 'common', amount: 1 });
            (0, mail_1.sendSystemMail)(s, 'arena:' + a.id, '竞技场战利品', '根据本场胜负和当前积分结算，领取附件即可入库。', a.rewards, s.clockHighWater);
        }
    }
    a.rankAfter = c.arenaOrder.indexOf(community_1.LOCAL_PLAYER) + 1;
    c.arena = a;
    (0, community_1.finishLoans)(s, a.id);
    return (0, save_1.copy)(a);
}
