"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.random = random;
exports.choose = choose;
exports.weighted = weighted;
exports.sample = sample;
/** Deterministic PRNG for local simulation. This is not an anti-cheat boundary. */
function random(state) {
    let x = state.rng | 0;
    if (x === 0)
        x = 0x6d2b79f5;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.rng = x >>> 0;
    return state.rng / 4294967296;
}
function choose(state, values) {
    if (!values.length)
        throw new Error('候选为空');
    return values[Math.floor(random(state) * values.length)];
}
function weighted(state, values) {
    const total = values.reduce((a, b) => a + b.probability, 0);
    if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-8 || values.some(v => v.probability < 0))
        throw new Error('概率分布不合法');
    let ticket = random(state);
    for (const entry of values) {
        ticket -= entry.probability;
        if (ticket < 0)
            return entry.value;
    }
    return values[values.length - 1].value;
}
function sample(state, values, count) {
    if (!Number.isInteger(count) || count < 0 || count > values.length)
        throw new Error('采样数量不合法');
    const bag = [...values];
    for (let i = 0; i < count; i++) {
        const j = i + Math.floor(random(state) * (bag.length - i));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag.slice(0, count);
}
