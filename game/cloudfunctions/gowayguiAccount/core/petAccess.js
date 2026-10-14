"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visiblePets = visiblePets;
exports.accessiblePet = accessiblePet;
exports.loanLabel = loanLabel;
exports.editablePet = editablePet;
/** Loan turtles are independent saved copies. They never alias the owner's archive. */
function visiblePets(s) { return Object.values(s.collection).concat((s.community?.loans ?? []).filter(l => !l.finished && (!!l.usedBy || l.expiresAt > s.clockHighWater)).map(l => l.turtle)); }
function accessiblePet(s, id) { return visiblePets(s).find(t => t.id === id); }
function loanLabel(s, id) { const l = s.community?.loans.find(l => l.id === id); return l ? (l.kind === 'rental' ? '租赁' : '借用') + ' · ' + (l.finished || (!l.usedBy && l.expiresAt <= s.clockHighWater) ? '剩余0次' : l.usedBy ? '本次参战中' : '剩余1次') : ''; }
function editablePet(s, id) { if (s.collection[id])
    return s.collection[id]; return s.community?.loans.find(l => l.id === id && !l.finished && !l.usedBy && l.expiresAt > s.clockHighWater)?.turtle; }
