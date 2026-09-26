import {Color,EffectAsset,Material,Mesh,MeshRenderer,Node,resources,utils,Vec3,Vec4} from 'cc';
import {FAUNA_AURAS} from '../core/faunaAura';
/** One depth-tested mesh per enemy; five shared materials, no textures or per-particle nodes. */
export class FaunaAura {
 private effect?:EffectAsset;private disposed=false;private time=0;private last=0;
 private meshes=new Map<number,Mesh>();private materials:Material[]=[];
 private roots=new Map<Node,{node:Node;grade:number}>();
 constructor(){resources.load('models-approved/fauna-aura',EffectAsset,(e,a)=>{
  if(e||!a){console.warn('[FaunaAura] effect load failed',e);return;}if(this.disposed)return;this.effect=a;a.addRef();
  this.materials=FAUNA_AURAS.map(c=>{const m=new Material();m.initialize({effectAsset:a,states:{priority:205}});m.setProperty('tint',new Color(c.color));m.setProperty('crest',new Color(c.highlight));m.setProperty('motion',new Vec4(0,.68,0,0));return m;});
 });}
 apply(root:Node,height:number,grade:number,boss:boolean,alive:boolean):void{
  if(!this.effect||this.disposed||!root.isValid)return;
  let entry=this.roots.get(root);
  if(!entry){const node=new Node('海雾灵焰');node.layer=root.layer;node.setParent(root);
   const r=node.addComponent(MeshRenderer);r.mesh=this.mesh(boss?5:3);
   r.setSharedMaterial(this.materials[grade],0);node.setPosition(0,.025,0);
   // Clear the silhouette of round-bodied species as well as upright bipeds.
   node.setScale(Math.max(.60,height*.58),Math.max(.5,height*.64),Math.max(.60,height*.58));
   entry={node,grade};this.roots.set(root,entry);
  }
  entry.node.active=alive;
  if(entry.grade!==grade){entry.node.getComponent(MeshRenderer)!.setSharedMaterial(this.materials[grade],0);entry.grade=grade;}
 }
 private mesh(count:number):Mesh{
  const cached=this.meshes.get(count);if(cached)return cached;
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[],normals:number[]=[];
  for(let j=0;j<count;j++)for(let i=0;i<=18;i++){
   const t=i/18,a=j/count*Math.PI*2+t*1.7,r=.88+.28*Math.sin(t*Math.PI),h=t*(.86+(j%3)*.10),w=.19*Math.pow(Math.sin(t*Math.PI),.65);
   for(const side of [-1,1]){const rr=r+side*w;positions.push(Math.cos(a)*rr,h+side*w*.65,Math.sin(a)*rr);uvs.push(t,(side+1)/2);normals.push(0,1,0);}
   if(i){const k=(j*19+i)*2;indices.push(k-2,k,k-1,k-1,k,k+1);}
  }
  // Explicit bounds include the additional displacement performed by the shader.
  const m=utils.createMesh({positions,uvs,indices,normals,minPos:new Vec3(-1.45,-.15,-1.45),maxPos:new Vec3(1.45,1.35,1.45)});this.meshes.set(count,m);return m;
 }
 update(dt:number):void{
  this.time+=dt;if(this.time-this.last<.045)return;this.last=this.time;
  for(let i=0;i<this.materials.length;i++)this.materials[i].setProperty('motion',new Vec4(this.time,.68+(i===4?.08:0),0,0));
  for(const [root,e] of this.roots)if(!root.isValid||!e.node.isValid)this.roots.delete(root);
 }
 destroy():void{this.disposed=true;for(const {node}of this.roots.values())if(node.isValid)node.destroy();this.roots.clear();for(const m of this.materials)m.destroy();for(const m of this.meshes.values())m.destroy();this.meshes.clear();this.effect?.decRef();}
}
