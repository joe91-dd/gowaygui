"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulationHypot = simulationHypot;
exports.simulationPow = simulationPow;
exports.simulationSin = simulationSin;
exports.simulationCos = simulationCos;
exports.simulationTan = simulationTan;
exports.simulationExp = simulationExp;
/** Simulation-only arithmetic shared by the phone and authoritative replay.
 * Native libm hypot/pow/trigonometry may differ by one ULP between V8 and JSC.
 * Keep a fixed sequence of IEEE-754 operations; never patch the global Math object.
 * Inputs here are finite game coordinates, safe integer powers, angles within
 * +/- 1e6 radians and exp arguments within +/- 64 (fusion uses [-32, 0]).
 * Trig uses range reduction to [-PI/2, PI/2] and 12 Taylor terms: truncation
 * error is below 4e-22. Exp uses |remainder| <= ln(2)/2 and 20 terms.
 * Floating rounding, rather than truncation, dominates; regression tests cover
 * every shipped map, spawn scale and fusion probability against the prior math.
 * This defines derived values only. Stored stats, inputs, RNG and replay results
 * retain their original precision and must still pass exact server comparison.
 */
const PI = Math.PI, HALF_PI = PI / 2, TAU = PI * 2, LN2 = 0.6931471805599453;
/** Game coordinates cannot approach IEEE overflow/underflow; two dimensions only. */
function simulationHypot(x, y) { return Math.sqrt(x * x + y * y); }
function simulationPow(base, exponent) {
    if (!Number.isFinite(base) || !Number.isSafeInteger(exponent))
        throw Error('确定性幂运算参数无效');
    let n = Math.abs(exponent), factor = base, result = 1;
    while (n > 0) {
        if (n % 2 === 1)
            result *= factor;
        n = Math.floor(n / 2);
        if (n)
            factor *= factor;
    }
    return exponent < 0 ? 1 / result : result;
}
function reducedAngle(angle) {
    if (!Number.isFinite(angle) || Math.abs(angle) > 1e6)
        throw Error('确定性角度超出范围');
    let x = angle % TAU;
    if (x > PI)
        x -= TAU;
    else if (x < -PI)
        x += TAU;
    return x;
}
function simulationSin(angle) {
    let x = reducedAngle(angle);
    if (x > HALF_PI)
        x = PI - x;
    else if (x < -HALF_PI)
        x = -PI - x;
    const square = x * x;
    let term = x, result = x;
    for (let n = 1; n <= 12; n++) {
        term *= -square / ((2 * n) * (2 * n + 1));
        result += term;
    }
    return result;
}
function simulationCos(angle) {
    let x = Math.abs(reducedAngle(angle)), sign = 1;
    if (x > HALF_PI) {
        x = PI - x;
        sign = -1;
    }
    const square = x * x;
    let term = 1, result = 1;
    for (let n = 1; n <= 12; n++) {
        term *= -square / ((2 * n - 1) * (2 * n));
        result += term;
    }
    return sign * result;
}
/** Combat fans are 36 or 55 degrees, safely away from the tangent poles. */
function simulationTan(angle) { return simulationSin(angle) / simulationCos(angle); }
function simulationExp(value) {
    if (!Number.isFinite(value) || Math.abs(value) > 64)
        throw Error('确定性指数超出范围');
    const power = Math.round(value / LN2), remainder = value - power * LN2;
    let term = 1, result = 1;
    for (let n = 1; n <= 20; n++) {
        term *= remainder / n;
        result += term;
    }
    return result * simulationPow(2, power);
}
