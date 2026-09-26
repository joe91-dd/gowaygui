// Read-only proof for Creator 3.8 debug JSON bundles. This does not instantiate assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const pngInfo=bytes=>{
  assert.ok(bytes.length>33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Expected a nonempty PNG');
  assert.equal(bytes.toString('ascii',12,16),'IHDR');
  const result={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bitDepth:bytes[24],colorType:bytes[25]};
  assert.ok(result.width>0&&result.height>0,'PNG dimensions must be positive');
  return result;
};

// Creator's deserialize.ts File layout / parseInstances / unpackJSONs, read without
// constructing engine objects. Packed sections share fields 0..4; root type comes
// from THIS section's root instance, never a string match in the shared class table.
function serializedRoot(data){
  if(data&&!Array.isArray(data)&&typeof data.__type__==='string')return {type:data.__type__,content:data.content||data};
  if(Array.isArray(data)&&data[0]&&typeof data[0].__type__==='string')return {type:data[0].__type__,content:data[0].content||data[0]};
  assert.ok(Array.isArray(data)&&data.length===11&&data[0]===1,'Unsupported Creator serialized JSON format');
  const classes=data[3],masks=data[4],instances=data[5],types=data[6]===0?[]:data[6];
  assert.ok(Array.isArray(classes)&&Array.isArray(instances)&&instances.length&&Array.isArray(types),'Missing serialized asset payload');
  const marker=instances.at(-1),hasMarker=typeof marker==='number';
  const rootIndex=hasMarker?(marker<0?~marker:marker):0;
  const count=instances.length-(hasMarker?1:0),normalCount=count-types.length;
  assert.ok(Number.isInteger(rootIndex)&&rootIndex>=0&&rootIndex<count&&normalCount>=0,'Invalid serialized root index');
  let classIndex;
  if(rootIndex<normalCount){
    const instance=instances[rootIndex],mask=Array.isArray(instance)&&masks[instance[0]];
    assert.ok(Array.isArray(mask),'Missing serialized root mask');classIndex=mask[0];
  }else{
    classIndex=types[rootIndex-normalCount];
    assert.ok(Number.isInteger(classIndex)&&classIndex>=0,'Root is not a serialized Cocos asset');
  }
  const declaration=classes[classIndex],type=Array.isArray(declaration)?declaration[0]:declaration;
  assert.equal(typeof type,'string','Missing serialized root class');return {type,content:instances[rootIndex]};
}
const serializedRootType=data=>serializedRoot(data).type;

function assertNewReport(output){
  if(output&&fs.existsSync(path.resolve(output)))throw new Error('Use a new report filename to preserve historical evidence');
}
function writeNewReport(output,report){
  if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}

