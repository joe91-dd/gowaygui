"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAUNA_AURAS = void 0;
exports.faunaAuraGrade = faunaAuraGrade;
const enemyG1Catalog_1 = require("./enemyG1Catalog");
exports.FAUNA_AURAS = [
    { name: '碧焰', color: '#4DACEB', highlight: '#DDFBFF' },
    { name: '紫潮', color: '#AC77DD', highlight: '#F1DEFF' },
    { name: '橙焰', color: '#E79A48', highlight: '#FFF0CA' },
    { name: '赤潮', color: '#DE6456', highlight: '#FFE9DD' },
    { name: '鎏金', color: '#EAC254', highlight: '#FFF5D6' },
];
function faunaAuraGrade(kind, level = 0, bossTier, world = false, wave = 1) {
    if (world)
        return 4;
    if (bossTier !== undefined)
        return Math.max(0, Math.min(4, Math.floor(bossTier)));
    return kind === 'elite' ? (0, enemyG1Catalog_1.enemyG1Grade)(level, wave) : 0;
}
