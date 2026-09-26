const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
let ts;
for (const candidate of [process.env.GOWAYGUI_TYPESCRIPT, 'typescript', 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)) {
  try { ts = require(candidate); break; } catch {}
}
if (!ts) throw new Error('Home lifecycle tests require the installed Cocos TypeScript compiler');
const view = path.join(__dirname, '../assets/scripts/view');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;
const homeCode = compile(path.join(view, 'HomeWorld.ts'));
const adapterCode = compile(path.join(view, 'TurtleMaterialAdapter.ts'));
const ROLES = ['stone', 'spike', 'crystal', 'leaf', 'bubble'];
const PREFIX = {stone:'StoneAtlas_',spike:'SpikeAtlas_',crystal:'CrystalAtlas_',leaf:'LeafAtlas_',bubble:'BubbleAtlas_'};
const PATHS = Object.fromEntries(ROLES.map(role => [role, `models/${role}-turtle/${role}-turtle/${role}-turtle`]));
PATHS.environment = 'environment/home-island/home-island/home-island';

/** Actual HomeWorld + material adapter, deferred resource/destroy host.
 * Imported clips are serialized fields, not eagerly initialized animation states.
 * Cocos 3.8.8 Animation.onLoad assigns clips only at first scene activation; its
 * setter clears/recreates states. Node activation invokes onLoad before onEnable.
 * Explicit stepping covers that lifecycle/pause contract, not GPU/bone output.
 */
