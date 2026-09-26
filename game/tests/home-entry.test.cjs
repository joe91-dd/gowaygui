const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Home entry tests require the installed Cocos TypeScript compiler');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/GameEntry.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText;

// Execute the real entry, including initialization/navigation and real UI handlers.
// The resource owner is controlled here; its actual prefab/material/skeleton lifetime
// is independently exercised in home-world.test.cjs. This is not a GPU/importer test.
function fixture(t,reviewSearch){
  const calls={acquire:0,repository:0,service:0,audio:0,close:0,clock:0,begin:0,reward:0,clear:0,ready:0,panelsLoad:0,portraitsLoad:0,iconsLoad:0,panelsDestroy:0,portraitsDestroy:0,iconsDestroy:0};
  const homes=[],worlds=[],controllers=[],loads=[],buttons=new Map(),labels=[],titles=[],scheduled=[],errors=[];
  const snapshot={revision:7,gold:900,stamina:25,settings:{music:.65,effects:.7,reducedMotion:false},collection:{},history:{},
    unlockedLevel:0,cleared:[],dailyAds:{counts:{stamina:0},total:0},run:undefined};
  function emitter(){const handlers=[];return{on(event,fn,owner){handlers.push({event,fn,owner});},off(event,fn,owner){for(let i=handlers.length-1;i>=0;i--)if(handlers[i].event===event&&handlers[i].fn===fn&&handlers[i].owner===owner)handlers.splice(i,1);},emit(event){for(const h of [...handlers])if(h.event===event)h.fn.call(h.owner);}};}
  class Node{
    constructor(name=''){this.name=name;this.isValid=true;this.active=true;this.children=[];this.components=[];}
    get scene(){return this.parent?this.parent.scene:this;}
    setParent(parent){this.removeFromParent();this.parent=parent;parent.children.push(this);}
    removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=undefined;}
    setPosition(...values){this.position=values;}lookAt(target){this.target=target;}
    addComponent(Type){const component=new Type();component.node=this;component.isValid=true;this.components.push(component);return component;}
    getComponent(Type){return this.components.find(component=>component instanceof Type);}
    getChildByName(name){return this.children.find(node=>node.name===name);}
    destroy(){if(!this.isValid)return;this.active=false;this.isValid=false;for(const component of this.components)component.isValid=false;for(const child of [...this.children])child.destroy();this.removeFromParent();}
  }
  class Camera{static ProjectionType={ORTHO:1};static ClearFlag={DEPTH_ONLY:1};}
  class UITransform{setContentSize(){}}
  class Label{constructor(){this.string='';this.isValid=true;}}
  class UI{
    constructor(root,click,icons,panels,portraits){this.root=root;this.click=click;this.icons=icons;this.panels=panels;this.portraits=portraits;if(panels||portraits){assert.equal(icons?.ready,true,'formal UI requires the eight-icon atlas');assert.equal(panels?.state,'ready');assert.equal(portraits?.ready,true,'formal UI requires all five portraits');}}
    clear(){calls.clear++;for(const child of [...this.root.children])child.destroy();buttons.clear();}
    panel(x,y,w,h,parent=this.root){if(this.panels)assert.equal(this.panels.state,'ready');const node=new Node('Panel');node.setParent(parent);return node;}
    modal(title){titles.push(title);const scrim=this.panel(),panel=this.panel(0,0,0,0,scrim);return panel;}
    label(text,x,y,size,color,parent=this.root){const node=new Node('Label');node.setParent(parent);const label=node.addComponent(Label);label.string=text;labels.push(label);return label;}
    text(text,x,y,size,color,parent=this.root,width,height,wrap){const label=this.label(text,x,y,size,color,parent,width,height);if(parent.buttonRecord?.text==='')buttons.set(text,parent.buttonRecord);return label;}
    dialog(title,...args){return this.sheet(title,...args);}
    sceneSheet(title,close){return this.sheet(title,'',close);}
    scenicCard(image,x,y,w,h,title,caption,action,parent,disabled){return this.button(title,x,y,w,h,action,{parent,disabled});}
    sheet(title,subtitle='',close,closeText='返回'){const p=this.modal(title,subtitle);if(close)this.button(closeText,470,276,188,64,close,{parent:p});return p;}
    button(text,x,y,w,h,callback,options={}){const node=new Node(text);node.setParent(options.parent||this.root);node.buttonRecord={text,callback,options,node};buttons.set(text,node.buttonRecord);return node;}
    card(role,title,middle,bottom,x,y,action,options={}){const p=this.button(title,x,y,360,176,action,options);this.roleMark(role,0,0,52,p);this.label(middle,0,0,28,undefined,p);this.label(bottom,0,0,28,undefined,p);return p;}
    portrait(role,x,y,side=104,parent=this.root){return this.roleMark(role,x,y,side/2,parent);}
    icon(){}progress(){}roleMark(){if(this.portraits)assert.equal(this.portraits.ready,true);}skillPill(){}
  }
  class Panels{
    constructor(){this.state='idle';this.generation=0;}
    preload(){if(this.promise)return this.promise;calls.panelsLoad++;this.state='loading';this.generation++;return this.promise=new Promise(resolve=>{this.resolve=resolve;});}
    finish(success=true){this.state=success?'ready':'failed';this.resolve?.(success);}
    retry(){if(this.state==='failed'){this.promise=undefined;this.state='idle';}return this.preload();}
    destroy(){if(this.state==='destroyed')return;calls.panelsDestroy++;this.state='destroyed';this.resolve?.(false);}
  }
  class Portraits{
    constructor(){this.state='idle';this.loadedCount=0;}
    get ready(){return this.state==='ready';}
    preload(){if(this.state!=='idle')return;calls.portraitsLoad++;this.state='loading';}
    finish(success=true){this.state=success?'ready':'failed';this.loadedCount=success?5:0;this.error=success?null:'controlled portrait failure';}
    retry(){if(this.state==='failed'){this.state='idle';this.preload();}}
    destroy(){if(this.state==='destroyed')return;calls.portraitsDestroy++;this.state='destroyed';}
  }
  class Icons{
    constructor(){this.state='idle';this.error=null;}
    get ready(){return this.state==='ready';}
    preload(){if(this.state!=='idle')return;calls.iconsLoad++;this.state='loading';this.error=null;}
    finish(success=true){this.state=success?'ready':'failed';this.error=success?null:'controlled icon failure';}
    retry(){if(this.state==='failed'){this.state='idle';this.preload();}}
    destroy(){if(this.state==='destroyed')return;calls.iconsDestroy++;this.state='destroyed';}
  }
  class Home{
    constructor(parent,pipeline,options){this.ready=false;this.loadProgress={loaded:0,total:6};this.visible=false;this.paused=false;this.reducedMotion=!!options.reducedMotion;this.disposed=false;this.greetings=0;this.elapsed=0;homes.push(this);if(calls.failHomeConstructor)throw new Error('controlled constructor failure');}
    setVisible(value){
      assert.equal(this.disposed,false,'no presentation write to old owner');this.visible=value;
      if(value&&this.ready&&!this.activation){
        this.activation={paused:this.paused,interfaceReady:entry.interfaceReady,arrival:entry.homeArrival,panels:entry.ui.panels};
        if(calls.failHomeActivation){this.error=new Error('controlled first activation failure');this.ready=false;this.visible=false;this.paused=true;}
      }
    }
    setPaused(value){assert.equal(this.disposed,false);this.paused=value;}
    setReducedMotion(value){assert.equal(this.disposed,false);this.reducedMotion=value;}
    greet(){if(this.paused||!this.visible||!this.ready||this.reducedMotion)return false;this.greetings++;return true;}
    update(dt){if(this.ready&&this.visible&&!this.paused)this.elapsed+=dt;}
    destroy(){if(this.disposed)return;this.disposed=true;this.ready=false;this.visible=false;this.paused=true;this.destroyCount=(this.destroyCount||0)+1;}
  }
  class World{
    constructor(){this.modelsReady=false;this.visible=false;worlds.push(this);}
    setVisible(value){if(value){this.homeDisposedAtActivation=homes.at(-1)?.disposed;if(calls.failBattleActivation)throw new Error('controlled battle activation failure');}this.visible=value;}setOceanTexture(){}setLevel(id){this.level=id;}setEnvironment(value){this.environment=value;this.environmentWrites=(this.environmentWrites||0)+1;}destroy(){this.disposed=true;this.visible=false;}
  }
  class BattleScreen{
    constructor(owner,service,ui,world,camera,audio,command,onHome,onError){
      if(calls.failBattleController)throw new Error('controlled battle controller failure');
      assert.equal(world.modelsReady,true);assert.ok(world.environment);assert.equal(world.visible,false);
      this.homeAtConstruction=owner.homeWorld;this.homeDisposedAtConstruction=owner.homeWorld?.disposed;
      this.world=world;this.onHome=onHome;this.onError=onError;this.checkpoints=0;this.steps=0;controllers.push(this);ui.clear();
      // Real BattleScreen construction can call showPause -> checkpoint -> onError.
      if(calls.failBattleCheckpoint)onError(new Error('controlled constructor checkpoint failure'));
    }
    update(){this.steps++;}render(){}hide(){}show(){}
    checkpoint(){if(calls.failCheckpoint)throw new Error('controlled checkpoint failure');this.checkpoints++;}
    destroy(){this.disposed=true;this.world.destroy();}
  }
  class Service{
    constructor(){calls.service++;this.snapshot=snapshot;}
    enablePrototype(){} enableLiving(){}enableIncrement(){} // This fixture isolates resource ownership; real migration is tested separately.
    refreshClock(){calls.clock++;}
    updateSettings(command,patch){Object.assign(snapshot.settings,patch);return snapshot.settings;}
    beginRun(){calls.begin++;throw new Error('unexpected adventure entry');}
    simulateAd(){calls.reward++;throw new Error('unexpected reward');}
  }
  class Audio{
    constructor(){calls.audio++;this.paused=false;}pause(){this.paused=true;}resume(){this.paused=false;}
    update(){}destroy(){this.disposed=true;}playMusic(){return Promise.resolve();}apply(){}effect(){}unlock(){}
  }
  class Diagnostics{constructor(){this.enabled=false;}recordFrame(){}markReady(){calls.ready++;}destroy(){}}
  const engine=emitter(),view=Object.assign(emitter(),{setDesignResolutionSize(){},getScaleY(){return 1;}}),windowSize={width:1280,height:720};
  const cc={_decorator:{ccclass:()=>Type=>Type,property:()=>()=>{}},Component:class{scheduleOnce(fn){scheduled.push(fn);}},Node,Camera,Canvas:class{},UITransform,Label,Material:class{},Prefab:class{},
    Vec3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},Color:class{},Layers:{Enum:{UI_2D:2,DEFAULT:1}},
    isValid:value=>!!value?.isValid,view,game:engine,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},screen:{windowSize},
    sys:{localStorage:{},isMobile:false},ResolutionPolicy:{SHOW_ALL:0},profiler:{showStats(){},hideStats(){}},
    resources:{load(name,Type,callback){loads.push({name,callback});}},
  };
  let resolveSession;
  const sessionPromise=new Promise(resolve=>{resolveSession=resolve;});
  const session={storage:{},close(){calls.close++;}};
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,URLSearchParams,...(reviewSearch?{location:{search:reviewSearch}}:{}),console:{info(){},error(...args){errors.push(args);}},require(name){
    if(name==='./ProfileAvatar')return {avatarPicker(){},paintAvatar(){}};if(name==='cc')return cc;
    if(name==='./RenderBudget')return{softwareRendering:()=>false};
    if(name==='./ApprovedCastReviewScreen')return{ApprovedCastReviewScreen:class{}};
    if(['../core/petAccess','../core/arena','../core/allMapsReview'].includes(name))return require('../.test-build/core/'+path.basename(name)+'.js');
    if(name==='../core/economy'||name==='../core/community'||name==='../core/prototype'||name==='../core/prototypeConfig')return require('../.test-build/core/'+path.basename(name)+'.js');
    if(name==='./PrototypeMenus')return{PrototypeMenus:class{resume(){return false;}}};
    if(name==='../platform/AccountClient')return{accountStorage:s=>s,AccountClient:class{save(){return Promise.resolve();}}};
    if(name==='./TaskMenus')return{TaskMenus:class{}};
    if(name==='./IslandUI')return{IslandUI:UI,UI_COLORS:{}};
    if(name==='./SeaChart')return{SeaChart:class{}};
    if(name==='../core/endlessRewards')return require('../.test-build/core/endlessRewards.js');
    if(name==='./ChapterMap')return{renderChapterMap(){}};
    if(name==='./IslandArrival')return{IslandArrival:class{
      constructor(ui){this.ui=ui;this.active=false;this.status='';}
      show(failed=false,retry,back){this.active=true;this.status=failed?'暂未抵达，再试一次':'即将抵达…';titles.push(this.status);buttons.clear();if(back)this.ui.button('返回海岛',0,0,0,0,back);if(failed&&retry)this.ui.button('重新加载',0,0,0,0,retry);}
      hide(){this.active=false;}update(){}destroy(){this.active=false;}
    }};
    if(name==='./IslandIcons')return{IslandIcons:Icons};
    if(name==='./IslandAudio')return{IslandAudio:Audio};
    if(name==='./IslandPanels')return{IslandPanels:Panels};
    if(name==='./TurtlePortraits')return{TurtlePortraits:Portraits};
    // This suite isolates the retained 3D home lifecycle. The separately tested
    // V2 presentation layer is removed after initialization, before any frame.
    if(name==='./ArtV2Assets')return{ArtV2Assets:class{preload(){}destroy(){}}};
    if(name==='./CompanionMotion')return{CompanionMotion:class{update(){}}};
    if(name==='./ArtV2Backdrop')return{ArtV2Backdrop:class{show(){}update(){}destroy(){}}};
    if(name==='./VisualIdentity')return{HERO_LOOK:{},visualName:t=>t.name};
    if(name==='./HomeChat')return{homeChat(){}};
    if(name==='./LocalDiagnostics')return{LocalDiagnostics:Diagnostics};
    if(name==='./WorldLighting')return{lightIsland(){}};
    if(name==='./HomeWorld')return{HomeWorld:Home,HOME_CAMERA:{position:[1.8,8.2,12.8],target:[-.45,.9,0],baseVerticalFovDegrees:38}};
    if(name==='./BattleWorld')return{BattleWorld:World};
    if(name==='./BattleScreen')return{BattleScreen};
    if(name==='./ChallengeScreen')return{ChallengeScreen:BattleScreen};
    if(name==='./AchievementMenus')return{AchievementMenus:class{}};if(name==='./CommunityMenus')return{CommunityMenus:class{}};
    if(name==='../platform/localSession')return{acquireLocalSession(){calls.acquire++;return sessionPromise;}};
    if(name==='../core/skillBooks')return require('../.test-build/core/skillBooks.js');
    if(name==='../core/game')return{GameService:Service,displayName:t=>t.name};
    if(name==='../core/save')return{SaveRepository:class{constructor(){calls.repository++;}}};
    if(name==='../core/mapPresentation')return require('../.test-build/core/mapPresentation.js');if(name==='../core/data')return{BATTLE_MAPS:require('../.test-build/core/data.js').BATTLE_MAPS,LEVELS:[{id:0,name:'初遇',subtitle:'教学'}],
      ROLES:Object.fromEntries([['stone','石头龟','抵挡','male'],['spike','刺刺龟','远程','male'],['crystal','水晶龟','爆发','female'],['leaf','叶子龟','治疗','male'],['bubble','泡泡龟','控制','female']].map(([id,name,job,gender])=>[id,{id,name,job,gender}])),
      MATERIAL_NAMES:{attack:'攻击药',health:'生命药',defense:'防御药',growth:'成长药'},SKILL_BY_ID:{}};
    if(name==='./SkeletalReviewScreen')return {SkeletalReviewScreen:class{constructor(){calls.review=(calls.review??0)+1;}async initialize(){calls.reviewReady=(calls.reviewReady??0)+1;}update(){calls.reviewFrames=(calls.reviewFrames??0)+1;}resize(){}destroy(){calls.reviewDestroyed=(calls.reviewDestroyed??0)+1;}}};if(name==='./WorldBossScreen')return {WorldBossScreen:class{}};if(name==='./WorldBossMenus')return {WorldBossMenus:class{}};if(name==='./RoomClient')return {RoomClient:class{sync(){return Promise.resolve();}}};if(name==='./RoomMenus')return {RoomMenus:class{}};if(name==='./LiveRaidScreen')return {LiveRaidScreen:class{}};if(name==='./ArenaWatchScreen')return {ArenaWatchScreen:class{}};if(name==='./PetDetails')return {PetDetails:class{},talentStars(){}};if(name==='./RewardMenus')return {RewardMenus:class{}};if(name==='../core/development')return require('../.test-build/core/development.js');if(name==='../core/raids')return require('../.test-build/core/raids.js');throw new Error('Unexpected entry dependency '+name);
  }});
  const entry=new module.exports.GameEntry(),scene=new Node('Scene'),owner=new Node('GameEntry');owner.setParent(scene);
  const camera=new Node('Main Camera');camera.setParent(scene);camera.addComponent(Camera);entry.node=owner;entry.pipelineMaterial={};
  const f={entry,scene,camera,homes,worlds,controllers,loads,buttons,labels,titles,calls,snapshot,engine,windowSize,errors,
    async boot(uiReady=true){entry.start();resolveSession(session);await entry.initialization;entry.art=undefined;if(uiReady&&!entry.disposed){entry.panels.finish();entry.portraits.finish();entry.icons.finish();}},
    async resolveSession(uiReady=true){resolveSession(session);await entry.initialization;entry.art=undefined;if(uiReady&&!entry.disposed){entry.panels.finish();entry.portraits.finish();entry.icons.finish();}},
    frame(dt=.05){entry.update(dt);},
    ready(){const home=homes.at(-1);home.loadProgress.loaded=6;home.ready=true;entry.update(.01);return home;},
    enterBattle(){snapshot.run={levelId:0,phase:'combat',battle:{}};entry.openBattle();const world=worlds.at(-1);world.modelsReady=true;loads.at(-1).callback(null,{name:'island'});entry.update(.01);return controllers.at(-1);},
    click(text){const button=buttons.get(text);assert.ok(button,'button '+text);assert.ok(button.node.isValid);assert.equal(!!button.options.disabled,false,'enabled '+text);button.callback();},
    flushScheduled(){for(const fn of scheduled.splice(0))fn();},
    unchanged(){assert.equal(snapshot.gold,900);assert.equal(snapshot.stamina,25);assert.equal(snapshot.revision,7);assert.equal(calls.begin,0);assert.equal(calls.reward,0);assert.equal(calls.acquire,1);assert.equal(calls.service,1);assert.equal(calls.repository,1);assert.equal(calls.audio,1);},
  };
  t.after(()=>entry.onDestroy());return f;
}

