const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
let ts;
for(const candidate of [process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
  try{ts=require(candidate);break;}catch{}
}
if(!ts)throw new Error('Icon tests require the installed Cocos TypeScript compiler');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/IslandIcons.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;

function fixture({failFrame=0,failLoad=false}={}){
  const loads=[],textures=[],frames=[],sprites=[],messages=[];
  class Node extends EventEmitter{
    static EventType={NODE_DESTROYED:'destroyed'};
    constructor(){super();this.isValid=true;this.pending=false;this.components=[];}
    getComponent(Type){return this.components.find(c=>c instanceof Type)||null;}
    addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}
    off(event,fn){return this.removeListener(event,fn);}
    destroy(){this.pending=true;}
    // Cocos emits NODE_DESTROYED while components still exist; the node's final
    // Destroyed flag is set after component teardown, not before this event.
    flushDestroy(){this.emit('destroyed');this.removeAllListeners();for(const c of this.components)c.isValid=false;this.isValid=false;}
  }
  class Sprite{
    static SizeMode={CUSTOM:'custom'};static Type={SIMPLE:'simple'};
    constructor(){this.isValid=true;this.spriteFrame=null;this.enabled=true;sprites.push(this);}
  }
  class ImageAsset{
    constructor(width=1024,height=512){this.width=width;this.height=height;this.refs=0;}
    addRef(){this.refs++;return this;}
    decRef(){assert.ok(this.refs>0,'source image reference released once');this.refs--;return this;}
  }
  class Texture2D{
    static Filter={LINEAR:'linear',NONE:'none'};static WrapMode={CLAMP_TO_EDGE:'clamp'};
    constructor(){this.destroyCount=0;textures.push(this);}
    setFilters(...value){this.filters=value;}
    setMipFilter(value){this.mipFilter=value;}
    setWrapMode(...value){this.wrap=value;}
    destroy(){this.destroyCount++;assert.equal(this.destroyCount,1);}
  }
  class SpriteFrame{
    constructor(){if(failFrame&&frames.length+1===failFrame)throw new Error('fixture frame allocation failure');this.destroyCount=0;frames.push(this);}
    destroy(){this.destroyCount++;assert.equal(this.destroyCount,1);assert.ok(!sprites.some(sprite=>isValid(sprite)&&sprite.spriteFrame===this),'clear even pending Sprite references before releasing their frame');}
  }
  class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
  class Size{constructor(width,height){Object.assign(this,{width,height});}}
  // CCObject validity belongs to this object. A pending parent Node does not
  // automatically make its live Sprite invalid (even with strict=true).
  const isValid=(object,strict=false)=>!!object&&object.isValid!==false&&(!strict||!object.pending);
  const resources={load(resource,Type,callback){loads.push({resource,Type,callback});if(failLoad)throw new Error('fixture synchronous load failure');}};
  const module={exports:{}};
  vm.runInNewContext(compiled,{module,exports:module.exports,require(name){assert.equal(name,'cc');return {ImageAsset,isValid,Node,Rect,resources,Size,Sprite,SpriteFrame,Texture2D};},console:{info(...args){messages.push(['info',...args]);},error(...args){messages.push(['error',...args]);}}});
  const icons=new module.exports.IslandIcons();
  const resolve=(image=new ImageAsset(),error=null,index=loads.length-1)=>{assert.ok(loads[index]);loads[index].callback(error,image);return image;};
  return {icons,Node,Sprite,ImageAsset,loads,textures,frames,messages,resolve,allowLoad(){failLoad=false;},ids:Array.from(module.exports.ISLAND_ICON_IDS)};
}

