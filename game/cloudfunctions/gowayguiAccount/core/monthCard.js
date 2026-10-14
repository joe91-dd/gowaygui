"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthCardGold = exports.hasMonthCard = exports.monthCardPeriod = exports.monthCardDay = exports.MONTH_CARD = void 0;
exports.monthCardClaimable = monthCardClaimable;
exports.grantMonthCard = grantMonthCard;
exports.claimMonthCard = claimMonthCard;
exports.validateMonthCard = validateMonthCard;
const economy_1 = require("./economy");
exports.MONTH_CARD = { id: 'patrol_month_30', name: '巡海月卡', priceYuan: 30, days: 30, stamina: 30, goldBase: 500, patrolMultiplier: 2, capMinutes: 1440 };
const DAY = 86400000;
const monthCardDay = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
exports.monthCardDay = monthCardDay;
const monthCardPeriod = (s, at = s.clockHighWater) => s.monthCard?.periods.find(p => p.startsAt <= at && at < p.endsAt);
exports.monthCardPeriod = monthCardPeriod;
const hasMonthCard = (s, at = s.clockHighWater) => !!(0, exports.monthCardPeriod)(s, at);
exports.hasMonthCard = hasMonthCard;
const monthCardGold = (s) => (0, economy_1.goldAmount)(s, exports.MONTH_CARD.goldBase);
exports.monthCardGold = monthCardGold;
function monthCardClaimable(s, at = s.clockHighWater) {
    const p = (0, exports.monthCardPeriod)(s, at), day = (0, exports.monthCardDay)(at);
    return !!p && p.claimedDays.length < exports.MONTH_CARD.days && !s.monthCard.periods.some(p => p.claimedDays.includes(day));
}
/** Fulfilment primitive for a VERIFIED payment, never called by a client buy button.
 * Duplicate payment notifications extend the entitlement only once. */
function grantMonthCard(s, orderId, at) {
    if (!/^[A-Za-z0-9:_-]{1,160}$/.test(orderId) || !Number.isSafeInteger(at) || at < 0 || at > s.clockHighWater)
        throw Error('月卡订单资料无效');
    const old = s.monthCard?.periods.find(p => p.orderId === orderId);
    if (old)
        return old;
    const card = s.monthCard ?? (s.monthCard = { version: 1, periods: [] }), startsAt = Math.max(at, card.periods[card.periods.length - 1]?.endsAt ?? 0), endsAt = startsAt + exports.MONTH_CARD.days * DAY;
    if (!Number.isSafeInteger(endsAt))
        throw Error('月卡有效期超出范围');
    const period = { orderId, startsAt, endsAt, claimedDays: [] };
    card.periods.push(period);
    return period;
}
function claimMonthCard(s, at) {
    const p = (0, exports.monthCardPeriod)(s, at);
    if (!p)
        throw Error('月卡尚未开通或已到期');
    if (p.claimedDays.length >= exports.MONTH_CARD.days)
        throw Error('本期30次月卡奖励已领取完毕');
    if (!monthCardClaimable(s, at))
        throw Error('今日月卡奖励已领取');
    const gold = (0, exports.monthCardGold)(s), stamina = exports.MONTH_CARD.stamina;
    if (!Number.isSafeInteger(s.gold + gold) || !Number.isSafeInteger(s.stamina + stamina))
        throw Error('资源数量超出范围');
    s.gold += gold;
    s.stamina += stamina;
    p.claimedDays.push((0, exports.monthCardDay)(at));
    return { gold, stamina };
}
function validateMonthCard(s) {
    const c = s.monthCard;
    if (c === undefined)
        return;
    const bad = () => { throw Object.assign(Error('月卡资料损坏'), { code: 'SAVE' }); };
    if (c.version !== 1 || !Array.isArray(c.periods) || !c.periods.length)
        bad();
    const ids = new Set(), days = new Set();
    let previous = 0;
    for (const p of c.periods) {
        if (!p || typeof p.orderId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(p.orderId) || ids.has(p.orderId) || !Number.isSafeInteger(p.startsAt) || p.startsAt < previous || !Number.isSafeInteger(p.endsAt) || p.endsAt - p.startsAt !== exports.MONTH_CARD.days * DAY || !Array.isArray(p.claimedDays) || p.claimedDays.length > exports.MONTH_CARD.days)
            bad();
        ids.add(p.orderId);
        previous = p.endsAt;
        for (const day of p.claimedDays) {
            if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < (0, exports.monthCardDay)(p.startsAt) || day > (0, exports.monthCardDay)(p.endsAt - 1) || day > (0, exports.monthCardDay)(s.clockHighWater) || days.has(day))
                bad();
            days.add(day);
        }
    }
}
