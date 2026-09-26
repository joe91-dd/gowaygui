const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Menu tests require the installed Cocos TypeScript compiler');
const scripts=path.join(__dirname,'../assets/scripts');
const compiled=new Map();
function compile(file){
  if(!compiled.has(file))compiled.set(file,ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
  }).outputText);
  return compiled.get(file);
}
const clone=value=>JSON.parse(JSON.stringify(value));
const NOW=1788830000000;

// Actual GameEntry, IslandUI, GameService and save validation are executed from
// current TypeScript sources. Cocos nodes record transforms and live touch targets;
// this checks layout contracts/hit rectangles, not font rasterization or phone GPU.
// Synthetic archives are valid persisted fixtures, not changes to fusion odds.
function fixture(t,options={}){
  const nodes=[],loads=[],worlds=[],calls={service:[],audio:[],errors:[]},modules=new Map();
  class Node{
    static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel',NODE_DESTROYED:'destroyed'};
    constructor(name=''){
      this.name=name;this.isValid=true;this.active=true;this.children=[];this.components=[];this.handlers=new Map();
      this.position={x:0,y:0,z:0};this.scale={x:1,y:1,z:1};nodes.push(this);
    }
    get scene(){return this.parent?this.parent.scene:this;}
    get activeInHierarchy(){return this.isValid&&this.active&&(!this.parent||this.parent.activeInHierarchy);}
    setParent(parent){this.removeFromParent();this.parent=parent;parent.children.push(this);}
    removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=undefined;}
    setPosition(x,y,z=0){this.position=typeof x==='object'?{...x}:{x,y,z};}
    setScale(x,y=x,z=x){this.scale=typeof x==='object'?{...x}:{x,y,z};}lookAt(){}setRotationFromEuler(){}
    addComponent(Type){const component=new Type();component.node=this;component.isValid=true;this.components.push(component);return component;}
    getComponent(Type){return this.components.find(component=>component instanceof Type);}
    getComponentsInChildren(Type){return this.components.filter(component=>component instanceof Type).concat(this.children.flatMap(child=>child.getComponentsInChildren(Type)));}
    getComponentInChildren(Type){return this.getComponentsInChildren(Type)[0];}
    getChildByName(name){return this.children.find(node=>node.name===name);}
    on(type,callback){const list=this.handlers.get(type)||[];list.push(callback);this.handlers.set(type,list);}
    once(type,callback){this.on(type,callback);}
    off(type){this.handlers.delete(type);}
    emit(type,event={propagationStopped:false}){for(const callback of this.handlers.get(type)||[])callback(event);}
    destroy(){if(!this.isValid)return;this.active=false;this.isValid=false;for(const child of [...this.children])child.destroy();for(const component of this.components)component.isValid=false;this.removeFromParent();}
  }
  class UITransform{
    constructor(){this.width=0;this.height=0;this.anchorPoint={x:.5,y:.5};}
    setContentSize(width,height){if(typeof width==='object'){height=width.height;width=width.width;}this.width=width;this.height=height;this.contentSize={width,height};}
    setAnchorPoint(x,y){this.anchorPoint={x,y};}
  }
  class Label{
    static Overflow={NONE:0,CLAMP:1,SHRINK:2,RESIZE_HEIGHT:3};
    static HorizontalAlign={LEFT:0,CENTER:1,RIGHT:2};static VerticalAlign={TOP:0,CENTER:1,BOTTOM:2};
    constructor(){this.string='';}
  }
  class Color{constructor(r=0,g=0,b=0,a=255){Object.assign(this,{r,g,b,a});}static fromHEX(out,value){out.hex=value;}}
  class Graphics{clear(){}roundRect(){}rect(){}fill(){}stroke(){}circle(){}ellipse(){}moveTo(){}lineTo(){}close(){}}
  class World{
    constructor(){this.modelsReady=false;this.visible=false;worlds.push(this);}
    setVisible(value){this.visible=value;}setOceanTexture(){}setLevel(level){this.level=level;}setEnvironment(value){this.environment=value;}
    destroy(){this.disposed=true;this.visible=false;}
  }
  class Home{
    constructor(){this.ready=false;}
    setVisible(value){this.visible=value;}setPaused(value){this.paused=value;}setReducedMotion(){}update(){}destroy(){this.disposed=true;}
  }
  const cc={Node,UITransform,Label,Color,Graphics,EditBox:class{static InputMode={SINGLE_LINE:6};static InputFlag={DEFAULT:5};},Mask:class{static Type={GRAPHICS_RECT:0,GRAPHICS_STENCIL:2};subComp=new Graphics();},Layers:{Enum:{UI_2D:2,DEFAULT:1}},
    _decorator:{ccclass:()=>Type=>Type,property:()=>()=>{}},Component:class{scheduleOnce(){}},Material:class{},Prefab:class{},Camera:class{},Canvas:class{},
    Vec3:class{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}},
    isValid:(value,strict)=>!!value?.isValid&&!(strict&&value.pending),
    tween:()=>({stop(){},to(){return this;},start(){return this;}}),
    screen:{windowSize:{width:1280,height:720}},view:{off(){},getScaleY:()=>1},game:{off(){}},Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},
    resources:{load(name,Type,callback){loads.push({name,callback});}},
  };
  const fakeView={
    IslandIcons:{IslandIcons:class{}},IslandPanels:{IslandPanels:class{}},TurtlePortraits:{TurtlePortraits:class{}},IslandAudio:{IslandAudio:class{}},
    HomeWorld:{HomeWorld:Home,HOME_CAMERA:{position:[1.8,8.2,12.8],target:[-.45,.9,0],baseVerticalFovDegrees:38}},
    BattleWorld:{BattleWorld:World},BattleScreen:{BattleScreen:class{}},WorldLighting:{lightIsland(){}},LocalDiagnostics:{LocalDiagnostics:class{}},
  };
  const sharedContext=vm.createContext({Error,setTimeout,clearTimeout,console:{info(){},error(...args){calls.errors.push(args.map(String));}}});
  function load(file){
    file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;
    const module={exports:{}};modules.set(file,module);
    vm.runInContext('(function(module,exports,require){\n'+compile(file)+'\n})',sharedContext,{filename:file})(module,module.exports,function(name){
      if(name==='./ProfileAvatar')return {avatarPicker(){},paintAvatar(){}};if(name==='cc')return cc;
      if(name==='../platform/localSession')return{};
      const target=path.resolve(path.dirname(file),name+'.ts'),base=path.basename(target,'.ts');
      if(path.dirname(target)===path.join(scripts,'view')&&fakeView[base])return fakeView[base];
      if(name.startsWith('.'))return load(target);
      throw new Error('Unexpected module '+name);
    });return module.exports;
  }
  const game=load(path.join(scripts,'core/game.ts')),data=load(path.join(scripts,'core/data.ts'));
  const save=load(path.join(scripts,'core/save.ts')),{MemoryStorage}=load(path.join(scripts,'platform/storage.ts'));
  const initial=game.makeInitialSave(NOW,0x1280176);initial.unlockedLevel=4;initial.stamina=25;initial.tutorialStarted=true;initial.gold=5000;
  const templates=Object.values(initial.collection).map(clone);
  while(Object.keys(initial.collection).length<13){
    const turtle=clone(templates[initial.idCounter%templates.length]);turtle.id=`t-${++initial.idCounter}`;turtle.name=`伙伴${initial.idCounter}`;initial.collection[turtle.id]=turtle;
  }
  const legendId=templates[0].id,legend=initial.collection[legendId];legend.name='传说石头';
  legend.skills=data.skillsForRole(legend.role).filter(id=>{const s=data.SKILL_BY_ID[id];return !s.active&&!s.precious&&!s.specialization;}).slice(0,11).concat('hold');
  const historical=clone(legend);historical.id=`t-${++initial.idCounter}`;historical.name='历史石头';
  initial.history[historical.id]={turtle:historical,retiredAt:NOW,replacementId:legendId,eventId:'fixture:collected'};
  // Books are an explicit diagnostic inventory. No grant path or user storage is
  // involved, and the default fixture deliberately retains its absent inventory.
  if(options.skillBooks)initial.skillBooks=clone(options.skillBooks);
  const storage=new MemoryStorage();storage.setItem(save.SAVE_KEY,save.encodeSave(initial));
  const real=new game.GameService(new save.SaveRepository(storage),{now:()=>NOW});
  if(options.modern)real.enablePrototype('fixture:v06');
  const service=new Proxy(real,{get(target,key){if(key==='snapshot')return target.snapshot;const value=target[key];return typeof value==='function'?(...args)=>{calls.service.push([key,...clone(args)]);const result=value.apply(target,args);options.afterService?.(key,args,result);return result;}:value;}});
  const {GameEntry}=load(path.join(scripts,'view/GameEntry.ts')),{IslandUI}=load(path.join(scripts,'view/IslandUI.ts'));
  const entry=new GameEntry(),scene=new Node('Scene'),owner=new Node('Entry'),root=new Node('UI');owner.setParent(scene);root.setParent(scene);
  const cameraNode=new Node('Main Camera');cameraNode.setParent(scene);
  entry.node=owner;entry.mainCamera={node:cameraNode,worldToScreen:p=>({x:640+p.x*25,y:360-p.z*25,z:0})};entry.pipelineMaterial={};entry.interfaceReady=true;entry.service=service;
  entry.icons={ready:true,state:'ready',attach(node,id){node.iconId=id;},destroy(){}};
  entry.panels={state:'ready',supports:()=>true,attach(){},destroy(){}};
  entry.portraits={ready:true,state:'ready',attach(node,role){node.portraitRole=role;},destroy(){}};
  entry.ui=new IslandUI(root,()=>calls.audio.push('ui-confirm'),entry.icons,entry.panels,entry.portraits);
  entry.audio={playMusic:()=>Promise.resolve(),apply(){},effect(key){calls.audio.push(key);},battleEvents(){},update(){},pause(){},resume(){},destroy(){}};
  entry.bindUiAudio();entry.homeWorld=new Home();entry.homeWorld.ready=true;entry.resizeViewport=()=>{};
  function alive(node){for(let current=node;current;current=current.parent)if(!current.isValid||!current.active)return false;return !!node&&node.scene===scene;}
  const liveLabels=()=>nodes.filter(alive).flatMap(node=>node.components.filter(component=>component instanceof Label));
  const descendantLabels=node=>node.getComponentsInChildren(Label).filter(label=>alive(label.node));
  const targetFor=caption=>nodes.findLast(node=>alive(node)&&node.handlers.has(Node.EventType.TOUCH_END)&&descendantLabels(node).some(label=>typeof caption==='string'?label.string===caption:caption.test(label.string)));
  function rect(node){
    const transform=node.getComponent(UITransform);assert.ok(transform,'hit target must have UITransform');
    let x=0,y=0,sx=1,sy=1;for(let current=node;current;current=current.parent){x=x*current.scale.x+current.position.x;y=y*current.scale.y+current.position.y;sx*=current.scale.x;sy*=current.scale.y;}
    return {left:x-transform.width*sx/2,right:x+transform.width*sx/2,bottom:y-transform.height*sy/2,top:y+transform.height*sy/2,width:transform.width*sx,height:transform.height*sy};
  }
  function assertHit(node,minWidth=80,minHeight=56){const box=rect(node);assert.ok(box.width>=minWidth&&box.height>=minHeight,`usable target ${node.name}: ${box.width}x${box.height}`);assert.ok(box.left>=-640&&box.right<=640&&box.bottom>=-360&&box.top<=360,'target is inside design viewport');return box;}
  function click(caption){const node=typeof caption==='object'&&caption instanceof Node?caption:targetFor(caption);assert.ok(node,'live clickable target '+caption);assert.ok(alive(node));const event={getLocation:()=>({x:0,y:0}),getUILocation:()=>({x:0,y:0})};node.emit(Node.EventType.TOUCH_START,event);node.emit(Node.EventType.TOUCH_END,event);return node;}
  const signature=()=>JSON.stringify({save:real.snapshot,storage:storage.values});
  t.after(()=>entry.onDestroy());
  return {entry,real,storage,data,save,calls,nodes,loads,worlds,legendId,historyId:historical.id,ui:entry.ui,root,Node,Label,UITransform,
    load,alive,labels:liveLabels,target:targetFor,descendantLabels,rect,assertHit,click,signature,
    cards(){return nodes.filter(node=>alive(node)&&node.children.some(child=>child.portraitRole||child.name.startsWith('伙伴头像:'))&&descendantLabels(node).some(label=>Object.values(real.snapshot.collection).some(turtle=>game.displayName(turtle)===label.string)));},
  };
}

