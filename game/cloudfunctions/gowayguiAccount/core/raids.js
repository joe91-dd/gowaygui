"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raidPets = exports.RAID_BALANCE = exports.RAIDS = exports.raidMapId = void 0;
exports.startRaid = startRaid;
exports.swapRaidPositions = swapRaidPositions;
exports.raidBattle = raidBattle;
exports.beginRaidWave = beginRaidWave;
exports.moveRaidStation = moveRaidStation;
exports.swapRaidPet = swapRaidPet;
exports.stepRaid = stepRaid;
exports.validateRaidCheckpoint = validateRaidCheckpoint;
exports.finishRaid = finishRaid;
const deterministicMath_1 = require("./deterministicMath");
const combatTape_1 = require("./combatTape");
const dailyAccess_1 = require("./dailyAccess");
const rewardBalance_1 = require("./rewardBalance");
const mail_1 = require("./mail");
const expeditionRules_1 = require("./expeditionRules");
const battle_1 = require("./battle");
const sceneGeometry_1 = require("./sceneGeometry");
const sceneMigration_1 = require("./sceneMigration");
const tacticalMaps_1 = require("./tacticalMaps");
const bookPolicy_1 = require("./bookPolicy");
const placement_1 = require("./placement");
const progression_1 = require("./progression");
const economy_1 = require("./economy");
const rewardPacks_1 = require("./rewardPacks");
const development_1 = require("./development");
const battle_2 = require("./battle");
const data_1 = require("./data");
const battleValidation_1 = require("./battleValidation");
const community_1 = require("./community");
const save_1 = require("./save");
const prototypeConfig_1 = require("./prototypeConfig");
const raidMapId = (tier) => tier === 3 ? 55 : 51 + tier;
exports.raidMapId = raidMapId;
exports.RAIDS = [
    { name: '碎礁洞穴', waves: 10, baseWave: 16, gold: 60, food: 3, books: 1, description: '双口分路，从第一波开始双路夹击；互相补位守住潮汐灯塔' },
    { name: '深潮遗迹', waves: 15, baseWave: 20, gold: 100, food: 5, books: 2, description: '双庭回廊，敌人沿两侧绕行；治疗与控制照顾中央交汇区域' },
    { name: '巨钳王庭', waves: 20, baseWave: 21, gold: 150, food: 8, books: 3, description: '双路围攻，快慢敌群轮流压境；分路拦截并轮换支援' },
    { name: '双环潮狱', waves: 20, baseWave: 22, gold: 200, food: 9, books: 3, description: '双人各守一岸；连续20波首领与祝福考验协作' },
];
exports.RAID_BALANCE = [{ health: .9, boss: .62 }, { health: 1.15, boss: .60 }, { health: 1.3, boss: .58 }, { health: 1.35, boss: .65 }];
function startRaid(s, now, tier, selection) {
    (0, community_1.initCommunity)(s, now);
    (0, community_1.ensureCommunityHome)(s);
    (0, save_1.requireRule)(Number.isInteger(tier) && !!exports.RAIDS[tier], '副本不存在');
    const pets = (0, community_1.choosePets)(s, selection, now);
    (0, save_1.requireRule)(pets.length === 5, '副本需备战五只伙伴');
    (0, save_1.requireRule)(pets.every(p => !p.loanId), '借用和租赁的龟仅可用于关卡、无尽模式；副本只能使用自有龟');
    (0, dailyAccess_1.consumeAttempt)(s, ('raid' + tier), now);
    const c = (0, community_1.communityOf)(s), sessionId = `raid-${++s.idCounter}`;
    const members = [{ ownerId: community_1.LOCAL_PLAYER, name: c.name, ai: false, roster: pets, activeId: pets[0].id }];
    const bots = Object.values(c.aiPlayers).slice(0, 1), focus = ['spike', 'crystal', 'leaf', 'bubble'];
    bots.forEach((ai, i) => {
        const roster = Object.values(ai.pets).slice(0, 5).map(t => ({ id: `${ai.id}:${t.id}`, ownerId: ai.id, originalId: t.id, turtle: (0, save_1.copy)(t) }));
        // Local teammates stand in for prepared players; these copies never enter the market or collection.
        for (const p of roster) {
            const t = p.turtle, extras = ['strong', 'armor', 'resist', 'rebirth', 'regen', 'lastShield'].filter(id => !t.skills.includes(id));
            t.skills = t.skills.concat(extras).slice(0, tier === 0 ? 10 : 12);
            t.innate = { attack: 95 + Math.min(1, tier) * 5, health: 95 + Math.min(1, tier) * 5, defense: 95 + Math.min(1, tier) * 5, growth: 110 };
        }
        (0, save_1.requireRule)(roster.length === 5, 'AI队友需要完整五只备战伙伴');
        const chosen = roster.find(t => t.turtle.role === focus[i]) ?? roster[0];
        members.push({ ownerId: ai.id, name: ai.name, ai: true, roster, activeId: chosen.id });
    });
    // At party creation the body owner's preferred active turtle wins a source conflict.
    for (const m of members) {
        const chosen = m.roster.find(t => t.id === m.activeId);
        if (chosen.ownerId !== m.ownerId && members.some(owner => owner.ownerId === chosen.ownerId && owner.roster.some(t => t.id === owner.activeId && t.originalId === chosen.originalId))) {
            const substitute = m.roster.find(t => t.ownerId === m.ownerId);
            (0, save_1.requireRule)(substitute, '主人正在使用借来的龟，请备一只自有替补');
            m.activeId = substitute.id;
        }
    }
    members.forEach((m, i) => { m.station = i; m.moveReadyTick = 0; });
    (0, community_1.reserveLoans)(s, pets, sessionId);
    const raid = { expeditionVersion: 1, mapVersion: 6, sceneRevision: sceneGeometry_1.SCENE_REVISION, id: sessionId, tier, phase: 'prep', wave: 0, seconds: 0, coreHealth: 20, members, sleep: {}, fallen: [], settled: false, startedAt: now };
    c.raid = raid;
    raid.battle = raidBattle(raid);
    return (0, save_1.copy)(raid);
}
const raidPets = (r) => r.members.flatMap(m => m.roster);
exports.raidPets = raidPets;
/** An occupied landing swaps both positions, preserving each member's identity and resources. */
function swapRaidPositions(r, a, b) {
    const one = r.members[a], two = r.members[b];
    (0, save_1.requireRule)(one && two && a !== b && ['prep', 'between', 'combat'].includes(r.phase), '当前不能交换位置');
    const slotA = one.station ?? a, slotB = two.station ?? b, pointA = one.placement, pointB = two.placement;
    if (r.phase === 'combat') {
        const battle = r.battle;
        (0, save_1.requireRule)(battle.tick >= (one.moveReadyTick ?? 0) && battle.tick >= (two.moveReadyTick ?? 0), '双方调位冷却结束后才能互换');
        (0, battle_2.moveBattleUnit)(battle, one.activeId, slotB);
        one.moveReadyTick = two.moveReadyTick = battle.tick + 160;
    }
    one.station = slotB;
    two.station = slotA;
    one.placement = pointB;
    two.placement = pointA;
    if (!pointB)
        delete one.placement;
    if (!pointA)
        delete two.placement;
}
function choice(r, id) { const p = (0, exports.raidPets)(r).find(t => t.id === id); (0, save_1.requireRule)(p, '找不到副本伙伴'); return p; }
function raidBattle(r) {
    (0, sceneMigration_1.migrateSceneRaid)(r);
    if (r.expeditionVersion) {
        if (r.battle?.expedition)
            return (0, save_1.copy)(r.battle);
        const id = (0, exports.raidMapId)(r.tier), e = (0, expeditionRules_1.newExpedition)('raid', id, r.members.map(m => ({ id: m.ownerId, templates: m.roster.map(p => p.turtle) })), exports.RAIDS[r.tier].waves);
        const b = (0, battle_2.createBattle)(id, 1, [], { rulesVersion: '0.6', mode: 'endless', formationVersion: 2, expedition: e, seed: Array.from(r.id).reduce((v, c) => Math.imul(v ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) });
        b.encounter = 'raid';
        return b;
    }
    (0, save_1.requireRule)(r.phase === 'prep' || r.phase === 'between', '请先完成本波');
    const row = exports.RAIDS[r.tier];
    if (r.mapVersion !== 6) {
        r.mapVersion = 6;
        r.members.forEach((m, i) => { m.station = i; delete m.placement; });
    }
    const b = (0, battle_2.createBattle)((0, exports.raidMapId)(r.tier), r.wave + 1, r.members.map((m, i) => ({ m, slot: m.station ?? i })).filter(x => x.m.activeId).map(({ m, slot }) => { const p = choice(r, m.activeId); return { id: p.id, turtle: p.turtle, slot, placement: m.placement, level: (0, development_1.levelInfo)(p.turtle).level, sleepUntilWave: r.sleep[p.id], fallen: r.fallen?.includes(p.id) }; }), { rulesVersion: '0.6', mode: 'endless', coreHealth: r.coreHealth });
    b.encounter = 'raid';
    b.spawns = (0, prototypeConfig_1.prototypeSpawns)((0, exports.raidMapId)(r.tier), row.baseWave + r.wave, true);
    const strength = exports.RAID_BALANCE[r.tier].health;
    for (const spawn of b.spawns) {
        spawn.hpScale *= strength;
        spawn.attackScale *= Math.sqrt(strength);
    }
    if (r.wave === row.waves - 1 && !b.spawns.some(x => x.kind === 'boss'))
        b.spawns.push({ kind: 'boss', time: 22, hpScale: (0, deterministicMath_1.simulationPow)(1.07, row.baseWave - 1) * strength, attackScale: Math.sqrt((0, deterministicMath_1.simulationPow)(1.07, row.baseWave - 1) * strength) });
    for (const spawn of b.spawns)
        if (spawn.kind === 'boss')
            spawn.hpScale *= exports.RAID_BALANCE[r.tier].boss;
    b.spawns = (0, tacticalMaps_1.chapterFronts)(b.spawns, data_1.BATTLE_MAPS[(0, exports.raidMapId)(r.tier)], r.wave + 1);
    if (r.tier === 3) {
        b.spawns = Array.from({ length: 240 }, (_, i) => ({ kind: (i % 60 === 59 ? 'boss' : ['ink', 'runner', 'armored', 'mist', 'snail', 'elite'][i % 6]), time: i * (.58 / .82), hpScale: (.63 + Math.floor(i / 50) * .1925) * (i % 60 === 59 ? .5 : 1), attackScale: .26 + Math.floor(i / 50) * .028 }));
    }
    if (r.tier === 3)
        b.spawns = (0, tacticalMaps_1.chapterFronts)(b.spawns, data_1.BATTLE_MAPS[55], r.wave + 1);
    return b;
}
function beginRaidWave(s) { const r = (0, community_1.communityOf)(s).raid; (0, save_1.requireRule)(r && !r.settled, '没有副本挑战'); const b = raidBattle(r); r.members.forEach(m => m.moveReadyTick = 0); b.autoSkills = s.settings.autoSkills ?? false; b.controlledUnitIds = r.expeditionVersion ? b.units.filter(u => u.ownerId === r.members[0].ownerId).map(u => u.id) : r.members[0].roster.map(p => p.id); r.battle = (0, save_1.copy)(b); r.phase = 'combat'; return b; }
/** Member ownership stays fixed when a turtle moves; no teammate can be displaced. */
function moveRaidStation(r, memberIndex, station, point) {
    return (0, combatTape_1.traceCombat)(r.battle, 'moveRaidStation', [memberIndex, station, point], () => {
        const m = r.members[memberIndex], map = data_1.BATTLE_MAPS[(0, exports.raidMapId)(r.tier)];
        (0, save_1.requireRule)(m && ['prep', 'between', 'combat'].includes(r.phase), '当前不能调整站位');
        (0, save_1.requireRule)(Number.isInteger(station) && station >= 0 && !!map.slots[station], '站位不存在');
        const occupied = r.members.findIndex((other, i) => i !== memberIndex && (point ? (0, deterministicMath_1.simulationHypot)((other.placement ?? map.slots[other.station ?? i]).x - point.x, (other.placement ?? map.slots[other.station ?? i]).z - point.z) < .78 : (other.station ?? i) === station));
        if (occupied >= 0) {
            swapRaidPositions(r, memberIndex, occupied);
            return;
        }
        if (point) {
            const issue = (0, placement_1.placementIssue)(map, point, r.members.filter((_, i) => i !== memberIndex).map(o => o.placement ?? map.slots[o.station ?? r.members.indexOf(o)]));
            (0, save_1.requireRule)(!issue, issue ?? '这里不能摆放');
        }
        if ((m.station ?? memberIndex) === station && !point)
            return;
        if (r.phase === 'combat') {
            const b = r.battle, u = b.units.find(u => u.id === m.activeId);
            (0, save_1.requireRule)(b.status === 'fighting' && u?.alive, '先换上一只可战斗的龟');
            (0, save_1.requireRule)(b.tick >= (m.moveReadyTick ?? 0), '移动冷却中，每 8 秒可调整一次');
            (0, battle_2.moveBattleUnit)(b, m.activeId, station, point);
            u.actionUntilTick = Math.max(u.actionUntilTick, b.tick + 12);
            m.moveReadyTick = b.tick + 160;
        }
        m.station = station;
        m.placement = point ? (0, placement_1.normalizedPoint)(point) : undefined;
        if (m.placement === undefined)
            delete m.placement;
    });
}
/** Party-wide source identity is checked before any position changes. Owner priority can force a borrowed copy back to reserve. */
function swapRaidPet(r, memberIndex, id) {
    return (0, combatTape_1.traceCombat)(r.battle, 'swapRaidPet', [memberIndex, id], () => {
        (0, save_1.requireRule)(['prep', 'between', 'combat'].includes(r.phase), '本次副本已结束');
        const member = r.members[memberIndex], pet = member?.roster.find(p => p.id === id);
        (0, save_1.requireRule)(member && pet, '这位伙伴不在该成员的备战栏');
        (0, save_1.requireRule)((r.sleep[id] ?? 0) <= r.wave + 1, '伙伴仍在沉睡');
        (0, save_1.requireRule)(!r.fallen?.includes(id) || r.sleep[id] !== undefined && r.sleep[id] <= r.wave + 1, '伙伴已倒下，本次副本无法再上场');
        const conflict = r.members.findIndex(m => m !== member && m.roster.some(p => p.id === m.activeId && p.ownerId === pet.ownerId && p.originalId === pet.originalId));
        if (conflict >= 0) {
            (0, save_1.requireRule)(pet.ownerId === member.ownerId, '同一本体已上场，优先主人使用');
            const other = r.members[conflict], substitute = other.roster.find(p => p.ownerId === other.ownerId && p.originalId !== pet.originalId && (r.sleep[p.id] ?? 0) <= r.wave + 1 && (!r.fallen?.includes(p.id) || r.sleep[p.id] !== undefined && r.sleep[p.id] <= r.wave + 1) && p.id !== other.activeId && (!r.battle?.benchUnits?.find(u => u.id === p.id) || r.battle.benchUnits.find(u => u.id === p.id).alive));
            if (substitute)
                swapRaidPet(r, conflict, substitute.id);
            else {
                if (r.battle && r.phase === 'combat')
                    (0, battle_2.benchBattleUnit)(r.battle, other.activeId);
                other.activeId = '';
            }
        }
        if (member.activeId === id)
            return;
        if (r.phase === 'combat') {
            (0, save_1.requireRule)(r.battle?.status === 'fighting', '本波已结束');
            const cached = r.battle.benchUnits?.find(u => u.id === id);
            (0, save_1.requireRule)(!cached || cached.alive, '伙伴本波已倒下');
            (0, battle_2.replaceBattleUnit)(r.battle, { id: pet.id, turtle: pet.turtle, slot: member.station ?? memberIndex, placement: member.placement, level: 10, sleepUntilWave: r.sleep[id], fallen: r.fallen?.includes(id) });
        }
        member.activeId = id;
    });
}
function stepRaid(r, dt) {
    return (0, combatTape_1.traceCombat)(r.battle, 'stepRaid', [dt], () => {
        (0, sceneMigration_1.migrateSceneRaid)(r);
        if (r.expeditionVersion && r.battle) {
            for (const m of r.members.filter(m => m.ai)) {
                const p = r.battle.expedition.players.find(p => p.id === m.ownerId);
                if (p.choices.length)
                    (0, expeditionRules_1.chooseExpeditionBuff)(r.battle, m.ownerId, p.choices[0]);
                if (r.battle.tick % 100 === 0 && !r.battle.expedition.players.some(p => p.choices.length)) {
                    try {
                        const units = r.battle.units.filter(u => u.ownerId === m.ownerId && u.alive), a = units.find(u => units.length >= 8 && (u.fusionRank ?? 1) < 3 && units.some(v => v !== u && v.role === u.role && v.fusionRank === u.fusionRank));
                        if (a) {
                            const b = units.find(u => u !== a && u.role === a.role && u.fusionRank === a.fusionRank);
                            (0, battle_1.expeditionAction)(r.battle, m.ownerId, 'merge', { a: a.id, b: b.id });
                        }
                        else
                            (0, battle_1.expeditionAction)(r.battle, m.ownerId, 'recruit');
                    }
                    catch { }
                }
            }
            (0, battle_2.stepBattle)(r.battle, dt);
            r.wave = r.battle.expedition.completed;
            return;
        }
        (0, save_1.requireRule)(Number.isFinite(dt) && dt >= 0 && dt <= 3600, '副本推进时间无效');
        (0, save_1.requireRule)(r.phase === 'combat' && r.battle, '副本尚未开始');
        const b = r.battle, total = Math.round((b.pendingSeconds + dt) * 1e12) / 1e12, ticks = Math.floor((total + 1e-9) / .05);
        b.pendingSeconds = 0;
        for (let i = 0; i < ticks && b.status === 'fighting'; i++)
            raidTick(r);
        b.pendingSeconds = b.status === 'fighting' ? Math.max(0, Math.round((total - ticks * .05) * 1e12) / 1e12) : 0;
    });
}
function raidTick(r) {
    (0, save_1.requireRule)(r.phase === 'combat' && r.battle, '副本尚未开始');
    const before = r.battle.tick;
    (0, battle_2.stepBattle)(r.battle, .05);
    if (r.battle.status !== 'fighting')
        return;
    if (Math.floor(before / 20) !== Math.floor(r.battle.tick / 20)) {
        r.members.forEach((m, i) => {
            if (!m.ai)
                return;
            const active = r.battle.units.find(u => u.id === m.activeId);
            if (active?.alive && active.hp / active.maxHp >= .22)
                return;
            const replacement = m.roster.filter(p => p.id !== m.activeId && (r.sleep[p.id] ?? 0) <= r.wave + 1 && (!r.fallen?.includes(p.id) || r.sleep[p.id] !== undefined && r.sleep[p.id] <= r.wave + 1)).find(p => { const cache = r.battle.benchUnits?.find(u => u.id === p.id); return !cache || cache.alive && cache.hp / cache.maxHp > .4; });
            if (replacement)
                try {
                    swapRaidPet(r, i, replacement.id);
                }
                catch { /* A source conflict keeps the current pet rather than duplicating it. */ }
        });
        if (Math.floor(before / 100) !== Math.floor(r.battle.tick / 100)) {
            const b = r.battle, map = data_1.BATTLE_MAPS[(0, exports.raidMapId)(r.tier)];
            r.members.forEach((m, i) => {
                const u = b.units.find(u => u.id === m.activeId);
                if (!m.ai || !u?.alive || b.tick < Math.max(m.moveReadyTick ?? 0, u.moveReadyTick ?? 0))
                    return;
                const occupied = new Set(r.members.filter(x => x !== m).map(x => x.station ?? r.members.indexOf(x)));
                const score = (slot) => { const p = map.slots[slot]; return u.role === 'leaf' ? b.units.filter(a => a.alive && a.id !== u.id && (0, deterministicMath_1.simulationHypot)(a.x - p.x, a.z - p.z) <= u.range).reduce((v, a) => v + 1 + (1 - a.hp / a.maxHp) * 3, 0) : b.enemies.filter(e => e.alive && (0, deterministicMath_1.simulationHypot)(e.x - p.x, e.z - p.z) <= u.range).reduce((v, e) => v + (e.kind === 'boss' ? 3 : 1), 0); };
                const current = m.station ?? i, best = map.slots.map((_, slot) => slot).filter(slot => !occupied.has(slot) && !(0, placement_1.placementIssue)(map, map.slots[slot], r.members.filter(o => o !== m).map((o) => o.placement ?? map.slots[o.station ?? r.members.indexOf(o)]))).sort((a, b) => score(b) - score(a) || a - b)[0];
                if (best !== undefined && score(best) > score(current) + 1)
                    try {
                        moveRaidStation(r, i, best);
                    }
                    catch { /* A spell or transfer keeps the AI in place. */ }
            });
        }
    }
}
function validateRaidCheckpoint(current, next) {
    if (current.expeditionVersion) {
        (0, save_1.requireRule)(next.expeditionVersion === 1 && current.id === next.id && current.tier === next.tier && next.battle && next.battle.tick >= (current.battle?.tick ?? 0), '副本进度不一致');
        (0, save_1.requireRule)(JSON.stringify(current.members.map(m => m.roster)) === JSON.stringify(next.members.map(m => m.roster)), '培养来源不能改变');
        (0, battleValidation_1.validateBattle)(next.battle);
        (0, save_1.requireRule)(next.battle.expedition?.kind === 'raid' && next.battle.coreHealth <= current.coreHealth, '副本数据不一致');
        return;
    }
    (0, save_1.requireRule)(current.id === next.id && current.tier === next.tier && current.wave === next.wave && current.phase === 'combat' && next.phase === 'combat' && !!next.battle, '副本检查点不属于当前挑战');
    (0, save_1.requireRule)(JSON.stringify(current.members.map(m => m.roster)) === JSON.stringify(next.members.map(m => m.roster)), '副本备战资料不一致');
    (0, battleValidation_1.validateBattle)(next.battle);
    (0, save_1.requireRule)(next.battle.encounter === 'raid' && next.battle.wave === next.wave + 1 && next.battle.tick >= (current.battle?.tick ?? 0) && next.battle.coreHealth <= current.coreHealth, '副本战斗进度不一致');
    const activeKeys = new Set();
    const stations = new Set();
    next.members.forEach((m, i) => { const station = m.station ?? i; (0, save_1.requireRule)(Number.isInteger(station) && !!data_1.BATTLE_MAPS[(0, exports.raidMapId)(next.tier)].slots[station] && !stations.has(station), '副本站位重复或不存在'); stations.add(station); (0, save_1.requireRule)(Number.isSafeInteger(m.moveReadyTick ?? 0) && (m.moveReadyTick ?? 0) >= 0 && (m.moveReadyTick ?? 0) <= next.battle.tick + 160, '移动冷却无效'); const p = m.roster.find(t => t.id === m.activeId), u = next.battle.units.find(t => t.slot === station); if (!m.activeId) {
        (0, save_1.requireRule)(!u, '已换下的站位仍有伙伴');
        return;
    } (0, save_1.requireRule)(p && u?.id === p.id && u.turtleId === p.turtle.id, '副本站位与队伍不一致'); (0, save_1.requireRule)(JSON.stringify(m.placement) === JSON.stringify(u?.placement), '副本落点与伙伴不一致'); const key = `${p.ownerId}:${p.originalId}`; (0, save_1.requireRule)(!activeKeys.has(key), '同一本体不能同时上场'); activeKeys.add(key); });
}
function grant(s, g) { (0, rewardPacks_1.applyReward)(s, g); }
function finishRaid(s, next, abandon = false) {
    const r = (0, community_1.communityOf)(s).raid;
    (0, save_1.requireRule)(r && !r.settled, '副本已结算');
    if (r.phase === 'combat') {
        validateRaidCheckpoint(r, next);
        Object.assign(r, (0, save_1.copy)(next));
    }
    if (!abandon) {
        (0, save_1.requireRule)(r.battle && r.battle.status !== 'fighting', '这一波尚未结束');
        r.seconds += r.battle.elapsed;
        r.coreHealth = r.battle.coreHealth;
        for (const u of r.battle.units.concat(r.battle.benchUnits ?? [])) {
            r.fallen = (r.fallen ?? []).filter(id => id !== u.id);
            if (!u.alive)
                r.fallen.push(u.id);
            if (u.sleepUntilWave !== undefined)
                r.sleep[u.id] = u.sleepUntilWave;
            else
                delete r.sleep[u.id];
        }
        (0, progression_1.discoverBattle)(s, r.battle);
        if (r.tier === 3 && !r.expeditionVersion)
            r.remaining = r.battle.enemies.filter(e => e.alive).length;
        const won = r.battle.status === 'won';
        if (r.expeditionVersion)
            r.wave = r.battle.expedition.completed;
        else if (won)
            r.wave++;
        delete r.battle;
        if (won && r.wave < exports.RAIDS[r.tier].waves) {
            r.phase = 'between';
            return (0, save_1.copy)(r);
        }
        r.victory = won;
    }
    else {
        r.victory = false;
        if (r.battle)
            r.seconds += r.battle.elapsed;
        delete r.battle;
    }
    r.phase = 'result';
    r.settled = true;
    r.rewards = [];
    if (r.victory) {
        const config = exports.RAIDS[r.tier];
        r.rewards = [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, config.gold) }, ...['attack', 'health', 'defense', 'growth'].map(material => ({ kind: 'material', material, amount: config.food })), ...Array.from({ length: config.books }, () => ({ kind: 'book', skillId: (0, prototypeConfig_1.drawBook)(s, 'ordinary'), amount: 1 }))];
        for (const g of r.rewards)
            grant(s, g);
    }
    if (!r.victory && r.wave > 0) {
        const amount = Math.floor(exports.RAIDS[r.tier].gold * .08 * r.wave / exports.RAIDS[r.tier].waves);
        if (amount > 0) {
            const reward = { kind: 'gold', amount: (0, economy_1.goldAmount)(s, amount) };
            r.rewards.push(reward);
            grant(s, reward);
        }
    }
    if (r.victory) {
        r.stars = r.tier === 3 && !r.expeditionVersion ? ((r.remaining ?? 0) <= 5 ? 3 : (r.remaining ?? 0) <= 10 ? 2 : 1) : r.coreHealth === 20 ? 3 : r.coreHealth >= 12 ? 2 : 1;
        r.chestId = (0, progression_1.grantChest)(s, 'raid:' + r.id, '副本 ' + r.stars + ' 星宝箱', r.stars, [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, exports.RAIDS[r.tier].gold * r.stars / 5) }, { kind: 'material', material: 'growth', amount: r.stars }, s.livingVersion ? (0, bookPolicy_1.bookChestReward)(s, r.stars === 3) : { kind: 'book', skillId: (0, prototypeConfig_1.drawBook)(s, r.stars === 3 ? 'fine' : 'ordinary'), amount: 1 }]).id;
    }
    if (r.victory) {
        const extra = rewardBalance_1.RAID_EXTRA[r.tier];
        for (const reward of (0, rewardBalance_1.rewardBooks)(s, extra.pool, extra.books)) {
            r.rewards.push(reward);
            grant(s, reward);
        }
        r.petRewards = Array.from({ length: extra.pets }, () => (0, rewardBalance_1.rewardPet)(s, extra.skills, 'raid-loot-' + r.id));
        if (r.petRewards.length && !r.id.startsWith('online:')) {
            const mail = (0, mail_1.sendSystemMail)(s, 'raid-pets:' + r.id, exports.RAIDS[r.tier].name + ' · 伙伴奖励', '获得 ' + r.petRewards.length + ' 只随机造型、' + extra.skills + '技能龟龟，领取后加入收藏。', []);
            mail.pets = (0, save_1.copy)(r.petRewards);
        }
    }
    (0, development_1.grantExperience)(s, r.members[0].roster.map(p => p.originalId), r.wave * (16 + r.tier * 8) + (r.victory ? 60 : 0));
    (0, community_1.finishLoans)(s, r.id);
    return (0, save_1.copy)(r);
}
