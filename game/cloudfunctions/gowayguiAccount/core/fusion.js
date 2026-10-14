"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROGRESSION_WEIGHTS = exports.FUSION_VERSION = void 0;
exports.legacyCountDistribution = legacyCountDistribution;
exports.countDistribution = countDistribution;
exports.previewFusion = previewFusion;
exports.combinedCountChance = combinedCountChance;
exports.generateFusion = generateFusion;
const deterministicMath_1 = require("./deterministicMath");
const data_1 = require("./data");
const talents_1 = require("./talents");
const random_1 = require("./random");
exports.FUSION_VERSION = 'island-0.7';
const LEGEND_CHANCE = [0, .00001, .00001, .00001, .00001, .00005, .0001, .0002, .0005, .0008, .001, .001, .001];
const ELEVEN_CHANCE = [0, .0001, .0001, .0001, .0001, .0005, .002, .006, .0195, .035, .06, .06, .06];
/** Tail rates stay fixed; impossible outcomes are removed, never folded into the maximum. */
function legacyCountDistribution(a, b, poolSize) {
    if (a < 1 || b < 1 || a > 12 || b > 12 || poolSize < 1 || poolSize > 24)
        throw new Error('合成数量参数不合法');
    const max = Math.min(12, poolSize), minParent = Math.min(a, b);
    const p12 = max >= 12 ? LEGEND_CHANCE[minParent] : 0;
    const p11 = max >= 11 ? ELEVEN_CHANCE[minParent] : 0;
    const mean = (a + b) / 2, floor = Math.min(max, Math.max(1, Math.floor(mean / 2)));
    const lower = [];
    const specific = { 4: 3, 5: 8, 6: 16, 7: 27, 8: 28, 9: 12, 10: 4 };
    for (let k = floor; k <= Math.min(max, 10); k++) {
        const weight = a === 8 && b === 8 ? (specific[k] || 0) : (0, deterministicMath_1.simulationExp)(-(0, deterministicMath_1.simulationPow)(k - (mean - .45), 2) / (2 * 1.35 * 1.35));
        if (weight > 0)
            lower.push({ value: k, probability: weight });
    }
    const sum = lower.reduce((s, e) => s + e.probability, 0);
    if (sum <= 0)
        throw new Error('合成分布无可用数量');
    lower.forEach(e => e.probability = e.probability / sum * (1 - p11 - p12));
    if (p11)
        lower.push({ value: 11, probability: p11 });
    if (p12)
        lower.push({ value: 12, probability: p12 });
    return lower;
}
/** Low/mid skill progression weights. Rows interpolate at the parents' mean count.
 * Only the 1–8 mass is redistributed; every feasible 9–12 probability stays unchanged.
 * Incompatible/duplicate skills still reduce the actual pool and possible results. */
exports.PROGRESSION_WEIGHTS = [
    [35, 65, 0, 0, 0, 0, 0, 0],
    [8, 37, 43, 12, 0, 0, 0, 0],
    [2, 10, 35, 35, 15, 3, 0, 0],
    [0, 4, 14, 30, 29, 16, 6, 1],
    [0, 2, 7, 17, 28, 27, 14, 5],
    [0, 0, 2, 8, 20, 30, 26, 14],
    [0, 0, 1, 3, 10, 24, 34, 28],
    [0, 0, 0, 1, 3, 10, 26, 60],
];
function countDistribution(a, b, poolSize) {
    const legacy = legacyCountDistribution(a, b, poolSize), mean = (a + b) / 2;
    if (mean > 8)
        return legacy;
    const tail = legacy.filter(e => e.value >= 9), mass = 1 - tail.reduce((n, e) => n + e.probability, 0);
    const lo = exports.PROGRESSION_WEIGHTS[Math.floor(mean) - 1], hi = exports.PROGRESSION_WEIGHTS[Math.ceil(mean) - 1], fraction = mean - Math.floor(mean);
    const lower = Array.from({ length: Math.min(8, poolSize) }, (_, i) => ({ value: i + 1, probability: lo[i] * (1 - fraction) + hi[i] * fraction })).filter(e => e.probability > 0);
    const sum = lower.reduce((n, e) => n + e.probability, 0);
    // Extreme role incompatibility can leave only a skill below the row's floor.
    if (!sum)
        return legacy;
    return lower.map(e => ({ value: e.value, probability: e.probability / sum * mass })).concat(tail);
}
function previewFusion(a, b) {
    const roles = a.role === b.role ? [a.role] : [a.role, b.role];
    return roles.map(role => {
        const allowed = new Set((0, data_1.skillsForRole)(role));
        // Cocos' loose spread transform treats a Set as one concat element. Materialize iterables explicitly.
        const pool = Array.from(new Set(a.skills.concat(b.skills))).filter(s => allowed.has(s));
        return { role, probability: roles.length === 1 ? 1 : role === a.role ? .6 : .4, pool, counts: countDistribution(a.skills.length, b.skills.length, pool.length) };
    });
}
function combinedCountChance(branches, count) {
    return branches.reduce((s, b) => s + b.probability * (b.counts.find(c => c.value === count)?.probability || 0), 0);
}
function generateFusion(state, a, b, id, now) {
    const branches = previewFusion(a, b);
    const branch = branches.length === 1 ? branches[0] : branches[(0, random_1.random)(state) < .6 ? 0 : 1];
    const count = (0, random_1.weighted)(state, branch.counts);
    const innate = (0, talents_1.inheritTalents)(state, a, b);
    const inherited = (0, random_1.sample)(state, branch.pool, count);
    // A specialization without its active remains a visible dormant trait; relearning the active re-enables it.
    return { ...(a.development || b.development ? { development: { version: 1, xp: Math.floor(((a.development?.xp ?? 0) + (b.development?.xp ?? 0)) / 2), points: { attack: 0, health: 0, defense: 0 } } } : {}), id, role: branch.role, name: '', skills: inherited, innate, training: { attack: 0, health: 0, defense: 0, growth: 0 }, generation: Math.max(a.generation, b.generation) + 1, bornAt: now, parentIds: [a.id, b.id], locked: false };
}
