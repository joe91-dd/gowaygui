const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript');
// Minimal math/track adapter: tests emitted curve values, not a second animation implementation.
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}length(){return Math.hypot(this.x,this.y,this.z);}static add(o,a,b){Object.assign(o,{x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});return o;}static subtract(o,a,b){return this.add(o,a,new Vec3(-b.x,-b.y,-b.z));}static multiplyScalar(o,a,s){Object.assign(o,{x:a.x*s,y:a.y*s,z:a.z*s});return o;}static scaleAndAdd(o,a,b,s){return this.add(o,a,new Vec3(b.x*s,b.y*s,b.z*s));}}
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}static dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;}static normalize(o,a){const n=Math.hypot(a.x,a.y,a.z,a.w);Object.assign(o,{x:a.x/n,y:a.y/n,z:a.z/n,w:a.w/n});return o;}static slerp(o,a,b,t){let d=this.dot(a,b),sgn=d<0?-1:1;d=Math.min(1,Math.abs(d));const angle=Math.acos(d),sin=Math.sin(angle),u=sin>.00001?Math.sin((1-t)*angle)/sin:1-t,v=(sin>.00001?Math.sin(t*angle)/sin:t)*sgn;Object.assign(o,{x:a.x*u+b.x*v,y:a.y*u+b.y*v,z:a.z*u+b.z*v,w:a.w*u+b.w*v});return o;}}
class TrackPath{toHierarchy(path){this.node=path;return this;}toProperty(property){this.property=property;return this;}}
class Track{constructor(n){this.c=Array.from({length:n},()=>({curve:{assignSorted(v){this.keys=Array.from(v);}}}));}channels(){return this.c;}}
class VectorTrack extends Track{constructor(){super(4);}}
class QuatTrack extends Track{constructor(){super(1);}*channels(){yield this.c[0];}}
class AnimationClip{static WrapMode={Loop:2};constructor(){this.tracks=[];this.sample=30;this.duration=1;}addTrack(t){this.tracks.push(t);}get hash(){return this._hash??123;}destroy(){this.destroyed=true;}}
const cc={animation:{VectorTrack,QuatTrack,TrackPath},AnimationClip,Quat,Vec3};
const moduleOut={exports:{}};
const file=path.resolve(__dirname,'../assets/scripts/view/EnemyLocomotion.ts');
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:moduleOut.exports,require:name=>{assert.equal(name,'cc');return cc;},console});
const {readableEnemyWalk,prepareEnemyLocomotion,enemyWalkRate}=moduleOut.exports;
function curve(values){return{times:[0,.25,.5,.75,1],values:{get(i,out){Object.assign(out,values[i]);}}};}
const rotations=[0,.12,0,-.12,0].map(a=>new Quat(Math.sin(a/2),0,0,Math.cos(a/2)));
const positions=[0,.02,0,-.02,0].map(y=>new Vec3(1,y,0));
const source=new AnimationClip();source.name='walk';source._hash=8675309;source._exoticAnimation={_nodeAnimations:[{_path:'Rig/root/body',_rotation:curve(rotations)},{_path:'Rig/root/body/leg0.L.0',_rotation:curve(rotations),_position:curve(positions)},{_path:'Rig/root/body/leg0.R.0',_rotation:curve(rotations.map(q=>new Quat(-q.x,0,0,q.w)))}]};
const original=JSON.stringify(rotations),walk=readableEnemyWalk(source);
assert.notEqual(walk,source);assert.equal(readableEnemyWalk(source),walk);assert.equal(JSON.stringify(rotations),original,'source curves must remain immutable');
const track=(name,property)=>walk.tracks.find(t=>t.path.node===name&&t.path.property===property);
const left=track('Rig/root/body/leg0.L.0','rotation').c[0].curve.keys.map(k=>k[1].value),right=track('Rig/root/body/leg0.R.0','rotation').c[0].curve.keys.map(k=>k[1].value);
assert.ok(2*Math.acos(left[1].w)>.30,'a visible stride must replace tiny original swings');
assert.ok(left[1].x*right[1].x<0,'opposite feet keep opposite phases');
for(const q of left)assert.ok(Math.abs(Quat.dot(q,q)-1)<1e-7,'unit quaternions');
assert.deepEqual(left[0],left.at(-1),'seamless looping');
assert.deepEqual(track('Rig/root/body','rotation').c[0].curve.keys.map(k=>k[1].value),rotations,'no body wobble amplification');
const source2=Object.assign(new AnimationClip(),source,{_hash:34677}),walk2=readableEnemyWalk(source2);assert.notEqual(walk.hash,walk2.hash,'species must never share a baked pose key');assert.notEqual(walk.hash,source.hash);
const rig={clips:[source],defaultClip:source};prepareEnemyLocomotion([rig]);assert.equal(rig.clips.length,1);assert.equal(rig.defaultClip,walk);assert.equal(rig.clips[0],walk);
assert.ok(enemyWalkRate(.25,1)<enemyWalkRate(1,1));assert.ok(enemyWalkRate(.5,2)<enemyWalkRate(.5,1));assert.ok(Number.isFinite(enemyWalkRate(0,0)));
console.log('PASS immutable source clips, alternating planted gait, normalized/looping rotations, unchanged torso, separate species bake keys, shared clip cache, slow/big cadence');
