"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showcasePets = showcasePets;
/** Cosmetic only: never changes score order, battle roster or pet ownership. */
function showcasePets(s, fallback) {
    const ids = s.community?.showcase?.ids ?? [];
    const pets = ids.map(id => s.collection[id]).filter((t) => !!t && !s.community?.hiddenPets.includes(t.id));
    if (pets.length)
        return pets;
    if (fallback && s.collection[fallback.id] && !s.community?.hiddenPets.includes(fallback.id))
        return [fallback];
    return Object.values(s.collection).filter(t => !s.community?.hiddenPets.includes(t.id)).slice(0, 1);
}
