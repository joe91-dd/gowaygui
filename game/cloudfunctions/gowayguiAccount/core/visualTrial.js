"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_OBSTACLES = exports.REVIEW_ROUTE = void 0;
exports.reviewRoadDistance = reviewRoadDistance;
exports.reviewPlacement = reviewPlacement;
exports.createVisualTrial = createVisualTrial;
const deterministicMath_1 = require("./deterministicMath");
const game_1 = require("./game");
const prototype_1 = require("./prototype");
const living_1 = require("./living");
const battle_1 = require("./battle");
/** An isolated art acceptance battle. Never reads or writes an account/save repository. */
function roundedRoad(points) {
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i], before = points[i - 1], after = points[i + 1], a = (0, deterministicMath_1.simulationHypot)(p.x - before.x, p.z - before.z), b = (0, deterministicMath_1.simulationHypot)(after.x - p.x, after.z - p.z), r = Math.min(.65, a * .35, b * .35);
        const start = { x: p.x + (before.x - p.x) * r / a, z: p.z + (before.z - p.z) * r / a }, end = { x: p.x + (after.x - p.x) * r / b, z: p.z + (after.z - p.z) * r / b };
        for (let j = 0; j <= 6; j++) {
            const t = j / 6, q = 1 - t;
            out.push({ x: q * q * start.x + 2 * q * t * p.x + t * t * end.x, z: q * q * start.z + 2 * q * t * p.z + t * t * end.z });
        }
    }
    out.push(points[points.length - 1]);
    return out;
}
exports.REVIEW_ROUTE = roundedRoad([{ x: -7.2, z: 0 }, { x: -4.3, z: 0 }, { x: -2.8, z: -1.8 }, { x: 2.8, z: -1.8 }, { x: 4.4, z: 0 }, { x: 7.0, z: 0 }]);
exports.REVIEW_OBSTACLES = [{ x: -6, z: 2.9, r: .65 }, { x: -6.7, z: -2.5, r: .65 }, { x: 5.7, z: 2.8, r: .65 }, { x: 5.9, z: -2.7, r: .6 }, { x: -4.5, z: -3.3, r: .6 }, { x: 4.4, z: 3.2, r: .65 }];
function reviewRoadDistance(p) { return Math.min(...exports.REVIEW_ROUTE.slice(1).map((b, i) => { const a = exports.REVIEW_ROUTE[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return (0, deterministicMath_1.simulationHypot)(p.x - a.x - dx * t, p.z - a.z - dz * t); })); }
function reviewPlacement(p, others) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z))
        return '落点无效';
    if ((p.x / 8.1) ** 2 + (p.z / 4.0) ** 2 > 1)
        return '请放在岛内草地';
    if (reviewRoadDistance(p) < .82)
        return '怪物道路不可放置';
    if (p.x > 5.8 && Math.abs(p.z) < 1.7)
        return '守护灯塔附近不可放置';
    if (exports.REVIEW_OBSTACLES.some(o => (0, deterministicMath_1.simulationHypot)(o.x - p.x, o.z - p.z) < o.r + .4))
        return '树木与礁石附近不可放置';
    if (others.some(v => (0, deterministicMath_1.simulationHypot)(v.x - p.x, v.z - p.z) < 1.1))
        return '伙伴站位重叠';
    return undefined;
}
function createVisualTrial() {
    const save = (0, game_1.makeInitialSave)(1789444800000, 731);
    (0, prototype_1.enablePrototype)(save);
    (0, living_1.enableLiving)(save);
    const pets = ['stone', 'crystal'].map(role => { const p = Object.values(save.collection).find(p => p.role === role); return { ...p, skills: role === 'stone' ? ['hold', 'stoneMastery', 'strong', 'armor'] : ['crystalCannon', 'crystalMastery', 'strong', 'swift'] }; });
    const b = (0, battle_1.createBattle)(0, 1, pets.map((turtle, slot) => ({ id: turtle.id, turtle, slot, level: 1 })), { rulesVersion: '0.6', seed: 918 });
    b.route = exports.REVIEW_ROUTE.map(p => ({ ...p }));
    b.routeLength = exports.REVIEW_ROUTE.slice(1).reduce((sum, p, i) => sum + (0, deterministicMath_1.simulationHypot)(p.x - exports.REVIEW_ROUTE[i].x, p.z - exports.REVIEW_ROUTE[i].z), 0);
    b.routes = undefined;
    b.routeLengths = undefined;
    b.units.forEach((u, i) => { u.x = i ? 1.1 : -2.3; u.z = i ? .7 : -.8; u.placement = { x: u.x, z: u.z }; u.maxHp *= 3; u.hp = u.maxHp; u.attack *= 2.0; });
    b.spawns = Array.from({ length: 24 }, (_, i) => ({ kind: 'armored', time: i * 2.4, hpScale: 1.25, attackScale: .55 }));
    b.autoSkills = false;
    return b;
}
