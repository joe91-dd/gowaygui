"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENDLESS_REWARD_WAVES = exports.ENDLESS_ROUTE_WAVES = void 0;
exports.endlessMilestoneWaves = endlessMilestoneWaves;
exports.grantDailyEndlessRewards = grantDailyEndlessRewards;
const progression_1 = require("./progression");
const economy_1 = require("./economy");
const rewardBalance_1 = require("./rewardBalance");
exports.ENDLESS_ROUTE_WAVES = [5, 10, 20, 30, 50, 80, 100];
exports.ENDLESS_REWARD_WAVES = [...exports.ENDLESS_ROUTE_WAVES, 110];
function endlessMilestoneWaves(completed) {
    const waves = exports.ENDLESS_ROUTE_WAVES.filter(w => w <= completed);
    for (let wave = 110; wave <= completed; wave += 10)
        waves.push(wave);
    return waves;
}
/** Grant and mark together; unclaimed chests cannot be rerolled by a second run. */
function grantDailyEndlessRewards(s, completed, now) {
    const p = (0, progression_1.progression)(s), day = (0, rewardBalance_1.rewardDay)(Math.max(now, s.clockHighWater));
    if (!p.endlessDaily || p.endlessDaily.day < day)
        p.endlessDaily = { day, waves: [] };
    const daily = p.endlessDaily;
    for (const wave of endlessMilestoneWaves(completed)) {
        if (daily.waves.includes(wave))
            continue;
        const id = 'endless:daily:' + daily.day + ':' + wave, bonus = (0, rewardBalance_1.endlessBonus)(wave);
        const prior = p.chests.find(c => c.id === id || c.id.startsWith('endless:') && c.title === wave + '波里程宝箱' && (0, rewardBalance_1.rewardDay)(c.at) === daily.day);
        if (!prior) {
            const chest = (0, progression_1.grantChest)(s, id, wave + '波里程宝箱', Math.min(3, 1 + Math.floor(wave / 30)), [{ kind: 'gold', amount: (0, economy_1.goldAmount)(s, 30 + wave * 5) }, { kind: 'material', material: 'growth', amount: Math.max(1, Math.floor(wave / 10)) }, ...(0, rewardBalance_1.rewardBooks)(s, bonus.pool, bonus.books)], now);
            if (bonus.pets)
                chest.pets = Array.from({ length: bonus.pets }, () => (0, rewardBalance_1.rewardPet)(s, bonus.skills, 'endless-' + daily.day + '-' + wave, now));
        }
        daily.waves.push(wave);
    }
}
