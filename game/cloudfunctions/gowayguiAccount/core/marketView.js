"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterMarket = filterMarket;
const data_1 = require("./data");
/** Pure filtering keeps all options active together and never changes listing ownership. */
function filterMarket(listings, f) {
    const needle = f.search.trim().toLocaleLowerCase();
    return listings.filter(l => l.status === 'listed' && (f.kind === 'rental' ? l.kind === 'rental' : l.kind !== 'rental') && (f.mine ? l.ownerId === f.ownerId : l.ownerId !== f.ownerId))
        .filter(l => f.kind === 'rental' ? f.role === 'all' || l.pet?.role === f.role : f.asset === 'all' || l.kind === f.asset)
        .filter(l => !needle || (l.pet ? `${l.pet.name} ${data_1.ROLES[l.pet.role].name} ${data_1.ROLES[l.pet.role].job}` : data_1.SKILL_BY_ID[l.skillId].name).toLocaleLowerCase().includes(needle))
        .sort((a, b) => (f.sort === 'asc' ? a.price - b.price : b.price - a.price) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
