"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookAllowed = exports.BOOK_ODDS = exports.bookGrade = void 0;
exports.drawBookGrade = drawBookGrade;
exports.policyBook = policyBook;
exports.bookChestReward = bookChestReward;
const data_1 = require("./data");
const random_1 = require("./random");
const bookGrade = (id) => { const s = data_1.SKILLS.find(x => x.id === id); return s.specialization ? 'mastery' : s.active ? 'active' : s.precious ? 'precious' : 'common'; };
exports.bookGrade = bookGrade;
exports.BOOK_ODDS = { activity: [.90, .10, 0, 0], elite: [.80, .20, 0, 0], stage: [.74, .26, 0, 0] };
const GRADES = ['common', 'active', 'mastery', 'precious'];
function drawBookGrade(s, pool = 'activity') { let roll = (0, random_1.random)(s); const odds = exports.BOOK_ODDS[pool]; for (let i = 0; i < 4; i++) {
    roll -= odds[i];
    if (roll < 0)
        return GRADES[i];
} return 'common'; }
function policyBook(s, pool = 'activity') { const grade = drawBookGrade(s, pool), list = data_1.SKILLS.filter(x => (0, exports.bookGrade)(x.id) === grade); return list[Math.floor((0, random_1.random)(s) * list.length)].id; }
function bookChestReward(s, advanced = false) { return { kind: 'bookPack', grade: drawBookGrade(s, advanced ? 'stage' : 'elite'), amount: 1 }; }
const bookAllowed = (id, source) => source !== 'chapter' && !['mastery', 'precious'].includes((0, exports.bookGrade)(id));
exports.bookAllowed = bookAllowed;
