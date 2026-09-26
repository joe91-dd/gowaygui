const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
let ts;for(const p of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){try{ts=require(p);break;}catch{}}
if(!ts)throw new Error('Portrait tests require installed Cocos TypeScript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/TurtlePortraits.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture({failFrame=0,throwLoad=0}={}){
 const loads=[],textures=[],frames=[],sprites=[],messages=[];
 class Node extends EventEmitter{
  static EventType={NODE_DESTROYED:'destroyed'};
  constructor(){super();this.isValid=true;this.pending=false;this.components=[];this.position={x:11,y:23};this.size={width:64,height:64};}
  getComponent(Type){return this.components.find(c=>c instanceof Type&&c.isValid)||null;}
  addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}
  destroy(){this.pending=true;this.active=false;}
  // Cocos emits NODE_DESTROYED before immediately destroying its components.
  flushDestroy(){this.emit('destroyed');this.removeAllListeners();for(const c of this.components)c.isValid=false;this.isValid=false;}
 }
 class Sprite{static SizeMode={CUSTOM:'custom'};static Type={SIMPLE:'simple'};constructor(){this.isValid=true;this.enabled=true;this.spriteFrame=null;sprites.push(this);}}
 class ImageAsset{constructor(width=384,height=384){this.width=width;this.height=height;this.refs=0;}addRef(){this.refs++;}decRef(){assert.ok(this.refs>0,'owned image reference released exactly once');this.refs--;}}
 // Cocos isValid checks only this object's flags, not its parent Node's flags.
 const valid=(n,strict=false)=>!!n&&n.isValid!==false&&(!strict||!n.pending);
 class Texture2D{
  static Filter={LINEAR:'linear',NONE:'none'};static WrapMode={CLAMP_TO_EDGE:'clamp'};
  constructor(){this.destroyCount=0;textures.push(this);}setFilters(...v){this.filters=v;}setMipFilter(v){this.mip=v;}setWrapMode(...v){this.wrap=v;}
  destroy(){assert.equal(++this.destroyCount,1);}
 }
 class SpriteFrame{
  constructor(){if(failFrame&&frames.length+1===failFrame)throw new Error('allocation failure');this.destroyCount=0;frames.push(this);}
  destroy(){assert.equal(++this.destroyCount,1);assert.ok(!sprites.some(s=>valid(s)&&s.spriteFrame===this),'clear even pending Sprite references before releasing their frame');}
 }
 class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}class Size{constructor(width,height){Object.assign(this,{width,height});}}
 const Color={WHITE:{r:255,g:255,b:255,a:255}};
 const resources={load(resource,Type,callback){if(throwLoad&&loads.length+1===throwLoad)throw new Error('synchronous load failure');loads.push({resource,Type,callback,done:false});}};
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require(name){assert.equal(name,'cc');return{Color,ImageAsset,isValid:valid,Node,Rect,resources,Size,Sprite,SpriteFrame,Texture2D};},console:{info(...x){messages.push(['info',...x]);},error(...x){messages.push(['error',...x]);}}});
 const portraits=new module.exports.TurtlePortraits(),roles=Array.from(module.exports.TURTLE_PORTRAIT_ROLES);
 const resolve=(index,image=new ImageAsset(),error=null)=>{const load=loads[index];assert.ok(load);load.done=true;load.callback(error,image);return image;};
 const finish=(start=0)=>roles.map((role,i)=>resolve(start+i));
 return{portraits,roles,Node,Sprite,ImageAsset,loads,textures,frames,messages,resolve,finish};
}

