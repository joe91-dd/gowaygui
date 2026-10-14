"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adRewardLabel = exports.AD_SUPPLIES_GOLD = exports.AD_TOTAL_LIMIT = exports.AD_EXTRA = exports.AD_LIMITS = void 0;
exports.adRemaining = adRemaining;
exports.AD_LIMITS = { stamina: 5, doubleGold: 3, refresh: 3, supplies: 3, arenaAttempt: 5, raidAttempt: 2, endlessAttempt: 1, patrolClaim: 2 };
exports.AD_EXTRA = ['arenaAttempt', 'raidAttempt', 'endlessAttempt', 'patrolClaim'];
exports.AD_TOTAL_LIMIT = 24;
exports.AD_SUPPLIES_GOLD = 12000;
function adRemaining(s, kind) {
    const day = new Date(s.clockHighWater + 8 * 3600000).toISOString().slice(0, 10), d = s.dailyAds;
    const count = d.day !== day ? 0 : kind === 'supplies' ? d.supplies ?? 0 : exports.AD_EXTRA.includes(kind) ? d.extra?.[kind] ?? 0 : d.counts[kind] ?? 0;
    return Math.max(0, exports.AD_LIMITS[kind] - count);
}
const adRewardLabel = (kind) => ({ stamina: '体力＋5', doubleGold: '本局基础金币翻倍', refresh: '更换一批招募候选', supplies: '金币12000＋成长材料1', arenaAttempt: '竞技场次数＋1', raidAttempt: '当前副本次数＋1', endlessAttempt: '无尽次数＋1', patrolClaim: '领取12小时巡海收获' }[kind]);
exports.adRewardLabel = adRewardLabel;
