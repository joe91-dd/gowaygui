"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_PATH_PIXELS = exports.isModeStage = exports.modePixel = exports.modePoint = exports.MODE_DEPTH = exports.MODE_ART = void 0;
exports.modeRoadDistance = modeRoadDistance;
exports.modeGroundIssue = modeGroundIssue;
exports.applyModeStage = applyModeStage;
const deterministicMath_1 = require("./deterministicMath");
const sceneGeometryData_1 = require("./sceneGeometryData");
const sceneGeometry_1 = require("./sceneGeometry");
/** Approved 23 September mode paintings. One pixel registration is shared by
 * ground rendering, navigation, recommended stations and free placement. */
exports.MODE_ART = { width: 1672, height: 941, worldWidth: 18, slope: .6, floor: .045 };
exports.MODE_DEPTH = 18 * 941 / 1672 * Math.sqrt(1 + .6 * .6);
const modePoint = (x, y) => ({ x: (x / 1672 - .5) * 18, z: (y / 941 - .5) * exports.MODE_DEPTH + .027 });
exports.modePoint = modePoint;
const modePixel = (p) => ({ x: (p.x / 18 + .5) * 1672, y: ((p.z - .027) / exports.MODE_DEPTH + .5) * 941 });
exports.modePixel = modePixel;
const isModeStage = (m) => m.id >= 50 && m.id <= 56 && m.sceneArt === `map-mode-scene-${m.id}`;
exports.isModeStage = isModeStage;
exports.MODE_PATH_PIXELS = Object.fromEntries(sceneGeometryData_1.SCENE_GEOMETRY_DATA.slice(50).map(g => [g.id, g.routes.map(r => r.map(([x, y]) => [x * 1672 / 560, y * 941 / 310]))]));
function modeRoadDistance(id, x, y) { let distance = Infinity; for (const route of exports.MODE_PATH_PIXELS[id])
    for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        distance = Math.min(distance, (0, deterministicMath_1.simulationHypot)(x - a[0] - t * dx, y - a[1] - t * dy));
    } return distance; }
function modeGroundIssue(id, p) { return (0, sceneGeometry_1.sceneGroundIssue)(id, p); }
function applyModeStage(m) {
    const paths = exports.MODE_PATH_PIXELS[m.id];
    if (!paths)
        return m;
    const routes = paths.map(r => r.map(([x, y]) => (0, exports.modePoint)(x, y))), slots = (0, sceneGeometry_1.sceneSlots)(m.id);
    return { ...m, layoutVersion: 2, stationVersion: 6, sceneRevision: sceneGeometry_1.SCENE_REVISION, sceneArt: `map-mode-scene-${m.id}`, sceneMirror: false, route: routes[0], routes: routes.length > 1 ? routes : undefined, routeLabels: routes.length > 1 ? (m.id === 51 ? ['北礁入口', '南礁入口'] : ['外庭长路', '内庭近路']) : undefined, slots };
}
