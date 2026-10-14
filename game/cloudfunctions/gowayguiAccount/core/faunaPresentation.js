"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORLD_VISUALS = exports.BOSS_VISUALS = void 0;
exports.bossVisualKey = bossVisualKey;
exports.worldVisualKey = worldVisualKey;
exports.faunaVisual = faunaVisual;
exports.faunaBase = faunaBase;
const faunaCatalog_1 = require("./faunaCatalog");
const bossCatalog_1 = require("./bossCatalog");
const enemyG1Catalog_1 = require("./enemyG1Catalog");
/** One approved base mesh per species; grade materials are selected per actor. */
exports.BOSS_VISUALS = bossCatalog_1.BOSSES.map(b => ({ key: (0, enemyG1Catalog_1.enemyG1)(b.assetId).key, height: 2, ability: b.ability }));
exports.WORLD_VISUALS = Array.from({ length: 4 }, (_, i) => ({ key: (0, enemyG1Catalog_1.worldG1)(i).key, height: 2, ability: (0, enemyG1Catalog_1.worldG1)(i).effect }));
function bossVisualKey(index) { return exports.BOSS_VISUALS[Math.max(0, index) % exports.BOSS_VISUALS.length].key; }
function worldVisualKey(index) { return (0, enemyG1Catalog_1.worldG1)(index).key; }
function faunaVisual(key) { return (0, enemyG1Catalog_1.enemyG1)(key) ?? faunaCatalog_1.FAUNA_MODELS.find(m => m.key === key); }
function faunaBase(key) { const approved = (0, enemyG1Catalog_1.enemyG1)(key); return approved ? { ...approved, sourceName: approved.name } : faunaCatalog_1.FAUNA_MODELS.find(m => m.key === key); }
