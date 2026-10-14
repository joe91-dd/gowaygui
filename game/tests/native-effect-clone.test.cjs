const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
class Asset{}
class EffectAsset extends Asset{constructor(name){super();this.name=name;this.isValid=true;}onLoaded(){this.loaded=true;}}
const cc={Asset,EffectAsset,cclegacy:{_RF:{push(){},pop(){}}}};
const builtModules=new Map();
if(process.env.GOWAYGUI_EFFECT_BUILD){
 vm.runInNewContext(fs.readFileSync(path.join(process.env.GOWAYGUI_EFFECT_BUILD,'assets/main/index.js'),'utf8'),{System:{register:(name,deps,declare)=>builtModules.set(name,{deps,declare})}});
}
function load(name,deps={}){
 if(builtModules.size){
  const record=builtModules.get('chunks:///_virtual/'+name+'.ts'),exports={};assert.ok(record,'Missing packaged module '+name);
  const body=record.declare((name,value)=>{if(typeof name==='object')Object.assign(exports,name);else exports[name]=value;return value;});
  record.deps.forEach((dependency,i)=>{const key=Object.keys(deps).find(k=>k===dependency||k.startsWith('.')&&path.basename(k)+'.ts'===path.basename(dependency));body.setters[i](dependency==='cc'?cc:key?deps[key]:{});});
  body.execute();return exports;
 }
 const module={exports:{}};const file=path.join(__dirname,'../assets/scripts/view',name+'.ts');
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='cc'?cc:deps[id]??{}});return module.exports;}
const clone=load('EffectDataClone');
// Native jsb_assets_auto.cpp exposes ITechniqueInfo / IPassInfoFull / IShaderInfo
// fields via prototype accessors. JSON.stringify sees no own data fields.
function nativeStruct(fields){const proto={};for(const key of Object.keys(fields))Object.defineProperty(proto,key,{get:()=>fields[key]});return Object.create(proto);}
function source(){const pass=nativeStruct({program:'battle',properties:{mainColor:{value:[1,1,1,1]}},depthStencilState:nativeStruct({depthWrite:true,depthTest:true})});
 const shader=nativeStruct({name:'battle',hash:123,defines:[],glsl3:nativeStruct({vert:'vertex',frag:'void main(){float across=0.1;float ends=0.2;float flow=0.3;float thread=0.4;c *= mainColor;}'})});
 const effect=new EffectAsset('source');effect.techniques=[nativeStruct({passes:[pass]})];effect.shaders=[shader];effect.combinations=[{FOO:[true,false]}];return effect;}
test('Reproduces the native JSON-clone data loss and preserves all pass/shader fields with accessor-aware copying',()=>{
 const effect=source();assert.equal(JSON.stringify(effect.techniques),'[{}]');
 const copied=clone.cloneEffectData(effect.techniques);assert.equal(copied[0].passes[0].program,'battle');assert.equal(copied[0].passes[0].depthStencilState.depthWrite,true);
 copied[0].passes[0].properties.mainColor.value[0]=0;assert.equal(effect.techniques[0].passes[0].properties.mainColor.value[0],1);
 assert.throws(()=>clone.requireEffectPasses(JSON.parse(JSON.stringify(effect.techniques)),'terrain'),/渲染通道为空/);
});
test('Illustrated terrain retains native passes, modifies shader text and leaves its source untouched',()=>{
 const effect=source(),{illustratedBattleEffect}=load('BattleArtDirection',{'./EffectDataClone':clone}),copy=illustratedBattleEffect(effect);
 assert.equal(copy.techniques[0].passes[0].program,'battle-illustration-v1');assert.equal(copy.shaders[0].name,'battle-illustration-v1');
 assert.match(copy.shaders[0].glsl3.frag,/Reduce microtexture/);assert.equal(effect.shaders[0].name,'battle');assert.doesNotMatch(effect.shaders[0].glsl3.frag,/Reduce microtexture/);
 assert.equal(copy.loaded,true);assert.equal(illustratedBattleEffect(effect),copy);
});
test('Enemy warning/disc shader uses the same native-safe clone and preserves the original energy effect',()=>{
 const effect=source(),{SculptedEnergy}=load('SculptedEnergy',{'./EffectDataClone':clone}),energy=new SculptedEnergy(effect),copy=energy.flatWarningEffect();
 assert.equal(copy.techniques[0].passes[0].program,'battle-danger-v1');assert.match(copy.shaders[0].glsl3.frag,/float across=1.0;/);
 assert.match(copy.shaders[0].glsl3.frag,/float thread=0.0;/);assert.match(effect.shaders[0].glsl3.frag,/float across=0.1;/);assert.equal(copy.loaded,true);
});
test('Texture defaults retain their Asset identity instead of cloning a native object',()=>{
 const texture=new Asset(),copy=clone.cloneEffectData({mainTexture:{value:texture}});assert.equal(copy.mainTexture.value,texture);
});
