"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceCombat = traceCombat;
exports.resetCombatInputs = resetCombatInputs;
exports.sealCombatInputs = sealCombatInputs;
let depth = 0;
const clone = (v) => JSON.parse(JSON.stringify(v));
function traceCombat(b, op, args, work) {
    if (depth || !b || !b.combatInputs)
        return work();
    if (b.combatInputs.length >= 8192)
        throw Error('战斗操作尚未同步，请保存进度后继续');
    const input = { op, args: clone(args), settings: clone({ auto: b.autoSkills, manual: b.manualSkillTurtles, held: b.expedition?.heldRoles }) };
    depth++;
    try {
        const result = work();
        b.combatInputs.push(input);
        return result;
    }
    finally {
        depth--;
    }
}
/** Reset live state only; the journal keeps the copied evidence until acknowledged. */
function resetCombatInputs(value) {
    if (!value || typeof value !== 'object')
        return;
    const v = value;
    if (v.version === 1 && Array.isArray(v.spawns) && Array.isArray(v.units)) {
        v.combatInputs = [];
        return;
    }
    if (v.battle)
        resetCombatInputs(v.battle);
    if (v.run)
        resetCombatInputs(v.run);
    if (v.community) {
        resetCombatInputs(v.community.raid);
        resetCombatInputs(v.community.arena);
    }
}
function sealCombatInputs(value) {
    if (!value || typeof value !== 'object')
        return;
    const v = value;
    if (v.version === 1 && Array.isArray(v.spawns) && Array.isArray(v.units)) {
        traceCombat(v, 'settings', [], () => { });
        return;
    }
    if (v.battle)
        sealCombatInputs(v.battle);
}
