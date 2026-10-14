"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_SURVIVAL_VERSION = void 0;
exports.roleSurvival = roleSurvival;
/** Stored on the battle, so resuming a pre-tuning fight never changes its rules. */
exports.ROLE_SURVIVAL_VERSION = 1;
function roleSurvival(role, version) {
    return version === 1 && role !== 'stone' ? { health: .8, defense: .75 } : { health: 1, defense: 1 };
}
