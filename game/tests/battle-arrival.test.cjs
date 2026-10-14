const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Arrival tests require the installed Cocos TypeScript compiler');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/GameEntry.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText;

const deadlineModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/ResourceLoadDeadline.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:deadlineModule,exports:deadlineModule.exports});
const queryModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/platform/runtimeQuery.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:queryModule,exports:queryModule.exports,location:{href:'game.js',search:'',protocol:''}});

// Actual GameEntry navigation/update logic; GPU, model importer and battle rules
// have their own checks. Resource completion is controlled, never wall-clock based.
function fixture({native=false,debug=true,os='Android'}={}){
  const loads=[],worlds=[],homes=[],controllers=[],buttons=new Map(),titles=[],errors=[];
  const calls={now:100000,clock:0,beginRun:0,homeRender:0,pause:0,resume:0};
  const run={id:'already-entered-run',levelId:2,phase:'combat',wave:7,combatSeconds:238,
    battle:{tick:35,status:'fighting'},units:{}};
  const snapshot={revision:42,stamina:25,gold:920,run,settings:{reducedMotion:false}};
  const original=JSON.stringify(snapshot);
  class Node{constructor(){this.isValid=true;this.active=true;}setPosition(){}lookAt(){}setRotationFromEuler(){}destroy(){this.isValid=false;}}
  class Home{
    constructor(){this.ready=false;this.visible=false;this.paused=true;homes.push(this);}
    setVisible(value){assert.equal(!!this.disposed,false);this.visible=value;}
    setPaused(value){assert.equal(!!this.disposed,false);this.paused=value;}
    setReducedMotion(){}update(){}destroy(){this.disposed=true;this.ready=false;this.visible=false;}
  }
  class World{
    constructor(){this.modelsReady=false;this.loadedResourceCount=0;this.visible=true;this.disposed=false;this.environments=[];worlds.push(this);}
    setVisible(value){assert.equal(this.disposed,false);this.visible=value;}
    setOceanTexture(){}setLevel(id){if(calls.failLevel)throw new Error('controlled layout failure');this.level=id;}
    setEnvironment(prefab){assert.equal(this.disposed,false);if(calls.failEnvironment)throw new Error('controlled environment failure');this.environments.push(prefab);}
    destroy(){this.disposed=true;this.visible=false;}
  }
  class Screen{
    constructor(owner,service,ui,world){
      if(calls.failController)throw new Error('controlled controller failure');
      assert.equal(world.visible,false,'world stays hidden during controller construction');
      assert.equal(world.modelsReady,true,'controller needs authored models');
      if(world.level<5)assert.ok(world.environments.length,'controller needs its authored island');
      this.world=world;this.steps=0;this.checkpoints=0;this.hidden=0;this.shown=0;this.destroyed=false;this.renders=0;controllers.push(this);ui.clear();if(calls.extraModels)world.modelsReady=false;
    }
    update(){this.steps++;}checkpoint(){this.checkpoints++;}render(){this.renders++;}
    hide(){this.hidden++;}show(){this.shown++;}
    destroy(){this.destroyed=true;this.world.destroy();}
  }
  const cc={_decorator:{ccclass:()=>Type=>Type,property:()=>()=>{}},Component:class{scheduleOnce(){}},Material:class{},Prefab:class{},Node,
    Vec3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},
    resources:{load(name,Type,callback){loads.push({name,callback});}},
    isValid:value=>!!value?.isValid,view:{off(){}},game:{off(){}},Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},
  };
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,...(native?{location:{href:'game.js',search:'',protocol:''}}:{}),Date:class extends Date{static now(){return calls.now;}},console:{info(){},error(...args){errors.push(args);}},require(name){
    if(name==='../platform/runtimeQuery')return queryModule.exports;
    if(name==='../platform/nativeBattleTrace')return {recordNativeBattleStage(){},nativeBattleTraceText(){return '';}};
    if(name==='./PearlBattleArt')return {PearlBattleArt:{ready:true}};
    if(name==='./ResourceLoadDeadline')return deadlineModule.exports;
    if(name==='./ActiveSkillControls')return {ActiveSkillControls:class{render(){}update(){}}};if(name==='cc')return {...cc,sys:{isNative:native,os,OS:{ANDROID:'Android'}}};if(name==='cc/env')return {DEBUG:debug};
    if(name==='../core/arena')return {matchArena:()=> 'local-ai-opponent'};
    if(name==='./HomeWorld')return{HomeWorld:Home,HOME_CAMERA:{position:[1.8,8.2,12.8],target:[-.45,.9,0],baseVerticalFovDegrees:38}};
    if(name==='./BattleWorld')return{BattleWorld:World};
    if(name==='./BattleScreen')return{BattleScreen:Screen};
    if(name==='../core/raids')return{raidMapId:t=>t===3?55:51+t};
    if(name==='./ChallengeScreen')return{ChallengeScreen:class extends Screen{constructor(mode,service,ui,world){super(null,service,ui,world);this.mode=mode;world.setLevel(mode==='raid'?(service.snapshot.community.raid.tier===3?55:51+service.snapshot.community.raid.tier):54);}}};
    if(name==='./LiveRaidScreen'||name==='./WorldBossScreen')return{[name.slice(2)]:class extends Screen{constructor(service,client,ui,world){super(null,service,ui,world);}}};
    if(name==='./ArenaWatchScreen')return{ArenaWatchScreen:class extends Screen{constructor(service,id,ui,world){super(null,service,ui,world);}}};
    if(name==='./IslandUI')return{UI_COLORS:{}};
    if(name==='../core/mapPresentation')return require('../.test-build/core/mapPresentation.js');if(name==='../core/data')return{BATTLE_MAPS:require('../.test-build/core/data.js').BATTLE_MAPS};
    if(name.startsWith('./')||name.startsWith('../'))return{};
    throw new Error(`Unexpected dependency ${name}`);
  }});
  const entry=new module.exports.GameEntry();
  entry.interfaceReady=true; // This fixture begins after all homepage/UI preload gates.
  entry.node=new Node();entry.pipelineMaterial={};entry.mainCamera={node:new Node()};entry.homeWorld=new Home();entry.homeWorld.ready=true;entry.homeWorld.visible=true;entry.homeWorld.paused=false;
  entry.icons={ready:true,state:'ready',destroy(){}};entry.panels={state:'ready',destroy(){}};entry.portraits={ready:true,state:'ready',destroy(){}};
  entry.service={snapshot,get settingsSnapshot(){return {...snapshot.settings};},refreshClock(){calls.clock++;},beginRun(){calls.beginRun++;throw new Error('entry must not repeat beginRun');}};
  entry.ui={root:new Node(),clear(){buttons.clear();},modal(title){titles.push(title);return new Node();},sheet(title){return this.modal(title);},dialog(title){return this.modal(title);},portrait(){},icon(){},label(){},text(){},button(text,x,y,w,h,callback){buttons.set(text,callback);}};
  entry.audio={effect(){},update(){},pause(){calls.pause++;},resume(){calls.resume++;},playMusic(){return Promise.resolve();},destroy(){}};
  entry.arrivalView={active:false,setBattleProgress(){},show(failed=false,retry,back){this.active=true;titles.push(failed?'暂未抵达，再试一次':'即将抵达…');buttons.clear();if(back)buttons.set('返回海岛',back);if(failed&&retry)buttons.set('重新加载',retry);},hide(){this.active=false;},update(){},destroy(){}};
  entry.resizeViewport=()=>{};
  entry.home=()=>{calls.homeRender++;};
  // Render the home branch only; battle arrival/failure panels use the real methods.
  const render=entry.render.bind(entry);entry.render=()=>{if(entry.screen==='home'&&!entry.homeArrival)entry.home();else render();};
  const f={entry,worlds,homes,controllers,loads,buttons,titles,calls,run,snapshot,errors,
    open(){entry.openBattle();return worlds.at(-1);},
    frame(dt=.05){entry.update(dt);},
    resolve(index=loads.length-1,error=null,prefab={name:'authored-island'}){loads[index].callback(error,prefab);},
    click(text){assert.ok(buttons.has(text),`button ${text}`);buttons.get(text)();},
    readyHome(){homes.at(-1).ready=true;entry.update(.01);},
    unchanged(){assert.equal(JSON.stringify(snapshot),original);assert.equal(calls.beginRun,0);},
  };
  return f;
}

