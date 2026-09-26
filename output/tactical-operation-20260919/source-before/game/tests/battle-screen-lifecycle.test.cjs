const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const gameModule=require('../.test-build/core/game.js');
const battleModule=require('../.test-build/core/battle.js');
const data=require('../.test-build/core/data.js');
const {SaveRepository,SAVE_KEY,encodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Battle screen tests require installed Cocos TypeScript');
const source=fs.readFileSync(path.join(__dirname,'../assets/scripts/view/BattleScreen.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const compiledUi=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/IslandUI.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const NOW=1788830000000;
function approachStormTarget(b){b.autoSkills=false;for(let i=0;i<500&&!b.enemies.some(e=>e.alive&&Math.hypot(e.x-b.units[0].x,e.z-b.units[0].z)<=2.3);i++)battleModule.stepBattle(b,.05);b.units[0].cooldowns.hold=0;b.units[0].actionUntilTick=0;}

// Real service/save and BattleScreen methods create these callbacks. Only Cocos UI,
// world and audio are controlled. Retained handlers model a late callback, not a
// claim that a detached button can still be hit in the browser. Wave outcomes are
// domain fixtures; no combat timing/balance/visual/audio acceptance is inferred.
function fixture(mode='result'){
  const modern=mode.startsWith('v06');
  const storage=new MemoryStorage(),initial=gameModule.makeInitialSave(NOW,0x6f73412);initial.unlockedLevel=4;
  for(const t of Object.values(initial.collection))t.skills=[...data.ROLES[t.role].starters];
  if(mode==='v06endless')initial.cleared=[0,1];
  // A legal owned active skill is the diagnostic stimulus, not a balance change.
  if(mode==='combat')initial.collection['t-1'].skills.push('hold');
  if(mode==='crowded')initial.collection['t-1'].skills=data.skillsForRole('stone').slice(0,12);
  storage.setItem(SAVE_KEY,encodeSave(initial));
  let real=new gameModule.GameService(new SaveRepository(storage),{now:()=>NOW});const ids=Object.keys(initial.collection);
  if(modern)real.beginPrototypeRun('fixture:start',0,ids,mode==='v06endless'?'endless':'chapter');else real.beginRun('fixture:start',mode==='crowded'?4:1,ids);
  const units=()=>Object.values(real.snapshot.run.units).filter(u=>!u.consumedBy);
  const battleFor=()=>{const r=real.snapshot.run;return battleModule.createBattle(r.levelId,r.wave+1,units().filter(u=>u.slot!==null),{coreHealth:r.coreHealth});};
  const wave=()=>{
    const r=real.snapshot.run,b=battleFor();real.beginWave(`fixture:begin:${r.wave}`,r.id,b);
    const end={...clone(b),spawns:[],spawnCursor:0,events:[],status:'won',tick:500,elapsed:25};
    real.completeWave(`fixture:end:${r.wave}`,r.id,end);
  };
  if(mode==='combat'){const r=real.snapshot.run;real.beginWave('fixture:combat',r.id,battleFor());}
  else if(!modern){
    wave();
    if(['reveal','reveal12','compare','unlock'].includes(mode)){
      real.recruit('fixture:recruit',{permanentId:ids[1]});while(real.snapshot.run.wave<4)wave();
      if(mode==='unlock')real.setLocked('fixture:lock',ids[0],true);
      const [a,b]=units();real.merge('fixture:merge',a.id,b.id);
      if(!mode.startsWith('reveal'))real.reveal('fixture:reveal');
      if(mode==='reveal12'){
        // A valid stored 12-skill outcome tests presentation, never its probability.
        const save=real.snapshot,out=Object.values(save.run.units).find(u=>!u.consumedBy);
        out.turtle.skills=data.skillsForRole(out.turtle.role).slice(0,12);
        storage.setItem(SAVE_KEY,encodeSave(save));real=new gameModule.GameService(new SaveRepository(storage),{now:()=>NOW});
      }
    }else if(mode==='crowded'){
      while(units().length<10){
        const r=real.snapshot.run,permanentId=ids.find(id=>!r.usedSources.includes(id));
        real.recruit(`fixture:recruit:${units().length}`,permanentId?{permanentId}:{candidateId:r.recruitCandidates[0].id});
        if(units().length<10)wave();
      }
      wave(); // Wave 10 is a real boss-level fusion opportunity; no limits changed.
    }else if(mode==='result')real.abandonRun('fixture:abandon');
  }
  const calls={service:[],command:[],audio:[],world:[],home:0,error:[],ui:0},buttons=[],nodes=[],labels=[],portraits=[];
  const viewport={scale:1,x:0,y:0};
  class Canvas{}class UITransform{}
  class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
  class Node{
    static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'};
    constructor(name='',x=0,y=0){this.name=name;this.active=true;this.position={x,y,z:0};this.children=[];this.handlers=new Map();this.isValid=true;nodes.push(this);}
    on(type,fn){this.handlers.set(type,fn);}once(type,fn){this.on(type,fn);}off(type){this.handlers.delete(type);}
    addComponent(Type){return new Type();}getComponentInChildren(){return this.label??this.children.map(n=>n.getComponentInChildren()).find(Boolean);}
    getComponent(Type){
      if(Type===Canvas&&this.name==='shared-ui')return {cameraComponent:{screenToWorld:p=>new Vec3(p.x-640,p.y-360,0)}};
      if(Type===UITransform)return {convertToNodeSpaceAR:p=>new Vec3((p.x-viewport.x)/viewport.scale-this.position.x,(p.y-viewport.y)/viewport.scale-this.position.y,0),hitTest:p=>Math.abs(p.x-640-this.position.x)<=this.w/2&&Math.abs(p.y-360-this.position.y)<=this.h/2};
      return null;
    }
    setPosition(x,y,z=0){this.position=typeof x==='object'?{...x}:{x,y,z};}setScale(){}destroy(){this.isValid=false;this.active=false;for(const child of this.children)child.destroy();}
  }
  class Graphics{rect(){}clear(){}circle(){}fill(){}stroke(){}ellipse(){}roundRect(){}}
  class Color{static fromHEX(out,value){out.hex=value;}}
  class Label{static Overflow={CLAMP:1};}
  const root=new Node('shared-ui'),ui={root,click(){calls.audio.push(['ui-click']);},
    clear(){calls.ui++;buttons.length=0;labels.length=0;portraits.length=0;for(const n of root.children){n.destroy();n.parent=null;}root.children=[];},
    group(name,x=0,y=0,parent=root,w=0,h=0){calls.ui++;const n=new Node(name,x,y);n.w=w;n.h=h;n.parent=parent;parent.children.push(n);return n;},
    panel(x=0,y=0,w=0,h=0,parent=root){return this.group('panel',x,y,parent,w,h);},
    modal(title){return this.group(title);},dialog(title,subtitle,close){const veil=this.group('dialog-veil'),p=this.group('dialog',0,0,veil);this.text(title,0,170,30,'',p);if(close)this.button('×',320,170,48,48,close,{parent:p});return p;},pet(t,...args){return this.portrait(t.role,...args);},
    sheet(title,subtitle){this.text(title,-120,284,40,'',root,816,56);this.text(subtitle,-84,228,28,'',root,900,40);return this.group(title);},
    label(text,x,y,size,hex,parent=root,w=400,h=44){calls.ui++;const n=this.group('label',x,y,parent,w,h),l={string:text,fontSize:size,color:{},node:n};n.label=l;labels.push(l);return l;},
    text(...args){const l=this.label(...args);l.overflow=Label.Overflow.CLAMP;return l;},
    fusionCard(t,p){return this.portrait(t.role,0,0,124,p);},
    portrait(role,x,y,side,parent=root){portraits.push({role,x,y,side,parent});return this.group("portrait",x,y,parent,side,side);},battleFigure(...args){return this.portrait(...args);},skillDetail(){},roleMark(){},hover(){},compactFrom(){},bookIcon(){},skillPill(){},icon(){},toast(){},
  };
  const world={hasPendingExits:false,setLevel(){},syncRunUnits(){},setPlaybackSpeed(speed){calls.world.push(['speed',speed]);},setPaused(value){calls.world.push(['pause',value]);},tintRange(){},showRange(){},slotWorld(){return{};},update(...args){calls.world.push(['update',args[1]]);},updatePresentation(...args){calls.world.push(['presentation',args[0]]);},destroy(){calls.world.push(['destroy']);}};
  const audio={effect(...args){calls.audio.push(['effect',...args]);},playMusic(...args){calls.audio.push(['music',...args]);return Promise.resolve();},pause(){calls.audio.push(['pause']);},resume(){calls.audio.push(['resume']);}};
  const service=new Proxy(real,{get(target,key){if(key==='snapshot')return target.snapshot;const value=target[key];if(typeof value!=='function')return value;return(...args)=>{calls.service.push([key,...clone(args)]);return value.apply(target,args);};}});
  const cc={Node,Graphics,Color,Label,Canvas,UITransform,Mask:class{static Type={GRAPHICS_RECT:0};},Component:class{},Camera:class{},Vec3,isValid:n=>!!n?.isValid,tween:()=>({stop(){},to(){return this;},call(fn){this.done=fn;return this;},start(){this.done?.();return this;}}),view:{getScaleY:()=>1,getVisibleSize:()=>({width:1280,height:720})}};
  const uiModule={exports:{}};
  vm.runInNewContext(compiledUi,{module:uiModule,exports:uiModule.exports,require(name){if(name==='./GoldFlow')return{GoldFlow:class{}};if(name==='./ProfileAvatar')return {avatarPicker(){},paintAvatar(){}};if(name==='./ActiveSkillControls')return {ActiveSkillControls:class{render(){}update(){}}};if(name==='./BubbleShimmer')return {BubbleShimmer:class{}};if(name==='cc')return cc;if(name.startsWith('../core/'))return require('../.test-build/core/'+path.basename(name)+'.js');if(name==='./BattlePoseData')return {};throw new Error('Unexpected IslandUI dependency '+name);}});
  // Execute the actual shared button method, including its pre-action click sound.
  // Drawing helpers stay controlled; this catches a guard that runs only afterwards.
  ui.skillDetail=function(id){return uiModule.exports.IslandUI.prototype.skillDetail.call(this,id);};
  ui.battleLandingIssue=function(...args){return uiModule.exports.IslandUI.prototype.battleLandingIssue.call(this,...args);};
  // This fixture supplies a verified provider completion. The real HTTP receipt
  // verification and cancellation paths are covered by account-service tests.
  ui.requestReward=(kind,context,done)=>{service.receiveAdReward('a'.repeat(48),kind,context);done?.();};
  ui.isInteractive=function(node){return uiModule.exports.IslandUI.prototype.isInteractive.call(this,node);};
  ui.button=function(text,x,y,w,h,action,options={}){
    const node=uiModule.exports.IslandUI.prototype.button.call(this,text,x,y,w,h,action,options);
    buttons.push({text,action,options,node,x,y,w,h});return node;
  };
  const module={exports:{}};
  const bubbleModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/BubbleReveal.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:bubbleModule,exports:bubbleModule.exports,require(name){if(name==='./ActiveSkillControls')return {ActiveSkillControls:class{render(){}update(){}}};if(name==='./BubbleShimmer')return {BubbleShimmer:class{}};if(name==='cc')return cc;if(name==='./IslandUI')return uiModule.exports;throw new Error(name);}});
  vm.runInNewContext(compiled,{module,exports:module.exports,console:{error(...args){calls.error.push(args.map(String));}},require(name){
    if(name==='./ActiveSkillControls')return {ActiveSkillControls:class{render(){}update(){}}};if(name==='./BubbleShimmer')return {BubbleShimmer:class{}};if(name==='cc')return cc;if(name==='../core/game')return gameModule;if(name==='../core/battle')return battleModule;
    if(name==='../core/data')return data;if(name==='../core/fusion')return require('../.test-build/core/fusion.js');
    if(name==='../core/rewardPacks'||name==='../core/development'||name==='../core/placement'||name==='../core/multiFront'||name==='../core/economy'||name==='../core/prototype'||name==='../core/prototypeConfig'||name==='../core/waveTactics')return require('../.test-build/core/'+path.basename(name)+'.js');
    if(name==='./BubbleReveal')return bubbleModule.exports;
    if(name==='./VisualIdentity')return{visualName:t=>t.name}; // This fixture keeps the legacy presentation branch.
    if(name==='./IslandUI')return {color:value=>value,UI_COLORS:{cream:'#fff',sand:'#ddd',gold:'#ff0',dark:'#000',ink:'#111'}};
    throw new Error('Unexpected dependency '+name);
  }});
  const screen=new module.exports.BattleScreen({},service,ui,world,{camera:{update(){}},screenPointToRay:(x,y)=>({o:{x:(x-640)/32,y:10,z:(440-y)/30},d:{x:0,y:-1,z:0}}),worldToScreen:p=>new Vec3(640+p.x*32,440-p.z*30,0),convertToUINode:()=>({x:640,y:360})},audio,kind=>{calls.command.push(kind);return `ui:${kind}:${calls.command.length}`;},()=>{calls.home++;},error=>{calls.error.push(String(error));});
  // Manual guard now requires a real enemy to exist. Preserve the actual spawn simulation.
  if(mode==='combat')battleModule.stepBattle(screen.battle,.05);
  if(mode==='recruit')screen.recruit();
  if(mode==='compare'||mode==='unlock')screen.compare(units()[0].id);
  const callback=text=>{const button=buttons.findLast(b=>b.text===text);assert.ok(button,'actual button '+text);assert.ok(!button.options.disabled,'button should be enabled: '+text);return button.action;};
  const signature=()=>clone({saveSha256:hash(real.snapshot),storageSha256:hash(storage.values),revision:real.snapshot.revision,gold:real.snapshot.gold,
    calls:{...calls,service:calls.service.map(call=>call[0]),serviceArgumentsSha256:hash(calls.service)},battleSha256:hash(screen.battle??null),selection:screen.selected,mergeSelection:screen.mergeSelection});
  return {screen,real,storage,calls,ui,nodes,buttons,labels,portraits,viewport,callback,signature,mode,bubbles:bubbleModule.exports};
}

test('暂停页替换后销毁的战场点击区域不会继续写入变换',()=>{
  const f=fixture('combat'),id=f.screen.units[0].id;
  f.screen.worldHits.set(id,{isValid:false,setPosition(){throw Error('destroyed transform');}});
  f.screen.paused=true;
  assert.doesNotThrow(()=>f.screen.update(.016));
  assert.equal(f.screen.worldHits.size,0);
  f.screen.destroy();
  assert.doesNotThrow(()=>f.screen.update(.016));
});

for(const [name,mode,label] of [
  ['结算翻倍','result','自愿看广告 · 基础金币翻倍'],
  ['招募刷新','recruit','自愿看广告 · 换一批'],
  ['直接揭晓','reveal','直接揭晓'],
  ['收录','compare','确认收录'],
  ['来源解锁','unlock','解锁这些来源'],
])test(`销毁后旧${name}回调不提交、不发声、不覆盖新页面`,()=>{
  const f=fixture(mode),old=f.callback(label);f.screen.destroy();f.ui.clear();f.ui.modal('新的首页加载中');
  const before=f.signature();old();assert.deepEqual(f.signature(),before);
});

test('未销毁的结算翻倍和招募刷新仍通过真实服务正常执行',()=>{
  const result=fixture('result'),before=result.real.snapshot,runId=before.run.id;
  result.callback('自愿看广告 · 基础金币翻倍')();
  assert.equal(result.real.snapshot.gold,before.gold+before.results[runId].baseGold);assert.equal(result.real.snapshot.results[runId].doubled,true);assert.equal(result.calls.error.length,0);
  const recruit=fixture('recruit'),candidates=recruit.real.snapshot.run.recruitCandidates;
  recruit.callback('自愿看广告 · 换一批')();
  assert.equal(recruit.real.snapshot.run.refreshUsed,true);assert.notDeepEqual(recruit.real.snapshot.run.recruitCandidates,candidates);assert.equal(recruit.calls.error.length,0);
});
test('未销毁的揭晓、收录和来源解锁仍保留真实事务与反馈',()=>{
  const reveal=fixture('reveal');reveal.callback('直接揭晓')();assert.equal(reveal.real.snapshot.run.phase,'between');assert.ok(reveal.calls.audio.some(e=>e[0]==='effect'));assert.equal(reveal.calls.error.length,0);
  const collect=fixture('compare'),before=Object.keys(collect.real.snapshot.history).length;collect.callback('确认收录')();assert.equal(Object.keys(collect.real.snapshot.history).length,before+2);assert.equal(collect.calls.error.length,0);
  const unlock=fixture('unlock');unlock.callback('解锁这些来源')();assert.ok(Object.values(unlock.real.snapshot.collection).every(t=>!t.locked));assert.equal(unlock.calls.error.length,0);
});
test('销毁后的擦泡泡触摸既不改泡泡/文字也不发声或揭晓；活页擦拭仍有效',()=>{
  const f=fixture('reveal'),cover=f.nodes.find(n=>n.name==='可以擦开的泡泡'),rub=cover.handlers.get('touch-move'),bubble=cover.children.find(n=>n.name==='泡泡');
  const event={getLocation:()=>({x:bubble.position.x+640,y:bubble.position.y+360})};
  f.screen.destroy();const before=f.signature(),active=cover.children.map(n=>n.active);rub(event);
  assert.deepEqual(f.signature(),before);assert.deepEqual(cover.children.map(n=>n.active),active);
  const live=fixture('reveal'),liveCover=live.nodes.find(n=>n.name==='可以擦开的泡泡'),first=liveCover.children.find(n=>n.name==='泡泡');
  liveCover.handlers.get('touch-start')({getLocation:()=>({x:first.position.x+640,y:first.position.y+360})});
  assert.equal(first.active,false);assert.ok(live.calls.audio.some(e=>e[1]==='sfx_bubble_rub'));
});
test('销毁后手动施法与checkpoint不改旧战斗或磁盘，活页仍能排队一次真实技能',()=>{
  const f=fixture('combat');f.callback('继续冒险')();const old=f.buttons.find(b=>b.node.name==='战斗技能').action;
  f.screen.destroy();const before=f.signature();old();f.screen.checkpoint();assert.deepEqual(f.signature(),before);
  const live=fixture('combat');live.callback('继续冒险')();const actor=live.screen.battle.units[0],active=actor.skills.find(id=>data.SKILL_BY_ID[id].active);
  approachStormTarget(live.screen.battle);live.buttons.find(b=>b.node.name==='战斗技能').action();assert.equal(live.screen.battle.commands.length,1);assert.equal(live.screen.battle.commands[0].skillId,active);
});
test('销毁后旧结算/暂停退出与继续按钮无效，旧返回不能触发新的首页',()=>{
  const result=fixture('result'),home=result.callback('回到海岛');result.screen.destroy();const resultBefore=result.signature();home();assert.deepEqual(result.signature(),resultBefore);
  const paused=fixture('combat'),exit=paused.callback('保存并回到海岛'),abandon=paused.callback('结束本次挑战'),resume=paused.callback('继续冒险');
  paused.screen.destroy();const before=paused.signature();exit();abandon();resume();paused.screen.destroy();assert.deepEqual(paused.signature(),before);
  const live=fixture('result');live.callback('回到海岛')();assert.equal(live.calls.home,1);
});
test('旧控制器回调不能修改已启动的新一局或给它叠加错误面板',()=>{
  const f=fixture('recruit'),refresh=f.callback('自愿看广告 · 换一批');f.screen.destroy();
  f.real.abandonRun('fixture:exit');f.real.beginRun('fixture:next',1,Object.keys(f.real.snapshot.collection));
  f.ui.clear();f.ui.modal('新一局准备');const before=f.signature();refresh();assert.deepEqual(f.signature(),before);
});
test('真实IslandUI触摸结束事件在销毁后不播放通用确认音；活页只响一次且执行一次',()=>{
  const f=fixture('result'),button=f.buttons.find(b=>b.text==='自愿看广告 · 基础金币翻倍'),oldTouch=button.node.handlers.get('touch-end');
  f.screen.destroy();f.ui.clear();f.ui.modal('新的首页');const before=f.signature();oldTouch();assert.deepEqual(f.signature(),before);
  const live=fixture('result'),liveButton=live.buttons.find(b=>b.text==='自愿看广告 · 基础金币翻倍');
  liveButton.node.handlers.get('touch-end')();assert.equal(live.calls.audio.filter(e=>e[0]==='ui-click').length,1);
  assert.equal(live.calls.service.filter(e=>e[0]==='receiveAdReward').length,1);assert.equal(live.real.snapshot.results[live.real.snapshot.run.id].doubled,true);
});

const living=f=>Object.values(f.real.snapshot.run.units).filter(u=>!u.consumedBy);
const cards=f=>f.buttons.filter(b=>b.node.name.startsWith('伙伴卡:'));
const skills=f=>f.buttons.filter(b=>b.node.name.startsWith('技能:'));
const chooseCard=(f,id)=>{const b=cards(f).find(b=>b.node.name==='伙伴卡:'+id);assert.ok(b,'visible card '+id);b.action();};
const namedButton=(f,name)=>{const b=f.buttons.find(b=>b.node.name===name);assert.ok(b,'visible button '+name);return b;};
function globalRect(b){let x=b.x,y=b.y;for(let p=b.node.parent;p;p=p.parent){x+=p.position.x;y+=p.position.y;}return {left:x-b.w/2,right:x+b.w/2,bottom:y-b.h/2,top:y+b.h/2};}
function checkTargets(f){
  const rects=f.buttons.map(b=>({...globalRect(b),name:b.node.name}));
  f.buttons.forEach(b=>assert.ok(b.h>=48,'touch target is large: '+b.node.name));
  for(let i=0;i<rects.length;i++){
    const a=rects[i];assert.ok(a.left>=-640&&a.right<=640&&a.bottom>=-360&&a.top<=360,'inside design view: '+a.name);
    for(const b of rects.slice(i+1))assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.top,b.top)<=Math.max(a.bottom,b.bottom),'separate targets: '+a.name+' / '+b.name);
  }
}

