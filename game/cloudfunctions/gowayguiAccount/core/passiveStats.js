"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passiveMultiplier = exports.PASSIVE_PERCENT = void 0;
/** Relative bonuses use the cultivated base stat, before rank and blessing multipliers. */
exports.PASSIVE_PERCENT = { strong: .12, armor: .25, resist: .25, swift: .12, reach: .15, shredArmor: .15, shredResist: .15 };
const passiveMultiplier = (skills, id) => 1 + (skills.includes(id) ? exports.PASSIVE_PERCENT[id] : 0);
exports.passiveMultiplier = passiveMultiplier;