test('初次实际加载前不开放空首页，玩家状态更新不重建UI，ready仅撤掉一次加载界面',async t=>{
  const f=fixture(t);f.entry.start();f.entry.start();await f.resolveSession();
  assert.equal(f.homes.length,1);assert.equal(f.buttons.size,0);assert.equal(f.titles.at(-1),'即将抵达…');
  const home=f.homes[0],overlay=f.entry.arrivalView,clears=f.calls.clear;
  assert.equal(overlay.status,'即将抵达…');assert.equal(home.visible,false);assert.equal(home.paused,true);
  home.loadProgress.loaded=4;f.frame();assert.equal(f.entry.arrivalView,overlay);assert.equal(overlay.active,true);assert.equal(f.calls.clear,clears);
  f.ready();assert.equal(home.visible,true);assert.equal(home.paused,false);assert.ok(f.buttons.has('开始冒险'));assert.equal(f.buttons.has('打个招呼'),false);
  assert.equal(f.buttons.has('转动看看'),false);assert.equal(f.calls.clear,clears+1);assert.equal(overlay.active,false);
  assert.equal(f.entry.ui.panels,f.entry.panels);assert.equal(f.entry.ui.portraits,f.entry.portraits);
  for(let i=0;i<5;i++)f.frame();f.flushScheduled();assert.equal(f.calls.clear,clears+1);assert.equal(f.calls.ready,1);f.unchanged();
});

