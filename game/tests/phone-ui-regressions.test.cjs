const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
const built=new Map();
if(process.env.GOWAYGUI_PHONE_BUILD)vm.runInNewContext(fs.readFileSync(path.join(process.env.GOWAYGUI_PHONE_BUILD,'assets/main/index.js'),'utf8'),{System:{register:(id,deps,declare)=>built.set(id,{deps,declare})}});
function load(name,deps={}){
 deps.cc={cclegacy:{_RF:{push(){},pop(){}}},...(deps.cc??{})};
 if(built.size){const r=built.get('chunks:///_virtual/'+name+'.ts'),out={};assert.ok(r,name);const body=r.declare((k,v)=>{if(typeof k==='object')Object.assign(out,k);else out[k]=v;return v;});r.deps.forEach((d,i)=>{const key=Object.keys(deps).find(k=>k===d||k.startsWith('.')&&path.basename(k)+'.ts'===path.basename(d));body.setters[i](key?deps[key]:{});});body.execute();return out;}
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view',name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:k=>deps[k]??{},setTimeout,clearTimeout,console});return module.exports;
}
class Node{
 static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel',NODE_DESTROYED:'destroy'};
 constructor(name='node',parent){this.name=name;this.parent=parent;this.events={};this.children=[];this.active=true;this.isValid=true;if(parent)parent.children.push(this);}
 on(k,f,_target,capture=false){(this.events[k]??=[]).push({f,capture});}once(k,f){this.on(k,f);}
 emit(k,e){for(const {f} of this.events[k]??[])f(e);}setScale(){}setPosition(){}getComponent(){}destroy(){this.isValid=false;}
}
function pagingFixture(){const cc={Node,view:{getScaleY:()=>1.5}},api=load('SwipePaging',{cc}),parent=new Node('page'),previous=new Node('previous',parent),next=new Node('next',parent),card=new Node('按钮:伙伴',parent),moves=[];
 const ui={isInteractive:n=>n.isValid&&n.active,click(){}};
 api.registerPageButton(ui,parent,previous,'‹',()=>moves.push(-1),false);api.registerPageButton(ui,parent,next,'›',()=>moves.push(1),false);
 const send=(type,x,y,target=card,id=1,cancelAsRelease=false)=>{const e={type,target,getEventCode:()=>cancelAsRelease?'end':type,getID:()=>id,getLocation:()=>({x:x*1.5,y:y*1.5})};parent.emit(type,e);return e;};
 return{api,parent,previous,next,card,moves,ui,send};}
