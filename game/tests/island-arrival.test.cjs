const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/IslandArrival.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;

function fixture(){
  const loads=[],owned=[];
  class Node{
    constructor(){this.children=[];this.components=[];this.active=true;this.isValid=true;}
    addComponent(Type){const component=new Type();this.components.push(component);return component;}
    getComponent(Type){return this.components.find(component=>component instanceof Type);}
    setPosition(...position){this.position=position;}
    setSiblingIndex(){}
    removeFromParent(){this.parent.children=this.parent.children.filter(child=>child!==this);}
    destroy(){this.isValid=false;this.children.forEach(child=>child.destroy());}
  }
  class Graphics{rect(){}roundRect(){}circle(){}fill(){}stroke(){}clear(){}}
  class UITransform{setContentSize(width,height){this.size=[width,height];}}
  class Resource{constructor(){owned.push(this);this.destroyed=0;}destroy(){this.destroyed++;}setWrapMode(){}setFilters(){}static WrapMode={CLAMP_TO_EDGE:1};static Filter={LINEAR:1};}
  class Material extends Resource{initialize(options){this.options=options;}setProperty(name,value){(this.properties??={})[name]=value;}}
  class EffectAsset{}
  class Sprite{static SizeMode={CUSTOM:1};}
  class IslandUI{
    constructor(root){this.root=root;}
    group(name,x=0,y=0,parent=this.root){const node=new Node();node.name=name;node.parent=parent;parent.children.push(node);node.addComponent(UITransform);node.setPosition(x,y);return node;}
    panel(x,y,width,height,parent=this.root){return this.group("panel",x,y,parent);}
    text(string){return{string};}
    button(text,x,y,w,h,callback,{parent}){const node=this.group(text,x,y,parent);node.callback=callback;return node;}
  }
  const cc={Node,Graphics,UITransform,Sprite,Material,EffectAsset,Vec4:class{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}},Color:class{},ImageAsset:class{},UIOpacity:class{},BlockInputEvents:class{},Texture2D:Resource,SpriteFrame:Resource,isValid:node=>!!node?.isValid,resources:{load(path,Type,callback){loads.push({path,Type,callback});}}};
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='cc'?cc:{IslandUI,color:()=>({})}});
  const canvas=new Node(),content=new Node();content.parent=canvas;canvas.children.push(content);
  const overlay=new module.exports.IslandArrival(new IslandUI(content));
  const image={refs:0,addRef(){this.refs++;},decRef(){this.refs--;}};
  const effect={refs:0,addRef(){this.refs++;},decRef(){this.refs--;}};
  return{overlay,loads,owned,image,effect,resolve(){loads.forEach(load=>load.callback(null,load.Type===EffectAsset?effect:image));}};
}

test('启动和战场加载复用原画与同一动画时间，失败重试不重建背景',()=>{
  const f=fixture(),overlay=f.overlay,root=overlay.root;f.resolve();
  assert.deepEqual(f.loads.map(load=>load.path),['art-modern/sailing-honor','art-v2/game-logo','art-modern/sailing-mist','art-modern/sailing-arrival']);
  assert.equal(overlay.sceneSprite.customMaterial,overlay.material);assert.equal(f.image.refs,3);assert.equal(f.effect.refs,1);
  overlay.show();overlay.update(.04,false);const phase=overlay.time;
  overlay.show();assert.equal(overlay.root,root);assert.equal(overlay.time,phase);assert.equal(f.loads.length,4);
  overlay.show(true,()=>{},()=>{});assert.equal(overlay.actions.children.length,2);
  overlay.show();assert.equal(overlay.actions.children.length,0);assert.equal(overlay.time,phase);
  overlay.destroy();assert.equal(f.image.refs,0);assert.equal(f.effect.refs,0);assert.ok(f.owned.every(resource=>resource.destroyed===1));
});

test('减少动态与隐藏状态停止动画，失败图片可重新请求',()=>{
  const f=fixture(),overlay=f.overlay;f.loads[0].callback(new Error('offline'));f.loads[1].callback(null,f.image);
  overlay.show();assert.equal(f.loads.length,5);assert.equal(f.loads[4].path,'art-modern/sailing-honor');
  overlay.update(.05,true);assert.equal(overlay.time,0);overlay.update(.05,false);assert.equal(overlay.time,.05);
  overlay.hide();overlay.update(.05,false);assert.equal(overlay.time,.05);overlay.destroy();
});

test('销毁后迟到图片不会创建纹理或持有资源',()=>{
  const f=fixture();f.overlay.destroy();f.resolve();
  assert.equal(f.image.refs,0);assert.equal(f.owned.length,0);f.overlay.destroy();
});

test('资源乱序完成只建立一个材质，减少动态冻结当前帧且字标不漂浮',()=>{
  const f=fixture(),overlay=f.overlay;
  f.loads[3].callback(null,f.effect);f.loads[2].callback(null,f.image);assert.equal(overlay.material,undefined);
  f.loads[0].callback(null,f.image);const material=overlay.material;
  f.loads[1].callback(null,f.image);assert.equal(overlay.material,material);
  const logoPosition=[...overlay.logo.position];overlay.update(.04,false);overlay.update(.05,true);
  assert.equal(material.properties.arrivalMotion.x,.04);assert.deepEqual(overlay.logo.position,logoPosition);
  overlay.hide();overlay.update(.05,false);assert.equal(material.properties.arrivalMotion.x,.04);
  overlay.show(false,undefined,()=>{});assert.equal(overlay.actions.children.length,1);
  overlay.destroy();assert.equal(f.effect.refs,0);
});

test('特效请求失败保留静态原画，下次展示重试且迟到特效不泄漏',()=>{
  const f=fixture();f.loads.slice(0,3).forEach(load=>load.callback(null,f.image));
  f.loads[3].callback(new Error('offline'));assert.ok(f.overlay.sceneSprite.spriteFrame);assert.equal(f.overlay.material,undefined);
  f.overlay.show();assert.equal(f.loads.length,5);f.overlay.destroy();f.loads[4].callback(null,f.effect);
  assert.equal(f.effect.refs,0);assert.equal(f.image.refs,0);
});

test('游戏使用当前确认原图，原生着色器保留船体、帆旗、海水和局部光效',()=>{
  const art=path.join(__dirname,'../assets/resources/art-modern');
  const hash=name=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(art,name))).digest('hex');
  assert.equal(hash('sailing-honor.png'),'78a8ec1bf0b58c75e0d0b26851a9038ad64bc4af8f1bc40763101adc0512f27e');
  assert.equal(hash('sailing-mist.png'),'5f70c1ac7c73c73b7be02b266c277827455560ac32f9a9d0d81981f64f53fddf');
  const shader=fs.readFileSync(path.join(art,'sailing-arrival.effect'),'utf8');
  for(const marker of ['float hull=','float sail=','float crew=','float boat=','float rock=','float flag=','float water=','float wave=','float gem=','texture(sceneTexture,clamp(p+shift'])assert.ok(shader.includes(marker),marker);
  assert.ok(!shader.includes('cc_time'),'动画时间由生命周期与减少动态设置控制');
});