const liveBench=f=>Object.values(f.real.snapshot.run.units).filter(u=>u.benchSlot!==undefined&&!u.consumedBy&&!u.removed);
const touch=(x,y)=>({getLocation:()=>({x:x+640,y:y+360})});
test('V0.6 drag swaps a field individual into a locked bench slot and ignores the old drag callback',()=>{
  const f=fixture('v06'),before=f.real.snapshot.collection,original=living(f).find(u=>u.slot===0),incoming=liveBench(f)[0];
  const n=f.nodes.findLast(n=>n.active&&n.name==='备战槽:'+incoming.benchSlot),end=n.handlers.get('touch-end');
  n.handlers.get('touch-start')(touch(n.position.x,n.position.y));n.handlers.get('touch-move')(touch(-512,-157));
  n.handlers.get('touch-cancel')({...touch(-512,-157),getEventCode:()=> 'touch-cancel'});assert.equal(f.real.snapshot.run.units[incoming.id].slot,null,'OS cancellation never deploys');
  n.handlers.get('touch-start')(touch(n.position.x,n.position.y));n.handlers.get('touch-move')(touch(-512,-157));
  n.handlers.get('touch-cancel')({...touch(-512,-157),getEventCode:()=> 'touch-end'});
  const r=f.real.snapshot.run;assert.equal(r.units[original.id].benchSlot,incoming.benchSlot);assert.equal(r.units[original.id].benchLocked,true);assert.equal(r.units[incoming.id].slot,0);
  assert.deepEqual(f.real.snapshot.collection,before);assert.equal(liveBench(f).length,5);const after=f.signature();end(touch(-332,-157));assert.deepEqual(f.signature(),after);assert.deepEqual(f.calls.error,[]);
});
test('V0.6 same-wave UI can fuse twice, and bubbles only erase locally before fixed-result reveal',()=>{
  const f=fixture('v06');
  for(let round=0;round<2;round++){
    f.screen.fusion();const [a,b]=liveBench(f);chooseCard(f,a.turtle.id);chooseCard(f,b.turtle.id);f.callback('开始合成')();
    const saved=f.real.snapshot,cover=f.nodes.findLast(n=>n.active&&n.name==='分层泡泡覆盖'),start=cover.handlers.get('touch-start'),move=cover.handlers.get('touch-move');
    const progress=()=>f.labels.find(l=>l.string.startsWith('泡泡慢慢散开了'))?.string;
    start(touch(0,0));assert.ok(progress());assert.deepEqual(f.real.snapshot,saved);
    move(touch(180,0));assert.deepEqual(f.real.snapshot,saved);cover.handlers.get('touch-end')();const rubbed=progress();move(touch(300,0));assert.equal(progress(),rubbed,'move without holding cannot erase');
    f.callback('直接揭晓')();assert.equal(f.real.snapshot.run.phase,'prep');assert.equal(f.real.snapshot.rng,saved.rng);f.screen.render();
    const done=f.signature();start(touch(0,0));move(touch(20,20));assert.deepEqual(f.signature(),done);
  }
  assert.equal(liveBench(f).length,3);const commands=f.calls.service.filter(c=>c[0]==='merge').map(c=>c[1]);assert.equal(new Set(commands).size,2);assert.deepEqual(f.calls.error,[]);
});
test('V0.6 2X advances one shared clock and world speed; hidden touch/update and resumed pause remain safe',()=>{
  const f=fixture('v06');f.callback('1X')();f.callback('守住海岛')();f.screen.update(.5);
  assert.equal(f.screen.battle.elapsed,1);assert.ok(f.calls.world.some(c=>c[0]==='speed'&&c[1]===2));
  const oldSpeed=f.callback('2X');f.screen.hide();const hidden=f.signature();oldSpeed();f.screen.update(.5);assert.deepEqual(f.signature(),hidden);
  f.screen.show();f.callback('继续冒险')();f.screen.update(.5);assert.equal(f.screen.battle.elapsed,2);f.callback('2X')();f.screen.update(.5);assert.equal(f.screen.battle.elapsed,2.5);assert.deepEqual(f.calls.error,[]);
});
test('V0.6 bubble heap covers result edges in three irregular varied layers and a tap never clears all',()=>{
  const f=fixture('v06'),{makeBubbleHeap,rubBubbleHeap}=f.bubbles,a=makeBubbleHeap('fixed'),b=makeBubbleHeap('fixed');assert.deepEqual(a,b);
  assert.equal(new Set(a.map(b=>b.layer)).size,3);assert.equal(new Set(a.map(b=>b.hue)).size,6);assert.ok(Math.max(...a.map(b=>b.radius))/Math.min(...a.map(b=>b.radius))>3);
  for(let x=-490;x<=490;x+=35)for(let y=-180;y<=180;y+=30)assert.ok(a.filter(b=>Math.hypot(b.x-x,b.y-y)<b.radius).length>=3,'cover protects full result region');
  assert.ok(rubBubbleHeap(a,0,0)<=2);assert.ok(a.filter(b=>!b.gone).length>150);assert.deepEqual(b,makeBubbleHeap('fixed'));
});

