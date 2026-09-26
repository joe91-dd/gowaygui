// Verify an actual Cocos build and its imported source assets, never the shared test compilation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),at=p=>path.resolve(root,p.replace(/\\/g,'/'));
const json=p=>JSON.parse(fs.readFileSync(at(p),'utf8').replace(/^\uFEFF/,''));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const plain=v=>JSON.parse(JSON.stringify(v));
const {loadBuiltCore}=require(at('game/tools/test-built-core.cjs'));
const {createAssetVerifier,assertNewReport,writeNewReport}=require(at('game/tools/chapter-asset-proof.cjs'));
function main(output=process.argv[2]){
assertNewReport(output);
const assetVerifier=createAssetVerifier(root);
const loader=loadBuiltCore(),{LEVELS}=loader.load('data');
const {GameService,makeInitialSave}=loader.load('game');
const {MemoryStorage}=loader.load('storage');
const {SaveRepository,SAVE_KEY,BACKUP_KEY,encodeSave,decodeSave}=loader.load('save');
const {createBattle,stepBattle}=loader.load('battle'),{validateBattle}=loader.load('battleValidation');
const expectedSlots=[{x:-5,z:1},{x:-1,z:1},{x:3,z:1},{x:1,z:-3},{x:6.62,z:-1.31}];
assert.deepEqual(plain(LEVELS[4].slots),expectedSlots);
const now=1788840000000,initial=makeInitialSave(now,731);initial.unlockedLevel=4;
const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(initial));
const service=new GameService(new SaveRepository(storage),{now:()=>now});
service.beginRun('build:begin',4,Object.keys(initial.collection));
const first=Object.values(service.snapshot.run.units)[0];service.moveUnit('build:move',first.id,4);
const run=service.snapshot.run,inputs=Object.values(run.units).map(u=>({id:u.id,turtle:u.turtle,slot:u.slot,level:u.level}));
const battle=createBattle(4,1,inputs,{seed:731});service.beginWave('build:wave',run.id,battle);
stepBattle(battle,.375);service.checkpointBattle('build:checkpoint',run.id,battle);
const historical=service.snapshot;Object.assign(historical.run.battle.units[0],{x:6,z:-1});
const expected=plain(historical);Object.assign(expected.run.battle.units[0],expectedSlots[4]);
assert.throws(()=>validateBattle(historical.run.battle),/站位坐标/);
const raw=encodeSave(historical);assert.deepEqual(plain(decodeSave(raw)),expected);
for(const backup of [false,true]){
  const disk=new MemoryStorage();disk.setItem(SAVE_KEY,backup?'broken-primary':raw);
  disk.setItem(BACKUP_KEY,backup?raw:encodeSave(initial));
  const before=plain(disk.values),repo=new SaveRepository(disk),restored=new GameService(repo,{now:()=>now});
  assert.deepEqual(plain(disk.values),before,'decode must not write');
  assert.deepEqual(plain(restored.snapshot),expected);assert.equal(repo.recoveredFromBackup,backup);
  restored.checkpointBattle('build:resume',run.id,restored.snapshot.run.battle);
  assert.deepEqual(plain(decodeSave(disk.getItem(SAVE_KEY)).run.battle),expected.run.battle);
}
const specs=[
  {id:'leaf',slug:'leaf-turtle',manifest:'game/art-source/leaf-turtle/candidate-04/runtime-candidate/promotion.json',triangles:29560,meshes:1,materials:['LeafAtlas_01'],rig:'LeafTurtle_Rig',clips:{idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30}},
  {id:'bubble',slug:'bubble-turtle',manifest:'game/art-source/bubble-turtle/runtime-promotion.json',triangles:29604,meshes:1,materials:['BubbleAtlas_01'],rig:'BubbleTurtle_Rig',clips:{idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30}},
  {id:'boss',slug:'giant-claw',manifest:'game/art-source/enemies/giant-claw/rigged/runtime-candidate/promotion-manifest.json',triangles:21208,meshes:1,materials:['GiantClaw_Toy_Atlas'],rig:'GiantClaw_Rig',clips:{idle:2.8,walk:1.2,attack:.5,hit:.5,exit:1.2}},
  {id:'bossBay',slug:'boss-bay',manifest:'game/art-source/environment/boss-bay/candidate-02/promotion-manifest.json',triangles:55128,meshes:3,materials:['Island_atlas','Warm_pearl_and_lamps'],clips:{}},
  {id:'homeIsland',slug:'home-island',manifest:'game/art-source/environment/home-island/candidate-02/promotion-manifest.json',triangles:38988,meshes:3,materials:['Island_atlas','Warm_pearl_and_lamps'],clips:{}},
];
const assets=specs.map(spec=>{
  const {manifest,files,manifestEvidence}=assetVerifier.promotedFiles(spec.manifest);
  assert.equal(files.length,3);
  const fbx=files.find(f=>f.target.endsWith('.fbx')),meta=json(fbx.target+'.meta');
  assert.equal(meta.importer,'fbx');assert.equal(meta.imported,true);
  const sub=Object.values(meta.subMetas),of=type=>sub.filter(s=>s.importer===type);
  const meshes=of('gltf-mesh').map(s=>({name:s.name,triangles:s.userData.triangleCount}));
  assert.equal(meshes.length,spec.meshes);assert.equal(meshes.reduce((n,m)=>n+m.triangles,0),spec.triangles);
  const materials=of('gltf-material').map(s=>s.name.replace(/\.material$/,''));
  assert.deepEqual(materials.sort(),[...spec.materials].sort());
  const prefabs=of('gltf-scene').map(s=>({name:s.name,uuid:s.uuid}));assert.equal(prefabs.length,1);
  const clips=of('gltf-animation').map(s=>({name:s.name,duration:s.userData.span.to-s.userData.span.from}));
  assert.equal(clips.length,Object.keys(spec.clips).length);
  for(const [name,duration] of Object.entries(spec.clips)){
    const clip=clips.find(c=>c.name===spec.rig+'|'+name+'.animation');assert.ok(clip,name);
    assert.ok(Math.abs(clip.duration-duration)<1e-6,name+' duration');
  }
  const extra={};
  if(spec.id==='homeIsland'){
    assert.equal(manifest.expectedResourcesPrefabPath,'environment/home-island/home-island/home-island');
    extra.importAndBundleProof=assetVerifier.prefabAsset(fbx,manifest.expectedResourcesPrefabPath,{...spec,anchors:manifest.displayAnchors});
    extra.textureProofs=files.filter(file=>file.target.endsWith('.png')).map(file=>assetVerifier.imageAsset(file,file.target.replace(/^game\/assets\/resources\//,'').replace(/\.png$/,'')));
    assert.equal(extra.textureProofs.length,2);
  }
  return {id:spec.id,manifest:spec.manifest,manifestEvidence,files,uuid:meta.uuid,meshes,materials,prefabs,clips,...extra};
});
const uiSpecs=[
  {id:'panels',manifest:'game/art-source/ui/panels/runtime-promotion.json',names:['panels-atlas'],prefix:'ui/panels'},
  {id:'portraits',manifest:'game/art-source/ui/portraits/runtime-promotion.json',names:['portrait-stone','portrait-spike','portrait-crystal','portrait-leaf','portrait-bubble'],prefix:'ui/portraits',width:384,height:384},
];
const uiAssets=uiSpecs.map(spec=>{
  const {manifest,files,manifestEvidence}=assetVerifier.promotedFiles(spec.manifest);
  const width=spec.width??manifest.width,height=spec.height??manifest.height;
  assert.ok(Number.isInteger(width)&&width>0&&Number.isInteger(height)&&height>0,'Promotion must specify positive PNG dimensions');
  assert.deepEqual(files.map(file=>path.basename(file.target,'.png')).sort(),[...spec.names].sort());
  return {id:spec.id,manifest:spec.manifest,manifestEvidence,images:files.map(file=>{
    const resourcePath=spec.prefix+'/'+path.basename(file.target,'.png');
    assert.equal(file.target,'game/assets/resources/'+resourcePath+'.png');
    if(file.resourcePath)assert.equal(file.resourcePath,resourcePath);
    return assetVerifier.imageAsset(file,resourcePath,{width,height,bitDepth:8,colorType:6});
  })};
});
assert.equal(uiAssets.reduce((sum,group)=>sum+group.images.length,0),6);
const report={generatedAt:new Date().toISOString(),status:'passed',
  scope:'Actual built fifth-level coordinates and one-unit primary/backup legacy-layout recovery, approved model bytes and Cocos FBX metadata. Home c02 additionally checks the real library prefab, its mesh/material references, native geometry, five anchors and exact resources pack entries; home textures and six UI PNGs check actual image/texture imports and approved native bytes in this build. Full compatibility is separately tested.',
  evidenceBoundary:{approvedBytes:true,cocosImport:true,currentBundlePackaging:true,browserLoaded:'not tested by this offline verifier',browserVisible:'requires separate actual browser review',performance:'not tested',audio:'not tested',chapterCompletion:'not tested',note:'No asset success is inferred from compiled source strings. Home/PNG packaging proof reads UUID registration plus the specific import payload and native files; it does not instantiate or display them.'},
  verifierFiles:['docs/reports/verify-chapter-build.cjs','game/tools/chapter-asset-proof.cjs'].map(file=>{const bytes=fs.readFileSync(at(file));return {path:file,bytes:bytes.length,sha256:hash(bytes)};}),
  loadedFiles:loader.loadedFiles,resourcesBundleConfig:assetVerifier.bundleConfig,bossSlots:plain(LEVELS[4].slots),recovery:{tick:battle.tick,balanceVersion:battle.balanceVersion,primary:true,backup:true,readWrites:0},assets,uiAssets};
writeNewReport(output,report);
console.log(JSON.stringify({status:report.status,recovery:report.recovery,assets:assets.map(a=>({id:a.id,prefab:a.prefabs[0].uuid,triangles:a.meshes.reduce((n,m)=>n+m.triangles,0),clips:a.clips.length})),uiImages:uiAssets.flatMap(group=>group.images.map(file=>({id:path.basename(file.target,'.png'),uuid:file.uuid,sha256:file.sha256}))),evidenceBoundary:report.evidenceBoundary},null,2));
return report;
}
module.exports={main};
if(require.main===module)main();