test('会话仍在等待时进入后台，加载完成不会提前显示或计时，回前台后才开放首页',async t=>{
  const f=fixture(t);f.entry.start();f.engine.emit('hide');await f.resolveSession();const home=f.homes[0];
  assert.equal(f.entry.audio.paused,true);f.ready();assert.equal(home.visible,false);assert.equal(home.elapsed,0);assert.equal(f.buttons.size,0);
  f.engine.emit('show');assert.equal(home.visible,false,'still waiting for ready handoff');f.frame();
  assert.equal(home.visible,true);assert.equal(home.paused,false);assert.ok(f.buttons.has('开始冒险'));f.unchanged();
});

test('直达战斗时首页资源和战场资源共用一个持续显示的过渡层',async t=>{
  const f=fixture(t);await f.boot();const overlay=f.entry.arrivalView;
  f.entry.g1Showcase=true;f.ready();
  assert.equal(f.entry.interfaceReady,true);assert.equal(overlay.active,true);
  f.entry.g1Showcase=false;f.entry.g1ShowcaseStarted=true;
  f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();
  assert.equal(f.entry.arrivalView,overlay);assert.equal(overlay.active,true);
  f.worlds.at(-1).modelsReady=true;f.loads.at(-1).callback(null,{name:'island'});f.frame();
  assert.equal(f.controllers.length,1);assert.equal(overlay.active,false);f.unchanged();
});