test('七位招募候选跨页可达；点卡不提交，确认一次且旧确认与旧刷新失效',()=>{
  const f=fixture('recruit'),r=f.real.snapshot.run,expected=[...r.selectedSources.filter(id=>!r.usedSources.includes(id)),...r.recruitCandidates.map(t=>t.id)];
  const before=hash(f.real.snapshot),seen=cards(f).map(b=>b.node.name.slice(4));assert.equal(seen.length,6);checkTargets(f);
  f.callback('下一页')();assert.equal(cards(f).length,1);seen.push(...cards(f).map(b=>b.node.name.slice(4)));
  assert.deepEqual(seen.sort(),expected.sort());const id=cards(f)[0].node.name.slice(4);chooseCard(f,id);assert.equal(hash(f.real.snapshot),before);
  f.callback('上一页')();assert.equal(f.screen.recruitSelection,id);const join=f.callback('加入队伍');join();const after=hash(f.real.snapshot);join();assert.equal(hash(f.real.snapshot),after);
  assert.equal(living(f).length,2);assert.equal(f.calls.service.filter(c=>c[0]==='recruit').length,1);assert.equal(f.calls.error.length,0);
  const refresh=fixture('recruit');refresh.callback('下一页')();chooseCard(refresh,cards(refresh)[0].node.name.slice(4));
  const old=refresh.callback('自愿看广告 · 换一批');old();assert.equal(refresh.screen.recruitSelection,'');assert.equal(refresh.buttons.find(b=>b.text==='加入队伍').options.disabled,true);
  const done=refresh.signature();old();assert.deepEqual(refresh.signature(),done);assert.equal(refresh.real.snapshot.run.refreshUsed,true);
});