function fixture(t, options = {}) {
  const assets = [], nodes = [], loads = [], instances = [], pendingDestroy = [], prefabs = [];
  let rejectedKind, missingClipKind;
  class Asset {
    constructor(name = '') { this.name=name;this.refs=1;this.isValid=true;this.destroyed=0;assets.push(this); }
    addRef() { assert.ok(this.isValid);this.refs++;return this; }
    decRef() { assert.ok(this.refs>0,'no ref underflow');this.refs--;return this; }
    destroy() { assert.equal(this.destroyed,0,'no double destroy');this.destroyed++;this.isValid=false; }
  }
  class Texture2D extends Asset {}
  class Mesh extends Asset {}
  class Prefab extends Asset { constructor(kind) { super(kind);this.kind=kind;prefabs.push(this); } }
  class Material extends Asset {
    constructor(name) { super(name);this.effectName='util/dcc/imported-specular-glossiness';this.technique=0;this.props={};this.defines={}; }
    copy(source, overrides={}) { this.effectName=source.effectName;this.technique=overrides.technique??source.technique;this.props={...source.props};this.defines={...source.defines,...overrides.defines}; }
    getProperty(name) { return this.props[name]??null; }
    setProperty(name,value) { this.props[name]=value; }
  }
  class Vec3 {
    constructor(x=0,y=0,z=0) { this.set(x,y,z); }
    set(x,y,z) { Object.assign(this,typeof x==='object'?{x:x.x,y:x.y,z:x.z}:{x,y,z});return this; }
  }
  class Vec4 extends Vec3 { constructor(x=0,y=0,z=0,w=0) { super(x,y,z);this.w=w; } }
  class Color { constructor(r,g,b,a) { Object.assign(this,{r,g,b,a}); } }
  class Node extends EventEmitter {
    static EventType={NODE_DESTROYED:'destroyed'};
    constructor(name) { super();this.name=name;this.isValid=true;this.pending=false;this._active=true;this.children=[];this.components=[];this.position=new Vec3();this.scale=new Vec3(1,1,1);this.eulerAngles=new Vec3();nodes.push(this); }
    get active() { return this._active; }
    set active(value) { this._active=!!value;this.syncActivation(); }
    get activeInHierarchy() { return this.isValid&&!this.pending&&this.active&&(this.parent?this.parent.activeInHierarchy:!!this.sceneRoot); }
    syncActivation() {
      for(const component of this.components) {
        if(this.activeInHierarchy)component.hostActivate?.();else component.hostDeactivate?.();
      }
      for(const child of this.children)child.syncActivation();
    }
    setParent(parent) { assert.ok(parent.isValid&&!parent.pending,'no attachment to retired owner');this.removeFromParent();this.parent=parent;parent.children.push(this);this.syncActivation(); }
    removeFromParent() { if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;this.syncActivation();} }
    setPosition(x,y,z) { this.position.set(x,y,z); }
    setScale(x,y,z) { this.scale.set(x,y,z); }
    setRotationFromEuler(x,y,z) { this.eulerAngles.set(x,y,z); }
    addComponent(Type) { const component=new Type();component.node=this;component.isValid=true;this.components.push(component);this.syncActivation();return component; }
    getComponentsInChildren(Type) { return [...this.components.filter(component=>component instanceof Type),...this.children.flatMap(child=>child.getComponentsInChildren(Type))]; }
    destroy() { if(!this.isValid||this.pending)return false;this.pending=true;pendingDestroy.push(this);return true; }
  }
  class MeshRenderer {
    constructor() { this.sharedMaterials=[]; }
    getSharedMaterial(slot) { return this.sharedMaterials[slot]??null; }
    setSharedMaterial(material,slot) { assert.ok(this.isValid&&this.node.isValid&&!this.node.pending,'no retired renderer write');this.sharedMaterials[slot]=material; }
    setMaterial(material,slot) { this.setSharedMaterial(material,slot); }
  }
  const AnimationClip={WrapMode:{Normal:1,Loop:2}};
  class SkeletalAnimation {
    constructor() { this._clips=[];this.states=new Map();this.paused=false;this.played=[];this.loadCount=0;this.enabledInHierarchy=false; }
    get clips() { return this._clips; }
    set clips(clips) {
      this.states.clear();this.current=undefined;this._clips=clips;
      for(const clip of clips)this.createState(clip);
    }
    getState(name) { return this.states.get(name)??null; }
    createState(clip) { const state={name:clip.name,duration:clip.duration,time:0,wrapMode:2};this.states.set(clip.name,state);return state; }
    hostActivate() {
      if(this.enabledInHierarchy)return;
      if(!this.loadCount){this.loadCount++;this.clips=this._clips;}
      this.enabledInHierarchy=true;this.paused=false;
    }
    hostDeactivate() { if(this.enabledInHierarchy){this.enabledInHierarchy=false;this.paused=true;} }
    play(name) { assert.ok(this.node.isValid&&!this.node.pending);this.current=this.getState(name);if(!this.current)return;this.current.time=0;this.paused=false;this.played.push(name); }
    pause() { assert.ok(this.node.isValid&&!this.node.pending);this.paused=true; }
    resume() { assert.ok(this.node.isValid&&!this.node.pending);this.paused=false; }
  }
  const pipeline=new Material('HomePipeline');pipeline.effectName='builtin-standard';
  const sources=Object.fromEntries([...ROLES,'environment'].map(kind=>{
    const material=new Material(kind==='environment'?'HomeEnvironment':PREFIX[kind]+'01');
    material.props={mainTexture:new Texture2D(kind+'-colour'),shininessExponentMap:new Texture2D(kind+'-roughness'),tilingOffset:new Vec4(1,1,0,0)};
    return [kind,material];
  }));
  const borrowed=[...assets];
  const resources={load(name,Type,callback){assert.equal(Type,Prefab);loads.push({name,callback,done:false});}};
  function instantiate(prefab) {
    if(prefab.kind===rejectedKind)throw new Error('controlled instantiate failure');
    const model=new Node(prefab.kind),skin=new Node('Skin');skin.setParent(model);
    const renderer=skin.addComponent(MeshRenderer);renderer.setMaterial(sources[prefab.kind],0);
    let animation;
    if(prefab.kind!=='environment'){
      const rig=new Node('Rig');rig.setParent(model);animation=rig.addComponent(SkeletalAnimation);
      const durations={idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30};
      // FBX prefab deserialization populates _clips without calling the public setter.
      animation._clips=Object.entries(durations).filter(([action])=>prefab.kind!==missingClipKind||action!=='fusion')
        .map(([action,duration])=>({name:prefab.kind+'Turtle_Rig|'+action,duration}));
    }
    instances.push({kind:prefab.kind,model,renderer,animation});return model;
  }
  const cc={AnimationClip,Color,instantiate,Layers:{Enum:{DEFAULT:1}},Material,Mesh,MeshRenderer,Node,Prefab,resources,SkeletalAnimation,Texture2D,Vec3,Vec4,
    isValid:(value,strict)=>!!value?.isValid&&!(strict&&value.pending),
    primitives:{box:()=>({kind:'box'})},utils:{createMesh:()=>new Mesh('HomeOcean')}};
  function load(code,resolve){const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:resolve});return module.exports;}
  const {TurtleMaterialAdapter}=load(adapterCode,name=>{assert.equal(name,'cc');return cc;});
  const {HomeWorld,HOME_CAMERA}=load(homeCode,name=>{
    if(name==='cc')return cc;
    if(name==='./TurtleMaterialAdapter')return {TurtleMaterialAdapter};
    if(name==='./WorldLighting')return {receiveIslandShadows(){}};
    throw new Error('Home must have no battle/save dependency: '+name);
  });
  const parent=new Node('Home owner');parent.sceneRoot=true;parent.active=options.parentActive!==false;
  const world=new HomeWorld(parent,pipeline,options);
  const root=parent.children[0];
  const resolve=(kind,error=false)=>{
    const request=loads.find(request=>request.name===PATHS[kind]&&!request.done);assert.ok(request,'pending '+kind);request.done=true;
    const prefab=error?undefined:new Prefab(kind);request.callback(error?new Error('controlled load failure'):null,prefab);return prefab;
  };
  const flush=()=>{
    function finish(node){
      if(!node.isValid)return;node.pending=true;
      for(const child of [...node.children])finish(child);
      node.emit(Node.EventType.NODE_DESTROYED);node.removeAllListeners();
      for(const component of node.components)component.isValid=false;
      node.isValid=false;node.removeFromParent();node.children=[];
    }
    for(const node of pendingDestroy.splice(0))finish(node);
  };
  const f={world,parent,root,assets,nodes,loads,instances,prefabs,pipeline,sources,borrowed,resolve,flush,HOME_CAMERA,
    all(){for(const kind of [...ROLES,'environment'])resolve(kind);},
    actor(kind){const actor=instances.find(actor=>actor.kind===kind);assert.ok(actor,'created '+kind);return actor;},
    engine(dt){for(const actor of instances)if(actor.animation?.current&&actor.model.activeInHierarchy&&!actor.animation.paused)actor.animation.current.time+=dt;},
    reject(kind){rejectedKind=kind;},missingFusion(kind){missingClipKind=kind;},
    assertReleased(){
      assert.ok([...borrowed,...prefabs].every(asset=>asset.refs===1&&asset.destroyed===0),'borrowed assets remain valid with original refs');
      assert.ok(assets.filter(asset=>!borrowed.includes(asset)&&!prefabs.includes(asset)).every(asset=>asset.destroyed===1),'owned mesh/materials destroyed once');
    },
  };
  t.after(()=>{world.destroy();flush();});
  return f;
}