test('资源失败重试只重建显示资源，旧实例迟到不能结束新一轮等待或重复获取会话',async t=>{
  const f=fixture(t);await f.boot();const old=f.homes[0];old.error=new Error('controlled resource failure');f.frame();
  assert.equal(old.disposed,true);assert.equal(f.titles.at(-1),'暂未抵达，再试一次');assert.deepEqual([...f.buttons.keys()],['重新加载']);
  const staleRetry=f.buttons.get('重新加载').callback;f.click('重新加载');const next=f.homes.at(-1);assert.notEqual(old,next);
  old.error=undefined;old.ready=true;old.loadProgress.loaded=6;f.frame();staleRetry();
  assert.equal(f.homes.length,2);assert.equal(f.entry.homeArrival.world,next);assert.equal(next.visible,false);assert.equal(f.buttons.size,0);
  f.ready();assert.equal(next.visible,true);f.unchanged();
});

test('首次完整场景激活仍处于暂停和旧加载门控内，成功才注入正式UI并撤掉arrival',async t=>{
  const f=fixture(t);await f.boot();const arrival=f.entry.homeArrival,home=f.ready();
  assert.equal(home.activation.paused,true,'no animation tick before the final gate');
  assert.equal(home.activation.interfaceReady,false,'navigation is still blocked during activation');
  assert.equal(home.activation.arrival,arrival,'retain the failure/retry owner during activation');
  assert.equal(home.activation.panels,undefined,'formal UI is not injected before activation succeeds');
  assert.equal(f.entry.homeArrival,undefined);assert.equal(f.entry.interfaceReady,true);
  assert.equal(home.visible,true);assert.equal(home.paused,false);f.flushScheduled();assert.equal(f.calls.ready,1);f.unchanged();
});