test('十伙伴保留五个真实站位和五替补；两页队伍访问完整且不会改存档',()=>{
  const f=fixture('crowded'),all=living(f),before=hash(f.real.snapshot);assert.equal(all.length,10);
  const slots=f.buttons.filter(b=>b.node.name.startsWith('站位卡:'));assert.equal(slots.length,5);assert.deepEqual(slots.map(b=>Number(b.node.name.split(':')[1])),[0,1,2,3,4]);
  assert.equal(f.portraits.filter(p=>p.side===96).length,5);checkTargets(f);f.callback('队伍·替补5')();
  const seen=cards(f).map(b=>b.node.name.slice(4));assert.equal(seen.length,6);checkTargets(f);f.callback('下一页')();assert.equal(cards(f).length,4);seen.push(...cards(f).map(b=>b.node.name.slice(4)));
  assert.deepEqual(seen.sort(),all.map(u=>u.turtle.id).sort());const bench=all.find(u=>u.slot===null&&cards(f).some(b=>b.node.name==='伙伴卡:'+u.turtle.id));
  chooseCard(f,bench.turtle.id);assert.equal(f.screen.selected,bench.id);f.callback('选中并返回')();assert.equal(hash(f.real.snapshot),before);assert.equal(f.screen.selected,bench.id);
});

