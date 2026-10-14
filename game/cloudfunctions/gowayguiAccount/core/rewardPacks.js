"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packForWave = exports.PACK_COLORS = exports.PACK_NAMES = void 0;
exports.packPool = packPool;
exports.applyReward = applyReward;
exports.openBookPack = openBookPack;
exports.validReward = validReward;
const data_1 = require("./data");
const random_1 = require("./random");
exports.PACK_NAMES = { common: '通用技能随机礼包', precious: '珍贵技能随机礼包', active: '职业主动随机礼包', mastery: '职业专精随机礼包' };
exports.PACK_COLORS = { common: '#D9BD53', precious: '#D66059', active: '#D9A539', mastery: '#D9A539' };
function packPool(grade) { return data_1.SKILLS.filter(s => grade === 'mastery' ? s.specialization : grade === 'active' ? s.active : grade === 'precious' ? s.precious && !s.specialization : !s.active && !s.precious && !s.specialization).map(s => s.id); }
function applyReward(s, g) {
    if (g.kind === 'gold')
        s.gold += g.amount;
    else if (g.kind === 'material')
        s.materials[g.material] += g.amount;
    else if (g.kind === 'book') {
        s.skillBooks ?? (s.skillBooks = {});
        s.skillBooks[g.skillId] = (s.skillBooks[g.skillId] ?? 0) + g.amount;
    }
    else {
        s.bookPacks ?? (s.bookPacks = {});
        s.bookPacks[g.grade] = (s.bookPacks[g.grade] ?? 0) + g.amount;
    }
}
function openBookPack(s, grade) {
    if (!exports.PACK_NAMES[grade] || !(s.bookPacks?.[grade]))
        throw Error('这个礼包数量不足');
    const pool = packPool(grade);
    const skillId = pool[Math.floor((0, random_1.random)(s) * pool.length)];
    s.bookPacks[grade]--;
    applyReward(s, { kind: 'book', skillId, amount: 1 });
    return skillId;
}
const packForWave = (wave) => wave >= 30 ? 'active' : 'common';
exports.packForWave = packForWave;
function validReward(g) { return !!g && Number.isSafeInteger(g.amount) && g.amount > 0 && (g.kind === 'gold' || g.kind === 'material' && ['attack', 'health', 'defense', 'growth'].includes(g.material) || g.kind === 'book' && data_1.SKILLS.some(s => s.id === g.skillId) || g.kind === 'bookPack' && !!exports.PACK_NAMES[g.grade]); }