test('首次激活动画失败不放行且保留重试，重建世界后复用健康UI批次与玩家进度',async t=>{
  const f=fixture(t);await f.boot();f.calls.failHomeActivation=true;
  const panels=f.entry.panels,portraits=f.entry.portraits,icons=f.entry.icons,oldArrival=f.entry.homeArrival,old=f.ready();
  assert.equal(f.entry.interfaceReady,false);assert.equal(f.entry.homeArrival,oldArrival);assert.equal(oldArrival.failed,true);
  assert.equal(old.visible,false);assert.equal(old.disposed,true);assert.equal(f.entry.homeWorld,undefined);
  assert.equal(f.entry.ui.panels,undefined);assert.equal(f.titles.at(-1),'暂未抵达，再试一次');assert.deepEqual([...f.buttons.keys()],['重新加载']);
  f.entry.go('levels');f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();
  assert.equal(f.entry.screen,'home');assert.equal(f.worlds.length,0);f.flushScheduled();assert.equal(f.calls.ready,0);
  const clears=f.calls.clear,errors=f.errors.length,staleRetry=f.buttons.get('重新加载').callback;
  f.frame();f.frame();assert.equal(f.calls.clear,clears);assert.equal(f.errors.length,errors,'failure is displayed once');
  f.calls.failHomeActivation=false;f.click('重新加载');const next=f.homes.at(-1);assert.notEqual(next,old);
  staleRetry();assert.equal(f.homes.length,2);assert.equal(f.entry.interfaceReady,false);assert.equal(next.visible,false);
  assert.equal(f.entry.panels,panels);assert.equal(f.entry.portraits,portraits);assert.equal(f.entry.icons,icons);
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);
  f.ready();assert.equal(next.visible,true);assert.equal(f.entry.interfaceReady,true);assert.equal(f.entry.homeArrival,undefined);
  assert.ok(f.buttons.has('继续冒险'));f.flushScheduled();assert.equal(f.calls.ready,1);f.unchanged();
});

test('构造失败可重试，离开首页后的旧重试回调和迟到就绪都不能覆盖战斗页',async t=>{
  const f=fixture(t);f.calls.failHomeConstructor=true;await f.boot();f.frame();assert.equal(f.titles.at(-1),'暂未抵达，再试一次');
  const staleRetry=f.buttons.get('重新加载').callback;f.calls.failHomeConstructor=false;f.click('重新加载');const home=f.homes.at(-1);f.ready();
  f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();const clear=f.calls.clear,world=f.worlds[0];
  staleRetry();home.ready=true;home.loadProgress.loaded=6;f.frame();
  assert.equal(f.entry.screen,'battle');assert.equal(f.calls.clear,clear);assert.equal(f.titles.at(-1),'即将抵达…');assert.equal(f.homes.length,2);
  assert.equal(home.visible,false);assert.equal(home.paused,true);
  f.click('返回海岛');f.frame();assert.equal(world.disposed,true);assert.equal(home.visible,true);assert.ok(f.buttons.has('继续冒险'));f.unchanged();
});

test('非首页菜单不提交五龟3D，取消战斗加载可复用；后台恢复不重播招呼',async t=>{
  const f=fixture(t);await f.boot();const home=f.ready();home.greet();f.frame(.2);const elapsed=home.elapsed;
  f.click('我的龟龟');assert.equal(home.visible,false);assert.equal(home.paused,true);f.frame(3);assert.equal(home.elapsed,elapsed);
  f.click('返回海岛');assert.equal(home.paused,false);f.frame(.2);assert.equal(home.greetings,1);
  f.engine.emit('hide');const hiddenTime=home.elapsed;assert.equal(home.visible,false);f.frame(3);assert.equal(home.elapsed,hiddenTime);
  f.engine.emit('show');assert.equal(home.visible,true);assert.equal(home.paused,false);assert.equal(home.greetings,1);
  f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();assert.equal(home.visible,false);assert.equal(home.paused,true);
  f.click('返回海岛');assert.equal(home.visible,true);assert.equal(home.paused,false);assert.equal(f.homes.length,1);f.unchanged();
});

test('减少动态设置仍控制现有角色动作；首页移除手动打招呼入口',async t=>{
  const f=fixture(t);await f.boot();const home=f.ready();f.click('设置');assert.equal(home.paused,true);
  f.click('减少动态：关');assert.equal(home.reducedMotion,true);assert.equal(home.paused,true,'settings cannot resume skeleton');
  f.click('返回海岛');assert.equal(f.buttons.has('打个招呼'),false);home.greet();assert.equal(home.greetings,0);
  f.click('设置');f.click('减少动态：开');assert.equal(home.reducedMotion,false);f.click('返回海岛');home.greet();assert.equal(home.greetings,1);f.unchanged();
});

