"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADVANCED_ACTIVE = exports.expeditionPaused = exports.endlessOpeningRest = exports.buffCount = exports.recruitCost = exports.legacyRecruitCost = exports.regularCount = exports.chapterWaves = exports.trialPackSize = exports.openingWaitsForClear = exports.openingWaveCounts = exports.trialWaveCounts = exports.expeditionBuffDescription = exports.combatScale = exports.isCoastTrial = exports.BUFFS = void 0;
exports.unclearedExpeditionWaves = unclearedExpeditionWaves;
exports.progressionHealth = progressionHealth;
exports.trialFronts = trialFronts;
exports.trialHint = trialHint;
exports.expeditionSlots = expeditionSlots;
exports.newExpedition = newExpedition;
exports.expeditionSpawns = expeditionSpawns;
exports.scheduleExpeditionWave = scheduleExpeditionWave;
exports.ensureExpeditionCadence = ensureExpeditionCadence;
exports.chooseExpeditionBuff = chooseExpeditionBuff;
exports.expeditionKill = expeditionKill;
exports.expeditionWaveCleared = expeditionWaveCleared;
exports.applyExpeditionStats = applyExpeditionStats;
exports.tickExpeditionBuffs = tickExpeditionBuffs;
exports.openingStations = openingStations;
const deterministicMath_1 = require("./deterministicMath");
const expeditionEconomy_1 = require("./expeditionEconomy");
const sceneGeometry_1 = require("./sceneGeometry");
const random_1 = require("./random");
const sceneGeometryData_1 = require("./sceneGeometryData");
exports.BUFFS = {
    tidePierce: { name: '贯潮箭', cap: 3, description: '射手普攻额外贯穿后方2只；伤害35%攻击，二阶起55%；每多一层再 +15%' },
    crystalBurst: { name: '碎晶浪', cap: 3, description: '水晶普攻溅射扩大，额外命中1只；溅射伤害每层 +15%攻击' },
    healingTide: { name: '盈潮护佑', cap: 3, description: '奶妈溢出治疗的35%转为3秒护盾，每层再 +15%；每次最多目标生命的6%' },
    tauntGuard: { name: '迎潮壁垒', rare: true, description: '受龟龟嘲讽的怪物被击败时，为嘲讽者提供2%最大生命的护盾，持续4秒；叠层提高护盾，单次最多8%' },
    cleanseSurge: { name: '净潮回生', rare: true, description: '成功净化时，额外恢复目标8%最大生命；叠层每层 +4%，最多20%' },
    attack: { name: '破浪之力', description: '全队攻击 +8%' }, defense: { name: '礁岩护甲', description: '全队双防 +10%' }, health: { name: '潮汐体魄', description: '全队生命上限 +10%' }, range: { name: '远眺海风', description: '攻击/治疗范围 +1 格，最多 +2 格', cap: 2 }, haste: { name: '灵潮回响', description: '主动冷却恢复速度 +10%，最多 +30%', cap: 3 }, drain: { name: '噬浪汲取', description: '造成伤害的 2% 转为生命，最多 20%' }, speed: { name: '疾风浪涌', description: '攻击速度 +6%，最多 +60%' }, regen: { name: '复苏海露', description: '每秒回复 0.4% 最大生命，最多 3%' }, crit: { name: '锐芒星砂', description: '暴击率 +4%，总暴击率最多 60%' }, guard: { name: '海幕守护', description: '受到伤害降低 4%，乘算叠加，最多 40%' },
    desperate: { name: '绝境潮生', rare: true, description: '每波首次低于30%生命，攻击/双防/生命上限/治疗提升25%，吸血 +5%，持续8秒；叠层每层再 +10% 与 +2%吸血' }, phoenix: { name: '不灭珍珠', rare: true, description: '抵挡一次致死伤害并无敌3秒，冷却60秒；叠层每层多恢复10%生命' }, waveGrowth: { name: '乘潮而长', rare: true, description: '此后每清一波，攻击/生命/双防 +2%（每层）' }, killAttack: { name: '猎潮锋芒', rare: true, description: '此后全队每击败一怪，攻击 +0.15%（每层）' }, killDefense: { name: '积礁成垒', rare: true, description: '此后全队每击败一怪，双防 +0.2%（每层）' }, killHealth: { name: '百川归海', rare: true, description: '此后全队每击败一怪，生命上限 +0.2%（每层）' }, treasury: { name: '聚宝潮心', rare: true, description: '每持有100干粮，全队攻击/双防/生命 +2%（每层），最多 +40%' }
};
const isCoastTrial = (s) => s.expedition?.coastTrial === 1 && s.levelId < 5;
exports.isCoastTrial = isCoastTrial;
const combatScale = (s) => (0, exports.isCoastTrial)(s) ? 10 : 1;
exports.combatScale = combatScale;
const expeditionBuffDescription = (s, id) => exports.BUFFS[id].description + ((0, exports.isCoastTrial)(s) && s.levelId === 0 && (id === 'drain' || id === 'desperate') ? '；本关总吸血每秒最多恢复2%生命' : '');
exports.expeditionBuffDescription = expeditionBuffDescription;
exports.trialWaveCounts = [6, 10, 16, 24, 32, 40, 48, 56, 64, 72];
/** New runs use a gentler introduction; saved battles retain their original spawn plan. */
exports.openingWaveCounts = [5, 7, 10, 13, 16, 20, 24, 28, 32, 36];
const openingWaitsForClear = (e, wave) => e.earlyBalance === 1 && (e.kind === 'chapter' || e.kind === 'endless' && wave <= 10);
exports.openingWaitsForClear = openingWaitsForClear;
const pendingWaveCache = new WeakMap();
/** Completed waves do not need to be scanned again on every 50 ms simulation tick. */
function unclearedExpeditionWaves(e, wave) {
    const prior = pendingWaveCache.get(e), length = e.clearedWaves?.length ?? e.completed;
    if (prior && prior.cleared === e.clearedWaves && prior.length === length && prior.wave === wave)
        return prior.pending;
    const cleared = new Set(e.clearedWaves ?? Array.from({ length: e.completed }, (_, i) => i + 1));
    const pending = Array.from({ length: wave }, (_, i) => i + 1).filter(w => !cleared.has(w));
    pendingWaveCache.set(e, { cleared: e.clearedWaves, length, wave, pending });
    return pending;
}
/** Smooth chapter checkpoints; opening waves teach the layout before testing the roster. */
function progressionHealth(e, level, wave) {
    if (e.enemyBalance === undefined)
        return 1;
    if (e.enemyBalance === 2 && e.kind === 'chapter' && level >= 5)
        return Math.min(1, .22 + (wave - 1) * .13) * (1 + Math.max(0, level - 9) * .012);
    if (e.kind === 'chapter' && level >= 5)
        return Math.min(1, .25 + (wave - 1) * .125) * (1 + Math.max(0, level - 9) * .02);
    if (e.kind === 'endless')
        return (0, deterministicMath_1.simulationPow)(1.025, Math.min(40, Math.max(0, wave - 20))) * (0, deterministicMath_1.simulationPow)(e.enemyBalance === 2 ? 1.055 : 1.1, Math.min(160, Math.max(0, wave - 60)));
    return 1;
}
const trialPackSize = (wave) => wave <= 2 ? (wave === 1 ? 2 : 3) : Math.min(8, 3 + Math.floor(wave / 2));
exports.trialPackSize = trialPackSize;
/** Route zero opens alone; every later entrance is introduced before simultaneous pressure. */
function trialFronts(s, spawns) {
    if (!(0, exports.isCoastTrial)(s) || !s.routes)
        return spawns;
    const lanes = s.routes.length, w = s.wave;
    let regular = 0;
    return spawns.map(spawn => { const i = spawn.kind === 'boss' ? Math.max(0, regular - 1) : regular++; return { ...spawn, routeId: w <= 2 ? 0 : w === 3 ? Math.min(1, lanes - 1) : w === 4 ? (i < Math.ceil((spawns.length - 1) / 2) ? 0 : Math.min(1, lanes - 1)) : Math.floor(i / (0, exports.trialPackSize)(w)) % lanes }; });
}
function trialHint(s) {
    if (s.wave <= 2)
        return '单路小队 · 先征召补齐火力，再考虑合成';
    if (s.wave === 3 && s.routes && s.routes.length > 1)
        return '另一入口来袭 · 长按换位覆盖新路线';
    if (s.levelId === 0 && s.wave >= 9)
        return '最后防线 · 首领漏过扣10守护，留技能拦截';
    if (s.levelId === 0 && s.wave >= 5)
        return '精英重击 · 肉盾承伤，奶妈支援，红圈可躲或打断';
    if (s.levelId === 0 && s.wave === 4)
        return '混合护卫来袭 · 搭配物理与法术输出';
    return s.levelId >= 3 ? '远程怪消耗后排 · 奶妈留净化，红圈可躲/打断' : s.levelId >= 2 ? '重击后及时治疗 · 打断使敌人短暂破防' : s.levelId >= 1 ? '小队集中来袭 · 二阶清群，奶妈覆盖前排' : '怪群逐步增多 · 同阶合成，拐角清群';
}
const chapterWaves = (id) => id < 10 ? 10 : id < 30 ? 15 : 20;
exports.chapterWaves = chapterWaves;
const regularCount = (wave) => Math.min(38, 16 + wave * 2);
exports.regularCount = regularCount;
const legacyRecruitCost = (waves) => Math.max(20, Math.floor(Array.from({ length: waves }, (_, i) => (0, exports.regularCount)(i + 1) * 2 + 20).reduce((a, b) => a + b, 0) / 20));
exports.legacyRecruitCost = legacyRecruitCost;
const recruitCost = (waves) => Math.ceil((0, exports.legacyRecruitCost)(waves) / 10) * 10;
exports.recruitCost = recruitCost;
const cache = new Map();
/** Fixed, legal, spacious stations; old saves keep their previous station geometry. */
function expeditionSlots(id) {
    const prior = cache.get(id);
    if (prior)
        return prior;
    // World challenge follows one straight road: every station is within the
    // unmodified 1.2-unit melee reach while respecting the road/foot clearance.
    // Alternate banks so both the initial formation and later swaps stay legible.
    if (id === 56) {
        const roadY = sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].routes[0][0][1], slots = [];
        for (let i = 0; i < 6; i++) {
            slots.push((0, sceneGeometry_1.scenePoint)(id, 78 + i * 68, roadY - 30.5));
            slots.push((0, sceneGeometry_1.scenePoint)(id, 112 + i * 68, roadY + 30.5));
        }
        cache.set(id, slots);
        return slots;
    }
    const count = id === 50 ? 30 : id >= 51 && id !== 54 && id !== 56 ? 24 : 12, half = count / 2, points = [];
    const courtyard = id === 51 ? [...sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].routes[0], ...[...sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].routes[1]].reverse()] : undefined;
    const interior = (x, y) => { if (!courtyard)
        return true; let inside = false; for (let i = 0, j = courtyard.length - 1; i < courtyard.length; j = i++) {
        const a = courtyard[i], b = courtyard[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
            inside = !inside;
    } return inside; };
    for (let y = 72; y <= 230; y += 3)
        for (let x = 62; x <= 505; x += 3) {
            if (id === 51 && (x < 100 || y > 198) || !interior(x, y))
                continue;
            const p = (0, sceneGeometry_1.scenePoint)(id, x, y);
            if (!(0, sceneGeometry_1.sceneGroundIssue)(id, p))
                points.push(p);
        }
    let result = [];
    const sorted = [...points].sort((a, b) => a.z - b.z), mid = (sorted[Math.floor(sorted.length / 2)]?.z ?? 0);
    for (let seed = 0; seed < 12; seed++) {
        const chosen = [];
        let complete = true;
        for (const side of [-1, 1]) {
            const candidates = points.filter(p => side < 0 ? p.z < mid - .2 : p.z >= mid + .2);
            candidates.sort((a, b) => seed < 2 ? (a.x - b.x) * (seed ? 1 : -1) : seed < 4 ? (a.z - b.z) * (seed === 2 ? 1 : -1) : (((0, deterministicMath_1.simulationSin)(a.x * 13 + a.z * 7 + seed * 93) * 10000) % 1) - (((0, deterministicMath_1.simulationSin)(b.x * 13 + b.z * 7 + seed * 93) * 10000) % 1));
            const sidePoints = [];
            for (const p of candidates)
                if (chosen.concat(sidePoints).every(q => (0, deterministicMath_1.simulationHypot)(q.x - p.x, q.z - p.z) >= 1.005))
                    sidePoints.push(p);
            // Spread the chosen fixed stations across the available shore.
            const picked = [];
            while (picked.length < half && sidePoints.length) {
                sidePoints.sort((a, b) => { const score = (p) => Math.min(4, ...picked.map(q => (0, deterministicMath_1.simulationHypot)(q.x - p.x, q.z - p.z))); return score(b) - score(a); });
                picked.push(sidePoints.shift());
            }
            if (picked.length < half)
                complete = false;
            chosen.push(...picked);
        }
        if (chosen.length > result.length)
            result = chosen;
        if (complete) {
            result = chosen;
            break;
        }
    }
    if (result.length < count && id !== 50)
        throw Error('地图 ' + id + ' 的合法站位不足 ' + count + ' 个');
    cache.set(id, result);
    return result;
}
const buffCount = (s, u, id) => s.expedition?.players.find(p => p.id === u.ownerId)?.buffs[id] ?? 0;
exports.buffCount = buffCount;
function newExpedition(kind, map, players, limit = (0, exports.chapterWaves)(map)) {
    const n = expeditionSlots(map).length, cost = 40;
    return { version: 2, economyVersion: 1, openingRations: 150, enemyBalance: 2, ...(kind === 'endless' || kind === 'chapter' ? { earlyBalance: 1 } : {}), ...(kind === 'endless' ? { openingGrace: 1 } : {}), ...(kind === 'chapter' && map < 5 ? { coastTrial: 1 } : {}), kind, limit: kind === 'endless' ? 0 : limit, completed: 0, cost, cap: kind === 'endless' ? 0 : 20, serial: 0, bossAwards: [], players: players.map((p, i) => ({ ...p, templates: JSON.parse(JSON.stringify(p.templates)), coins: 150, earned: 0, spent: 0, recruited: 0, buffs: {}, growth: { attack: 0, defense: 0, health: 0 }, choices: [], pending: 0, slots: Array.from({ length: n / players.length }, (_, j) => i * n / players.length + j) })) };
}
function expeditionSpawns(s) {
    const e = s.expedition, w = s.wave, level = e.kind === 'chapter' ? s.levelId : e.kind === 'raid' ? (s.levelId === 55 ? 3 : s.levelId - 51) * 8 : 0;
    if ((0, exports.isCoastTrial)(s)) {
        const n = (e.earlyBalance === 1 ? exports.openingWaveCounts : exports.trialWaveCounts)[Math.min(9, w - 1)], pack = (0, exports.trialPackSize)(w), gap = w <= 2 ? 4 : Math.max(2.5, 4 - w * .15), scale = .48 * (1 + level * .09) * (0, deterministicMath_1.simulationPow)(1.15, w - 1);
        const spawns = Array.from({ length: n }, (_, i) => {
            const guardLesson = level === 0;
            const elite = ((level >= 1 && w >= 3 || guardLesson && w >= 5) && i === Math.floor(n * .66)) || (guardLesson && w >= 9 && i === Math.floor(n * .2)), controller = level >= 3 && w >= 4 && i === Math.floor(n * .4);
            const kind = elite ? 'elite' : controller ? 'mist' : w >= 3 && i % 12 === 7 ? 'snail' : w >= 4 && (guardLesson ? i % 8 === 0 : i % 9 === 7) ? 'armored' : guardLesson && w >= 4 && i % 8 === 1 ? 'mist' : i % 5 === 4 ? 'runner' : 'ink';
            // Mixed physical/magic guards survive the first burst; the bulk of each pack stays clearable.
            return { bounty: true, kind, time: s.elapsed + (s.wave === 1 ? 2 : .6) + Math.floor(i / pack) * gap + (i % pack) * (w <= 2 ? .8 : .24), hpScale: scale * (guardLesson ? (elite ? 1.8 : kind === 'armored' || kind === 'mist' ? 2.5 : .78) : (elite ? .8 : controller ? 1.15 : .78)), attackScale: (w <= 2 ? .4 : .82 + level * .12) * Math.sqrt(scale) };
        });
        spawns.push({ bounty: true, kind: 'boss', time: spawns[Math.floor((n - 1) * .7)].time + .6, hpScale: scale * (w <= 2 ? .16 : (.24 + .02 * w) * (level === 0 && w >= 4 ? 1.5 : 1)), attackScale: (w <= 2 ? .55 : 1.1 + level * .12) * Math.sqrt(scale) });
        // The boss joins the closing packs, instead of arriving after a long empty tail.
        if (e.earlyBalance === 1)
            for (const spawn of spawns) {
                spawn.hpScale *= .55 + level * .035;
                spawn.attackScale *= .4 + level * .04;
            }
        return (0, expeditionEconomy_1.rationBounties)(e, w, spawns.sort((a, b) => a.time - b.time));
    }
    const chapterCurve = e.enemyBalance === 2 && e.kind === 'chapter';
    const scale = chapterCurve ? (.8 + (level - 5) * .025) * (0, deterministicMath_1.simulationPow)(1.065, w - 1) : (.55 + level * .055) * (0, deterministicMath_1.simulationPow)(1.095, Math.min(w - 1, 60)) * (w > 61 ? 1 + (w - 61) * .12 : 1), n = e.earlyBalance === 1 && w <= 10 ? Math.min((0, exports.regularCount)(w), exports.openingWaveCounts[w - 1] + (e.kind === 'chapter' && e.enemyBalance === undefined ? 4 : 0)) : (0, exports.regularCount)(w), duration = 18 + Math.min(10, w * .5);
    const kinds = ['ink', 'runner', 'armored', 'mist', 'snail'];
    const spawns = Array.from({ length: n }, (_, i) => ({ bounty: true, kind: kinds[(i + w) % Math.min(5, 2 + Math.floor((w + level) / 4))], time: s.elapsed + 1 + i * duration / n, hpScale: scale, attackScale: Math.sqrt(scale) * .6 }));
    if (!(0, exports.endlessOpeningRest)(e, w))
        spawns.push({ bounty: true, kind: 'boss', time: s.elapsed + duration + 1, hpScale: scale * .27, attackScale: Math.sqrt(scale) * .65 });
    if (e.earlyBalance === 1)
        for (const spawn of spawns) {
            const ease = e.kind === 'endless' ? Math.min(1, .6 + (w - 1) * .045) : Math.min(1, .65 + (level - 5) * .07);
            spawn.hpScale *= ease;
            spawn.attackScale *= chapterCurve ? Math.min(.95, .45 + (w - 1) * .07) : ease;
        }
    for (const spawn of spawns)
        spawn.hpScale *= progressionHealth(e, level, w);
    return (0, expeditionEconomy_1.rationBounties)(e, w, spawns);
}
const endlessOpeningRest = (e, wave) => e.kind === 'endless' && e.openingGrace === 1 && wave < 10 && wave !== 5;
exports.endlessOpeningRest = endlessOpeningRest;
/** Next front is scheduled from the spawn plan, never from the last enemy's death. */
function scheduleExpeditionWave(s) {
    const last = Math.max(s.elapsed, ...s.spawns.map(v => v.time)), opening = s.wave <= 2;
    s.expedition.nextWaveTick = Math.ceil(Math.max(s.elapsed + (opening ? 20 : 0), last + (s.expedition.openingGrace === 1 && s.wave < 10 ? (s.wave < 5 ? 10 : 6) : opening ? 3 : 1.5)) * 20 - 1e-8);
}
/** Older in-progress runs gain the new clock without replaying any paid wave reward. */
function ensureExpeditionCadence(s) {
    const e = s.expedition;
    if (!e || e.cadenceVersion === 1)
        return;
    e.cadenceVersion = 1;
    e.clearedWaves = Array.from({ length: e.completed }, (_, i) => i + 1);
    for (const enemy of s.enemies)
        enemy.originWave = Math.min(s.wave, Math.max(1, Number(enemy.id.split('-')[1]) || s.wave));
    scheduleExpeditionWave(s);
}
function offer(s, p) {
    if (p.choices.length || !p.pending)
        return;
    const buildRoles = { tidePierce: 'spike', crystalBurst: 'crystal', healingTide: 'leaf' };
    const pool = Object.keys(exports.BUFFS).filter(id => ((0, exports.isCoastTrial)(s) || !['tauntGuard', 'cleanseSurge', 'tidePierce', 'crystalBurst', 'healingTide'].includes(id)) && (!buildRoles[id] || s.units.some(u => u.alive && u.ownerId === p.id && u.role === buildRoles[id])) && (!exports.BUFFS[id].cap || (p.buffs[id] ?? 0) < exports.BUFFS[id].cap));
    for (let n = 0; n < 3; n++) {
        const total = pool.reduce((v, id) => v + (exports.BUFFS[id].rare ? 2 : 12), 0);
        let roll = (0, random_1.random)(s) * total, index = 0;
        for (; index < pool.length - 1; index++) {
            roll -= exports.BUFFS[pool[index]].rare ? 2 : 12;
            if (roll < 0)
                break;
        }
        p.choices.push(pool.splice(index, 1)[0]);
    }
}
function chooseExpeditionBuff(s, owner, id) {
    const e = s.expedition, p = e?.players.find(v => v.id === owner);
    if (!p || !p.choices.includes(id))
        throw Error('祝福选项已更新');
    p.buffs[id] = (p.buffs[id] ?? 0) + 1;
    p.choices = [];
    p.pending--;
    offer(s, p);
    applyExpeditionStats(s);
}
function expeditionKill(s, target) {
    const e = s.expedition;
    if (!e || target.mechanismOwner || !target.expeditionBounty)
        return;
    for (const p of e.players) {
        const gold = e.economyVersion === 1 ? (target.rations ?? 0) : target.kind === 'boss' ? 20 : (0, exports.isCoastTrial)(s) && s.wave <= 2 ? 8 : 2;
        p.coins += gold;
        p.earned += gold;
        p.growth.attack += .0015 * (p.buffs.killAttack ?? 0);
        p.growth.defense += .002 * (p.buffs.killDefense ?? 0);
        p.growth.health += .002 * (p.buffs.killHealth ?? 0);
    }
    const wave = target.originWave ?? s.wave;
    if (target.kind === 'boss' && !e.bossAwards.includes(wave)) {
        e.bossAwards.push(wave);
        for (const p of e.players) {
            p.pending++;
            offer(s, p);
        }
    }
}
function expeditionWaveCleared(s, wave = s.wave) {
    const e = s.expedition;
    if (e.cadenceVersion === 1) {
        if (e.clearedWaves.includes(wave))
            return;
        e.clearedWaves.push(wave);
        e.completed = e.clearedWaves.length;
    }
    else {
        if (e.completed >= wave)
            return;
        e.completed = wave;
    }
    if ((0, exports.openingWaitsForClear)(e, wave) && wave === s.wave)
        e.nextWaveTick = Math.max(e.nextWaveTick ?? 0, s.tick + 80);
    if ((0, exports.endlessOpeningRest)(e, wave) && !e.bossAwards.includes(wave)) {
        e.bossAwards.push(wave);
        for (const p of e.players) {
            p.pending++;
            offer(s, p);
        }
    }
    for (const p of e.players) {
        const gold = (0, expeditionEconomy_1.waveClearRations)(e, wave);
        p.coins += gold;
        p.earned += gold;
        for (const key of ['attack', 'health', 'defense'])
            p.growth[key] += .02 * (p.buffs.waveGrowth ?? 0);
    }
    applyExpeditionStats(s);
}
const expeditionPaused = (s) => !!s.expedition?.players.some(p => p.choices.length);
exports.expeditionPaused = expeditionPaused;
function applyExpeditionStats(s) {
    if (!s.expedition)
        return;
    for (const u of s.units) {
        const p = s.expedition.players.find(p => p.id === u.ownerId);
        if (!p)
            continue;
        u.expeditionBase ?? (u.expeditionBase = { attack: u.attack, health: u.maxHp, armor: u.armor, resist: u.resist, range: u.range, interval: u.interval });
        const base = u.expeditionBase, b = p.buffs, rank = u.fusionRank === 3 ? ((0, exports.isCoastTrial)(s) ? 5.5 : 3.5) : u.fusionRank === 2 ? ((0, exports.isCoastTrial)(s) ? 2.4 : 1.85) : 1;
        const low = (u.desperateUntil ?? 0) > s.tick ? (.25 + .10 * ((b.desperate ?? 1) - 1)) : 0, treasury = Math.min(.4, Math.floor(p.coins / 100) * .02 * (b.treasury ?? 0));
        // Fusion keeps its burst payoff, but defense must not compound with a 5.5x health pool.
        const scale = (key, per) => {
            const fusion = (0, exports.isCoastTrial)(s) && s.levelId === 0 && key !== 'attack' ? (key === 'defense' ? (u.fusionRank === 3 ? 1.7 : u.fusionRank === 2 ? 1.3 : 1) : (u.fusionRank === 3 ? 4.5 : u.fusionRank === 2 ? 2.2 : 1)) : rank;
            return fusion * (1 + (b[key] ?? 0) * per + Math.min(3, p.growth[key]) + treasury + low);
        };
        const health = base.health * scale('health', .10), ratio = u.hp / u.maxHp;
        u.hp = Math.min(health, Math.max(0, ratio * health));
        u.maxHp = health;
        u.attack = base.attack * scale('attack', .08);
        u.armor = base.armor * scale('defense', .10);
        u.resist = base.resist * scale('defense', .10);
        u.range = base.range + Math.min(2, b.range ?? 0);
        u.interval = base.interval / (1 + Math.min(.6, (b.speed ?? 0) * .06));
    }
}
function tickExpeditionBuffs(s) {
    if (!s.expedition)
        return;
    for (const u of s.units) {
        if (!u.alive)
            continue;
        const desperate = (0, exports.buffCount)(s, u, 'desperate');
        if (desperate && u.hp / u.maxHp < .3 && u.desperateWave !== s.wave) {
            u.desperateWave = s.wave;
            u.desperateUntil = s.tick + 160;
        }
        if (s.tick % 20 === 0) {
            const regen = Math.min(.03, (0, exports.buffCount)(s, u, 'regen') * .004);
            u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen);
        }
    }
    if (s.tick % 5 === 0)
        applyExpeditionStats(s);
}
exports.ADVANCED_ACTIVE = { stone: 'stoneMastery', spike: 'spikeMastery', crystal: 'crystalMastery', leaf: 'leafMastery', bubble: 'spirit' };
/** Spread the opening team along the actual lanes, with the healer supporting allies. */
function openingStations(map, roles, allowed = expeditionSlots(map).map((_, i) => i)) {
    const slots = expeditionSlots(map), samples = (0, sceneGeometry_1.sceneRoutes)(map).flatMap(r => r.slice(1).flatMap((b, i) => { const a = r[i], n = Math.max(1, Math.ceil((0, deterministicMath_1.simulationHypot)(a.x - b.x, a.z - b.z) / .35)); return Array.from({ length: n }, (_, j) => ({ x: a.x + (b.x - a.x) * j / n, z: a.z + (b.z - a.z) * j / n })); })), coverage = samples.map(() => 0), result = [];
    const order = roles.map((role, i) => ({ role, i })).sort((a, b) => Number(a.role === 'leaf') - Number(b.role === 'leaf'));
    for (const { role, i } of order) {
        const range = role === 'stone' ? 1.2 : role === 'leaf' ? 2.7 : 2.4;
        const options = allowed.filter(slot => !result.includes(slot));
        options.sort((a, b) => { const score = (slot) => role === 'leaf' ? result.filter(n => n !== undefined).reduce((sum, n) => sum + ((0, deterministicMath_1.simulationHypot)(slots[n].x - slots[slot].x, slots[n].z - slots[slot].z) < range ? 1 : 0), 0) : samples.reduce((sum, p, k) => sum + ((0, deterministicMath_1.simulationHypot)(p.x - slots[slot].x, p.z - slots[slot].z) < range ? (1 + .3 * k / samples.length) / (1 + coverage[k]) : 0), 0); return score(b) - score(a) || a - b; });
        const slot = options[0];
        result[i] = slot;
        if (role !== 'leaf')
            samples.forEach((p, k) => { if ((0, deterministicMath_1.simulationHypot)(p.x - slots[slot].x, p.z - slots[slot].z) < range)
                coverage[k]++; });
    }
    return result;
}
