"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allMapsReviewSave = allMapsReviewSave;
const community_1 = require("./community");
const game_1 = require("./game");
const data_1 = require("./data");
const save_1 = require("./save");
const monthCard_1 = require("./monthCard");
/** An independent review seed. The caller must put it in memory-only storage. */
function allMapsReviewSave(now, advancedAppearance = false, starterBalance = false, monthlyCardPreview = false) {
    const s = (0, game_1.makeInitialSave)(now, 0x61326);
    s.unlockedLevel = data_1.LEVELS.length - 1;
    s.cleared = data_1.LEVELS.map(l => l.id);
    s.tutorialDone = true;
    s.tutorialStarted = true;
    s.gold = 200000;
    s.materials = { attack: 80, health: 80, defense: 80, growth: 80 };
    const builds = {
        stone: ['hold', 'stoneMastery', 'armor', 'block', 'taunt', 'reflect', 'regen', 'counterStorm'],
        spike: ['piercingShot', 'spikeMastery', 'combo', 'scatter', 'critical', 'lifesteal', 'swift', 'pursuit'],
        crystal: ['crystalCannon', 'crystalMastery', 'arcane', 'bounce', 'calm', 'spellDrain', 'extraTarget', 'pursuit'],
        leaf: ['greatHeal', 'leafMastery', 'doubleHeal', 'healShield', 'holyLight', 'cleanse', 'strong', 'calm'],
        bubble: ['bubbleRing', 'spirit', 'root', 'weaken', 'shredArmor', 'calm', 'resist', 'strong'],
    };
    const extras = { stone: ['resist', 'strong'], spike: ['armor', 'strong'], crystal: ['strong', 'resist'], leaf: ['armor', 'regen'], bubble: ['armor', 'regen'] };
    if (!starterBalance)
        for (const t of Object.values(s.collection))
            t.skills = [...builds[t.role], ...(advancedAppearance ? extras[t.role] : [])];
    if (monthlyCardPreview)
        (0, monthCard_1.grantMonthCard)(s, 'isolated-preview-month-card', now);
    (0, community_1.initCommunity)(s, now);
    (0, save_1.validateSave)(s);
    return s;
}