test('使用首页作者相机，窄窗扩大FOV并保留提示，返回首页恢复相机且不重新加载',async t=>{
  const f=fixture(t);await f.boot();f.ready();assert.deepEqual(f.camera.position,[1.8,8.2,12.8]);
  assert.equal(f.entry.mainCamera.fov,38);f.windowSize.width=600;f.windowSize.height=900;f.entry.resizeViewport();
  assert.ok(f.entry.mainCamera.fov>38);const guide=f.entry.orientationGuide;assert.ok(guide?.isValid);
  assert.ok(f.labels.some(label=>label.isValid&&label.string.includes('拉宽窗口')));
  f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();f.click('返回海岛');assert.deepEqual(f.camera.position,[1.8,8.2,12.8]);
  f.windowSize.width=1280;f.windowSize.height=720;f.entry.resizeViewport();assert.equal(guide.isValid,false);assert.equal(f.entry.orientationGuide,undefined);
  assert.equal(f.entry.mainCamera.fov,38);assert.equal(f.homes.length,1);f.unchanged();
});

test('销毁等待中的会话只关闭一次，销毁后迟到Home和旧UI事件不创建或显示任何页面',async t=>{
  const waiting=fixture(t);waiting.entry.start();waiting.entry.onDestroy();await waiting.resolveSession();waiting.entry.onDestroy();
  assert.equal(waiting.calls.close,1);assert.equal(waiting.homes.length,0);assert.equal(waiting.calls.service,0);
  const f=fixture(t);await f.boot();const home=f.homes[0];home.error=new Error('controlled resource failure');f.frame();const retry=f.buttons.get('重新加载').callback;
  f.entry.onDestroy();const clears=f.calls.clear;home.error=undefined;home.ready=true;home.loadProgress.loaded=6;
  retry();f.frame(40);f.entry.onShow();f.entry.onHide();f.entry.start();f.flushScheduled();f.entry.onDestroy();
  assert.equal(f.homes.length,1);assert.equal(home.disposed,true);assert.equal(f.calls.clear,clears);assert.equal(f.entry.homeWorld,undefined);assert.equal(f.calls.close,1);f.unchanged();
});

for(const last of ['home','panels','portraits','icons'])test(`四道首页屏障：${last} 最后就绪前不注入正式面板与头像`,async t=>{
  const f=fixture(t);await f.boot(false);const home=f.homes[0],clears=f.calls.clear;
  const finish={home:()=>{home.ready=true;home.loadProgress.loaded=6;},panels:()=>f.entry.panels.finish(),portraits:()=>f.entry.portraits.finish(),icons:()=>f.entry.icons.finish()};
  for(const key of Object.keys(finish))if(key!==last)finish[key]();
  if(last==='portraits')f.entry.portraits.loadedCount=4;
  f.frame();assert.equal(f.entry.interfaceReady,false);assert.equal(f.entry.ui.panels,undefined);assert.equal(f.entry.ui.portraits,undefined);
  assert.equal(home.visible,false);assert.equal(home.paused,true);assert.equal(f.buttons.size,0);assert.equal(f.calls.clear,clears);
  const text=f.entry.arrivalView.status;assert.doesNotMatch(text,/资源|图集|Prefab|[0-9]/);
  assert.equal(text,'即将抵达…');
  f.entry.go('collection');assert.equal(f.entry.screen,'home','navigation cannot bypass the shared gate');
  f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();assert.equal(f.worlds.length,0,'combat also waits for formal UI');
  finish[last]();f.frame();assert.equal(f.entry.interfaceReady,true);assert.equal(home.visible,true);assert.equal(home.paused,false);
  assert.equal(f.entry.ui.panels,f.entry.panels);assert.equal(f.entry.ui.portraits,f.entry.portraits);assert.equal(f.calls.clear,clears+1);
  f.frame();assert.equal(f.calls.clear,clears+1);assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);f.unchanged();
});

for(const failed of ['panels','portraits','icons'])test(`界面 ${failed} 失败重试保留已就绪世界和成功批次，不重复会话或页面`,async t=>{
  const f=fixture(t);await f.boot(false);const home=f.homes[0];home.ready=true;
  const others=['panels','portraits','icons'].filter(kind=>kind!==failed);for(const other of others)f.entry[other].finish();f.entry[failed].finish(false);f.frame();
  assert.equal(home.disposed,false);assert.equal(home.visible,false);assert.equal(f.titles.at(-1),'暂未抵达，再试一次');assert.equal(f.entry.interfaceReady,false);
  const stale=f.buttons.get('重新加载').callback;f.click('重新加载');assert.equal(f.homes.length,1);assert.equal(f.entry.homeArrival.world,home);
  const loadKey=failed+'Load';
  assert.equal(f.calls[loadKey],2);for(const other of others)assert.equal(f.calls[other+'Load'],1);stale();assert.equal(f.calls[loadKey],2);
  f.frame();assert.equal(f.buttons.size,0);f.entry[failed].finish();f.frame();assert.equal(home.visible,true);assert.equal(f.entry.interfaceReady,true);
  const panels=f.entry.panels,portraits=f.entry.portraits;f.snapshot.run={levelId:0,phase:'combat',battle:{}};f.entry.openBattle();const clears=f.calls.clear;
  stale();f.frame();assert.equal(f.entry.screen,'battle');assert.equal(f.calls.clear,clears);assert.equal(f.entry.panels,panels);assert.equal(f.entry.portraits,portraits);f.unchanged();
});