test('Android trial unlocks require a Cocos debug export on native Android',()=>{
  assert.equal(fixture({native:true}).entry.allMapsReview,true);
  for(const options of [{native:true,debug:false},{native:true,os:'iOS'},{native:false}]){
    assert.equal(fixture(options).entry.allMapsReview,false);
  }
});

test('Illustrated home waits for its artwork without loading the unused legacy 3D island',()=>{
  const f=fixture({native:true});f.entry.homeWorld.destroy();f.entry.homeWorld=undefined;
  f.entry.art={ready:false,state:'loading'};f.entry.screen='home';f.entry.entered=true;
  f.entry.syncHomePresentation=()=>{};f.entry.render=()=>{};
  f.entry.beginHomeArrival();assert.equal(f.homes.length,1);assert.equal(f.entry.homeArrival.world,undefined);
  f.entry.finishHomeArrival();assert.ok(f.entry.homeArrival);
  f.entry.art.ready=true;f.entry.art.state='ready';f.entry.finishHomeArrival();
  assert.equal(f.entry.homeArrival,undefined);assert.equal(f.entry.homeWorld,undefined);assert.equal(f.homes.length,1);
});

test('Android map selection reaches chapter, endless, four raids, arena and world boss without browser location',()=>{
  const f=fixture({native:true}),calls=[],opened=[];
  f.snapshot.collection={a:{},b:{},c:{},d:{},e:{}};
  f.entry.command=k=>k;f.entry.roomClient={};
  f.entry.openBattle=async mode=>{opened.push(mode??'chapter');};
  f.entry.service.beginPrototypeRun=(...args)=>calls.push(['run',...args]);
  f.entry.service.beginRaid=(...args)=>calls.push(['raid',...args]);
  f.entry.service.beginArena=(...args)=>calls.push(['arena',...args]);
  for(const id of [0,49,50,51,52,53,54,55,56])f.entry.openNativeTrialMap(id);
  assert.deepEqual(opened,['chapter','chapter','chapter','raid','raid','raid','arena','raid','world']);
  assert.deepEqual(calls.filter(c=>c[0]==='run').map(c=>[c[2],c[4]]),[[0,'chapter'],[49,'chapter'],[50,'endless']]);
  assert.deepEqual(calls.filter(c=>c[0]==='raid').map(c=>c[2]),[0,1,2,3]);
  assert.equal(calls.find(c=>c[0]==='arena')[2],'local-ai-opponent');
  assert.equal(f.entry.roomClient.worldSelection.length,5);
  const count=opened.length;
  for(const id of [-1,57,1.5])f.entry.openNativeTrialMap(id);
  f.entry.appHidden=true;f.entry.openNativeTrialMap(0);
  assert.equal(opened.length,count);
});

