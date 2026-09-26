const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const poses={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/BattlePoseData.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:poses,exports:poses.exports});
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/ArtV2Assets.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(){
  const loads=[],images=[],textures=[],frames=[],sprites=[];
  class Node extends EventEmitter{static EventType={NODE_DESTROYED:'destroyed'};constructor(){super();this.isValid=true;this.components=[];this.children=[];}setParent(n){n.children.push(this);}setScale(...scale){this.scale=scale;}addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}getComponent(Type){return this.components.find(c=>c instanceof Type);}}
  class UITransform{setContentSize(width,height){Object.assign(this,{width,height});}}
  class Sprite{static SizeMode={CUSTOM:1};static Type={SIMPLE:0,SLICED:1};constructor(){sprites.push(this);}set spriteFrame(value){this.frame=value;if(value&&this.sizeMode!==1)this.node.getComponent(UITransform).setContentSize(value.originalSize.width,value.originalSize.height);}get spriteFrame(){return this.frame;}}
  class ImageAsset{constructor(w=1536,h=1024){Object.assign(this,{width:w,height:h,refs:0});images.push(this);}addRef(){this.refs++;}decRef(){assert.ok(this.refs>0);this.refs--;}}
  class Texture2D{static Filter={LINEAR:1,NONE:0};static WrapMode={CLAMP_TO_EDGE:1};constructor(){textures.push(this);}setFilters(){}setMipFilter(){}setWrapMode(){}destroy(){assert.ok(!this.destroyed);this.destroyed=true;}}
  class SpriteFrame{constructor(){frames.push(this);}destroy(){assert.ok(!this.destroyed);assert.ok(sprites.every(s=>s.frame!==this));this.destroyed=true;}}
  class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}class Size{constructor(width,height){Object.assign(this,{width,height});}}
  class EffectAsset{refs=0;addRef(){this.refs++;}decRef(){assert.ok(this.refs>0);this.refs--;}};class Material{initialize(){}destroy(){this.destroyed=true;}}
  const cc={EffectAsset,Material,Node,UITransform,Sprite,ImageAsset,Texture2D,SpriteFrame,Rect,Size,Color:{WHITE:{}},isValid:(n,strict)=>!!n&&n.isValid!==false&&(!strict||!n.pending&&!n.node?.pending),resources:{load(name,Type,callback){loads.push({name,Type,callback});}}};
  const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='cc'?cc:id.endsWith('/bossCatalog')?require('../.test-build/core/bossCatalog'):poses.exports});const owner=new module.exports.ArtV2Assets();
  function resolve(index,error=null){const load=loads[index];if(load.Type===EffectAsset){const effect=new EffectAsset();load.callback(error,effect);return effect;}const file=path.join(__dirname,'../assets/resources',load.name+'.png');const png=fs.readFileSync(file);const image=new ImageAsset(png.readUInt32BE(16),png.readUInt32BE(20));load.callback(error,image);return image;}
  function ready(start=0){const end=loads.length;for(let i=start;i<end;i++)resolve(i);assert.equal(owner.ready,true);}
  return {owner,loads,images,textures,frames,sprites,Node,UITransform,resolve,ready};
}
test('V2 image assignment retains button dimensions and atlas regions fit the real files',()=>{
  const f=fixture();f.owner.preload();f.ready();
  const parent=new f.Node(),button=f.owner.attach(parent,'gold',430,96),portrait=f.owner.attach(parent,'portrait-crystal',76,76),skill=f.owner.attach(parent,'skill-stone',72,72);
  assert.equal(button.node.getComponent(f.UITransform).width*button.node.scale[0],430);assert.equal(button.node.getComponent(f.UITransform).height*button.node.scale[1],96);
  assert.equal(portrait.node.getComponent(f.UITransform).width,76);assert.equal(skill.node.getComponent(f.UITransform).height,72);
  for(const frame of f.frames){const r=frame.rect,image=frame.texture.image;assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=image.width&&r.y+r.height<=image.height);}
  f.owner.destroy();assert.ok(f.images.every(x=>x.refs===0));assert.ok(f.sprites.every(s=>s.frame===null));
});
test('V2 retry ignores old callbacks, balances references and never attaches a partial batch',()=>{
  const f=fixture();f.owner.preload();f.resolve(0);f.resolve(1);f.resolve(2,new Error('network failure'));assert.equal(f.owner.state,'failed');assert.equal(f.owner.attach(new f.Node(),'gold',100,60),undefined);
  const offset=f.loads.length;f.owner.retry();assert.equal(f.images[0].refs,0);const stale=f.resolve(3);assert.equal(stale.refs,0);f.ready(offset);f.owner.destroy();assert.ok(f.images.every(x=>x.refs===0));
});
test('V2 pending UI destruction detaches shared frames before texture release',()=>{
  const f=fixture();f.owner.preload();f.ready();const parent=new f.Node(),sprite=f.owner.attach(parent,'paper',360,220);sprite.node.pending=true;f.owner.destroy();assert.equal(sprite.spriteFrame,null);f.owner.destroy();
});
test('V2 character portraits and icon atlases retain native PNG alpha channels',()=>{
  for(const name of ['hero-stone','hero-spike','hero-crystal','hero-leaf','hero-bubble','skill-icons','shop-icons','fusion-bubble','ui-skins']){const png=fs.readFileSync(path.join(__dirname,'../assets/resources/art-v2',name+'.png'));assert.equal(png[25],6,name+' must stay RGBA');}
});

test('Chapter map and transparent ship preload from modern assets and release their references',()=>{
  const f=fixture();f.owner.preload();
  for(const name of ['art-modern/chapter-map','art-modern/chapter-boat']){
    const index=f.loads.findIndex(load=>load.name===name);assert.ok(index>=0,name);f.resolve(index);
  }
  assert.equal(f.images.length,2);assert.ok(f.images.every(image=>image.refs===1));
  f.owner.destroy();assert.ok(f.images.every(image=>image.refs===0));
});
