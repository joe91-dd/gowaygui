const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
const builtModules=new Map();
if(process.env.GOWAYGUI_PRESENTATION_BUILD){
  const built=path.join(process.env.GOWAYGUI_PRESENTATION_BUILD,'assets/main/index.js');
  vm.runInNewContext(fs.readFileSync(built,'utf8'),{System:{register:(name,deps,declare)=>builtModules.set(name,{deps,declare})}});
}
function load(name,deps={}){
  if(builtModules.size){
    const id='chunks:///_virtual/'+path.basename(name)+'.ts',record=builtModules.get(id),exports={};
    assert.ok(record,'missing delivered module: '+id);
    const body=record.declare((name,value)=>{if(typeof name==='object')Object.assign(exports,name);else exports[name]=value;return value;});
    record.deps.forEach((dependency,i)=>{
      const key=Object.keys(deps).find(k=>k===dependency||k.startsWith('.')&&path.basename(k)+'.ts'===path.basename(dependency));
      body.setters[i](key?deps[key]:{});
    });body.execute();return exports;
  }
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts',name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,console,require:id=>deps[id]??{}});return module.exports;
}
const layout=load('view/DisplayLayout');
function fixture(width=2400,height=1080){
  const cameras=[],handlers=[];
  class Node{
    constructor(name){this.name=name;this.children=[];this.components=new Map();this.isValid=true;this.active=true;this.scale={x:1,y:1,z:1};}
    setParent(p){this.parent=p;p.children.push(this);}
    setPosition(x,y,z=0){this.position={x,y,z};}lookAt(){}
    setScale(x,y,z){this.scale={x,y,z};}
    setSiblingIndex(){}on(){}once(event,fn){(this.events??=new Map()).set(event,fn);}
    get scene(){return this.parent?this.parent.scene:this;}
    getChildByName(name){return this.children.find(n=>n.name===name);}
    addComponent(Type){const c=new Type();c.node=this;this.components.set(Type,c);return c;}
    getComponent(Type){return this.components.get(Type);}
    destroy(){this.isValid=false;for(const child of this.children)child.destroy();this.events?.get('destroy')?.();}
  }
  Node.EventType={NODE_DESTROYED:'destroy'};
  class Camera{constructor(){cameras.push(this);this.priority=0;}}
  Camera.ProjectionType={ORTHO:1,PERSPECTIVE:0};Camera.ClearFlag={SOLID_COLOR:7,DEPTH_ONLY:6};
  class UITransform{setContentSize(width,height){this.width=width;this.height=height;}}
  class Canvas{}
  class Graphics{clear(){}rect(x,y,w,h){this.rectValue={x,y,w,h};}fill(){}roundRect(){}stroke(){}circle(){}}
  class Color{static fromHEX(){} }
  const screen={windowSize:{width,height}},resolution={};
  const view={getVisibleSize:()=>({width:screen.windowSize.width/(screen.windowSize.height/720),height:720}),getScaleX:()=>screen.windowSize.height/720,getScaleY:()=>screen.windowSize.height/720,
    setDesignResolutionSize:(w,h,policy)=>Object.assign(resolution,{width:w,height:h,policy}),
    on:(name,callback,target)=>handlers.push({name,callback,target}),off:(name,callback)=>{const i=handlers.findIndex(h=>h.name===name&&h.callback===callback);if(i>=0)handlers.splice(i,1);}};
  const cc={Node,Camera,Canvas,Graphics,Color,UITransform,Vec3:class{},Vec4:class{},Material:class{},BlockInputEvents:class{},cclegacy:{_RF:{push(){},pop(){}}},
    Component:class{},_decorator:{ccclass:()=>x=>x,property:()=>()=>{}},
    Layers:{Enum:{UI_2D:1<<25,DEFAULT:1<<30}},isValid:n=>!!n?.isValid,screen,view,
    Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},game:{on(){}},profiler:{hideStats(){}},
    assetManager:{downloader:{},presets:{default:{},preload:{},scene:{}}},
    ResolutionPolicy:{SHOW_ALL:2,FIXED_HEIGHT:3},sys:{isNative:true,os:'Android',OS:{ANDROID:'Android'},localStorage:{}},resources:{load(){}}};
  class UI{
    constructor(root){this.root=root;this.click=()=>{};}
    group(name,x=0,y=0,parent=this.root,w=0,h=0){const n=new Node(name);n.setParent(parent);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);return n;}
    text(){return {string:''};}panel(x,y,w,h,parent){return this.group('panel',x,y,parent,w,h);}
  }
  const deps={'cc':cc,'cc/env':{DEBUG:true},'./DisplayLayout':layout,'./IslandUI':{IslandUI:UI,color:()=>new Color()}};
  return {cc,deps,cameras,handlers,screen,view,resolution,UI,Node,Camera,UITransform};
}

