const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAssetVerifier,serializedRootType,sha256,assertNewReport,writeNewReport}=require('../tools/chapter-asset-proof.cjs');
const imageId='11111111-1111-4111-8111-111111111111',textureId=imageId+'@texture';
const custom=(type,content={})=>[1,0,0,[type],0,[content,-1],[0],0,[],[],[]];
const normal=type=>[1,0,0,[[type,[],3]],[[0,1]],[[0]],0,0,[],[],[]];
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gowaygui-asset-proof-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(file,data)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(data)?data:JSON.stringify(data));};
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const png=fs.readFileSync(path.join(__dirname,'../art-source/ui/panels/candidate-01/panels-atlas.png'));
  const target='game/assets/resources/ui/panels/panels-atlas.png',source='approved/panels.png';
  const file={source,target,sha256:sha256(png),bytes:png.length};
  write(source,png);write(target,png);write('promotion.json',{files:[{...file,destination:target}]});
  write(target+'.meta',{importer:'image',imported:true,uuid:imageId,files:['.json','.png'],subMetas:{texture:{importer:'texture',imported:true,uuid:textureId,userData:{imageUuidOrDatabaseUri:imageId}}}});
  write('game/library/11/'+imageId+'.json',{__type__:'cc.ImageAsset',content:{fmt:'0',w:0,h:0}});
  write('game/library/11/'+imageId+'.png',png);
  write('game/library/11/'+textureId+'.json',{__type__:'cc.Texture2D',content:{mipmaps:[imageId]}});
  const base='game/build/web-mobile/assets/resources/';
  const config={name:'resources',importBase:'import',nativeBase:'native',uuids:[],versions:{import:[],native:[]},paths:{[imageId]:['ui/panels/panels-atlas','cc.ImageAsset',1],[textureId]:['ui/panels/panels-atlas/texture','cc.Texture2D',1]},packs:{}};
  write(base+'config.json',config);write(base+'import/11/'+imageId+'.json',custom('cc.ImageAsset',{fmt:'0',w:0,h:0}));
  write(base+'import/11/'+textureId+'.json',custom('cc.Texture2D',{mipmaps:[imageId]}));
  write(base+'native/11/'+imageId+'.png',png);
  return {root,write,read,file,config,base,png,proof:()=>createAssetVerifier(root).imageAsset(file,'ui/panels/panels-atlas',{width:512,height:1024,bitDepth:8,colorType:6})};
}
test('approved source, actual image/texture imports and bundled native PNG all form separate evidence',t=>{
  const f=fixture(t),v=createAssetVerifier(f.root),promotion=v.promotedFiles('promotion.json'),result=f.proof();
  assert.equal(promotion.files.length,1);assert.equal(result.library.native.sha256,result.bundle.native.sha256);
  assert.equal(result.bundle.image.type,'cc.ImageAsset');assert.equal(result.bundle.texture.import.type,'cc.Texture2D');
  assert.equal(result.dimensions.width,512);assert.equal(result.bundle.native.sha256,promotion.files[0].sha256);
});
test('missing metadata and pre-import metadata cannot pass',t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.root,f.file.target+'.meta'));assert.throws(()=>f.proof(),/ENOENT/);
  f.write(f.file.target+'.meta',{importer:'image',imported:false,uuid:imageId});assert.throws(()=>f.proof(),/already be imported/);
});
test('metadata success cannot replace actual library payload or texture linkage',t=>{
  const f=fixture(t);f.write('game/library/11/'+imageId+'.json',{});assert.throws(()=>f.proof(),/serialized JSON format/);
  f.write('game/library/11/'+imageId+'.json',{__type__:'cc.ImageAsset'});
  f.write('game/library/11/'+textureId+'.json',{__type__:'cc.Texture2D',content:{mipmaps:['another-image']}});
  assert.throws(()=>f.proof(),/must reference this image/);
});
test('an unchanged library cannot hide a stale current-build PNG',t=>{
  const f=fixture(t),bad=Buffer.from(f.png);bad[bad.length-1]^=1;f.write(f.base+'native/11/'+imageId+'.png',bad);
  assert.throws(()=>f.proof(),/current build native must equal approved PNG/);
});
test('an unchanged current build cannot hide a stale library PNG',t=>{
  const f=fixture(t),bad=Buffer.from(f.png);bad[bad.length-1]^=1;f.write('game/library/11/'+imageId+'.png',bad);
  assert.throws(()=>f.proof(),/library native must equal approved PNG/);
});
test('resource name with a different UUID is not package proof',t=>{
  const f=fixture(t);delete f.config.paths[imageId];f.config.paths['old-image']=['ui/panels/panels-atlas','cc.ImageAsset',1];f.write(f.base+'config.json',f.config);
  assert.throws(()=>f.proof(),/exact cc.ImageAsset UUID/);
});
test('matching registration without a real import payload fails',t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.root,f.base+'import/11/'+imageId+'.json'));
  assert.throws(()=>f.proof(),/actual direct import/);
});
test('promoted files accept portrait target key but reject changed source bytes',t=>{
  const f=fixture(t);f.write('promotion.json',{files:[f.file]});assert.equal(createAssetVerifier(f.root).promotedFiles('promotion.json').files[0].target,f.file.target);
  f.write(f.file.source,Buffer.from('changed'));assert.throws(()=>createAssetVerifier(f.root).promotedFiles('promotion.json'),/approved source/);
});
test('packed proof resolves the specific member root, not any class name in the pack',t=>{
  const f=fixture(t),prefabId='22222222-2222-4222-8222-222222222222@scene',otherId='33333333-3333-4333-8333-333333333333@material',packId='abcd12345';
  const shared=[1,0,0,[['cc.Material',[],3],['cc.Prefab',[],3]],[[0,1],[1,1]]];
  const sections=[[[[0]],0,0,[],[],[]],[[[1]],0,0,[],[],[]]];
  f.config.packs[packId]=[otherId,prefabId];f.write(f.base+'config.json',f.config);f.write(f.base+'import/ab/'+packId+'.json',[...shared,sections]);
  const result=createAssetVerifier(f.root).importedAsset(prefabId,'cc.Prefab');assert.equal(result.pack.index,1);
  sections[1][0]=[[0]];f.write(f.base+'import/ab/'+packId+'.json',[...shared,sections]);
  assert.throws(()=>createAssetVerifier(f.root).importedAsset(prefabId,'cc.Prefab'),/payload root type/);
  sections.pop();f.write(f.base+'import/ab/'+packId+'.json',[...shared,sections]);
  assert.throws(()=>createAssetVerifier(f.root).importedAsset(prefabId,'cc.Prefab'),/payload count/);
});
test('homogeneous texture pack proves this member image reference and rejects a wrong neighbor',t=>{
  const f=fixture(t),packId='eeee12345';fs.unlinkSync(path.join(f.root,f.base+'import/11/'+textureId+'.json'));
  f.config.packs[packId]=['other-texture',textureId];f.write(f.base+'config.json',f.config);
  const packed={type:'cc.Texture2D',data:[['2,2,0,0,0,0',['other-image']],['2,2,0,0,0,0',[imageId]]]};
  f.write(f.base+'import/ee/'+packId+'.json',packed);assert.equal(f.proof().bundle.texture.import.pack.index,1);
  packed.data[1][1]=['other-image'];f.write(f.base+'import/ee/'+packId+'.json',packed);
  assert.throws(()=>f.proof(),/Actual built texture must reference this image/);
});
test('home prefab proof checks real renderer mesh references and native geometry',t=>{
  const f=fixture(t),id='44444444-4444-4444-8444-444444444444',scene=id+'@scene',mesh=id+'@mesh',mat=id+'@mat',target='game/assets/resources/environment/home/home.fbx';
  const nodes=[{__type__:'cc.Prefab'},{__type__:'cc.MeshRenderer',_mesh:{__uuid__:mesh},_materials:[{__uuid__:mat}]},{__type__:'cc.Node',_name:'Display_stone',_lpos:{x:1,y:.16,z:2}}];
  f.write(target+'.meta',{importer:'fbx',imported:true,uuid:id,subMetas:{scene:{importer:'gltf-scene',imported:true,uuid:scene},mesh:{importer:'gltf-mesh',imported:true,uuid:mesh,userData:{triangleCount:1}},mat:{name:'Island_atlas.material',importer:'gltf-material',imported:true,uuid:mat}}});
  f.write('game/library/44/'+scene+'.json',nodes);f.write('game/library/44/'+mat+'.json',{__type__:'cc.Material'});
  f.write('game/library/44/'+mesh+'.json',{__type__:'cc.Mesh',_struct:{primitives:[{primitiveMode:7,indexView:{offset:0,length:6,count:3,stride:2}}],vertexBundles:[{view:{offset:6,length:36,count:3,stride:12}}]}});
  f.write('game/library/44/'+mesh+'.bin',Buffer.alloc(42));f.write(f.base+'native/44/'+mesh+'.bin',Buffer.alloc(42));
  f.config.paths[scene]=['environment/home/home/home','cc.Prefab',1];f.write(f.base+'config.json',f.config);
  for(const [uuid,type] of [[scene,'cc.Prefab'],[mesh,'cc.Mesh'],[mat,'cc.Material']])f.write(f.base+'import/44/'+uuid+'.json',normal(type));
  const verify=()=>createAssetVerifier(f.root).prefabAsset({target},'environment/home/home/home',{meshes:1,materials:['Island_atlas'],triangles:1,anchors:[{name:'Display_stone',x:1,y:.16,z:2}]});
  assert.equal(verify().meshes[0].triangles,1);
  f.write(f.base+'native/44/'+mesh+'.bin',Buffer.alloc(42,1));assert.throws(verify,/Built mesh binary/);
  f.write(f.base+'native/44/'+mesh+'.bin',Buffer.alloc(42));nodes[1]._mesh.__uuid__='wrong-mesh';f.write('game/library/44/'+scene+'.json',nodes);
  assert.throws(verify,/reference its actual imported meshes/);
});
test('root decoding supports Creator normal/custom roots and refuses malformed payloads',()=>{
  assert.equal(serializedRootType(normal('cc.Prefab')),'cc.Prefab');assert.equal(serializedRootType(custom('cc.ImageAsset')),'cc.ImageAsset');
  assert.throws(()=>serializedRootType([1,0,0,['cc.Prefab'],0,[],0,0,[],[],[]]),/Missing serialized asset payload/);
});
test('report creation refuses previous results even if a file appears after the early check',t=>{
  const f=fixture(t),output=path.join(f.root,'new-report.json');assertNewReport(output);writeNewReport(output,{first:true});
  const original=fs.readFileSync(output);assert.throws(()=>assertNewReport(output),/new report filename/);
  assert.throws(()=>writeNewReport(output,{first:false}),/EEXIST/);assert.deepEqual(fs.readFileSync(output),original);
});