function turtleTitle(f,id){const turtle=f.real.snapshot.collection[id]||f.real.snapshot.history[id]?.turtle;return turtle.name||f.data.ROLES[turtle.role].name;}

test('音效：技能礼包成功才响开箱音，失败与旧按钮不会再播',t=>{
  const f=fixture(t),{RewardMenus}=f.load(path.join(scripts,'view/RewardMenus.ts'));
  let fail=false,opened=0;const errors=[],state={...f.real.snapshot,bookPacks:{common:1}};
  const menus=new RewardMenus(f.ui,{snapshot:state,openBookPack(){if(fail)throw Error('背包不足');opened++;state.bookPacks.common--;return 'strong';}},()=> 'open',e=>errors.push(e));
  menus.packs(()=>{});const button=f.target('开启一个');f.click(button);
  assert.equal(opened,1);assert.equal(f.calls.audio.filter(x=>x==='sfx_chest').length,1);
  button.emit(f.Node.EventType.TOUCH_END);assert.equal(opened,1);assert.equal(f.calls.audio.filter(x=>x==='sfx_chest').length,1);
  state.bookPacks.common=1;fail=true;menus.packs(()=>{});f.click('开启一个');
  assert.equal(errors.length,1);assert.equal(f.calls.audio.filter(x=>x==='sfx_chest').length,1);
});

