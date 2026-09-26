const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Panel tests require installed Cocos TypeScript');
const compiled={};
for(const name of ['IslandPanels','IslandUI'])compiled[name]=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/'+name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'../art-source/ui/panels/candidate-02/layout.json'),'utf8'));

function fixture({failFrame=0,failSprite=0,loadThrows=false}={}){
  const loads=[],frames=[],textures=[],sprites=[],messages=[],releaseOrder=[];let spriteAttempts=0;
  class Node extends EventEmitter{
    static EventType={NODE_DESTROYED:'destroyed',TOUCH_START:'start',TOUCH_END:'end',TOUCH_CANCEL:'cancel'};
    constructor(name='node'){super();Object.assign(this,{name,isValid:true,active:true,pending:false,components:[],children:[],parent:null,layer:7,position:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}});}
    setParent(parent){this.removeFromParent();this.parent=parent;parent.children.push(this);}
    removeFromParent(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);this.parent=null;}}
    setSiblingIndex(index){const p=this.parent;p.children.splice(p.children.indexOf(this),1);p.children.splice(index,0,this);}
    setPosition(x,y,z=0){this.position={x,y,z};} setScale(x,y,z){this.scale={x,y,z};}
    getComponent(Type){return this.components.find(c=>c instanceof Type)||null;}
    addComponent(Type){if(Type===Sprite&&++spriteAttempts===failSprite)throw new Error('injected Sprite allocation failure');const c=new Type();c.node=this;this.components.push(c);return c;}
    off(event,fn){return this.removeListener(event,fn);}
    destroy(){this.pending=true;}
    flushDestroy(){this.emit('destroyed');for(const child of [...this.children])child.flushDestroy();this.removeAllListeners();this.isValid=false;for(const c of this.components)c.isValid=false;}
  }
  class UITransform{constructor(){this.isValid=true;this.anchorPoint={x:.5,y:.5};}setContentSize(width,height){this.width=width;this.height=height;}setAnchorPoint(x,y){this.anchorPoint={x,y};}}
  class Sprite{
    static SizeMode={CUSTOM:'custom'};static Type={SLICED:'sliced'};
    constructor(){this.isValid=true;this.enabled=true;this._frame=null;this.onUv=()=>{};sprites.push(this);}
    get spriteFrame(){return this._frame;}
    set spriteFrame(frame){this._frame?.off('uv',this.onUv);this._frame=frame;if(frame&&this.type==='sliced')frame.on('uv',this.onUv);}
  }
  class ImageAsset{constructor(width=512,height=1536){Object.assign(this,{width,height,refs:0,isValid:true});}addRef(){this.refs++;return this;}decRef(){assert.ok(this.refs>0);this.refs--;releaseOrder.push('image');return this;}}
  class Texture2D{
    static Filter={LINEAR:'linear',NONE:'none'};static WrapMode={CLAMP_TO_EDGE:'clamp'};
    constructor(){this.destroyCount=0;textures.push(this);}setFilters(...v){this.filters=v;}setMipFilter(v){this.mip=v;}setWrapMode(...v){this.wrap=v;}
    destroy(){assert.equal(++this.destroyCount,1);releaseOrder.push('texture');}
  }
  class SpriteFrame extends EventEmitter{
    constructor(){super();if(failFrame&&frames.length+1===failFrame)throw new Error('injected frame allocation failure');this.destroyCount=0;frames.push(this);}
    destroy(){assert.equal(++this.destroyCount,1);assert.equal(this.listenerCount('uv'),0,'detach SLICED listeners before shared frame destruction');assert.ok(sprites.every(s=>s.spriteFrame!==this),'no living or pending Sprite may retain a destroyed shared frame');releaseOrder.push('frame');}
  }
  class Color{constructor(r=0,g=0,b=0,a=255){Object.assign(this,{r,g,b,a});}static fromHEX(c,hex){const value=parseInt(hex.slice(1),16);c.r=value>>16;c.g=(value>>8)&255;c.b=value&255;return c;}}
  class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
  class Size{constructor(width,height){Object.assign(this,{width,height});}}
  class Vec2{constructor(x,y){Object.assign(this,{x,y});}}
  class Graphics{constructor(){this.isValid=true;this.rounds=[];}roundRect(...v){this.rounds.push(v);}fill(){}stroke(){}}
  class Label{static HorizontalAlign={CENTER:0};static VerticalAlign={CENTER:0};static Overflow={SHRINK:0,CLAMP:1};constructor(){this.isValid=true;}}
  const isValid=(v,strict=false)=>!!v&&v.isValid!==false&&(!strict||(!v.pending&&!v.node?.pending));
  const resources={load(resource,Type,callback){loads.push({resource,Type,callback});if(loadThrows)throw new Error('load call failed');}};
  const cc={Color,ImageAsset,isValid,Node,Rect,resources,Size,Sprite,SpriteFrame,Texture2D,UITransform,Vec2,Graphics,Label,Layers:{Enum:{UI_2D:99}},tween:()=>({stop(){}})};
  const modules={};
  function load(name){
    if(modules[name])return modules[name];const module={exports:{}};modules[name]=module.exports;
    vm.runInNewContext(compiled[name],{module,exports:module.exports,
      require(id){if(id==='cc')return cc;return load(id.replace('./',''));},
      console:{info(...v){messages.push(['info',...v]);},error(...v){messages.push(['error',...v]);}},
    });
    return module.exports;
  }
  const panels=new (load('IslandPanels').IslandPanels)();const IslandUI=load('IslandUI').IslandUI;
  const resolve=(image=new ImageAsset(),error=null,index=loads.length-1)=>{loads[index].callback(error,image);return image;};
  const parent=(w=240,h=64)=>{const n=new Node();n.addComponent(UITransform).setContentSize(w,h);return n;};
  return {panels,IslandUI,Node,UITransform,Sprite,Color,Graphics,ImageAsset,loads,frames,textures,sprites,messages,releaseOrder,resolve,parent};
}

