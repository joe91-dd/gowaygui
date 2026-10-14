const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
test('native session persists data, forbids two writers and rejects retired handles',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../assets/scripts/platform/localSession.ts'),'utf8');
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:()=>({requireRule:(ok,message)=>{if(!ok)throw Error(message);}})});
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},acquire=module.exports.acquireLocalSession;
 await assert.rejects(acquire(storage),/Chrome|Edge/,'Browser builds must still require Web Locks');
 const one=await acquire(storage,true);one.storage.setItem('save','checkpoint');await assert.rejects(acquire(storage,true),/已开启/);
 one.close();assert.throws(()=>one.storage.setItem('save','stale'),/关闭/);
 const two=await acquire(storage,true);assert.equal(two.storage.getItem('save'),'checkpoint');one.close();await assert.rejects(acquire(storage,true),/已开启/);two.close();
});
