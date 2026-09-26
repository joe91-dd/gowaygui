const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'game/assets/scripts');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports:mod.exports,module:mod,require:n=>load(path.resolve(path.dirname(file),n+'.ts'))},{filename:file});return mod.exports;}
test('all species remain and all 53 bosses have independent coherent visual assets',()=>{
 const {FAUNA_MODELS}=load(dir+'/core/faunaCatalog.ts'),p=load(dir+'/core/faunaPresentation.ts');
 assert.equal(FAUNA_MODELS.length,59);assert.equal(p.BOSS_VISUALS.length,48);assert.equal(p.WORLD_VISUALS.length,5);
 const all=[...FAUNA_MODELS,...p.BOSS_VISUALS,...p.WORLD_VISUALS];assert.equal(new Set(all.map(v=>v.key)).size,112);
 for(const v of all){assert.ok(p.faunaBase(v.key));assert.ok(p.faunaVisual(v.key).height>0);}
 for(let i=0;i<48;i++)assert.equal(p.bossVisualKey(i),p.BOSS_VISUALS[i].key);
 for(let i=0;i<5;i++)assert.equal(p.worldVisualKey(i),p.WORLD_VISUALS[i].key);
 assert.equal(p.faunaBase('boss-03').key,'fauna-58');
});
test('all installed assets contain animation and use at most two draw materials',()=>{
 const p=load(dir+'/core/faunaPresentation.ts'),{FAUNA_MODELS}=load(dir+'/core/faunaCatalog.ts');
 for(const v of [...FAUNA_MODELS,...p.BOSS_VISUALS,...p.WORLD_VISUALS]){
  const folder=path.join(root,'game/assets/resources/models-fauna',v.key),m=JSON.parse(fs.readFileSync(folder+'/license-and-source.json','utf8'));
  assert.equal(m.artVersion,2,v.key);assert.ok(m.drawMaterials<=2,v.key);assert.match(m.license,/CC0/);
  for(const clip of ['idle','walk','attack','skill','exit'])assert.ok(m.clips.includes(clip),v.key+' '+clip);
  for(const suffix of ['.fbx','_albedo.png'])assert.ok(fs.statSync(path.join(folder,v.key+suffix)).size>100,v.key+suffix);
 }
});
test('codex atlases have a tile for every enemy and boss',()=>{
 const size=name=>{const b=fs.readFileSync(path.join(root,'game/assets/resources/art-modern',name+'.png'));return [b.readUInt32BE(16),b.readUInt32BE(20)];};
 assert.deepEqual(size('fauna-roster'),[2048,2048]);assert.deepEqual(size('boss-finished-roster'),[2048,1536]);assert.deepEqual(size('world-finished-roster'),[1920,384]);
});
