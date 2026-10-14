const assert=require('node:assert/strict'),path=require('node:path');
const {mock}=require('node:test');mock.timers.enable({apis:['setTimeout']});
const requests=[],assets=new Map();
class Asset{isValid=true;refCount=0;addRef(){this.refCount++;}decRef(){this.refCount--;}destroy(){this.isValid=false;}}
class ImageAsset extends Asset{width=2048;height=2048;}
class Texture2D extends Asset{static Filter={LINEAR:1,NONE:0};static WrapMode={CLAMP_TO_EDGE:0};setFilters(){}setMipFilter(){}setWrapMode(){}}
class SpriteFrame extends Asset{}
class Material extends Asset{initialize(){}copy(){}}
class EffectAsset extends Asset{}
class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
class Size{constructor(width,height){Object.assign(this,{width,height});}}
class UITransform{setContentSize(w,h){this.width=w;this.height=h;}}
class Sprite extends Asset{static SizeMode={CUSTOM:1};static Type={SLICED:1,SIMPLE:0};}
class Node extends Asset{static EventType={NODE_DESTROYED:'destroy'};components=new Map();events=new Map();setParent(p){this.parent=p;}setScale(){}addComponent(C){const c=new C();c.node=this;this.components.set(C,c);return c;}getComponent(C){return this.components.get(C);}once(e,f){this.events.set(e,f);}destroy(){this.isValid=false;this.events.get('destroy')?.();}}
const cc={cclegacy:{_RF:{push(){},pop(){}}},ImageAsset,Texture2D,SpriteFrame,Material,EffectAsset,Rect,Size,UITransform,Sprite,Node,Color:{WHITE:{}},isValid:x=>!!x&&x.isValid!==false,resources:{load(path,C,callback){requests.push({path,C,callback});}}};
const L=require('./test-built-core.cjs').loadBuiltCore(path.resolve(process.argv[2]),{cc}),{ArtV2Assets}=L.load('ArtV2Assets');
async function drain(fail){while(requests.length){const r=requests.shift();if(fail?.(r)){r.callback(new Error('offline'));continue;}const key=r.path;let a=assets.get(key);if(!a||!a.isValid){a=new r.C();assets.set(key,a);}r.callback(null,a);}await new Promise(setImmediate);}
(async()=>{
 const art=new ArtV2Assets();art.preload();const startup=requests.filter(r=>r.C===ImageAsset).map(r=>r.path);
 assert.ok(startup.length<100);assert.ok(startup.every(p=>!p.includes('map-coast-stage-')&&!p.includes('map-mode-scene-')&&!p.includes('enemy-g1/icons/')));
 assert.ok(startup.every(p=>!p.includes('boss-roster')&&!p.includes('hero-advanced')&&!p.includes('sea-chart-background')),'Unused large portraits and secondary-page art stay lazy');
 await drain();assert.equal(art.ready,true);assert.ok(art.battleFrame('portrait-stone'));assert.ok(art.battleFrame('skill-leaf'));
 for(const role of ['stone','spike','crystal','leaf','bubble'])for(const key of ['hero-'+role,'signature-'+role+'-0'])assert.ok(art.battleFrame(key),'Home animation frame must be ready: '+key);
 const a=art.ensure(['map-coast-stage-1']),b=art.ensure(['map-coast-stage-1']);assert.equal(requests.length,1);await drain();await Promise.all([a,b]);assert.ok(art.battleFrame('map-coast-stage-1'));
 const parent=new Node(),sprite=art.attach(parent,'enemy-g1-m01',80,80);assert.ok(sprite);assert.equal(sprite.spriteFrame,null);assert.equal(requests.length,1);await drain();assert.ok(sprite.spriteFrame);
 art.retainBattleScene('map-coast-stage-1');
 const failure=art.ensure(['map-coast-stage-2']).then(()=>assert.fail('should reject'),()=>{});await drain(r=>r.path.endsWith('map-coast-stage-2'));await failure;assert.equal(art.ready,true,'Optional art failure must not destroy existing UI');
 const retry=art.ensure(['map-coast-stage-2']);await drain();await retry;assert.ok(art.battleFrame('map-coast-stage-2'));
 art.retainBattleScene('map-coast-stage-2');const third=art.ensure(['map-coast-stage-3']);await drain();await third;art.retainBattleScene('map-coast-stage-3');assert.equal(art.battleFrame('map-coast-stage-1'),undefined);assert.ok(art.battleFrame('map-coast-stage-2'));assert.ok(art.battleFrame('map-coast-stage-3'));
 const hung=art.ensure(['map-coast-stage-4']).then(()=>assert.fail('stalled image accepted'),e=>assert.match(e.message,/超时/));mock.timers.tick(90001);await hung;await drain();assert.equal(art.battleFrame('map-coast-stage-4'),undefined,'Timed-out callbacks must not adopt resources');
 const recovered=art.ensure(['map-coast-stage-4']);assert.equal(requests.length,1);await drain();await recovered;assert.ok(art.battleFrame('map-coast-stage-4'));
 const late=art.ensure(['map-mode-scene-56']).then(()=>assert.fail('retired request adopted'),()=>{});art.destroy();await drain();await late;assert.equal(art.state,'destroyed');assert.equal(art.battleFrame('map-mode-scene-56'),undefined);
 const failed=new ArtV2Assets();failed.preload();await drain(r=>r.path.endsWith('ui-skins'));assert.equal(failed.state,'failed');failed.retry();await drain();assert.equal(failed.ready,true);failed.destroy();
 mock.timers.reset();console.log('PASS',startup.length,'startup image keys; lazy maps/icons, deduplication, two-map retention, failed/stalled-load retry, destroyed request retirement, preserved UI/skill slices.');
})().catch(e=>{console.error(e);process.exitCode=1;});