function createAssetVerifier(root,buildDir=path.join(root,'game/build/web-mobile')){
  const at=p=>path.resolve(root,p),relative=p=>path.relative(root,p).replace(/\\/g,'/');
  const evidence=file=>{
    const bytes=fs.readFileSync(file);assert.ok(bytes.length>0,relative(file)+' must not be empty');
    return {path:relative(file),bytes:bytes.length,sha256:sha256(bytes)};
  };
  const configFile=path.join(buildDir,'assets/resources/config.json'),config=readJson(configFile);
  assert.equal(config.name,'resources','Expected actual resources bundle config');
  const base=path.dirname(configFile),uuid=id=>typeof id==='number'?config.uuids[id]:id;
  const libraryFile=(id,ext='.json')=>at('game/library/'+id.slice(0,2)+'/'+id+ext);
  function bundleFile(kind,id,ext){
    const versions=config.versions?.[kind]||[];let version;
    for(let i=0;i<versions.length;i+=2)if(uuid(versions[i])===id)version=versions[i+1];
    return path.join(base,config[kind+'Base']||kind,id.slice(0,2),id+(version?'.'+version:'')+ext);
  }
  function registration(resourcePath,id,type){
    const found=Object.entries(config.paths||{}).filter(([key,value])=>{
      const resolved=/^\d+$/.test(key)?uuid(Number(key)):key;
      return resolved===id&&value[0]===resourcePath&&(typeof value[1]==='number'?config.types?.[value[1]]:value[1])===type;
    });
    assert.equal(found.length,1,resourcePath+' must register the exact '+type+' UUID in THIS build');
    return {resourcePath,uuid:id,type,configKey:found[0][0]};
  }
  function importedAsset(id,type){
    const direct=bundleFile('import',id,'.json');let document,artifact,pack;
    if(fs.existsSync(direct)){document=readJson(direct);artifact=evidence(direct);}
    else{
      const entries=Object.entries(config.packs||{}).filter(([,members])=>members.some(member=>uuid(member)===id));
      assert.equal(entries.length,1,id+' requires an actual direct import or exactly one registered pack');
      const [packId,members]=entries[0],index=members.findIndex(member=>uuid(member)===id),file=bundleFile('import',packId,'.json');
      const packed=readJson(file);
      if(Array.isArray(packed)){
        assert.ok(packed.length===6&&Array.isArray(packed[5]),'Unsupported or empty Creator JSON pack');
        assert.equal(packed[5].length,members.length,'Pack payload count must match its registered members');
        assert.ok(Array.isArray(packed[5][index]),'Registered pack member has no payload');
        document=[...packed.slice(0,5),...packed[5][index]];
      }else{
        // pack-manager.ts also has homogeneous texture/image JSON packs.
        assert.ok(['cc.Texture2D','cc.ImageAsset'].includes(packed?.type)&&Array.isArray(packed.data),'Unsupported Creator homogeneous pack');
        assert.equal(packed.data.length,members.length,'Pack payload count must match its registered members');
        if(packed.type==='cc.Texture2D'){
          const item=packed.data[index];assert.ok(Array.isArray(item)&&typeof item[0]==='string'&&Array.isArray(item[1]),'Missing packed texture data');
          document={__type__:'cc.Texture2D',content:{base:item[0],mipmaps:item[1]}};
        }else document=packed.data[index];
      }
      artifact=evidence(file);pack={id:packId,index,members:members.length};
    }
    const parsed=serializedRoot(document);assert.equal(parsed.type,type,id+' imported payload root type');
    const imageUuids=type==='cc.Texture2D'?parsed.content?.mipmaps:undefined;
    if(type==='cc.Texture2D')assert.ok(Array.isArray(imageUuids)&&imageUuids.length>0,'Built texture has no image references');
    return {uuid:id,type:parsed.type,artifact,...(pack?{pack}:{}),...(imageUuids?{imageUuids}:{})};
  }
  function libraryAsset(id,type){
    const file=libraryFile(id),document=readJson(file);assert.equal(serializedRootType(document),type,id+' actual library root type');
    return {document,evidence:evidence(file)};
  }
  function promotedFiles(manifestPath){
    const manifest=readJson(at(manifestPath)),entries=manifest.runtime_files||manifest.files;
    assert.ok(Array.isArray(entries)&&entries.length,'Promotion requires nonempty files');
    const files=entries.map(entry=>{
      const source=entry.source||entry.source_path,target=entry.destination||entry.target||entry.path;
      assert.ok(source&&target,'Promotion requires source and destination');
      const original=fs.readFileSync(at(source)),bytes=fs.readFileSync(at(target));
      assert.ok(original.equals(bytes),target+' must equal the approved source');
      assert.equal(sha256(bytes),entry.sha256,target+' approved SHA');assert.equal(bytes.length,entry.bytes,target+' approved size');
      return {source,target,sha256:entry.sha256,bytes:bytes.length,...(entry.resourcePath?{resourcePath:entry.resourcePath}:{})};
    });
    assert.equal(new Set(files.map(f=>f.target)).size,files.length,'Promotion targets must be distinct');
    return {manifest,files,manifestEvidence:evidence(at(manifestPath))};
  }
  function imageAsset(file,resourcePath,expected){
    const sourceBytes=fs.readFileSync(at(file.target)),dimensions=pngInfo(sourceBytes);
    if(expected)for(const [key,value] of Object.entries(expected))assert.equal(dimensions[key],value,file.target+' '+key);
    const metaPath=at(file.target+'.meta'),meta=readJson(metaPath);
    assert.equal(meta.importer,'image',file.target+' image importer');assert.equal(meta.imported,true,file.target+' must already be imported by Cocos');
    assert.ok(typeof meta.uuid==='string'&&meta.uuid.length>20,'Missing actual image UUID');
    assert.ok(meta.files?.includes('.png')&&meta.files?.includes('.json'),'Image meta must declare real imported files');
    const imageLibrary=libraryAsset(meta.uuid,'cc.ImageAsset'),nativeLibrary=libraryFile(meta.uuid,'.png');
    assert.equal(sha256(fs.readFileSync(nativeLibrary)),file.sha256,file.target+' library native must equal approved PNG');
    const imageRegistration=registration(resourcePath,meta.uuid,'cc.ImageAsset'),imageImport=importedAsset(meta.uuid,'cc.ImageAsset');
    const native=bundleFile('native',meta.uuid,'.png');
    assert.equal(sha256(fs.readFileSync(native)),file.sha256,file.target+' current build native must equal approved PNG');
    const textures=Object.values(meta.subMetas||{}).filter(s=>s.importer==='texture');
    assert.equal(textures.length,1,file.target+' requires one imported Texture2D');
    const texture=textures[0];assert.equal(texture.imported,true,'Texture subasset must be imported');
    assert.equal(texture.userData?.imageUuidOrDatabaseUri,meta.uuid,'Texture meta must point to this image');
    const textureLibrary=libraryAsset(texture.uuid,'cc.Texture2D');
    assert.deepEqual(textureLibrary.document.content?.mipmaps,[meta.uuid],'Actual library texture must reference this image');
    const textureImport=importedAsset(texture.uuid,'cc.Texture2D');
    assert.deepEqual(textureImport.imageUuids,[meta.uuid],'Actual built texture must reference this image');
    return {...file,dimensions,metadata:evidence(metaPath),uuid:meta.uuid,
      library:{image:imageLibrary.evidence,native:evidence(nativeLibrary),texture:textureLibrary.evidence},
      bundle:{registration:imageRegistration,image:imageImport,native:evidence(native),texture:{
        registration:registration(resourcePath+'/texture',texture.uuid,'cc.Texture2D'),import:textureImport}}};
  }
  function prefabAsset(file,resourcePath,expected){
    const metaPath=at(file.target+'.meta'),meta=readJson(metaPath);
    assert.equal(meta.importer,'fbx');assert.equal(meta.imported,true,'FBX must already be imported by Cocos');
    const sub=Object.values(meta.subMetas||{}),of=type=>sub.filter(s=>s.importer===type);
    const scenes=of('gltf-scene'),meshes=of('gltf-mesh'),materials=of('gltf-material');
    assert.equal(scenes.length,1);assert.equal(meshes.length,expected.meshes);assert.equal(of('gltf-animation').length,0);
    for(const entry of [...scenes,...meshes,...materials])assert.equal(entry.imported,true,entry.name+' import must be complete');
    assert.deepEqual(materials.map(m=>m.name.replace(/\.material$/,'')).sort(),[...expected.materials].sort());
    const prefab=scenes[0],library=libraryAsset(prefab.uuid,'cc.Prefab'),nodes=library.document;
    assert.ok(Array.isArray(nodes),'Expected ordinary imported prefab object array');
    const renderers=nodes.filter(n=>n.__type__==='cc.MeshRenderer');
    assert.equal(renderers.length,expected.meshes,'Imported prefab must contain exactly the environment renderers');
    assert.deepEqual(renderers.map(r=>r._mesh?.__uuid__).sort(),meshes.map(m=>m.uuid).sort(),'Prefab must reference its actual imported meshes');
    const materialIds=new Set(materials.map(m=>m.uuid));
    for(const renderer of renderers){assert.ok(renderer._materials?.length>0);for(const mat of renderer._materials)assert.ok(materialIds.has(mat.__uuid__),'Prefab has unexpected material');}
    assert.ok(!nodes.some(n=>/SkinnedMeshRenderer|Skeleton|SkeletalAnimation/.test(n.__type__||'')),'No preview turtle rigs may be baked into home prefab');
    const anchors=(expected.anchors||[]).map(anchor=>{
      const found=nodes.filter(n=>n.__type__==='cc.Node'&&n._name===anchor.name);assert.equal(found.length,1,'Missing/duplicate home anchor '+anchor.name);
      for(const key of ['x','y','z'])assert.ok(Math.abs(found[0]._lpos[key]-anchor[key])<1e-5,anchor.name+' '+key+' anchor');
      return {name:anchor.name,position:found[0]._lpos};
    });
    const meshProofs=meshes.map(mesh=>{
      const loaded=libraryAsset(mesh.uuid,'cc.Mesh'),structure=loaded.document._struct;
      assert.ok(structure?.primitives?.length>0,'Mesh has no actual primitives');
      const triangles=structure.primitives.reduce((sum,p)=>{assert.equal(p.primitiveMode,7,'Expected triangle list');assert.ok(p.indexView?.count>0&&p.indexView.count%3===0);return sum+p.indexView.count/3;},0);
      assert.equal(triangles,mesh.userData.triangleCount,'Actual mesh index count must match FBX metadata');
      const nativeLibrary=libraryFile(mesh.uuid,'.bin'),native=bundleFile('native',mesh.uuid,'.bin'),bytes=fs.readFileSync(nativeLibrary);
      for(const primitive of structure.primitives)assert.ok(primitive.indexView.offset+primitive.indexView.length<=bytes.length,'Mesh indices exceed actual binary');
      for(const bundle of structure.vertexBundles)assert.ok(bundle.view.offset+bundle.view.length<=bytes.length,'Mesh vertices exceed actual binary');
      assert.ok(bytes.equals(fs.readFileSync(native)),'Built mesh binary must equal its actual imported library binary');
      return {name:mesh.name,uuid:mesh.uuid,triangles,library:loaded.evidence,libraryNative:evidence(nativeLibrary),bundle:importedAsset(mesh.uuid,'cc.Mesh'),bundleNative:evidence(native)};
    });
    assert.equal(meshProofs.reduce((sum,m)=>sum+m.triangles,0),expected.triangles);
    const materialProofs=materials.map(material=>({name:material.name,uuid:material.uuid,library:libraryAsset(material.uuid,'cc.Material').evidence,bundle:importedAsset(material.uuid,'cc.Material')}));
    return {metadata:evidence(metaPath),uuid:prefab.uuid,library:library.evidence,
      bundle:{registration:registration(resourcePath,prefab.uuid,'cc.Prefab'),import:importedAsset(prefab.uuid,'cc.Prefab')},meshes:meshProofs,materials:materialProofs,anchors};
  }
  return {promotedFiles,imageAsset,prefabAsset,importedAsset,registration,bundleConfig:evidence(configFile)};
}
module.exports={createAssetVerifier,pngInfo,serializedRootType,sha256,assertNewReport,writeNewReport};
