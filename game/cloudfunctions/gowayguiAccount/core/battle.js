"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockCapacity = exports.skillCastRange = exports.skillTargetMode = exports.battleSlow = exports.BATTLE_RULES = void 0;
exports.basicAttackFlight = basicAttackFlight;
exports.createBattle = createBattle;
exports.replaceBattleUnit = replaceBattleUnit;
exports.benchBattleUnit = benchBattleUnit;
exports.retireBenchedBattleUnit = retireBenchedBattleUnit;
exports.moveBattleUnit = moveBattleUnit;
exports.getBattleEvents = getBattleEvents;
exports.legalSkillTargets = legalSkillTargets;
exports.canCommandBattle = canCommandBattle;
exports.commandBattle = commandBattle;
exports.focusBattle = focusBattle;
exports.cleansePriority = cleansePriority;
exports.commandAllSkills = commandAllSkills;
exports.stepBattle = stepBattle;
exports.positionOnRoute = positionOnRoute;
exports.enemySpeciesKey = enemySpeciesKey;
exports.turtleEnemy = turtleEnemy;
exports.duelActions = duelActions;
exports.expeditionAction = expeditionAction;
const deterministicMath_1 = require("./deterministicMath");
const combatTape_1 = require("./combatTape");
const roleSurvival_1 = require("./roleSurvival");
const passiveStats_1 = require("./passiveStats");
const battleHistory_1 = require("./battleHistory");
const expeditionEconomy_1 = require("./expeditionEconomy");
const expeditionRules_1 = require("./expeditionRules");
const expeditionRules_2 = require("./expeditionRules");
const sceneMigration_1 = require("./sceneMigration");
const development_1 = require("./development");
const releaseBalance_1 = require("./releaseBalance");
const prototypeConfig_1 = require("./prototypeConfig");
const data_1 = require("./data");
const random_1 = require("./random");
const bossCatalog_1 = require("./bossCatalog");
const placement_1 = require("./placement");
const prototypeConfig_2 = require("./prototypeConfig");
const multiFront_1 = require("./multiFront");
const tacticalMaps_1 = require("./tacticalMaps");
const enemyG1Catalog_1 = require("./enemyG1Catalog");
const enemyCombat_1 = require("./enemyCombat");
/** Public balance constants, deliberately independent of rendering and frame rate. */
exports.BATTLE_RULES = {
    tickSeconds: .05, coreHealth: 20, critChance: .05, critMultiplier: 1.5,
    critCap: .6, attackSpeedCap: .8, shieldCap: .4, slowCap: .6,
    controlWindow: 8, controlScales: [1, .5, .25, 0], bossControlScale: .25,
    skillActionSeconds: .4, splashRadius: 1.5, shareRange: 4.5, encourageRange: 4.5,
    // Stored expedition version keeps unfinished battles on their original tuning.
    enemyHealthMultiplier: 2, runnerSpeedMultiplier: 1.5,
};
/** Shared simulation/render flight time, independent of rank and attack cadence. */
function basicAttackFlight(role, distance) {
    const seconds = role === 'stone' ? .15 : Math.min(1.05, .62 + distance * .045);
    return Math.ceil(seconds / exports.BATTLE_RULES.tickSeconds) * exports.BATTLE_RULES.tickSeconds;
}
const tickTime = (seconds) => Math.max(1, Math.ceil(seconds / exports.BATTLE_RULES.tickSeconds - 1e-9));
const distance = (a, b) => (0, deterministicMath_1.simulationHypot)(a.x - b.x, a.z - b.z);
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const remainingRoute = (s, e) => (e.routeId === undefined ? s.routeLength : s.routeLengths[e.routeId]) - e.distance;
const has = (unit, skill) => unit.skills.includes(skill);
/** Daze adds to the strongest ordinary slow; multiple copies do not multiply. */
const battleSlow = (statuses, tick = -Infinity) => {
    const live = statuses.filter(s => s.kind === 'slow' && s.untilTick > tick);
    const peak = (daze) => live.filter(s => (s.slowGroup === 'daze') === daze).reduce((n, s) => Math.max(n, s.amount), 0);
    return Math.min(exports.BATTLE_RULES.slowCap, peak(false) + peak(true));
};
exports.battleSlow = battleSlow;
const statusAmount = (target, kind) => kind === 'slow' ? (0, exports.battleSlow)(target.statuses) : target.statuses.filter(s => s.kind === kind).reduce((highest, s) => Math.max(highest, s.amount), 0);
const activate = (unit, skill) => { unit.skillActivations[skill] = (unit.skillActivations[skill] || 0) + 1; };
const emit = (state, event) => {
    var _a, _b;
    if (state.contributions && event.sourceId) {
        const actor = state.units.concat(state.benchUnits ?? []).find(u => u.id === event.sourceId);
        if (actor) {
            const row = (_a = state.contributions)[_b = actor.id] ?? (_a[_b] = { name: data_1.ROLES[actor.role].job, damage: 0, healing: 0, shield: 0, reflected: 0, rebirths: 0 });
            if (event.type === 'damage' && state.enemies.some(e => e.id === event.targetId)) {
                row.damage += event.amount ?? 0;
                if (event.skillId === 'reflect')
                    row.reflected += event.amount ?? 0;
            }
            if (event.type === 'heal' && event.effect !== 'enemyHeal') {
                row.healing += event.amount ?? 0;
                if (event.skillId === 'rebirth')
                    row.rebirths++;
            }
        }
    }
    const defined = Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
    state.events.push({ id: state.nextEventId++, tick: state.tick, ...defined });
    // A suspended view must not grow an unbounded event log; simulation counters remain authoritative.
    if (state.events.length > 4096)
        state.events.splice(0, state.events.length - 4096);
};
function seedFor(levelId, wave, units) {
    const source = `${levelId}/${wave}/${units.map(u => `${u.id}:${u.turtle.id}`).join('/')}`;
    let seed = 2166136261;
    for (let i = 0; i < source.length; i++)
        seed = Math.imul(seed ^ source.charCodeAt(i), 16777619);
    return seed >>> 0;
}
function createBattle(levelId, wave, inputs, options = {}) {
    const survivalVersion = options.rulesVersion === '0.6' && (options.roleSurvivalVersion ?? roleSurvival_1.ROLE_SURVIVAL_VERSION) === 1 ? roleSurvival_1.ROLE_SURVIVAL_VERSION : undefined;
    const originalDefinition = (options.rulesVersion === '0.6' ? data_1.BATTLE_MAPS : data_1.LEGACY_BATTLE_MAPS).find(level => level.id === levelId);
    const definition = originalDefinition && (options.formationVersion === 2 ? { ...originalDefinition, slots: (0, expeditionRules_2.expeditionSlots)(levelId) } : originalDefinition);
    if (!definition || !Number.isSafeInteger(wave) || wave < 1 || (!options.expedition && !(options.rulesVersion === '0.6' && options.mode === 'endless') && wave > definition.waves))
        throw new Error('无效关卡或波次');
    if (!options.expedition && options.waveLimit !== undefined && (options.rulesVersion !== '0.6' || (options.mode ?? 'chapter') !== 'chapter' || levelId >= 50 || !(options.waveLimit === 5 || levelId > 0 && options.waveLimit === 8) || wave > options.waveLimit))
        throw new Error('本局波数不合法');
    if (inputs.length > (options.expedition ? definition.slots.length : 5) || new Set(inputs.map(u => u.id)).size !== inputs.length || new Set(inputs.map(u => u.slot)).size !== inputs.length)
        throw new Error('最多五只上阵，个体和位置不可重复');
    for (const input of inputs)
        if (input.placement !== undefined) {
            const issue = (0, placement_1.placementIssue)(definition, input.placement, inputs.filter(o => o !== input).map(o => o.placement ?? definition.slots[o.slot]).filter(Boolean));
            if (issue)
                throw Error(issue);
        }
    const coreHealth = options.coreHealth ?? exports.BATTLE_RULES.coreHealth;
    if (!Number.isFinite(coreHealth) || coreHealth <= 0 || coreHealth > exports.BATTLE_RULES.coreHealth)
        throw new Error('核心耐久不合法');
    const units = inputs.map(input => {
        const turtle = input.turtle;
        if (!Number.isInteger(input.slot) || !definition.slots[input.slot])
            throw new Error('上阵位置不存在');
        const actualLevel = (0, development_1.levelInfo)(turtle).level;
        const role = data_1.ROLES[turtle.role];
        const skills = [...turtle.skills].filter(id => !options.expedition || !Object.values(expeditionRules_2.ADVANCED_ACTIVE).includes(id));
        if (options.expedition && input.fusionRank === 3) {
            const mastery = expeditionRules_2.ADVANCED_ACTIVE[turtle.role], base = data_1.SKILL_BY_ID[mastery].requires;
            if (base && !skills.includes(base)) {
                if (skills.length >= 11)
                    skills.pop();
                skills.push(base);
            }
            if (skills.length >= 12)
                skills.splice(skills.findIndex(id => !data_1.SKILL_BY_ID[id].active), 1);
            skills.push(mastery);
        }
        if (!role || skills.length > 12 || new Set(skills).size !== skills.length || skills.some(id => !data_1.SKILL_BY_ID[id] || ((data_1.SKILL_BY_ID[id].active || data_1.SKILL_BY_ID[id].specialization && id !== 'spirit') && data_1.SKILL_BY_ID[id].role !== turtle.role)))
            throw new Error('技能组合不合法');
        const aptitude = (key) => {
            const value = turtle.innate[key] + turtle.training[key];
            if (!Number.isFinite(value) || value < 60 || value > (turtle.development ? 110 : 100))
                throw new Error('天赋不合法');
            return options.expedition && options.expedition.enemyBalance === undefined ? .8 + .2 * value / 100 : (0, development_1.aptitudeMultiplier)(turtle, key);
        };
        const growth = (turtle.innate.growth + turtle.training.growth) / 100;
        if (!Number.isFinite(growth) || growth < .7 || growth > (turtle.development ? 1.15 : 1.1))
            throw new Error('成长不合法');
        const progression = 1; // Persistent development is applied exactly once, in every mode.
        const bonus = (0, development_1.developmentBonus)(turtle), survival = (0, roleSurvival_1.roleSurvival)(turtle.role, survivalVersion);
        const maxHp = bonus.health * role.health * aptitude('health') * progression * (0, passiveStats_1.passiveMultiplier)(skills, 'strong') * survival.health;
        const unit = {
            ...(input.ownerId ? { ownerId: input.ownerId, fusionRank: input.fusionRank ?? 1 } : {}), qualityTier: (0, prototypeConfig_1.turtleQuality)(turtle).tier, id: input.id, turtleId: turtle.id, role: turtle.role, slot: input.slot, level: actualLevel, skills,
            ...(input.placement ?? definition.slots[input.slot]), ...(input.placement ? { placement: { ...input.placement } } : {}), hp: maxHp, maxHp, shield: 0, shields: [],
            attack: role.attack * aptitude('attack') * progression * bonus.attack,
            armor: (bonus.armor + role.armor * aptitude('defense')) * (0, passiveStats_1.passiveMultiplier)(skills, 'armor') * survival.defense,
            resist: (bonus.resist + role.resist * aptitude('defense')) * (0, passiveStats_1.passiveMultiplier)(skills, 'resist') * survival.defense,
            // One role baseline across cultivation, recruitment and every battle mode.
            range: (0, development_1.petRange)(turtle) * (0, passiveStats_1.passiveMultiplier)(skills, 'reach'),
            interval: role.interval / (1 + Math.min(exports.BATTLE_RULES.attackSpeedCap, skills.includes('swift') ? passiveStats_1.PASSIVE_PERCENT.swift : 0)),
            alive: true, statuses: [], nextAttackTick: 1, actionUntilTick: 0, attackCount: 0,
            cooldowns: {}, skillActivations: {}, lastDamageTick: 0, nextRegenTick: tickTime(5),
            lastShieldUsed: false, cleanseReadyTick: 0, reflectTicks: {}, drainHistory: [],
        };
        if (options.expedition?.coastTrial === 1 && levelId < 5) {
            for (const key of ['hp', 'maxHp', 'attack', 'armor', 'resist'])
                unit[key] *= 10;
        }
        for (const id of ['strong', 'armor', 'resist', 'swift', 'reach'])
            if (skills.includes(id))
                activate(unit, id);
        if (input.sleepUntilWave !== undefined && input.sleepUntilWave > wave) {
            unit.sleepUntilWave = input.sleepUntilWave;
            unit.hp = 0;
            unit.alive = false;
            unit.shields = [];
            unit.shield = 0;
        }
        if (input.fallen && input.sleepUntilWave === undefined) {
            unit.hp = 0;
            unit.alive = false;
        }
        return unit;
    });
    const state = {
        ...(survivalVersion ? { roleSurvivalVersion: survivalVersion } : {}), ...(options.formationVersion ? { formationVersion: options.formationVersion } : {}), ...(options.expedition ? { expedition: JSON.parse(JSON.stringify(options.expedition)) } : {}), version: 1, balanceVersion: 2, mechanicsVersion: 7, ...(definition.sceneRevision ? { sceneRevision: definition.sceneRevision } : {}), ...(options.rulesVersion === '0.6' && options.waveLimit === 5 && levelId > 0 && levelId < 50 ? { chapterBalanceVersion: 1 } : {}), ...(definition.layoutVersion ? { layoutVersion: definition.layoutVersion } : {}), ...(definition.stationVersion ? { stationVersion: definition.stationVersion } : {}), contributions: {}, levelId, wave, status: 'fighting', tick: 0, elapsed: 0, pendingSeconds: 0,
        rng: (options.seed ?? seedFor(levelId, wave, inputs)) >>> 0, coreHealth,
        route: definition.route.map(p => ({ ...p })), routeLength: definition.route.slice(1).reduce((sum, p, i) => sum + distance(p, definition.route[i]), 0),
        units, enemies: [], spawns: (options.expedition ? [] : options.rulesVersion === '0.6' ? (0, prototypeConfig_2.prototypeSpawns)(levelId, wave, options.mode === 'endless', options.waveLimit) : (0, data_1.spawnsForWave)(levelId, wave)).sort((a, b) => a.time - b.time), spawnCursor: 0, nextEnemyId: 1, nextEventId: 1,
        events: [], commands: [], kills: 0, leaked: 0,
    };
    if (options.rulesVersion === '0.6') {
        if (levelId >= 14 && levelId < 50)
            state.tacticsVersion = 1;
        state.faunaVersion = 1;
        state.rulesVersion = '0.6';
        state.mode = options.mode ?? 'chapter';
        state.retiredUnits = [];
    }
    if (options.rulesVersion === '0.6' && levelId > 0 && levelId !== 54)
        state.encounterVersion = 1;
    if (definition.routes) {
        state.routes = definition.routes.map(r => r.map(p => ({ ...p })));
        state.routeLengths = state.routes.map(multiFront_1.pathLength);
        state.spawns = (definition.stationVersion ?? 0) >= 5 || levelId < 50 ? (0, tacticalMaps_1.chapterFronts)(state.spawns, definition, wave) : (0, multiFront_1.assignFronts)(state.spawns, levelId, wave);
    }
    if (state.expedition) {
        state.spawns = (0, expeditionRules_2.trialFronts)(state, (0, tacticalMaps_1.chapterFronts)((0, expeditionRules_2.expeditionSpawns)(state), definition, wave));
        (0, expeditionRules_1.ensureExpeditionCadence)(state);
        (0, expeditionRules_1.scheduleExpeditionWave)(state);
        (0, expeditionRules_2.applyExpeditionStats)(state);
    }
    for (const unit of units)
        if (unit.alive && has(unit, 'openingShield'))
            addShield(state, unit, unit.maxHp * .1, 6, unit.id, 'openingShield');
    return state;
}
/** In-wave deployment shares the normal unit builder and battle clock. */
function replaceBattleUnit(state, input) {
    if (state.rulesVersion !== '0.6' || state.status !== 'fighting')
        throw new Error('当前不能替换战场伙伴');
    if (state.units.some(u => u.id === input.id) || state.retiredUnits?.some(u => u.id === input.id))
        throw new Error('该伙伴本波已出场');
    if (!state.units.some(u => u.slot === input.slot) && state.units.length >= 5)
        throw new Error('场上最多五只，请选择要替换的伙伴');
    const cached = state.benchUnits?.find(u => u.id === input.id);
    const occupied = state.units.find(u => u.slot === input.slot);
    if (occupied && state.storms?.some(s => s.ownerId === occupied.id && s.kind === 'rock' && s.untilTick > state.tick))
        throw new Error('岩石风暴结束后才能换宠');
    for (const u of [cached, occupied])
        if (u && state.tick < (u.moveReadyTick ?? 0))
            throw new Error('伙伴正在调动冷却中');
    const target = input.placement ?? occupied?.placement;
    if (target) {
        const issue = (0, placement_1.placementIssue)((0, data_1.battleMap)(state), target, state.units.filter(u => u !== occupied).map(u => u.placement ?? u));
        if (issue)
            throw Error(issue);
    }
    const fresh = cached ? undefined : createBattle(state.levelId, state.wave, [input], { coreHealth: state.coreHealth, rulesVersion: '0.6', mode: state.mode, roleSurvivalVersion: state.roleSurvivalVersion ?? 0 });
    const unit = cached ?? fresh.units[0], previous = state.units.find(u => u.slot === input.slot);
    state.benchUnits = (state.benchUnits ?? []).filter(u => u.id !== input.id);
    if (previous)
        benchBattleUnit(state, previous.id);
    unit.slot = input.slot;
    delete unit.transfer;
    unit.placement = input.placement ?? previous?.placement;
    if (unit.placement === undefined)
        delete unit.placement;
    Object.assign(unit, unit.placement ?? (0, data_1.battleMap)(state).slots[input.slot]);
    unit.actionUntilTick = Math.max(unit.actionUntilTick, state.tick + 20);
    unit.moveReadyTick = state.tick + 160;
    if (!cached) {
        unit.nextAttackTick += state.tick;
        unit.nextRegenTick += state.tick;
        unit.lastDamageTick = state.tick;
        for (const shield of unit.shields)
            shield.untilTick += state.tick;
    }
    state.units.push(unit);
    for (const event of fresh?.events ?? []) {
        const { id, tick, ...effect } = event;
        emit(state, effect);
    }
}
function benchBattleUnit(state, id) {
    const unit = state.units.find(u => u.id === id);
    if (!unit || state.status !== 'fighting')
        throw new Error('找不到可换下的伙伴');
    if (state.storms?.some(s => s.ownerId === id && s.kind === 'rock' && s.untilTick > state.tick))
        throw new Error('岩石风暴结束后才能换宠');
    if (state.tick < (unit.moveReadyTick ?? 0))
        throw new Error('伙伴正在调动冷却中');
    delete unit.pendingAttack;
    state.units = state.units.filter(u => u.id !== id);
    state.benchUnits ?? (state.benchUnits = []);
    state.benchUnits.push(unit);
    state.commands = state.commands.filter(c => c.unitId !== id);
    for (const enemy of state.enemies)
        if (enemy.blockedBy === id) {
            delete enemy.blockedBy;
            delete enemy.blockOwnerId;
        }
    for (const other of state.units) {
        if (other.encouragedBy === id)
            delete other.encouragedBy;
        if (other.auraTargetId === id)
            delete other.auraTargetId;
    }
}
function retireBenchedBattleUnit(state, id) {
    const unit = state.benchUnits?.find(u => u.id === id);
    if (!unit)
        return;
    state.benchUnits = state.benchUnits.filter(u => u.id !== id);
    state.retiredUnits ?? (state.retiredUnits = []);
    state.retiredUnits.push({ id, skills: [...unit.skills] });
}
function moveBattleUnit(state, id, slot, point) {
    const unit = state.units.find(u => u.id === id);
    if (!unit || !(0, data_1.battleMap)(state).slots[slot] || state.status !== 'fighting')
        throw new Error('当前不能调整站位');
    const other = state.units.find(u => u.id !== id && u.slot === slot), oldSlot = unit.slot;
    if (point) {
        const issue = (0, placement_1.placementIssue)((0, data_1.battleMap)(state), point, state.units.filter(u => u.id !== id).map(u => u.placement ?? u));
        if (issue)
            throw new Error(issue);
    }
    if (!point && state.units.some(u => u.placement)) {
        const target = other?.placement ?? (0, data_1.battleMap)(state).slots[slot], rest = state.units.filter(u => u !== unit && u !== other);
        if (rest.some(u => distance(u.placement ?? u, target) < 1))
            throw Error('目标位置被其他伙伴占用');
    }
    if (slot === oldSlot && !point)
        return;
    const moving = [unit, ...(other ? [other] : [])];
    if (state.storms?.some(s => s.kind === 'rock' && s.untilTick > state.tick && moving.some(u => u.id === s.ownerId)))
        throw new Error('岩石风暴结束后才能调位');
    for (const u of moving) {
        if (statusAmount(u, 'web') > 0 || statusAmount(u, 'root') > 0 || statusAmount(u, 'stun') > 0 || statusAmount(u, 'sheep') > 0)
            throw Error('伙伴被控制，需先净化后调位');
        if (!u.alive)
            throw new Error('倒下的伙伴不能调位');
        if (state.tick < (u.moveReadyTick ?? 0))
            throw new Error(`调位冷却还剩 ${Math.ceil(((u.moveReadyTick ?? 0) - state.tick) * .05)} 秒`);
    }
    for (const u of moving) {
        delete u.pendingAttack;
        u.transfer = { from: { x: u.x, z: u.z }, started: state.tick, ends: state.tick + ((0, expeditionRules_2.isCoastTrial)(state) ? 8 : 20) };
        u.moveReadyTick = state.tick + ((0, expeditionRules_2.isCoastTrial)(state) ? 60 : 160);
        u.actionUntilTick = Math.max(u.actionUntilTick, state.tick + ((0, expeditionRules_2.isCoastTrial)(state) ? 8 : 20));
    }
    const oldPoint = unit.placement;
    unit.slot = slot;
    unit.placement = point ? (0, placement_1.normalizedPoint)(point) : other?.placement ?? (state.formationVersion === 2 ? { ...(0, data_1.battleMap)(state).slots[slot] } : undefined);
    if (unit.placement === undefined)
        delete unit.placement;
    if (other) {
        other.slot = oldSlot;
        other.placement = oldPoint;
        if (other.placement === undefined)
            delete other.placement;
    }
    for (const enemy of state.enemies)
        if (moving.some(u => u.id === enemy.blockedBy)) {
            delete enemy.blockedBy;
            delete enemy.blockOwnerId;
        }
    for (const enemy of state.enemies)
        if (enemy.blockedBy === id || other && enemy.blockedBy === other.id)
            delete enemy.blockedBy;
}
/** Consumes audiovisual events; never needed to advance or recover the simulation. */
function getBattleEvents(state) { return (0, combatTape_1.traceCombat)(state, 'getBattleEvents', [], () => { return state.events.splice(0); }); }
/** A manual cast request is optional; invalid/cooling requests leave the battle unchanged. */
const skillTargetMode = (id) => id === 'hold' ? 'self' : id === 'greatHeal' ? 'team' : (id === 'bubbleRing' || id === 'crystalCannon') ? 'area' : 'enemy';
exports.skillTargetMode = skillTargetMode;
const skillCastRange = (state, u) => (state.stationVersion ?? 0) >= 4 ? Math.min(u.range, { stone: 2.2, spike: 3.8, crystal: 3.6, leaf: 3.5, bubble: 2.8 }[u.role]) : u.range;
exports.skillCastRange = skillCastRange;
const canRevive = (state, u) => has(u, 'leafMastery') && has(u, 'greatHeal') && (u.cooldowns.leafMastery ?? 0) <= state.tick;
function legalSkillTargets(state, unit, skill) {
    if (skill === 'greatHeal')
        return state.units.filter(u => (u.alive ? u.hp < u.maxHp - 1e-8 || cleansePriority(u, state.tick) >= 0 : canRevive(state, unit)) && ((state.stationVersion ?? 0) < 4 || distance(u, unit) <= (0, exports.skillCastRange)(state, unit)));
    if (skill === 'hold')
        return state.enemies.some(e => e.alive && distance(e, unit) <= 2.3) ? [unit] : [];
    return state.enemies.filter(e => e.alive && distance(e, unit) <= (0, exports.skillCastRange)(state, unit)).sort((a, b) => remainingRoute(state, a) - remainingRoute(state, b) || compareId(a, b));
}
function validSkillTarget(state, unit, command) {
    // Availability checks run for every skill button and auto-cast tick. They only
    // need existence, not a sorted target list. Explicit aiming keeps its validation.
    if (command.targetId === undefined && command.point === undefined) {
        const range = (0, exports.skillCastRange)(state, unit);
        if (command.skillId === 'greatHeal')
            return state.units.some(u => (u.alive ? u.hp < u.maxHp - 1e-8 || cleansePriority(u, state.tick) >= 0 : canRevive(state, unit)) && ((state.stationVersion ?? 0) < 4 || distance(u, unit) <= range));
        return state.enemies.some(e => e.alive && distance(e, unit) <= (command.skillId === 'hold' ? 2.3 : range));
    }
    const mode = (0, exports.skillTargetMode)(command.skillId), targets = legalSkillTargets(state, unit, command.skillId);
    if (command.targetId !== undefined && !targets.some(t => t.id === command.targetId))
        return false;
    if (command.point !== undefined) {
        const p = command.point;
        return mode === 'area' && Number.isFinite(p.x) && Number.isFinite(p.z) && distance(p, unit) <= (0, exports.skillCastRange)(state, unit) && (command.skillId === 'bubbleRing' || state.enemies.some(e => e.alive && distance(e, p) <= 1.8));
    }
    return targets.length > 0;
}
function canCommandBattle(state, command) {
    if (state.controlledUnitIds && !state.controlledUnitIds.includes(command.unitId))
        return false;
    const unit = state.units.find(u => u.id === command.unitId && u.alive);
    if (state.status !== 'fighting' || !unit || !has(unit, command.skillId) || !data_1.SKILL_BY_ID[command.skillId]?.active)
        return false;
    if ((unit.cooldowns[command.skillId] || 0) > state.tick || unit.actionUntilTick > state.tick || statusAmount(unit, 'stun') > 0 || statusAmount(unit, 'sheep') > 0 || statusAmount(unit, 'web') > 0)
        return false;
    if (state.commands.some(c => c.unitId === command.unitId))
        return false;
    return validSkillTarget(state, unit, command);
}
function commandBattle(state, command) {
    return (0, combatTape_1.traceCombat)(state, 'commandBattle', [command], () => {
        if (!canCommandBattle(state, command))
            return false;
        state.commands.push({ ...command });
        return true;
    });
}
function focusBattle(state, targetId) {
    return (0, combatTape_1.traceCombat)(state, 'focusBattle', [targetId], () => {
        if (state.status !== 'fighting' || targetId !== undefined && !state.enemies.some(e => e.id === targetId && e.alive))
            return false;
        state.focusTargets ?? (state.focusTargets = {});
        for (const u of state.units) {
            if (u.role === 'leaf' || state.controlledUnitIds && !state.controlledUnitIds.includes(u.id))
                continue;
            if (targetId)
                state.focusTargets[u.id] = targetId;
            else
                delete state.focusTargets[u.id];
        }
        return true;
    });
}
const CLEANSE_PRIORITY = ['web', 'stun', 'sheep', 'root', 'slow', 'weaken', 'armorDown', 'resistDown'];
function cleansePriority(unit, tick) { return CLEANSE_PRIORITY.findIndex(k => unit.statuses.some(s => s.kind === k && s.untilTick > tick)); }
function cleanseOne(state, source, target, ordinaryOnly = false) {
    const kinds = ordinaryOnly ? CLEANSE_PRIORITY.filter(k => !['web', 'stun', 'sheep', 'root'].includes(k)) : CLEANSE_PRIORITY;
    const kind = kinds.find(k => target.statuses.some(s => s.kind === k && s.untilTick > state.tick));
    if (!kind)
        return false;
    target.statuses.splice(target.statuses.findIndex(s => s.kind === kind && s.untilTick > state.tick), 1);
    const surge = (0, expeditionRules_2.buffCount)(state, source, 'cleanseSurge');
    if (surge)
        healDirect(state, source, target, target.maxHp * Math.min(.2, .04 + .04 * surge), 'greatHeal', false);
    emit(state, { type: 'skill', sourceId: source.id, targetId: target.id, skillId: 'greatHeal', effect: 'cleanse', x: target.x, z: target.z });
    return true;
}
function commandAllSkills(state) {
    return (0, combatTape_1.traceCombat)(state, 'commandAllSkills', [], () => {
        let count = 0;
        for (const unit of [...state.units].sort((a, b) => a.slot - b.slot)) {
            const skillId = unit.skills.find(id => data_1.SKILL_BY_ID[id].active);
            if (skillId && commandBattle(state, { type: 'cast', unitId: unit.id, skillId }))
                count++;
        }
        return count;
    });
}
const automaticSkillAllowed = (state, unit) => !!state.controlledUnitIds && !state.controlledUnitIds.includes(unit.id) || (state.autoSkills !== false && !state.manualSkillTurtles?.includes(unit.turtleId) && !((0, expeditionRules_2.isCoastTrial)(state) && state.expedition?.heldRoles?.includes(unit.role)));
function stepBattle(state, dt) {
    return (0, combatTape_1.traceCombat)(state, 'stepBattle', [dt], () => {
        (0, sceneMigration_1.migrateSceneBattle)(state);
        (0, expeditionRules_1.ensureExpeditionCadence)(state);
        if (!Number.isFinite(dt) || dt < 0 || dt > 3600)
            throw new Error('战斗推进时间不合法');
        if (state.status !== 'fighting' || (0, expeditionRules_2.expeditionPaused)(state))
            return state;
        state.pendingSeconds = Math.round((state.pendingSeconds + dt) * 1e12) / 1e12;
        while (state.pendingSeconds + 1e-9 >= exports.BATTLE_RULES.tickSeconds && state.status === 'fighting') {
            state.pendingSeconds = Math.max(0, Math.round((state.pendingSeconds - exports.BATTLE_RULES.tickSeconds) * 1e12) / 1e12);
            state.tick++;
            state.elapsed = state.tick * exports.BATTLE_RULES.tickSeconds;
            stepTick(state);
            if (state.tick % 20 === 0)
                (0, battleHistory_1.compactBattleHistory)(state);
            if ((0, expeditionRules_2.expeditionPaused)(state)) {
                state.pendingSeconds = 0;
                break;
            }
        }
        if (state.status !== 'fighting')
            state.pendingSeconds = 0;
        return state;
    });
}
function stepTick(state) {
    (0, expeditionRules_2.tickExpeditionBuffs)(state);
    if (state.focusTargets)
        for (const id of Object.keys(state.focusTargets))
            if (!state.enemies.some(e => e.id === state.focusTargets[id] && e.alive))
                delete state.focusTargets[id];
    for (const u of state.units.concat(state.benchUnits ?? []))
        tickPrecious(state, u);
    while (state.spawnCursor < state.spawns.length && state.spawns[state.spawnCursor].time <= state.elapsed + 1e-9)
        spawnEnemy(state, state.spawns[state.spawnCursor++]);
    for (const target of [...state.units, ...state.enemies])
        target.statuses = target.statuses.filter(s => s.untilTick > state.tick);
    for (const unit of state.units) {
        const web = unit.statuses.find(s => s.kind === 'web');
        if (web) {
            const source = state.enemies.find(e => e.id === web.sourceId && e.alive);
            if (!source)
                unit.statuses = unit.statuses.filter(s => s !== web);
            else if (unit.alive && state.tick % 20 === 0)
                damageUnit(state, source, unit, unit.maxHp * .09, true, false);
        }
        if (unit.transfer) {
            const t = unit.transfer, p = unit.placement ?? (0, data_1.battleMap)(state).slots[unit.slot], f = Math.min(1, (state.tick - t.started) / (t.ends - t.started));
            unit.x = t.from.x + (p.x - t.from.x) * f;
            unit.z = t.from.z + (p.z - t.from.z) * f;
            if (f >= 1)
                delete unit.transfer;
        }
        unit.shields = unit.shields.filter(s => s.untilTick > state.tick && s.amount > 1e-8);
        unit.shield = unit.shields.reduce((sum, s) => sum + s.amount, 0);
        if (unit.alive && has(unit, 'regen') && state.tick >= unit.nextRegenTick && state.tick - unit.lastDamageTick >= tickTime(5)) {
            const recovered = healDirect(state, unit, unit, unit.maxHp * .01, 'regen', false);
            if (recovered > 0)
                activate(unit, 'regen');
            unit.nextRegenTick = state.tick + tickTime(1);
        }
    }
    updateAuras(state);
    updateMovement(state);
    const commands = state.commands.splice(0);
    for (const unit of state.units) {
        resolveFlyingAttacks(state, unit);
        if (!unit.alive || unit.actionUntilTick > state.tick || statusAmount(unit, 'stun') > 0 || statusAmount(unit, 'sheep') > 0 || statusAmount(unit, 'web') > 0) {
            delete unit.pendingAttack;
            continue;
        }
        const command = commands.find(c => c.unitId === unit.id);
        const active = command?.skillId ?? (automaticSkillAllowed(state, unit) ? unit.skills.find(id => data_1.SKILL_BY_ID[id].active) : undefined);
        if (active && castSkill(state, unit, active, !!command, command)) {
            delete unit.pendingAttack;
            continue;
        }
        if (unit.pendingAttack || state.tick >= unit.nextAttackTick)
            basicAttack(state, unit);
    }
    tickSummons(state);
    for (const enemy of state.enemies) {
        if (!enemy.alive)
            continue;
        if (enemy.mechanismOwner) {
            const owner = state.enemies.find(e => e.id === enemy.mechanismOwner && e.alive);
            if (!owner) {
                enemy.alive = false;
                enemy.hp = 0;
                emit(state, { type: 'defeat', sourceId: enemy.id, targetId: enemy.id, x: enemy.x, z: enemy.z });
                continue;
            }
            if (state.tick % 20 === 0 && distance(enemy, owner) < 5) {
                const amount = Math.min(owner.maxHp * .06, owner.maxHp - owner.hp);
                owner.hp += amount;
                if (amount > 0)
                    emit(state, { type: 'heal', sourceId: enemy.id, targetId: owner.id, amount, effect: 'beaconHeal', x: owner.x, z: owner.z });
            }
            continue;
        }
        tickEnemyAbility(state, enemy);
        if (enemy.slam) {
            if (statusAmount(enemy, 'stun') > 0 || statusAmount(enemy, 'sheep') > 0) {
                delete enemy.slam;
                enemy.actionUntilTick = state.tick;
            }
            else if (state.tick >= enemy.slam.landTick) {
                const p = enemy.slam;
                delete enemy.slam;
                emit(state, { type: 'skill', sourceId: enemy.id, effect: 'crabSlam', x: p.x, z: p.z });
                for (const u of state.units.filter(u => u.alive && distance(u, p) < 1.65)) {
                    damageUnit(state, enemy, u, enemy.attack * .65, false, false);
                    if (u.alive)
                        controlUnit(state, u, .6, enemy.id);
                }
            }
        }
        if (!enemy.cast && !enemy.strike && enemy.trait && state.tick >= (enemy.traitReadyTick ?? Infinity) && statusAmount(enemy, 'stun') <= 0 && statusAmount(enemy, 'sheep') <= 0) {
            enemy.traitReadyTick = state.tick + tickTime(enemy.trait === 'mender' ? 7 : 8);
            if (enemy.trait === 'mender') {
                const ally = state.enemies.filter(e => e.alive && e.id !== enemy.id && distance(e, enemy) < 2.2 && e.hp < e.maxHp * .8).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                if (ally) {
                    const amount = Math.min(ally.maxHp * .08, ally.maxHp - ally.hp);
                    ally.hp += amount;
                    emit(state, { type: 'heal', sourceId: enemy.id, targetId: ally.id, amount, effect: 'enemyMend', x: ally.x, z: ally.z });
                    enemy.actionUntilTick = state.tick + tickTime(.8);
                }
            }
            else if (enemy.trait === 'sprinter') {
                // A visible breath before the dash: root/slow is the counter, not higher raw DPS.
                enemy.actionUntilTick = state.tick + tickTime(.75);
                emit(state, { type: 'skill', sourceId: enemy.id, effect: 'dashTell', x: enemy.x, z: enemy.z });
            }
            else {
                setStatus(state, enemy, 'hold', 45, 2.2, enemy.id);
                enemy.actionUntilTick = state.tick + tickTime(1.3);
                emit(state, { type: 'skill', sourceId: enemy.id, effect: 'shellBrace', x: enemy.x, z: enemy.z });
            }
        }
        if (state.faunaVersion !== 1 && enemy.kind === 'boss' && !enemy.summoned && enemy.hp <= enemy.maxHp * .5 && (!(0, expeditionRules_2.isCoastTrial)(state) || state.wave >= 4)) {
            enemy.summoned = true;
            for (let i = 0; i < 2; i++)
                spawnEnemy(state, { kind: 'runner', time: state.elapsed, hpScale: 1.2, attackScale: 1, ...(enemy.routeId !== undefined ? { routeId: enemy.routeId } : {}) }, Math.max(0, enemy.distance - .5 - i * .4), enemy.originWave);
            emit(state, { type: 'skill', sourceId: enemy.id, effect: 'crabSummon', x: enemy.x, z: enemy.z });
        }
        if (enemy.strike)
            enemyAttack(state, enemy);
        else if (!enemy.cast && state.tick >= enemy.nextAttackTick && statusAmount(enemy, 'stun') <= 0 && statusAmount(enemy, 'sheep') <= 0)
            enemyAttack(state, enemy);
    }
    if (state.coreHealth <= 0)
        state.status = 'lost';
    else if (state.expedition) {
        const e = state.expedition, spawned = state.spawnCursor >= state.spawns.length;
        const living = new Set(state.enemies.filter(v => v.alive).map(v => v.originWave ?? state.wave));
        for (const wave of (0, expeditionRules_1.unclearedExpeditionWaves)(e, state.wave))
            if ((wave < state.wave || spawned) && !living.has(wave))
                (0, expeditionRules_2.expeditionWaveCleared)(state, wave);
        if (e.limit && state.wave >= e.limit && spawned && living.size === 0 && !(0, expeditionRules_2.expeditionPaused)(state))
            state.status = 'won';
        else if ((!e.limit || state.wave < e.limit) && spawned && (!(0, expeditionRules_2.openingWaitsForClear)(e, state.wave) || living.size === 0) && state.tick >= e.nextWaveTick && !(0, expeditionRules_2.expeditionPaused)(state)) {
            state.wave++;
            for (const u of state.units)
                if (!u.alive && u.sleepUntilWave !== undefined && u.sleepUntilWave <= state.wave) {
                    u.alive = true;
                    u.hp = u.maxHp;
                    delete u.sleepUntilWave;
                    u.statuses = [];
                    u.shields = [];
                    u.shield = 0;
                    u.nextAttackTick = state.tick + 20;
                }
            state.spawns = (0, expeditionRules_2.trialFronts)(state, (0, tacticalMaps_1.chapterFronts)((0, expeditionRules_2.expeditionSpawns)(state), (0, data_1.battleMap)(state), state.wave));
            state.spawnCursor = 0;
            (0, expeditionRules_1.scheduleExpeditionWave)(state);
        }
    }
    else if (state.levelId === 56) {
        if (state.tick >= 1800)
            state.status = 'won';
    }
    else if (state.levelId === 55) {
        if (state.tick >= 3600)
            state.status = state.enemies.filter(e => e.alive).length <= 15 ? 'won' : 'lost';
    }
    else if (state.spawnCursor >= state.spawns.length && state.enemies.every(e => !e.alive))
        state.status = 'won';
    if (state.status !== 'fighting')
        emit(state, { type: 'waveEnd', amount: state.coreHealth, effect: state.status });
}
function positionOnRoute(state, progress, routeId) {
    const route = routeId === undefined ? state.route : state.routes?.[routeId];
    if (!route)
        throw new Error('出怪路线不存在');
    for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i], length = distance(from, to);
        if (length < 1e-9)
            continue;
        if (progress <= length)
            return { x: from.x + (to.x - from.x) * progress / length, z: from.z + (to.z - from.z) * progress / length };
        progress -= length;
    }
    return { ...route[route.length - 1] };
}
function spawnEnemy(state, spawn, progress = 0, originWave = state.wave) {
    const definition = data_1.ENEMIES[spawn.kind];
    const range = state.balanceVersion === undefined && spawn.kind === 'snail' ? 3.5 : definition.range;
    const enemy = {
        ...(state.expedition ? { originWave } : {}),
        id: `enemy-${state.wave}-${state.nextEnemyId++}`, kind: spawn.kind, ...positionOnRoute(state, progress, spawn.routeId), distance: progress, ...(spawn.routeId !== undefined ? { routeId: spawn.routeId } : {}),
        ...(spawn.bounty ? { expeditionBounty: true, ...(spawn.rations !== undefined ? { rations: spawn.rations } : {}) } : {}), hp: definition.health * spawn.hpScale, maxHp: definition.health * spawn.hpScale,
        attack: definition.attack * spawn.attackScale, armor: definition.armor + ((state.stationVersion ?? 0) >= 4 ? 12 : 0), resist: definition.resist + ((state.stationVersion ?? 0) >= 4 ? 8 : 0),
        speed: definition.speed * ((state.stationVersion ?? 0) >= 4 && spawn.kind === 'boss' ? 1.55 : 1) * (state.layoutVersion === 2 ? (state.levelId === 0 ? ((state.stationVersion ?? 0) >= 4 ? 1.23 : 1.03) : state.levelId < 50 ? (state.encounterVersion === 1 ? 1.10 : 1.38) : 1.12) : 1), range, interval: definition.interval, leak: definition.leak,
        alive: true, statuses: [], nextAttackTick: state.tick, actionUntilTick: 0, attackCount: 0,
        controlWindowUntilTick: 0, controlCount: 0, summoned: false,
    };
    if (state.encounterVersion === 1 && state.nextEnemyId % 3 === 0) {
        const trait = enemy.kind === 'snail' ? 'mender' : enemy.kind === 'runner' ? 'sprinter' : enemy.kind === 'armored' ? 'bulwark' : undefined;
        if (trait) {
            enemy.trait = trait;
            enemy.traitReadyTick = state.tick + tickTime(3.5);
        }
    }
    if ((state.stationVersion ?? 0) >= 4 && state.levelId === 0 && spawn.kind === 'boss')
        enemy.bossId = (0, bossCatalog_1.bossFor)(0, state.wave).id;
    if (state.encounterVersion === 1 && spawn.kind === 'boss') {
        const boss = (0, bossCatalog_1.bossFor)(state.levelId, state.wave, (state.history?.bosses ?? 0) + state.enemies.filter(e => e.kind === 'boss').length);
        enemy.bossId = boss.id;
        enemy.hp *= boss.hp;
        enemy.maxHp = enemy.hp;
        enemy.speed *= .64;
        enemy.trait = boss.trait;
        enemy.traitReadyTick = state.tick + tickTime(5);
    }
    if (state.chapterBalanceVersion === 1) {
        if (spawn.kind === 'boss') {
            const budget = releaseBalance_1.RELEASE_BALANCE.chapter;
            enemy.hp = enemy.maxHp = (budget.bossHealthBase + state.levelId * budget.bossHealthPerLevel) * (state.wave === 5 ? budget.bossFinalMultiplier : 1) * (1 + .06 * (state.wave - 1));
            enemy.speed = (state.routeLengths?.[spawn.routeId ?? 0] ?? state.routeLength) / 34;
        }
        else
            enemy.speed *= 1.12;
    }
    if (state.faunaVersion === 1) {
        if (enemy.bossId)
            enemy.abilityReadyTick = state.tick + tickTime(4);
        else if (enemy.kind === 'elite' || enemy.kind === 'mist')
            enemy.abilityReadyTick = state.tick + tickTime(5);
        if (state.encounterVersion === 1 && enemy.kind === 'runner' && !enemy.trait) {
            enemy.trait = 'sprinter';
            enemy.traitReadyTick = state.tick + tickTime(5);
        }
    }
    if ((0, expeditionRules_2.isCoastTrial)(state)) {
        // Slow readable packs. Elites carry the durability; trash remains clearable.
        enemy.speed *= enemy.kind === 'runner' ? .65 : .48;
        enemy.interval *= state.wave <= 2 ? 2.3 : 1.7;
        enemy.attack *= state.wave <= 2 ? 1.25 : enemy.kind === 'boss' ? 1.2 : 1.7;
        if (state.wave >= 3)
            enemy.range = Math.max(enemy.range, 1.3);
        if (state.levelId === 0 && state.wave >= 4 && enemy.kind === 'snail')
            enemy.range = 4.5;
        if (state.levelId === 0 && state.wave >= 5 && enemy.kind === 'elite')
            enemy.range = 3.2;
        if (state.levelId === 0 && state.wave >= 5 && enemy.kind === 'boss')
            enemy.range = 4.5;
        if (state.levelId === 0 && state.wave >= 7 && ['boss', 'elite'].includes(enemy.kind))
            enemy.attack *= 1 + (state.wave - 6) * .1;
        if (enemy.kind === 'boss') {
            enemy.leak = state.levelId === 0 && state.wave >= 9 ? 10 : 5;
            enemy.hp = enemy.maxHp = definition.health * spawn.hpScale * 1.2;
            enemy.speed = (state.routeLengths?.[spawn.routeId ?? 0] ?? state.routeLength) / 48;
        }
        enemy.nextAttackTick = state.tick + tickTime(1.2);
        delete enemy.trait;
        delete enemy.traitReadyTick;
        enemy.abilityReadyTick = ((state.levelId >= 2 && state.wave >= 3 || state.levelId === 0 && state.wave >= 5) && ['boss', 'elite'].includes(enemy.kind) || state.levelId >= 3 && state.wave >= 4 && enemy.kind === 'mist') ? state.tick + tickTime(3) : undefined;
        for (const key of ['hp', 'maxHp', 'attack', 'armor', 'resist'])
            enemy[key] *= 10;
    }
    if (state.expedition?.enemyBalance !== undefined) {
        enemy.hp *= exports.BATTLE_RULES.enemyHealthMultiplier;
        enemy.maxHp *= exports.BATTLE_RULES.enemyHealthMultiplier;
        // Later chapter openings need time to recruit before the back-half stat check.
        if (state.expedition.kind === 'chapter' && !(0, expeditionRules_2.isCoastTrial)(state)) {
            const revised = state.expedition.enemyBalance === 2;
            enemy.speed *= enemy.kind === 'runner' ? .8 : revised ? (enemy.kind === 'boss' ? 1 : .72) : .6;
            // Equivalent boss travel pressure with shorter, more readable engagements.
            if (revised && enemy.kind === 'boss') {
                enemy.hp *= .6;
                enemy.maxHp = enemy.hp;
            }
        }
        if (enemy.kind === 'runner')
            enemy.speed *= exports.BATTLE_RULES.runnerSpeedMultiplier;
    }
    state.enemies.push(enemy);
    if (state.faunaVersion === 1) {
        const profile = (0, enemyCombat_1.enemyCombat)(enemySpeciesKey(state, enemy));
        if (profile.ranged)
            enemy.range = Math.max(enemy.range, 2.8);
        if (!(0, expeditionRules_2.isCoastTrial)(state) || state.wave >= 3)
            enemy.abilityReadyTick ?? (enemy.abilityReadyTick = state.tick + tickTime(7 + (state.nextEnemyId % 4) * 1.3));
    }
    emit(state, { type: 'spawn', sourceId: enemy.id, x: enemy.x, z: enemy.z, effect: enemy.kind });
    return enemy;
}
/** Rendering and simulation resolve the exact same species, including old saves. */
function enemySpeciesKey(state, e) {
    if (e.worldBossIndex !== undefined)
        return (0, enemyG1Catalog_1.worldG1)(e.worldBossIndex).key;
    if (e.kind === 'boss')
        return (0, enemyG1Catalog_1.enemyG1)(bossCatalog_1.BOSSES.find(b => b.id === e.bossId)?.assetId ?? 'B01').key;
    const pool = (0, enemyG1Catalog_1.mobG1Pool)(state.levelId, e.kind), ordinal = Number(e.id.split('-').pop()) || 0;
    return pool[Math.abs(ordinal) % Math.max(1, pool.length)]?.key ?? 'g1-m02';
}
function tickSpeciesAbility(s, e) {
    const profile = (0, enemyCombat_1.enemyCombat)(enemySpeciesKey(s, e)), trial = (0, expeditionRules_2.isCoastTrial)(s);
    if (e.cast) {
        const c = e.cast;
        if (!c.area || !c.style) {
            delete e.cast;
            return;
        }
        if (statusAmount(e, 'stun') > 0 || statusAmount(e, 'sheep') > 0) {
            delete e.cast;
            e.actionUntilTick = s.tick;
            emit(s, { type: 'control', sourceId: e.id, targetId: e.id, effect: 'castInterrupted', x: e.x, z: e.z });
            return;
        }
        if (!c.released && s.tick >= c.landTick - tickTime(.30)) {
            c.released = true;
            emit(s, { type: 'skill', sourceId: e.id, effect: 'enemyRelease', x: c.x, z: c.z, enemyArea: c.area, enemyStyle: c.style, duration: .30 });
        }
        if (s.tick < c.landTick)
            return;
        delete e.cast;
        emit(s, { type: 'skill', sourceId: e.id, effect: 'enemyCast', x: c.x, z: c.z, enemyArea: c.area, enemyStyle: c.style });
        if (c.style === 'healingPulse' || c.style === 'guardPulse') {
            for (const ally of s.enemies.filter(a => a.alive && distance(a, e) <= 2.6)) {
                if (c.style === 'healingPulse') {
                    const amount = Math.min(ally.maxHp - ally.hp, ally.maxHp * .06);
                    ally.hp += amount;
                    if (amount > 0)
                        emit(s, { type: 'heal', sourceId: e.id, targetId: ally.id, amount, effect: 'enemyMend', x: ally.x, z: ally.z });
                }
                else {
                    setStatus(s, ally, 'hold', 25 * (0, expeditionRules_2.combatScale)(s), 3, e.id);
                    emit(s, { type: 'shield', sourceId: e.id, targetId: ally.id, amount: 0, effect: 'shellBrace', x: ally.x, z: ally.z });
                }
            }
            return;
        }
        if (c.style === 'rally') {
            if (s.enemies.filter(a => a.alive).length < 40)
                for (let i = 0; i < 2; i++)
                    spawnEnemy(s, { kind: 'runner', time: s.elapsed, hpScale: 1, attackScale: .8, ...(e.routeId !== undefined ? { routeId: e.routeId } : {}) }, Math.max(0, e.distance - .4 - i * .4), e.originWave);
            return;
        }
        for (const u of s.units.filter(u => u.alive && (0, enemyCombat_1.enemyAreaContains)(c.area, u))) {
            const magical = /Breath|ink|liquid|lightning|fireRain|frostRain|poison/.test(c.style), physical = ['clawSweep', 'hornRush', 'slam', 'groundSpikes', 'spikeRain', 'spikeShot', 'shellBomb', 'tentacleLash'].includes(c.style);
            const scale = e.kind === 'boss' ? 1.1 : e.kind === 'elite' ? .85 : .65;
            damageUnit(s, e, u, e.attack * scale, magical && !physical, false, true, trial ? u.maxHp * .45 : Infinity);
            if (!u.alive)
                continue;
            if (c.style === 'web' && (u.trialControlReadyTick ?? 0) <= s.tick) {
                setStatus(s, u, 'web', 1, trial ? 2 : 3, e.id);
                u.trialControlReadyTick = s.tick + tickTime(8);
                emit(s, { type: 'control', sourceId: e.id, targetId: u.id, effect: 'web', amount: trial ? 2 : 3, x: u.x, z: u.z });
            }
            else if (/poison|ink/.test(c.style))
                setStatus(s, u, 'weaken', .15, 3, e.id);
            else if (/frost/.test(c.style))
                setStatus(s, u, 'slow', .25, 3, e.id);
            else if (c.style === 'groundSpikes' || c.style === 'spikeShot')
                setStatus(s, u, 'armorDown', 10 * (0, expeditionRules_2.combatScale)(s), 3, e.id);
        }
        return;
    }
    if (e.strike || s.tick < (e.abilityReadyTick ?? Infinity) || s.tick < e.actionUntilTick || statusAmount(e, 'stun') > 0 || statusAmount(e, 'sheep') > 0)
        return;
    // Opening packs retain a development window, and early training never overlaps danger zones.
    if (trial && s.enemies.some(other => other !== e && other.alive && other.cast))
        return;
    const support = ['healingPulse', 'guardPulse', 'rally'].includes(profile.skill), reach = profile.area.shape === 'circle' ? 5 : profile.area.length;
    const target = s.units.filter(u => u.alive && distance(u, e) <= reach).sort((a, b) => distance(a, e) - distance(b, e) || compareId(a, b))[0];
    if (!support && !target)
        return;
    const area = (0, enemyCombat_1.enemyAttackArea)(profile, e, support ? e : target), windup = trial ? 2 : profile.windup;
    e.cast = { kind: 'shock', x: area.shape === 'circle' ? area.x : e.x + area.dx * area.length, z: area.shape === 'circle' ? area.z : e.z + area.dz * area.length, area, style: profile.skill, landTick: s.tick + tickTime(windup) };
    e.abilityReadyTick = s.tick + tickTime(profile.cooldown);
    e.actionUntilTick = e.cast.landTick + tickTime(.4);
    e.nextAttackTick = Math.max(e.nextAttackTick, e.actionUntilTick);
    emit(s, { type: 'skill', sourceId: e.id, effect: 'enemyTell', x: e.cast.x, z: e.cast.z, enemyArea: area, enemyStyle: profile.skill, duration: windup });
}
function tickEnemyAbility(state, e) {
    if (state.faunaVersion !== 1)
        return;
    if (!e.turtleRole) {
        tickSpeciesAbility(state, e);
        return;
    }
    if (e.cast) {
        if (statusAmount(e, 'stun') > 0 || statusAmount(e, 'sheep') > 0) {
            delete e.cast;
            if ((0, expeditionRules_2.isCoastTrial)(state)) {
                setStatus(state, e, 'armorDown', 25, 3, e.id);
                setStatus(state, e, 'resistDown', 25, 3, e.id);
            }
            emit(state, { type: 'control', sourceId: e.id, targetId: e.id, amount: 0, effect: 'castInterrupted', x: e.x, z: e.z });
            return;
        }
        if (state.tick < e.cast.landTick)
            return;
        const c = e.cast;
        delete e.cast;
        for (const p of c.points ?? [c])
            emit(state, { type: 'skill', sourceId: e.id, effect: 'boss-' + c.kind, x: p.x, z: p.z });
        if (c.kind === 'rally') {
            if (state.enemies.filter(v => v.alive).length < 50)
                for (let i = 0; i < 2; i++)
                    spawnEnemy(state, { kind: i ? 'runner' : 'armored', time: state.elapsed, hpScale: Math.max(1, e.maxHp / 2400 * .1), attackScale: .8, ...(e.routeId !== undefined ? { routeId: e.routeId } : {}) }, Math.max(0, e.distance - .4 - i * .45), e.originWave);
            return;
        }
        if (c.kind === 'beacon') {
            if (!state.enemies.some(v => v.alive && v.mechanismOwner === e.id)) {
                const beacon = spawnEnemy(state, { kind: 'snail', time: state.elapsed, hpScale: 1, attackScale: 0, ...(e.routeId !== undefined ? { routeId: e.routeId } : {}) }, Math.min(e.distance + 1, state.routeLengths?.[e.routeId ?? 0] ?? state.routeLength), e.originWave);
                beacon.mechanismOwner = e.id;
                beacon.hp = beacon.maxHp = 130 + state.levelId * 5;
                beacon.speed = 0;
                beacon.attack = 0;
                beacon.range = 0;
                beacon.trait = undefined;
                beacon.abilityReadyTick = undefined;
                beacon.leak = 0;
            }
            return;
        }
        if (c.kind === 'web' || c.kind === 'fireRain') {
            const points = c.points ?? [c];
            for (const u of state.units.filter(u => u.alive && points.some(p => distance(u, p) <= 1.2))) {
                const trial = (0, expeditionRules_2.isCoastTrial)(state), hit = trial ? (c.kind === 'fireRain' ? e.attack * 3 : e.attack * .5) : c.kind === 'fireRain' ? u.maxHp * 1.05 + e.attack * 2 : e.attack;
                // A healthy turtle can be rescued; an already injured one still needs a dodge or shield.
                damageUnit(state, e, u, hit, trial ? false : true, false, true, trial && c.kind === 'fireRain' ? u.maxHp * .65 : Infinity);
                if (u.alive && c.kind === 'web' && (!trial || (u.trialControlReadyTick ?? 0) <= state.tick)) {
                    const duration = trial ? 2.5 : 6;
                    setStatus(state, u, 'web', 1, duration, e.id);
                    if (trial)
                        u.trialControlReadyTick = state.tick + tickTime(8);
                    else
                        setStatus(state, u, 'resistDown', 20, 6, e.id);
                    emit(state, { type: 'control', sourceId: e.id, targetId: u.id, amount: duration, effect: 'web', x: u.x, z: u.z });
                }
            }
            return;
        }
        const radius = c.kind === 'drain' ? 2.6 : 1.5;
        for (const u of state.units.filter(u => u.alive && distance(u, c) <= radius)) {
            if (c.kind === 'shock') {
                for (const shield of u.shields)
                    shield.amount *= .5;
                u.shield = u.shields.reduce((n, a) => n + a.amount, 0);
            }
            const dealt = damageUnit(state, e, u, e.attack * (c.kind === 'mortar' ? 1.2 : c.kind === 'drain' ? .55 : .8), c.kind === 'frost' || c.kind === 'drain' || c.kind === 'mortar', false);
            if (c.kind === 'drain') {
                const healed = Math.min(e.maxHp - e.hp, dealt * .8);
                e.hp += healed;
                if (healed > 0)
                    emit(state, { type: 'heal', sourceId: u.id, targetId: e.id, amount: healed, effect: 'siphon', x: e.x, z: e.z });
            }
            if (u.alive && c.kind === 'shock')
                setStatus(state, u, 'weaken', .15, 3, e.id);
            if (u.alive && c.kind === 'frost')
                controlUnit(state, u, .85, e.id);
            if (u.alive && c.kind === 'breakwater')
                setStatus(state, u, 'armorDown', 15, 3, e.id);
        }
        return;
    }
    if (state.tick < (e.abilityReadyTick ?? Infinity) || statusAmount(e, 'stun') > 0 || statusAmount(e, 'sheep') > 0 || e.slam)
        return;
    if ((0, expeditionRules_2.isCoastTrial)(state)) {
        // Never overlap major tells: a free station and time to react must remain.
        if (state.enemies.some(other => other !== e && other.alive && other.cast))
            return;
        const nearby = state.units.filter(u => u.alive && distance(u, e) < 5);
        const kind = e.kind === 'mist' || state.levelId >= 3 && (e.tacticCount ?? 0) % 2 === 1 ? 'web' : 'fireRain';
        nearby.sort((a, b) => kind === 'web' ? Number(b.role === 'leaf') - Number(a.role === 'leaf') || distance(a, e) - distance(b, e) : distance(a, e) - distance(b, e));
        const target = nearby.find(u => kind !== 'web' || (u.trialControlReadyTick ?? 0) <= state.tick);
        if (!target)
            return;
        e.tacticCount = (e.tacticCount ?? 0) + 1;
        e.cast = { kind, x: target.x, z: target.z, landTick: state.tick + tickTime(2) };
        e.abilityReadyTick = state.tick + tickTime(12);
        e.actionUntilTick = e.cast.landTick + tickTime(.4);
        emit(state, { type: 'skill', sourceId: e.id, effect: 'bossTell-' + kind, x: target.x, z: target.z, radius: 1.2, duration: 2 });
        return;
    }
    const boss = bossCatalog_1.BOSSES.find(b => b.id === e.bossId);
    if (state.tacticsVersion === 1 && e.kind === 'boss' && state.wave >= 3 && !boss) {
        const choices = state.levelId < 24 ? ['web'] : state.levelId < 29 ? ['fireRain'] : state.levelId < 34 ? ['web', 'fireRain'] : state.levelId < 39 ? ['beacon', 'fireRain'] : ['beacon', 'web', 'fireRain'];
        const count = e.tacticCount ?? 0, kind = choices[count % choices.length], nearby = state.units.filter(u => u.alive && distance(u, e) < 5).sort((a, b) => distance(a, e) - distance(b, e));
        if (!nearby.length)
            return;
        e.tacticCount = count + 1;
        const targets = kind === 'beacon' ? [e] : kind === 'fireRain' ? nearby.slice(0, state.levelId >= 44 ? 3 : 2) : nearby.slice(0, state.levelId >= 29 ? 2 : 1), points = targets.map(u => ({ x: u.x, z: u.z }));
        e.cast = { kind, ...points[0], points, landTick: state.tick + tickTime(2) };
        e.abilityReadyTick = state.tick + tickTime(kind === 'web' && choices.length > 1 ? 5 : 10);
        e.actionUntilTick = e.cast.landTick + tickTime(.25);
        for (const p of points)
            emit(state, { type: 'skill', sourceId: e.id, effect: 'bossTell-' + kind, x: p.x, z: p.z, radius: kind === 'drain' ? 2.6 : kind === 'web' || kind === 'fireRain' ? 1.2 : 1.5, duration: 2 });
        return;
    }
    const kind = boss?.ability ?? (e.kind === 'mist' ? 'frost' : e.kind === 'ink' ? 'drain' : e.kind === 'snail' ? 'mortar' : e.kind === 'armored' ? 'breakwater' : 'shock');
    const nearby = state.units.filter(u => u.alive && distance(u, e) < (kind === 'mortar' ? 5 : 3.3));
    const target = nearby.sort((a, b) => kind === 'mortar' ? distance(b, e) - distance(a, e) : distance(a, e) - distance(b, e))[0];
    if (!target)
        return;
    const p = kind === 'rally' || kind === 'drain' ? e : target;
    e.cast = { kind, x: p.x, z: p.z, landTick: state.tick + tickTime(1.35) };
    e.abilityReadyTick = state.tick + tickTime(boss ? 11 : 13);
    e.actionUntilTick = e.cast.landTick + tickTime(.25);
    emit(state, { type: 'skill', sourceId: e.id, effect: 'bossTell-' + kind, x: p.x, z: p.z, radius: kind === 'drain' ? 2.6 : kind === 'web' || kind === 'fireRain' ? 1.2 : 1.5, duration: 1.35 });
}
function updateAuras(state) {
    for (const unit of state.units)
        delete unit.encouragedBy;
    for (const source of state.units.filter(u => u.alive && has(u, 'encourage')).sort(compareId)) {
        const radius = state.balanceVersion === 2 ? exports.BATTLE_RULES.encourageRange : 3;
        const candidates = state.units.filter(u => u.alive && u !== source && distance(source, u) <= radius).sort((a, b) => distance(source, a) - distance(source, b) || compareId(a, b));
        const target = candidates.find(u => !u.encouragedBy) ?? candidates[0];
        if (target && !target.encouragedBy) {
            target.encouragedBy = source.id;
            if (source.auraTargetId !== target.id) {
                activate(source, 'encourage');
                emit(state, { type: 'skill', sourceId: source.id, targetId: target.id, skillId: 'encourage', effect: 'encourage', x: target.x, z: target.z });
            }
        }
        if (target)
            source.auraTargetId = target.id;
        else
            delete source.auraTargetId;
    }
}
function updateMovement(state) {
    for (const unit of state.units)
        triggerTaunt(state, unit);
    const blocking = {};
    const held = (e) => !!e.blockOwnerId && state.tick < (e.blockUntilTick ?? 0) && state.units.some(u => u.id === e.blockOwnerId && u.alive && distance(u, e) <= (state.encounterVersion === 1 ? u.range : data_1.ROLES.stone.range));
    for (const enemy of state.enemies.filter(e => e.alive).sort((a, b) => Number(held(b)) - Number(held(a)) || b.distance - a.distance || compareId(a, b))) {
        delete enemy.blockedBy;
        let blocker;
        if (state.mechanicsVersion === 7) {
            if (enemy.blockOwnerId && state.tick < (enemy.blockUntilTick ?? 0))
                blocker = state.units.find(u => u.id === enemy.blockOwnerId && u.alive && !u.transfer && distance(u, enemy) <= (state.encounterVersion === 1 ? u.range : data_1.ROLES.stone.range));
            if (!enemy.blockOwnerId) {
                blocker = state.units.filter(u => u.alive && !u.transfer && u.role === 'stone' && (blocking[u.id] ?? 0) < (0, exports.blockCapacity)(u, state.tick) && distance(u, enemy) <= (state.encounterVersion === 1 ? u.range : data_1.ROLES.stone.range)).sort((a, b) => distance(enemy, a) - distance(enemy, b) || compareId(a, b))[0];
                if (blocker) {
                    enemy.blockOwnerId = blocker.id;
                    enemy.blockUntilTick = state.tick + tickTime(3);
                }
            }
            if (blocker && (blocking[blocker.id] ?? 0) >= (0, exports.blockCapacity)(blocker, state.tick))
                blocker = undefined;
        }
        else
            blocker = state.units.filter(u => u.alive && !u.transfer && u.role === 'stone' && (blocking[u.id] ?? 0) < 2 && distance(u, enemy) <= (state.encounterVersion === 1 ? u.range : data_1.ROLES.stone.range)).sort((a, b) => distance(enemy, a) - distance(enemy, b))[0];
        if (blocker) {
            enemy.blockedBy = blocker.id;
            blocking[blocker.id] = (blocking[blocker.id] || 0) + 1;
        }
        if (!blocker && enemy.actionUntilTick <= state.tick && statusAmount(enemy, 'root') <= 0 && statusAmount(enemy, 'stun') <= 0) {
            const dash = enemy.trait === 'sprinter' && state.tick >= (enemy.traitReadyTick ?? 0) - tickTime(7.25) && state.tick < (enemy.traitReadyTick ?? 0) - tickTime(5.8) && statusAmount(enemy, 'slow') === 0 ? 1.45 : 1;
            enemy.distance += enemy.speed * dash * (1 - Math.min(exports.BATTLE_RULES.slowCap, statusAmount(enemy, 'slow'))) * exports.BATTLE_RULES.tickSeconds;
            if (state.levelId === 55 && enemy.distance >= state.routeLength)
                enemy.distance %= state.routeLength;
            Object.assign(enemy, positionOnRoute(state, enemy.distance, enemy.routeId));
        }
        if (enemy.distance >= (enemy.routeId === undefined ? state.routeLength : state.routeLengths[enemy.routeId])) {
            enemy.alive = false;
            state.coreHealth = Math.max(0, state.coreHealth - enemy.leak);
            state.leaked++;
            emit(state, { type: 'leak', sourceId: enemy.id, amount: enemy.leak, x: enemy.x, z: enemy.z });
        }
    }
}
function targetEnemy(state, unit) {
    const taunt = unit.statuses.find(s => s.kind === 'taunt' && s.untilTick > state.tick), forced = taunt && state.enemies.find(e => e.id === taunt.sourceId && e.alive && distance(e, unit) <= unit.range);
    if (forced)
        return forced;
    const focus = state.enemies.find(e => e.id === state.focusTargets?.[unit.id] && e.alive && distance(e, unit) <= unit.range);
    if (focus)
        return focus;
    let target, remaining = Infinity;
    for (const e of state.enemies) {
        if (!e.alive || distance(e, unit) > unit.range)
            continue;
        const route = remainingRoute(state, e);
        if (!target || route < remaining || route === remaining && compareId(e, target) < 0) {
            target = e;
            remaining = route;
        }
    }
    return target;
}
function targetPatient(state, unit, excludedId) {
    let target, ratio = Infinity;
    for (const u of state.units) {
        if (!u.alive || u.id === excludedId || distance(u, unit) > unit.range || !(u.hp < u.maxHp - 1e-8 || has(unit, 'cleanse') && u.statuses.some(s => s.kind !== 'hold')))
            continue;
        const health = u.hp / u.maxHp;
        if (!target || health < ratio || health === ratio && compareId(u, target) < 0) {
            target = u;
            ratio = health;
        }
    }
    return target;
}
function power(unit) { return unit.attack * (unit.encouragedBy ? 1.08 : 1) * (1 - statusAmount(unit, 'weaken')) * (1 + statusAmount(unit, 'giant')); }
function attackInterval(unit) { return unit.interval / (1 + statusAmount(unit, 'fervor')) / (statusAmount(unit, 'giant') > 0 ? .55 : 1); }
function tickPrecious(state, u) {
    if (u.giantBaseMaxHp !== undefined && !u.statuses.some(s => s.kind === 'giant' && s.untilTick > state.tick)) {
        u.hp = Math.min(u.giantBaseMaxHp, u.hp / u.maxHp * u.giantBaseMaxHp);
        u.maxHp = u.giantBaseMaxHp;
        for (const shield of u.shields)
            shield.amount /= 1.6;
        u.shield = u.shields.reduce((sum, s) => sum + s.amount, 0);
        delete u.giantBaseMaxHp;
    }
    if (u.alive && u.statuses.some(s => s.kind === 'fervor' && s.untilTick > state.tick) && state.tick % 3 === 0) {
        for (const id of u.skills)
            if (data_1.SKILL_BY_ID[id].active && (u.cooldowns[id] ?? 0) > state.tick)
                u.cooldowns[id]--;
    }
}
function resolveFlyingAttacks(state, unit) {
    if (!unit.flyingAttacks?.length)
        return;
    const ready = (unit.flyingAttacks ?? []).filter(p => state.tick >= p.landTick);
    unit.flyingAttacks = (unit.flyingAttacks ?? []).filter(p => state.tick < p.landTick);
    if (!unit.flyingAttacks.length)
        delete unit.flyingAttacks;
    for (const shot of ready)
        basicAttack(state, unit, shot);
}
function basicAttack(state, unit, impactShot) {
    if (!impactShot && state.duelUnits && unit.role !== 'leaf') {
        const own = state.duelTeamA.includes(unit.id), pet = state.summons?.filter(p => p.alive && state.duelTeamA.includes(p.ownerId) !== own && distance(p, unit) <= unit.range).sort((a, b) => distance(a, unit) - distance(b, unit))[0];
        const main = targetEnemy(state, unit);
        if (pet && (!main || distance(pet, unit) < distance(main, unit))) {
            if (state.tick < unit.nextAttackTick)
                return;
            delete unit.pendingAttack;
            unit.nextAttackTick = state.tick + tickTime(attackInterval(unit));
            unit.attackCount++;
            const magic = unit.role === 'crystal' || unit.role === 'bubble', amount = pet.kind === 'golem' ? 0 : Math.min(pet.hp, power(unit) * 100 / (100 + (magic ? pet.resist : pet.armor)));
            pet.hp -= amount;
            pet.alive = pet.hp > 0;
            emit(state, { type: 'attack', sourceId: unit.id, targetId: pet.id, x: pet.x, z: pet.z, effect: unit.role });
            emit(state, { type: 'damage', sourceId: unit.id, targetId: pet.id, amount, x: pet.x, z: pet.z });
            return;
        }
    }
    const pending = impactShot ?? unit.pendingAttack;
    // Healing keeps priority, but a healthy party no longer leaves the healer idle.
    // A committed projectile retains its original healing/damage kind until impact.
    const patient = unit.role === 'leaf' ? pending ? (pending.healing ? state.units.find(u => u.id === pending.targetId && u.alive) : undefined) : targetPatient(state, unit) : undefined;
    if (state.balanceVersion === undefined && unit.role === 'leaf' && !patient)
        return;
    const target = pending ? (pending.healing ? undefined : state.enemies.find(e => e.id === pending.targetId && e.alive)) : patient ? undefined : targetEnemy(state, unit);
    if (!patient && !target) {
        if (!impactShot)
            delete unit.pendingAttack;
        return;
    }
    const aim = patient ?? target;
    if (state.layoutVersion === 2 && !impactShot) {
        if (!pending) {
            const windup = Math.max(1, tickTime(Math.min(.25, attackInterval(unit) * .4)));
            unit.pendingAttack = { targetId: aim.id, healing: !!patient, launchTick: state.tick + windup, landTick: state.tick + windup + tickTime(basicAttackFlight(unit.role, distance(unit, aim))), launched: false };
            unit.nextAttackTick = state.tick + tickTime(attackInterval(unit));
            emit(state, { type: 'attack', sourceId: unit.id, targetId: aim.id, x: aim.x, z: aim.z, effect: 'windup' });
            return;
        }
        if (state.tick < pending.launchTick)
            return;
        if (!pending.launched) {
            pending.launched = true;
            pending.landTick = state.tick + tickTime(basicAttackFlight(unit.role, distance(unit, aim)));
            emit(state, { type: 'attack', sourceId: unit.id, targetId: aim.id, x: aim.x, z: aim.z, effect: patient ? 'heal' : unit.role, duration: (pending.landTick - state.tick) * exports.BATTLE_RULES.tickSeconds });
        }
        // In-flight shots don't block the next attack or disappear when a skill starts.
        (unit.flyingAttacks ?? (unit.flyingAttacks = [])).push({ ...pending });
        delete unit.pendingAttack;
        return;
    }
    if (!patient && !target)
        return;
    unit.attackCount++;
    if (!pending)
        unit.nextAttackTick = state.tick + tickTime(attackInterval(unit));
    if (patient) {
        if (!pending)
            emit(state, { type: 'attack', sourceId: unit.id, targetId: patient.id, effect: 'heal', x: patient.x, z: patient.z });
        healDirect(state, unit, patient, power(unit), undefined, true);
        const healedIds = new Set([patient.id]);
        if (has(unit, 'doubleHeal') || (0, expeditionRules_2.isCoastTrial)(state) && (unit.fusionRank ?? 1) >= 2) {
            const second = targetPatient(state, unit, patient.id);
            if (second) {
                healedIds.add(second.id);
                if (has(unit, 'doubleHeal'))
                    activate(unit, 'doubleHeal');
                healDirect(state, unit, second, power(unit) * ((0, expeditionRules_2.isCoastTrial)(state) && (unit.fusionRank ?? 1) >= 2 ? .5 : .35), has(unit, 'doubleHeal') ? 'doubleHeal' : undefined, true);
            }
        }
        if (has(unit, 'extraTarget')) {
            const extra = state.units.filter(u => u.alive && !healedIds.has(u.id) && u.hp < u.maxHp && distance(u, unit) <= unit.range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || compareId(a, b))[0];
            if (extra) {
                activate(unit, 'extraTarget');
                healDirect(state, unit, extra, power(unit), 'extraTarget', true);
            }
        }
        return;
    }
    if (!target)
        return;
    if (!pending)
        emit(state, { type: 'attack', sourceId: unit.id, targetId: target.id, x: target.x, z: target.z, effect: unit.role });
    const magic = unit.role === 'crystal' || unit.role === 'bubble' || unit.role === 'leaf';
    const amount = power(unit);
    const impact = { x: target.x, z: target.z };
    const hitIds = new Set([target.id]);
    let fate = false;
    if (has(unit, 'caprice')) {
        const roll = (0, random_1.random)(state);
        if (roll < .05) {
            fate = true;
            activate(unit, 'caprice');
        }
        else if (roll < .30) {
            const patient = state.duelUnits?.find(u => u.id === target.id) ?? target;
            const healing = Math.min(patient.maxHp * .2, patient.maxHp - patient.hp);
            patient.hp += healing;
            target.hp = patient.hp;
            activate(unit, 'caprice');
            emit(state, { type: 'heal', sourceId: unit.id, targetId: target.id, skillId: 'caprice', effect: 'enemyHeal', amount: healing, x: target.x, z: target.z });
            return;
        }
    }
    damageEnemy(state, unit, target, amount * (fate ? 10 : 1), magic, 'direct', fate ? 'caprice' : undefined);
    if (has(unit, 'calm') && (unit.cooldowns.calm ?? 0) <= state.tick) {
        const active = unit.skills.find(id => data_1.SKILL_BY_ID[id].active && (unit.cooldowns[id] ?? 0) > state.tick);
        if (active && (0, random_1.random)(state) < .2) {
            unit.cooldowns[active] = state.tick;
            unit.cooldowns.calm = state.tick + tickTime(15);
            activate(unit, 'calm');
            emit(state, { type: 'skill', sourceId: unit.id, targetId: unit.id, skillId: 'calm', effect: 'cooldown', x: unit.x, z: unit.z });
        }
    }
    if (target.alive && has(unit, 'polymorph') && (unit.cooldowns.polymorph ?? 0) <= state.tick && (0, random_1.random)(state) < .08) {
        unit.cooldowns.polymorph = state.tick + tickTime(6);
        activate(unit, 'polymorph');
        controlEnemy(state, target, 2, unit.id, 'polymorph', 'sheep');
        const transformed = target.statuses.find(s => s.kind === 'sheep');
        if (transformed)
            setStatus(state, target, 'slow', .4, (transformed.untilTick - state.tick) * exports.BATTLE_RULES.tickSeconds, unit.id);
    }
    const trial = (0, expeditionRules_2.isCoastTrial)(state), rank = trial ? (unit.fusionRank ?? 1) : 1;
    if (trial && unit.role === 'spike') {
        const layers = (0, expeditionRules_2.buffCount)(state, unit, 'tidePierce'), count = rank - 1 + (layers ? 2 : 0), dx = impact.x - unit.x, dz = impact.z - unit.z, len = (0, deterministicMath_1.simulationHypot)(dx, dz) || 1;
        const line = state.enemies.filter(e => e.alive && e.id !== target.id && distance(e, unit) <= unit.range + .8 && (e.x - impact.x) * dx + (e.z - impact.z) * dz >= 0 && Math.abs((e.x - impact.x) * dz - (e.z - impact.z) * dx) / len <= .65).sort((a, b) => distance(a, impact) - distance(b, impact));
        const pierced = line.slice(0, count);
        if (pierced.length) {
            const end = pierced[pierced.length - 1];
            emit(state, { type: 'attack', sourceId: unit.id, targetId: end.id, fromX: impact.x, fromZ: impact.z, x: end.x, z: end.z, effect: 'pierce', secondary: true });
        }
        for (const enemy of pierced) {
            hitIds.add(enemy.id);
            damageEnemy(state, unit, enemy, amount * ((rank >= 2 ? .55 : .35) + Math.max(0, layers - 1) * .15), false, 'secondary');
        }
    }
    if (unit.role === 'crystal') {
        const layers = trial ? (0, expeditionRules_2.buffCount)(state, unit, 'crystalBurst') : 0;
        const nearby = state.enemies.filter(e => e.alive && e.id !== target.id && distance(e, impact) <= exports.BATTLE_RULES.splashRadius + (rank >= 2 ? .25 : 0) + (layers ? .25 : 0)).sort((a, b) => distance(a, impact) - distance(b, impact));
        if (nearby.length && state.balanceVersion !== undefined)
            emit(state, { type: 'skill', sourceId: unit.id, effect: 'splash', x: impact.x, z: impact.z, radius: exports.BATTLE_RULES.splashRadius + (rank >= 2 ? .25 : 0) + (layers ? .25 : 0) });
        for (const enemy of nearby.slice(0, 1 + rank + (layers ? 1 : 0))) {
            hitIds.add(enemy.id);
            damageEnemy(state, unit, enemy, amount * (.4 + .15 * layers), true, 'secondary');
        }
    }
    if (trial && rank >= 2 && unit.role === 'stone')
        for (const enemy of state.enemies.filter(e => e.alive && distance(e, impact) <= 1.3))
            setStatus(state, enemy, 'slow', .3, 1.5, unit.id);
    if (has(unit, 'bounce')) {
        const bounce = state.enemies.filter(e => e.alive && e.id !== target.id && distance(e, impact) <= unit.range).sort((a, b) => distance(a, impact) - distance(b, impact))[0];
        if (bounce) {
            hitIds.add(bounce.id);
            activate(unit, 'bounce');
            if (state.balanceVersion !== undefined)
                emit(state, { type: 'attack', sourceId: unit.id, targetId: bounce.id, skillId: 'bounce', effect: unit.role, secondary: true, fromX: impact.x, fromZ: impact.z, x: bounce.x, z: bounce.z });
            damageEnemy(state, unit, bounce, amount * .3, magic, 'secondary', 'bounce');
        }
    }
    if (has(unit, 'scatter')) {
        activate(unit, 'scatter');
        for (const e of state.enemies.filter(e => e.alive && !hitIds.has(e.id) && distance(e, unit) <= unit.range).sort((a, b) => remainingRoute(state, a) - remainingRoute(state, b)).slice(0, 2)) {
            hitIds.add(e.id);
            emit(state, { type: 'attack', sourceId: unit.id, targetId: e.id, skillId: 'scatter', effect: unit.role, secondary: true, x: e.x, z: e.z });
            damageEnemy(state, unit, e, amount * .7, magic, 'secondary', 'scatter');
        }
    }
    if (has(unit, 'extraTarget')) {
        const extra = state.enemies.filter(e => e.alive && !hitIds.has(e.id) && distance(e, unit) <= unit.range).sort((a, b) => b.distance - a.distance || compareId(a, b))[0];
        if (extra) {
            activate(unit, 'extraTarget');
            emit(state, { type: 'attack', sourceId: unit.id, targetId: extra.id, skillId: 'extraTarget', effect: unit.role, secondary: true, x: extra.x, z: extra.z });
            damageEnemy(state, unit, extra, amount, magic, 'secondary', 'extraTarget');
        }
    }
    if (has(unit, 'combo') && unit.attackCount % 5 === 0 && target.alive) {
        activate(unit, 'combo');
        emit(state, { type: 'attack', sourceId: unit.id, targetId: target.id, skillId: 'combo', effect: unit.role, secondary: true, x: target.x, z: target.z });
        damageEnemy(state, unit, target, amount * .6, magic, 'secondary', 'combo');
    }
    if (target.alive) {
        if (unit.role === 'bubble' && unit.attackCount % (rank >= 2 ? 2 : 3) === 0) {
            setStatus(state, target, 'slow', .25, 2, unit.id);
            if (rank >= 2) {
                const next = state.enemies.find(e => e.alive && e !== target && distance(e, target) <= 1.5);
                if (next)
                    setStatus(state, next, 'slow', .25, 2, unit.id);
            }
        }
        // Unversioned checkpoints predate percentage-based shredding. Keep their
        // original rules so resuming/replaying an old wave cannot change its result.
        if (has(unit, 'shredArmor')) {
            activate(unit, 'shredArmor');
            setStatus(state, target, 'armorDown', state.balanceVersion === undefined ? 8 : target.armor * passiveStats_1.PASSIVE_PERCENT.shredArmor / (0, expeditionRules_2.combatScale)(state), 3, unit.id);
        }
        if (has(unit, 'weaken')) {
            activate(unit, 'weaken');
            setStatus(state, target, 'weaken', .08, 3, unit.id);
        }
        if (has(unit, 'root') && unit.attackCount % 6 === 0) {
            activate(unit, 'root');
            controlEnemy(state, target, .6, unit.id, 'root');
        }
    }
}
function castSkill(state, unit, skill, manual = false, command) {
    if (!has(unit, skill) || !data_1.SKILL_BY_ID[skill].active || (unit.cooldowns[skill] || 0) > state.tick)
        return false;
    if (command && !validSkillTarget(state, unit, command))
        return false;
    const target = command?.targetId ? state.enemies.find(e => e.id === command.targetId && e.alive) : (state.stationVersion ?? 0) >= 4 ? state.enemies.find(e => e.id === legalSkillTargets(state, unit, skill)[0]?.id) : targetEnemy(state, unit);
    if (skill === 'hold') {
        if (!state.enemies.some(e => e.alive && distance(e, unit) <= 2.3))
            return false;
        setStatus(state, unit, 'hold', 30, 4, unit.id);
        if ((0, expeditionRules_2.isCoastTrial)(state))
            for (const e of state.enemies.filter(e => e.alive && distance(e, unit) <= 3))
                setStatus(state, e, 'taunt', 1, 3, unit.id);
        state.storms ?? (state.storms = []);
        state.storms.push({ ownerId: unit.id, x: unit.x, z: unit.z, kind: 'rock', pulse: 0, nextTick: state.tick, untilTick: state.tick + tickTime(4) });
    }
    else if (skill === 'greatHeal') {
        const fallen = canRevive(state, unit) ? state.units.filter(u => !u.alive && distance(u, unit) <= (0, exports.skillCastRange)(state, unit)).sort((a, b) => b.attack - a.attack || compareId(a, b))[0] : undefined;
        const patients = state.units.filter(u => u.alive && ((state.stationVersion ?? 0) < 4 || distance(u, unit) <= (0, exports.skillCastRange)(state, unit)));
        const afflicted = patients.filter(u => cleansePriority(u, state.tick) >= 0).sort((a, b) => Number(b.id === command?.targetId) - Number(a.id === command?.targetId) || cleansePriority(a, state.tick) - cleansePriority(b, state.tick) || a.hp / a.maxHp - b.hp / b.maxHp || compareId(a, b));
        if (!fallen && !afflicted.length && !patients.some(u => u.hp / u.maxHp < (manual ? 1 : .6)))
            return false;
        const cured = afflicted.slice(0, has(unit, 'leafMastery') ? 2 : 1);
        for (const ally of cured)
            cleanseOne(state, unit, ally);
        if (has(unit, 'leafMastery') && cured.length === 1)
            cleanseOne(state, unit, cured[0], true);
        for (const ally of state.units.filter(u => u.alive && ((state.stationVersion ?? 0) < 4 || distance(u, unit) <= (0, exports.skillCastRange)(state, unit))))
            healDirect(state, unit, ally, power(unit) * 2.2, skill, true);
        if (fallen) {
            if (fallen.giantBaseMaxHp) {
                fallen.maxHp = fallen.giantBaseMaxHp;
                delete fallen.giantBaseMaxHp;
            }
            fallen.alive = true;
            fallen.hp = fallen.maxHp * .4;
            delete fallen.sleepUntilWave;
            delete fallen.pendingAttack;
            fallen.statuses = [];
            fallen.shields = [];
            fallen.shield = 0;
            fallen.lastDamageTick = state.tick;
            fallen.actionUntilTick = state.tick + tickTime(1);
            fallen.nextAttackTick = Math.max(fallen.nextAttackTick, fallen.actionUntilTick);
            unit.cooldowns.leafMastery = state.tick + tickTime(60);
            activate(unit, 'leafMastery');
            emit(state, { type: 'heal', sourceId: unit.id, targetId: fallen.id, skillId: 'leafMastery', effect: 'revive', amount: fallen.hp, x: fallen.x, z: fallen.z });
        }
    }
    else if (!target && !command?.point)
        return false;
    else if (skill === 'piercingShot' && target) {
        const center = { x: target.x, z: target.z };
        damageEnemy(state, unit, target, power(unit) * 2.4, false, 'direct', skill, .7);
        if ((0, expeditionRules_2.isCoastTrial)(state) && target.alive)
            controlEnemy(state, target, .6, unit.id, skill, 'stun');
        if ((0, expeditionRules_2.isCoastTrial)(state) && (unit.fusionRank ?? 1) >= 2)
            for (const e of state.enemies.filter(e => e.alive && e !== target && distance(e, center) <= 1.6))
                damageEnemy(state, unit, e, power(unit) * 1.4, false, 'secondary', skill, .4);
        if (has(unit, 'spikeMastery')) {
            activate(unit, 'spikeMastery');
            state.storms ?? (state.storms = []);
            state.storms.push({ ownerId: unit.id, ...center, kind: 'arrow', nextTick: state.tick, untilTick: state.tick + tickTime(3) });
        }
    }
    else if (skill === 'crystalCannon') {
        const center = command?.point ?? target;
        state.storms ?? (state.storms = []);
        if ((0, expeditionRules_2.isCoastTrial)(state))
            for (const e of state.enemies.filter(e => e.alive && distance(e, center) <= 1.3))
                controlEnemy(state, e, .5, unit.id, skill, 'stun');
        if (has(unit, 'crystalMastery'))
            activate(unit, 'crystalMastery');
        state.storms.push({ ownerId: unit.id, x: center.x, z: center.z, kind: 'blizzard', pulse: 0, nextTick: state.tick, untilTick: state.tick + tickTime(has(unit, 'crystalMastery') ? 5 : 3) });
    }
    else if (skill === 'bubbleRing') {
        summonCompanions(state, unit, command?.point ?? target);
    }
    else
        return false;
    activate(unit, skill);
    unit.cooldowns[skill] = state.tick + tickTime(data_1.SKILL_BY_ID[skill].cooldown / (1 + Math.min(.3, (0, expeditionRules_2.buffCount)(state, unit, 'haste') * .1)));
    unit.actionUntilTick = state.tick + tickTime(skill === 'hold' ? 4 : exports.BATTLE_RULES.skillActionSeconds);
    unit.nextAttackTick = Math.max(unit.nextAttackTick, unit.actionUntilTick);
    const effectTarget = skill === 'greatHeal' || skill === 'hold' ? unit : command?.point ?? target ?? unit;
    emit(state, { type: 'skill', sourceId: unit.id, targetId: skill === 'greatHeal' || skill === 'hold' ? unit.id : target?.id, skillId: skill, x: effectTarget.x, z: effectTarget.z });
    return true;
}
function damageEnemy(state, source, target, raw, magic, tag, skillId, penetration = 0) {
    if (!target.alive || raw <= 0)
        return 0;
    if (tag !== 'reflect' && (source.holyUntilTick ?? 0) > state.tick)
        raw *= 1.1;
    if (magic && skillId && tag !== 'reflect' && has(source, 'arcane')) {
        raw *= 1.2;
        activate(source, 'arcane');
        setStatus(state, target, 'slow', .2, 2, source.id);
        if ((source.cooldowns.arcane ?? 0) <= state.tick && (0, random_1.random)(state) < .01) {
            controlEnemy(state, target, .5, source.id, 'arcane', 'stun');
            source.cooldowns.arcane = state.tick + tickTime(3);
        }
    }
    const pursuit = tag !== 'reflect' && has(source, 'pursuit') && target.statuses.some(s => ['stun', 'root', 'slow'].includes(s.kind));
    if (pursuit) {
        raw *= 1.18;
        activate(source, 'pursuit');
    }
    const resistance = Math.max(0, (magic ? target.resist - statusAmount(target, 'resistDown') : target.armor + statusAmount(target, 'hold') - statusAmount(target, 'armorDown'))) * (1 - penetration);
    const critical = skillId === 'caprice' || tag === 'direct' && (0, random_1.random)(state) < Math.min(exports.BATTLE_RULES.critCap, exports.BATTLE_RULES.critChance + (has(source, 'critical') ? .08 : 0) + (0, expeditionRules_2.buffCount)(state, source, 'crit') * .04);
    if (critical && has(source, 'critical'))
        activate(source, 'critical');
    // Reflection is already a fraction of mitigated HP loss; it is neither mitigated nor amplified again.
    const duelTarget = state.duelUnits?.find(u => u.id === target.id);
    const critFactor = critical && skillId !== 'caprice' ? exports.BATTLE_RULES.critMultiplier : 1;
    const effectiveResistance = !magic && statusAmount(target, 'sheep') > 0 ? resistance * .6 : resistance;
    const defenseBase = 100 * (0, expeditionRules_2.combatScale)(state);
    const rawCapped = skillId === 'caprice' ? Math.min(raw, target.hp * .5 * (defenseBase + effectiveResistance) / defenseBase) : raw;
    const eventStart = state.events.length;
    const damage = duelTarget ? duelDamage(state, source, duelTarget, rawCapped * critFactor, magic, tag, penetration, skillId) : Math.min(target.hp, tag === 'reflect' ? raw : rawCapped * defenseBase / (defenseBase + effectiveResistance) * critFactor);
    if (duelTarget) {
        target.hp = duelTarget.hp;
        target.alive = duelTarget.alive;
        for (const event of state.events.slice(eventStart))
            if (event.type === 'damage' && event.sourceId === source.id && event.targetId === target.id) {
                event.critical = critical;
                event.skillId = skillId;
                event.secondary = tag !== 'direct';
            }
    }
    else {
        target.hp = Math.max(0, target.hp - damage);
        emit(state, { type: 'damage', sourceId: source.id, targetId: target.id, skillId, amount: damage, critical, secondary: tag !== 'direct', ...(pursuit ? { effect: 'pursuit' } : {}), x: target.x, z: target.z });
    }
    if (tag === 'direct') {
        const drain = magic ? 'spellDrain' : 'lifesteal';
        if (has(source, drain) && source.alive && damage > 0) {
            source.drainHistory = source.drainHistory.filter(item => item.tick > state.tick - tickTime(1));
            const used = source.drainHistory.reduce((sum, item) => sum + item.amount, 0);
            const enlarged = statusAmount(source, 'giant') > 0;
            const amount = Math.min(damage * ((magic ? .03 : .05) + (enlarged ? .15 : 0)), Math.max(0, source.maxHp * (enlarged ? .08 : .02) - used));
            const recovered = healDirect(state, source, source, amount, drain, false);
            if (recovered > 0) {
                source.drainHistory.push({ tick: state.tick, amount: recovered });
                activate(source, drain);
            }
        }
        if (magic && has(source, 'shredResist')) {
            activate(source, 'shredResist');
            setStatus(state, target, 'resistDown', state.balanceVersion === undefined ? 5 : target.resist * passiveStats_1.PASSIVE_PERCENT.shredResist / (0, expeditionRules_2.combatScale)(state), 3, source.id);
        }
    }
    if (state.expedition && tag !== 'reflect' && source.alive && damage > 0) {
        const desperate = (source.desperateUntil ?? 0) > state.tick ? (.05 + .02 * Math.max(0, (0, expeditionRules_2.buffCount)(state, source, 'desperate') - 1)) : 0;
        let requested = damage * Math.min(.2, (0, expeditionRules_2.buffCount)(state, source, 'drain') * .02 + desperate);
        const bounded = (0, expeditionRules_2.isCoastTrial)(state) && state.levelId === 0;
        if (bounded) {
            source.drainHistory = source.drainHistory.filter(v => v.tick > state.tick - tickTime(1));
            requested = Math.min(requested, Math.max(0, source.maxHp * .02 - source.drainHistory.reduce((n, v) => n + v.amount, 0)));
        }
        const recovered = healDirect(state, source, source, requested, undefined, false);
        if (bounded && recovered > 0)
            source.drainHistory.push({ tick: state.tick, amount: recovered });
    }
    if (!duelTarget && target.hp <= 0) {
        const taunt = target.statuses.find(v => v.kind === 'taunt' && v.untilTick > state.tick), protector = taunt && state.units.find(u => u.id === taunt.sourceId && u.alive);
        if (protector && (0, expeditionRules_2.buffCount)(state, protector, 'tauntGuard'))
            addShield(state, protector, protector.maxHp * Math.min(.08, .02 * (0, expeditionRules_2.buffCount)(state, protector, 'tauntGuard')), 4, protector.id, has(protector, 'taunt') ? 'taunt' : 'hold');
        target.alive = false;
        state.kills++;
        (0, expeditionRules_2.expeditionKill)(state, target);
        emit(state, { type: 'defeat', sourceId: source.id, targetId: target.id, x: target.x, z: target.z });
    }
    return damage;
}
function enemyAttack(state, enemy) {
    if (state.faunaVersion === 1 && !enemy.turtleRole) {
        speciesBasicAttack(state, enemy);
        return;
    }
    const pet = state.summons?.filter(p => p.alive && distance(p, enemy) <= ((0, expeditionRules_2.isCoastTrial)(state) ? Math.max(2, enemy.range) : enemy.range)).sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
    const forcedOwner = enemy.statuses.some(s => s.kind === 'taunt' && s.untilTick > state.tick);
    if (pet && (!forcedOwner || enemy.statuses.some(s => s.kind === 'taunt' && s.sourceId === pet.id)) && (!enemy.blockedBy || (0, expeditionRules_2.isCoastTrial)(state))) {
        enemy.nextAttackTick = state.tick + tickTime(enemy.interval);
        enemy.attackCount++;
        emit(state, { type: 'attack', sourceId: enemy.id, targetId: pet.id, x: pet.x, z: pet.z, effect: enemy.kind });
        const base = 100 * (0, expeditionRules_2.combatScale)(state), amount = pet.kind === 'golem' ? 0 : Math.min(pet.hp, enemy.attack * base / (base + (enemy.kind === 'mist' ? pet.resist : pet.armor)));
        pet.hp -= amount;
        pet.alive = pet.hp > 0;
        emit(state, { type: 'damage', sourceId: enemy.id, targetId: pet.id, amount, x: pet.x, z: pet.z });
        return;
    }
    const blocked = state.units.find(u => u.alive && u.id === enemy.blockedBy);
    const taunt = enemy.statuses.find(s => s.kind === 'taunt' && s.untilTick > state.tick), forced = taunt && state.units.find(u => u.alive && u.id === taunt.sourceId && (distance(u, enemy) <= ((0, expeditionRules_2.isCoastTrial)(state) ? Math.max(3, enemy.range) : enemy.range) || enemy.blockedBy === u.id));
    const target = forced || blocked || state.units.filter(u => u.alive && distance(u, enemy) <= enemy.range).sort((a, b) => distance(enemy, a) - distance(enemy, b) || compareId(a, b))[0];
    if (!target)
        return;
    enemy.attackCount++;
    enemy.nextAttackTick = state.tick + tickTime(enemy.interval);
    if (enemy.range > 1.5)
        enemy.actionUntilTick = state.tick + tickTime(.3);
    emit(state, { type: 'attack', sourceId: enemy.id, targetId: target.id, x: target.x, z: target.z, effect: enemy.kind });
    damageUnit(state, enemy, target, enemy.attack * (1 - statusAmount(enemy, 'weaken')), enemy.kind === 'mist', enemy.range <= 1.5);
    if (enemy.kind === 'snail' && target.alive && enemy.attackCount % 3 === 0)
        setStatus(state, target, 'weaken', .15, 3, enemy.id);
    if (enemy.kind === 'boss' && enemy.attackCount % 3 === 0 && !(0, expeditionRules_2.isCoastTrial)(state)) {
        if (state.encounterVersion === 1) {
            enemy.slam = { x: target.x, z: target.z, landTick: state.tick + tickTime(1.6) };
            enemy.actionUntilTick = enemy.slam.landTick;
            enemy.nextAttackTick = Math.max(enemy.nextAttackTick, enemy.slam.landTick + tickTime(.5));
            emit(state, { type: 'skill', sourceId: enemy.id, effect: 'slamTell', x: target.x, z: target.z });
            return;
        }
        emit(state, { type: 'skill', sourceId: enemy.id, targetId: target.id, effect: 'crabSlam', x: target.x, z: target.z });
        for (const ally of state.units.filter(u => u.alive && distance(u, target) <= 2.5).slice(0, 3)) {
            if (ally !== target)
                damageUnit(state, enemy, ally, enemy.attack * .5, false, false);
            if (ally.alive)
                controlUnit(state, ally, .8, enemy.id);
        }
    }
}
function speciesBasicAttack(s, e) {
    const p = (0, enemyCombat_1.enemyCombat)(enemySpeciesKey(s, e));
    if (statusAmount(e, 'stun') > 0 || statusAmount(e, 'sheep') > 0) {
        delete e.strike;
        return;
    }
    if (e.strike) {
        const strike = e.strike, target = s.units.find(u => u.id === strike.targetId) ?? s.summons?.find(u => u.id === strike.targetId);
        if (!target?.alive) {
            delete e.strike;
            return;
        }
        if (!strike.released && s.tick >= strike.releaseTick) {
            strike.released = true;
            emit(s, { type: 'attack', sourceId: e.id, targetId: target.id, effect: 'enemyStrike', enemyBasic: p.basic, x: strike.x, z: strike.z, fromX: e.x, fromZ: e.z, duration: p.ranged ? .22 : .05 });
        }
        if (s.tick < strike.landTick)
            return;
        delete e.strike;
        // Melee can be dodged during the windup; missiles hit the locked landing point.
        if (p.ranged ? distance(target, strike) > .48 : distance(target, e) > e.range + .12)
            return;
        if ('role' in target)
            damageUnit(s, e, target, e.attack * (1 - statusAmount(e, 'weaken')), p.magic, !p.ranged);
        else {
            const base = 100 * (0, expeditionRules_2.combatScale)(s), amount = target.kind === 'golem' ? 0 : Math.min(target.hp, e.attack * base / (base + (p.magic ? target.resist : target.armor)));
            target.hp -= amount;
            target.alive = target.hp > 0;
            emit(s, { type: 'damage', sourceId: e.id, targetId: target.id, amount, x: target.x, z: target.z });
        }
        return;
    }
    const taunt = e.statuses.find(t => t.kind === 'taunt' && t.untilTick > s.tick), targets = [...s.units, ...(s.summons ?? [])].filter(u => u.alive && distance(u, e) <= e.range);
    const target = targets.find(u => u.id === taunt?.sourceId) ?? targets.find(u => u.id === e.blockedBy) ?? targets.sort((a, b) => distance(a, e) - distance(b, e) || compareId(a, b))[0];
    if (!target)
        return;
    const impact = (0, enemyG1Catalog_1.enemyG1)(enemySpeciesKey(s, e))?.id === 'W03' ? .84 : e.kind === 'boss' ? .62 : .36, flight = p.ranged ? .22 : 0;
    e.attackCount++;
    e.nextAttackTick = s.tick + tickTime(e.interval);
    e.actionUntilTick = s.tick + tickTime(impact / .68);
    e.strike = { targetId: target.id, x: target.x, z: target.z, basic: p.basic, releaseTick: s.tick + tickTime(impact - flight), landTick: s.tick + tickTime(impact), released: false };
    emit(s, { type: 'attack', sourceId: e.id, targetId: target.id, effect: 'enemyWindup', enemyBasic: p.basic, x: target.x, z: target.z, duration: impact / .68 });
}
function damageUnit(state, attacker, target, raw, magic, melee, allowCounter = true, hpCap = Infinity) {
    if (!target.alive || raw <= 0)
        return 0;
    const defense = Math.max(0, magic ? target.resist - statusAmount(target, 'resistDown') : (target.armor + statusAmount(target, 'hold') - statusAmount(target, 'armorDown')) * (statusAmount(target, 'sheep') > 0 ? .6 : 1));
    const defenseBase = 100 * (0, expeditionRules_2.combatScale)(state);
    let amount = Math.min(hpCap, raw * defenseBase / (defenseBase + defense) * ((target.holyUntilTick ?? 0) > state.tick ? .9 : 1));
    if (has(target, 'block') && (0, random_1.random)(state) < .15) {
        amount *= .7;
        activate(target, 'block');
    }
    const shareRadius = state.balanceVersion === 2 ? exports.BATTLE_RULES.shareRange : 3;
    const sharer = state.units.filter(u => u.alive && u !== target && has(u, 'share') && distance(u, target) <= shareRadius)
        .filter(u => state.units.filter(a => a.alive && a !== u && distance(a, u) <= shareRadius).sort((a, b) => distance(a, u) - distance(b, u) || compareId(a, b))[0]?.id === target.id)
        .sort((a, b) => distance(a, target) - distance(b, target) || compareId(a, b))[0];
    if (sharer) {
        const shared = amount * .1;
        amount -= shared;
        activate(sharer, 'share');
        // A separate HP/shield sink deliberately bypasses block, share and reflection.
        loseUnitHealth(state, sharer, shared, attacker.id, 'share');
    }
    const actual = loseUnitHealth(state, target, amount, attacker.id);
    if (allowCounter && actual > 0 && target.alive) {
        if (has(target, 'fervor') && (target.cooldowns.fervor ?? 0) <= state.tick && (0, random_1.random)(state) < .2) {
            setStatus(state, target, 'fervor', .4, 4, target.id);
            target.cooldowns.fervor = state.tick + tickTime(8);
            activate(target, 'fervor');
            emit(state, { type: 'skill', sourceId: target.id, targetId: target.id, skillId: 'fervor', x: target.x, z: target.z });
        }
        if (has(target, 'giant') && target.hp / target.maxHp < .3 && (target.cooldowns.giant ?? 0) <= state.tick && (0, random_1.random)(state) < .25) {
            target.giantBaseMaxHp = target.maxHp;
            target.maxHp *= 1.6;
            target.hp *= 1.6;
            setStatus(state, target, 'giant', .8, 6, target.id);
            target.cooldowns.giant = state.tick + tickTime(18);
            activate(target, 'giant');
            emit(state, { type: 'skill', sourceId: target.id, targetId: target.id, skillId: 'giant', x: target.x, z: target.z });
        }
    }
    if (actual > 0 && melee && has(target, 'reflect') && (target.reflectTicks[attacker.id] ?? -1000) <= state.tick - tickTime(.5)) {
        target.reflectTicks[attacker.id] = state.tick;
        activate(target, 'reflect');
        damageEnemy(state, target, attacker, actual * .15, false, 'reflect', 'reflect');
    }
    if (allowCounter && actual > 0 && target.alive && has(target, 'counterStorm') && (target.cooldowns.counterStorm ?? 0) <= state.tick && (0, random_1.random)(state) < .2) {
        target.cooldowns.counterStorm = state.tick + tickTime(3);
        activate(target, 'counterStorm');
        const strikes = 1 + Math.floor((0, random_1.random)(state) * 3), amount = target.maxHp * .03 + (target.armor + target.resist) * .2;
        const victims = state.duelUnits ? state.duelUnits.filter(u => state.duelTeamA.includes(u.id) !== state.duelTeamA.includes(target.id)).map(u => turtleEnemy(u)) : state.enemies;
        for (let i = 0; i < strikes; i++)
            for (const e of victims.filter(e => e.alive && distance(e, target) <= 1.8))
                damageEnemy(state, target, e, amount, false, 'secondary', 'counterStorm');
        emit(state, { type: 'skill', sourceId: target.id, skillId: 'counterStorm', amount: strikes, x: target.x, z: target.z });
    }
    return actual;
}
function loseUnitHealth(state, target, amount, sourceId, skillId) {
    var _a, _b;
    if (amount <= 0 || !target.alive || (target.pearlInvincibleUntil ?? 0) > state.tick)
        return 0;
    if (state.expedition)
        amount *= Math.max(.6, (0, deterministicMath_1.simulationPow)(.96, (0, expeditionRules_2.buffCount)(state, target, 'guard')));
    target.lastDamageTick = state.tick;
    target.nextRegenTick = state.tick + tickTime(5);
    for (const shield of target.shields) {
        const absorbed = Math.min(amount, shield.amount);
        if (state.contributions) {
            const source = state.units.concat(state.benchUnits ?? []).find(u => u.id === shield.sourceId);
            if (source) {
                const row = (_a = state.contributions)[_b = source.id] ?? (_a[_b] = { name: data_1.ROLES[source.role].job, damage: 0, healing: 0, shield: 0, reflected: 0, rebirths: 0 });
                row.shield += absorbed;
            }
        }
        shield.amount -= absorbed;
        amount -= absorbed;
        if (amount <= 0)
            break;
    }
    target.shields = target.shields.filter(s => s.amount > 1e-8);
    target.shield = target.shields.reduce((sum, s) => sum + s.amount, 0);
    const pearl = (0, expeditionRules_2.buffCount)(state, target, 'phoenix');
    if (pearl && amount >= target.hp && state.tick >= (target.pearlReadyTick ?? 0)) {
        target.pearlReadyTick = state.tick + 1200;
        target.pearlInvincibleUntil = state.tick + 60;
        target.hp = Math.min(target.maxHp, Math.max(1, target.maxHp * (.10 + .1 * (pearl - 1))));
        emit(state, { type: 'shield', targetId: target.id, sourceId: target.id, amount: 0, effect: '不灭珍珠', x: target.x, z: target.z });
        return 0;
    }
    const actual = Math.min(target.hp, amount);
    target.hp = Math.max(0, target.hp - actual);
    emit(state, { type: 'damage', sourceId, targetId: target.id, skillId, amount: actual, secondary: skillId === 'share', x: target.x, z: target.z });
    if (target.hp <= 0 && has(target, 'rebirth') && !target.rebirthUsed) {
        target.rebirthUsed = true;
        if ((0, random_1.random)(state) < .2) {
            target.hp = target.maxHp * .4;
            receiveHolyLight(state, target);
            activate(target, 'rebirth');
            emit(state, { type: 'heal', sourceId: target.id, targetId: target.id, skillId: 'rebirth', amount: target.hp, x: target.x, z: target.z });
        }
    }
    if (target.hp <= 0) {
        target.alive = false;
        if (has(target, 'sleep')) {
            const roll = (0, random_1.random)(state);
            target.sleepUntilWave = state.wave + (roll < .25 ? 3 : roll < .625 ? 4 : 5);
            activate(target, 'sleep');
        }
        emit(state, { type: 'defeat', sourceId, targetId: target.id, x: target.x, z: target.z });
    }
    else if (has(target, 'lastShield') && !target.lastShieldUsed && target.hp / target.maxHp < .3) {
        target.lastShieldUsed = true;
        addShield(state, target, target.maxHp * .15, 4, target.id, 'lastShield');
    }
    return actual;
}
function receiveHolyLight(state, target) {
    if (has(target, 'holyLight') && (target.holyReadyTick ?? 0) <= state.tick && (0, random_1.random)(state) < .25) {
        target.holyReadyTick = state.tick + tickTime(6);
        target.holyUntilTick = state.tick + tickTime(3);
        activate(target, 'holyLight');
        emit(state, { type: 'skill', sourceId: target.id, targetId: target.id, skillId: 'holyLight', x: target.x, z: target.z });
    }
}
function healDirect(state, source, target, requested, skillId, triggerHealSkills = false) {
    if (!target.alive || !source.alive)
        return 0;
    if (triggerHealSkills && has(source, 'cleanse') && state.tick >= source.cleanseReadyTick) {
        const priority = ['web', 'stun', 'root', 'slow', 'weaken', 'armorDown', 'resistDown'];
        const kind = priority.find(id => target.statuses.some(s => s.kind === id));
        if (kind) {
            const index = target.statuses.findIndex(s => s.kind === kind);
            target.statuses.splice(index, 1);
            source.cleanseReadyTick = state.tick + tickTime(8);
            activate(source, 'cleanse');
            emit(state, { type: 'skill', sourceId: source.id, targetId: target.id, skillId: 'cleanse' });
        }
    }
    if (state.expedition && (source.desperateUntil ?? 0) > state.tick)
        requested *= 1.25 + .1 * Math.max(0, (0, expeditionRules_2.buffCount)(state, source, 'desperate') - 1);
    const amount = Math.max(0, Math.min(requested, target.maxHp - target.hp));
    const tide = (0, expeditionRules_2.isCoastTrial)(state) && source.role === 'leaf' && triggerHealSkills ? (0, expeditionRules_2.buffCount)(state, source, 'healingTide') : 0;
    if (tide) {
        const shield = Math.max(0, Math.min(target.maxHp * .06, Math.max(0, requested - amount) * (.35 + .15 * (tide - 1)), target.maxHp * exports.BATTLE_RULES.shieldCap - target.shield));
        if (shield) {
            target.shields.push({ amount: shield, untilTick: state.tick + tickTime(3), sourceId: source.id, buffId: 'healingTide' });
            target.shield += shield;
            emit(state, { type: 'shield', sourceId: source.id, targetId: target.id, amount: shield, effect: '盈潮护佑', x: target.x, z: target.z });
        }
    }
    if (amount <= 0)
        return 0;
    target.hp += amount;
    receiveHolyLight(state, target);
    emit(state, { type: 'heal', sourceId: source.id, targetId: target.id, amount, skillId, x: target.x, z: target.z });
    if (triggerHealSkills && has(source, 'healShield'))
        addShield(state, target, amount * .15, 4, source.id, 'healShield');
    return amount;
}
function addShield(state, target, requested, duration, sourceId, skillId) {
    const amount = Math.max(0, Math.min(requested, target.maxHp * exports.BATTLE_RULES.shieldCap - target.shield));
    if (amount <= 0)
        return 0;
    target.shields.push({ amount, untilTick: state.tick + tickTime(duration), sourceId, skillId });
    target.shield += amount;
    const source = state.units.find(u => u.id === sourceId);
    if (source)
        activate(source, skillId);
    emit(state, { type: 'shield', sourceId, targetId: target.id, skillId, amount, x: target.x, z: target.z });
    return amount;
}
const blockCapacity = (unit, tick) => unit.role === 'stone' && has(unit, 'taunt') && (unit.tauntUntilTick ?? 0) > tick ? 2 : 1;
exports.blockCapacity = blockCapacity;
function triggerTaunt(state, unit) {
    if (!unit.alive || !has(unit, 'taunt') || (unit.cooldowns.taunt ?? 0) > state.tick || unit.actionUntilTick > state.tick || statusAmount(unit, 'stun') > 0 || statusAmount(unit, 'sheep') > 0 || statusAmount(unit, 'web') > 0)
        return;
    if ((0, expeditionRules_2.isCoastTrial)(state)) {
        const targets = state.enemies.filter(e => e.alive && distance(e, unit) <= 3);
        if (!targets.length)
            return;
        unit.cooldowns.taunt = state.tick + tickTime(8);
        unit.tauntUntilTick = state.tick + tickTime(3);
        activate(unit, 'taunt');
        for (const target of targets) {
            setStatus(state, target, 'taunt', 1, 3, unit.id);
            if (has(unit, 'daze'))
                setStatus(state, target, 'slow', .3, 3, unit.id, 'daze');
        }
        emit(state, { type: 'skill', sourceId: unit.id, skillId: 'taunt', x: unit.x, z: unit.z, effect: 'taunt' });
        return;
    }
    const target = state.enemies.filter(e => e.alive && e.turtleRole !== 'leaf' && distance(e, unit) <= unit.range && (distance(e, unit) <= e.range || e.blockedBy === unit.id) && !e.statuses.some(s => s.kind === 'taunt' && s.untilTick > state.tick)).sort((a, b) => distance(a, unit) - distance(b, unit) || compareId(a, b))[0];
    if (!target)
        return;
    unit.cooldowns.taunt = state.tick + tickTime(8);
    unit.tauntUntilTick = state.tick + tickTime(3);
    setStatus(state, target, 'taunt', 1, 3, unit.id);
    activate(unit, 'taunt');
    if (has(unit, 'daze')) {
        setStatus(state, target, 'slow', .3, 3, unit.id, 'daze');
        activate(unit, 'daze');
        emit(state, { type: 'control', sourceId: unit.id, targetId: target.id, skillId: 'daze', amount: 3, effect: 'slow', x: target.x, z: target.z });
    }
    emit(state, { type: 'skill', sourceId: unit.id, targetId: target.id, skillId: 'taunt', x: unit.x, z: unit.z, effect: 'taunt' });
}
function setStatus(state, target, kind, amount, seconds, sourceId, slowGroup) {
    if (['hold', 'armorDown', 'resistDown'].includes(kind))
        amount *= (0, expeditionRules_2.combatScale)(state);
    const untilTick = state.tick + tickTime(seconds);
    const existing = target.statuses.find(s => s.kind === kind && s.slowGroup === slowGroup);
    if (existing) {
        existing.amount = Math.max(existing.amount, amount);
        existing.untilTick = Math.max(existing.untilTick, untilTick);
        existing.sourceId = sourceId;
    }
    else
        target.statuses.push({ kind, amount, untilTick, sourceId, ...(slowGroup ? { slowGroup } : {}) });
}
function controlEnemy(state, target, seconds, sourceId, skillId, kind = 'root') {
    if (state.tick >= target.controlWindowUntilTick) {
        target.controlCount = 0;
        target.controlWindowUntilTick = state.tick + tickTime(exports.BATTLE_RULES.controlWindow);
    }
    const resistant = state.duelUnits?.find(u => u.id === target.id && has(u, 'steady'));
    if (resistant)
        activate(resistant, 'steady');
    const scale = (resistant ? .8 : 1) * exports.BATTLE_RULES.controlScales[Math.min(target.controlCount++, 3)] * (target.kind === 'boss' ? exports.BATTLE_RULES.bossControlScale : 1);
    if (scale <= 0)
        return;
    setStatus(state, target, kind, 1, seconds * scale, sourceId);
    emit(state, { type: 'control', sourceId, targetId: target.id, skillId, amount: seconds * scale, x: target.x, z: target.z });
}
function controlUnit(state, target, seconds, sourceId) {
    const duration = seconds * (has(target, 'steady') ? .8 : 1);
    if (has(target, 'steady'))
        activate(target, 'steady');
    setStatus(state, target, 'stun', 1, duration, sourceId);
    emit(state, { type: 'control', sourceId, targetId: target.id, amount: duration, x: target.x, z: target.z, effect: 'stun' });
}
/** PvP uses the same skill implementations and HP/shield sinks as normal combat. */
function turtleEnemy(unit, distanceAlong = 0) {
    return { id: unit.id, kind: 'ink', turtleRole: unit.role, turtleSkills: [...unit.skills], x: unit.x, z: unit.z, distance: distanceAlong, hp: unit.hp, maxHp: unit.maxHp, attack: unit.attack,
        armor: unit.armor, resist: unit.resist, speed: .9, range: unit.range, interval: unit.interval, leak: 1, alive: unit.alive, statuses: unit.statuses,
        nextAttackTick: unit.nextAttackTick, actionUntilTick: unit.actionUntilTick, attackCount: unit.attackCount,
        controlWindowUntilTick: unit.duelControlWindow ?? 0, controlCount: unit.duelControlCount ?? 0, summoned: false };
}
function duelDamage(state, source, target, raw, magic, tag, penetration, skillId) {
    if (tag === 'reflect')
        return loseUnitHealth(state, target, raw, source.id, 'reflect');
    const previous = state.units, targetInA = state.duelTeamA.includes(target.id);
    state.units = state.duelUnits.filter(u => state.duelTeamA.includes(u.id) === targetInA);
    const defense = Math.max(0, magic ? target.resist - statusAmount(target, 'resistDown') : target.armor + statusAmount(target, 'hold') - statusAmount(target, 'armorDown'));
    try {
        return damageUnit(state, turtleEnemy(source), target, raw * (100 + defense) / (100 + defense * (1 - penetration)), magic, source.role === 'stone', skillId !== 'counterStorm', skillId === 'caprice' ? target.hp * .5 : Infinity);
    }
    finally {
        state.units = previous;
    }
}
function duelActions(state, teamA, teamB, routeProgress) {
    const all = teamA.concat(teamB), previousUnits = state.units, previousEnemies = state.enemies;
    const commands = state.commands.splice(0);
    state.duelUnits = all;
    state.duelTeamA = teamA.map(u => u.id);
    try {
        for (const u of all) {
            tickPrecious(state, u);
            u.statuses = u.statuses.filter(x => x.untilTick > state.tick);
            u.shields = u.shields.filter(x => x.untilTick > state.tick && x.amount > 1e-8);
            u.shield = u.shields.reduce((n, x) => n + x.amount, 0);
            if (u.alive && has(u, 'regen') && state.tick >= u.nextRegenTick && state.tick - u.lastDamageTick >= tickTime(5)) {
                if (healDirect(state, u, u, u.maxHp * .01, 'regen', false) > 0)
                    activate(u, 'regen');
                u.nextRegenTick = state.tick + tickTime(1);
            }
        }
        // Alternate first side by tick so simultaneous trades are not always defender-biased.
        for (const side of state.tick % 2 ? [teamA, teamB] : [teamB, teamA]) {
            const opponents = side === teamA ? teamB : teamA;
            // Once allies can overtake, roster order is no longer route order. Defense
            // must target the nearest escape threat (while respecting taunt/focus).
            const enemies = () => opponents.map((t, i) => turtleEnemy(t, routeProgress?.get(t.id) ?? 100 - i));
            state.units = side;
            updateAuras(state);
            state.enemies = enemies();
            tickSummons(state);
            for (const u of side) {
                state.enemies = enemies();
                resolveFlyingAttacks(state, u);
                if (!u.alive || u.actionUntilTick > state.tick || statusAmount(u, 'stun') > 0 || statusAmount(u, 'sheep') > 0)
                    continue;
                state.enemies = enemies();
                triggerTaunt(state, u);
                const command = commands.find(c => c.unitId === u.id);
                const active = command?.skillId ?? (automaticSkillAllowed(state, u) ? u.skills.find(id => data_1.SKILL_BY_ID[id].active) : undefined);
                if (active === 'hold' && state.enemies.some(e => e.alive && distance(e, u) <= u.range))
                    state.enemies.find(e => e.alive && distance(e, u) <= u.range).blockedBy = u.id;
                if (active && castSkill(state, u, active, !!command, command))
                    delete u.pendingAttack;
                else if (u.pendingAttack || state.tick >= u.nextAttackTick)
                    basicAttack(state, u);
                for (const enemy of state.enemies) {
                    const actual = opponents.find(t => t.id === enemy.id);
                    actual.duelControlCount = enemy.controlCount;
                    actual.duelControlWindow = enemy.controlWindowUntilTick;
                }
            }
        }
    }
    finally {
        state.units = previousUnits;
        state.enemies = previousEnemies;
        delete state.duelUnits;
        delete state.duelTeamA;
    }
}
function summonCompanions(state, owner, point) {
    state.summons ?? (state.summons = []);
    const kind = has(owner, 'spirit') ? 'golem' : 'turtle';
    const alive = state.summons.filter(p => p.ownerId === owner.id && p.alive);
    // Refresh one's own pair; the cap never depends on cast or movement spam.
    for (const p of alive) {
        p.alive = false;
        p.hp = 0;
    }
    if (kind === 'golem')
        activate(owner, 'spirit');
    for (let i = 0; i < 2; i++) {
        const pet = { id: 'summon-' + (state.nextSummonId = (state.nextSummonId ?? 0) + 1), ownerId: owner.id, kind,
            x: point.x + (i ? .32 : -.32), z: point.z, hp: owner.maxHp * .35, maxHp: owner.maxHp * .35, attack: power(owner) * .4, armor: owner.armor * .5, resist: owner.resist * .5,
            bornTick: state.tick, untilTick: state.tick + tickTime(kind === 'golem' ? 5 : 12), nextAttackTick: state.tick + tickTime(.5), nextBurnTick: state.tick + tickTime(1), alive: true };
        state.summons.push(pet);
        emit(state, { type: 'spawn', sourceId: pet.id, skillId: kind === 'golem' ? 'spirit' : 'bubbleRing', x: pet.x, z: pet.z, effect: kind });
    }
}
function tickSummons(state) {
    for (const area of state.storms ?? []) {
        const owner = state.units.concat(state.benchUnits ?? []).find(u => u.id === area.ownerId);
        if (!owner || state.tick >= area.untilTick)
            continue;
        if (area.kind === 'rock' && !owner.alive) {
            area.untilTick = state.tick;
            continue;
        }
        if (area.echoTick !== undefined && state.tick >= area.echoTick) {
            for (const e of state.enemies.filter(e => e.alive && area.echoTargets?.includes(e.id))) {
                damageEnemy(state, owner, e, power(owner) * 1.2, true, 'secondary', 'crystalMastery');
                emit(state, { type: 'skill', sourceId: owner.id, targetId: e.id, skillId: 'crystalMastery', effect: 'shatter', x: e.x, z: e.z });
            }
            delete area.echoTick;
            delete area.echoTargets;
        }
        if (state.tick < area.nextTick)
            continue;
        area.nextTick += tickTime(area.kind === 'rock' ? .5 : 1);
        const pulse = area.pulse ?? 0;
        area.pulse = pulse + 1;
        if (area.kind === 'rock') {
            for (const e of state.enemies.filter(e => e.alive && distance(e, area) <= 2.3))
                damageEnemy(state, owner, e, power(owner) * .55, false, 'secondary', 'hold');
            emit(state, { type: 'skill', sourceId: owner.id, skillId: 'hold', effect: 'rockPulse', x: area.x, z: area.z });
            if (has(owner, 'stoneMastery') && pulse % 2 === 0) {
                activate(owner, 'stoneMastery');
                const hit = new Set();
                for (let i = 0; i < 3; i++) {
                    const angle = i * Math.PI * 2 / 3 + pulse * .6, p = { x: area.x + (0, deterministicMath_1.simulationCos)(angle) * 2.45, z: area.z + (0, deterministicMath_1.simulationSin)(angle) * 2.45 };
                    for (const e of state.enemies.filter(e => e.alive && !hit.has(e.id) && distance(e, p) <= 1.2)) {
                        hit.add(e.id);
                        damageEnemy(state, owner, e, power(owner) * .5, false, 'secondary', 'stoneMastery');
                        setStatus(state, e, 'slow', .3, 1.5, owner.id);
                    }
                    emit(state, { type: 'skill', sourceId: owner.id, skillId: 'stoneMastery', effect: 'rockSplit', x: p.x, z: p.z });
                }
            }
            continue;
        }
        if (area.kind === 'arrow') {
            for (const e of state.enemies.filter(e => e.alive && distance(e, area) <= 2))
                damageEnemy(state, owner, e, power(owner) * .75, false, 'secondary', 'spikeMastery', .3);
            emit(state, { type: 'skill', sourceId: owner.id, skillId: 'spikeMastery', effect: 'arrowRain', x: area.x, z: area.z });
            continue;
        }
        const freeze = has(owner, 'crystalMastery') && pulse === 0;
        if (freeze) {
            area.echoTick = state.tick + tickTime(1.2);
            area.echoTargets = [];
        }
        for (const e of state.enemies.filter(e => e.alive && distance(e, area) <= 1.8)) {
            damageEnemy(state, owner, e, power(owner) * .8, true, 'secondary', 'crystalCannon');
            setStatus(state, e, 'slow', .25, 1.2, owner.id);
            if (freeze && e.alive) {
                controlEnemy(state, e, 1.2, owner.id, 'crystalMastery', 'stun');
                area.echoTargets.push(e.id);
            }
        }
        emit(state, { type: 'skill', sourceId: owner.id, skillId: 'crystalCannon', x: area.x, z: area.z, effect: 'blizzardPulse' });
    }
    if (state.storms)
        state.storms = state.storms.filter(s => s.untilTick > state.tick);
    for (const pet of state.summons ?? []) {
        if (!pet.alive)
            continue;
        if (state.tick >= pet.untilTick) {
            pet.alive = false;
            pet.hp = 0;
            continue;
        }
        const owner = state.units.concat(state.benchUnits ?? []).find(u => u.id === pet.ownerId);
        if (!owner)
            continue;
        if (pet.kind === 'golem' && state.tick - pet.bornTick < 10)
            continue;
        if (pet.kind === 'golem' && state.tick - pet.bornTick === 10) {
            for (const e of state.enemies.filter(e => e.alive && distance(e, pet) <= 1.5)) {
                damageEnemy(state, owner, e, pet.attack, true, 'secondary', 'spirit');
                if (e.alive && !e.statuses.some(s => s.kind === 'stun' && s.sourceId === owner.id))
                    controlEnemy(state, e, .8, owner.id, 'spirit', 'stun');
            }
            emit(state, { type: 'skill', sourceId: pet.id, skillId: 'spirit', x: pet.x, z: pet.z, effect: 'landing' });
        }
        const enemies = state.enemies.filter(e => e.alive).sort((a, b) => distance(a, pet) - distance(b, pet)), target = enemies[0];
        if ((0, expeditionRules_2.isCoastTrial)(state) && state.tick % 10 === 0)
            for (const enemy of enemies.filter(e => distance(e, pet) <= 2 && !e.statuses.some(t => t.kind === 'taunt' && state.units.some(u => u.id === t.sourceId && u.alive))))
                setStatus(state, enemy, 'taunt', 1, .6, pet.id);
        if (!target)
            continue;
        const d = distance(target, pet);
        if (d > 1.1) {
            const move = Math.min(d - 1, 2.2 * .05);
            pet.x += (target.x - pet.x) / d * move;
            pet.z += (target.z - pet.z) / d * move;
        }
        if (d <= 1.4 && state.tick >= pet.nextAttackTick) {
            pet.nextAttackTick = state.tick + tickTime(1.1);
            emit(state, { type: 'attack', sourceId: pet.id, targetId: target.id, x: target.x, z: target.z, effect: pet.kind });
            damageEnemy(state, owner, target, pet.attack, false, 'secondary', pet.kind === 'golem' ? 'spirit' : 'bubbleRing');
        }
        if (pet.kind === 'golem' && state.tick >= pet.nextBurnTick) {
            pet.nextBurnTick = state.tick + tickTime(1);
            for (const e of enemies.filter(e => distance(e, pet) <= 1.6))
                damageEnemy(state, owner, e, pet.attack * .4, true, 'secondary', 'spirit');
            emit(state, { type: 'skill', sourceId: pet.id, skillId: 'spirit', x: pet.x, z: pet.z, effect: 'burn' });
        }
    }
}
/** Commands are owner-scoped and mutate local battle copies before atomic persistence. */
function expeditionAction(s, owner, action, args = {}) {
    if (!['recruit', 'merge', 'move', 'buff'].includes(action))
        throw Error('未知的局内操作');
    const e = s.expedition, p = e?.players.find(p => p.id === owner);
    if (!e || !p || s.status !== 'fighting')
        throw Error('当前不能操作');
    if (action === 'buff') {
        (0, expeditionRules_2.chooseExpeditionBuff)(s, owner, args.buff);
        for (const u of s.units.filter(u => u.alive && u.ownerId === owner))
            emit(s, { type: 'skill', sourceId: u.id, effect: 'blessing', x: u.x, z: u.z });
        return;
    }
    if ((0, expeditionRules_2.expeditionPaused)(s))
        throw Error('请先选择首领祝福');
    const own = (id) => { const u = s.units.find(u => u.id === id && u.ownerId === owner); if (!u)
        throw Error('只能操作自己的已出战伙伴'); return u; };
    const add = (template, slot, rank, hpRatio = 1) => {
        const id = 'field-' + owner + '-' + (++e.serial), fresh = createBattle(s.levelId, 1, [{ id, turtle: template, level: 1, slot, placement: (0, expeditionRules_2.expeditionSlots)(s.levelId)[slot], ownerId: owner, fusionRank: rank }], { rulesVersion: '0.6', mode: s.mode, formationVersion: 2, expedition: e, roleSurvivalVersion: s.roleSurvivalVersion ?? 0 }).units[0];
        fresh.hp = fresh.maxHp * hpRatio;
        fresh.nextAttackTick = s.tick + 12;
        fresh.nextRegenTick = s.tick + 20;
        fresh.actionUntilTick = s.tick + 12;
        s.units.push(fresh);
        if (s.controlledUnitIds && (owner === e.players[0].id || s.units.some(u => u.ownerId === owner && s.controlledUnitIds.includes(u.id))))
            s.controlledUnitIds.push(fresh.id);
        return fresh;
    };
    if (action === 'recruit') {
        const cost = (0, expeditionEconomy_1.expeditionRecruitCost)(e, p);
        if (e.cap && p.recruited >= e.cap)
            throw Error('本局已征召20只');
        if (p.coins < cost)
            throw Error('干粮不足');
        const slots = p.slots.filter(slot => !s.units.some(u => u.slot === slot));
        if (!slots.length)
            throw Error('站位已满，请先合成');
        const damageRoles = ['spike', 'crystal'], needsDamage = ((0, expeditionRules_2.isCoastTrial)(s) || e.earlyBalance === 1) && p.recruited === 1 && !s.units.some(u => damageRoles.includes(u.role)), damagePool = p.templates.filter(t => damageRoles.includes(t.role));
        const slot = slots[Math.floor((0, random_1.random)(s) * slots.length)], basePool = needsDamage && damagePool.length ? damagePool : p.templates, distinct = e.earlyBalance === 1 && p.recruited < 3 ? basePool.filter(t => !s.units.some(u => u.role === t.role)) : [], pool = distinct.length ? distinct : basePool, template = pool[Math.floor((0, random_1.random)(s) * pool.length)];
        const recruited = add(template, slot, 1);
        emit(s, { type: 'skill', sourceId: recruited.id, effect: 'recruit', x: recruited.x, z: recruited.z });
        p.coins -= cost;
        p.spent += cost;
        p.recruited++;
        (0, expeditionRules_2.applyExpeditionStats)(s);
        return;
    }
    const a = own(args.a);
    if (action === 'move') {
        if (!p.slots.includes(args.slot))
            throw Error('只能放到自己一侧的固定站位');
        const other = s.units.find(u => u.slot === args.slot);
        if (other && other.ownerId !== owner)
            throw Error('不能调整队友一侧的伙伴');
        if (other && other !== a && a.fusionRank === other.fusionRank && a.fusionRank !== 3) {
            expeditionAction(s, owner, 'merge', { a: a.id, b: other.id });
            return;
        }
        if (s.tick === 0) {
            const old = a.slot;
            a.slot = args.slot;
            a.placement = { ...(0, expeditionRules_2.expeditionSlots)(s.levelId)[a.slot] };
            Object.assign(a, a.placement);
            if (other && other !== a) {
                other.slot = old;
                other.placement = { ...(0, expeditionRules_2.expeditionSlots)(s.levelId)[old] };
                Object.assign(other, other.placement);
            }
        }
        else
            moveBattleUnit(s, a.id, args.slot);
        return;
    }
    const b = own(args.b);
    if (a === b || a.fusionRank !== b.fusionRank || a.fusionRank === 3)
        throw Error('请选择两只同阶的1阶或2阶龟');
    if (!a.alive || !b.alive)
        throw Error('倒下的伙伴不能合成');
    if ([a, b].some(u => s.tick < (u.moveReadyTick ?? 0) || (u.statuses.some(v => ['stun', 'root', 'web', 'sheep'].includes(v.kind) && v.untilTick > s.tick))))
        throw Error('调位冷却或控制结束后才能合成');
    if (s.storms?.some(v => [a.id, b.id].includes(v.ownerId) && v.untilTick > s.tick))
        throw Error('持续技能结束后才能合成');
    const selected = (0, random_1.random)(s) < .5 ? a : b, template = p.templates.find(t => t.id === selected.turtleId);
    if (!template)
        throw Error('合成培养来源丢失');
    const ratio = (a.hp / a.maxHp + b.hp / b.maxHp) / 2, slot = b.slot;
    s.units = s.units.filter(u => u !== a && u !== b);
    s.retiredUnits ?? (s.retiredUnits = []);
    for (const u of [a, b])
        s.retiredUnits.push({ id: u.id, skills: [...u.skills] });
    s.commands = s.commands.filter(c => c.unitId !== a.id && c.unitId !== b.id);
    for (const enemy of s.enemies)
        if ([a.id, b.id].includes(enemy.blockedBy ?? '')) {
            delete enemy.blockedBy;
            delete enemy.blockOwnerId;
        }
    e.mergeCount = (e.mergeCount ?? 0) + 1;
    e.highestRank = Math.max(e.highestRank ?? 1, a.fusionRank === 2 ? 3 : 2);
    const controlled = !!s.controlledUnitIds?.some(id => id === a.id || id === b.id);
    const child = add(template, slot, (a.fusionRank === 2 ? 3 : 2), ratio);
    if (controlled && !s.controlledUnitIds.includes(child.id))
        s.controlledUnitIds.push(child.id);
    if (s.controlledUnitIds)
        s.controlledUnitIds = s.controlledUnitIds.filter(id => id !== a.id && id !== b.id);
    for (const id of child.skills)
        child.cooldowns[id] = Math.max(a.cooldowns[id] ?? 0, b.cooldowns[id] ?? 0);
    (0, expeditionRules_2.applyExpeditionStats)(s);
    emit(s, { type: 'skill', sourceId: child.id, effect: 'fusion' + child.fusionRank, x: child.x, z: child.z });
}
