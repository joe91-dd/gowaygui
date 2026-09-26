const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'game/assets/scripts');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports:mod.exports,module:mod,require:n=>load(path.resolve(path.dirname(file),n+'.ts'))},{filename:file});return mod.exports;}
const catalog=load(dir+'/core/enemyG1Catalog.ts');
test('54 boss entries and four world entries reuse the approved 20-character series',()=>{
 const p=load(dir+'/core/faunaPresentation.ts');assert.equal(catalog.ENEMY_G1.length,20);assert.equal(p.BOSS_VISUALS.length,54);assert.equal(p.WORLD_VISUALS.length,4);
 for(const v of [...p.BOSS_VISUALS,...p.WORLD_VISUALS]){assert.ok(catalog.ENEMY_G1.some(x=>x.key===v.key));assert.ok(p.faunaVisual(v.key).height>0);}
 assert.equal(new Set(p.BOSS_VISUALS.slice(0,50).map(v=>v.key)).size,10);
 assert.equal(new Set(p.WORLD_VISUALS.map(v=>v.key)).size,4);
});
test('every installed FBX is the exact file verified through independent Blender import',()=>{
 for(const v of catalog.ENEMY_G1){
  const key=v.id.toLowerCase(),folder=path.join(root,'output/enemy-g1-production-20260917');
  const fbx=fs.readFileSync(path.join(root,'game/assets/resources/models-enemy-g1',key,key+'.fbx'));
  assert.match(fbx.subarray(0,23).toString(),/Kaydara FBX Binary/);
  const verify=JSON.parse(fs.readFileSync(path.join(folder,'inspection',v.id,'fbx-verification.json')));
  assert.equal(crypto.createHash('sha256').update(fbx).digest('hex'),verify.fbxSha256,v.id+' stale runtime asset');
  assert.ok(verify.bones>=5,v.id);
  for(const name of ['idle','walk','attack','skill','hit','exit'])assert.ok(verify.clips[name].maxDisplacement>.001,v.id+' '+name);
  const meta=JSON.parse(fs.readFileSync(path.join(root,'game/assets/resources/models-enemy-g1',key,key+'.fbx.meta')));
  assert.ok(Object.values(meta.subMetas).some(m=>m.importer==='gltf-scene'),v.id+' Cocos prefab import');
 }
});
test('all approved icons have real PNG dimensions and every boss entry names an approved source',()=>{
 const {BOSSES}=load(dir+'/core/bossCatalog.ts');
 for(const v of catalog.ENEMY_G1){
  const b=fs.readFileSync(path.join(root,'game/assets/resources',v.icon+'.png'));
  assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.readUInt32BE(16)>=512&&b.readUInt32BE(20)>=512);
 }
 for(const b of BOSSES)assert.ok(catalog.ENEMY_G1.some(v=>v.id===b.assetId));
});
