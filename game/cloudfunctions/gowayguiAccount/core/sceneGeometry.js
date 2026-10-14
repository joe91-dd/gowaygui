"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sceneSlots = exports.sceneRoutes = exports.SCENE_FLOOR = exports.SCENE_FOOTPRINT = exports.SCENE_REVISION = void 0;
exports.sceneDepth = sceneDepth;
exports.scenePoint = scenePoint;
exports.scenePixel = scenePixel;
exports.sceneRoadDistance = sceneRoadDistance;
exports.sceneGroundIssue = sceneGroundIssue;
exports.safeScenePoint = safeScenePoint;
const deterministicMath_1 = require("./deterministicMath");
const sceneGeometryData_1 = require("./sceneGeometryData");
exports.SCENE_REVISION = 2026092301;
exports.SCENE_FOOTPRINT = .46;
exports.SCENE_FLOOR = .045;
const FOOT = exports.SCENE_FOOTPRINT * 560 / 18;
function sceneDepth(id) { return 18 * (id < 50 ? 932 / 1688 : 941 / 1672) * Math.sqrt(1 + .6 * .6); }
function scenePoint(id, x, y) { return { x: (x / 560 - .5) * 18, z: (y / 310 - .5) * sceneDepth(id) + exports.SCENE_FLOOR * .6 }; }
function scenePixel(id, p) { return { x: (p.x / 18 + .5) * 560, z: ((p.z - exports.SCENE_FLOOR * .6) / sceneDepth(id) + .5) * 310 }; }
function segment(x, y, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return (0, deterministicMath_1.simulationHypot)(x - a[0] - t * dx, y - a[1] - t * dy); }
function inside(x, y, poly) { let ok = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
        ok = !ok;
} return ok; }
function sceneRoadDistance(id, p) { const q = scenePixel(id, p); let d = Infinity; for (const r of sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].routes)
    for (let i = 1; i < r.length; i++)
        d = Math.min(d, segment(q.x, q.z, r[i - 1], r[i])); return d; }
function sceneGroundIssue(id, p) {
    const g = sceneGeometryData_1.SCENE_GEOMETRY_DATA[id];
    if (!g || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z))
        return '请选择地图上的位置';
    const { x, z: y } = scenePixel(id, p);
    if (!inside(x, y, g.land) || g.land.some((a, i) => segment(x, y, a, g.land[(i + 1) % g.land.length]) < FOOT))
        return '请放到能完整站下伙伴的陆地上';
    if (sceneRoadDistance(id, p) < g.roadHalfWidth + FOOT)
        return '请避开怪物通行路线';
    if (g.obstacles.some(([a, b, rx, ry]) => ((x - a) / (rx + FOOT)) ** 2 + ((y - b) / (ry + FOOT)) ** 2 < 1))
        return '这里有岩石、树木或建筑，请换到旁边空地';
    const end = g.routes[0][g.routes[0].length - 1];
    if (id !== 55 && (0, deterministicMath_1.simulationHypot)(x - end[0], y - end[1]) < 31)
        return '请给守护珍珠留出空间';
}
const sceneRoutes = (id) => sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].routes.map(r => r.map(([x, y]) => scenePoint(id, x, y)));
exports.sceneRoutes = sceneRoutes;
const sceneSlots = (id) => sceneGeometryData_1.SCENE_GEOMETRY_DATA[id].slots.map(([x, y]) => scenePoint(id, x, y));
exports.sceneSlots = sceneSlots;
function safeScenePoint(id, target, occupied = []) {
    const valid = (p) => !sceneGroundIssue(id, p) && occupied.every(q => (0, deterministicMath_1.simulationHypot)(q.x - p.x, q.z - p.z) >= exports.SCENE_FOOTPRINT * 2 + .08);
    if (valid(target))
        return { ...target };
    const options = (0, exports.sceneSlots)(id).filter(valid).sort((a, b) => (0, deterministicMath_1.simulationHypot)(a.x - target.x, a.z - target.z) - (0, deterministicMath_1.simulationHypot)(b.x - target.x, b.z - target.z));
    if (!options.length)
        throw Error('当前战场没有足够的合法站位');
    return { ...options[0] };
}
