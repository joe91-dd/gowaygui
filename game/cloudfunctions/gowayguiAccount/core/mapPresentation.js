"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTheme = exports.MAP_THEMES = void 0;
exports.routeClearance = routeClearance;
exports.mapBounds = mapBounds;
exports.expandedStations = expandedStations;
const deterministicMath_1 = require("./deterministicMath");
exports.MAP_THEMES = [
    { name: '晴湾海岸', ground: 0, path: 13, props: [0, 1, 3, 12] },
    { name: '珊瑚浅滩', ground: 4, path: 13, props: [2, 3, 13, 15] },
    { name: '潮汐湿地', ground: 1, path: 12, props: [1, 13, 2, 0] },
    { name: '古树海岛', ground: 1, path: 13, props: [0, 1, 10, 3] },
    { name: '白帆礁群', ground: 2, path: 12, props: [3, 12, 7, 0] },
    { name: '月湾遗迹', ground: 9, path: 14, props: [5, 11, 3, 7] },
    { name: '风暴海峡', ground: 5, path: 14, props: [3, 8, 12, 7] },
    { name: '晶石深湾', ground: 4, path: 14, props: [4, 8, 3, 1] },
    { name: '沉船群岛', ground: 8, path: 13, props: [12, 10, 3, 6] },
    { name: '海心王座', ground: 6, path: 12, props: [7, 5, 8, 14] },
    { name: '无尽海湾', ground: 9, path: 12, props: [11, 5, 0, 13] },
    { name: '碎礁洞穴', ground: 5, path: 14, props: [4, 9, 3, 8] },
    { name: '深潮遗迹', ground: 1, path: 14, props: [5, 7, 13, 2] },
    { name: '巨钳王庭', ground: 7, path: 12, props: [6, 9, 3, 7] },
    { name: '竞技海岛', ground: 0, path: 12, props: [7, 14, 3, 0] },
];
const mapTheme = (m) => exports.MAP_THEMES[m.id === 56 ? 0 : m.id === 55 ? 13 : m.id < 50 ? Math.floor(m.id / 5) : m.id - 40];
exports.mapTheme = mapTheme;
function routeClearance(m, p) { return Math.min(...(m.routes ?? [m.route]).flatMap(r => r.slice(1).map((b, i) => { const a = r[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return (0, deterministicMath_1.simulationHypot)(p.x - a.x - t * dx, p.z - a.z - t * dz); }))); }
function mapBounds(m) { if (m.sceneArt)
    return { rx: 9, rz: 5.065 }; const pts = (m.routes ?? [m.route]).flat().concat(m.slots); return { rx: Math.max(6, ...pts.map(p => Math.abs(p.x))) + 1.35, rz: Math.max(2.8, ...pts.map(p => Math.abs(p.z))) + 1.25 }; }
/** Append only: existing five deployed slots and saved positions retain their meaning. */
function expandedStations(maps) {
    return maps.map(m => {
        if (m.id === 54)
            return m;
        const slots = m.slots.map(p => ({ ...p })), bounds = mapBounds(m), candidates = [];
        if (m.id === 0) {
            for (const [x, y] of [[835, 160], [1350, 240], [305, 480], [740, 680]])
                candidates.push({ x: x / 1672 * 18 - 9, z: y / 941 * 10.13 - 5.065 });
        }
        else
            for (let z = -bounds.rz * .72; z < bounds.rz * .76; z += .65)
                for (let x = -bounds.rx * .8; x < bounds.rx * .83; x += .65) {
                    const p = { x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000 }, d = routeClearance(m, p);
                    if (d >= 1.1 && d <= 2.2)
                        candidates.push(p);
                }
        while (slots.length < (m.id === 0 ? 13 : m.id >= 51 ? 16 : 14) && candidates.length) {
            candidates.sort((a, b) => Math.min(...slots.map(s => (0, deterministicMath_1.simulationHypot)(s.x - b.x, s.z - b.z))) - Math.min(...slots.map(s => (0, deterministicMath_1.simulationHypot)(s.x - a.x, s.z - a.z))));
            const p = candidates.shift();
            if (slots.every(s => (0, deterministicMath_1.simulationHypot)(s.x - p.x, s.z - p.z) >= 1.18) && routeClearance(m, p) >= 1.08)
                slots.push(p);
        }
        return { ...m, stationVersion: 4, slots };
    });
}
