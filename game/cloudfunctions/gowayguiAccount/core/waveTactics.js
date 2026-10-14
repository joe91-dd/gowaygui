"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waveTactic = waveTactic;
exports.tacticalSpawns = tacticalSpawns;
const THEMES = [
    { name: '轻敌接近', tip: '先建立交叉火力', pool: ['ink', 'runner', 'ink'] },
    { name: '密集蟹群', tip: '控住蓄力快蟹，在拐角集中清群', pool: ['ink', 'ink', 'runner', 'ink', 'runner'] },
    { name: '重甲护送', tip: '铁壳收盾时用法术击破，慢速拦截冲刺', pool: ['armored', 'runner', 'runner', 'armored'] },
    { name: '后排受袭', tip: '优先击杀治疗螺，调动避开远程火力', pool: ['snail', 'ink', 'runner', 'snail'] },
    { name: '雾壳来袭', tip: '物理输出优先，保留技能补漏', pool: ['mist', 'runner', 'mist', 'armored'] },
];
function waveTactic(levelId, wave) { if (levelId >= 14 && levelId < 50 && wave >= 3)
    return { name: levelId < 24 ? '蛛网试炼' : levelId < 29 ? '火雨试炼' : levelId < 34 ? '净化与换位' : '机关协同', tip: levelId < 24 ? '保护治疗，蛛网命中后主动净化' : levelId < 29 ? '红圈锁定两秒，点伙伴换位避开' : levelId < 34 ? '治疗留在安全处，净化被束缚伙伴并避开火雨' : '先集火回潮机关，再处理首领；保留净化与换位', pool: THEMES[(wave - 1) % 5].pool }; return THEMES[levelId === 0 ? Math.min(1, Math.floor((wave - 1) / 3)) : (wave - 1) % THEMES.length]; }
/** Small readable packs, with a gap for choosing the next response. */
function tacticalSpawns(spawns, levelId, wave) {
    const spec = waveTactic(levelId, wave), regular = spawns.filter(s => s.kind !== 'boss' && s.kind !== 'elite'), last = Math.max(0, ...regular.map(s => s.time));
    const groups = Math.ceil(regular.length / 3), gap = groups > 1 ? last / (groups - 1) : 0;
    let cursor = 0;
    return spawns.map(s => {
        if (s.kind === 'boss' || s.kind === 'elite')
            return s;
        const i = cursor++, kind = spec.pool[i % spec.pool.length];
        return { ...s, kind, time: Math.min(last, Math.floor(i / 3) * gap + (i % 3) * .8) };
    }).sort((a, b) => a.time - b.time);
}
