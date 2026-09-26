const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const scripts=path.join(__dirname,'../assets/scripts');
const cache=new Map();
function core(name){if(cache.has(name))return cache.get(name).exports;const m={exports:{}};cache.set(name,m);vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(scripts,'core',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>core(n.replace('./','')),console});return m.exports;}
const source=ts.transpileModule(fs.readFileSync(path.join(scripts,'view/BattleWorld.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({detail=false,warmFailure=false}={}){
 const calls=[],warmed=[],registered=[];class Texture2D{};class Prefab{};
 const resources={getInfoWithPath:()=>detail?{}:null,load(name,type,callback){calls.push({name,type,callback});}};
 const m={exports:{}};vm.runInNewContext(source,{module:m,exports:m.exports,console,require:n=>n==='cc'?{resources,Texture2D,Prefab}:n.startsWith('../core/')?core(n.split('/').at(-1)):{} });
 const world=Object.assign(Object.create(m.exports.BattleWorld.prototype),{disposed:false,pendingModels:0,faunaPrefabs:new Map(),faunaLoading:new Set(),enemies:new Map(),turtleMaterials:{registerSurface(...args){registered.push(args);}},acquireEnemy(id,kind,key){return {id,kind,key};},attachEnemy(){if(warmFailure)throw Error('warm failed');},recycleEnemy(actor){warmed.push(actor);}});
 const prefab={addRef(){}};
 return {world,calls,warmed,registered,Prefab,Texture2D,prefab};
}
for(const level of [0,50,51,52,53,54,55,56])test(`map ${level} finishes loading with authored albedo-only boss models`,async()=>{
 const f=fixture();f.world.loadLevelFauna(level);const requests=f.calls.splice(0);assert.ok(requests.length>0);assert.equal(f.world.pendingModels,requests.length);
 await Promise.all(requests.map(r=>r.callback(null,f.prefab)));
 assert.equal(f.world.pendingModels,0);assert.equal(f.world.modelsReady,true);assert.equal(f.world.loadingError,undefined);assert.equal(f.calls.length,0,'absent detail maps are never requested');assert.equal(f.warmed.length,requests.length);
 f.world.loadLevelFauna(level);assert.equal(f.calls.length,0,'the controller reuses the prepared models');
});
test('failed model warmup is reported and releases the loading counter',async()=>{
 const f=fixture({warmFailure:true});f.world.loadLevelFauna(55);await Promise.all(f.calls.splice(0).map(r=>r.callback(null,f.prefab)));
 assert.equal(f.world.pendingModels,0);assert.equal(f.world.faunaLoading.size,0);assert.match(f.world.loadingError.message,/warm failed/);
});
test('existing detail maps finish before a model becomes ready',async()=>{
 const f=fixture({detail:true});f.world.loadLevelFauna(56);const pending=f.calls.splice(0).map(r=>r.callback(null,f.prefab));
 assert.ok(f.world.pendingModels>0);assert.ok(f.calls.length>0);for(const r of f.calls.splice(0))r.callback(null,new f.Texture2D());await Promise.all(pending);
 assert.equal(f.world.modelsReady,true);assert.ok(f.registered.length>0);
});
test('failed prefab and cancelled callbacks do not leave silent loading',async()=>{
 const f=fixture();f.world.loadLevelFauna(51);await Promise.all(f.calls.splice(0).map(r=>r.callback(Error('asset unavailable'))));assert.equal(f.world.pendingModels,0);assert.match(f.world.loadingError.message,/asset unavailable/);
 const g=fixture();g.world.loadLevelFauna(51);g.world.disposed=true;await Promise.all(g.calls.map(r=>r.callback(null,g.prefab)));assert.equal(g.warmed.length,0);assert.equal(g.world.faunaPrefabs.size,0);
});
