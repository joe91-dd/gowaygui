"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderedPets = orderedPets;
exports.swapPetOrder = swapPetOrder;
const petAccess_1 = require("./petAccess");
const prototypeConfig_1 = require("./prototypeConfig");
const development_1 = require("./development");
const save_1 = require("./save");
function orderedPets(s, ownedOnly = false) {
    const rank = new Map((s.collectionOrder ?? []).map((id, i) => [id, i]));
    return (ownedOnly ? Object.values(s.collection) : (0, petAccess_1.visiblePets)(s)).sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || (0, prototypeConfig_1.turtleQuality)(b).tier - (0, prototypeConfig_1.turtleQuality)(a).tier || (0, development_1.levelInfo)(b).level - (0, development_1.levelInfo)(a).level || a.id.localeCompare(b.id));
}
/** Display order only: never exchanges identities, ownership, stats or deployed slots. */
function swapPetOrder(s, a, b) {
    const ids = orderedPets(s).map(t => t.id), i = ids.indexOf(a), j = ids.indexOf(b);
    (0, save_1.requireRule)(i >= 0 && j >= 0, '伙伴已不在背包中，请重新选择');
    [ids[i], ids[j]] = [ids[j], ids[i]];
    s.collectionOrder = ids;
}
