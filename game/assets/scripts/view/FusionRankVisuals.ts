import {Color,EffectAsset,Vec4,gfx,Layers,Material,Mesh,MeshRenderer,Node,utils} from 'cc';
import type {Role} from '../core/types';

export const fusionModelScale=(rank:number):number=>rank>=3?1.15:rank===2?1.08:1;
const COLORS:Record<Role,string>={stone:'#E6B45E',spike:'#A7E46D',crystal:'#91E6FF',leaf:'#FFE990',bubble:'#CEA0FF'};
/** Shared opaque, unlit geometry: legible stars and an open centre under the feet. */
export class FusionRankVisuals{
 private meshes:Mesh[]=[];private materials=new Map<string,Material>();
 private effect?:EffectAsset;
 setEffect(effect:EffectAsset):void{this.effect=effect;}
 private star:Mesh;private ring:Mesh;private rim:Mesh;
 constructor(){
  const p=[0,0,0],ix:number[]=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.22:.5;p.push(Math.cos(a)*r,Math.sin(a)*r,0);}for(let i=0;i<10;i++)ix.push(0,i+1,(i+1)%10+1);
  this.star=this.mesh(p,ix);this.ring=this.annulus(.62,.70,6,.13);this.rim=this.annulus(.73,.755,1,0);
 }
 private mesh(positions:number[],indices:number[]):Mesh{const mesh=utils.createMesh({positions,indices,uvs:Array(positions.length/3*2).fill(0),normals:positions.map((_,i)=>i%3===2?1:0)});this.meshes.push(mesh);return mesh;}
 private annulus(inner:number,outer:number,segments:number,gap:number):Mesh{
  const p:number[]=[],ix:number[]=[];for(let s=0;s<segments;s++)for(let j=0;j<16;j++){
   const a=s*Math.PI*2/segments+gap/2+j*(Math.PI*2/segments-gap)/16,b=a+(Math.PI*2/segments-gap)/16,k=p.length/3;
   for(const [r,t]of [[inner,a],[outer,a],[inner,b],[outer,b]])p.push(Math.cos(t)*r,0,Math.sin(t)*r);ix.push(k,k+2,k+1,k+1,k+2,k+3);
  }return this.mesh(p,ix);
 }
 private part(parent:Node,name:string,mesh:Mesh,color:string,hud=false):Node{
  const n=new Node(name);n.layer=Layers.Enum.DEFAULT;n.setParent(parent);const r=n.addComponent(MeshRenderer);r.mesh=mesh;
  const key=color+hud;let m=this.materials.get(key);if(!m){m=new Material();m.initialize({...(this.effect?{effectAsset:this.effect}:{effectName:'builtin-unlit'}),states:{priority:hud?207:180,rasterizerState:{cullMode:gfx.CullMode.NONE},depthStencilState:{depthTest:!hud,depthWrite:false}}});if(this.effect)m.setProperty('keyParams',new Vec4(-1,0,0,0));m.setProperty('mainColor',new Color(color));this.materials.set(key,m);}r.setSharedMaterial(m,0);return n;
 }
 badge(bar:Node,rank:number):Node{
  const holder=new Node('合成星级 '+rank);holder.layer=Layers.Enum.DEFAULT;holder.setParent(bar);
  for(let i=0;i<rank;i++){
   const x=-.75-(rank-1-i)*.28;
   const border=this.part(holder,'星级描边',this.star,'#203536',true);border.setPosition(x,0,.06);border.setScale(.30,.30,.30);
   const star=this.part(holder,'等级星',this.star,rank===3?'#FFDE72':rank===2?'#ADFAFF':'#ECF0E5',true);star.setPosition(x,0,.075);star.setScale(.23,.23,.23);
  }return holder;
 }
 pedestal(parent:Node,role:Role):Node{
  const root=new Node('三阶职业光座');root.layer=Layers.Enum.DEFAULT;root.setParent(parent);root.setPosition(0,.023,0);
  this.part(root,'职业光纹',this.ring,COLORS[role]);const rim=this.part(root,'金色镶边',this.rim,'#FFE3A0');rim.setPosition(0,-.002,0);
  // The centre stays empty; three small rank accents sit on the far rim, never across the feet.
  for(let i=0;i<3;i++){const star=this.part(root,'三阶星纹',this.star,'#FFF1B8');star.setPosition((i-1)*.20,.003,.77);star.setRotationFromEuler(-90,0,0);star.setScale(.13,.13,.13);}return root;
 }
 destroy():void{this.meshes.forEach(m=>m.destroy());this.materials.forEach(m=>m.destroy());}
}
