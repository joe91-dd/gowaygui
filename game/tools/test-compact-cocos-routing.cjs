// Exercise the installed Cocos 3.8 native ImageAsset deserializer and Config class.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('../node_modules/typescript');
const engine=path.resolve(__dirname,'../temp/cocos-editor-3.8.8/resources/resources/3d/engine');
const out=path.resolve(process.argv[2]);
const classes=new Map();
const js={createMap:()=>Object.create(null),getClassById(id){if(!classes.has(id))classes.set(id,class{});return classes.get(id);},isChildClassOf:(a,b)=>a===b};
function evalModule(relative,dependencies){
 const filename=path.join(engine,relative),module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename})(id=>{assert.ok(id in dependencies,id);return dependencies[id];},module,module.exports);
 return module.exports;
}
const core={js,cclegacy:{}};
const Cache=evalModule('cocos/asset/asset-manager/cache.ts',{'../../core':core}).default;
const Config=evalModule('cocos/asset/asset-manager/config.ts',{'internal:constants':{EDITOR_NOT_IN_PREVIEW:false,TEST:false},'../assets':{},'../../core':core,'./cache':{default:Cache,__esModule:true},'./helper':{decodeUuid:u=>u,normalize:p=>p.replace(/\\/g,'/')}}).default;
const config=new Config(),raw=JSON.parse(fs.readFileSync(path.join(out,'retained-config.json'),'utf8'));
config.init(raw);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'runtime-resources.json'),'utf8'));
for(const p of Object.keys(manifest.entries))assert.ok(config.getInfoWithPath(p),'Missing runtime path '+p);
const source=fs.readFileSync(path.join(engine,'cocos/asset/assets/image-asset.jsb.ts'),'utf8');
const ast=ts.createSourceFile('native-image.ts',source,ts.ScriptTarget.Latest,true);
const statement=ast.statements.find(s=>s.getText(ast).startsWith('imageAssetProto._deserialize ='));
assert.ok(statement);
const extStatement=ast.statements.find(s=>s.getText(ast).startsWith('const extnames ='));
const code=ts.transpileModule(extStatement.getText(ast)+'\n'+statement.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const proto={},warnings=[];
vm.runInNewContext(code,{imageAssetProto:proto,deviceManager:{gfxDevice:null},macro:{SUPPORT_TEXTURE_FORMATS:['.astc','.pvr','.pkm','.webp','.jpg','.jpeg','.bmp','.png']},sys:{Feature:{WEBP:1},hasFeature:()=>true},PixelFormat:{RGB_ETC1:11,RGBA_ETC1:12,RGB_ETC2:13,RGBA_ETC2:14},warnID:n=>warnings.push(n)});
const images=JSON.parse(fs.readFileSync(path.join(out,'image-routing.json'),'utf8'));
for(const img of images){
 const target={format:0,_setRawAsset(ext){this.ext=ext;},setFixedFormat(format){this.format=format;}};
 proto._deserialize.call(target,img.serialized);
 assert.equal(img.extension,target.ext,img.path);
 const info=config.getInfoWithPath(img.path,js.getClassById('cc.ImageAsset'));
 assert.equal(info.uuid,img.uuid,img.path);
 assert.ok(img.nativeExists,img.path);
}
assert.deepEqual(warnings,[]);
console.log(`PASS: Cocos Config resolves ${Object.keys(manifest.entries).length} runtime paths; native ImageAsset routes all ${images.length} retained images to existing PNG/WebP payloads.`);