test('全部六份资源到齐才创建海岛与五个不同正式模型，显式显示后恢复待机',t=>{
  const f=fixture(t);f.world.setVisible(true);
  assert.equal(f.world.ready,false);assert.equal(f.root.active,false);assert.equal(f.loads.length,6);
  assert.equal(f.world.loadProgress.loaded,0);assert.equal(f.world.loadProgress.total,6);
  for(const kind of ROLES){const prefab=f.resolve(kind);assert.equal(prefab.refs,2);assert.equal(f.world.ready,false);assert.equal(f.instances.length,0);}
  assert.equal(f.world.loadProgress.loaded,5);
  f.resolve('environment');assert.equal(f.world.ready,true);assert.equal(f.world.error,undefined);assert.equal(f.root.active,true);
  assert.equal(f.instances.filter(actor=>actor.animation).length,5);
  for(const kind of ROLES){
    const {renderer,animation}=f.actor(kind);assert.equal(renderer.getSharedMaterial(0).effectName,'builtin-standard');
    assert.equal(renderer.getSharedMaterial(0).props.mainTexture,f.sources[kind].props.mainTexture);
    assert.equal(animation.current.name.endsWith('|idle'),true);assert.equal(animation.paused,false);
  }
  f.engine(.2);assert.ok(ROLES.every(kind=>f.actor(kind).animation.current.time===.2));
  f.world.destroy();f.flush();f.assertReleased();
});

