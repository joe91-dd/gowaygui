"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tacticalMaps = tacticalMaps;
exports.chapterFronts = chapterFronts;
exports.clearRoadStations = clearRoadStations;
const roadStations_1 = require("./roadStations");
const multiFront_1 = require("./multiFront");
const pts = (p) => p.map(([x, z]) => ({ x, z }));
/** Designed topology; world scale, routes and stations share one authoritative definition. */
function tacticalMaps(maps) {
    return maps.map(old => {
        // The first five 初晴海湾 routes are authored as the approved tutorial set.
        // Keep their topology and lane labels intact; later campaign maps continue
        // using the established tactical families below.
        if (old.id < 5)
            return { ...old, layoutVersion: 2, legacySlots: old.slots, subtitle: old.subtitle, spawnDuration: old.id === 0 ? 19 : old.waves >= 10 ? 12 : 18, preparationSeconds: 6 };
        if (old.id >= 54)
            return old;
        if (old.id >= 50) {
            const routes = old.routes.map((r, i) => {
                const start = r[0], end = r[r.length - 1], side = i % 2 ? 1 : -1;
                return [start, { x: start.x * .85 + side * 1.4, z: start.z * .85 - side * 1.4 }, ...r.slice(1, -1).map(p => ({ x: p.x * 1.3, z: p.z * 1.3 })), end];
            });
            return { ...old, layoutVersion: 2, routes, route: routes[0], legacySlots: old.slots, slots: old.id === 50 ? pts([[-6, -1], [-1, -4], [6, 1], [1, 4], [0, 0], [-4, 3], [4, -3], [-3, -3], [3, 3]]) : old.slots };
        }
        const kind = old.id === 0 ? 0 : old.id % 3;
        let routes;
        if (kind === 0)
            routes = [pts([[-10, -3.8], [-3, -3.8], [6, -3.8], [8, -1.6], [5, .7], [-5, .7], [-7, 3.6], [1, 3.6], [10, 3.6]])];
        else if (kind === 1)
            routes = [pts([[-10, -4.4], [-5, -4.4], [-4, -1.7], [1, -1.7], [4, 1], [0, 3.5], [5, 4], [10, 2.5]]), pts([[-10, 4.5], [-6, 4.5], [-5, 1.7], [-1, 1.7], [1, -1.7], [4, 1], [0, 3.5], [5, 4], [10, 2.5]])];
        else
            routes = [pts([[-10, -4.5], [-3, -4.5], [5, -4.5], [7, -1.6], [0, -.3], [-5, 2], [-1, 4], [5, 4], [10, 2]]), pts([[-10, 4.5], [-6, 3], [-4, 0], [0, -.3], [-5, 2], [-1, 4], [5, 4], [10, 2]])];
        // Keep the requested route extension bounded against each original chapter.
        const desired = (0, multiFront_1.pathLength)(old.route) * (kind === 0 ? 1.95 : 2.05), scale = desired / (0, multiFront_1.pathLength)(routes[0]);
        // Gentle chapter variation preserves the three legible structures and avoids duplicate maps.
        const sx = Math.min(1.08, scale) * (1 + (old.id % 5) * .006), sz = scale;
        routes = routes.map(r => r.map(p => ({ x: Math.round(p.x * sx * 1000) / 1000, z: Math.round(p.z * sz * 1000) / 1000 })));
        // First five preserve initial role order: tank, archer, mage, healer, control.
        const templates = kind === 0 ? pts([[-4, -2.7], [1, -1.5], [5, -.5], [-1, 1.7], [5, 2.4], [-7, 2.4], [8, 2.8], [-8, -2.3], [3, -2.6]]) : kind === 1 ? pts([[1, -.6], [-5, -2.7], [3, 2], [-1, .3], [7, 3], [-7, 2.2], [-2, -3], [2, 4.9], [8, 1.5]]) : pts([[-4, 1], [3, -2.4], [-1, 2.8], [-2, -1.8], [7, 2.8], [-7, -3], [-7, 3.8], [3, 5], [7, -2.7]]);
        const slots = templates.map(p => ({ x: Math.round(p.x * sx * 1000) / 1000, z: Math.round(p.z * sz * 1000) / 1000 }));
        const label = ['回湾折返', '双路汇合', '长短双路'][kind];
        return { ...old, layoutVersion: 2, legacySlots: old.slots, route: routes[0], ...(routes.length > 1 ? { routes, routeLabels: kind === 1 ? ['北岸', '南岸'] : ['长湾', '近岸'] } : { routes: undefined, routeLabels: undefined }), slots,
            subtitle: label + ' · 接敌、集火、补漏', spawnDuration: old.id === 0 ? 19 : old.waves >= 10 ? 12 : 18, preparationSeconds: 6 };
    });
}
function chapterFronts(spawns, level, wave) {
    if (!level.routes)
        return spawns;
    // Every drawn route carries enemies, including the first wave. Alternate small
    // groups to make both approaches readable without increasing the enemy budget.
    const lanes = level.routes.map((_, i) => i);
    return spawns.map((s, i) => ({ ...s, routeId: lanes[Math.floor(i / 2) % lanes.length] }));
}
/** Precomputed clearances avoid expensive work during startup. */
function clearRoadStations(maps) { return maps.map(map => map.id >= 54 ? map : { ...map, stationVersion: 2, slots: roadStations_1.RELEASE_STATIONS[map.id].map(p => ({ ...p })) }); }