test('十伙伴合成两页保留选择顺序与真实预览；旧页卡片/重复合成不再提交',()=>{
  const f=fixture('crowded');f.screen.fusion();const first=cards(f)[0],firstId=first.node.name.slice(4),oldFirst=first.action;
  first.action();f.callback('下一页')();const second=cards(f)[0],secondId=second.node.name.slice(4);second.action();
  assert.equal(f.screen.mergeSelection.length,2);const chosen=clone(f.screen.mergeSelection);cards(f)[1].action();assert.deepEqual(clone(f.screen.mergeSelection),chosen);
  const after=f.signature();oldFirst();assert.deepEqual(f.signature(),after);checkTargets(f);
  f.callback('上一页')();assert.deepEqual(clone(f.screen.mergeSelection),chosen);assert.ok(f.labels.some(l=>/本次(12技能概率|技能池最多)/.test(l.string)));
  const merge=f.callback('开始合成');merge();assert.equal(f.real.snapshot.run.phase,'reveal');assert.equal(living(f).length,9);
  const event=Object.values(f.real.snapshot.run.merges)[0];assert.deepEqual(event.inputIds,chosen);assert.ok(firstId&&secondId);
  const committed=hash(f.real.snapshot);merge();assert.equal(hash(f.real.snapshot),committed);assert.equal(f.calls.service.filter(c=>c[0]==='merge').length,1);assert.equal(f.calls.error.length,0);
});