test('默认隐藏以及加载中暂停保持骨骼冻结，显示不能覆盖手动暂停',t=>{
  const f=fixture(t);f.world.setPaused(true);f.all();
  assert.equal(f.world.ready,true);assert.equal(f.root.active,false);
  f.engine(3);f.world.update(3);assert.ok(ROLES.every(kind=>f.actor(kind).animation.current===undefined));
  f.world.setVisible(true);assert.ok(ROLES.every(kind=>f.actor(kind).animation.paused));
  f.world.setPaused(false);f.engine(.4);
  const actor=f.actor('stone'),phase=actor.animation.current.time,plays=actor.animation.played.length;
  f.world.setVisible(false);f.engine(3);assert.equal(actor.animation.current.time,phase);
  f.world.setPaused(true);f.world.setVisible(true);assert.equal(actor.animation.paused,true);
  f.world.setPaused(false);f.engine(.2);assert.equal(actor.animation.current.time,phase+.2);
  assert.equal(actor.animation.played.length,plays,'visibility/resume preserves phase without replay');
});

test('隐藏组装不预建或播放state，首次显示由引擎初始化；以后显示沿用原state与播放相位',t=>{
  const f=fixture(t);f.all();assert.equal(f.world.ready,true);assert.equal(f.world.error,undefined);
  for(const kind of ROLES){const animation=f.actor(kind).animation;
    assert.equal(animation.loadCount,0);assert.equal(animation.states.size,0);
    assert.equal(animation.getState(animation.clips[0].name),null);assert.equal(animation.played.length,0);
  }
  f.world.setVisible(true);
  const initial=new Map(ROLES.map(kind=>[kind,f.actor(kind).animation.current]));
  for(const kind of ROLES){const animation=f.actor(kind).animation;
    assert.equal(animation.loadCount,1);assert.equal(animation.states.size,6);
    assert.ok(animation.current?.name.endsWith('|idle'));assert.equal(animation.played.length,1);
  }
  f.engine(.35);f.world.setVisible(false);f.engine(4);f.world.update(4);
  f.world.setPaused(true);f.world.setVisible(true);f.engine(4);
  for(const kind of ROLES){const animation=f.actor(kind).animation;
    assert.equal(animation.current,initial.get(kind));assert.equal(animation.current.time,.35);
    assert.equal(animation.loadCount,1);assert.equal(animation.played.length,1);assert.equal(animation.paused,true);
  }
  f.world.setPaused(false);f.engine(.2);
  for(const kind of ROLES)assert.equal(f.actor(kind).animation.current.time,.55);
});

test('父节点未激活时请求显示仍等待真实onLoad，激活后的首帧启动一次待机',t=>{
  const f=fixture(t,{parentActive:false});f.world.setVisible(true);f.all();
  assert.equal(f.world.ready,true);assert.equal(f.root.active,true);assert.equal(f.root.activeInHierarchy,false);
  f.world.update(1);assert.equal(f.world.greet(),false);
  for(const kind of ROLES){const animation=f.actor(kind).animation;assert.equal(animation.loadCount,0);assert.equal(animation.states.size,0);assert.equal(animation.played.length,0);}
  f.parent.active=true;f.world.update(0);
  for(const kind of ROLES){const animation=f.actor(kind).animation;assert.equal(animation.loadCount,1);assert.ok(animation.current?.name.endsWith('|idle'));assert.equal(animation.played.length,1);}
  f.world.update(.2);assert.equal(f.world.greet('stone'),true);
});

test('单龟招呼不重入，暂停冻结剩余时间；完整长帧后只回一次idle',t=>{
  const f=fixture(t);assert.equal(f.world.greet(),false);f.world.setVisible(true);f.all();
  const animation=f.actor('bubble').animation;
  assert.equal(f.world.greet('bubble'),true);assert.equal(f.world.greet('bubble'),false);
  assert.equal(animation.current.name.endsWith('|fusion'),true);assert.equal(animation.current.wrapMode,1);
  assert.ok(ROLES.filter(kind=>kind!=='bubble').every(kind=>f.actor(kind).animation.current.name.endsWith('|idle')));
  f.engine(.4);f.world.update(.4);f.world.setPaused(true);
  f.engine(20);f.world.update(20);assert.equal(animation.current.time,.4);assert.equal(animation.current.name.endsWith('|fusion'),true);
  f.world.setPaused(false);f.world.setVisible(false);f.world.update(20);assert.equal(animation.current.name.endsWith('|fusion'),true);
  f.world.setVisible(true);f.world.update(NaN);f.world.update(-1);assert.equal(animation.current.name.endsWith('|fusion'),true);
  f.engine(2);f.world.update(2);
  assert.equal(animation.current.name.endsWith('|idle'),true);assert.equal(animation.current.wrapMode,2);
  const plays=animation.played.length;f.world.update(10);assert.equal(animation.played.length,plays);
  assert.equal(f.world.greet('bubble'),true,'completed actor can greet again');
});

