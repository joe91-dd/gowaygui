"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coastPoint = void 0;
exports.approvedCoast = approvedCoast;
/** Coordinates authored against the approved 1672 x 941 environment, never inferred from decoration. */
const coastPoint = (x, y) => ({ x: x / 1672 * 18 - 9, z: y / 941 * 10.13 - 5.065 });
exports.coastPoint = coastPoint;
function approvedCoast(levels) { return levels.map(m => m.id !== 0 ? m : { ...m, stationVersion: 3 }); }