test('完整十二技能详情与比较同步两页可达；查看说明/天生培养不写存档',()=>{
  const f=fixture('crowded'),u=living(f)[0],before=hash(f.real.snapshot);assert.equal(u.turtle.skills.length,12);
  f.screen.unitDetails(u.id,()=>f.screen.team());assert.equal(skills(f).length,12);assert.deepEqual(skills(f).map(b=>b.node.name.slice(3)),u.turtle.skills);checkTargets(f);
  const old=skills(f)[11].action;old();assert.ok(f.labels.some(l=>l.string===data.SKILL_BY_ID[u.turtle.skills[11]].description));f.callback('×')();assert.equal(skills(f).length,12);
  f.screen.compare(u.id);f.callback('技能')();assert.equal(skills(f).length,12);const seen=skills(f).map(b=>b.node.name.slice(3));checkTargets(f);
  const skillRects=skills(f).map(globalRect),headers=f.labels.filter(l=>l.string.includes('技能 1–6/12'));
  assert.equal(headers.length,2);assert.ok(Math.max(...skillRects.map(r=>r.top))<Math.min(...headers.map(l=>l.node.position.y-l.node.h/2)),'column names do not overlap first skill row');
  const footerTop=Math.max(...f.buttons.filter(b=>b.y===-276).map(b=>globalRect(b).top));
  assert.ok(Math.min(...skillRects.map(r=>r.bottom))-footerTop>=16,'last skill row keeps 16 units from collect actions');
  f.callback('下一页')();assert.equal(skills(f).length,12);seen.push(...skills(f).map(b=>b.node.name.slice(3)));assert.deepEqual([...new Set(seen)].sort(),[...u.turtle.skills].sort());
  assert.equal(f.labels.filter(l=>l.string.includes('技能 7–12/12')).length,2);checkTargets(f);
  skills(f)[0].action();f.callback('×')();assert.equal(f.labels.filter(l=>l.string.includes('技能 7–12/12')).length,2);
  f.callback('天赋')();f.callback('查看天生 / 培养')();assert.ok(f.labels.some(l=>l.string.includes('攻击  天生')));checkTargets(f);
  assert.equal(hash(f.real.snapshot),before);assert.equal(f.calls.error.length,0);
});

