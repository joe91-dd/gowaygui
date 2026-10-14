"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endlessBonusLabel = exports.raidExtraLabel = exports.RAID_EXTRA = exports.rewardBooks = exports.REWARD_BOOK_LABEL = exports.rewardPoolLabel = exports.REWARD_BOOK_ODDS = exports.rewardDay = void 0;
exports.rewardBook = rewardBook;
exports.rewardPet = rewardPet;
exports.endlessBonus = endlessBonus;
exports.campaignRewardRange = campaignRewardRange;
exports.campaignLoot = campaignLoot;
const data_1 = require("./data");
const random_1 = require("./random");
const talents_1 = require("./talents");
const economy_1 = require("./economy");
const rewardDay = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
exports.rewardDay = rewardDay;
exports.REWARD_BOOK_ODDS = {
    common: { common: 1 }, mixed: { common: .6, active: .4 }, advanced: { common: .2, active: .8 },
};
const rewardPoolLabel = (pool) => pool === 'common' ? '通用技能池，同池等概率' : pool === 'mixed' ? '通用60% · 主动40%（同池等概率）' : '主动80% · 通用20%（同池等概率）';
exports.rewardPoolLabel = rewardPoolLabel;
exports.REWARD_BOOK_LABEL = { common: '随机通用技能书', mixed: '随机技能书', advanced: '高级随机技能书' };
function rewardBook(s, pool) {
    let roll = (0, random_1.random)(s), grade = 'common';
    for (const [key, weight] of Object.entries(exports.REWARD_BOOK_ODDS[pool])) {
        roll -= weight;
        if (roll < 0) {
            grade = key;
            break;
        }
    }
    const choices = data_1.SKILLS.filter(v => (v.specialization ? 'mastery' : v.active ? 'active' : v.precious ? 'precious' : 'common') === grade);
    return choices[Math.floor((0, random_1.random)(s) * choices.length)].id;
}
const rewardBooks = (s, pool, count) => Array.from({ length: count }, () => ({ kind: 'book', skillId: rewardBook(s, pool), amount: 1 }));
exports.rewardBooks = rewardBooks;
function rewardPet(s, count, source, now = s.clockHighWater) {
    const role = data_1.ROLE_IDS[Math.floor((0, random_1.random)(s) * data_1.ROLE_IDS.length)];
    return { id: source + '-' + (++s.idCounter), role, name: '', skills: (0, talents_1.ordinaryPetSkills)(s, role, count), innate: (0, talents_1.initialTalents)(s, role), training: { attack: 0, health: 0, defense: 0, growth: 0 }, generation: 0, bornAt: now, parentIds: [], locked: false };
}
exports.RAID_EXTRA = [
    { books: 1, pool: 'common', pets: 0, skills: 0 },
    { books: 1, pool: 'common', pets: 1, skills: 5 },
    { books: 1, pool: 'mixed', pets: 1, skills: 6 },
    { books: 2, pool: 'mixed', pets: 2, skills: 6 },
];
const raidExtraLabel = (tier) => { const r = exports.RAID_EXTRA[tier]; return (r.pets ? `随机${r.skills}技能伙伴 ×${r.pets}\n` : '') + exports.REWARD_BOOK_LABEL[r.pool] + ' ×' + r.books; };
exports.raidExtraLabel = raidExtraLabel;
function endlessBonus(wave) {
    if (wave > 100 && wave % 10 === 0)
        return { books: 1, pool: 'advanced', pets: 1, skills: 6 };
    const count = { 5: 1, 10: 2, 20: 4, 30: 1, 50: 2, 80: 2, 100: 2 }[wave] ?? 0;
    return { books: count, pool: wave < 30 ? 'common' : 'mixed', pets: wave === 100 ? 1 : 0, skills: 6 };
}
const endlessBonusLabel = (wave) => { const r = endlessBonus(wave); return (r.books ? exports.REWARD_BOOK_LABEL[r.pool] + ' ×' + r.books : '') + (r.pets ? '\n随机6技能伙伴 ×' + r.pets : ''); };
exports.endlessBonusLabel = endlessBonusLabel;
/** Guaranteed clear loot, independent of combat bounties and first-clear rewards. */
function campaignRewardRange(levelId) {
    const n = Math.max(1, Math.min(50, levelId + 1)), band = Math.floor((n - 1) / 10);
    return { goldMin: 20 + n * 10, goldMax: 40 + n * 14, booksMin: 1 + band, booksMax: 2 + band, petsMin: 1 + Math.floor((n - 1) / 25), petsMax: 1 + Math.floor((n - 1) / 15), fiveChance: .1 + (n - 1) * .4 / 49 };
}
function campaignLoot(s, levelId, source, now) {
    const r = campaignRewardRange(levelId), pick = (a, b) => a + Math.floor((0, random_1.random)(s) * (b - a + 1));
    return { grants: [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, pick(r.goldMin, r.goldMax)) }, ...(0, exports.rewardBooks)(s, 'common', pick(r.booksMin, r.booksMax))], pets: Array.from({ length: pick(r.petsMin, r.petsMax) }, () => rewardPet(s, (0, random_1.random)(s) < r.fiveChance ? 5 : 4, source, now)) };
}