test('一次图集加载，八帧整数切片，共享同一纹理与同名SpriteFrame',()=>{
  const f=fixture(),a=new f.Node(),b=new f.Node(),c=new f.Node();
  f.icons.preload();f.icons.preload();f.icons.attach(a,'gold');f.icons.attach(b,'gold');f.icons.attach(c,'growth-history');
  assert.equal(f.loads.length,1);assert.equal(f.loads[0].resource,'ui/island-icons');assert.equal(f.loads[0].Type,f.ImageAsset);
  assert.equal(a.getComponent(f.Sprite).enabled,false);
  const image=f.resolve();assert.equal(f.icons.state,'ready');assert.equal(f.icons.ready,true);assert.equal(f.icons.error,null);assert.equal(image.refs,1);assert.equal(f.textures.length,1);assert.equal(f.frames.length,8);
  assert.equal(a.getComponent(f.Sprite).spriteFrame,b.getComponent(f.Sprite).spriteFrame);
  assert.equal(c.getComponent(f.Sprite).spriteFrame,f.frames[7]);
  f.frames.forEach((frame,i)=>{
    assert.deepEqual({...frame.rect},{x:i%4*256,y:Math.floor(i/4)*256,width:256,height:256});
    assert.deepEqual({...frame.originalSize},{width:256,height:256});assert.equal(frame.texture,f.textures[0]);assert.equal(frame.packable,false);
  });
  assert.deepEqual(f.textures[0].filters,['linear','linear']);assert.equal(f.textures[0].mipFilter,'none');assert.deepEqual(f.textures[0].wrap,['clamp','clamp']);
  assert.equal(a.getComponent(f.Sprite).sizeMode,'custom');assert.equal(a.getComponent(f.Sprite).enabled,true);f.icons.destroy();
});

test('切屏待销毁节点仍isValid时使用strict检查，迟到资源只绑定新页面',()=>{
  const f=fixture(),old=new f.Node(),next=new f.Node();f.icons.attach(old,'gold');old.destroy();
  assert.equal(old.isValid,true);f.icons.attach(next,'stamina');f.resolve();
  assert.equal(old.getComponent(f.Sprite).spriteFrame,null);assert.equal(old.getComponent(f.Sprite).enabled,false);
  assert.equal(old.listenerCount('destroyed'),0);assert.equal(next.getComponent(f.Sprite).spriteFrame,f.frames[1]);f.icons.destroy();
});

test('已销毁节点立即解除等待记录；后续节点无需再次加载图集',()=>{
  const f=fixture(),old=new f.Node();f.icons.attach(old,'attack-medicine');old.destroy();old.flushDestroy();
  const image=f.resolve();assert.equal(old.getComponent(f.Sprite).spriteFrame,null);
  const next=new f.Node();f.icons.attach(next,'health-medicine');assert.equal(f.loads.length,1);assert.equal(next.getComponent(f.Sprite).spriteFrame,f.frames[3]);
  next.destroy();next.flushDestroy();assert.equal(image.refs,1,'shared atlas lives until its owner ends');f.icons.destroy();assert.equal(image.refs,0);
});

test('所有者在资源完成前销毁，迟到回调不创建纹理/帧/引用或恢复图标',()=>{
  const f=fixture(),node=new f.Node();f.icons.attach(node,'gold');f.icons.destroy();f.icons.destroy();const image=f.resolve();
  assert.equal(f.icons.state,'destroyed');assert.equal(f.textures.length,0);assert.equal(f.frames.length,0);assert.equal(image.refs,0);
  assert.equal(node.getComponent(f.Sprite).enabled,false);assert.equal(node.listenerCount('destroyed'),0);assert.equal(f.messages.length,0);
});

test('销毁先清理活跃Sprite再释放帧和纹理，不重复释放source ImageAsset',()=>{
  const f=fixture(),a=new f.Node(),b=new f.Node();f.icons.attach(a,'defense-medicine');f.icons.attach(b,'growth-medicine');const image=f.resolve();
  f.icons.destroy();f.icons.destroy();assert.equal(a.getComponent(f.Sprite).spriteFrame,null);assert.equal(b.getComponent(f.Sprite).spriteFrame,null);
  assert.equal(a.listenerCount('destroyed'),0);assert.equal(b.listenerCount('destroyed'),0);assert.equal(image.refs,0);
  assert.equal(f.textures[0].destroyCount,1);assert.ok(f.frames.every(frame=>frame.destroyCount===1));
});

