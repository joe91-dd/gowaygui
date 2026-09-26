const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/FaunaRadiance.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;

test('locally adapted materials without UUIDs keep body and glow independent',async()=>{
 class Texture2D{constructor(){this.refs=1;}addRef(){this.refs++;}decRef(){this.refs--;assert.ok(this.refs>=1);}}
 class Material{
  constructor(name=''){this.name=name;this.uuid='';this.effectName='builtin-standard';this.isValid=true;this.props={};}
  copy(source){this.props={...source.props};}getProperty(key){return this.props[key];}setProperty(key,value){assert.ok(this.isValid);this.props[key]=value;}destroy(){this.isValid=false;}
 }
 class Color{constructor(value){this.value=value;}}
 class Vec3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 class MeshRenderer{constructor(materials){this.sharedMaterials=materials;this.isValid=true;}setSharedMaterial(m,i){this.sharedMaterials[i]=m;}}
 class Node{static EventType={NODE_DESTROYED:'destroy'};constructor(renderer){this.renderer=renderer;}getComponentsInChildren(){return[this.renderer];}once(){}}
 const atlas=new Texture2D(),sourceTexture=new Texture2D();let loads=0;
 const cc={Material,Color,Vec3,MeshRenderer,Node,Texture2D,resources:{load(_path,_type,callback){loads++;queueMicrotask(()=>callback(null,atlas));}}};
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:()=>cc,console});
 const body=new Material('G1_b01_Atlas_NativeStandard'),glow=new Material('G1_b01_Glow_Atlas_NativeStandard');
 body.props.mainTexture=glow.props.mainTexture=sourceTexture;
 const renderer=new MeshRenderer([body,glow]),root=new Node(renderer),radiance=new module.exports.FaunaRadiance();
 radiance.apply(root,0,'#4DACEB',true,'g1-b01');radiance.update(.2);
 const [bodyGrade,glowGrade]=renderer.sharedMaterials;assert.notEqual(bodyGrade,glowGrade);
 assert.equal(bodyGrade.props.emissiveScale.x,0);assert.ok(glowGrade.props.emissiveScale.x>0);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(loads,1);assert.equal(bodyGrade.props.mainTexture,atlas);assert.equal(glowGrade.props.mainTexture,atlas);
 radiance.destroy();assert.equal(atlas.refs,1);assert.equal(sourceTexture.refs,1);
});