test('预载门控共用一次请求；30帧精确对应冻结rect/insets并共享一张atlas',async()=>{
  const f=fixture(),first=f.panels.preload();assert.equal(f.panels.preload(),first);assert.equal(f.loads.length,1);assert.equal(f.loads[0].resource,'ui/panels/panels-atlas');
  const image=f.resolve();assert.equal(await first,true);assert.equal(f.panels.state,'ready');assert.equal(image.refs,1);assert.equal(f.textures.length,1);assert.equal(f.frames.length,30);
  for(const item of layout.frames){const frame=f.frames.find(frame=>frame.name==='海岛面板:'+item.id);assert.ok(frame);assert.deepEqual({...frame.rect},item.rect);assert.deepEqual({...frame.originalSize},item.originalSize);assert.deepEqual({...frame.offset},item.offset);assert.equal(frame.insetLeft,item.insets.left);assert.equal(frame.insetRight,item.insets.right);assert.equal(frame.insetTop,item.insets.top);assert.equal(frame.insetBottom,item.insets.bottom);assert.equal(frame.texture,f.textures[0]);assert.equal(frame.packable,false);assert.equal(frame.rotated,false);}
  assert.deepEqual(f.textures[0].filters,['linear','linear']);assert.equal(f.textures[0].mip,'none');assert.deepEqual(f.textures[0].wrap,['clamp','clamp']);f.panels.destroy();assert.equal(image.refs,0);
});

test('十种最小高度不挤压九宫格角；2x/.5外延保留原父点击尺寸与透明余量',async()=>{
  const f=fixture();f.panels.preload();f.resolve();
  for(const radius of [10,14,18,21,22,24,16,19,20,21.5]){
    const w=144,h=2*radius,parent=f.parent(w,h);parent.setPosition(17,-23);const text=new f.Node('existing label');text.setParent(parent);
    assert.equal(f.panels.attach(parent,w,h,radius,new f.Color(1,2,3,207)),true);
    assert.equal(parent.children.length,5);assert.equal(parent.children[4],text);assert.equal(parent.getComponent(f.UITransform).width,w);assert.equal(parent.getComponent(f.UITransform).height,h);assert.deepEqual(parent.position,{x:17,y:-23,z:0});
    const layers=parent.children.slice(0,4);assert.deepEqual(layers.map(n=>n.name),['面板装饰:shadow','面板装饰:fill','面板装饰:border','面板装饰:highlight']);
    assert.equal(layers[0].getComponent(f.Sprite).spriteFrame,layers[1].getComponent(f.Sprite).spriteFrame,'shadow reuses fill frame');
    for(const node of layers){const t=node.getComponent(f.UITransform),s=node.getComponent(f.Sprite),frame=s.spriteFrame;assert.equal(t.width,2*(w+4));assert.equal(t.height,2*(h+4));assert.deepEqual(node.scale,{x:.5,y:.5,z:1});assert.equal(t.width*.5-4,w);assert.equal(t.height*.5-4,h);assert.ok(t.width>=frame.insetLeft+frame.insetRight);assert.equal(t.height,frame.insetTop+frame.insetBottom,'zero center height is allowed without corner compression');assert.equal(s.type,'sliced');assert.equal(s.sizeMode,'custom');assert.equal(s.trim,false);assert.equal(node.listenerCount('start')+node.listenerCount('end'),0);}
    assert.equal(layers[1].getComponent(f.Sprite).color.a,207,'call-site opacity retained');parent.destroy();parent.flushDestroy();
  }
  assert.equal(f.textures.length,1);f.panels.destroy();
});

