"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patrolGoldPerMinute = exports.patrolCapMinutes = exports.PATROL = void 0;
exports.enablePatrol = enablePatrol;
exports.accruePatrol = accruePatrol;
exports.claimPatrol = claimPatrol;
exports.validatePatrol = validatePatrol;
const data_1 = require("./data");
const bookPolicy_1 = require("./bookPolicy");
const random_1 = require("./random");
const talents_1 = require("./talents");
const economy_1 = require("./economy");
const monthCard_1 = require("./monthCard");
function ensurePatrol(condition, message, code = 'RULE') {
    if (!condition)
        throw Object.assign(new Error(message), { code });
}
exports.PATROL = { minuteMs: 60000, capMinutes: 720, encounterMinutes: 30, materialChance: .30, bookChance: .03, turtleChance: .01 };
const patrolCapMinutes = (save, at = save.clockHighWater) => (0, monthCard_1.hasMonthCard)(save, at) ? monthCard_1.MONTH_CARD.capMinutes : exports.PATROL.capMinutes;
exports.patrolCapMinutes = patrolCapMinutes;
const patrolGoldPerMinute = (save, at = save.clockHighWater) => Math.max(1, Math.round((0, economy_1.goldAmount)(save, 1) / 5)) * ((0, monthCard_1.hasMonthCard)(save, at) ? monthCard_1.MONTH_CARD.patrolMultiplier : 1);
exports.patrolGoldPerMinute = patrolGoldPerMinute;
function enablePatrol(save, now) {
    save.patrol ?? (save.patrol = { version: 1, lastAt: now, bankMs: 0, creditedMinutes: 0, encounterMinutes: 0, rng: (save.rng ^ Math.floor(now) ^ 0x71a2c483) >>> 0, gold: 0, materials: {}, books: {}, pets: [] });
}
function encounter(save, patrol, at, multiplier = 1) {
    const roll = (0, random_1.random)(patrol);
    if (roll < exports.PATROL.materialChance * multiplier) {
        const material = (0, random_1.weighted)(patrol, [{ value: 'attack', probability: .3 }, { value: 'health', probability: .3 }, { value: 'defense', probability: .25 }, { value: 'growth', probability: .15 }]);
        patrol.materials[material] = (patrol.materials[material] ?? 0) + 1;
    }
    else if (roll < (exports.PATROL.materialChance + exports.PATROL.bookChance) * multiplier) {
        const skill = (0, random_1.choose)(patrol, data_1.SKILLS.filter(item => (0, bookPolicy_1.bookGrade)(item.id) === 'common')).id;
        patrol.books[skill] = (patrol.books[skill] ?? 0) + 1;
    }
    else if (roll < (exports.PATROL.materialChance + exports.PATROL.bookChance + exports.PATROL.turtleChance) * multiplier) {
        const role = (0, random_1.choose)(patrol, data_1.ROLE_IDS), count = (0, random_1.weighted)(patrol, [{ value: 1, probability: .5 }, { value: 2, probability: .3 }, { value: 3, probability: .15 }, { value: 4, probability: .04 }, { value: 5, probability: .01 }]);
        const generator = { rng: patrol.rng, rulesVersion: save.rulesVersion };
        const pet = { id: `patrol-${++save.idCounter}`, role, name: '', skills: (0, talents_1.initialSkills)(generator, role, count), innate: (0, talents_1.initialTalents)(generator, role), training: { attack: 0, health: 0, defense: 0, growth: 0 }, generation: 0, bornAt: at, parentIds: [], locked: false };
        patrol.rng = generator.rng;
        patrol.pets.push(pet);
    }
}
function accruePatrol(save, now, instantBenefitAt) {
    const patrol = save.patrol;
    if (!patrol)
        return;
    const at = Math.max(patrol.lastAt, now);
    // Split offline time at activation/expiry boundaries: no retroactive double
    // income, no lost 24-hour bank when a monthly card expires.
    const cuts = instantBenefitAt === undefined ? (save.monthCard?.periods ?? []).flatMap(p => [p.startsAt, p.endsAt]).filter(t => t > patrol.lastAt && t < at) : [];
    for (const end of Array.from(new Set([...cuts, at])).sort((a, b) => a - b)) {
        const from = patrol.lastAt, benefitAt = instantBenefitAt ?? from, previous = patrol.bankMs, cap = (0, exports.patrolCapMinutes)(save, benefitAt) * exports.PATROL.minuteMs;
        patrol.bankMs = Math.max(previous, Math.min(cap, previous + end - from));
        const minutes = Math.floor(patrol.bankMs / exports.PATROL.minuteMs), rate = (0, exports.patrolGoldPerMinute)(save, benefitAt), multiplier = (0, monthCard_1.hasMonthCard)(save, benefitAt) ? monthCard_1.MONTH_CARD.patrolMultiplier : 1;
        for (let minute = patrol.creditedMinutes + 1; minute <= minutes; minute++) {
            patrol.gold += rate;
            patrol.encounterMinutes++;
            if (patrol.encounterMinutes === exports.PATROL.encounterMinutes) {
                patrol.encounterMinutes = 0;
                encounter(save, patrol, from + minute * exports.PATROL.minuteMs - previous, multiplier);
            }
        }
        patrol.creditedMinutes = minutes;
        patrol.lastAt = end;
    }
}
function claimPatrol(save) {
    const patrol = save.patrol;
    ensurePatrol(patrol && patrol.gold > 0, '还未满一分钟，请稍后领取');
    ensurePatrol(Object.keys(save.collection).length + patrol.pets.length <= save.capacity, `龟龟背包空间不足，请留出${patrol.pets.length}个空位；巡海收获会完整保留`);
    const rewards = { gold: patrol.gold, materials: patrol.materials, books: patrol.books, pets: patrol.pets };
    ensurePatrol(Number.isSafeInteger(save.gold + rewards.gold), '金币已达到安全上限');
    save.gold += rewards.gold;
    for (const [key, amount] of Object.entries(rewards.materials))
        save.materials[key] += amount;
    save.skillBooks ?? (save.skillBooks = {});
    for (const [key, amount] of Object.entries(rewards.books))
        save.skillBooks[key] = (save.skillBooks[key] ?? 0) + amount;
    for (const pet of rewards.pets)
        save.collection[pet.id] = pet;
    patrol.gold = 0;
    patrol.materials = {};
    patrol.books = {};
    patrol.pets = [];
    patrol.bankMs %= exports.PATROL.minuteMs;
    patrol.creditedMinutes = 0;
    return rewards;
}
function validatePatrol(save, validatePet) {
    const patrol = save.patrol;
    if (patrol === undefined)
        return;
    const integer = (value, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
    const maxMinutes = save.monthCard ? monthCard_1.MONTH_CARD.capMinutes : exports.PATROL.capMinutes, maxEncounters = maxMinutes / exports.PATROL.encounterMinutes;
    ensurePatrol(patrol && patrol.version === 1 && integer(patrol.lastAt, save.clockHighWater) && integer(patrol.bankMs, maxMinutes * exports.PATROL.minuteMs) && integer(patrol.creditedMinutes, maxMinutes) && patrol.creditedMinutes === Math.floor(patrol.bankMs / exports.PATROL.minuteMs) && integer(patrol.encounterMinutes, 29) && integer(patrol.rng, 4294967295) && integer(patrol.gold), '巡海累计资料损坏', 'SAVE');
    ensurePatrol(patrol.materials && typeof patrol.materials === 'object' && !Array.isArray(patrol.materials) && patrol.books && typeof patrol.books === 'object' && !Array.isArray(patrol.books) && Array.isArray(patrol.pets), '巡海收获资料损坏', 'SAVE');
    let count = patrol.pets.length;
    for (const [key, amount] of Object.entries(patrol.materials)) {
        ensurePatrol(['attack', 'health', 'defense', 'growth'].includes(key) && integer(amount, maxEncounters) && amount > 0, '巡海培养肉资料损坏', 'SAVE');
        count += amount;
    }
    for (const [key, amount] of Object.entries(patrol.books)) {
        ensurePatrol(data_1.SKILLS.some(skill => skill.id === key && (0, bookPolicy_1.bookGrade)(skill.id) === 'common') && integer(amount, maxEncounters) && amount > 0, '巡海技能书资料损坏', 'SAVE');
        count += amount;
    }
    ensurePatrol(count <= Math.ceil(patrol.creditedMinutes / 30) && new Set(patrol.pets.map(pet => pet.id)).size === patrol.pets.length, '巡海奖励数量损坏', 'SAVE');
    for (const pet of patrol.pets) {
        validatePet(pet);
        ensurePatrol(pet.skills.length <= 5 && !save.collection[pet.id] && !save.history[pet.id] && pet.id.startsWith('patrol-'), '巡海伙伴资料损坏', 'SAVE');
    }
}