test('音效：培养成功播放成长声，资源不足不播放成功声',t=>{
  const f=fixture(t),{PetDetails}=f.load(path.join(scripts,'view/PetDetails.ts'));
  const turtle=clone(f.real.snapshot.collection[f.legendId]);turtle.innate={attack:50,health:50,defense:50,growth:60};turtle.training={attack:0,health:0,defense:0,growth:0};
  const state={...f.real.snapshot,gold:999999,materials:{attack:9,health:9,defense:9,growth:9},collection:{[turtle.id]:turtle}};
  let fail=false,trains=0;const errors=[];
  const details=new PetDetails(f.ui,{snapshot:state,train(){if(fail)throw Error('金币不足');trains++;}},()=> 'train',e=>errors.push(e));
  details.show(turtle,{owned:true});f.click('星级天赋');f.click('培养 +1刻');f.click('确认培养');
  assert.equal(trains,1);assert.equal(f.calls.audio.filter(x=>x==='sfx_upgrade').length,1);
  fail=true;f.click('培养 +1刻');f.click('确认培养');assert.equal(errors.length,1);
  assert.equal(f.calls.audio.filter(x=>x==='sfx_upgrade').length,1);
});

test('音效：任务领取等待服务器成功，连续点击与退出页面不重复补响',async t=>{
  for(const leave of [false,true]){
    const f=fixture(t),{TaskMenus}=f.load(path.join(scripts,'view/TaskMenus.ts'));
    let resolve,claims=0;const pending=new Promise(r=>resolve=r);
    const client={session:{},view:{days:1,claims:[],pending:[]},claim(){claims++;return pending;}};
    const menu=new TaskMenus(f.ui,f.real,client,()=>{},e=>{throw e;});menu.open('login',0,false);
    const button=f.target('领取');f.click(button);f.click(button);
    assert.equal(claims,1);assert.equal(f.calls.audio.filter(x=>x==='sfx_collect').length,0);
    if(leave)f.ui.clear();else client.view.claims.push('login:1');
    resolve();for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(f.calls.audio.filter(x=>x==='sfx_collect').length,leave?0:1);
    button.emit(f.Node.EventType.TOUCH_END);assert.equal(claims,1);
  }
});

test('音效：按钮阻止冒泡，禁用和已销毁按钮不发声',t=>{
  const f=fixture(t);let actions=0;const n=f.ui.button('动作',0,0,160,60,()=>actions++);
  const e={propagationStopped:false};n.emit(f.Node.EventType.TOUCH_END,e);assert.equal(e.propagationStopped,true);assert.equal(actions,1);
  const count=f.calls.audio.length;
  n.emit(f.Node.EventType.TOUCH_START,{getLocation:()=>({x:0,y:0})});n.emit(f.Node.EventType.TOUCH_MOVE,{getLocation:()=>({x:50,y:0})});
  const swipe={propagationStopped:false};n.emit(f.Node.EventType.TOUCH_END,swipe);assert.equal(swipe.propagationStopped,false,'swipes still reach parent pagination');assert.equal(actions,1);
  const disabled=f.ui.button('禁用',0,0,160,60,()=>actions++,{disabled:true});disabled.emit(f.Node.EventType.TOUCH_END);
  n.destroy();n.emit(f.Node.EventType.TOUCH_END);assert.equal(actions,1);assert.equal(f.calls.audio.length,count);
});
function cardId(f,node){return Object.keys(f.real.snapshot.collection).find(id=>f.descendantLabels(node).some(label=>label.string===turtleTitle(f,id)));}
function assertSeparate(boxes){
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.top,b.top)<=Math.max(a.bottom,b.bottom),'major targets do not overlap');
  }
}

test('收藏每页六张整卡，13只可完整翻页；大头像和标题可读，查看返回不改收藏或磁盘',t=>{
  const f=fixture(t),before=f.signature();f.entry.go('collection');const seen=[];
  for(const count of [6,6,1]){
    const cards=f.cards();assert.equal(cards.length,count);assertSeparate(cards.map(node=>f.assertHit(node,300,160)));
    for(const card of cards){
      const id=cardId(f,card);assert.ok(id);seen.push(id);
      const title=f.descendantLabels(card).find(label=>label.string===turtleTitle(f,id));assert.ok(title.fontSize>=30);assert.equal(title.overflow,f.Label.Overflow.CLAMP);
      const portrait=f.nodes.find(node=>f.alive(node)&&(node.portraitRole||node.name.startsWith('伙伴头像:'))&&node.parent===card);assert.ok(portrait);assert.ok(portrait.getComponent(f.UITransform).width>=96);
    }
    if(count===6){f.assertHit(f.target('下一页'));f.click('下一页');}
  }
  assert.equal(new Set(seen).size,13);assert.equal(f.signature(),before);
  const last=f.cards()[0],id=cardId(f,last);f.click(last);assert.equal(f.entry.screen,'detail');assert.equal(f.entry.selectedId,id);
  f.assertHit(f.target('返回'));f.click('返回');assert.equal(f.entry.screen,'collection');assert.equal(f.entry.page,2,'return preserves the collection page');assert.equal(f.signature(),before);
});

test('选队六卡跨页保留选择顺序和五只上限，取消直接返回主页而不修改存档',t=>{
  const f=fixture(t),before=f.signature();f.entry.go('levels');f.entry.chooseTeam(1);
  assert.equal(f.cards().length,6);assertSeparate(f.cards().map(node=>f.assertHit(node,300,160)));
  const original=clone(f.entry.teamSelection),removed=original[0];assert.equal(original.length,5);
  f.click(turtleTitle(f,removed));assert.deepEqual(clone(f.entry.teamSelection),original,'inspection alone never changes lineup');f.click('取消出战');assert.deepEqual(clone(f.entry.teamSelection),original.slice(1));
  f.click('下一页');assert.equal(f.cards().length,6);
  const added=cardId(f,f.cards()[0]);f.click(turtleTitle(f,added));f.click('确定出战');
  const selected=original.slice(1).concat(added);assert.deepEqual(clone(f.entry.teamSelection),selected);
  const extra=f.cards().find(node=>!selected.includes(cardId(f,node)));assert.ok(extra);assert.equal(extra.handlers.has(f.Node.EventType.TOUCH_END),true,'full lineup still permits inspecting another pet');extra.emit(f.Node.EventType.TOUCH_END);assert.equal(f.target('确定出战'),undefined,'confirm is disabled at cap');f.click('返回');
  assert.deepEqual(clone(f.entry.teamSelection),selected,'a sixth different turtle cannot enter the team');
  f.click('上一页');assert.equal(f.cards().length,6);assert.deepEqual(clone(f.entry.teamSelection),selected);
  f.click('返回');assert.equal(f.entry.screen,'home');assert.equal(f.signature(),before);
});

