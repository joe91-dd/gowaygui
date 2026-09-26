'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../build/map-themes-20260920');
const built=require('./test-built-core.cjs').loadBuiltCore(root);
const {BATTLE_MAPS}=built.load('data'),source=require('../.test-build/core/data.js');
assert.deepEqual(JSON.parse(JSON.stringify(BATTLE_MAPS)),source.BATTLE_MAPS,'built maps must exactly match current verified source');
const {placementIssue}=built.load('placement'),{battleThemeIndex}=built.load('battleThemes');
for(const m of BATTLE_MAPS){assert.equal(m.layoutVersion,2);assert.equal(m.stationVersion,6);for(const [i,p] of m.slots.entries())assert.equal(placementIssue(m,p,m.slots.filter((_,j)=>i!==j)),undefined);}
assert.equal(new Set([0,1,2,3].map(b=>battleThemeIndex(56,1,b))).size,4);
assert.equal(new Set([1,6,11,16,21].map(w=>battleThemeIndex(50,w))).size,5);
const config=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/config.json'),'utf8'));
const paths=Object.values(config.paths).map(x=>x[0]);
for(const name of ['map-atlas-coasts','map-atlas-islands','map-atlas-adventures','map-atlas-challenges','map-atlas-bosses','map-atlas-endless','map-guardian-pearl'])assert.ok(paths.includes('art-modern/'+name),name+' must be in the actual resource bundle');
const main=fs.readFileSync(path.join(root,'assets/main/index.js'),'utf8');
for(const marker of ['map-guardian-pearl','themeWave','ThemedBattleTerrain','ROAD_PLACEMENT_CLEARANCE'])assert.ok(main.includes(marker),marker+' must be in the compiled game');
console.log('Built theme validation passed: 57 maps, 4 world-boss themes, 5 endless themes, 7 new image assets, matching current source.');