test('减少动态直接保持idle，不启动招呼或新增节点',t=>{
  const f=fixture(t,{reducedMotion:true});f.world.setVisible(true);f.all();
  const count=f.nodes.length;assert.equal(f.world.greet(),false);f.world.update(20);
  assert.equal(f.nodes.length,count);assert.ok(ROLES.every(kind=>f.actor(kind).animation.played.length===1));
});

test('减少动态设置立即结束正在播放的五龟招呼，保留后台暂停并支持重新开启',t=>{
  const f=fixture(t);f.world.setVisible(true);f.all();assert.equal(f.world.greet(),true);
  f.engine(.4);f.world.update(.4);f.world.setPaused(true);f.world.setReducedMotion(true);
  for(const kind of ROLES){const animation=f.actor(kind).animation;assert.ok(animation.current.name.endsWith('|idle'));assert.equal(animation.paused,true);}
  const plays=f.actor('stone').animation.played.length;
  f.world.setReducedMotion(true);assert.equal(f.actor('stone').animation.played.length,plays,'idempotent setting does not restart idle');
  f.world.setPaused(false);assert.equal(f.world.greet(),false);
  f.world.setReducedMotion(false);assert.equal(f.world.greet(),true);
  f.world.update(4);assert.ok(ROLES.every(kind=>f.actor(kind).animation.current.name.endsWith('|idle')));
});

test('任一加载失败释放先到资源，晚回调和显示请求不能复活首页',t=>{
  const f=fixture(t);f.world.setVisible(true);const stone=f.resolve('stone');f.resolve('spike',true);
  assert.equal(f.world.ready,false);assert.match(f.world.error.message,/controlled load failure/);assert.equal(stone.refs,1);
  const nodes=f.nodes.length;
  for(const kind of ['crystal','leaf','bubble','environment'])assert.equal(f.resolve(kind).refs,1);
  f.world.setVisible(true);f.world.setPaused(false);assert.equal(f.world.greet(),false);f.world.update(10);
  f.flush();assert.equal(f.nodes.length,nodes);assert.equal(f.instances.length,0);assert.equal(f.root.isValid,false);
  f.world.destroy();f.world.destroy();f.assertReleased();
});

test('中途组装失败回滚已适配模型、六Prefab和外海资源',t=>{
  for(const mode of ['instantiate','missing-clip']){
    const f=fixture(t);if(mode==='instantiate')f.reject('crystal');else f.missingFusion('crystal');
    f.world.setVisible(true);f.all();
    assert.equal(f.world.ready,false);assert.ok(f.world.error);assert.equal(f.root.active,false);
    f.flush();assert.ok(f.instances.every(actor=>!actor.model.isValid));f.assertReleased();
  }
});

test('加载中销毁及父节点提前离开都不接收迟到资源，重复回调不重复持有',t=>{
  for(const destroyOwner of [false,true]){
    const f=fixture(t),stone=f.resolve('stone');
    f.loads.find(load=>load.name===PATHS.stone).callback(null,stone);assert.equal(stone.refs,2);
    if(destroyOwner)f.parent.destroy();else f.world.destroy();
    const nodes=f.nodes.length;
    for(const kind of ['spike','crystal','leaf','bubble','environment'])assert.equal(f.resolve(kind).refs,1);
    f.flush();assert.equal(f.world.ready,false);assert.equal(f.nodes.length,nodes);assert.equal(f.instances.length,0);
    f.world.setVisible(true);f.world.setPaused(false);assert.equal(f.world.greet(),false);f.world.update(10);
    f.assertReleased();
  }
});

test('就绪后父节点销毁自动释放全部引用，后续destroy和招呼安全幂等',t=>{
  const f=fixture(t);f.world.setVisible(true);f.all();f.world.greet();
  f.parent.destroy();assert.equal(f.world.ready,false);assert.equal(f.world.greet(),false);
  f.world.setPaused(false);f.assertReleased();
  f.flush();f.assertReleased();assert.ok(f.instances.every(actor=>!actor.model.isValid));
  f.world.destroy();f.world.destroy();f.world.setVisible(true);f.world.setPaused(false);f.world.update(20);
  f.assertReleased();
});