test('面板/头像/图标在后台全部就绪仍等前台；销毁关闭三个所有者且迟到结果不注入UI',async t=>{
  const f=fixture(t);await f.boot(false);const home=f.homes[0];home.ready=true;f.engine.emit('hide');
  const panels=f.entry.panels,portraits=f.entry.portraits,icons=f.entry.icons;panels.finish();portraits.finish();icons.finish();f.frame();
  assert.equal(f.entry.interfaceReady,false);assert.equal(home.visible,false);assert.equal(f.buttons.size,0);
  f.engine.emit('show');f.frame();assert.equal(f.entry.interfaceReady,true);f.unchanged();
  const pending=fixture(t);pending.entry.start();const earlyPanels=pending.entry.panels,earlyPortraits=pending.entry.portraits,earlyIcons=pending.entry.icons;
  const gate=earlyPanels.preload();pending.entry.onDestroy();assert.equal(await gate,false);assert.equal(pending.calls.panelsDestroy,1);assert.equal(pending.calls.portraitsDestroy,1);
  const clears=pending.calls.clear;earlyPanels.finish();earlyPortraits.finish();earlyIcons.finish();await pending.resolveSession();pending.frame();pending.entry.onDestroy();
  assert.equal(pending.calls.clear,clears);assert.equal(pending.entry.interfaceReady,false);assert.equal(pending.homes.length,0);assert.equal(pending.calls.close,1);
  assert.equal(pending.calls.panelsDestroy,1);assert.equal(pending.calls.portraitsDestroy,1);assert.equal(pending.calls.iconsDestroy,1);
});

test('等待会话时已经失败的三批界面不自动重试，玩家确认后才各开启下一次请求',async t=>{
  const f=fixture(t);f.entry.start();f.entry.panels.finish(false);f.entry.portraits.finish(false);f.entry.icons.finish(false);
  await f.resolveSession(false);f.frame();assert.equal(f.titles.at(-1),'暂未抵达，再试一次');
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);
  f.click('重新加载');assert.equal(f.calls.panelsLoad,2);assert.equal(f.calls.portraitsLoad,2);assert.equal(f.calls.iconsLoad,2);assert.equal(f.homes.length,1);
  f.entry.panels.finish();f.entry.portraits.finish();f.entry.icons.finish();f.ready();assert.equal(f.entry.interfaceReady,true);f.unchanged();
});

test('菜单隐藏首页3D但保留资源；战斗控制器和世界均接管成功后才释放首页一次',async t=>{
  const f=fixture(t);await f.boot();const home=f.ready();
  for(const page of ['levels','collection','history','settings']){
    f.entry.go(page);assert.equal(home.visible,false);assert.equal(home.disposed,false);
    f.engine.emit('hide');f.engine.emit('show');assert.equal(home.visible,false,'foreground menu does not reactivate 3D');
    f.entry.go('home');assert.equal(home.visible,true);assert.equal(f.homes.length,1);
  }
  const controller=f.enterBattle();
  assert.equal(controller.homeAtConstruction,home);assert.equal(controller.homeDisposedAtConstruction,false);
  assert.equal(controller.world.homeDisposedAtActivation,false,'keep fallback until battle world activation succeeds');
  assert.equal(home.destroyCount,1);assert.equal(f.entry.homeWorld,undefined);assert.equal(controller.world.visible,true);
  f.frame();assert.equal(home.destroyCount,1);assert.equal(controller.steps,1);f.unchanged();
});

for(const failure of ['Controller','Activation','Checkpoint'])test(`战斗${failure}交接失败仍能取消并复用原首页，不触发首页重载`,async t=>{
  const f=fixture(t);await f.boot();const home=f.ready();f.calls['failBattle'+failure]=true;f.enterBattle();
  assert.equal(f.titles.at(-1),'暂未抵达，再试一次');assert.equal(f.entry.homeWorld,home);assert.equal(home.disposed,false);
  assert.equal(home.visible,false);assert.equal(f.worlds.at(-1).disposed,true);
  if(failure==='Checkpoint'){
    assert.match(f.errors[0][1].message,/controlled constructor checkpoint failure/);assert.equal(f.controllers[0].disposed,true);
    assert.equal(f.errors[0][1].name,'Error','constructor callback retains original error, not a TDZ ReferenceError');
  }
  f.click('返回海岛');assert.equal(home.visible,true);assert.equal(f.entry.homeArrival,undefined);assert.equal(f.homes.length,1);
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);f.unchanged();
});

test('战斗返回重建首页时即使interfaceReady为true仍阻断旧菜单/出发/奖励/退出回调，后台就绪不能放行',async t=>{
  const f=fixture(t);await f.boot();f.ready();const ui=f.entry.ui;
  const oldNavigate=f.buttons.get('我的龟龟').callback;
  f.entry.energyDialog();const oldAd=f.buttons.get('自愿看广告 · 体力＋5').callback;
  f.entry.go('levels');f.snapshot.collection={leaf:{id:'leaf',role:'leaf',name:'叶子龟',skills:[]}};
  const oldChoose=f.buttons.get('第 1 关 · 初遇').callback;oldChoose();
  const oldDepart=f.buttons.get('首次出发').callback;
  f.entry.go('home');const controller=f.enterBattle();controller.onHome();
  const home=f.homes.at(-1),arrival=f.entry.homeArrival,before=JSON.stringify(f.snapshot);
  assert.equal(f.homes.length,2);assert.equal(f.entry.interfaceReady,true,'shared UI remains healthy');
  assert.equal(f.entry.ui,ui);assert.equal(f.entry.homeArrival.world,home);assert.equal(home.visible,false);
  assert.equal(f.titles.at(-1),'即将抵达…');assert.equal(f.buttons.size,0);
  oldNavigate();oldChoose();oldDepart();oldAd();controller.onHome();controller.onError(new Error('retired controller error'));
  f.entry.openBattle();f.entry.go('home');f.entry.beginHomeArrival();f.entry.energyDialog();
  assert.equal(f.entry.homeArrival,arrival);assert.equal(f.homes.length,2);assert.equal(f.worlds.length,1);assert.equal(f.buttons.size,0);
  assert.equal(f.errors.length,0);assert.equal(JSON.stringify(f.snapshot),before);f.unchanged();
  f.engine.emit('hide');f.ready();assert.equal(home.visible,false);assert.equal(f.entry.homeArrival,arrival);
  f.engine.emit('show');assert.equal(home.visible,false);f.frame();
  assert.equal(home.activation.paused,true);assert.equal(home.activation.arrival,arrival);
  assert.equal(f.entry.homeArrival,undefined);assert.equal(home.visible,true);assert.equal(f.entry.ui,ui);assert.ok(f.buttons.has('继续冒险'));
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);assert.equal(JSON.stringify(f.snapshot),before);
});