test('Pagination recognizes only navigation labels; a home fold or purchase arrow alone is not a pager',()=>{
 const f=pagingFixture();for(const s of ['上一页','‹ 上一海域','‹'])assert.equal(f.api.pageButtonDirection(s),-1);for(const s of ['下一页','下一海域 ›','›'])assert.equal(f.api.pageButtonDirection(s),1);
 for(const s of ['查看 ›','购买','价格 ↑ 由低到高'])assert.equal(f.api.pageButtonDirection(s),0);
 const p=new Node('home'),n=new Node('fold',p);f.api.registerPageButton(f.ui,p,n,'‹',()=>assert.fail('fold triggered'),false);p.emit('start',{target:n,getID:()=>1,getLocation:()=>({x:0,y:0})});p.emit('end',{type:'end',target:n,getID:()=>1,getLocation:()=>({x:200,y:0})});
});
test('Swipe starts on a card, changes one page at release, and consumes its tap',()=>{
 const f=pagingFixture();f.send('start',200,0);assert.equal(f.send('move',100,2).propagationImmediateStopped,true);assert.deepEqual(f.moves,[]);assert.equal(f.send('end',50,3).propagationStopped,true);assert.deepEqual(f.moves,[1]);f.send('end',50,3);assert.deepEqual(f.moves,[1]);
});
test('Up/down paging, short movements, and first/last boundaries are safe',()=>{
 const f=pagingFixture();f.send('start',0,0);f.send('end',2,100);assert.deepEqual(f.moves,[1]);f.send('start',0,0);f.send('end',0,-100);assert.deepEqual(f.moves,[1,-1]);f.send('start',0,0);f.send('end',9,0);assert.equal(f.moves.length,2);
 f.api.registerPageButton(f.ui,f.parent,f.previous,'‹',()=>assert.fail('went before page 1'),true);f.send('start',0,0);f.send('end',100,0);assert.equal(f.moves.length,2);
});
test('OS cancellation and multi-touch do not page; a real release outside the card does',()=>{
 const f=pagingFixture();f.send('start',0,0);f.send('move',-90,0);f.send('cancel',-120,0);assert.deepEqual(f.moves,[]);
 f.send('start',0,0);f.send('start',0,0,f.card,2);f.send('end',-100,0);assert.deepEqual(f.moves,[]);
 f.send('start',0,0);f.send('move',-90,0);f.send('cancel',-100,0,f.card,1,true);assert.deepEqual(f.moves,[1]);
});
test('Vertical scroll and held-card dragging retain their gestures; quick swipes cancel pending card holds',()=>{
 const f=pagingFixture();f.api.reserveVerticalScroll(f.card);f.send('start',0,0);assert.ok(!f.send('move',0,100).propagationStopped);f.send('end',0,100);assert.deepEqual(f.moves,[]);
 f.api.pagingCardDrag(f.card,true);f.send('start',0,0);f.send('move',-90,0);f.send('end',-100,0);assert.deepEqual(f.moves,[]);f.api.pagingCardDrag(f.card,false);
 let canceled=0;f.api.pagingCancelCard(f.card,()=>canceled++);f.send('start',0,0);f.send('move',-90,0);f.send('end',-100,0);assert.ok(canceled>0);assert.deepEqual(f.moves,[1]);
});
test('World boss uses the current attached/aliased portrait and never requests retired image paths',()=>{
 const requested=[],cc={Node,Component:class{},Sprite:{EventType:{SPRITE_FRAME_CHANGED:'frame'}},isValid:n=>n.isValid,resources:{load:k=>requested.push(k)}};
 const {SeaChartMotion}=load('SeaChart',{cc}),motion=new SeaChartMotion();motion.node=new Node();let shown=0,fx=0;motion.surface=()=>fx++;
 const sprite={node:new Node(),enabled:true,spriteFrame:null};motion.fullBoss(sprite,'world-boss-leviathan',()=>shown++);assert.equal(sprite.enabled,true);assert.deepEqual(requested,[]);
 sprite.spriteFrame={texture:{id:'enemy-g1-h01'}};sprite.node.emit('frame');assert.equal(shown,1);assert.equal(fx,1);assert.equal(sprite.spriteFrame.texture.id,'enemy-g1-h01');
 const gone={node:new Node(),spriteFrame:null};motion.fullBoss(gone,'world-boss-crab',()=>assert.fail('retired UI'));gone.node.isValid=false;gone.node.emit('frame');
});
test('Home chat creates its EditBox on a dedicated inactive node, preserving native Graphics render data',()=>{
 class EditBox{static InputMode={SINGLE_LINE:1};static InputFlag={DEFAULT:0};static EventType={TEXT_CHANGED:'change'};}
 const root=new Node('root'),inputs=[],buttons=[];const make=(name,p,graphics=false)=>{const n=new Node(name,p);n.graphics=graphics;n.addComponent=Type=>{assert.ok(!n.graphics,'EditBox and Graphics share native node userData');assert.equal(n.active,false,'configure labels before native activation');const e=new Type();e.node=n;inputs.push(e);return e;};return n;};
 const ui={root,panel:(x,y,w,h,p=root)=>make('panel',p,true),group:(name,x,y,p=root)=>make(name,p),button:(label,x,y,w,h,action,o={})=>{buttons.push({label,action});return make('button',o.parent??root);},text:(s,x,y,f,c,p)=>({node:make('label',p),string:s}),anchorInput(){}};
 const {homeChat}=load('HomeChat',{cc:{Node,EditBox,Label:{Overflow:{CLAMP:1}}},'./IslandUI':{UI_COLORS:{}},'../core/community':{LOCAL_PLAYER:'me'}});
 const sent=[],service={snapshot:{community:{friends:[],blocked:[],messages:[]},results:{}},communityAction:(id,a)=>sent.push(a)},state={expanded:true,channel:'world',recipient:'',draft:'hello'};
 homeChat(ui,service,state,()=>{},()=> 'send',e=>{throw e;});assert.equal(inputs.length,1);assert.equal(inputs[0].node.active,true);assert.equal(inputs[0].string,'hello');buttons.find(b=>b.label==='发送').action();assert.equal(sent[0].text,'hello');assert.equal(state.draft,'');
});
test('Expedition music selection happens before its early HUD return',()=>{
 const {BattleScreen}=load('BattleScreen',{cc:{}}),s=Object.create(BattleScreen.prototype),music=[],run={phase:'combat',mode:'chapter',levelId:0,expedition:{},wave:0};
 Object.defineProperty(s,'run',{value:run});Object.defineProperty(s,'units',{value:[]});s.service={snapshot:{}};s.audio={playMusic:k=>music.push(k)};s.setPauseState=s.clearPage=()=>{};s.renderExpedition=()=>{};
 // The real renderer reads level waves, so supply its existing map definition.
 const {BattleScreen:B}=load('BattleScreen',{cc:{},'../core/data':{BATTLE_MAPS:[{waves:10}]}});Object.setPrototypeOf(s,B.prototype);
 s.battle={enemies:[]};s.render();assert.equal(music.at(-1),'bgm_battle');s.battle.enemies=[{kind:'boss',alive:true}];s.render();assert.equal(music.at(-1),'bgm_boss');run.phase='prep';s.render();assert.equal(music.at(-1),'bgm_home');
});
test('All 57 maps cover phone ratios without stretching, and fixed stations/pearls remain visible',()=>{
 const {battleCoverHalfHeight}=load('DisplayLayout');const core=require('../tools/test-built-core.cjs').loadBuiltCore(path.join(__dirname,'../build/android-native-material-20260928'));
 const {BATTLE_MAPS}=core.load('data'),{expeditionSlots}=core.load('expeditionRules');
 for(const w of [1920,2340,2400,2520])for(const map of BATTLE_MAPS){const h=battleCoverHalfHeight(w,1080,map.id>=50),halfW=h*w/1080,depth=18*(map.id<50?932/1688:941/1672);
  assert.ok(halfW<=9+.0001&&h<=depth/2+.0001,`blue border map ${map.id}`);
  for(const p of expeditionSlots(map.id)){const y=(.6*.045-p.z)/Math.sqrt(1+.6*.6);assert.ok(Math.abs(p.x)+.4<halfW&&Math.abs(y)+.30<h,`station clipped map ${map.id} @ ${w}`);}
  const end=map.route.at(-1),y=(.6*.045-end.z)/Math.sqrt(1+.6*.6);assert.ok(Math.abs(end.x)<halfW&&Math.abs(y)<h,`pearl clipped map ${map.id}`);
 }
});
test('Collapsed home adventure panel clears the physical edge, with a visible reopen tab',()=>{
 const {homeAdventureFold}=load('DisplayLayout');for(const width of [1280,1560,1600,1680]){const p=homeAdventureFold(width);assert.ok(-260+p.hiddenX<-width/2);assert.ok(p.tabX-14>-width/2);}
});
