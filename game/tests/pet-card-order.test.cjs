const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave,decodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {orderedPets}=require('../.test-build/core/petOrder.js');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
test('交换排序保存并幂等，不交换个体属性或首发阵容',()=>{
 const storage=new MemoryStorage(),s=makeInitialSave(1788830000000,77),ids=orderedPets(s).map(t=>t.id);s.homeTeam=ids.slice();storage.setItem(SAVE_KEY,encodeSave(s));const clock={now:()=>1788830000000};let g=new GameService(new SaveRepository(storage),clock);const before=g.snapshot;
 g.swapCollectionOrder('swap1',ids[0],ids[2]);g.swapCollectionOrder('swap1',ids[0],ids[2]);
 assert.equal(orderedPets(g.snapshot)[0].id,ids[2]);assert.equal(orderedPets(g.snapshot)[2].id,ids[0]);assert.deepEqual(g.snapshot.collection,before.collection);assert.deepEqual(g.snapshot.homeTeam,before.homeTeam);
 g=new GameService(new SaveRepository(storage),clock);assert.equal(orderedPets(g.snapshot)[0].id,ids[2]);assert.throws(()=>g.swapCollectionOrder('bad','missing',ids[1]));assert.equal(orderedPets(g.snapshot)[0].id,ids[2]);
 const invalid=g.snapshot;invalid.collectionOrder=[ids[0],ids[0]];assert.throws(()=>decodeSave(encodeSave(invalid)));
});
function fixture(hold=false){
 let timer,clicks=0,sounds=0,drops=[];const created=[];
 class UITransform{constructor(n){this.n=n;this.width=100;this.height=100;}convertToNodeSpaceAR(p){return{x:p.x-this.n.x,y:p.y-this.n.y};}}
 class Canvas{}
 class Graphics{roundRect(){}stroke(){}}
 class Vec3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 class Node{static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel',NODE_DESTROYED:'destroy'};constructor(x=0,y=0){this.x=x;this.y=y;this.handlers={};this.active=true;}on(k,f){this.handlers[k]=f;}once(k,f){this.on(k,f);}off(k){delete this.handlers[k];}setScale(){}setPosition(){}getComponent(type){return type===Canvas?{cameraComponent:{screenToWorld:p=>({x:(p.x-17)/2,y:(p.y-31)/2,z:0})}}:new UITransform(this);}addComponent(){return new Graphics();}destroy(){this.active=false;this.handlers.destroy?.();}emit(k,x=0,y=0,code=k){this.handlers[k]?.({getLocation:()=>({x:x*2+17,y:y*2+31}),getEventCode:()=>code});}}
 const root=new Node(),source=new Node(),target=new Node(200,0),ui={root,click(){sounds++;},isInteractive:n=>n.active,group(){const n=new Node();created.push(n);return n;},panel(){},pet(){},text(){}};
 const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/PetCardDrag.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,setTimeout:f=>(timer=f,1),clearTimeout:()=>timer=undefined,require:n=>n==='cc'?{Canvas,Node,Graphics,UITransform,Vec3}:{color:x=>x}});
 mod.exports.petCardDrag(ui,source,{},[{id:'b',node:target}],{hold,tap:()=>clicks++,drop:id=>drops.push(id)});
 return {source,created,drops,get clicks(){return clicks;},get sounds(){return sounds;},wait(){const f=timer;timer=undefined;f?.();},get timer(){return timer;}};
}
test('普通点击仍查看伙伴，长按不移动不触发点击',()=>{const f=fixture(true);f.source.emit('start');f.source.emit('end');assert.equal(f.clicks,1);f.source.emit('start');f.wait();f.source.emit('end');assert.equal(f.clicks,1);assert.deepEqual(f.drops,[]);assert.ok(f.created.every(n=>!n.active));});
test('背包长按拖放到另一张卡：Creator外部释放只提交一次交换',()=>{const f=fixture(true);f.source.emit('start');f.wait();f.source.emit('move',200);f.source.emit('cancel',200,0,'end');f.source.emit('end',200);assert.deepEqual(f.drops,['b']);assert.equal(f.clicks,0);});
test('未长按滑动与系统取消不交换，离开页面清理计时器',()=>{const f=fixture(true);f.source.emit('start');f.source.emit('move',200);f.wait();f.source.emit('end',200);assert.equal(f.clicks,0);assert.deepEqual(f.drops,[]);f.source.emit('start');f.wait();f.source.emit('move',200);f.source.emit('cancel',200);assert.deepEqual(f.drops,[]);f.source.emit('start');f.source.destroy();assert.equal(f.timer,undefined);});
test('工坊直接拖动，非法区域松手不提交合成或交换',()=>{const f=fixture();f.source.emit('start');f.source.emit('move',200);f.source.emit('cancel',200,0,'end');assert.deepEqual(f.drops,['b']);f.source.emit('start');f.source.emit('move',500);f.source.emit('cancel',500,0,'end');assert.deepEqual(f.drops,['b']);});

test('伙伴卡音效随真实点击或有效拖放触发，取消和离开页面不发声',()=>{const f=fixture();f.source.emit('start');f.source.emit('end');assert.equal(f.sounds,1);f.source.emit('start');f.source.emit('move',200);f.source.emit('cancel',200,0,'end');assert.equal(f.sounds,2);f.source.emit('end',200);assert.equal(f.sounds,2);f.source.emit('start');f.source.emit('cancel');assert.equal(f.sounds,2);f.source.emit('start');f.source.active=false;f.source.emit('end');assert.equal(f.sounds,2);});