test('选队出发提交一次真实入场，连续派发旧出发事件不重复扣体力或改出战名单',t=>{
  const f=fixture(t);f.entry.go('levels');f.entry.chooseTeam(1);const selected=clone(f.entry.teamSelection),collection=JSON.stringify(f.real.snapshot.collection);
  const depart=f.target('出发 · 5 体力');f.assertHit(depart,240,64);const stamina=f.real.snapshot.stamina;
  f.click(depart);assert.equal(f.entry.screen,'battle');assert.deepEqual(clone(f.real.snapshot.run.selectedSources),selected);assert.equal(f.real.snapshot.stamina,stamina-5);
  const after=f.signature();depart.emit(f.Node.EventType.TOUCH_END);depart.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.signature(),after);assert.equal(f.calls.service.filter(call=>call[0]==='beginRun').length,1);assert.equal(f.worlds.length,1);
  assert.equal(JSON.stringify(f.real.snapshot.collection),collection);assert.equal(f.calls.errors.length,0);
});

test('12个真实技能都在技能页可见且可点说明，关闭说明保留技能页，浏览全程不改技能或存档',t=>{
  const f=fixture(t),before=f.signature(),ids=clone(f.real.snapshot.collection[f.legendId].skills);
  f.entry.selectedId=f.legendId;f.entry.detailOrigin='collection';f.entry.go('detail');
  const tab=f.target(/^技能/);f.assertHit(tab,120,56);f.click(tab);assert.equal(f.entry.detailTab,'skills');
  const targets=ids.map(id=>f.target(new RegExp(f.data.SKILL_BY_ID[id].name)));
  assert.ok(targets.every(Boolean));assert.equal(new Set(targets).size,12);assertSeparate(targets.map(node=>f.assertHit(node,160,56)));
  for(const id of ids){
    const skill=f.data.SKILL_BY_ID[id],button=f.target(new RegExp(skill.name));
    const label=f.descendantLabels(button).find(label=>label.string.includes(skill.name));assert.ok(label.fontSize>=20&&label.fontSize<=24);assert.equal(label.overflow,f.Label.Overflow.CLAMP);
    f.click(button);assert.ok(f.labels().some(label=>label.string===skill.description),'show the actual stored skill description');
    const close=f.target(/^(?:返回|关闭|知道了|返回技能|回到技能|返回详情|×)$/);f.assertHit(close,44,44);f.click(close);
    assert.equal(f.entry.detailTab,'skills');assert.equal(f.signature(),before);
  }
  assert.deepEqual(clone(f.real.snapshot.collection[f.legendId].skills),ids);assert.equal(f.calls.service.length,0);
});

test('历史详情仅供查看且返回历史；当前收藏培养仍提交一次真实训练，不更换任何技能',t=>{
  const f=fixture(t),before=f.signature();f.entry.go('history');f.click(turtleTitle(f,f.historyId));
  assert.equal(f.entry.screen,'detail');assert.equal(f.entry.detailOrigin,'history');assert.equal(f.entry.selectedId,f.historyId);
  assert.equal(f.target(/^培养/),undefined);assert.equal(f.target(/^(?:锁定伙伴|解锁伙伴)$/),undefined);
  f.click('返回');assert.equal(f.entry.screen,'history');assert.equal(f.signature(),before);
  f.entry.selectedId=f.legendId;f.entry.detailOrigin='collection';f.entry.detailTab='traits';f.entry.go('detail');
  for(const text of ['攻击天赋','生命天赋','防御天赋','成长天赋'])assert.ok(f.labels().some(label=>label.string===text));
  const train=f.target(/^培养/);f.assertHit(train,140,64);const previous=f.real.snapshot;
  f.click(train);const next=f.real.snapshot;
  const changed=Object.keys(previous.collection[f.legendId].training).filter(key=>next.collection[f.legendId].training[key]!==previous.collection[f.legendId].training[key]);
  assert.equal(changed.length,1);const key=changed[0];assert.equal(next.collection[f.legendId].training[key],previous.collection[f.legendId].training[key]+1);
  assert.equal(next.gold,previous.gold-(key==='growth'?300:100));assert.equal(next.materials[key],previous.materials[key]-1);
  assert.deepEqual(clone(next.collection[f.legendId].skills),clone(previous.collection[f.legendId].skills));
  assert.deepEqual(clone(next.history),clone(previous.history));assert.equal(f.calls.service.filter(call=>call[0]==='train').length,1);
});

test('选关、设置与体力的主要操作使用视口内大命中区，设置和返回不改变收藏',t=>{
  const f=fixture(t),collection=JSON.stringify(f.real.snapshot.collection);f.entry.go('levels');
  const starts=f.nodes.filter(node=>f.alive(node)&&node.handlers.has(f.Node.EventType.TOUCH_END)&&f.descendantLabels(node).some(label=>label.string==='下一段冒险'||label.string==='已通关 · 可重玩'));
  assert.equal(starts.length,5);assertSeparate(starts.map(node=>f.assertHit(node,140,64)));
  f.entry.go('settings');const motion=f.target('减少动态：关');f.assertHit(motion,240,64);f.click(motion);
  assert.equal(f.real.snapshot.settings.reducedMotion,true);assert.equal(JSON.stringify(f.real.snapshot.collection),collection);
  const controls=f.nodes.filter(node=>f.alive(node)&&node.handlers.has(f.Node.EventType.TOUCH_END)&&f.descendantLabels(node).some(label=>['－','＋','静音'].includes(label.string)));
  assert.ok(controls.length>=6);controls.forEach(node=>f.assertHit(node,64,64));
  f.entry.energyDialog();f.assertHit(f.target(/体力\s*[＋+]\s*5/),260,64);
  assert.equal(JSON.stringify(f.real.snapshot.collection),collection);
});

test('返回首页加载期间旧卡片/翻页/出发/奖励事件既不改状态也不覆盖页面，失效节点不响确认音',t=>{
  const f=fixture(t);f.entry.go('home');f.entry.energyDialog();const ad=f.target(/体力\s*[＋+]\s*5/);
  f.entry.go('levels');f.entry.chooseTeam(1);const card=f.cards()[0],next=f.target('下一页'),depart=f.target('出发 · 5 体力');
  const selection=clone(f.entry.teamSelection);f.entry.screen='home';const arrival={world:f.entry.homeWorld,failed:false};f.entry.homeArrival=arrival;f.entry.render();
  const before=f.signature(),audio=f.calls.audio.length,service=f.calls.service.length;
  for(const node of [ad,card,next,depart]){assert.ok(node);node.emit(f.Node.EventType.TOUCH_END);}
  assert.equal(f.entry.homeArrival,arrival);assert.equal(f.entry.screen,'home');assert.deepEqual(clone(f.entry.teamSelection),selection);
  assert.equal(f.signature(),before);assert.equal(f.calls.audio.length,audio);assert.equal(f.calls.service.length,service);
  assert.equal(f.worlds.length,0);assert.equal(f.target('准备出发'),undefined);
});

function openBookDetail(f,id=f.legendId){
  f.entry.selectedId=id;f.entry.detailOrigin='collection';f.entry.detailTab='traits';f.entry.go('detail');
}
function bookCards(f){return f.nodes.filter(node=>f.alive(node)&&node.name.startsWith('技能书:'));}
function bookCard(f,id){return bookCards(f).find(node=>node.name==='技能书:'+id);}
function learns(f){return f.calls.service.filter(call=>call[0]==='learnSkillBook');}