test('比较能逐份查看全部真实来源；最终一次收录归档两份来源',()=>{
  const f=fixture('compare'),u=living(f)[0],sources=f.real.collectionPreview(u.id).sources;
  assert.equal(sources.length,2);checkTargets(f);f.callback('来源 1/2\n点击切换')();assert.ok(f.labels.some(l=>l.string===gameModule.displayName(sources[1])));
  f.callback('来源 2/2\n点击切换')();assert.ok(f.labels.some(l=>l.string===gameModule.displayName(sources[0])));
  const collect=f.callback('确认收录');collect();const after=hash(f.real.snapshot);collect();assert.equal(hash(f.real.snapshot),after);
  for(const t of sources){assert.ok(f.real.snapshot.history[t.id]);assert.equal(f.real.snapshot.collection[t.id],undefined);}
  assert.equal(f.calls.service.filter(c=>c[0]==='collect').length,1);
});

test('十二技能揭晓使用已存结果；擦拭转换考虑 UI 根缩放和平移，直接揭晓不重抽',()=>{
  const f=fixture('reveal12'),r=f.real.snapshot.run,u=living(f)[0],before=clone(u.turtle);assert.equal(before.skills.length,12);
  for(const id of before.skills)assert.ok(f.labels.some(l=>l.string===data.SKILL_BY_ID[id].name));checkTargets(f);
  f.viewport.scale=.62;f.viewport.x=35;f.viewport.y=-27;
  const cover=f.nodes.findLast(n=>n.name==='可以擦开的泡泡'),bubbles=cover.children.filter(n=>n.name==='泡泡'),first=bubbles[0];
  cover.handlers.get('touch-start')({getLocation:()=>({x:first.position.x*.62+35+640,y:first.position.y*.62-27+360})});
  assert.equal(first.active,false);assert.equal(bubbles[23].active,true);assert.deepEqual(living(f)[0].turtle,before);
  const finish=f.callback('直接揭晓');finish();assert.equal(f.real.snapshot.run.phase,'between',JSON.stringify({errors:f.calls.error,battle:f.screen.battle?.tick,paused:f.screen.paused}));assert.deepEqual(living(f)[0].turtle,before);
  const after=hash(f.real.snapshot);finish();assert.equal(hash(f.real.snapshot),after);assert.equal(f.calls.service.filter(c=>c[0]==='reveal').length,1);assert.equal(f.real.snapshot.run.merges[r.pendingMergeId].revealed,true);
});

test('布阵五张非重叠大卡调用真实交换，满替补与仅一位上场保持限制',()=>{
  const f=fixture('crowded'),units=living(f),a=units.find(u=>u.slot===0),b=units.find(u=>u.slot===1);f.screen.selected=a.id;f.screen.formation();checkTargets(f);
  assert.equal(f.buttons.find(b=>b.text==='放入替补').options.disabled,true);const move=namedButton(f,'布阵站位:1').action;move();
  assert.equal(living(f).find(u=>u.id===a.id).slot,1);assert.equal(living(f).find(u=>u.id===b.id).slot,0);const after=hash(f.real.snapshot);move();assert.equal(hash(f.real.snapshot),after);
  const single=fixture('recruit');single.screen.render();single.screen.formation();checkTargets(single);assert.equal(single.buttons.find(b=>b.text==='放入替补').options.disabled,true);
  assert.equal(f.calls.service.filter(c=>c[0]==='moveUnit').length,1);assert.equal(f.calls.error.length,0);
});

test('技能按钮遵守冷却/死亡/已排队边界，暂停/结算全入口满足大目标',()=>{
  const f=fixture('combat');checkTargets(f);f.callback('继续冒险')();checkTargets(f);const b=f.screen.battle,u=b.units[0],cast=namedButton(f,'战斗技能').action,skill=u.skills.find(id=>data.SKILL_BY_ID[id].active);
  approachStormTarget(b);u.cooldowns[skill]=b.tick+1;cast();assert.equal(b.commands.length,0);u.cooldowns[skill]=b.tick;cast();cast();assert.equal(b.commands.length,1);
  b.commands=[];u.alive=false;cast();assert.equal(b.commands.length,0);u.alive=true;const old=cast;f.screen.showPause();const before=f.signature();old();assert.deepEqual(f.signature(),before);
  const result=fixture('result');checkTargets(result);result.callback('比较伙伴 · 1 位')();checkTargets(result);
});

