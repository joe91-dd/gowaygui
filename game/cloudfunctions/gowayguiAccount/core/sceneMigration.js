"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateSceneBattle = migrateSceneBattle;
exports.migrateSceneRaid = migrateSceneRaid;
exports.migrateSceneArena = migrateSceneArena;
exports.migrateSceneSave = migrateSceneSave;
const deterministicMath_1 = require("./deterministicMath");
const sceneGeometry_1 = require("./sceneGeometry");
const sceneGeometryPrevious_1 = require("./sceneGeometryPrevious");
const length = (r) => r.slice(1).reduce((n, p, i) => n + (0, deterministicMath_1.simulationHypot)(p.x - r[i].x, p.z - r[i].z), 0);
const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((p, i) => p && (0, deterministicMath_1.simulationHypot)(p.x - b[i].x, p.z - b[i].z) < 1e-7);
function along(r, d) { for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i], n = (0, deterministicMath_1.simulationHypot)(b.x - a.x, b.z - a.z);
    if (n < 1e-9)
        continue;
    if (d <= n)
        return { x: a.x + (b.x - a.x) * d / n, z: a.z + (b.z - a.z) * d / n };
    d -= n;
} return { ...r[r.length - 1] }; }
/** Only known released geometry is eligible. Unknown routes still fail normal save validation. */
function migrateSceneBattle(b) {
    if (!b || b.stationVersion !== 6 || b.sceneRevision === sceneGeometry_1.SCENE_REVISION)
        return false;
    const old = sceneGeometryPrevious_1.PREVIOUS_SCENE_GEOMETRY[b.levelId];
    if (!old || !same(b.route, old.route) || !!b.routes !== !!old.routes || b.routes && (!old.routes || b.routes.length !== old.routes.length || b.routes.some((r, i) => !same(r, old.routes[i]))))
        return false;
    const routes = (0, sceneGeometry_1.sceneRoutes)(b.levelId), lengths = routes.map(length), slots = (0, sceneGeometry_1.sceneSlots)(b.levelId), occupied = [];
    for (const u of b.units) {
        if (!Number.isInteger(u.slot) || !slots[u.slot])
            throw Error('旧站位资料无效');
        const p = (0, sceneGeometry_1.safeScenePoint)(b.levelId, u.placement ?? slots[u.slot], occupied);
        occupied.push(p);
        if (u.placement || (0, deterministicMath_1.simulationHypot)(p.x - slots[u.slot].x, p.z - slots[u.slot].z) > 1e-7)
            u.placement = { ...p };
        Object.assign(u, p);
        delete u.transfer;
    }
    for (const u of b.benchUnits ?? []) {
        const p = u.placement ? (0, sceneGeometry_1.safeScenePoint)(b.levelId, u.placement) : slots[u.slot];
        if (!p)
            throw Error('旧备战站位资料无效');
        Object.assign(u, p);
        if (u.placement)
            u.placement = { ...p };
        delete u.transfer;
    }
    for (const e of b.enemies) {
        const oldId = e.routeId ?? 0, id = oldId % routes.length, oldLength = b.routeLengths?.[oldId] ?? b.routeLength;
        e.distance = Math.max(0, Math.min(1, e.distance / oldLength)) * lengths[id];
        Object.assign(e, along(routes[id], e.distance));
        if (routes.length > 1)
            e.routeId = id;
        else
            delete e.routeId;
    }
    b.spawns.forEach((s, i) => { if (routes.length > 1)
        s.routeId = i % routes.length;
    else
        delete s.routeId; });
    b.route = routes[0];
    b.routeLength = lengths[0];
    if (routes.length > 1) {
        b.routes = routes;
        b.routeLengths = lengths;
    }
    else {
        delete b.routes;
        delete b.routeLengths;
    }
    b.sceneRevision = sceneGeometry_1.SCENE_REVISION;
    return true;
}
function migrateSceneRaid(r) {
    if (!r || r.mapVersion !== 6)
        return;
    if (r.battle) {
        if (migrateSceneBattle(r.battle))
            for (const m of r.members) {
                const u = r.battle.units.find(u => u.id === m.activeId);
                if (u) {
                    m.station = u.slot;
                    m.placement = u.placement ? { ...u.placement } : undefined;
                    if (!m.placement)
                        delete m.placement;
                }
            }
    }
    else if (r.sceneRevision !== sceneGeometry_1.SCENE_REVISION) {
        const id = r.tier === 3 ? 55 : 51 + r.tier, slots = (0, sceneGeometry_1.sceneSlots)(id), occupied = [];
        r.members.forEach((m, i) => { const p = (0, sceneGeometry_1.safeScenePoint)(id, m.placement ?? slots[m.station ?? i], occupied); occupied.push(p); m.placement = p; });
    }
    r.sceneRevision = sceneGeometry_1.SCENE_REVISION;
}
function migrateSceneArena(a) {
    if (!a)
        return;
    const old = a.battle.routeLength;
    if (!migrateSceneBattle(a.battle))
        return;
    a.defenders = a.battle.units;
    for (const m of a.movers) {
        m.distance = m.distance / old * a.battle.routeLength;
        const u = a.attackers.find(u => u.id === m.id);
        if (u)
            Object.assign(u, along(a.battle.route, m.distance));
    }
}
function migrateSceneSave(s) {
    const r = s.run;
    if (r?.mapVersion === 6 && r.sceneRevision !== sceneGeometry_1.SCENE_REVISION) {
        if (r.battle) {
            if (migrateSceneBattle(r.battle))
                for (const u of r.battle.units) {
                    const saved = r.units[u.id];
                    if (saved) {
                        saved.placement = u.placement ? { ...u.placement } : undefined;
                        if (!saved.placement)
                            delete saved.placement;
                    }
                }
        }
        else {
            const slots = (0, sceneGeometry_1.sceneSlots)(r.levelId), occupied = [];
            for (const u of Object.values(r.units)) {
                if (u.consumedBy || u.removed || u.slot === null) {
                    if (u.placement)
                        u.placement = (0, sceneGeometry_1.safeScenePoint)(r.levelId, u.placement);
                    continue;
                }
                const p = (0, sceneGeometry_1.safeScenePoint)(r.levelId, u.placement ?? slots[u.slot], occupied);
                occupied.push(p);
                if (u.placement || (0, deterministicMath_1.simulationHypot)(p.x - slots[u.slot].x, p.z - slots[u.slot].z) > 1e-7)
                    u.placement = p;
            }
        }
        r.sceneRevision = sceneGeometry_1.SCENE_REVISION;
    }
    if (s.community?.raid)
        migrateSceneRaid(s.community.raid);
    if (s.community?.arena)
        migrateSceneArena(s.community.arena);
}