test('技能书入口仅属永久收藏；空库存不补发，历史详情及迟到入口均不能打开学习页',t=>{
  const f=fixture(t),before=f.signature();openBookDetail(f);
  const entry=f.target('学习技能书');f.assertHit(entry,240,64);f.click(entry);
  assert.equal(bookCards(f).length,0);assert.equal(f.target('确认学习'),undefined);
  assert.equal(f.real.snapshot.skillBooks,undefined,'legacy/empty inventory is not fabricated by opening the page');
  f.click('知道了');assert.equal(f.signature(),before);assert.equal(f.calls.service.length,0);
  f.entry.go('history');f.click(turtleTitle(f,f.historyId));
  assert.equal(f.target('学习技能书'),undefined);assert.equal(f.target('确认学习'),undefined);
  const nodes=f.nodes.length;f.entry.skillBooksDialog();entry.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.nodes.length,nodes);assert.equal(f.signature(),before);assert.equal(f.calls.service.length,0);
});

test('真实技能书库存按六张分页，第七本可访问且书卡完整可点击，翻页不会增加库存',t=>{
  const ids=['strong','armor','resist','swift','reach','steady','regen'];
  const f=fixture(t,{skillBooks:Object.fromEntries(ids.map(id=>[id,1]))}),before=f.signature();
  const turtle=Object.values(f.real.snapshot.collection).find(turtle=>turtle.role==='stone'&&turtle.id!==f.legendId);
  assert.ok(turtle);openBookDetail(f,turtle.id);f.click('学习技能书');
  assert.deepEqual(bookCards(f).map(node=>node.name.slice(4)),ids.slice(0,6));
  assertSeparate(bookCards(f).map(node=>f.assertHit(node,300,160)));
  f.click('下一页');assert.deepEqual(bookCards(f).map(node=>node.name.slice(4)),ids.slice(6));
  const seventh=bookCard(f,'regen');f.assertHit(seventh,300,160);assert.ok(seventh.handlers.has(f.Node.EventType.TOUCH_END));
  f.click(seventh);assert.ok(f.target('确认学习'),'seventh book reaches the real confirmation flow');
  f.click('再想一想');f.click('上一页');assert.equal(bookCards(f).length,6);
  assert.equal(f.signature(),before);assert.equal(learns(f).length,0);
});

test('已经拥有或职业不兼容的书不可点，进行中的冒险禁用入口与所有学习书卡',t=>{
  const f=fixture(t,{skillBooks:{strong:1,greatHeal:1,reflect:1}});openBookDetail(f);f.click('学习技能书');
  const before=f.signature();
  for(const id of ['strong','greatHeal']){
    const node=bookCard(f,id);assert.ok(node);assert.equal(node.handlers.has(f.Node.EventType.TOUCH_END),false);
    node.emit(f.Node.EventType.TOUCH_END);assert.equal(f.target('确认学习'),undefined);
  }
  assert.ok(bookCard(f,'reflect').handlers.has(f.Node.EventType.TOUCH_END),'valid unowned book remains usable');
  assert.equal(f.signature(),before);assert.equal(learns(f).length,0);
  f.real.beginRun('fixture:active-run',1,[f.legendId]);openBookDetail(f);
  assert.equal(f.target('学习技能书'),undefined,'visible entry is disabled while an adventure is unfinished');
  const disabledEntry=f.nodes.findLast(node=>f.alive(node)&&node.name==='按钮:学习技能书');assert.ok(disabledEntry);
  disabledEntry.emit(f.Node.EventType.TOUCH_END);
  f.entry.skillBooksDialog();assert.equal(bookCards(f).length,3);
  const activeSave=f.signature();
  for(const node of bookCards(f)){assert.equal(node.handlers.has(f.Node.EventType.TOUCH_END),false);node.emit(f.Node.EventType.TOUCH_END);}
  assert.equal(f.signature(),activeSave);assert.equal(learns(f).length,0);assert.equal(f.target('确认学习'),undefined);
});

test('查看学习风险与取消不预抽或提交，取消面板的旧确认回调不会学习',t=>{
  const f=fixture(t,{skillBooks:{reflect:2}}),before=f.signature();openBookDetail(f);f.click('学习技能书');f.click(bookCard(f,'reflect'));
  const confirm=f.target('确认学习');f.assertHit(confirm,320,64);f.assertHit(f.target('再想一想'),320,64);
  assertSeparate([f.rect(confirm),f.rect(f.target('再想一想'))]);
  assert.equal(f.signature(),before,'opening risk disclosure does not advance stored RNG or change inventory');
  assert.equal(f.calls.service.length,0,'no service draw/learning call occurs before consent');
  assert.ok(!f.labels().some(label=>label.string.includes('↓')),'no concrete replaced-to-learned result before consent');
  for(const id of f.real.snapshot.collection[f.legendId].skills){
    assert.ok(!f.labels().some(label=>label.string===f.data.SKILL_BY_ID[id].name),'traits-page disclosure does not expose a selected replacement');
  }
  f.click('再想一想');const audio=f.calls.audio.length;confirm.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.signature(),before);assert.equal(f.calls.service.length,0);assert.equal(f.calls.audio.length,audio);
  assert.equal(bookCards(f).length,1,'cancel leaves the actual inventory page available');
});

test('确认学习使用真实事务只消耗一本，结果及十二技能页来自提交后快照，旧确认不重复消费',t=>{
  const f=fixture(t,{skillBooks:{reflect:2}}),before=f.real.snapshot,turtle=before.collection[f.legendId];
  openBookDetail(f);f.click('学习技能书');f.click(bookCard(f,'reflect'));const confirm=f.target('确认学习');f.click(confirm);
  const after=f.real.snapshot,call=learns(f)[0];assert.equal(learns(f).length,1);assert.equal(call[2],f.legendId);assert.equal(call[3],'reflect');
  const receipt=after.commands[call[1]].result,newTurtle=after.collection[f.legendId];
  assert.equal(after.skillBooks.reflect,1);assert.equal(newTurtle.skills.length,12);assert.equal(new Set(newTurtle.skills).size,12);
  assert.deepEqual(clone(newTurtle.skills),clone(receipt.afterSkills));assert.ok(newTurtle.skills.includes('reflect'));
  assert.ok(!newTurtle.skills.includes(receipt.replacedSkillId));assert.deepEqual(clone(receipt.beforeSkills),clone(turtle.skills));
  for(const key of ['id','role','name','innate','training','generation','parentIds','locked'])assert.deepEqual(clone(newTurtle[key]),clone(turtle[key]),'preserve '+key);
  assert.equal(after.gold,before.gold);assert.equal(after.stamina,before.stamina);assert.deepEqual(clone(after.materials),clone(before.materials));assert.deepEqual(clone(after.history),clone(before.history));
  assert.ok(f.labels().some(label=>label.string===`${f.data.SKILL_BY_ID[receipt.replacedSkillId].name}\n↓\n${f.data.SKILL_BY_ID.reflect.name}`));
  const committed=f.signature(),audio=f.calls.audio.length;
  confirm.emit(f.Node.EventType.TOUCH_END);confirm.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.signature(),committed);assert.equal(learns(f).length,1);assert.equal(f.calls.audio.length,audio);
  f.click('查看伙伴');assert.equal(f.entry.detailTab,'skills');
  for(const id of receipt.afterSkills)assert.ok(f.target(new RegExp('^'+f.data.SKILL_BY_ID[id].name+'$')),'updated skill target '+id);
  assert.equal(f.target(new RegExp('^'+f.data.SKILL_BY_ID[receipt.replacedSkillId].name+'$')),undefined,'removed skill is not rendered from a stale detail snapshot');
  assert.equal(f.signature(),committed);assert.equal(f.calls.errors.length,0);
});

