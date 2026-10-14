"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailbox = mailbox;
exports.sendSystemMail = sendSystemMail;
exports.readMail = readMail;
exports.claimMail = claimMail;
exports.deleteMail = deleteMail;
exports.validateMailbox = validateMailbox;
const rewardPacks_1 = require("./rewardPacks");
function mailbox(s) { return s.mailbox ?? (s.mailbox = { version: 1, items: [] }); }
function sendSystemMail(s, id, title, body, grants, sentAt = s.clockHighWater, source = 'system') {
    const box = mailbox(s), prior = box.items.find(m => m.id === id);
    if (prior)
        return prior;
    const mail = { id, title, body, grants, sentAt, source, read: false, claimed: false };
    box.items.push(mail);
    return mail;
}
function readMail(s, id) { const m = mailbox(s).items.find(m => m.id === id); if (!m)
    throw Error('邮件不存在'); m.read = true; }
function claimMail(s, id) { const m = mailbox(s).items.find(m => m.id === id); if (!m)
    throw Error('邮件不存在'); if (m.claimed)
    return; const pets = (m.pets ?? []).filter(t => !s.collection[t.id]); if (Object.keys(s.collection).length + pets.length > s.capacity)
    throw Error('龟龟收藏已满，请整理后再领取'); for (const t of pets)
    s.collection[t.id] = JSON.parse(JSON.stringify(t)); for (const g of m.grants)
    (0, rewardPacks_1.applyReward)(s, g); if (m.stamina)
    s.stamina += m.stamina; m.read = true; m.claimed = true; }
function deleteMail(s, id) { const box = mailbox(s), m = box.items.find(m => m.id === id); if (!m)
    return; if (!m.claimed && (m.grants.length || m.pets?.length || m.stamina))
    throw Error('请先领取附件'); box.items = box.items.filter(m => m.id !== id); }
function validateMailbox(s) { const box = s.mailbox; if (!box)
    return; const ids = new Set(); if (box.version !== 1 || !Array.isArray(box.items))
    throw Error('邮箱资料损坏'); for (const m of box.items) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.title !== 'string' || m.title.length > 100 || typeof m.body !== 'string' || m.body.length > 4000 || !Number.isSafeInteger(m.sentAt) || m.sentAt < 0 || typeof m.read !== 'boolean' || typeof m.claimed !== 'boolean' || !['system', 'arena', 'room'].includes(m.source) || !Array.isArray(m.grants) || !m.grants.every(rewardPacks_1.validReward))
        throw Error('系统邮件资料损坏');
    if (m.stamina !== undefined && (!Number.isSafeInteger(m.stamina) || m.stamina <= 0))
        throw Error("体力附件损坏");
    ids.add(m.id);
} }
