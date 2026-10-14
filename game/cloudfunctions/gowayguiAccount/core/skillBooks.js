"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_BLESSING_MAX = exports.BOOK_FUSION_ODDS = void 0;
exports.bookFusionOdds = bookFusionOdds;
exports.fuseSkillBooks = fuseSkillBooks;
exports.skillBookIssue = skillBookIssue;
exports.applySkillBook = applySkillBook;
const random_1 = require("./random");
const data_1 = require("./data");
const save_1 = require("./save");
/** Category probability, then equal probability for each book within that category. */
exports.BOOK_FUSION_ODDS = { common: .90, active: .095, precious: .005 };
exports.BOOK_BLESSING_MAX = 200;
function bookFusionOdds(points = 0) {
    const blessing = Math.max(0, Math.min(exports.BOOK_BLESSING_MAX, Math.floor(points)));
    if (blessing === exports.BOOK_BLESSING_MAX)
        return { common: 0, active: 0, precious: 1 };
    const precious = exports.BOOK_FUSION_ODDS.precious + Math.floor(blessing / 10) * .005;
    return { common: 1 - exports.BOOK_FUSION_ODDS.active - precious, active: exports.BOOK_FUSION_ODDS.active, precious };
}
function fuseSkillBooks(s, materials) {
    (0, save_1.requireRule)(Array.isArray(materials) && materials.length === 3, '请选择3本技能书');
    const counts = new Map();
    for (const id of materials) {
        (0, save_1.requireRule)(data_1.SKILLS.some(x => x.id === id), '技能书不存在');
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of counts)
        (0, save_1.requireRule)((s.skillBooks?.[id] ?? 0) >= count, '技能书数量不足，请重新选择');
    const blessingBefore = s.bookFusionBlessing ?? 0, odds = bookFusionOdds(blessingBefore);
    const roll = (0, random_1.random)(s), category = roll < odds.common ? 'common' : roll < odds.common + odds.active ? 'active' : 'precious';
    const pool = data_1.SKILLS.filter(x => !x.specialization && (category === 'active' ? x.active : category === 'precious' ? x.precious : !x.active && !x.precious));
    const result = pool[Math.floor((0, random_1.random)(s) * pool.length)].id;
    for (const [id, count] of counts) {
        s.skillBooks[id] -= count;
        if (!s.skillBooks[id])
            delete s.skillBooks[id];
    }
    s.skillBooks[result] = (s.skillBooks[result] ?? 0) + 1;
    s.bookFusionBlessing = category === 'precious' ? 0 : Math.min(exports.BOOK_BLESSING_MAX, blessingBefore + 1);
    return { materials: [...materials], result, blessingBefore, blessingAfter: s.bookFusionBlessing, preciousChance: odds.precious, guaranteed: blessingBefore === exports.BOOK_BLESSING_MAX };
}
function skillBookIssue(turtle, id) {
    const skill = data_1.SKILL_BY_ID[id];
    if (skill?.specialization)
        return '进阶主动技仅可通过局内合成至3阶获得，不能学习进阶技能书';
    if (!skill || !(0, data_1.skillsForRole)(turtle.role).includes(id))
        return '该技能不适合当前职业';
    if (turtle.skills.includes(id))
        return '已经拥有该技能';
    if (skill.requires && !turtle.skills.includes(skill.requires))
        return '需先拥有' + data_1.SKILL_BY_ID[skill.requires].name;
    if (skill.specialization && turtle.skills.length < 2)
        return '需要至少2个技能位，专精学习会保留职业主动';
}
/**
 * Apply a book to a validated permanent turtle without modifying that object.
 * The caller owns the outside-run guard, inventory and atomic save transaction.
 * Only a valid application advances the supplied transaction's random state.
 * The returned turtle keeps its identity; existing run snapshots stay separate.
 */
function applySkillBook(state, turtle, bookSkillId) {
    (0, save_1.requireRule)(state && Number.isSafeInteger(state.rng) && state.rng >= 0 && state.rng <= 4294967295, '随机状态不可用');
    (0, save_1.requireRule)(turtle && typeof turtle.id === 'string' && turtle.id.length > 0 && Array.isArray(turtle.skills)
        && turtle.innate && turtle.training && Array.isArray(turtle.parentIds), '龟资料不完整');
    const allowed = (0, data_1.skillsForRole)(turtle.role);
    (0, save_1.requireRule)(turtle.skills.length >= 1 && turtle.skills.length <= 12
        && new Set(turtle.skills).size === turtle.skills.length
        && turtle.skills.every(skill => (0, data_1.skillsForRole)(turtle.role, true).includes(skill)), '龟的现有技能组合不合法');
    (0, save_1.requireRule)(allowed.includes(bookSkillId), '这本技能书不适合该职业');
    (0, save_1.requireRule)(!turtle.skills.includes(bookSkillId), '这只龟已经拥有书上的技能');
    const issue = skillBookIssue(turtle, bookSkillId);
    (0, save_1.requireRule)(!issue, issue ?? '不能学习');
    const beforeSkills = [...turtle.skills];
    const next = {
        ...turtle,
        skills: [...beforeSkills],
        innate: { ...turtle.innate },
        training: { ...turtle.training },
        parentIds: [...turtle.parentIds],
    };
    // Specialization occupies one of the existing twelve slots; its prerequisite cannot be overwritten by this application.
    const prerequisite = data_1.SKILL_BY_ID[bookSkillId].requires;
    const eligible = beforeSkills.map((_, i) => i).filter(i => beforeSkills[i] !== prerequisite);
    const replacedIndex = eligible[Math.floor((0, random_1.random)(state) * eligible.length)];
    const replacedSkillId = beforeSkills[replacedIndex];
    next.skills[replacedIndex] = bookSkillId;
    return {
        turtle: next,
        receipt: { turtleId: turtle.id, bookSkillId, replacedSkillId, replacedIndex,
            beforeSkills, afterSkills: [...next.skills] },
    };
}
