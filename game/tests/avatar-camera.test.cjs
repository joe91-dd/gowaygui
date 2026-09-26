const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../assets/scripts/view/ProfileAvatar.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(pending=false){
 const elements=[],buttons={},listeners=new Map();let stopped=0,request,resolve,focus=0;
 const stream={getTracks:()=>[{stop:()=>stopped++}]};
 const document={activeElement:{focus:()=>focus++},createElement(tag){const e={tag,style:{},children:[],disabled:false,setAttribute(){},append(...xs){this.children.push(...xs);},appendChild(x){this.children.push(x);},remove(){this.removed=true;},focus(){document.activeElement=this;},play:async()=>{}};elements.push(e);return e;},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};document.body=document.createElement('body');
 const p={once(k,f){this.destroy=f;},off(){this.destroy=undefined;}};
 const ui={sheet:()=>p,button(label,x,y,w,h,fn){buttons[label]=fn;return {};},portrait(){},text(){},toast(){},isInteractive:()=>true};
 const exports={};vm.runInNewContext(source,{exports,require:id=>id==='cc'?{Node:{EventType:{NODE_DESTROYED:'destroy'}}}:id==='./IslandUI'?{UI_COLORS:{sand:'#fff'}}:{},document,navigator:{mediaDevices:{getUserMedia:args=>{request=args;return pending?new Promise(r=>resolve=r):Promise.resolve(stream);}}},window:{addEventListener(){},removeEventListener(){}},Date});
 exports.avatarPicker(ui,{snapshot:{revision:1}},()=>{},()=>{});
 return {open:buttons['拍照 / 相机'],elements,p,listeners,resolve:()=>resolve(stream),get stopped(){return stopped;},get request(){return request;},get focus(){return focus;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('avatar camera starts only on click, requests no audio, and cancel stops every track',async()=>{
 const f=fixture();assert.equal(f.request,undefined);f.open();await settle();assert.equal(f.request.audio,false);
 const cancel=f.elements.find(e=>e.textContent==='取消');cancel.onclick();assert.equal(f.stopped,1);assert.equal(f.listeners.size,0);assert.equal(f.focus,1);
 cancel.onclick();assert.equal(f.stopped,1);
});
test('camera permission arriving after closing the dialog cannot leave a live stream',async()=>{
 const f=fixture(true);f.open();f.p.destroy();f.resolve();await settle();assert.equal(f.stopped,1);assert.equal(f.listeners.size,0);
});
