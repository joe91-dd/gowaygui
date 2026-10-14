"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MARKET_GOLD = exports.PUBLICITY_MS = void 0;
exports.marketRule = marketRule;
exports.checkMarketPrice = checkMarketPrice;
const data_1 = require("./data");
exports.PUBLICITY_MS = 60 * 60 * 1000;
// Free pricing still uses a finite integer transport bound, not a balance supplied by the client.
exports.MAX_MARKET_GOLD = 1000000000;
function marketRule(kind, pet, skillId) {
    if (kind === 'book') {
        const skill = skillId && data_1.SKILL_BY_ID[skillId];
        if (!skill)
            throw Error('技能书不存在');
        return skill.precious ? { max: exports.MAX_MARKET_GOLD, publicity: exports.PUBLICITY_MS, label: '珍贵技能书：自主定价，公示60分钟' } : { fixed: 20000, max: 20000, publicity: 0, label: '普通技能书：固定2万金币' };
    }
    const n = pet?.skills.length;
    if (!n || n > 12)
        throw Error('伙伴技能数不合法');
    if (kind === 'rental') {
        if (n < 6)
            throw Error('租赁至少需要6技能');
        const fixed = 30000 + (n - 6) * 5000;
        return { fixed, max: fixed, publicity: 0, label: n + '技能租赁：' + fixed / 10000 + '万金币，一场战斗或一小时' };
    }
    if (n < 4)
        throw Error('交易龟龟至少需要4技能');
    if (n <= 6) {
        const fixed = n * 10000;
        return { fixed, max: fixed, publicity: 0, label: n + '技能：固定' + n + '万金币' };
    }
    const max = n <= 10 ? 200000 * 2 ** (n - 7) : exports.MAX_MARKET_GOLD;
    return { max, publicity: exports.PUBLICITY_MS, label: n + '技能：' + (n <= 10 ? '最高' + max / 10000 + '万金币' : '自主定价') + '，公示60分钟' };
}
function checkMarketPrice(kind, price, pet, skillId) {
    const rule = marketRule(kind, pet, skillId);
    if (!Number.isSafeInteger(price) || price < 1 || price > rule.max || rule.fixed !== undefined && price !== rule.fixed)
        throw Error(rule.label + '；价格须为正整数');
    return rule;
}