for(const first of ['models','island'])test(`加载顺序 ${first} 先到：两者就绪前不建控制器、不显示战场、不推进战斗`,()=>{
  const f=fixture(),world=f.open();
  assert.equal(world.visible,false);assert.equal(f.titles.at(-1),'即将抵达…');
  assert.equal(f.entry.homeWorld.visible,false);assert.equal(f.entry.homeWorld.paused,true);
  if(first==='models')world.modelsReady=true;else f.resolve();
  for(let i=0;i<4;i++)f.frame();
  assert.equal(f.controllers.length,0);assert.equal(world.visible,false);f.unchanged();
  if(first==='models')f.resolve();else world.modelsReady=true;
  f.frame();assert.equal(f.controllers.length,1);assert.equal(world.visible,true);
  assert.equal(f.controllers[0].steps,0,'arrival frame never consumes loading time as combat time');
  f.frame();assert.equal(f.controllers[0].steps,1);f.unchanged();
});

test('取消加载恢复海岛：迟到资源不挂载，下一次继续使用同一冒险',()=>{
  const f=fixture(),old=f.open();f.click('返回海岛');
  assert.equal(f.entry.screen,'home');assert.equal(old.disposed,true);assert.equal(f.entry.homeWorld.visible,true);assert.equal(f.entry.homeWorld.paused,false);
  f.resolve(0);old.modelsReady=true;f.frame();
  assert.equal(old.environments.length,0);assert.equal(f.controllers.length,0);f.unchanged();
  const next=f.open();next.modelsReady=true;f.resolve();f.frame();
  assert.equal(f.controllers.length,1);assert.equal(f.controllers[0].world,next);f.unchanged();
});