test('五图乱序加载只请求一次；全部就绪后绑定，保留384整帧与原白色RGBA',()=>{
 const f=fixture(),a=new f.Node(),b=new f.Node(),c=new f.Node();
 f.portraits.preload();f.portraits.preload();f.portraits.attach(a,'stone');f.portraits.attach(b,'stone');f.portraits.attach(c,'leaf');
 assert.equal(f.loads.length,5);assert.equal(f.portraits.ready,false);
 const images=[];for(const i of [4,2,1,3])images.push(f.resolve(i));
 assert.equal(f.portraits.loadedCount,4);assert.equal(f.portraits.ready,false);assert.equal(a.getComponent(f.Sprite).enabled,false);
 images.push(f.resolve(0));assert.equal(f.portraits.ready,true);assert.equal(f.portraits.error,null);assert.ok(images.every(i=>i.refs===1));
 assert.equal(a.getComponent(f.Sprite).spriteFrame,b.getComponent(f.Sprite).spriteFrame);assert.notEqual(a.getComponent(f.Sprite).spriteFrame,c.getComponent(f.Sprite).spriteFrame);
 for(const frame of f.frames){assert.deepEqual({...frame.rect},{x:0,y:0,width:384,height:384});assert.equal(frame.packable,false);assert.deepEqual({...frame.originalSize},{width:384,height:384});}
 for(const texture of f.textures){assert.deepEqual(texture.filters,['linear','linear']);assert.equal(texture.mip,'none');assert.deepEqual(texture.wrap,['clamp','clamp']);}
 assert.deepEqual({...a.getComponent(f.Sprite).color},{r:255,g:255,b:255,a:255});assert.equal(a.getComponent(f.Sprite).trim,false);assert.equal(a.getComponent(f.Sprite).type,'simple');assert.deepEqual(a.position,{x:11,y:23});assert.deepEqual(a.size,{width:64,height:64});
 // Defensive duplicate callbacks cannot take a second ownership reference.
 const duplicate=new f.ImageAsset();f.loads[0].callback(null,duplicate);assert.equal(duplicate.refs,0);assert.equal(f.frames.length,5);
 f.portraits.destroy();assert.ok(images.every(i=>i.refs===0));
});

test('切屏待销毁节点不会绑定迟到头像；同节点改职业只保留一个组件和监听',()=>{
 const f=fixture(),old=new f.Node(),live=new f.Node();f.portraits.attach(old,'stone');old.destroy();f.portraits.attach(live,'spike');f.portraits.attach(live,'bubble');f.portraits.attach(live,'bubble');
 assert.equal(live.components.length,1);assert.equal(live.listenerCount('destroyed'),1);f.finish();
 assert.equal(old.getComponent(f.Sprite).spriteFrame,null);assert.equal(old.listenerCount('destroyed'),0);assert.equal(live.getComponent(f.Sprite).spriteFrame.name,'龟龟头像:bubble');
 f.portraits.detach(live);assert.equal(live.getComponent(f.Sprite).spriteFrame,null);assert.equal(live.listenerCount('destroyed'),0);f.portraits.destroy();
});

test('头像已就绪后Node请求销毁，同帧owner销毁先清仍有效Sprite引用，再释放共享帧',()=>{
 const f=fixture(),node=new f.Node();f.portraits.attach(node,'stone');const images=f.finish();
 const sprite=node.getComponent(f.Sprite),frame=sprite.spriteFrame;assert.ok(frame);node.destroy();
 assert.equal(node.isValid,true);assert.equal(node.pending,true);assert.equal(sprite.isValid,true);assert.equal(sprite.spriteFrame,frame);
 // The fixture's SpriteFrame.destroy also asserts that this ordering happens
 // before resource release, rather than only checking the eventual end state.
 f.portraits.destroy();assert.equal(sprite.spriteFrame,null);assert.equal(sprite.enabled,false);assert.equal(node.listenerCount('destroyed'),0);
 assert.equal(frame.destroyCount,1);assert.ok(images.every(i=>i.refs===0));node.flushDestroy();f.portraits.destroy();
});

test('单独pending的Sprite及NODE_DESTROYED事件中仍有效的组件均先解除引用',()=>{
 const pending=fixture(),node=new pending.Node();pending.portraits.attach(node,'leaf');pending.finish();const sprite=node.getComponent(pending.Sprite);sprite.pending=true;
 pending.portraits.detach(node);assert.equal(sprite.spriteFrame,null);assert.equal(sprite.enabled,false);pending.portraits.destroy();
 const event=fixture(),other=new event.Node();event.portraits.attach(other,'bubble');event.finish();const otherSprite=other.getComponent(event.Sprite);
 // Our binding listener runs first; a later listener can destroy the owner
 // while Cocos has not yet destroyed the node's components.
 other.once('destroyed',()=>{assert.equal(otherSprite.isValid,true);event.portraits.destroy();});other.destroy();other.flushDestroy();assert.equal(otherSprite.spriteFrame,null);
});

