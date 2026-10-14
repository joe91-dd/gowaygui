"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARENA_AI_SKILLS = void 0;
exports.refreshArenaAi = refreshArenaAi;
const development_1 = require("./development");
// Local test opponents have coherent builds, not six random slots that may
// omit their active spell or contain wave-only resurrection in a single duel.
exports.ARENA_AI_SKILLS = {
    stone: ['hold', 'strong', 'armor', 'taunt', 'block', 'share', 'regen', 'resist'],
    spike: ['piercingShot', 'swift', 'critical', 'combo', 'extraTarget', 'shredArmor', 'lifesteal', 'reach'],
    crystal: ['crystalCannon', 'swift', 'bounce', 'extraTarget', 'shredResist', 'spellDrain', 'reach', 'strong'],
    leaf: ['greatHeal', 'reach', 'doubleHeal', 'healShield', 'swift', 'cleanse', 'strong', 'armor'],
    bubble: ['bubbleRing', 'root', 'swift', 'weaken', 'extraTarget', 'shredArmor', 'steady', 'strong'],
};
function refreshArenaAi(s) {
    const c = s.community;
    if (!c || c.arena && !c.arena.settled || c.raid && !c.raid.settled)
        return;
    // The first four AI are established raid teammates. Only repair the lower
    // four arena opponents; never rewrite player-owned or borrowed pets.
    for (let i = 5; i <= 8; i++) {
        const ai = c.aiPlayers[`ai-islander-${i}`];
        if (!ai || !ai.ai || ai.arenaBuildVersion === 1)
            continue;
        for (const pet of Object.values(ai.pets)) {
            const count = Math.max(4, Math.min(8, pet.skills.length));
            pet.skills = exports.ARENA_AI_SKILLS[pet.role].slice(0, count);
            // These are cultivated rank opponents. Store their progression on the
            // visible pet itself so the inspect panel and battle use identical stats.
            const level = 14 + Math.max(0, count - 6) * 4, total = (level - 1) * 3;
            const health = pet.role === 'stone' ? Math.floor(total * .45) : pet.role === 'leaf' ? Math.floor(total * .5) : Math.floor(total / 3);
            const defense = pet.role === 'stone' ? total - health : pet.role === 'bubble' ? Math.floor(total * .2) : 0;
            pet.development = { version: 1, xp: Array.from({ length: level - 1 }, (_, i) => (0, development_1.levelCost)(i + 1)).reduce((n, x) => n + x, 0), points: { attack: total - health - defense, health, defense } };
            for (const key of ['attack', 'health', 'defense'])
                pet.innate[key] = Math.max(pet.innate[key], count >= 7 ? 88 : 85);
            pet.innate.growth = Math.max(pet.innate.growth, count >= 7 ? 103 : 100);
        }
        ai.arenaBuildVersion = 1;
    }
}