for(const failure of ['model','island','attach','layout','controller'])test(`加载失败 ${failure}：展示返回/重试，重试不再扣体力且丢弃旧回调`,()=>{
  const f=fixture();if(failure==='layout')f.calls.failLevel=true;
  const old=f.open();
  if(failure==='model')old.loadingError=new Error('controlled model failure');
  else if(failure==='island')f.resolve(0,new Error('controlled island failure'));
  else if(failure==='attach'){f.calls.failEnvironment=true;f.resolve();}
  else if(failure==='controller'){old.modelsReady=true;f.calls.failController=true;f.resolve();}
  f.frame();assert.equal(old.disposed,true);assert.equal(f.titles.at(-1),'暂未抵达，再试一次');
  assert.ok(f.buttons.has('返回海岛'));assert.ok(f.buttons.has('重新加载'));assert.equal(f.controllers.length,0);f.unchanged();
  f.calls.failLevel=f.calls.failController=f.calls.failEnvironment=false;
  f.click('重新加载');const next=f.worlds.at(-1);next.modelsReady=true;
  if(failure==='model')f.resolve(0);
  assert.equal(old.environments.length,failure==='controller'?1:0);
  f.resolve();f.frame();assert.equal(f.controllers.length,1);assert.equal(f.controllers[0].world,next);f.unchanged();
});

test('后台收到资源后仍不建控制器；回到前台才显示，后续 hide/show 传给控制器',()=>{
  const f=fixture(),world=f.open();f.entry.onHide();world.modelsReady=true;f.resolve();f.frame();
  assert.equal(f.controllers.length,0);assert.equal(world.visible,false);f.unchanged();
  f.entry.onShow();f.frame();assert.equal(f.controllers.length,1);assert.equal(f.controllers[0].steps,0);
  f.entry.onHide();f.entry.onShow();assert.equal(f.controllers[0].hidden,1);assert.equal(f.controllers[0].shown,1);f.unchanged();
});

test('组件销毁取消加载，迟到资源不能创建世界或恢复页面',()=>{
  const f=fixture(),world=f.open();f.entry.onDestroy();f.resolve();world.modelsReady=true;f.frame();
  assert.equal(world.disposed,true);assert.equal(world.environments.length,0);assert.equal(f.controllers.length,0);f.unchanged();
});

test('进入成功后返回海岛仍先 checkpoint 再释放控制器拥有的世界',()=>{
  const f=fixture(),world=f.open();world.modelsReady=true;f.resolve();f.frame();
  assert.equal(f.homes[0].disposed,true);assert.equal(f.entry.homeWorld,undefined);
  f.entry.go('home');assert.equal(f.controllers[0].checkpoints,1);assert.equal(f.controllers[0].destroyed,true);
  assert.equal(world.disposed,true);assert.equal(f.entry.battleScreen,undefined);assert.equal(f.entry.homeWorld.visible,false);assert.equal(f.entry.homeWorld.paused,true);
  assert.equal(f.homes.length,2);assert.equal(f.titles.at(-1),'即将抵达…');f.readyHome();
  assert.equal(f.entry.homeWorld.visible,true);assert.equal(f.entry.homeWorld.paused,false);f.unchanged();
});

test('旧加载页返回与旧失败页重试不能在回首页后或下一轮战斗覆盖当前页面',()=>{
  const f=fixture(),failed=f.open(),oldReturn=f.buttons.get('返回海岛');
  failed.loadingError=new Error('old failure');f.frame();const oldRetry=f.buttons.get('重新加载');
  f.click('返回海岛');oldRetry();oldReturn();assert.equal(f.entry.screen,'home');assert.equal(f.worlds.length,1);
  const current=f.open();oldReturn();oldRetry();assert.equal(f.entry.screen,'battle');assert.equal(f.worlds.length,2);assert.equal(current.disposed,false);
  current.modelsReady=true;f.resolve();f.frame();oldReturn();oldRetry();
  assert.equal(f.controllers.length,1);assert.equal(f.entry.battleScreen,f.controllers[0]);assert.equal(current.disposed,false);f.unchanged();
});

test('同一海岛完成回调仅挂载一次，成功接管后迟到回调不再写世界',()=>{
  const f=fixture(),world=f.open();f.resolve();f.resolve();assert.equal(world.environments.length,1);
  world.modelsReady=true;f.frame();f.resolve();assert.equal(world.environments.length,1);
  assert.equal(f.homes[0].disposed,true);assert.equal(f.controllers.length,1);f.unchanged();
});

