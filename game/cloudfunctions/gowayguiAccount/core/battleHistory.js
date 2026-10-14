"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactBattleHistory = compactBattleHistory;
/** Keep two seconds of exit animation, and every actor still referenced by a live effect/event. */
function compactBattleHistory(s) {
    if (!s.expedition)
        return; // Arena/world-challenge snapshots have a different lifecycle.
    const actors = new Map();
    const keep = new Set(), queue = [];
    const pin = (id) => { if (id && !keep.has(id)) {
        keep.add(id);
        queue.push(id);
    } };
    for (const u of s.units.concat(s.benchUnits ?? [])) {
        // Reflection has a half-second cooldown; expired entries need no historical enemy.
        for (const [id, tick] of Object.entries(u.reflectTicks))
            if (tick < s.tick - 10)
                delete u.reflectTicks[id];
        actors.set(u.id, u);
        pin(u.id);
    }
    for (const actor of [...s.enemies, ...(s.summons ?? [])]) {
        actors.set(actor.id, actor);
        if (actor.alive) {
            delete actor.inactiveSinceTick;
            pin(actor.id);
        }
        else {
            actor.inactiveSinceTick ?? (actor.inactiveSinceTick = s.tick);
            if (s.tick - actor.inactiveSinceTick < 40)
                pin(actor.id);
        }
    }
    for (const event of s.events) {
        pin(event.sourceId);
        pin(event.targetId);
    }
    for (const command of s.commands) {
        pin(command.unitId);
        pin(command.targetId);
    }
    for (const [id, target] of Object.entries(s.focusTargets ?? {})) {
        pin(id);
        pin(target);
    }
    for (const storm of s.storms ?? []) {
        pin(storm.ownerId);
        storm.echoTargets?.forEach(pin);
    }
    // Traverse references only from retained actors, so self-buffs on old corpses cannot pin them forever.
    for (let i = 0; i < queue.length; i++) {
        const actor = actors.get(queue[i]);
        if (!actor)
            continue;
        if ('statuses' in actor)
            for (const status of actor.statuses)
                pin(status.sourceId);
        if ('skills' in actor) {
            for (const shield of actor.shields)
                pin(shield.sourceId);
            pin(actor.pendingAttack?.targetId);
            actor.flyingAttacks?.forEach(shot => pin(shot.targetId));
            Object.keys(actor.reflectTicks).forEach(pin);
            pin(actor.encouragedBy);
            pin(actor.auraTargetId);
        }
        else if ('kind' in actor && 'distance' in actor) {
            pin(actor.mechanismOwner);
            pin(actor.blockedBy);
            pin(actor.blockOwnerId);
            pin(actor.strike?.targetId);
        }
        else if ('ownerId' in actor)
            pin(actor.ownerId);
    }
    const removed = s.enemies.filter(e => !keep.has(e.id));
    if (removed.length) {
        const h = s.history ?? (s.history = { version: 1, enemies: 0, bosses: 0, bossIds: [], defeats: [] });
        for (const e of removed) {
            h.enemies++;
            if (e.kind === 'boss')
                h.bosses++;
            if (e.bossId && e.hp <= 0) {
                if (!h.bossIds.includes(e.bossId))
                    h.bossIds.push(e.bossId);
                // Endless uses only the discovery set; finite modes still need deferred boss loot receipts.
                if (s.expedition.kind !== 'endless')
                    h.defeats.push({ id: e.id, bossId: e.bossId });
            }
        }
        s.enemies = s.enemies.filter(e => keep.has(e.id));
    }
    if (s.summons)
        s.summons = s.summons.filter(p => keep.has(p.id));
    if (s.retiredUnits)
        s.retiredUnits = s.retiredUnits.filter(u => keep.has(u.id));
}
