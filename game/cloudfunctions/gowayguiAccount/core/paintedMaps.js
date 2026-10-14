"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROAD_PLACEMENT_CLEARANCE = exports.ROAD_HALF_WIDTH = exports.THEME_LAND = exports.PAINTED_SIZE = void 0;
exports.legacyPaintedLayout = legacyPaintedLayout;
exports.paintLegacyMap = paintLegacyMap;
exports.paintedLayout = paintedLayout;
exports.paintMap = paintMap;
const deterministicMath_1 = require("./deterministicMath");
const coastStageGeometry_1 = require("./coastStageGeometry");
const modeStageGeometry_1 = require("./modeStageGeometry");
const battleThemes_1 = require("./battleThemes");
exports.PAINTED_SIZE = { width: 18, height: 10.13 };
const pt = (x, y) => ({ x: x / 1672 * 18 - 9, z: y / 941 * 10.13 - 5.065 });
const coords = (v) => v.map(([x, y]) => pt(x, y));
const gardenEntry = [[40, 255], [165, 265], [300, 277], [426, 289], [515, 319], [555, 344]], gardenExit = [[1450, 419], [1510, 417], [1570, 414]];
const garden = [gardenEntry.concat([[621, 316], [687, 273], [753, 212], [823, 177], [898, 171], [987, 183], [1096, 214], [1215, 244], [1286, 280], [1335, 337], [1388, 388]], gardenExit), gardenEntry.concat([[559, 426], [588, 496], [652, 550], [749, 580], [857, 599], [993, 594], [1113, 570], [1214, 531], [1327, 470], [1400, 440]], gardenExit)];
const tidalExit = [[1438, 389], [1520, 381], [1580, 374]], tidal = [[[40, 196], [183, 202], [317, 191], [441, 180], [508, 189], [548, 230], [573, 301], [626, 359], [713, 386], [799, 380], [870, 354], [945, 297], [1013, 260], [1068, 258], [1141, 278], [1233, 318], [1336, 360], ...tidalExit], [[40, 546], [162, 542], [256, 556], [375, 590], [477, 607], [593, 586], [716, 555], [818, 550], [950, 571], [1060, 582], [1172, 548], [1273, 499], [1360, 439], ...tidalExit]];
const switchback = [[[40, 171], [300, 161], [560, 154], [813, 135], [1042, 113], [1234, 110], [1352, 121], [1420, 151], [1456, 210], [1449, 276], [1410, 318], [1330, 343], [1191, 354], [1025, 358], [790, 371], [584, 372], [425, 389], [333, 412], [283, 451], [270, 489], [297, 530], [376, 562], [534, 580], [761, 588], [1000, 590], [1236, 588], [1411, 601], [1570, 651]]];
const a = [225, 212], b = [825, 208], c = [1430, 220], d = [1430, 570], e = [829, 607], f = [242, 588];
const courtyard = [[[35, 149], [120, 155], a, [269, 182], [540, 176], [750, 180], b, [848, 288], [842, 465], e, [750, 620], [515, 623], [300, 618], f, [224, 494], [226, 319], a, [269, 182], [540, 176], [750, 180], b, [925, 184], [1190, 183], [1355, 190], c, [1435, 360], [1436, 498], d, [1480, 601], [1580, 608]], [[35, 149], [120, 155], a, [226, 319], [224, 494], f, [300, 618], [515, 623], [750, 620], e, [842, 465], [848, 288], b, [925, 184], [1190, 183], [1355, 190], c, [1435, 360], [1436, 498], d, [1480, 601], [1580, 608]]];
function legacyPaintedLayout(id) {
    const region = id < 50 ? Math.floor(id / 5) : id - 40;
    const kind = id === 56 || id === 54 ? 'world' : id === 55 || id === 53 ? 'court' : id === 50 ? 'moon' : region === 0 ? 'coral' : id === 51 ? 'tidal' : id === 52 ? 'court' : ['garden', 'tidal', 'switch', 'garden', 'tidal', 'switch', 'court', 'garden', 'tidal', 'court'][Math.min(9, region)];
    const mirror = id < 50 && [3, 5, 8].includes(region);
    const circuit = [a, [269, 182], [540, 176], [750, 180], b, [848, 288], [842, 465], e, [980, 611], [1200, 610], [1375, 596], d, [1436, 498], [1435, 360], c, [1355, 190], [1190, 183], [925, 184], b, [848, 288], [842, 465], e, [750, 620], [515, 623], [300, 618], f, [224, 494], [226, 319], a];
    const source = id === 55 ? [circuit] : kind === 'coral' ? garden : kind === 'garden' ? garden : kind === 'tidal' ? tidal : kind === 'court' ? courtyard : kind === 'world' ? [[[186, 393], [1486, 393]]] : switchback;
    const map = (p) => mirror ? { x: -p.x, z: p.z } : p;
    const routes = source.map(r => coords(r).map(map));
    if (kind === 'world') {
        routes[0][0].x = id === 56 ? -5.8 : -7;
        routes[0][1].x = id === 56 ? 5.8 : 7;
    }
    const spots = kind === 'garden' ? [[695, 460], [879, 348], [1182, 398], [1022, 484], [356, 412], [1033, 295], [439, 504], [918, 671], [1311, 596], [1399, 291], [220, 470], [310, 620], [540, 700], [700, 690], [1080, 690], [1460, 535], [1500, 270], [620, 145], [1100, 160], [420, 170]] : kind === 'tidal' ? [[719, 271], [419, 355], [1044, 415], [994, 498], [1264, 590], [282, 365], [459, 469], [1175, 180], [969, 690], [1420, 509], [210, 470], [340, 690], [610, 700], [820, 700], [1130, 690], [1490, 520], [1500, 250], [620, 135], [1040, 150], [390, 160]] : kind === 'court' ? [[380, 350], [610, 462], [1025, 353], [1261, 463], [622, 311], [360, 512], [1049, 525], [1254, 310], [486, 405], [1157, 431], [210, 470], [330, 650], [610, 700], [850, 690], [1160, 680], [1480, 520], [1500, 250], [620, 135], [1040, 150], [390, 155]] : kind === 'world' ? [[400, 255], [600, 539], [825, 260], [1030, 545], [1240, 257], [291, 531], [1330, 535], [944, 252], [536, 266], [1160, 550], [190, 520], [370, 690], [680, 700], [980, 700], [1310, 690], [1500, 520], [1510, 250], [680, 130], [1080, 145], [390, 145]] : kind === 'moon' ? [[350, 271], [810, 268], [866, 481], [665, 484], [1300, 474], [1055, 250], [717, 679], [1395, 506], [375, 667], [1200, 684], [190, 500], [330, 700], [590, 700], [940, 700], [1230, 690], [1510, 520], [1500, 250], [650, 140], [1040, 145], [390, 150]] : [[350, 271], [810, 268], [866, 481], [665, 484], [1300, 474], [1055, 250], [717, 679], [1395, 506], [375, 667], [1200, 684], [190, 500], [330, 700], [590, 700], [940, 700], [1230, 690], [1510, 520], [1500, 250], [650, 140], [1040, 145], [390, 150]];
    const land = coords([[90, 190], [90, 120], [1520, 120], [1570, 228], [1570, 605], [1470, 677], [1250, 700], [1040, 724], [770, 708], [530, 700], [282, 650], [90, 549]]).map(map);
    const rocks = (kind === 'world' ? [] : kind === 'tidal' ? [[728, 119, 90], [1450, 188, 80], [813, 476, 68], [1250, 329, 54]] : kind === 'garden' ? [[335, 130, 80], [666, 94, 72], [1491, 127, 96]] : kind === 'court' ? [[754, 63, 75], [1431, 70, 65]] : [[235, 85, 90], [1430, 110, 85], [484, 486, 78], [1257, 229, 90], [606, 251, 77], [1070, 473, 65]]).map(([x, y, r]) => ({ ...map(pt(x, y)), radius: r / 1672 * 18 }));
    return { art: kind === 'coral' ? 'map-theme-coral' : kind === 'moon' ? 'map-theme-moon' : 'map-' + (kind === 'garden' ? 'garden-fork' : kind === 'tidal' ? 'tidal-fork' : kind === 'court' ? 'raid-courtyard' : kind === 'world' ? 'world-arena' : 'switchback'), mirror, routes, slots: coords(spots).map(map), land, rocks };
}
function paintLegacyMap(m) {
    const p = legacyPaintedLayout(m.id);
    if (!p)
        return m;
    // Art-only layer: preserve the live route, lanes, station coordinates and rules.
    return { ...m, sceneArt: p.art, sceneMirror: false };
}
/** One continuous field, with only actual route corridors excluded from placement. */
exports.THEME_LAND = [{ x: -7.65, z: -3.55 }, { x: 7.65, z: -3.55 }, { x: 7.65, z: 3.35 }, { x: -7.65, z: 3.35 }];
exports.ROAD_HALF_WIDTH = .53;
exports.ROAD_PLACEMENT_CLEARANCE = exports.ROAD_HALF_WIDTH + .46 + .03;
function clearance(routes, p) {
    let result = Infinity;
    for (const route of routes)
        for (let i = 1; i < route.length; i++) {
            const a = route[i - 1], b = route[i], dx = b.x - a.x, dz = b.z - a.z;
            const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
            result = Math.min(result, (0, deterministicMath_1.simulationHypot)(p.x - a.x - dx * t, p.z - a.z - dz * t));
        }
    return result;
}
const layouts = new Map();
function paintedLayout(id) {
    const cached = layouts.get(id);
    if (cached)
        return cached;
    const prior = legacyPaintedLayout(id);
    const stage = id < 50 ? id % 5 : 0;
    const zs = prior.routes.flat().map(p => p.z), minZ = Math.min(...zs), spanZ = Math.max(...zs) - minZ;
    // Routes remain data, never baked into the artwork. Variants keep shared endpoints.
    const routes = prior.routes.map(route => route.map((p, i) => ({ x: p.x * .92, z: (spanZ > .1 ? (p.z - minZ) / spanZ * 7.4 - 3.75 : 0) + (i > 0 && i < route.length - 1 ? (0, deterministicMath_1.simulationSin)(i / (route.length - 1) * Math.PI * 2) * (stage - 2) * .12 : 0) })));
    const goal = routes[0][routes[0].length - 1];
    const candidates = [];
    for (let z = -3.25; z <= 3.1; z += .32)
        for (let x = -7.25; x <= 7.25; x += .32) {
            const p = { x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000 }, d = clearance(routes, p);
            if (d >= exports.ROAD_PLACEMENT_CLEARANCE + .06 && d < 2.6 && (id === 56 || (0, deterministicMath_1.simulationHypot)(x - goal.x, z - goal.z) > 1.35))
                candidates.push(p);
        }
    const slots = [];
    // Spaced recommended anchors, not a limit on the freely draggable field.
    const preferred = [{ x: -2, z: 1 }, { x: 0, z: -1.5 }, { x: 2.5, z: 1 }, { x: 4.5, z: -1.5 }, { x: -4.5, z: 1 }, ...prior.slots];
    for (const target of preferred) {
        const next = candidates.filter(p => slots.every(s => (0, deterministicMath_1.simulationHypot)(s.x - p.x, s.z - p.z) >= 1.35)).sort((a, b) => (0, deterministicMath_1.simulationHypot)(a.x - target.x, a.z - target.z) - (0, deterministicMath_1.simulationHypot)(b.x - target.x, b.z - target.z))[0];
        if (next)
            slots.push(next);
        if (slots.length === 20)
            break;
    }
    const result = { art: (0, battleThemes_1.battleTheme)(id).atlas, mirror: false, routes, slots, land: exports.THEME_LAND, rocks: [] };
    layouts.set(id, result);
    return result;
}
function paintMap(m) {
    if (m.id < 50)
        return (0, coastStageGeometry_1.applyCoastStage)(m);
    if (m.id <= 56)
        return (0, modeStageGeometry_1.applyModeStage)(m);
    const p = paintedLayout(m.id);
    return { ...m, sceneArt: p.art, sceneMirror: false };
}