test('提交已落盘但回执丢失时，原确认面板重试复用命令，仅一次随机覆盖与库存消耗',t=>{
  let dropOnce=true;
  const f=fixture(t,{skillBooks:{reflect:2},afterService(key){if(key==='learnSkillBook'&&dropOnce){dropOnce=false;throw new Error('fixture: committed receipt lost');}}});
  openBookDetail(f);f.click('学习技能书');f.click(bookCard(f,'reflect'));const confirm=f.target('确认学习');f.click(confirm);
  assert.equal(learns(f).length,1);assert.equal(f.real.snapshot.skillBooks.reflect,1);
  const committed=f.signature();assert.equal(f.calls.errors.length,1);f.click('知道了');
  f.click(confirm);assert.equal(learns(f).length,2);assert.equal(learns(f)[0][1],learns(f)[1][1],'same consent panel owns one stable idempotency key');
  assert.equal(f.signature(),committed,'cached receipt must not advance RNG, write a new revision or consume another book');
  assert.ok(f.target('查看伙伴'));f.click('查看伙伴');assert.equal(f.entry.detailTab,'skills');
  assert.ok(f.target(/^反伤$/));assert.equal(f.signature(),committed);
});

test('技能书确认在后台、隐藏祖先或待销毁节点时不可学习，正常恢复后才接受一次确认',t=>{
  const f=fixture(t,{skillBooks:{reflect:1}});openBookDetail(f);f.click('学习技能书');f.click(bookCard(f,'reflect'));
  const confirm=f.target('确认学习'),before=f.signature();
  f.entry.onHide();confirm.emit(f.Node.EventType.TOUCH_END);assert.equal(learns(f).length,0);assert.equal(f.signature(),before);
  f.entry.appHidden=false;f.root.active=false;const quiet=f.calls.audio.length;
  confirm.emit(f.Node.EventType.TOUCH_END);assert.equal(f.calls.audio.length,quiet);assert.equal(learns(f).length,0);assert.equal(f.signature(),before);
  f.root.active=true;confirm.pending=true;confirm.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.calls.audio.length,quiet);assert.equal(learns(f).length,0);assert.equal(f.signature(),before);
  confirm.pending=false;f.click(confirm);assert.equal(learns(f).length,1);assert.equal(f.real.snapshot.skillBooks.reflect,0);
});

test('V0.6 outside fusion UI resumes fixed C and consumes exactly two after explicit keep confirmation; old controls are inert',t=>{
  const f=fixture(t,{modern:true});f.entry.go('workshop');assert.equal(f.target('局外合成'),undefined);
  const candidates=()=>f.nodes.filter(n=>f.alive(n)&&n.name==='按钮:'&&n.getComponent(f.UITransform)?.width===224);const a=cardId(f,candidates()[0]);f.click(candidates()[0]);f.click('选择为主龟');const b=cardId(f,candidates()[1]);f.click(candidates()[1]);f.click('选择为副龟');
  f.click('查看合成方案');const confirm=f.target('确认合成'),count=Object.keys(f.real.snapshot.collection).length;f.click(confirm);
  assert.equal(f.calls.audio.filter(key=>key==='sfx_fusion_start').length,1);const fixed=clone(f.real.snapshot.outsideFusion),before=f.signature();assert.deepEqual(fixed.inputIds,[a,b]);assert.equal(f.target('返回'),undefined);
  confirm.emit(f.Node.EventType.TOUCH_END);assert.equal(f.signature(),before);f.entry.render();assert.deepEqual(clone(f.real.snapshot.outsideFusion),fixed);
  const reveal=f.target('直接揭晓');f.click(reveal);assert.equal(f.calls.audio.filter(key=>key==='sfx_fusion_complete').length,1);assert.equal(f.calls.audio.filter(key=>key==='sfx_fusion_start').length,1);assert.equal(f.real.snapshot.outsideFusion.revealed,true);assert.equal(Object.keys(f.real.snapshot.collection).length,count);
  f.click(f.nodes.find(n=>f.alive(n)&&n.name==='按钮:留下'&&n.position.x===-384));const keep=f.target('留下');f.click(keep);const after=f.signature();keep.emit(f.Node.EventType.TOUCH_END);reveal.emit(f.Node.EventType.TOUCH_END);
  assert.equal(f.signature(),after);assert.equal(Object.keys(f.real.snapshot.collection).length,count-1);assert.ok(f.real.snapshot.collection[a]);assert.equal(f.real.snapshot.collection[b],undefined);assert.equal(f.real.snapshot.outsideFusion,undefined);assert.equal(f.calls.errors.length,0);
});
test('V07 book learning keeps all twelve current skills visible with the persisted replacement on the same page',t=>{
  const f=fixture(t,{modern:true,skillBooks:{reflect:2}});openBookDetail(f);f.click('学习技能书');
  for(const id of f.real.snapshot.collection[f.legendId].skills)assert.ok(f.labels().some(l=>l.string.startsWith(f.data.SKILL_BY_ID[id].name)));
  f.click('反伤 ×2');const confirm=f.target('确认学习「反伤」');assert.ok(confirm);const before=f.signature();
  f.click(confirm);const fixed=clone(f.real.snapshot.bookReveal),rng=f.real.snapshot.rng;assert.ok(fixed);assert.notEqual(f.signature(),before);
  assert.equal(f.real.snapshot.skillBooks.reflect,1);assert.ok(f.target('直接揭晓'));
  for(const id of fixed.receipt.afterSkills)assert.ok(f.labels().some(l=>l.string.startsWith(f.data.SKILL_BY_ID[id].name)));
  assert.ok(f.labels().some(l=>l.string.includes('擦开泡泡')));const saved=f.signature();confirm.emit(f.Node.EventType.TOUCH_END);assert.equal(f.signature(),saved);
  f.entry.render();assert.deepEqual(clone(f.real.snapshot.bookReveal),fixed);f.click('直接揭晓');assert.ok(f.labels().some(l=>l.string.includes('→')));assert.equal(f.real.snapshot.bookReveal,undefined);assert.equal(f.real.snapshot.rng,rng);assert.equal(f.calls.errors.length,0);
});
test('V0.6 rename input changes only the selected permanent name after explicit save',t=>{
  const f=fixture(t,{modern:true});f.entry.go('collection');const id=cardId(f,f.cards()[0]);f.click(f.cards()[0]);f.click('管理伙伴');f.click('给伙伴改名');
  const edit=f.nodes.filter(f.alive).flatMap(n=>n.components).find(c=>'maxLength' in c);assert.ok(edit);assert.equal(edit.maxLength,12);
  const before=clone(f.real.snapshot.collection[id]),rng=f.real.snapshot.rng;edit.string='我的第一神龟';f.click('保存名字');
  assert.deepEqual(clone(f.real.snapshot.collection[id]),{...before,name:'我的第一神龟'});assert.equal(f.real.snapshot.rng,rng);assert.equal(f.calls.errors.length,0);
});

