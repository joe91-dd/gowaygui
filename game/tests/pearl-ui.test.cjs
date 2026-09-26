const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
class Component{}
class Node{constructor(name){this.name=name;this.children=[];this.components=new Map();this.position={x:0,y:0};}setParent(p){this.parent=p;p.children.push(this);}setPosition(x,y){this.position={x,y};}setScale(){}on(){}removeFromParent(){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}destroy(){this.destroyed=true;}addComponent(T){const c=new T();c.node=this;this.components.set(T,c);return c;}getComponent(T){return this.components.get(T);} }
Node.EventType={TOUCH_START:'start',TOUCH_END:'end'};
class Graphics{clear(){}fill(){}stroke(){}roundRect(){}rect(){}ellipse(){}circle(){}moveTo(){}lineTo(){}}
class UITransform{setContentSize(w,h){this.width=w;this.height=h;}}
class Color{constructor(...args){this.args=args;}static fromHEX(c,h){c.hex=h;}}
const cc={Node,Component,Graphics,Color,UITransform,Layers:{Enum:{UI_2D:1}},isValid:()=>true,Vec3:class{},UIOpacity:class{}};
function load(file){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:id=>id==='cc'?cc:{},Math,WeakSet});return mod.exports;}
test('主页、主页侧栏仍用原绘制；新皮肤仅在二级页面树中继承',()=>{
 const {IslandUI}=load('IslandUI.ts'),root=new Node('root'),attachments=[],art={ready:true,attach(n,key){attachments.push({n,key});return {};}};
 const ui=new IslandUI(root,()=>{},undefined,undefined,undefined,art);ui.text=()=>{};ui.atmosphere=()=>{};ui.button=()=>{};
 const home=ui.group('home');ui.panel(0,0,300,70,home);assert.equal(attachments.length,0);
 const page=ui.sceneSheet('技能背包');const card=ui.panel(0,0,300,170,page);assert.equal(attachments.find(x=>x.n===card).key,'pearl-panel');
 const before=attachments.length;ui.panel(0,0,300,70,home);assert.equal(attachments.length,before);
 ui.clear();const next=ui.group('home-again');ui.panel(0,0,300,70,next);assert.equal(attachments.length,before);
});
test('揭晓动画跳过与自然结束竞争时只交付一次结果',()=>{
 const {WishSequence}=load('MenuMotion.ts'),seq=new WishSequence(),root=new Node('root');seq.node=new Node('draw');seq.node.setParent(root);let delivered=0;seq.complete=()=>delivered++;
 seq.finish();seq.finish();seq.update(3);assert.equal(delivered,1);assert.equal(root.children.length,0);assert.equal(seq.node.destroyed,true);
});
test('减少动态开启时直接进入已经保存的抽取结果',()=>{
 const {WishSequence}=load('MenuMotion.ts'),seq=new WishSequence(),root=new Node('root');seq.node=new Node('draw');seq.node.setParent(root);let delivered=0;seq.complete=()=>delivered++;seq.reduced=()=>true;seq.update(.01);assert.equal(delivered,1);
});
test('掉帧不延长揭晓等待，长帧也只完成一次',()=>{
 const {WishSequence}=load('MenuMotion.ts'),seq=new WishSequence(),root=new Node('root');seq.node=new Node('draw');seq.node.setParent(root);let delivered=0;seq.complete=()=>delivered++;seq.update(5);seq.update(5);assert.equal(delivered,1);
});

test('抽奖聚光与爆发音效跨帧只各触发一次，跳过后不再发声',()=>{const {WishSequence}=load('MenuMotion.ts'),seq=new WishSequence(),root=new Node('root'),sounds=[];seq.node=new Node('draw');seq.node.setParent(root);seq.light=new Graphics();seq.ui={feedback:k=>sounds.push(k)};seq.update(1.4);seq.update(.2);seq.update(1.6);seq.update(.1);seq.finish();seq.update(2);assert.deepEqual(sounds,['wishGather','wishBurst']);});