test('两面板借用同帧；关一页不释放共享资源，所有者先解绑含pending节点再释放',()=>{
  const f=fixture();f.panels.preload();const image=f.resolve(),a=f.parent(),b=f.parent();f.panels.attach(a,240,64,22,new f.Color());f.panels.attach(b,240,64,22,new f.Color());
  assert.equal(a.children[1].getComponent(f.Sprite).spriteFrame,b.children[1].getComponent(f.Sprite).spriteFrame);a.destroy();a.flushDestroy();assert.equal(image.refs,1);assert.equal(f.frames[0].destroyCount,0);
  b.destroy();assert.equal(b.isValid,true);f.panels.destroy();f.panels.destroy();assert.equal(b.children.length,0);assert.equal(image.refs,0);assert.equal(f.frames.length,30);assert.ok(f.frames.every(frame=>frame.destroyCount===1));assert.deepEqual(f.releaseOrder.slice(-2),['texture','image']);assert.equal(b.listenerCount('destroyed'),0);
});

test('所有者在加载中销毁立即结束gate；迟到资源不建立引用或节点',async()=>{
  const f=fixture(),gate=f.panels.preload();f.panels.destroy();assert.equal(await gate,false);const image=f.resolve();assert.equal(image.refs,0);assert.equal(f.frames.length,0);assert.equal(f.textures.length,0);assert.equal(f.panels.state,'destroyed');assert.equal(await f.panels.retry(),false);
});

test('普通面板注入前必须完成gate；只有未注入或明确特殊圆角使用Graphics',async()=>{
  const f=fixture(),root=new f.Node();const legacy=new f.IslandUI(root);assert.ok(legacy.panel(0,0,240,64).getComponent(f.Graphics));
  const ui=new f.IslandUI(root,()=>{},undefined,f.panels);assert.throws(()=>ui.panel(0,0,240,64),/预载尚未完成/);assert.equal(f.loads.length,0,'drawing must not silently start an ungated load');
  assert.ok(ui.panel(0,0,240,64,root,'#112233',255,14/.67).getComponent(f.Graphics));f.panels.preload();f.resolve();const normal=ui.panel(0,0,240,64);assert.equal(normal.getComponent(f.Graphics),null);assert.equal(normal.children.length,4);f.panels.destroy();
});

test('载入失败及坏尺寸拒收，显式retry重新加载；旧回调不能抢占新的attempt',async()=>{
  const f=fixture(),first=f.panels.preload();f.resolve(null,new Error('offline'));assert.equal(await first,false);assert.equal(await f.panels.preload(),false);assert.equal(f.loads.length,1);assert.equal(f.panels.state,'failed');
  const next=f.panels.retry();assert.equal(f.loads.length,2);const stale=f.resolve(new f.ImageAsset(),null,0);assert.equal(stale.refs,0);assert.equal(f.panels.state,'loading');const image=f.resolve();assert.equal(await next,true);assert.equal(image.refs,1);f.panels.destroy();
  const wrong=fixture(),bad=wrong.panels.preload();const badImage=wrong.resolve(new wrong.ImageAsset(1024,512));assert.equal(await bad,false);assert.equal(badImage.refs,0);assert.equal(wrong.textures.length,0);assert.equal(wrong.messages.filter(m=>m[0]==='error').length,1);wrong.panels.destroy();
});