for(const failure of ['load','activation'])test(`返回首页${failure}失败仍留在新arrival，重试不重做成功界面批次`,async t=>{
  const f=fixture(t);await f.boot();const originalHome=f.ready(),controller=f.enterBattle(),ui=f.entry.ui;controller.onHome();
  const failed=f.homes.at(-1);
  if(failure==='load'){failed.error=new Error('return home load failure');f.frame();}
  else{f.calls.failHomeActivation=true;f.ready();}
  assert.equal(f.entry.interfaceReady,true);assert.equal(f.entry.homeArrival.failed,true);assert.equal(f.titles.at(-1),'暂未抵达，再试一次');
  assert.equal(originalHome.destroyCount,1);assert.equal(failed.destroyCount,1);assert.equal(f.entry.homeWorld,undefined);
  f.entry.go('settings');f.entry.openBattle();assert.equal(f.entry.screen,'home');assert.equal(f.worlds.length,1);
  const retry=f.buttons.get('重新加载').callback;f.calls.failHomeActivation=false;f.click('重新加载');const current=f.homes.at(-1);
  failed.error=undefined;failed.ready=true;retry();f.frame();
  assert.equal(f.homes.length,3);assert.equal(f.entry.homeWorld,current);assert.equal(current.visible,false);
  f.ready();assert.equal(current.visible,true);assert.equal(f.entry.ui,ui);assert.equal(f.entry.homeArrival,undefined);
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);f.unchanged();
});

test('检查点失败保留战斗；三轮成功往返每次仅重建一个首页，旧控制器与资源回调均无效',async t=>{
  const f=fixture(t);await f.boot();f.ready();const ui=f.entry.ui;
  for(let turn=0;turn<3;turn++){
    const controller=f.enterBattle(),world=controller.world,oldLoad=f.loads.at(-1).callback;
    assert.equal(f.entry.homeWorld,undefined);
    if(turn===0){
      f.calls.failCheckpoint=true;controller.onHome();assert.equal(f.entry.screen,'battle');assert.equal(controller.disposed,undefined);
      assert.equal(f.homes.length,1);f.calls.failCheckpoint=false;
    }
    controller.onHome();const home=f.homes.at(-1),arrival=f.entry.homeArrival;
    assert.equal(controller.checkpoints,1);assert.equal(controller.disposed,true);assert.equal(world.disposed,true);
    controller.onHome();oldLoad(null,{name:'late duplicate'});assert.equal(world.environmentWrites,1);
    assert.equal(f.entry.homeArrival,arrival);assert.equal(f.homes.length,turn+2);
    f.ready();const homeCount=f.homes.length;controller.onHome();controller.onError(new Error('stale after return'));
    assert.equal(f.homes.length,homeCount);assert.equal(home.visible,true);assert.equal(f.entry.ui,ui);
  }
  assert.ok(f.homes.slice(0,-1).every(home=>home.destroyCount===1));assert.equal(f.homes.at(-1).disposed,false);
  assert.equal(f.calls.panelsLoad,1);assert.equal(f.calls.portraitsLoad,1);assert.equal(f.calls.iconsLoad,1);f.unchanged();
});

test('回首页加载中销毁入口，迟到就绪/旧战斗退出/旧错误都不能复活页面或会话',async t=>{
  const f=fixture(t);await f.boot();f.ready();const controller=f.enterBattle();controller.onHome();const home=f.homes.at(-1);
  f.entry.onDestroy();const clears=f.calls.clear,errors=f.errors.length;
  home.ready=true;controller.onHome();controller.onError(new Error('disposed callback'));f.frame();f.entry.onShow();f.flushScheduled();
  assert.equal(home.destroyCount,1);assert.equal(f.entry.homeWorld,undefined);assert.equal(f.entry.homeArrival,undefined);
  assert.equal(f.calls.clear,clears);assert.equal(f.errors.length,errors);assert.equal(f.calls.close,1);
  assert.equal(f.calls.panelsDestroy,1);assert.equal(f.calls.portraitsDestroy,1);assert.equal(f.calls.iconsDestroy,1);
  assert.equal(f.homes.length,2);f.unchanged();
});


test('独立三维入口不获取账户、不构造存档仓库，也不进入现有首页',async t=>{
  const f=fixture(t,'?review=3d');f.entry.start();await f.entry.initialization;f.frame();
  assert.equal(f.calls.review,1);assert.equal(f.calls.reviewReady,1);assert.equal(f.calls.reviewFrames,1);
  assert.equal(f.calls.acquire,0);assert.equal(f.calls.repository,0);assert.equal(f.calls.service,0);assert.equal(f.homes.length,0);
  f.entry.onDestroy();assert.equal(f.calls.reviewDestroyed,1);
});