test('V0.6 default team covers the five available roles despite duplicate individuals, but manual duplicates remain allowed',t=>{
  const f=fixture(t,{modern:true});f.entry.go('levels');f.entry.chooseTeam(1);
  assert.equal(f.entry.teamSelection.length,5);assert.equal(new Set(f.entry.teamSelection.map(id=>f.real.snapshot.collection[id].role)).size,5);
  const selected=clone(f.entry.teamSelection),stone=selected.find(id=>f.real.snapshot.collection[id].role==='stone');
  const removed=selected.find(id=>f.real.snapshot.collection[id].role==='spike');f.click(turtleTitle(f,removed));f.click('取消出战');
  const duplicate=f.cards().find(n=>{const id=cardId(f,n);return id!==stone&&f.real.snapshot.collection[id].role==='stone';});
  assert.ok(duplicate);const duplicateId=cardId(f,duplicate);f.click(duplicate);f.click('确定出战');assert.equal(f.entry.teamSelection.length,5);assert.ok(f.entry.teamSelection.includes(duplicateId));
  assert.equal(f.entry.teamSelection.filter(id=>f.real.snapshot.collection[id].role==='stone').length,2);
});

test('V07 actual community pages expose AI, three assists, borrowing and a persistent local chat reply',t=>{
  const f=fixture(t,{modern:true});f.entry.go('community');assert.ok(f.labels().some(l=>l.string.includes('本地AI测试')));
  for(const caption of ['好友与聊天','交易行','租赁市场','排行榜','海岛副本','竞技场'])f.assertHit(f.target(caption),300,160);
  f.click('好友与聊天');f.click('我的援助·3只');const ids=Object.keys(f.real.snapshot.collection).slice(0,3);for(const id of ids){f.click(turtleTitle(f,id));f.click('确定出战');}
  // Use the selection transaction through the actual picker confirmation; selected cards are a page snapshot.
  f.click('确认选择');assert.equal(f.real.snapshot.community.assists.length,3);f.click('潮汐·AI');f.click('发送消息');
  const edit=f.nodes.filter(f.alive).flatMap(n=>n.components).find(c=>'maxLength' in c);edit.string='一起打副本';f.click('发送');assert.equal(f.real.snapshot.community.messages.length,2);assert.ok(f.labels().some(l=>l.string.includes('AI回复为本地测试')));assert.equal(f.calls.errors.length,0);
});

test('V07 actual market buys one finite AI book and stale purchase callback cannot buy it twice; hiding also removes public arena row',t=>{
  const f=fixture(t,{modern:true});f.entry.go('community');const menus=f.entry.getCommunityMenus(),book=f.real.snapshot.community.listings.find(l=>l.kind==='book');menus.listing(book.id,'trade',false);
  const buy=f.target('确认购买'),before=f.real.snapshot;f.click(buy);const after=f.signature();buy.emit(f.Node.EventType.TOUCH_END);assert.equal(f.signature(),after);assert.equal(f.real.snapshot.gold,before.gold-book.price);assert.equal(f.real.snapshot.skillBooks[book.skillId],1);assert.equal(f.real.snapshot.community.receipts.length,1);
  menus.rankings();f.click('我的资料不上榜');menus.arena();assert.ok(!f.labels().some(l=>l.string.includes('（你）')));assert.equal(f.calls.errors.length,0);
});

test('V07 actual challenge controller pauses, resumes and parks a changed raid turtle without reviving or accepting destroyed callbacks',t=>{
  const f=fixture(t,{modern:true});f.entry.go('community');f.real.beginRaid('raid',0,Object.keys(f.real.snapshot.collection).slice(0,5));
  const {ChallengeScreen}=f.load(path.join(scripts,'view/ChallengeScreen.ts')),calls={frames:0,paused:false,home:0,errors:[]};let serial=0;
  const world={setLevel(){},setPlaybackSpeed(){},setPaused(v){calls.paused=v;},showRange(){},update(){calls.frames++;},updatePresentation(){},destroy(){}};
  const screen=new ChallengeScreen('raid',f.real,f.ui,world,f.entry.mainCamera,f.entry.audio,kind=>kind+(++serial),()=>calls.home++,e=>calls.errors.push(String(e)));t.after(()=>screen.destroy());
  f.click('全队准备，出发');screen.update(.5);assert.equal(f.real.snapshot.community.raid.phase,'combat',JSON.stringify(calls.errors));
  f.click('一键释放\n已开启');assert.equal(f.real.snapshot.settings.autoSkills,false);f.click('一键释放\n已关闭');assert.equal(f.real.snapshot.settings.autoSkills,true);
  const toggle=f.target('一键释放\n已开启');toggle.emit(f.Node.EventType.TOUCH_START);
  f.load(path.join(scripts,'core/raids.ts')).moveRaidStation(screen.raid,1,9);screen.update(.05);
  assert.ok(f.alive(toggle),'AI station changes must not destroy the button being pressed');
  f.click(toggle);assert.equal(f.real.snapshot.settings.autoSkills,false);screen.update(.05);assert.equal(screen.raid.battle.autoSkills,false);
  f.click('暂停');const saved=f.real.snapshot.community.raid.battle.tick;screen.update(2);assert.equal(f.real.snapshot.community.raid.battle.tick,saved);assert.equal(calls.paused,true);
  const old=f.target('继续战斗');screen.hide();f.click(old);assert.equal(calls.paused,true);screen.show();f.click('继续战斗');screen.update(.5);screen.checkpoint();assert.ok(f.real.snapshot.community.raid.battle.tick>saved);
  f.click('暂停');const quit=f.target('结束本次挑战');screen.destroy();const before=JSON.stringify(f.real.snapshot);quit.emit(f.Node.EventType.TOUCH_END);screen.update(5);assert.equal(JSON.stringify(f.real.snapshot),before);assert.deepEqual(calls.errors,[]);
});

test('closing an illustrated sheet destroys its scenery and restores the underlying page',t=>{
 const f=fixture(t);f.ui.art={ready:true,attach(){}};const home=f.ui.group('existing-home');
 let p;p=f.ui.sheet('资料','',()=>p.parent.destroy());const veil=p.parent;
 assert.equal(f.root.children.length,2);assert.ok(veil.children.some(n=>n.name==='页面海岛背景'));
 f.click('返回');assert.equal(veil.isValid,false);assert.equal(f.root.children.length,1);assert.equal(f.root.children[0],home);
});