test('部分帧分配和同步加载异常完整释放；面板创建失败仅移除自己的装饰',async()=>{
  const partial=fixture({failFrame:7}),gate=partial.panels.preload(),image=partial.resolve();assert.equal(await gate,false);assert.equal(image.refs,0);assert.equal(partial.frames.length,6);assert.ok(partial.frames.every(frame=>frame.destroyCount===1));assert.equal(partial.textures[0].destroyCount,1);partial.panels.destroy();
  const sync=fixture({loadThrows:true});assert.equal(await sync.panels.preload(),false);assert.equal(sync.panels.state,'failed');sync.panels.destroy();
  const allocation=fixture({failSprite:3});allocation.panels.preload();allocation.resolve();const parent=allocation.parent(),existing=new allocation.Node('label');existing.setParent(parent);assert.throws(()=>allocation.panels.attach(parent,240,64,22,new allocation.Color()),/allocation/);assert.deepEqual(parent.children,[existing]);assert.equal(parent.listenerCount('destroyed'),0);allocation.panels.destroy();
});

test('pending/destroyed父节点不接收面板，重复attach不残留旧decor或多份监听',()=>{
  const f=fixture();f.panels.preload();f.resolve();const parent=f.parent();f.panels.attach(parent,240,64,22,new f.Color());const old=[...parent.children];f.panels.attach(parent,240,64,22,new f.Color());assert.equal(parent.children.length,4);assert.equal(parent.listenerCount('destroyed'),1);assert.ok(old.every(n=>n.parent===null&&n.pending&&n.getComponent(f.Sprite).spriteFrame===null));
  parent.destroy();assert.equal(f.panels.attach(parent,240,64,22,new f.Color()),false);parent.flushDestroy();assert.equal(f.panels.attach(parent,240,64,22,new f.Color()),false);f.panels.destroy();
});

test('按钮名字/尺寸/位置、文字和事件保持父节点；装饰不新增触控监听',()=>{
  const f=fixture();f.panels.preload();f.resolve();const root=new f.Node();let clicks=0,actions=0;const ui=new f.IslandUI(root,()=>clicks++,undefined,f.panels);
  const button=ui.button('开始守岛',33,-44,210,44,()=>actions++);assert.equal(button.name,'按钮:开始守岛');assert.deepEqual(button.position,{x:33,y:-44,z:0});assert.equal(button.getComponent(f.UITransform).width,210);assert.equal(button.getComponent(f.UITransform).height,44);assert.equal(button.getComponent(f.Graphics),null);assert.equal(button.children[4].name,'文字:开始守岛');
  button.emit('start');assert.equal(button.scale.x,.97);button.emit('cancel');assert.equal(button.scale.x,1);button.emit('end');assert.equal(actions,0,'cancelled touch cannot click');button.emit('start');button.emit('end');assert.equal(clicks,1);assert.equal(actions,1);assert.equal(button.scale.x,1);
  const disabled=ui.button('暂不可用',0,0,140,36,()=>actions++,{disabled:true});assert.equal(disabled.listenerCount('start')+disabled.listenerCount('end')+disabled.listenerCount('cancel'),0);disabled.emit('end');assert.equal(actions,1);f.panels.destroy();
});

test('实际运行PNG等于已审冻结源，布局/图集推广记录指向同一文件',()=>{
  const base=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(base,'art-source/ui/panels/runtime-promotion.json'),'utf8')),entry=manifest.files[0];
  const root=path.join(base,'..'),png=fs.readFileSync(path.join(root,entry.destination));assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),layout.width);assert.equal(png.readUInt32BE(20),layout.height);assert.equal(png[25],6);assert.equal(png.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(png).digest('hex'),entry.sha256);assert.deepEqual(png,fs.readFileSync(path.join(root,entry.source)));
});

test('同一UI内已移除、待销毁或隐藏页的旧触摸不播放确认音或执行动作',()=>{
  const f=fixture();f.panels.preload();f.resolve();const root=new f.Node();let clicks=0,actions=0;
  const ui=new f.IslandUI(root,()=>clicks++,undefined,f.panels);
  for(const retire of [n=>n.destroy(),n=>n.removeFromParent(),n=>{n.active=false;}]){
    const page=ui.group('page'),button=ui.button('确认',0,0,296,88,()=>actions++,{parent:page});
    button.emit('end');const before=[clicks,actions];retire(page);
    button.emit('start');button.emit('end');button.emit('cancel');
    assert.deepEqual([clicks,actions],before,'an obsolete ancestor retires its buttons before deferred destruction');
    assert.equal(button.scale.x,1);
  }
  assert.deepEqual([clicks,actions],[3,3]);f.panels.destroy();
});
