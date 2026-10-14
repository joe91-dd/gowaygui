const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
function load(name,cc,extra={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts',name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:()=>cc,...extra});return module.exports;}
function queueFixture(native=true){const requests=[],timers=[];class Asset{refCount=0;releases=0;decRef(){this.releases++;}}
 const cc={Asset,sys:{isNative:native},resources:{load(path,type,done){if(path==='throw')throw new Error('decode failure');requests.push({path,done});}}};
 const {NativeResourceQueue}=load('view/NativeResourceQueue',cc,{setTimeout:cb=>timers.push(cb)});
 return{queue:new NativeResourceQueue(),requests,Asset,flush(){while(timers.length)timers.shift()();}};}
test('Native resource queue admits two imports and lets a render turn occur between completions',()=>{
 const f=queueFixture(),done=[];for(let i=0;i<8;i++)f.queue.load('asset'+i,f.Asset,(e,a)=>done.push(e??a));
 assert.equal(f.requests.length,2);f.requests[0].done(null,new f.Asset());assert.equal(f.requests.length,2);f.flush();assert.equal(f.requests.length,3);
 for(let i=1;i<8;i++){f.requests[i].done(null,new f.Asset());f.flush();}assert.equal(done.length,8);
});
test('Retired queue settles every waiter and releases only unowned late resources',()=>{
 const f=queueFixture(),done=[];for(let i=0;i<5;i++)f.queue.load('asset'+i,f.Asset,(e,a)=>done.push({e,a}));
 f.queue.destroy();assert.equal(done.length,3);const unowned=new f.Asset(),shared=new f.Asset();shared.refCount=2;
 f.requests[0].done(null,unowned);f.requests[1].done(null,shared);f.flush();assert.equal(done.length,5);assert.equal(f.requests.length,2);
 assert.ok(done.every(r=>r.e&&!r.a));assert.equal(unowned.releases,1);assert.equal(shared.releases,0);
 f.queue.load('after retirement',f.Asset,e=>done.push({e}));assert.equal(done.length,6);
});
test('An importer throwing synchronously does not strand queued jobs; web keeps parallel loading',()=>{
 const f=queueFixture(),errors=[];f.queue.load('throw',f.Asset,e=>errors.push(e));f.queue.load('good',f.Asset,()=>{});f.flush();
 assert.equal(errors.length,1);assert.match(errors[0].message,/decode failure/);assert.equal(f.requests.length,1);
 const web=queueFixture(false);for(let i=0;i<8;i++)web.queue.load('asset'+i,web.Asset,()=>{});assert.equal(web.requests.length,8);
});
test('A partial approved-effects failure waits for and destroys completed texture allocations',async()=>{
 const requests=[],created=[];class Texture2D{static Filter={LINEAR:1};static WrapMode={CLAMP_TO_EDGE:1};constructor(){created.push(this);}setFilters(){}setWrapMode(){}destroy(){this.destroyed=true;}}
 const cc={Texture2D,ImageAsset:class{},resources:{load(path,Type,done){requests.push(done);}}};
 const {approvedVfxTextures}=load('view/ApprovedVfxArt',cc),result=approvedVfxTextures();
 requests[0](null,{});requests[1](new Error('missing atlas'));requests[2](null,{});
 await assert.rejects(result,/missing atlas/);assert.equal(created.length,2);assert.ok(created.every(t=>t.destroyed));
});
test('Native loading diagnostics survive restart, stay bounded, and tolerate unavailable storage',()=>{
 let saved='';const cc={sys:{isNative:true,localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v}}};
 let trace=load('platform/nativeBattleTrace',cc);for(let i=0;i<12;i++)trace.recordNativeBattleStage('阶段'+i,0);
 assert.equal(JSON.parse(saved).length,8);trace=load('platform/nativeBattleTrace',cc);assert.match(trace.nativeBattleTraceText(),/阶段11/);assert.doesNotMatch(trace.nativeBattleTraceText(),/阶段0\n/);
 cc.sys.localStorage.getItem=()=>{throw new Error('unavailable');};assert.doesNotThrow(()=>trace.recordNativeBattleStage('still loading'));assert.equal(trace.nativeBattleTraceText(),'暂无战斗加载记录');
});
test('Lazy secondary-page art waits for its image before binding the scenery shader',()=>{
 const requests=[];class Node{isValid=true;events=new Map();once(e,f){this.events.set(e,f);}}
 class Material{properties={};initialize(){}setProperty(k,v){this.properties[k]=v;}}
 const cc={Component:class{},Sprite:{EventType:{SPRITE_FRAME_CHANGED:'frame'}},Material,Vec4:class{},isValid:n=>n?.isValid,
   resources:{load(path,Type,done){requests.push(done);}}};
 const {SeaChartMotion}=load('view/SeaChart',cc),motion=new SeaChartMotion();motion.node=new Node();
 const sprite={node:new Node(),spriteFrame:null,getMaterialInstance:()=>null};motion.surface(sprite);
 assert.equal(requests.length,0);sprite.spriteFrame={texture:{id:'lazy page image'}};sprite.node.events.get('frame')();assert.equal(requests.length,1);
 requests[0](null,{addRef(){}});assert.equal(sprite.customMaterial.properties.sceneTexture,sprite.spriteFrame.texture);
 const retired={node:new Node(),spriteFrame:null};motion.surface(retired);retired.node.isValid=false;retired.node.events.get('frame')();assert.equal(requests.length,1);
});