test('已销毁卡片解除绑定，共享头像直到管理器结束才释放',()=>{
 const f=fixture(),node=new f.Node();f.portraits.attach(node,'leaf');node.destroy();node.flushDestroy();const images=f.finish();
 const next=new f.Node();f.portraits.attach(next,'leaf');assert.equal(f.loads.length,5);assert.equal(next.getComponent(f.Sprite).enabled,true);
 next.destroy();next.flushDestroy();assert.ok(images.every(i=>i.refs===1));f.portraits.destroy();f.portraits.destroy();assert.ok(images.every(i=>i.refs===0));assert.ok(f.frames.every(x=>x.destroyCount===1));
});

test('部分加载失败释放已取得资源；显式重试隔离旧批次迟到回调',()=>{
 const f=fixture(),node=new f.Node();f.portraits.attach(node,'crystal');const old0=f.resolve(0),old1=f.resolve(1);f.resolve(2,null,new Error('offline'));
 assert.equal(f.portraits.state,'failed');assert.match(f.portraits.error,/offline/);assert.equal(f.portraits.loadedCount,0);assert.equal(old0.refs,0);assert.equal(old1.refs,0);assert.ok(f.textures.every(t=>t.destroyCount===1));
 f.portraits.preload();assert.equal(f.loads.length,5);f.portraits.retry();assert.equal(f.loads.length,10);assert.equal(f.portraits.state,'loading');
 const stale3=f.resolve(3),stale4=f.resolve(4);assert.equal(stale3.refs,0);assert.equal(stale4.refs,0);assert.equal(f.portraits.loadedCount,0);
 const fresh=f.finish(5);assert.equal(f.portraits.ready,true);assert.equal(node.getComponent(f.Sprite).spriteFrame.name,'龟龟头像:crystal');assert.equal(f.portraits.error,null);f.portraits.destroy();assert.ok(fresh.every(i=>i.refs===0));
});

test('加载中销毁管理器，清理已有资源且所有迟到回调不创建对象或复活头像',()=>{
 const f=fixture(),node=new f.Node();f.portraits.attach(node,'stone');const first=f.resolve(0);f.portraits.destroy();f.portraits.destroy();
 assert.equal(first.refs,0);const late=[];for(let i=1;i<5;i++)late.push(f.resolve(i));assert.ok(late.every(i=>i.refs===0));assert.equal(f.textures.length,1);assert.equal(f.frames.length,1);assert.equal(f.textures[0].destroyCount,1);
 assert.equal(node.getComponent(f.Sprite).spriteFrame,null);assert.equal(node.listenerCount('destroyed'),0);f.portraits.retry();f.portraits.preload();assert.equal(f.portraits.state,'destroyed');assert.equal(f.loads.length,5);
});

test('错尺寸、分配失败与同步load异常有明确失败状态且不泄漏',()=>{
 const bad=fixture();bad.portraits.preload();const wrong=bad.resolve(0,new bad.ImageAsset(384,64));assert.equal(bad.portraits.state,'failed');assert.match(bad.portraits.error,/384×64/);assert.equal(wrong.refs,0);assert.equal(bad.textures.length,0);bad.portraits.destroy();
 const partial=fixture({failFrame:2});partial.portraits.preload();const a=partial.resolve(0),b=partial.resolve(1);assert.equal(partial.portraits.state,'failed');assert.equal(a.refs,0);assert.equal(b.refs,0);assert.equal(partial.textures.length,2);assert.ok(partial.textures.every(t=>t.destroyCount===1));assert.equal(partial.frames[0].destroyCount,1);partial.portraits.destroy();
 const sync=fixture({throwLoad:1});sync.portraits.preload();assert.equal(sync.portraits.state,'failed');assert.match(sync.portraits.error,/synchronous/);assert.equal(sync.loads.length,0);sync.portraits.destroy();
});

test('运行五张PNG逐字节等于已批准384px真RGBA，推广未替换64px审查图',()=>{
 const root=path.resolve(__dirname,'../..');const promotion=JSON.parse(fs.readFileSync(path.join(root,'game/art-source/ui/portraits/runtime-promotion.json'),'utf8'));
 assert.equal(promotion.files.length,5);assert.equal(promotion.sourceFilesChanged,false);assert.equal(promotion.metaWritten,false);
 for(const f of promotion.files){const live=fs.readFileSync(path.join(root,f.target)),source=fs.readFileSync(path.join(root,f.source));assert.deepEqual(live,source);assert.equal(crypto.createHash('sha256').update(live).digest('hex'),f.sha256);assert.equal(live.readUInt32BE(16),384);assert.equal(live.readUInt32BE(20),384);assert.equal(live[24],8);assert.equal(live[25],6);}
});
