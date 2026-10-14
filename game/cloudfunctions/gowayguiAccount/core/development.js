"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.talentTicks = exports.resetPointCost = exports.maxPetXp = exports.levelCost = exports.aptitudeMultiplier = exports.petRange = exports.PET_LEVEL_CAP = void 0;
exports.levelInfo = levelInfo;
exports.initDevelopment = initDevelopment;
exports.grantExperience = grantExperience;
exports.developmentBonus = developmentBonus;
exports.petPanel = petPanel;
exports.allocatePoints = allocatePoints;
exports.resetPoints = resetPoints;
exports.trainingCost = trainingCost;
exports.validateDevelopment = validateDevelopment;
const passiveStats_1 = require("./passiveStats");
const petAccess_1 = require("./petAccess");
const data_1 = require("./data");
const economy_1 = require("./economy");
const releaseBalance_1 = require("./releaseBalance");
exports.PET_LEVEL_CAP = 50;
/** New ranges apply to migrated pets; historical battle snapshots keep their own values. */
const petRange = (t) => data_1.ROLES[t.role].range;
exports.petRange = petRange;
/** 75 aptitude retains its old .95 baseline; investing in star ticks now matters. */
const aptitudeMultiplier = (t, key) => .95 + .006 * (t.innate[key] + t.training[key] - 75);
exports.aptitudeMultiplier = aptitudeMultiplier;
const levelCost = (level) => 60 + 12 * level + 2 * level * level;
exports.levelCost = levelCost;
function levelInfo(t) {
    let xp = t.development?.xp ?? 0, level = 1;
    while (level < exports.PET_LEVEL_CAP && xp >= (0, exports.levelCost)(level)) {
        xp -= (0, exports.levelCost)(level);
        level++;
    }
    const used = Object.values(t.development?.points ?? {}).reduce((n, v) => n + v, 0);
    return { level, current: level === exports.PET_LEVEL_CAP ? 0 : xp, needed: level === exports.PET_LEVEL_CAP ? 0 : (0, exports.levelCost)(level), available: (level - 1) * 3 - used };
}
const maxPetXp = () => Array.from({ length: 49 }, (_, i) => (0, exports.levelCost)(i + 1)).reduce((a, b) => a + b, 0);
exports.maxPetXp = maxPetXp;
function initDevelopment(t) { t.development ?? (t.development = { version: 1, xp: 0, points: { attack: 0, health: 0, defense: 0 } }); }
function grantExperience(s, ids, amount) {
    if (!s.livingVersion)
        return;
    if (!Number.isSafeInteger(amount) || amount < 0)
        throw Error('经验数量无效');
    for (const id of new Set(ids)) {
        const t = s.collection[id];
        if (!t)
            continue;
        initDevelopment(t);
        t.development.xp = Math.min((0, exports.maxPetXp)(), t.development.xp + amount);
    }
}
function developmentBonus(t) {
    if (!t.development)
        return { attack: 1, health: 1, armor: 0, resist: 0 };
    const { level } = levelInfo(t), p = t.development.points, g = (t.innate.growth + t.training.growth) / 100;
    const talent = (k) => (t.innate[k] + t.training[k]) / 100;
    return { attack: 1 + (level - 1) * .005 + p.attack * .01 * (.75 + .25 * talent('attack')) * g, health: 1 + (level - 1) * .004 + p.health * .009 * (.75 + .25 * talent('health')) * g, armor: p.defense * .4 * (.75 + .25 * talent('defense')) * g, resist: p.defense * .32 * (.75 + .25 * talent('defense')) * g };
}
function petPanel(t) {
    const r = data_1.ROLES[t.role], b = developmentBonus(t), apt = (k) => (0, exports.aptitudeMultiplier)(t, k);
    return { attack: Math.round(r.attack * apt('attack') * b.attack), health: Math.round(r.health * apt('health') * b.health * (0, passiveStats_1.passiveMultiplier)(t.skills, 'strong')), defense: Math.round((r.armor * apt('defense') + b.armor) * (0, passiveStats_1.passiveMultiplier)(t.skills, 'armor')), resist: Math.round((r.resist * apt('defense') + b.resist) * (0, passiveStats_1.passiveMultiplier)(t.skills, 'resist')) };
}
function allocatePoints(s, id, add) {
    const t = (0, petAccess_1.editablePet)(s, id);
    if (!t)
        throw Error('伙伴不存在、租借到期或正在参战');
    initDevelopment(t);
    const keys = ['attack', 'health', 'defense'];
    if (!add || Object.keys(add).length !== 3 || keys.some(k => !Number.isSafeInteger(add[k]) || add[k] < 0))
        throw Error('加点方案无效');
    const sum = keys.reduce((n, k) => n + add[k], 0);
    if (sum < 1 || sum > levelInfo(t).available)
        throw Error('可分配属性点不足');
    keys.forEach(k => t.development.points[k] += add[k]);
}
const resetPointCost = (s, t) => (0, economy_1.goldAmount)(s, 20 + levelInfo(t).level * 2);
exports.resetPointCost = resetPointCost;
function resetPoints(s, id) {
    const t = (0, petAccess_1.editablePet)(s, id);
    if (!t?.development || !Object.values(t.development.points).some(n => n > 0))
        throw Error('这只伙伴还没有分配属性点');
    const cost = (0, exports.resetPointCost)(s, t);
    if (s.gold < cost)
        throw Error('金币不足');
    s.gold -= cost;
    t.development.points = { attack: 0, health: 0, defense: 0 };
}
/** A training item advances one of the fifty visible star ticks. */
const talentTicks = (t, key) => Math.max(0, Math.min(50, t.innate[key] + t.training[key] - (key === 'growth' ? 60 : 50)));
exports.talentTicks = talentTicks;
function trainingCost(s, t, key) { const c = releaseBalance_1.RELEASE_BALANCE.training, star = Math.floor((0, exports.talentTicks)(t, key) / 10); return (0, economy_1.goldAmount)(s, s.livingVersion ? (key === 'growth' ? c.growthBase + c.growthPerStar * star : c.aptitudeBase + c.aptitudePerStar * star) : key === 'growth' ? 300 : 100); }
function validateDevelopment(t) {
    const d = t.development;
    if (!d)
        return;
    if (d.version !== 1 || !Number.isSafeInteger(d.xp) || d.xp < 0 || d.xp > (0, exports.maxPetXp)() || !d.points || Object.keys(d.points).length !== 3 || ['attack', 'health', 'defense'].some(k => !Number.isSafeInteger(d.points[k]) || d.points[k] < 0) || levelInfo(t).available < 0)
        throw Error('伙伴经验或加点资料损坏');
}
