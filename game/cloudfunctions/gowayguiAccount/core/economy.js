"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOLD_SCALE = void 0;
exports.goldAmount = goldAmount;
exports.goldGrants = goldGrants;
exports.migrateEconomy = migrateEconomy;
exports.displayGold = displayGold;
exports.migrateGoldV3 = migrateGoldV3;
/** Version 2 changes denominations, never purchasing power. Legacy saves remain decodable. */
exports.GOLD_SCALE = 1000;
function goldAmount(s, base) {
    const value = base * (s.economyVersion === 3 ? 100 : s.economyVersion === 2 ? exports.GOLD_SCALE : 1);
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error('金币数值超出安全范围');
    return value;
}
function goldGrants(s, grants) { return grants.map(g => g.kind === 'gold' ? { ...g, amount: goldAmount(s, g.amount) } : g); }
function migrateEconomy(s) {
    var _a;
    if (s.economyVersion)
        return;
    const fields = new Set(['gold', 'goldEarned', 'baseGold', 'firstClearGold', 'spentGold', 'price', 'gross', 'tax', 'net']);
    const scale = (n) => { const next = n * exports.GOLD_SCALE; if (!Number.isSafeInteger(next) || next < 0)
        throw new Error('旧金币资料超出可迁移范围'); return next; };
    // Explicit monetary keys also cover saved transaction receipts and pending rewards.
    const visited = new Set();
    const walk = (value) => {
        if (!value || typeof value !== 'object' || visited.has(value))
            return;
        visited.add(value);
        const obj = value;
        for (const key of Object.keys(obj)) {
            const v = obj[key];
            if (typeof v === 'number' && (fields.has(key) || key === 'amount' && obj.kind === 'gold'))
                obj[key] = scale(v);
            else
                walk(v);
        }
        if (obj.kind === 'ad:doubleGold' && typeof obj.result === 'number')
            obj.result = scale(obj.result);
        if (typeof obj.gross === 'number' && typeof obj.tax === 'number' && typeof obj.net === 'number')
            obj.taxDenomination = exports.GOLD_SCALE;
        if ((obj.pool === 'turtle' || obj.pool === 'book' || obj.pool === 'pack') && typeof obj.cost === 'number')
            obj.cost = scale(obj.cost);
    };
    walk(s);
    s.economyVersion = 2;
    (_a = s.settings).autoSkills ?? (_a.autoSkills = false);
    s.shop ?? (s.shop = { turtleCount: 0, bookCount: 0 });
}
function displayGold(amount) { return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 }); }
/** Denomination-only migration: balances, prices and unclaimed receipts move together. */
function migrateGoldV3(s) {
    if (s.economyVersion === 3)
        return;
    if (!s.economyVersion)
        migrateEconomy(s);
    const fields = new Set(['gold', 'goldEarned', 'baseGold', 'firstClearGold', 'spentGold', 'price', 'gross', 'tax', 'net']);
    const visited = new Set();
    const walk = (value) => {
        if (!value || typeof value !== 'object' || visited.has(value))
            return;
        visited.add(value);
        const o = value;
        for (const k of Object.keys(o)) {
            const v = o[k];
            if (typeof v === 'number' && (fields.has(k) || k === 'amount' && o.kind === 'gold'))
                o[k] = Math.round(v / 10);
            else
                walk(v);
        }
        if ((o.pool === 'turtle' || o.pool === 'book' || o.pool === 'pack') && typeof o.cost === 'number')
            o.cost = Math.round(o.cost / 10);
        if (o.kind === 'ad:doubleGold' && typeof o.result === 'number')
            o.result = Math.round(o.result / 10);
        if (typeof o.gross === 'number' && typeof o.tax === 'number' && typeof o.net === 'number') {
            o.taxDenomination = o.taxDenomination === 1000 ? 100 : 1;
            o.tax = Math.ceil(o.gross / o.taxDenomination * .2) * o.taxDenomination;
            o.net = o.gross - o.tax;
        }
    };
    walk(s);
    s.economyVersion = 3;
}
