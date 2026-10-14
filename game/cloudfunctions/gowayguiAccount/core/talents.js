"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.panelTalent = exports.ROLE_FOCUS = exports.TALENT_CAPS = exports.TALENT_KEYS = exports.TALENT_NAMES = void 0;
exports.initialTalents = initialTalents;
exports.initialSkills = initialSkills;
exports.ordinaryPetSkills = ordinaryPetSkills;
exports.talentDistribution = talentDistribution;
exports.inheritTalents = inheritTalents;
const data_1 = require("./data");
const random_1 = require("./random");
exports.TALENT_NAMES = { attack: '攻击天赋', health: '生命天赋', defense: '防御天赋', growth: '成长天赋' };
exports.TALENT_KEYS = ['attack', 'health', 'defense', 'growth'];
exports.TALENT_CAPS = { attack: 100, health: 100, defense: 100, growth: 110 };
exports.ROLE_FOCUS = { stone: 'defense', spike: 'attack', crystal: 'attack', leaf: 'health', bubble: 'health' };
const panelTalent = (t, key) => t.innate[key] + t.training[key];
exports.panelTalent = panelTalent;
function initialTalents(s, role) {
    const result = {};
    for (const key of exports.TALENT_KEYS) {
        const roll = (0, random_1.random)(s);
        if (key === 'growth')
            result[key] = 70 + Math.floor(roll * 41);
        else if (key === exports.ROLE_FOCUS[role])
            result[key] = roll < .06 ? 100 : 75 + Math.floor((0, random_1.random)(s) * 25);
        else
            result[key] = 60 + Math.floor((0, random_1.random)(s) * 35);
    }
    return result;
}
/** Role preference affects birth only; all passive books/inheritance stay universal. */
function initialSkills(s, role, count) {
    const pool = data_1.SKILLS.filter(x => !x.specialization && (!x.role || x.role === role) && (s.rulesVersion === '0.6' || !['fervor', 'caprice', 'polymorph', 'giant'].includes(x.id)));
    const picked = [];
    while (picked.length < count && picked.length < pool.length) {
        const options = pool.filter(x => !picked.includes(x.id) && (!x.requires || picked.includes(x.requires))).map(x => ({ value: x.id, probability: x.specialization ? .15 : x.precious ? .15 : x.role === role ? 5 : !x.role ? 2 : 1 }));
        const sum = options.reduce((n, x) => n + x.probability, 0);
        picked.push((0, random_1.weighted)(s, options.map(x => ({ ...x, probability: x.probability / sum }))));
    }
    return picked;
}
/** Shop and reward companions never roll battle-only specializations. */
function ordinaryPetSkills(s, role, count) {
    const active = data_1.SKILLS.find(v => v.role === role && v.active && !v.specialization);
    const picked = [active.id], pool = data_1.SKILLS.filter(v => !v.specialization && !v.active && !v.requires && (!v.role || v.role === role));
    while (picked.length < count) {
        const choices = pool.filter(v => !picked.includes(v.id));
        if (!choices.length)
            break;
        const total = choices.reduce((n, v) => n + (v.precious ? .15 : 2), 0);
        let roll = (0, random_1.random)(s) * total;
        let choice = choices[choices.length - 1];
        for (const v of choices) {
            roll -= v.precious ? .15 : 2;
            if (roll < 0) {
                choice = v;
                break;
            }
        }
        picked.push(choice.id);
    }
    return picked;
}
const aptitudeDelta = [{ value: -8, probability: .03 }, { value: -5, probability: .10 }, { value: -2, probability: .20 }, { value: 0, probability: .34 }, { value: 2, probability: .20 }, { value: 5, probability: .10 }, { value: 8, probability: .03 }];
const growthDelta = [{ value: -3, probability: .05 }, { value: -2, probability: .15 }, { value: -1, probability: .20 }, { value: 0, probability: .20 }, { value: 1, probability: .20 }, { value: 2, probability: .15 }, { value: 3, probability: .05 }];
function talentDistribution(a, b, key) {
    const av = (0, exports.panelTalent)(a, key), bv = (0, exports.panelTalent)(b, key), weights = new Map();
    const cap = exports.TALENT_CAPS[key], fullParents = Number(av >= cap) + Number(bv >= cap);
    const fullChance = fullParents === 2 ? .26 : fullParents === 1 ? .18 : Math.max(av, bv) >= cap - 6 ? .015 : 0;
    const bases = [{ value: Math.max(av, bv), probability: .25 }, { value: Math.min(av, bv), probability: .15 }, { value: Math.round((av + bv) / 2), probability: .60 }];
    for (const base of bases)
        for (const delta of key === 'growth' ? growthDelta : aptitudeDelta) {
            const value = Math.max(key === 'growth' ? 70 : 60, Math.min(cap - 1, base.value + delta.value));
            weights.set(value, (weights.get(value) ?? 0) + base.probability * delta.probability * (1 - fullChance));
        }
    if (fullChance > 0)
        weights.set(cap, fullChance);
    return Array.from(weights, ([value, probability]) => ({ value, probability })).sort((a, b) => a.value - b.value);
}
function inheritTalents(s, a, b) {
    return Object.fromEntries(exports.TALENT_KEYS.map(key => [key, (0, random_1.weighted)(s, talentDistribution(a, b, key))]));
}
