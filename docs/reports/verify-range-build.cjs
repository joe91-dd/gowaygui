// Run after a fresh Cocos build. Reads actual built modules and importer metadata.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {loadBuiltCore}=require(path.join(root,'game/tools/test-built-core.cjs'));
const loader=loadBuiltCore(),{createBattle,stepBattle,getBattleEvents,BATTLE_RULES}=loader.load('battle');
const {ROLES}=loader.load('data'),{makeInitialSave}=loader.load('game');
const plain=v=>JSON.parse(JSON.stringify(v));
const ranges=Object.fromEntries(Object.entries(ROLES).map(([id,value])=>[id,value.range]));
assert.deepEqual(ranges,{stone:1.2,spike:4.8,crystal:4.6,leaf:4.5,bubble:4.6});
assert.equal(BATTLE_RULES.shareRange,4.5);assert.equal(BATTLE_RULES.encourageRange,4.5);
const save=makeInitialSave(1788840000000,731);
const inputs=['stone','crystal'].map((role,slot)=>({id:role,slot,level:1,turtle:Object.values(save.collection).find(t=>t.role===role)}));
const battle=createBattle(3,2,inputs,{seed:20260908}),events=[];
assert.equal(battle.balanceVersion,2);
let blocked;
while(battle.tick<80&&!blocked){stepBattle(battle,.05);events.push(...getBattleEvents(battle));blocked=battle.enemies.find(e=>e.alive&&e.blockedBy==='stone');}
assert.ok(blocked);assert.equal(battle.tick,47);
const direct=events.find(e=>e.type==='damage'&&e.sourceId==='crystal'&&e.targetId===blocked.id&&!e.secondary);
assert.ok(direct&&direct.amount>0);
const manifestPath='game/art-source/enemies/shell-carrier/candidate-02/promotion-manifest.json';
const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
const files=manifest.runtime_files.map(file=>{
  const bytes=fs.readFileSync(path.join(root,file.path)),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256,file.sha256,file.path);assert.equal(bytes.length,file.bytes);return {path:file.path,sha256,bytes:bytes.length};
});
const fbx=files.find(file=>file.path.endsWith('.fbx')),meta=JSON.parse(fs.readFileSync(path.join(root,fbx.path+'.meta'),'utf8'));
assert.equal(meta.importer,'fbx');assert.equal(meta.imported,true);
const sub=Object.values(meta.subMetas),of=kind=>sub.filter(x=>x.importer===kind);
const meshes=of('gltf-mesh').map(x=>({name:x.name,triangles:x.userData.triangleCount}));
const clips=of('gltf-animation').map(x=>({name:x.name,span:x.userData.span}));
const materials=of('gltf-material').map(x=>x.name),prefabs=of('gltf-scene').map(x=>({uuid:x.uuid,name:x.name}));
assert.equal(meshes.reduce((sum,x)=>sum+x.triangles,0),15088);assert.equal(materials.length,1);assert.equal(prefabs.length,1);
for(const [name,duration] of Object.entries({idle:2.8,walk:32/30,attack:1.3,hit:.6,exit:1.1})){
  const clip=clips.find(x=>x.name==='ShellCarrier_Rig|'+name+'.animation');assert.ok(clip,name);
  assert.ok(Math.abs(clip.span.to-clip.span.from-duration)<1e-6,name+' imported duration');
}
assert.equal(clips.length,5);
const report={generatedAt:new Date().toISOString(),status:'passed',scope:'Actual built JavaScript opening-contact check and actual Cocos elite import. Does not verify browser visuals, audio, full chapter or performance.',
  loadedFiles:loader.loadedFiles,ranges,supportRanges:{encourage:BATTLE_RULES.encourageRange,share:BATTLE_RULES.shareRange},
  opening:{balanceVersion:battle.balanceVersion,tick:battle.tick,blocked:plain(blocked),crystalDirectDamage:plain(direct)},
  elite:{manifest:manifestPath,files,uuid:meta.uuid,meshes,clips,materials,prefabs}};
const output=process.argv[2];if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,openingTick:battle.tick,crystalDirectDamage:direct.amount,eliteTriangles:15088,elitePrefab:prefabs[0].uuid},null,2));
