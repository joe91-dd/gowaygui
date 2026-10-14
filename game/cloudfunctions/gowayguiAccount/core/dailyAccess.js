"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessDay = exports.activityName = exports.DAILY_RULES = void 0;
exports.dailyAccess = dailyAccess;
exports.remainingAttempts = remainingAttempts;
exports.accessIssue = accessIssue;
exports.consumeAttempt = consumeAttempt;
exports.purchasePrice = purchasePrice;
exports.buyDaily = buyDaily;
exports.mailStaminaOverflow = mailStaminaOverflow;
exports.validateDailyAccess = validateDailyAccess;
exports.grantInstantPatrol = grantInstantPatrol;
const economy_1 = require("./economy");
const patrol_1 = require("./patrol");
const mail_1 = require("./mail");
exports.DAILY_RULES = { endless: { free: 3, buy: 3, unlock: 1, price: 20 }, arena: { free: 10, buy: 10, unlock: 9, price: 12 }, raid0: { free: 2, buy: 2, unlock: 4, price: 30 }, raid1: { free: 2, buy: 2, unlock: 14, price: 45 }, raid2: { free: 2, buy: 2, unlock: 24, price: 60 }, raid3: { free: 2, buy: 2, unlock: 34, price: 75 }, stamina: { buy: 5, price: 10 }, patrol: { buy: 2, price: 60 } };
const activityName = (key) => key === 'stamina' ? '体力' : key === 'patrol' ? '巡海' : key === 'endless' ? '无尽' : key === 'arena' ? '竞技场' : '副本 ' + (Number(key.slice(4)) + 1);
exports.activityName = activityName;
const accessDay = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
exports.accessDay = accessDay;
function dailyAccess(s, now = s.clockHighWater) {
    const day = (0, exports.accessDay)(now);
    if (!s.dailyAccess || day > s.dailyAccess.day)
        s.dailyAccess = { day, used: {}, bought: {} };
    return s.dailyAccess;
}
function remainingAttempts(s, key) { const d = s.dailyAccess?.day === (0, exports.accessDay)(s.clockHighWater) ? s.dailyAccess : undefined; return Math.max(0, exports.DAILY_RULES[key].free + (d?.bought[key] ?? 0) + (d?.rewarded?.[key] ?? 0) - (d?.used[key] ?? 0)); }
function accessIssue(s, key) { const r = exports.DAILY_RULES[key]; return !s.cleared.includes(r.unlock) ? '通关第 ' + (r.unlock + 1) + ' 关后开启' + (0, exports.activityName)(key) : remainingAttempts(s, key) <= 0 ? '今日' + (0, exports.activityName)(key) + '次数已用完，可用金币或自愿观看广告补充次数' : undefined; }
function consumeAttempt(s, key, now) { const d = dailyAccess(s, now), issue = accessIssue(s, key); if (issue)
    throw Error(issue); d.used[key] = (d.used[key] ?? 0) + 1; }
function purchasePrice(s, key) { const d = s.dailyAccess?.day === (0, exports.accessDay)(s.clockHighWater) ? s.dailyAccess : undefined; return (0, economy_1.goldAmount)(s, exports.DAILY_RULES[key].price * (1 + (d?.bought[key] ?? 0))); }
function buyDaily(s, key, now) {
    if (!Object.prototype.hasOwnProperty.call(exports.DAILY_RULES, key))
        throw Error('补给项目不存在');
    const d = dailyAccess(s, now), rule = exports.DAILY_RULES[key], count = d.bought[key] ?? 0;
    if (count >= rule.buy)
        throw Error('今日购买次数已用完');
    if ('unlock' in rule && !s.cleared.includes(rule.unlock))
        throw Error('请先通关第 ' + (rule.unlock + 1) + ' 关');
    if (key === 'stamina' && s.stamina >= 30)
        throw Error('体力已满，请先消耗后再购买');
    const cost = purchasePrice(s, key);
    if (s.gold < cost)
        throw Error('金币不足，还差 ' + (cost - s.gold) + ' 金币');
    // All callers commit the whole purchase atomically; a full pet bag never eats gold.
    if (key === 'patrol')
        grantInstantPatrol(s, now);
    if (key === 'stamina')
        s.stamina = Math.min(30, s.stamina + 20);
    s.gold -= cost;
    d.bought[key] = count + 1;
}
/** Offline-only overflow, committed once together with the login clock. */
function mailStaminaOverflow(s, now, interval, cap) {
    const from = s.staminaAt, gain = Math.floor(Math.max(0, now - from) / interval), space = Math.max(0, cap - s.stamina), overflow = Math.max(0, gain - space);
    if (overflow) {
        const mail = (0, mail_1.sendSystemMail)(s, 'stamina-overflow:' + from + ':' + now, '离线体力补给', '离线期间自然恢复、超出体力上限的部分已为你保存。领取后可超过体力上限；在线体力满时停止自然恢复。', [], now);
        mail.stamina = overflow;
    }
}
function validateDailyAccess(s) { const d = s.dailyAccess; if (!d)
    return; if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day) || !d.used || !d.bought)
    throw Error('每日次数资料损坏'); for (const [key, n] of Object.entries(d.bought)) {
    if (!(key in exports.DAILY_RULES) || !Number.isInteger(n) || n < 0 || n > exports.DAILY_RULES[key].buy)
        throw Error('每日购买次数损坏');
} let raids = 0; for (const [key, n] of Object.entries(d.rewarded ?? {})) {
    const cap = key === 'arena' ? 5 : key === 'endless' ? 1 : /^raid[0-3]$/.test(key) || key === 'patrol' ? 2 : -1;
    if (!Number.isInteger(n) || n < 0 || n > cap)
        throw Error('广告次数资料损坏');
    if (key.startsWith('raid'))
        raids += n;
} if (raids > 2)
    throw Error('副本广告次数资料损坏'); for (const [key, n] of Object.entries(d.used)) {
    const r = exports.DAILY_RULES[key];
    if (!r || !('free' in r) || !Number.isInteger(n) || n < 0 || n > r.free + r.buy + (d.rewarded?.[key] ?? 0))
        throw Error('每日挑战次数损坏');
} }
/** Atomic instant claim, independent of the normal offline bank. */
function grantInstantPatrol(s, now) {
    (0, patrol_1.enablePatrol)(s, now);
    const pending = s.patrol;
    const temp = { ...pending, bankMs: 0, creditedMinutes: 0, gold: 0, materials: {}, books: {}, pets: [], lastAt: now - patrol_1.PATROL.capMinutes * patrol_1.PATROL.minuteMs };
    s.patrol = temp;
    try {
        (0, patrol_1.accruePatrol)(s, now, now);
        (0, patrol_1.claimPatrol)(s);
        pending.rng = temp.rng;
    }
    finally {
        s.patrol = pending;
    }
}
