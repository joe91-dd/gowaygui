"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskDay = exports.WEEKLY_ACTIVITY = exports.DAILY_ACTIVITY = exports.ACTIVITY_TASKS = exports.LOGIN_GIFTS = exports.AD_MILESTONES = exports.INVITE_MILESTONES = exports.TASK_POLICY_VERSION = void 0;
exports.activityPoints = activityPoints;
exports.recordTask = recordTask;
exports.validateTaskJournal = validateTaskJournal;
exports.TASK_POLICY_VERSION = '2026-09-15';
exports.INVITE_MILESTONES = [{ at: 1, skills: 4, count: 2 }, { at: 2, skills: 4, count: 4 }, { at: 3, skills: 5, count: 2 }, { at: 4, skills: 5, count: 4 }, { at: 5, skills: 6, count: 2 }, { at: 10, skills: 8, count: 1 }, { at: 20, skills: 8, count: 2 }];
exports.AD_MILESTONES = [{ at: 10, skills: 4, count: 2 }, { at: 20, skills: 5, count: 2 }, { at: 30, skills: 6, count: 2 }, { at: 40, skills: 7, count: 2 }, { at: 80, skills: 8, count: 2 }];
exports.LOGIN_GIFTS = [{ gold: 1800, material: 2 }, { gold: 2200, material: 3 }, { gold: 2600, material: 4 }, { gold: 3200, material: 5 }, { gold: 4000, material: 6 }, { gold: 5000, material: 8 }, { gold: 0, material: 0, skills: 8, count: 1 }];
exports.ACTIVITY_TASKS = [{ id: 'login', name: '今日登录', target: 1, points: 10 }, { id: 'chapter', name: '完成关卡波次', target: 5, points: 30 }, { id: 'boss', name: '击败首领', target: 3, points: 20 }, { id: 'cultivate', name: '培养、加点或学习技能', target: 1, points: 20 }, { id: 'fusion', name: '完成一次合成并选留', target: 1, points: 20 }, { id: 'challenge', name: '完成无尽或副本波次', target: 5, points: 20 }];
exports.DAILY_ACTIVITY = [{ at: 30, gold: 1200, materials: 2 }, { at: 60, gold: 1800, materials: 3 }, { at: 100, gold: 3000, materials: 4, pack: 'common' }];
exports.WEEKLY_ACTIVITY = [{ at: 200, gold: 6000, materials: 6 }, { at: 400, gold: 9000, materials: 9, pack: 'common' }, { at: 600, gold: 12000, materials: 12, pack: 'active' }];
const taskDay = (now) => new Date(now + 28800000).toISOString().slice(0, 10);
exports.taskDay = taskDay;
function activityPoints(counts) { return Math.min(100, exports.ACTIVITY_TASKS.reduce((n, t) => n + ((counts[t.id] ?? 0) >= t.target ? t.points : 0), 0)); }
function recordTask(s, kind, key, now) {
    const day = (0, exports.taskDay)(now), j = s.taskJournal ?? (s.taskJournal = { version: 1, day, counts: { login: 1 }, history: [], events: [] });
    if (day > j.day) {
        j.history.push({ day: j.day, points: activityPoints(j.counts) });
        j.history = j.history.slice(-35);
        j.day = day;
        j.counts = { login: 1 };
    }
    let metric, amount = 1;
    if (j.events.includes(key))
        return;
    if (kind === 'completeWave') {
        metric = s.run?.mode === 'endless' ? 'challenge' : 'chapter';
        if (s.run?.mode === 'chapter' && s.run.bossRescuedWaves?.includes(s.run.wave))
            j.counts.boss = Math.min(9999, (j.counts.boss ?? 0) + 1);
    }
    if (['outsideKeep', 'collect'].includes(kind))
        metric = 'fusion';
    if (['train', 'skillBook', 'allocate'].includes(kind))
        metric = 'cultivate';
    if (kind === 'finishRaid' && s.community?.raid?.settled) {
        metric = 'challenge';
        amount = s.community.raid.wave;
    }
    if (kind === 'roomChallenge') {
        metric = 'challenge';
        amount = 5;
    }
    if (!metric)
        return;
    j.events.push(key);
    j.events = j.events.slice(-1024);
    j.counts[metric] = Math.min(9999, (j.counts[metric] ?? 0) + amount);
}
function validateTaskJournal(s) { const j = s.taskJournal; if (!j)
    return; const count = (n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 9999, day = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); if (j.version !== 1 || !day(j.day) || !j.counts || typeof j.counts !== 'object' || Object.entries(j.counts).some(([k, v]) => !exports.ACTIVITY_TASKS.some(t => t.id === k) || !count(v)) || !Array.isArray(j.history) || j.history.length > 35 || j.history.some(r => !day(r.day) || !count(r.points) || r.points > 100) || !Array.isArray(j.events) || j.events.length > 1024 || j.events.some(k => typeof k !== 'string' || k.length > 160))
    throw Error('任务活跃资料损坏'); }
