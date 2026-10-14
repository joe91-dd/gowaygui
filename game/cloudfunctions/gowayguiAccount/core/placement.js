"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOOTPRINT = exports.hudPlacementIssue = void 0;
exports.mapProps = mapProps;
exports.groundIssue = groundIssue;
exports.placementIssue = placementIssue;
exports.normalizedPoint = normalizedPoint;
exports.fieldIssue = fieldIssue;
exports.exchangePlacementIssue = exchangePlacementIssue;
const deterministicMath_1 = require("./deterministicMath");
const paintedMaps_1 = require("./paintedMaps");
const mapPresentation_1 = require("./mapPresentation");
const approvedCoast_1 = require("./approvedCoast");
const coastStageGeometry_1 = require("./coastStageGeometry");
const modeStageGeometry_1 = require("./modeStageGeometry");
var hudPlacement_1 = require("./hudPlacement");
Object.defineProperty(exports, "hudPlacementIssue", { enumerable: true, get: function () { return hudPlacement_1.hudPlacementIssue; } });
exports.FOOTPRINT = .46;
/** The renderer and placement checks share exactly the same live landmarks. */
function mapProps(m) {
    if ((0, coastStageGeometry_1.isCoastStage)(m) || (0, modeStageGeometry_1.isModeStage)(m))
        return [];
    if (m.sceneArt) {
        // Decoration never becomes a gameplay obstacle. The live route and free
        // placement field remain authoritative for themed maps.
        if ((m.stationVersion ?? 0) >= 6)
            return (0, paintedMaps_1.paintedLayout)(m.id).rocks.map((p, i) => ({ ...p, tile: i % 2 ? 4 : 3, height: .30 }));
        return [];
    }
    if (m.id === 0 || m.id === 56)
        return [];
    const { rx, rz } = (0, mapPresentation_1.mapBounds)(m), theme = (0, mapPresentation_1.mapTheme)(m), result = [];
    let i = 0;
    for (let x = -rx * .75; x < rx * .8; x += 2.15)
        for (let z = -rz * .72; z < rz * .78; z += 1.85, i++) {
            if ((i * 7 + m.id) % 5 > 1)
                continue;
            const p = { x: x + .22 * (0, deterministicMath_1.simulationSin)(z * 3 + m.id), z };
            if ((0, mapPresentation_1.routeClearance)(m, p) < 1.05 || m.slots.some(s => (0, deterministicMath_1.simulationHypot)(p.x - s.x, p.z - s.z) < 1.2))
                continue;
            const tile = theme.props[(i + m.id) % theme.props.length];
            result.push({ ...p, tile, height: i % 6 === 0 ? 1.35 : .95, radius: [0, 1, 10].includes(tile) ? .42 : .55 });
        }
    return result;
}
const coastLand = [[110, 60], [1470, 60], [1610, 330], [1600, 770], [1280, 835], [730, 790], [420, 650], [220, 540], [140, 310]].map(([x, y]) => (0, approvedCoast_1.coastPoint)(x, y));
const coastRocks = [[405, 265, 55], [700, 160, 48], [880, 160, 45], [1110, 430, 40], [708, 535, 39], [1220, 750, 42], [275, 480, 40]].map(([x, y, r]) => ({ ...(0, approvedCoast_1.coastPoint)(x, y), radius: r / 1672 * 18 }));
function inside(p, poly) {
    let yes = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x)
            yes = !yes;
    }
    return yes;
}
function groundIssue(m, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z))
        return '请选择地图上的位置';
    if ((0, coastStageGeometry_1.isCoastStage)(m))
        return (0, coastStageGeometry_1.coastGroundIssue)(m.id, p);
    if ((0, modeStageGeometry_1.isModeStage)(m))
        return (0, modeStageGeometry_1.modeGroundIssue)(m.id, p);
    const { rx, rz } = (0, mapPresentation_1.mapBounds)(m);
    if (m.sceneArt ? (Math.abs(p.x) > 8.65 || Math.abs(p.z) > 4.72) : m.id === 0 ? !inside(p, coastLand) : (0, deterministicMath_1.simulationPow)(Math.abs(p.x) / (rx * .87), 4) + (0, deterministicMath_1.simulationPow)(Math.abs(p.z) / (rz * .87), 4) > 1)
        return '这里是海面或岸边，请放到陆地上';
    if ((0, mapPresentation_1.routeClearance)(m, p) < ((m.stationVersion ?? 0) >= 6 ? paintedMaps_1.ROAD_PLACEMENT_CLEARANCE : .76))
        return '请避开怪物通行路线';
    if ((m.id === 0 && !m.sceneArt ? coastRocks : mapProps(m)).some(o => (0, deterministicMath_1.simulationHypot)(o.x - p.x, o.z - p.z) < o.radius + exports.FOOTPRINT))
        return '这里有岩石或树木，请换个位置';
    const guard = m.id === 55 && !m.sceneArt ? { x: 0, z: 0 } : m.route[m.route.length - 1];
    if (m.id !== 56 && (0, deterministicMath_1.simulationHypot)(p.x - guard.x, p.z - guard.z) < 1.05)
        return '请给守护珍珠留出空间';
}
function placementIssue(m, p, others = []) {
    return groundIssue(m, p) ?? (others.some(o => (0, deterministicMath_1.simulationHypot)(o.x - p.x, o.z - p.z) < exports.FOOTPRINT * 2 + .08) ? '伙伴之间需要留出一点空间' : undefined);
}
function normalizedPoint(p) { return { x: Math.round(p.x * 1000) / 1000, z: Math.round(p.z * 1000) / 1000 }; }
function fieldIssue(m, units) {
    for (const u of units)
        if (u.placement !== undefined) {
            const issue = placementIssue(m, u.placement, units.filter(o => o !== u).map(o => o.placement ?? m.slots[o.slot]).filter(Boolean));
            if (issue)
                return issue;
        }
}
/** Dropping on a fielded teammate exchanges the two endpoints, not their identities. */
function exchangePlacementIssue(m, p, source, others) {
    const target = others.find(o => (0, deterministicMath_1.simulationHypot)(o.x - p.x, o.z - p.z) < .78);
    if (!target)
        return placementIssue(m, p, others);
    const rest = others.filter(o => o !== target);
    return placementIssue(m, target, rest) ?? (source ? placementIssue(m, source, [...rest, target]) : undefined);
}