function dragNode(f,node,x,y){node.handlers.get('touch-start')(touch(node.position.x,node.position.y));node.handlers.get('touch-move')(touch(x,y));node.handlers.get('touch-cancel')({...touch(x,y),getEventCode:()=> 'touch-end'});}
test('新版五站位可直接拖动交换；开始后出战栏收起，波间重新出现',()=>{
  const f=fixture('v06'),a=living(f).find(u=>u.slot===0),b=living(f).find(u=>u.slot===1);
  dragNode(f,namedButton(f,'出战伙伴:0').node,-332,-157);
  assert.equal(f.real.snapshot.run.units[a.id].slot,1);assert.equal(f.real.snapshot.run.units[b.id].slot,0);
  f.callback('守住海岛')();assert.equal(f.buttons.filter(b=>b.node.name.startsWith('出战伙伴:')).length,0);
  assert.equal(f.nodes.filter(n=>n.active&&n.name.startsWith('战场拖动:')).length,5);
  f.callback('出战栏')();assert.equal(f.buttons.filter(b=>b.node.name.startsWith('出战伙伴:')).length,5);
  const before=f.screen.battle.units.find(u=>u.id===a.id);dragNode(f,namedButton(f,'出战伙伴:1').node,-512,-157);
  assert.equal(f.screen.battle.units.find(u=>u.id===a.id).slot,0);assert.equal(f.screen.battle.units.find(u=>u.id===a.id).hp,before.hp);
  f.callback('收起出战栏')();for(let i=0;i<300&&f.real.snapshot.run.phase==='combat';i++)f.screen.update(.5);
  assert.equal(f.real.snapshot.run.phase,'between',JSON.stringify({errors:f.calls.error,tick:f.screen.battle?.tick,paused:f.screen.paused}));assert.equal(f.buttons.filter(b=>b.node.name.startsWith('出战伙伴:')).length,5);
  assert.ok(f.buttons.some(b=>b.text==='开始下一波'));assert.deepEqual(f.calls.error,[]);
});

test('备战互拖先确认；涉及收藏时警告、取消不消耗，确认才永久消耗本体',()=>{
  const f=fixture('v06'),[first,second]=liveBench(f),original=living(f).find(u=>u.slot===0);
  f.real.deployBench('ui:park',first.id,0);f.screen.render();const before=f.real.snapshot;
  const drag=()=>{const source=liveBench(f).find(u=>u.id===second.id),target=liveBench(f).find(u=>u.id===original.id);dragNode(f,namedButton(f,'备战槽:'+source.benchSlot).node,-432+216*target.benchSlot,-294);};
  drag();assert.ok(f.labels.some(l=>l.string==='建议回家再合，战斗中合成有损失本体的风险。'));assert.deepEqual(f.real.snapshot,before);
  const old=f.callback('仍要合成，消耗本体');f.callback('先不合成')();old();assert.deepEqual(f.real.snapshot,before);
  drag();f.callback('仍要合成，消耗本体')();assert.equal(f.real.snapshot.run.phase,'reveal');assert.equal(f.real.snapshot.collection[original.savedId],undefined);
  assert.ok(f.real.snapshot.run.units[second.id].consumedBy);assert.deepEqual(f.calls.error,[]);
});

test('普通备战互拖合成不能因轻点、取消或失效页误消耗',()=>{
  const f=fixture('v06'),[a,b]=liveBench(f),before=f.real.snapshot;
  const n=namedButton(f,'备战槽:'+a.benchSlot).node;dragNode(f,n,-432+216*b.benchSlot,-294);
  assert.ok(f.buttons.some(b=>b.text==='确认合成'));assert.deepEqual(f.real.snapshot,before);
  f.callback('确认合成')();assert.equal(f.real.snapshot.run.phase,'reveal');assert.equal(liveBench(f).length,4);assert.deepEqual(f.calls.error,[]);
});

test('无尽五个图标固定，跳框不自动发奖；暂停发一份，隐藏和旧回调不重抽',()=>{
  const f=fixture('v06endless');
  for(let wave=1;wave<=5;wave++){
    f.screen.startWave();for(let i=0;i<600&&f.real.snapshot.run.phase==='combat';i++)f.screen.update(.5);
    assert.equal(f.real.snapshot.run.phase,'between',JSON.stringify({errors:f.calls.error,tick:f.screen.battle?.tick,paused:f.screen.paused}));
  }
  const node=clone(f.real.snapshot.run.rewardNodes[0]),rng=f.real.snapshot.rng,pause=f.callback('暂停开奖');
  const cards=f.nodes.filter(n=>n.active&&n.name.startsWith('随机奖励卡:'));assert.equal(cards.length,5);
  const positions=cards.map(n=>clone(n.position));assert.equal(f.buttons.length,1);
  f.screen.hide();f.screen.update(10);pause();assert.equal(f.real.snapshot.run.rewardNodes[0].chosen,undefined);
  f.screen.show();for(let i=0;i<50;i++)f.screen.update(.1);
  assert.equal(f.real.snapshot.run.rewardNodes[0].chosen,undefined,'animation alone never awards');
  assert.deepEqual(cards.map(n=>n.position),positions,'icons stay stationary');
  pause();assert.equal(f.real.snapshot.run.rewardNodes[0].chosen,undefined,'old page callback remains inert');f.callback('暂停开奖')();const after=f.real.snapshot;assert.equal(after.run.rewardNodes[0].chosen,node.randomIndex);assert.equal(after.rng,rng);
  assert.deepEqual(after.run.rewardLedger.find(e=>e.source==='choice').grant,node.choices[node.randomIndex]);
  pause();f.screen.update(10);assert.deepEqual(f.real.snapshot,after);
  const leave=f.buttons.find(b=>b.text.includes('放弃'));assert.ok(leave);leave.action();
  assert.ok(f.buttons.some(b=>b.text==='开始下一波'));assert.deepEqual(f.calls.error,[]);
});
