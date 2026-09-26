const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/scripts/view/ChapterMap.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const levels=Array.from({length:50},(_,id)=>({id,name:'海岛'+id}));
function fixture(skinned=false){
  const nodes=[],attachments=[],chosen=[],pages=[],motion={started:0,stopped:0};
  class Graphics{clear(){}circle(){}roundRect(){}fill(){}stroke(){}}
  class Node{static EventType={NODE_DESTROYED:'destroyed'};constructor(name){this.name=name;this.labels=[];this.listeners={};this.children=[];this.graphics=skinned?null:new Graphics();nodes.push(this);}getComponent(){return this.graphics;}addComponent(){return this.graphics=new Graphics();}once(event,callback){this.listeners[event]=callback;}}
  function tween(target){return{by(){return this;},repeatForever(){return this;},start(){if(target)motion.started++;return this;}};}
  const cc={Graphics,Node,tween,Tween:{stopAllByTarget(){motion.stopped++;}},Vec3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}}};
  class SeaChart{
    constructor(ui,key,title,subtitle,back,reduced){this.ui=ui;this.reduced=reduced;this.root=ui.group('海图',0,0,ui.root);ui.art.attach(this.root,key,1280,720);}
    button(text,x,y,width,height,action,primary,disabled){const node=this.ui.button(text,x,y,width,height,action,{parent:this.root,disabled});node.labels.push(text);return node;}
    boat(x,y,size){const node=this.ui.group('当前航船',x,y,this.root);this.ui.art.attach(node,'chapter-boat',size,size);if(!this.reduced()){motion.started++;node.once('destroyed',()=>motion.stopped++);}}
  }
  const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='cc'?cc:name==='./SeaChart'?{SeaChart}:{color:hex=>hex}});
  const root=new Node('root');
  const ui={root,art:{attach(node,key,width,height){attachments.push({node,key,width,height});}},
    group(name,x=0,y=0,parent=root){const node=new Node(name);Object.assign(node,{x,y,parent});return node;},
    button(text,x,y,width,height,callback,options){const node=this.group(text,x,y,options.parent);Object.assign(node,{width,height,callback,disabled:!!options.disabled});return node;},
    panel(x,y,width,height,parent){return this.group('panel',x,y,parent);},
    text(text,x,y,size,hex,parent){parent.labels.push(text);return{string:text};},icon(){}};
  return{...module.exports,nodes,attachments,chosen,pages,motion,render(page=0,unlocked=2,cleared=[0,1],reduced=false){module.exports.renderChapterMap(ui,levels,page,'初晴海湾',{unlockedLevel:unlocked,cleared,settings:{reducedMotion:reduced}},id=>chosen.push(id),page=>pages.push(page),()=>{});}};
}

test('海图五岛来自真实进度，默认续航不是写死的第3关',()=>{
  const f=fixture(),state=f.chapterMapState(levels,0,0,[]);
  assert.equal(state.stages.length,5);assert.equal(state.destination.level.id,0);
  assert.equal(state.stages.filter(stage=>stage.locked).length,4);
  const advanced=f.chapterMapState(levels,1,7,[0,1,2,3,4,5,6]);
  assert.equal(advanced.destination.level.id,7);assert.equal(advanced.stages[0].level.id,5);assert.equal(advanced.stages[4].locked,true);
});
test('海图分页有边界，全通关与未解锁海域状态正确',()=>{
  const f=fixture();assert.equal(f.chapterMapState(levels,-9,0,[]).page,0);
  const last=f.chapterMapState(levels,99,49,levels.map(level=>level.id));
  assert.equal(last.page,9);assert.equal(last.destination.level.id,49);assert.ok(last.stages.every(stage=>stage.completed));
  assert.equal(f.chapterMapState(levels,2,0,[]).destination,undefined);
});
test('海图岛屿和继续冒险接原有选队入口，锁定关卡不能进入',()=>{
  const f=fixture();f.render();
  const markers=f.nodes.filter(node=>node.name.startsWith('海图关卡:'));assert.equal(markers.length,5);
  markers[2].callback();markers[3].callback();assert.deepEqual(f.chosen,[2]);assert.equal(markers[3].disabled,true);
  f.nodes.find(node=>node.labels.includes('继续冒险')).callback();assert.deepEqual(f.chosen,[2,2]);
  f.nodes.find(node=>node.labels.includes('下一海域 ›')).callback();assert.deepEqual(f.pages,[1]);
  assert.equal(f.nodes.find(node=>node.labels.includes('‹ 上一海域')).disabled,true);
  assert.deepEqual(f.attachments.map(item=>item.key),['chart-chapter','chapter-boat']);
});
test('小船随当前关卡换泊位，减少动态关闭浮动，页面销毁清理动画',()=>{
  const f=fixture();f.render(0,2,[0,1]);const ship=f.nodes.find(node=>node.name==='当前航船');
  assert.equal(ship.x,-78);assert.equal(f.motion.started,1);ship.listeners.destroyed();assert.equal(f.motion.stopped,1);
  const reduced=fixture();reduced.render(0,0,[],true);assert.equal(reduced.motion.started,0);assert.equal(reduced.nodes.find(node=>node.name==='当前航船').x,-369);
  const locked=fixture();locked.render(2,0,[]);assert.equal(locked.attachments.length,1);assert.equal(locked.nodes.find(node=>node.labels.includes('尚未解锁')).disabled,true);
});
test('地图与航船是真实PNG，航船保留透明通道',()=>{
  const art=path.join(__dirname,'../assets/resources/art-modern');
  const map=fs.readFileSync(path.join(art,'chapter-map.png')),ship=fs.readFileSync(path.join(art,'chapter-boat.png'));
  assert.equal(map.readUInt32BE(16),1672);assert.equal(map.readUInt32BE(20),941);assert.equal(ship[25],6);
});

test('珠光贴图按钮没有Graphics时关卡依然能打开和选关',()=>{const f=fixture(true);assert.doesNotThrow(()=>f.render());const markers=f.nodes.filter(n=>n.name.startsWith('海图关卡:'));assert.equal(markers.length,5);assert.ok(markers.every(n=>n.graphics));markers[0].callback();assert.deepEqual(f.chosen,[0]);});