for(const mode of ['raid','arena','online','watch','world'])test(mode+' controller completes loading without chapter assets or a new entry charge',()=>{
 const f=fixture();f.snapshot.community={raid:{tier:3,settled:false},arena:{battle:{levelId:54},settled:false}};
 f.entry.roomClient={room:{tier:3,raid:{tier:3}},world:{fight:{phase:'combat'}}};
 f.entry.openBattle(mode);const w=f.worlds[0];assert.equal(w.level,mode==='raid'||mode==='online'?55:mode==='world'?56:54);assert.equal(f.loads.length,0);
 w.modelsReady=true;f.frame();assert.equal(f.controllers.length,1);assert.equal(f.entry.battleArrival,undefined);assert.equal(f.entry.arrivalView.active,false);assert.equal(w.visible,true);
 f.frame();assert.equal(f.controllers[0].steps,1);assert.equal(f.calls.beginRun,0);
});
test('controller-added resources wait once and restore battle UI when ready',()=>{
 const f=fixture();f.calls.extraModels=true;const w=f.open();w.modelsReady=true;f.resolve();f.frame();
 assert.equal(f.controllers.length,1);assert.ok(f.entry.battleArrival);assert.equal(w.visible,false);assert.equal(f.entry.arrivalView.active,true);
 f.frame();assert.equal(f.controllers[0].steps,0);w.modelsReady=true;f.frame();
 assert.equal(f.controllers.length,1);assert.equal(f.controllers[0].renders,1);assert.equal(w.visible,true);assert.equal(f.entry.arrivalView.active,false);f.unchanged();
});
test('resume button discards a stale loading attempt and loads the saved battle once',()=>{
 const f=fixture(),old=f.open();f.entry.error(new Error('请先结束当前挑战'));f.click('继续未完成的战斗');
 assert.equal(old.disposed,true);assert.equal(f.worlds.length,2);f.resolve(0);assert.equal(old.environments.length,0);
 const w=f.worlds[1];w.modelsReady=true;f.resolve();f.frame();assert.equal(f.controllers.length,1);assert.equal(w.visible,true);f.unchanged();
});
test('loading timeout provides a working retry without abandoning the save',()=>{
 const f=fixture(),old=f.open();f.calls.now+=90001;f.frame();
 assert.equal(old.disposed,true);assert.ok(f.buttons.has('重新加载'));f.click('重新加载');const w=f.worlds[1];w.modelsReady=true;f.resolve();f.frame();assert.equal(f.controllers.length,1);f.unchanged();
});


test('持续完成模型时超过90秒仍可进入战斗，加载时间不计为战斗时间',()=>{
 const f=fixture(),world=f.open();f.resolve();
 for(let n=1;n<=3;n++){f.calls.now+=60000;world.loadedResourceCount=n;f.frame();assert.ok(f.entry.battleArrival);assert.equal(world.disposed,false);assert.equal(f.controllers.length,0);}
 world.modelsReady=true;f.frame();assert.equal(f.controllers.length,1);assert.equal(f.controllers[0].steps,0);assert.equal(world.visible,true);f.unchanged();
});


test('按需地图加载完成前不建世界；退出后迟到图片不会重新打开战斗',async()=>{
 const f=fixture();let finish;const ready=new Promise(resolve=>finish=resolve);
 f.entry.art={ready:false,ensure:()=>ready,retainBattleScene(){}};
 const pending=f.entry.openBattle();assert.equal(f.worlds.length,0);assert.equal(f.entry.arrivalView.active,true);
 f.click('返回海岛');finish();await pending;assert.equal(f.worlds.length,0);assert.equal(f.entry.screen,'home');f.unchanged();
});
test('按需地图失败可重试；成功后才进入原有模型加载流程',async()=>{
 const f=fixture();f.entry.art={ready:false,ensure:()=>Promise.reject(new Error('map offline')),retainBattleScene(){}};
 await f.entry.openBattle();assert.equal(f.worlds.length,0);assert.ok(f.buttons.has('重新加载'));f.unchanged();
 f.entry.art.ensure=()=>Promise.resolve();await f.entry.openBattle(undefined,true);assert.equal(f.worlds.length,1);
 const w=f.worlds[0];assert.equal(w.visible,false);w.modelsReady=true;f.resolve();f.frame();assert.equal(f.controllers.length,1);assert.equal(w.visible,true);f.unchanged();
});