test('rejected second adventure leaves a dismissible error and can resume the original battle without changing save',t=>{
 const f=fixture(t,{modern:true}),ids=Object.keys(f.real.snapshot.collection).slice(0,5);
 f.real.beginPrototypeRun('first-adventure',0,ids,'chapter');const before=f.signature();
 f.ui.onActionError=e=>f.entry.error(e);f.ui.button('尝试另开关卡',0,0,200,60,()=>f.real.beginPrototypeRun('second-adventure',0,ids,'chapter'));
 f.click('尝试另开关卡');assert.ok(f.target('知道了'));assert.ok(f.target('继续未完成的战斗'));assert.equal(f.signature(),before);
 f.click('知道了');assert.ok(f.target('尝试另开关卡'));assert.equal(f.nodes.filter(n=>f.alive(n)&&n.name==='紧凑弹窗遮罩').length,0);
 f.click('尝试另开关卡');let resumed=false;f.entry.openBattle=()=>resumed=true;f.click('继续未完成的战斗');assert.ok(resumed);assert.equal(f.signature(),before);assert.equal(f.nodes.filter(n=>f.alive(n)&&n.name==='紧凑弹窗遮罩').length,0);
});

for(const previous of ['raid','arena','chapter','legacy'])test(`direct new battle replaces ${previous} once and keeps the selected team`,t=>{
 const f=fixture(t,{modern:previous!=='legacy'}),ids=Object.keys(f.real.snapshot.collection).slice(0,5);
 if(previous==='raid')f.real.beginRaid('old-raid',0,ids);
 else if(previous==='arena'){f.real.communityAction('init',{kind:'init'});f.real.matchArena('old-arena',ids);}
 else if(previous==='legacy')f.real.beginRun('old-run',0,ids);
 else f.real.beginPrototypeRun('old-run',0,ids);
 const oldRun=f.real.snapshot.run?.id;
 f.entry.go('levels');f.entry.chooseTeam(1);const selected=clone(f.entry.teamSelection),before=f.signature(),stamina=f.real.snapshot.stamina;
 f.click('出发 · 5 体力');assert.equal(f.signature(),before);
 const next=f.target('直接进入新战斗');assert.ok(next);
 assertSeparate(['知道了','继续未完成的战斗','直接进入新战斗'].map(c=>f.assertHit(f.target(c),240,56)));
 assert.ok(f.labels().some(l=>l.string.includes('按退出规则结算')));
 f.click(next);assert.equal(f.entry.screen,'battle');assert.equal(f.real.snapshot.run.levelId,1);
 assert.deepEqual(clone(f.real.snapshot.run.selectedSources),selected);assert.equal(f.real.snapshot.stamina,stamina-5);
 if(previous==='raid'||previous==='arena'){assert.equal(f.real.snapshot.community[previous].settled,true);assert.equal(f.real.snapshot.community[previous].victory,false);}
 else {assert.equal(f.real.snapshot.results[oldRun].victory,false);assert.notEqual(f.real.snapshot.run.id,oldRun);}
 const after=f.signature();next.emit(f.Node.EventType.TOUCH_END);assert.equal(f.signature(),after);assert.equal(f.worlds.length,1);
});

test('failed direct entry preserves the previous battle and persistent save',t=>{
 const f=fixture(t,{modern:true}),ids=Object.keys(f.real.snapshot.collection).slice(0,5);
 f.real.beginRaid('old-raid',0,ids);f.entry.go('levels');f.entry.chooseTeam(5);
 const before=f.signature();f.click('出发 · 5 体力');f.click('直接进入新战斗');
 assert.equal(f.signature(),before);assert.equal(f.real.snapshot.community.raid.settled,false);
 assert.ok(f.target('继续未完成的战斗'));assert.equal(f.target('直接进入新战斗'),undefined);
});

for(const destination of ['raid','arena','practice'])test(`blocked ${destination} entry offers direct battle and preserves its requested destination`,t=>{
 const f=fixture(t,{modern:true});f.entry.go('community');const menus=f.entry.getCommunityMenus(),ids=Object.keys(f.real.snapshot.collection).slice(0,5);
 f.real.beginPrototypeRun('old-run',0,ids);const before=f.signature(),old=f.real.snapshot.run.id;
 if(destination==='raid'){menus.raids();f.click('碎礁洞穴');f.click('确认选择');}
 else if(destination==='practice'){menus.defensePreview();f.click('让AI进攻，演练防守');}
 else {menus.arenaOpponent(f.real.snapshot.community.arenaOrder.at(-2));f.click('开始对战');}
 assert.equal(f.signature(),before);const button=f.target('直接进入新战斗');assert.ok(button);f.click(button);
 assert.equal(f.real.snapshot.results[old].victory,false);assert.equal(f.entry.challengeMode,destination==='raid'?'raid':'arena');assert.equal(f.entry.screen,'battle');
 assert.equal(f.real.snapshot.community[destination==='raid'?'raid':'arena'].settled,false);
 const after=f.signature();button.emit(f.Node.EventType.TOUCH_END);assert.equal(f.signature(),after);
});
test('generic battle-conflict dialogs also offer a new battle and keep dismiss non-mutating',t=>{
 const f=fixture(t,{modern:true}),ids=Object.keys(f.real.snapshot.collection).slice(0,5);f.entry.go('community');f.real.beginRaid('old',3,ids);const before=f.signature(),old=f.real.snapshot.community.raid.id;
 f.entry.error(new Error('请先结束副本或竞技场战斗'));assert.ok(f.target('直接进入新战斗'));f.click('知道了');assert.equal(f.signature(),before);
 f.entry.error(new Error('请先结束副本或竞技场战斗'));f.click('直接进入新战斗');assert.notEqual(f.real.snapshot.community.raid.id,old);assert.equal(f.real.snapshot.community.raid.tier,3);assert.equal(f.entry.challengeMode,'raid');
});

for(const mode of ['raid','arena','online','watch','world'])test(`actual ${mode} controller leaves the arrival screen with a ready world`,t=>{
 const f=fixture(t,{modern:true});f.entry.go('community');const ids=Object.keys(f.real.snapshot.collection).slice(0,5),opponent=f.real.snapshot.community.arenaOrder.at(-2);
 if(mode==='raid'||mode==='online')f.real.beginRaid('controller-raid',3,ids);
 if(mode==='arena')f.real.beginArena('controller-arena',opponent,ids);
 if(mode==='watch')f.entry.watchOpponent=opponent;
 const room={tier:3,host:'local-player',raid:clone(f.real.snapshot.community.raid??{}),members:[]};
 f.entry.roomClient={id:'local-player',room,worldSelection:ids,world:{},action:async()=>room,sync:async()=>{}};
 if(mode==='world')f.entry.allMapsReview=true;
 f.entry.arrivalView={active:false,show(){this.active=true;},hide(){this.active=false;},destroy(){}};
 f.entry.openBattle(mode);const w=f.worlds.at(-1);assert.ok(w);
 Object.assign(w,{setPlaybackSpeed(){},setPaused(){},showRange(){},update(){},updatePresentation(){},syncRunUnits(){},slotWorld(){return {x:0,y:0,z:0};}});
 w.modelsReady=true;f.entry.finishBattleArrival();
 assert.equal(f.entry.battleArrival,undefined,JSON.stringify(f.calls.errors));assert.ok(f.entry.battleScreen,JSON.stringify(f.calls.errors));
 assert.equal(f.entry.arrivalView.active,false);assert.equal(w.visible,true);
});
