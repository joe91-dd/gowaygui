import {Color,isValid,EffectAsset,Material,Mesh,MeshRenderer,Node,utils,Vec4} from 'cc';
import {cloneEffectData,requireEffectPasses} from './EffectDataClone';

/** Depth-tested swept ribbons. No opaque spiral cages or full-screen overlays. */
export class SculptedEnergy {
 private meshes=new Map<string,Mesh>();private live=new Map<Node,Material>();private pool:Node[]=[];
 private warningEffect?:EffectAsset;
 constructor(private effect:EffectAsset){}
 private flatWarningEffect():EffectAsset {
  if(this.warningEffect)return this.warningEffect;
  const effect=new EffectAsset('approved-danger-disc'),techniques=cloneEffectData(this.effect.techniques),shaders=cloneEffectData(this.effect.shaders),combinations=cloneEffectData(this.effect.combinations);
  requireEffectPasses(techniques,'approved-danger-disc');
  for(const shader of shaders){const old=shader.name;shader.name+='-danger-v1';shader.hash=(shader.hash^0x61f02704)>>>0;for(const t of techniques)for(const p of t.passes)if(p.program===old)p.program=shader.name;
   for(const key of ['glsl1','glsl3','glsl4'] as const){const code=(shader as any)[key];if(!code?.frag)continue;
    code.frag=code.frag.replace(/float across\s*=[^;]+;/,'float across=1.0;').replace(/float ends\s*=[^;]+;/,'float ends=1.0;').replace(/float flow\s*=[^;]+;/,'float flow=1.0;').replace(/float thread\s*=[^;]+;/,'float thread=0.0;');
   }
  }effect.techniques=techniques;effect.shaders=shaders;effect.combinations=combinations;effect.onLoaded();this.warningEffect=effect;return effect;
 }
 arc(parent:Node,color:string,kind:'wind'|'frost'|'ground'|'weapon'|'warning'|'disc'|'link'='wind'):Node{
  let mesh=this.meshes.get(kind);
  if(!mesh){const p:number[]=[],uv:number[]=[],indices:number[]=[],normals:number[]=[],count=48;
   const sweep=kind==='warning'||kind==='disc'?Math.PI*2:kind==='ground'?Math.PI*1.72:kind==='weapon'?Math.PI*1.55:Math.PI*1.13;
   for(let i=0;i<=count;i++){const t=i/count,a=t*sweep,base=kind==='weapon'?.20:1;
    const flat=kind==='ground'||kind==='warning'||kind==='disc';
    const height=flat?0:Math.sin(t*Math.PI)*.09;
    const width=kind==='warning'?.018:(kind==='ground'?.075:kind==='frost'?.12:kind==='weapon'?.045:.13)*Math.pow(Math.sin(t*Math.PI),.75);
    for(const side of [-1,1]){const r=kind==='disc'?(side===-1?0:1):base+side*width;if(kind==='link')p.push(t,.35*Math.sin(t*Math.PI)+side*.035,0);else p.push(Math.cos(a)*r,height+side*(flat?0:width*.35),Math.sin(a)*r);uv.push(t,(side+1)/2);normals.push(0,1,0);}
    if(i){const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1);}
   }mesh=utils.createMesh({positions:p,indices,normals,uvs:uv});this.meshes.set(kind,mesh);
  }
  const reused=this.pool.find(n=>n.isValid&&n.name==='energy-'+kind);
  if(reused){this.pool.splice(this.pool.indexOf(reused),1);reused.setParent(parent);reused.active=true;reused.setPosition(0,0,0);reused.setRotationFromEuler(0,0,0);reused.setScale(1,1,1);const m=this.live.get(reused)!;m.setProperty('tint',new Color(color));m.setProperty('motion',new Vec4(0,0,0,0));return reused;}
  const n=new Node('energy-'+kind);n.layer=parent.layer;n.setParent(parent);const r=n.addComponent(MeshRenderer);r.mesh=mesh;
  const m=new Material();m.initialize({effectAsset:kind==='warning'||kind==='disc'?this.flatWarningEffect():this.effect,states:{priority:205}});if(!m.passes.length){m.destroy();n.destroy();throw new Error('预警特效材质未生成渲染通道');}m.setProperty('tint',new Color(color));m.setProperty('motion',new Vec4(0,0,0,0));r.setSharedMaterial(m,0);this.live.set(n,m);return n;
 }
 animate(n:Node,age:number,opacity:number):void{this.live.get(n)?.setProperty('motion',new Vec4(age,opacity,0,0));}
 release(n:Node):void{if(isValid(n,true)&&this.pool.length<64&&!this.pool.includes(n)){n.active=false;n.setParent(null);this.pool.push(n);return;}const m=this.live.get(n);if(m){m.destroy();this.live.delete(n);}if(isValid(n,true))n.destroy();}
 destroy():void{for(const [n,m]of this.live){m.destroy();if(isValid(n,true))n.destroy();}this.live.clear();this.pool=[];for(const m of this.meshes.values())m.destroy();this.meshes.clear();this.warningEffect?.destroy();}
}
