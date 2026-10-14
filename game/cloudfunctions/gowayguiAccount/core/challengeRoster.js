"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHALLENGE_MIN_ROLES = void 0;
exports.defaultChallengeRoster = defaultChallengeRoster;
exports.challengeRoleCount = challengeRoleCount;
exports.challengeRosterIssue = challengeRosterIssue;
exports.CHALLENGE_MIN_ROLES = 3;
/** Keep valid player preferences, repair stale IDs, and fill from owned pets only. */
function defaultChallengeRoster(collection, preferred = [], diverse = true) {
    const owned = Object.keys(collection), valid = Array.from(new Set(preferred)).filter(id => !!collection[id]).slice(0, 5);
    if (valid.length === 5 && (!diverse || !challengeRosterIssue(valid.map(id => collection[id]))))
        return valid;
    const candidates = owned.filter(id => !valid.includes(id));
    if (diverse) {
        for (const id of candidates) {
            if (valid.length >= 5)
                break;
            if (!valid.some(v => collection[v].role === collection[id].role))
                valid.push(id);
        }
    }
    for (const id of candidates) {
        if (valid.length >= 5)
            break;
        if (!valid.includes(id))
            valid.push(id);
    }
    if (diverse && challengeRoleCount(valid.map(id => collection[id])) < exports.CHALLENGE_MIN_ROLES) {
        for (const id of owned) {
            if (valid.some(v => collection[v].role === collection[id].role))
                continue;
            const replace = valid.findIndex(v => valid.filter(k => collection[k].role === collection[v].role).length > 1);
            if (replace < 0)
                break;
            valid[replace] = id;
            if (challengeRoleCount(valid.map(v => collection[v])) >= exports.CHALLENGE_MIN_ROLES)
                break;
        }
    }
    return valid;
}
function challengeRoleCount(roster) {
    return new Set(roster.filter((t) => !!t).map(t => t.role)).size;
}
function challengeRosterIssue(roster) {
    if (roster.length !== 5 || roster.some(t => !t) || new Set(roster.map(t => t.id)).size !== 5)
        return '请选择五只不同的自有伙伴';
    const count = challengeRoleCount(roster);
    if (count < exports.CHALLENGE_MIN_ROLES)
        return `至少需要3个不同职业，当前只有${count}个职业`;
}
