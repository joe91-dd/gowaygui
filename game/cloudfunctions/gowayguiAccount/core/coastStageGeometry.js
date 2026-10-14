"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COAST_PATH_PIXELS = exports.COAST_DEPTH = exports.COAST_ART = void 0;
exports.coastPoint = coastPoint;
exports.coastPixel = coastPixel;
exports.isCoastStage = isCoastStage;
exports.coastGroundIssue = coastGroundIssue;
exports.applyCoastStage = applyCoastStage;
const sceneGeometryData_1 = require("./sceneGeometryData");
const sceneGeometry_1 = require("./sceneGeometry");
const coralStageGeometry_1 = require("./coralStageGeometry");
const bambooStageGeometry_1 = require("./bambooStageGeometry");
const chapterStageGeometry_1 = require("./chapterStageGeometry");
/** Pixel registration for all fifty 1688 x 932 campaign paintings.
 * Camera (0,20,12): compensate its ground-plane foreshortening exactly once.
 * Rendering, navigation and free placement all use this transform. */
exports.COAST_ART = { width: 1688, height: 932, worldWidth: 18, cameraSlope: 12 / 20, floor: .045 };
exports.COAST_DEPTH = 18 * 932 / 1688 * Math.sqrt(1 + exports.COAST_ART.cameraSlope * exports.COAST_ART.cameraSlope);
function coastPoint(x, y) { return { x: (x / 1688 - .5) * 18, z: (y / 932 - .5) * exports.COAST_DEPTH + exports.COAST_ART.floor * exports.COAST_ART.cameraSlope }; }
function coastPixel(p) { return { x: (p.x / 18 + .5) * 1688, y: ((p.z - exports.COAST_ART.floor * exports.COAST_ART.cameraSlope) / exports.COAST_DEPTH + .5) * 932 }; }
exports.COAST_PATH_PIXELS = sceneGeometryData_1.SCENE_GEOMETRY_DATA.slice(0, 50).map(g => g.routes.map(r => r.map(([x, y]) => [x * 1688 / 560, y * 932 / 310])));
function isCoastStage(m) { return m.id >= 0 && m.id < 50 && m.sceneArt === `map-coast-stage-${m.id + 1}`; }
function coastGroundIssue(id, p) { return (0, sceneGeometry_1.sceneGroundIssue)(id, p); }
function applyCoastStage(m) {
    const routes = exports.COAST_PATH_PIXELS[m.id].map(r => r.map(([x, y]) => coastPoint(x, y)));
    const slots = (0, sceneGeometry_1.sceneSlots)(m.id);
    const chapter = m.id < 5 ? {} : m.id < 10 ? { name: `珊瑚潮汐${m.id - 4}`, subtitle: coralStageGeometry_1.CORAL_SUBTITLES[m.id - 5] } : m.id < 15 ? { name: `翠竹长湾${m.id - 9}`, subtitle: bambooStageGeometry_1.BAMBOO_SUBTITLES[m.id - 10] } : { name: `${chapterStageGeometry_1.CHAPTER_SUBTITLES[Math.floor((m.id - 15) / 5)]}${(m.id - 15) % 5 + 1}`, subtitle: chapterStageGeometry_1.CHAPTER_SUBTITLES[Math.floor((m.id - 15) / 5)] + ' · 路线递进' };
    const labels = routes.length > 1 ? (m.id === 9 ? ['回礁长路', '北潮短路'] : m.id === 10 ? ['上环潮线', '下环潮线'] : m.id === 11 ? ['西北潮线', '西南潮线', '北潮线'] : m.id === 13 ? ['西北线', '西南线', '北线', '南线'] : routes.map((_, i) => `第${i + 1}路`)) : undefined;
    return { ...m, ...chapter, layoutVersion: 2, stationVersion: 6, sceneRevision: sceneGeometry_1.SCENE_REVISION, route: routes[0], routes: routes.length > 1 ? routes : undefined, routeLabels: labels, slots, sceneArt: `map-coast-stage-${m.id + 1}`, sceneMirror: false };
}
