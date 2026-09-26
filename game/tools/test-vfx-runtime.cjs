// Exercises allocation, delayed explosions and cleanup; visual quality is checked in Cocos.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}static lerp(o,a,b,t){for(const k of ['x','y','z'])o[k]=a[k]+(b[k]-a[k])*t;return o;}static subtract(o,a,b){for(const k of ['x','y','z'])o[k]=a[k]-b[k];return o;}}
class Vec4{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}}
class Material{props={};initialize(){}copy(){}setProperty(k,v){this.props[k]=v;}destroy(){}}
class Node{children=[];isValid=true;active=true;worldRotation={};worldScale=new Vec3(1,1,1);constructor(name){this.name=name;}setParent(p){this.parent=p;p?.children.push(this);}addComponent(){return {setSharedMaterial(){}};}setPosition(...p){this.position=p;}setScale(...s){assert.ok(s.every(Number.isFinite));}setRotation(){}setRotationFromEuler(){}setWorldRotation(){}destroy(){this.isValid=false;}}
class SculptedEnergy{arc(p){const n=new Node('ribbon');n.setParent(p);return n;}animate(){}release(n){n.active=false;}destroy(){}}
const cc={Vec3,Vec4,Node,Material,gfx:{BlendFactor:{SRC_ALPHA:1,ONE_MINUS_SRC_ALPHA:2,ONE:3}},Color:class{constructor(hex){this.hex=hex;}},Quat:class{static rotationTo(){return{};}},utils:{createMesh(){return{destroy(){}};}},primitives:{cone(){},sphere(){},box(){}}};
const filename=path.resolve(__dirname,'../assets/scripts/view/G1BattleEffects.ts');
const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function run(compact){
 let exports={};
 if(process.argv[2]){
  const {loadBuiltCore}=require('./test-built-core.cjs');
  exports=loadBuiltCore(path.resolve(process.argv[2]),{'cc':{...cc,cclegacy:{_RF:{push(){},pop(){}}}},'chunks:///_virtual/SculptedEnergy.ts':{SculptedEnergy},'chunks:///_virtual/RenderBudget.ts':{softwareRendering:()=>compact},'chunks:///_virtual/enemyG1Catalog.ts':{enemyG1:()=>undefined}}).load('G1BattleEffects');
 }else vm.runInNewContext(js,{exports,require:id=>id==='cc'?cc:id.includes('SculptedEnergy')?{SculptedEnergy}:id.includes('RenderBudget')?{softwareRendering:()=>compact}:{enemyG1:()=>undefined}});
 const fx=new exports.G1BattleEffects(new Node('root'),{node:new Node('camera')},{},{},new Map(),new Material());
 const at=new Vec3(0,.6,0),from=new Vec3(-2,.8,0);
 fx.bossCast('fireRain',at,from);
 assert.ok(fx.motes.some(m=>m.age<0),'fire impacts must be scheduled after flight');
 fx.update(.2);
 assert.ok(fx.motes.some(m=>m.node.active&&m.material.props.motion.z<0),'filled sprite atlas must reach the material');
 fx.clearTransient();assert.equal(fx.motes.length,0);
 for(let i=0;i<100;i++){fx.cast('frost',at,1.4,3);fx.status('shield',at);fx.bossCast('fireRain',at,from);fx.update(.016);assert.ok(fx.motes.length<=(compact?30:64));assert.ok(fx.fragments.length<=(compact?20:48));}
 fx.clearTransient();fx.piercing(from,at);fx.update(.15);
 assert.ok(fx.motes.some(m=>m.node.active&&m.node.position[0].x>from.x&&m.node.position[0].x<at.x),'piercing arrow must travel between caster and target');
 for(let i=0;i<400;i++)fx.update(.02);
 assert.equal(fx.motes.length+fx.fragments.length+fx.trails.length+fx.warnings.length,0,'all temporary effects must expire');
 fx.destroy();return {compact,passed:true};
}
console.log(JSON.stringify({scope:'VFX runtime lifecycle and allocation; not visual approval',checks:[run(false),run(true)]},null,2));