test('Actual Android bootstrap gives world/UI nonnegative ordered camera priorities and a full-height viewport',async()=>{
  const f=fixture(),scene=new f.Node('Main'),main=new f.Node('Main Camera');main.setParent(scene);main.addComponent(f.Camera);
  class Preload{preload(){} }
  class Service{constructor(){this.snapshot={revision:1};this.settingsSnapshot={};}enablePrototype(){}enableIncrement(){}enableLiving(){}refreshClock(){}enablePatrol(){} }
  const storage={getItem:()=> 'existing-save',setItem(){}};
  Object.assign(f.deps,{
    '../platform/runtimeQuery':{runtimeQuery:()=>({get:()=>null})},'./LocalDiagnostics':{LocalDiagnostics:class{constructor(){this.enabled=false;}}},
    './RenderBudget':{softwareRendering:()=>false},'./IslandIcons':{IslandIcons:Preload},'./IslandPanels':{IslandPanels:Preload},'./TurtlePortraits':{TurtlePortraits:Preload},
    './PearlBattleArt':{PearlBattleArt:{preload(){}}},'./ArtV2Assets':{ArtV2Assets:Preload},'./IslandArrival':{IslandArrival:class{show(){}}},
    './HomeWorld':{HOME_CAMERA:{position:[0,8,12],target:[0,0,0]}},'./WorldLighting':{lightIsland(){}},
    '../platform/AccountClient':{accountStorage:()=>storage,AccountClient:class{}},'../platform/localSession':{acquireLocalSession:async()=>({storage})},
    '../core/save':{SAVE_KEY:'save',SaveRepository:class{}},'../core/game':{GameService:Service},'./RoomClient':{RoomClient:class{}},
    './IslandAudio':{IslandAudio:class{unlock(){}}}
  });
  const {GameEntry}=load('view/GameEntry',f.deps),entry=new GameEntry();entry.node=new f.Node('Entry');entry.node.setParent(scene);
  entry.resizeViewport=()=>{};entry.bindUiAudio=()=>{};entry.beginHomeArrival=()=>{};entry.render=()=>{};
  await entry.initialize();
  assert.equal(f.resolution.policy,f.cc.ResolutionPolicy.FIXED_HEIGHT);
  assert.equal(f.cc.game.frameRate,30);
  assert.equal(f.cc.assetManager.downloader.maxConcurrency,2);
  for(const preset of Object.values(f.cc.assetManager.presets))assert.equal(preset.maxConcurrency,2);
  const world=main.getComponent(f.Camera),ui=entry.uiCamera.getComponent(f.Camera);
  const {ArtV2Backdrop}=load('view/ArtV2Backdrop',f.deps);new ArtV2Backdrop(scene,{});
  const backdrop=f.cameras.at(-1);
  for(const c of [backdrop,world,ui])assert.ok(Number.isInteger(c.priority)&&c.priority>=0&&c.priority<=65535);
  // Matches Camera.h uint32_t and Root.cpp's ascending native render order.
  const nativeOrder=[['world',world],['UI',ui],['background',backdrop]].sort((a,b)=>(a[1].priority>>>0)-(b[1].priority>>>0)).map(([name])=>name);
  assert.deepEqual(nativeOrder,['background','world','UI'],'a background drawn last hides all controls');
  assert.equal(entry.nativeTrial,true);
});