test('资源失败记录明确失败状态，保持图标禁用，不把文字退化当通过或反复请求',()=>{
  const f=fixture(),a=new f.Node();f.icons.attach(a,'gold');f.resolve(null,new Error('offline'));
  f.icons.attach(new f.Node(),'collection-lock');f.icons.preload();
  assert.equal(f.icons.state,'failed');assert.equal(f.icons.ready,false);assert.match(f.icons.error,/offline/);assert.equal(f.loads.length,1);assert.equal(f.textures.length,0);assert.equal(a.getComponent(f.Sprite).enabled,false);
  const errors=f.messages.filter(m=>m[0]==='error');assert.equal(errors.length,1);assert.match(errors[0][2],/failed/);assert.match(errors[0][2],/不能计作美术验收通过/);f.icons.destroy();
});

test('尺寸不正确拒绝切片；分配中失败会释放所有已分配资源',()=>{
  const bad=fixture();bad.icons.attach(new bad.Node(),'gold');const wrong=bad.resolve(new bad.ImageAsset(1774,887));
  assert.equal(bad.icons.state,'failed');assert.equal(wrong.refs,0);assert.equal(bad.textures.length,0);bad.icons.destroy();
  const partial=fixture({failFrame:4});partial.icons.attach(new partial.Node(),'gold');const image=partial.resolve();
  assert.equal(partial.icons.state,'failed');assert.equal(image.refs,0);assert.equal(partial.frames.length,3);assert.ok(partial.frames.every(f=>f.destroyCount===1));assert.equal(partial.textures[0].destroyCount,1);partial.icons.destroy();
});

test('同一节点改图标复用组件，只保留一份销毁监听',()=>{
  const f=fixture(),node=new f.Node();f.icons.attach(node,'gold');f.resolve();
  f.icons.attach(node,'stamina');f.icons.attach(node,'stamina');assert.equal(node.components.length,1);assert.equal(node.listenerCount('destroyed'),1);assert.equal(node.getComponent(f.Sprite).spriteFrame,f.frames[1]);f.icons.destroy();
});

test('运行资源是已审查的1024x512 RGBA图集，未替换为伪棋盘候选',()=>{
  const png=fs.readFileSync(path.join(__dirname,'../assets/resources/ui/island-icons.png'));
  assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),512);assert.equal(png[25],6,'RGBA PNG color type');
  assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'422cc6b40f689fcaebbb4a2fe2fd315ab9dfb27b7a15d485561b9102e34dd129');
});

test('显式重试失败批次只发一次请求，旧成功/错误回调不覆盖新结果或多持有图集',()=>{
  const f=fixture(),node=new f.Node();f.icons.attach(node,'stamina');f.resolve(null,new Error('offline'));
  f.icons.retry();f.icons.retry();f.icons.preload();assert.equal(f.loads.length,2);assert.equal(f.icons.ready,false);assert.equal(f.icons.error,null);
  const stale=new f.ImageAsset();f.resolve(stale,null,0);f.resolve(null,new Error('late failure'),0);
  assert.equal(stale.refs,0);assert.equal(f.icons.state,'loading');assert.equal(f.frames.length,0);
  const image=f.resolve();assert.equal(f.icons.ready,true);assert.equal(node.getComponent(f.Sprite).spriteFrame,f.frames[1]);
  f.resolve(image);f.resolve(null,new Error('duplicate success callback failed'));f.icons.retry();
  assert.equal(image.refs,1);assert.equal(f.frames.length,8);assert.equal(f.textures.length,1);assert.equal(f.icons.ready,true);assert.equal(f.loads.length,2);
  f.icons.destroy();assert.equal(image.refs,0);assert.equal(stale.refs,0);
});

test('同步抛错留下的旧回调被代号隔离，销毁后重试和迟到回调均不分配',()=>{
  const f=fixture({failLoad:true});f.icons.preload();assert.equal(f.icons.state,'failed');assert.match(f.icons.error,/synchronous/);
  f.allowLoad();f.icons.retry();const stale=new f.ImageAsset();f.resolve(stale,null,0);
  assert.equal(stale.refs,0);assert.equal(f.icons.state,'loading');assert.equal(f.frames.length,0);
  f.icons.destroy();f.icons.retry();f.icons.preload();const late=f.resolve();assert.equal(f.icons.ready,false);assert.equal(f.loads.length,2);
  assert.equal(late.refs,0);assert.equal(f.textures.length,0);assert.equal(f.frames.length,0);
});