for(const width of [1920,2340,2400])test(`Secondary-page scenery and touch veils fill ${width} x 1080 without stretching cards`,()=>{
  const f=fixture(width,1080),root=new f.Node('UI'),{IslandUI}=load('view/IslandUI',f.deps);
  const art={ready:true,attach(){return {};}};const ui=new IslandUI(root,()=>{},undefined,undefined,undefined,art),buttons=[];
  // GPU drawing is outside this test. Use the real page/group/scenery layout.
  ui.panel=(x,y,w,h,parent)=>ui.group('panel',x,y,parent,w,h);
  ui.text=ui.decoration=ui.line=ui.atmosphere=()=>{};
  ui.button=(label,x,y,w,h,action,options)=>{buttons.push({x,y,w,h});return ui.group(label,x,y,options.parent,w,h);};
  const panel=ui.sheet('伙伴',undefined,()=>{}),veil=panel.parent,background=veil.getChildByName('自适应场景背景');
  const viewport=width/1.5;
  assert.equal(veil.getComponent(f.UITransform).width,viewport);
  assert.equal(panel.getComponent(f.UITransform).width,viewport-80);
  assert.equal(background.scale.x,background.scale.y);assert.ok(background.scale.x*1280>=viewport-.01);
  assert.ok(buttons[0].x+buttons[0].w/2<=viewport/2-40);assert.equal(buttons[0].w,144);
  const content=ui.sceneSheet('海岛副本',()=>{}),scene=content.parent;
  assert.equal(scene.getComponent(f.UITransform).width,viewport);
  assert.equal(content.getComponent(f.UITransform).width,viewport-80);
  root.destroy();assert.equal(f.handlers.length,0,'page listeners must not accumulate between navigations');
});

test('The old negative background priority reproduces the Android-only overdraw regression',()=>{
  const nativeOrder=[['background',-5],['world',0],['UI',10]].sort((a,b)=>(a[1]>>>0)-(b[1]>>>0)).map(([name])=>name);
  assert.deepEqual(nativeOrder,['world','UI','background']);
});

for(const [width,height] of [[1280,720],[1920,1080],[2340,1080],[2400,1080],[2520,1080]]){
  test(`Background covers ${width} x ${height} without nonuniform stretching or moving the UI`,()=>{
    const f=fixture(width,height),scene=new f.Node('Scene');
    const {ArtV2Backdrop}=load('view/ArtV2Backdrop',f.deps),backdrop=new ArtV2Backdrop(scene,{});
    const content=scene.getChildByName('V2海岛远景').getChildByName('远景原画'),s=content.scale;
    assert.equal(s.x,s.y);assert.ok(1280*s.x>=width/f.view.getScaleX()-.00001);assert.ok(720*s.y>=720);
    const {IslandArrival}=load('view/IslandArrival',f.deps),arrival=new IslandArrival(new f.UI(scene));
    const arrivalRoot=scene.getChildByName('统一海岛过渡'),art=arrivalRoot.getChildByName('伙伴启航原画');
    assert.equal(art.scale.x,art.scale.y);assert.ok(1280*art.scale.x>=width/f.view.getScaleX()-.00001);
    assert.equal(arrivalRoot.getChildByName('登录页原画字标').position.x,-355,'controls keep the existing design coordinates');
    f.screen.windowSize={width:height*16/9,height};
    for(const h of f.handlers.filter(h=>h.name==='canvas-resize'))h.callback.call(h.target);
    assert.equal(content.scale.x,1);assert.equal(art.scale.x,1);
    backdrop.destroy();arrival.destroy();assert.equal(f.handlers.length,0);
  });
}