test('无效图片或持有引用失败不切片，不释放从未获得的源引用，随后可正常重试',()=>{
  const f=fixture();f.icons.preload();const invalid=new f.ImageAsset();invalid.isValid=false;f.resolve(invalid);
  assert.equal(f.icons.state,'failed');assert.equal(invalid.refs,0);assert.equal(f.frames.length,0);
  f.icons.retry();const rejected=new f.ImageAsset();rejected.addRef=()=>{throw new Error('reference unavailable');};f.resolve(rejected);
  assert.equal(f.icons.state,'failed');assert.equal(rejected.refs,0);assert.equal(f.textures.length,0);
  f.icons.retry();const image=f.resolve();assert.equal(f.icons.ready,true);assert.equal(image.refs,1);f.icons.destroy();assert.equal(image.refs,0);
});

test('Node刚请求销毁而Sprite仍有效时，同帧销毁图标owner先断开引用再释放共享帧',()=>{
  const f=fixture(),node=new f.Node();f.icons.attach(node,'gold');const image=f.resolve(),sprite=node.getComponent(f.Sprite),frame=sprite.spriteFrame;
  node.destroy();assert.equal(node.isValid,true);assert.equal(node.pending,true);assert.equal(sprite.isValid,true);assert.equal(sprite.spriteFrame,frame);
  // Strict checks still reject newly attached content on the retired node.
  const nodes=node.components.length;f.icons.attach(node,'stamina');assert.equal(node.components.length,nodes);assert.equal(sprite.spriteFrame,frame);
  f.icons.destroy();assert.equal(sprite.spriteFrame,null);assert.equal(sprite.enabled,false);assert.equal(node.listenerCount('destroyed'),0);
  assert.equal(frame.destroyCount,1);assert.equal(image.refs,0);node.flushDestroy();f.icons.destroy();
});

test('单独pending的Sprite仍须在共享帧释放前解除引用',()=>{
  const pending=fixture(),node=new pending.Node();pending.icons.attach(node,'stamina');const image=pending.resolve(),sprite=node.getComponent(pending.Sprite);sprite.pending=true;
  pending.icons.destroy();assert.equal(sprite.spriteFrame,null);assert.equal(sprite.enabled,false);assert.equal(image.refs,0);
});

test('NODE_DESTROYED事件中仍活着的组件先清理，后续监听销毁owner也安全',()=>{
  const event=fixture(),other=new event.Node();event.icons.attach(other,'growth-history');const source=event.resolve(),otherSprite=other.getComponent(event.Sprite);
  // Our binding listener fires first. A subsequent listener destroys the owner
  // before Cocos has destroyed the event sender's components.
  other.once('destroyed',()=>{assert.equal(other.isValid,true);assert.equal(otherSprite.isValid,true);event.icons.destroy();});
  other.destroy();other.flushDestroy();assert.equal(otherSprite.spriteFrame,null);assert.equal(source.refs,0);event.icons.destroy();
});

test('图集绑定中失败时，已经赋帧但刚进入pending的Sprite先清理再回滚资源',()=>{
  const f=fixture(),first=new f.Node(),second=new f.Node();f.icons.attach(first,'gold');f.icons.attach(second,'stamina');
  const firstSprite=first.getComponent(f.Sprite),secondSprite=second.getComponent(f.Sprite);
  // A later binding failure can happen after an earlier renderer has accepted
  // its frame. Retiring that earlier node must not bypass failure rollback.
  Object.defineProperty(secondSprite,'spriteFrame',{get(){return null;},set(frame){if(frame){first.destroy();firstSprite.pending=true;throw new Error('controlled Sprite binding failure');}}});
  const image=f.resolve();assert.equal(f.icons.state,'failed');assert.match(f.icons.error,/binding failure/);
  assert.equal(firstSprite.spriteFrame,null);assert.equal(firstSprite.enabled,false);assert.ok(f.frames.every(frame=>frame.destroyCount===1));assert.equal(image.refs,0);f.icons.destroy();
});
