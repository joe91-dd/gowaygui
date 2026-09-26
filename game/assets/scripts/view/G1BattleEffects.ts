import {enemyG1} from '../core/enemyG1Catalog';
import {softwareRendering} from './RenderBudget';
import {Camera,Color,EffectAsset,gfx,Mat4,Material,Mesh,MeshRenderer,Node,Quat,Texture2D,primitives,utils,Vec3,Vec4} from 'cc';
import type {Role} from '../core/types';
import {SculptedEnergy} from './SculptedEnergy';

type Trail={nodes:Node[];kind:'rock'|'frost'|'arrows'|'heal'|'summon'|'slash'|'impact'|'lightning';point:Vec3;end?:Vec3;age:number;life:number;size:number};
type Mote={texture:string;sequence?:number;node:Node;material:Material;from:Vec3;to:Vec3;age:number;life:number;size:number;ground:boolean;spin:number;curve:number};
type Fragment={node:Node;from:Vec3;to:Vec3;age:number;life:number;size:number;phase:number;kind:'rock'|'crystal'|'ice'|'arrow'|'debris';orbit:number;orbitCenter?:Vec3;orbitRadius?:number;orbitSpeed?:number;orbitHeight?:number};
type Equipment={model:Node;role:Role;core?:Node;grip?:Node;arcs:Node[];glow?:Node;glowMaterial?:Material;vines:{node:Node;material:Material}[];phase:number};
const ACCENT:Record<Role,string>={stone:'#70CDF5',spike:'#AADAA6',crystal:'#8ADFFF',leaf:'#FFCE80',bubble:'#BCA0F0'};
const find=(root:Node,name:string):Node|undefined=>root.name===name?root:root.children.map(n=>find(n,name)).find(Boolean);

/** Mesh ribbons, short textured impacts and rigid equipment sockets share the real 3D depth buffer. */
export class G1BattleEffects{
 private readonly compact=softwareRendering();
 private enemyLights:{model:Node;node:Node;material:Material;advanced:boolean;phase:number}[]=[];
 private enemyColour(key?:string):string{
  const id=enemyG1(key??'')?.id;
  return id==='H03'||id==='W03'?'#FFAA54':id==='H02'||id==='W02'||id==='B05'||id==='B10'?'#C79CEB':id==='B04'||id==='B02'?'#AADD8F':id==='H04'||id==='W04'||id==='M04'?'#A9E9FF':'#7DDAE8';
 }
 attachEnemy(model:Node,key:string):void{
  if(this.enemyLights.some(e=>e.model===model))return;
  const asset=enemyG1(key);if(!asset||asset.kind!=='boss'&&asset.kind!=='elite'&&asset.id!=='M04')return;
  if(asset.id==='M04'&&this.enemyLights.filter(e=>!e.advanced).length>12)return;
  const core=find(model,'FX_Enemy_Core');if(!core)return;
  const glow=this.sprite(core,asset.id==='H03'?'flame_01':'light_02',this.enemyColour(key));
  this.enemyLights.push({model,...glow,advanced:/^[HW]/.test(asset.id),phase:this.enemyLights.length*1.63});
 }

 private readonly energy:SculptedEnergy;private readonly quad:Mesh;private readonly equipment:Equipment[]=[];
 private fragments:Fragment[]=[];private fragmentPool=new Map<string,Node[]>();private fragmentMeshes=new Map<string,Mesh>();private fragmentMaterials=new Map<string,Material>();
 private spritePool=new Map<string,{node:Node;material:Material}[]>();
 private warnings:{nodes:Node[];point:Vec3;age:number;life:number;radius:number}[]=[];
 private trails:Trail[]=[];private motes:Mote[]=[];private extraMeshes:Mesh[]=[];private time=0;
 clearTransient():void{
  for(const e of this.motes)this.recycleMote(e);this.motes=[];
  for(const f of this.fragments)this.recycleFragment(f);this.fragments=[];
  for(const t of this.trails)t.nodes.forEach(n=>this.energy.release(n));this.trails=[];
  for(const w of this.warnings)w.nodes.forEach(n=>this.energy.release(n));this.warnings=[];
 }
 constructor(private root:Node,private camera:Camera,private energyEffect:EffectAsset,private particleEffect:EffectAsset,private textures:Map<string,Texture2D>,private surfaceMaterial:Material){
  this.energy=new SculptedEnergy(energyEffect);
  this.quad=utils.createMesh({positions:[-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,1,1,1,0,0,1,0],indices:[0,1,2,2,1,3]});
 }
 private sprite(parent:Node,texture:string,colour:string):{node:Node;material:Material}{
  const node=new Node('G1 光粒子');node.layer=this.root.layer;node.setParent(parent);const renderer=node.addComponent(MeshRenderer);renderer.mesh=this.quad;
  const material=new Material();material.initialize({effectAsset:this.particleEffect,states:{priority:210,...(texture==='spell-volumes-v1'?{blendState:{targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.ONE,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]}}:{})}});material.setProperty('mainTexture',this.textures.get(texture)??this.textures.get('light_02')!);material.setProperty('tint',new Color(colour));material.setProperty('motion',new Vec4(0,1,0,0));renderer.setSharedMaterial(material,0);return{node,material};
 }
 attach(model:Node,role:Role):void{
  if(this.equipment.some(e=>e.model===model))return;
  const core=find(model,'FX_Weapon_Core'),grip=find(model,'FX_Weapon_Grip');
  const e:Equipment={model,role,core,grip,arcs:[],vines:[],phase:this.equipment.length*1.71};
  if(core){
   if(role!=='spike')for(let i=0;i<(role==='stone'?2:3);i++)e.arcs.push(this.energy.arc(core,ACCENT[role],'weapon'));
   const glow=this.sprite(core,role==='leaf'?'flame_01':'light_02',ACCENT[role]);e.glow=glow.node;e.glowMaterial=glow.material;
  }
  if(role==='stone')for(const side of ['L','R'])for(const part of ['Wrist','Foot']){
   const at=find(model,`FX_Crystal_${part}_${side}`);if(at)e.arcs.push(this.energy.arc(at,'#78D8F2','weapon'));
  }
  if(role==='spike'&&grip){
   const markers=Array.from({length:9},(_,i)=>find(model,'FX_Vine_'+String(i).padStart(2,'0'))).filter((n):n is Node=>!!n);
   if(markers.length===9){
    const inv=new Mat4();Mat4.invert(inv,grip.worldMatrix);const points=markers.map(n=>Vec3.transformMat4(new Vec3(),n.worldPosition,inv));
    const units=1/Math.max(.00001,Math.abs(grip.worldScale.x));
    for(let strand=0;strand<2;strand++){
     const samples:Vec3[]=[];
     for(let i=0;i<=96;i++){
      const t=i/96*(points.length-1),j=Math.min(points.length-2,Math.floor(t)),f=t-j;
      const p0=points[Math.max(0,j-1)],p1=points[j],p2=points[j+1],p3=points[Math.min(points.length-1,j+2)];
      const p=new Vec3();for(const axis of ['x','y','z'] as const)p[axis]=.5*((2*p1[axis])+(-p0[axis]+p2[axis])*f+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*f*f+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*f*f*f);
      p.x+=Math.cos(i*.46+strand*Math.PI)*.013*units;p.z+=Math.sin(i*.46+strand*Math.PI)*.013*units;samples.push(p);
     }
     e.vines.push(this.tube(grip,samples,.007*units,strand?'#B7D9A0':'#498F79'));
    }
   }
  }
  this.equipment.push(e);
 }
 telegraph(at:Vec3,radius:number,life=1.35,tint?:string):void{
  if(this.warnings.length>=8){const old=this.warnings.shift()!;old.nodes.forEach(n=>this.energy.release(n));}
  const nodes=[this.energy.arc(this.root,tint??'#ED8852','ground'),this.energy.arc(this.root,tint??'#FFE1A0','ground')];
  this.warnings.push({nodes,point:at.clone(),age:0,life,radius});
 }
 /** Shared status language from the 特效大师 sheet.  Keeping it here means
  * every enemy and summon uses the same readable ground/overhead feedback. */
  status(kind:string,at:Vec3,radius=.8):void{
  const key=kind.replace(/^(bossTell-|boss-)/,'');
  if(key==='web'){this.art(5,new Vec3(at.x,.09,at.z),radius*3,1.4,true);this.art(5,new Vec3(at.x,.48,at.z),radius*1.6,.7);return;}
  if(key==='shield'||key==='openingShield'){this.art(6,new Vec3(at.x,.85,at.z),radius*2.2,1.2);this.art(10,at,radius,.35);return;}
  if(key==='root'){this.art(11,new Vec3(at.x,.48,at.z),radius*2,1.25);return;}
  if(key==='fervor'||key==='giant'||key==='taunt')this.art(key==='fervor'?1:key==='giant'?7:10,new Vec3(at.x,.55,at.z),radius*1.8,.7);
  if(key==='polymorph'||key==='sheep'){
   this.art(4,new Vec3(at.x,.82,at.z),radius*1.55,.9);
   for(let i=0;i<(this.compact?3:5);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*radius*.85,.92,at.z+Math.sin(a)*radius*.85);this.art(9,p,radius*.34,.52,false,i*.07,new Vec3(at.x,.92,at.z));}
  }
  if(key==='sleep')this.art(4,new Vec3(at.x,1.05,at.z),radius*1.35,1.0);
  if(key==='silence'){
   this.art(9,new Vec3(at.x,1.0,at.z),radius*1.35,.8);
   for(let i=0;i<(this.compact?3:5);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*radius*.72,1.18,at.z+Math.sin(a)*radius*.72);this.art(4,p,radius*.28,.46,false,i*.08,new Vec3(at.x,1.18,at.z));}
  }
  if(key==='armorBreak'||key==='armorDown'||key==='resistDown'||key==='weaken')this.art(10,at,radius*1.6,.5);
  if(key==='stun'||key==='hold'||key==='crystalMastery')this.art(0,at,radius*1.6,.65);
  if(key==='fervor'){this.cast('impact',at,radius,.58);this.mote(new Vec3(at.x,1.05,at.z),new Vec3(at.x,1.35,at.z),'#FF8B5C',.34,.72,'flame_01');return;}
  if(key==='giant'){this.cast('rock',at,radius*1.12,.82);this.mote(new Vec3(at.x,1.05,at.z),new Vec3(at.x,1.65,at.z),'#FFD27A',.42,.78,'star_04');return;}
  if(key==='taunt'){this.cast('impact',at,radius*.9,.56);this.mote(new Vec3(at.x,1.15,at.z),new Vec3(at.x,1.15,at.z),'#FF766C',.38,.66,'star_04');return;}
  if(key==='encourage'){this.cast('heal',at,radius*.75,.55);return;}
  if(key==='castInterrupted'){this.cast('impact',at,radius,.46);this.mote(new Vec3(at.x,1.2,at.z),new Vec3(at.x,1.2,at.z),'#FFE8A8',.34,.34,'spark_04');return;}
  if(key==='polymorph'||key==='sheep'){this.cast('summon',at,radius*.8,.8);this.mote(new Vec3(at.x,1.18,at.z),new Vec3(at.x,1.18,at.z),'#E6C8FF',.38,.68,'star_04');return;}
  if(key==='sleep'){this.cast('summon',at,radius*.75,1.05);this.mote(new Vec3(at.x,1.35,at.z),new Vec3(at.x,1.35,at.z),'#A995D4',.30,.9,'light_02');return;}
  if(key==='silence'){this.art(9,new Vec3(at.x,.72,at.z),radius*1.05,.72,false,.08);this.mote(new Vec3(at.x,1.2,at.z),new Vec3(at.x,1.2,at.z),'#765A9C',.42,.6,'star_04');return;}
  if(key==='slow'||key==='frost'||key==='root'||key==='anchor'){this.cast('frost',at,radius,.65);return;}
  if(key==='armorBreak'||key==='resistDown'||key==='weaken'){this.cast('impact',at,radius*.75,.52);return;}
  if(key==='stun'||key==='hold'){this.cast('impact',at,radius*.8,.48);return;}
  if(key==='cleanse'||key==='revive'||key==='rebirth'){this.cast('heal',at,radius,1.1);return;}
  if(key==='enemyMend'){this.art(3,new Vec3(at.x,.72,at.z),radius*1.35,.8);this.art(11,new Vec3(at.x,.12,at.z),radius*1.1,.72,true,.16);return;}
  if(key==='spawn'||key==='bubbleRing'||key==='spirit'){this.cast('summon',at,radius,1.05);return;}
  this.cast('impact',at,radius*.7,.42);
 }
 death(at:Vec3,boss=false):void{
  this.cast('impact',at,boss?1.55:.82,boss?.9:.58);
  const count=this.compact?4:boss?12:7;
  for(let i=0;i<count;i++){const a=i*2.399,r=(boss?1.15:.55)*(0.55+(i%3)*.2),to=new Vec3(at.x+Math.cos(a)*r,.18+(i%2)*.12,at.z+Math.sin(a)*r);this.mote(at,to,boss?'#FFB16A':'#D4EEF0',boss?.28:.16,.46,'spark_04',false,i*.025,.24);}
 }
  spawn(at:Vec3,kind:'turtle'|'golem'|'enemy'='enemy'):void{
  this.cast(kind==='golem'?'impact':'summon',at,kind==='golem'?1.25:1,.9);
 }
  wave(kind:'start'|'victory'|'defeat',at:Vec3):void{
   if(kind==='start'){this.cast('summon',at,1.35,.9);this.mote(new Vec3(at.x,.2,at.z),new Vec3(at.x,1.7,at.z),'#7BE4DD',.36,.82,'trace_01');return;}
   if(kind==='victory')return;
   this.cast('impact',at,1.45,.8);this.mote(new Vec3(at.x,.22,at.z),new Vec3(at.x,1.35,at.z),'#F58A78',.3,.65,'flame_01');
  }
 enemyAttack(from:Vec3,to:Vec3,ranged:boolean,boss:boolean,key?:string,model?:Node):void{
  const mouth=model?find(model,'FX_Enemy_Mouth'):undefined;if(mouth?.isValid)from=mouth.worldPosition.clone();
  const id=enemyG1(key??'')?.id;
  if(ranged){
   const cell=id==='B09'||id==='H04'||id==='M04'?0:id==='B05'||id==='H02'?9:id==='B10'||id==='B03'||id==='M05'||id==='M07'?1:id==='M09'?8:10;
   this.art(cell,from,boss?.62:.42,.34,false,0,to);
   this.mote(from,to,this.enemyColour(key),boss?.34:.22,.28,'light_02',false,0,.38);
   this.art(10,new Vec3(to.x,.48,to.z),boss?.72:.38,.24,false,.25);
   return;
  }
  const at=new Vec3((from.x+to.x)*.5,.62,(from.z+to.z)*.5);
  this.trail('slash',at,.21,boss?.72:.36,to);
  const cell=id==='B01'||id==='B07'||id==='H01'?2:id==='B02'||id==='B06'||id==='E01'?7:id==='H03'?1:id==='B05'||id==='H02'?9:id==='M06'||id==='E02'?5:10;
  this.art(cell,from,boss?.58:.34,.28,false,0,to);
  this.art(10,new Vec3(to.x,.44,to.z),boss?.68:.34,.22,false,.20);
  this.mote(to,to,'#FFDA9E',boss?.48:.26,.16,'spark_04');
 }
  bossCast(kind:string,at:Vec3,source:Vec3,key?:string):void{
  if(enemyG1(key??'')?.id==='H03'){
   for(let i=0;i<(this.compact?5:8);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*1.4,.1,at.z+Math.sin(a)*1.4);this.mote(at,p,'#FFA461',.26,.48,'flame_01',false,i*.018,.5);}
  }

  if(kind==='web'){this.art(5,source,1,.32,false,0,at);this.art(5,new Vec3(at.x,.09,at.z),3.1,1.5,true,.3);return;}
  if(kind==='fireRain'){for(let i=0;i<(this.compact?4:7);i++){const a=i*2.399,r=.35+(i%4)*.33,p=new Vec3(at.x+Math.cos(a)*r,3+(i%3)*.25,at.z+Math.sin(a)*r),end=new Vec3(p.x,.3,p.z);this.art(1,p,.8,.4,false,i*.09,end);this.art(1,end,1.65,.65,false,.38+i*.09);}return;}
  if(kind==='beacon'){
   this.cast('heal',at,1.15,1.2);
   this.art(3,new Vec3(at.x,.15,at.z),.82,1.0,false,.08,new Vec3(at.x,2.25,at.z));
   this.art(11,new Vec3(at.x,.12,at.z),.9,.9,true,.18);
   this.mote(new Vec3(at.x,.15,at.z),new Vec3(at.x,2.2,at.z),'#8DE7C7',.34,1.15,'light_02');return;
  }
  if(kind==='breakwater'){
   for(let i=0;i<3;i++){
    const x=at.x-1.2+i*1.2;this.art(2,new Vec3(x,.65,at.z-.5),2.4,.9,false,i*.08,new Vec3(x,.5,at.z+1));
    this.art(2,new Vec3(x,.12,at.z+.75),.62,.35,false,.46+i*.08,new Vec3(x,.32,at.z+1.35));
   }
   this.art(10,new Vec3(at.x,.12,at.z+1.25),1.15,.32,true,.48);return;
  }
  if(kind==='shock'){this.cast('impact',at,1.65,.62);for(let i=0;i<4;i++){const a=i*Math.PI/2,p=new Vec3(at.x+Math.cos(a)*.7,.65,at.z+Math.sin(a)*.7);this.mote(p,p,'#B9F2FF',.28,.38,'star_04',false,i*.06);}return;}
  if(kind==='frost'){this.cast('frost',at,1.5,.85);return;}
  if(kind==='drain'){
   this.art(9,new Vec3(at.x,.6,at.z),2.8,1.1);
   this.art(4,new Vec3(at.x,.68,at.z),1.15,.72,false,.12,source);
   for(let i=0;i<(this.compact?4:7);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*2.2,.38,at.z+Math.sin(a)*2.2);this.mote(p,source,'#BA89C9',.22,.7,'trace_01',false,i*.035,.4);this.art(9,p,.28,.58,false,i*.045,source);}
   return;
  }
  if(kind==='rally'){
   for(const x of [-.65,.65]){const p=new Vec3(at.x+x,.1,at.z);this.trail('summon',p,.8,.55);this.mote(p,new Vec3(p.x,1.35,p.z),'#89D9D0',.32,.65,'spark_04');}return;
  }
  if(kind==='mortar'){
   this.art(1,new Vec3(at.x,.5,at.z),2.5,.7,false,.16);
   this.mote(new Vec3(at.x,3.4,at.z),new Vec3(at.x,.08,at.z),'#FFC58D',.44,.18,'flame_01');
   this.cast('impact',at,1.15,.55);return;
  }
  this.cast('impact',at,kind==='shock'?1.65:1.35,.65);
 }
 private tube(parent:Node,points:Vec3[],radius:number,colour:string):{node:Node;material:Material}{
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],sides=6;
  for(let i=0;i<points.length;i++){
   const d=Vec3.subtract(new Vec3(),points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]).normalize();
   const a=Vec3.cross(new Vec3(),d,Math.abs(d.y)>.8?new Vec3(1,0,0):new Vec3(0,1,0)).normalize(),b=Vec3.cross(new Vec3(),d,a).normalize();
   for(let j=0;j<sides;j++){
    const t=j/sides*Math.PI*2,n=Vec3.add(new Vec3(),Vec3.multiplyScalar(new Vec3(),a,Math.cos(t)),Vec3.multiplyScalar(new Vec3(),b,Math.sin(t))),p=Vec3.scaleAndAdd(new Vec3(),points[i],n,radius);
    positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push(i/(points.length-1),j/(sides-1));
    if(i){const k=i*sides+j,q=i*sides+(j+1)%sides;indices.push(k-sides,k,q-sides,q-sides,k,q);}
   }
  }
  const mesh=utils.createMesh({positions,normals,uvs,indices});this.extraMeshes.push(mesh);
  const node=new Node('沿弓生长的玉色藤脉');node.layer=parent.layer;node.setParent(parent);const r=node.addComponent(MeshRenderer);r.mesh=mesh;
  const material=new Material();material.initialize({effectAsset:this.energyEffect,states:{priority:210}});material.setProperty('tint',new Color(colour));material.setProperty('motion',new Vec4(0,0,0,0));r.setSharedMaterial(material,0);return{node,material};
 }
 emitter(model:Node,role:Role):Vec3|undefined{
  const e=this.equipment.find(e=>e.model===model),at=role==='spike'?e?.grip:e?.core;return at?.isValid?at.worldPosition.clone():undefined;
 }
 private recycleMote(e:Mote):void{e.node.active=false;const pool=this.spritePool.get(e.texture)??[];pool.push({node:e.node,material:e.material});this.spritePool.set(e.texture,pool);}
 /** Filled painted volumes are the body of a spell; ribbons and debris add motion. */
 private art(cell:number,at:Vec3,size:number,life:number,ground=false,delay=0,to?:Vec3):void{
  this.mote(at,to??at,'#FFFFFF',size,life,'spell-volumes-v1',ground,delay,0,-cell-2);
 }
 piercing(from:Vec3,to:Vec3):void{
  this.art(8,from,1.6,.28,false,0,to);this.fragment('arrow',from,to,.95,.28,this.time);
  for(let i=0;i<5;i++){const p=Vec3.lerp(new Vec3(),from,to,i/5);this.art(8,p,.8,.3,false,i*.035);}
  this.art(10,to,1.1,.35,false,.23);
 }
 private mote(from:Vec3,to:Vec3,colour:string,size:number,life:number,texture='spark_04',ground=false,delay=0,curve=0,sequence?:number):void{
  // Software rendering is the lowest common denominator for the preview and
  // older laptops. Keep the live sprite budget tight so weather volleys do not
  // turn into a queue of translucent quads.
  if(this.motes.length>=(this.compact?22:56)){
   const decorative=this.motes.findIndex(m=>m.sequence===undefined);
   // Decorative sparks must not evict the painted spell body or later volleys.
   if(sequence===undefined&&decorative<0)return;
   const [old]=this.motes.splice(decorative<0?0:decorative,1);this.recycleMote(old);
  }
  const p=this.spritePool.get(texture)?.pop()??this.sprite(this.root,texture,colour);p.material.setProperty('tint',new Color(colour));p.material.setProperty('motion',new Vec4(0,0,0,0));p.node.active=delay<=0;this.motes.push({...p,texture,sequence,from:from.clone(),to:to.clone(),age:-delay,life,size,ground,spin:this.time*17+this.motes.length*31,curve});
 }
 attack(model:Node|undefined,role:Role|undefined,from:Vec3,to:Vec3,critical=false):void{
  const colour=role?ACCENT[role]:'#FFBDA1';const start=model&&role?this.emitter(model,role)??from:from;
  if(role==='stone'){
   this.trail('slash',new Vec3((start.x+to.x)/2,.78,(start.z+to.z)/2),.25,.72,to);
   this.art(7,new Vec3(to.x,.48,to.z),critical?1.05:.72,.34,false,.11);
   this.art(10,new Vec3(to.x,.12,to.z),critical?.78:.48,.24,true,.22);
   this.mote(to,to,'#FFDFAC',critical?.85:.47,.22,'star_04');return;
  }
  if(role==='spike'){
   this.fragment('arrow',start,to,.62,.30,this.time);
   this.art(8,start,.72,.30,false,0,to);
   this.art(10,new Vec3(to.x,.42,to.z),critical?.82:.54,.28,false,.18);
  }else if(role==='crystal'){
   this.art(0,new Vec3(to.x,.58,to.z),critical?1.02:.76,.44,false,.08);
   this.art(10,new Vec3(to.x,.12,to.z),critical?.72:.46,.24,true,.24);
  }else if(role==='leaf'){
   this.art(3,new Vec3(to.x,.72,to.z),critical?.88:.64,.44,false,.08);
   this.art(10,new Vec3(to.x,.12,to.z),critical?.66:.42,.24,true,.24);
  }else if(role==='bubble'){
   this.art(4,new Vec3(to.x,.82,to.z),critical?.90:.68,.46,false,.08);
   this.art(10,new Vec3(to.x,.12,to.z),critical?.66:.44,.24,true,.24);
  }else{
   this.art(10,new Vec3(to.x,.45,to.z),critical?.88:.58,.30,false,.12);
  }
  this.mote(start,to,colour,role==='spike'?.20:.27,.30,role==='spike'?'trace_01':'light_02',false,0,role==='leaf'?.25:.08);
  for(let i=0;i<(this.compact?1:3);i++)this.mote(start,to,colour,.10,.28,'spark_04',false,i*.045,.05);
 }
 impact(at:Vec3,critical=false):void{this.art(10,at,critical?1.1:.5,.22);}
 cast(kind:'rock'|'frost'|'arrows'|'heal'|'summon'|'impact',at:Vec3,size=1,life=1,mastery=false):void{
  // Summoning uses roots/leaf light. The old purple vortex was visually close
  // to several control effects and made the summon family hard to identify.
  const cell={rock:7,frost:0,arrows:8,heal:3,summon:11,impact:10}[kind];
  const body=new Vec3(at.x,kind==='summon'?.10:kind==='heal'?.85:.5,at.z);
  // A small charge beat followed by the larger painted volume makes the cast
  // read as a finished in-game action instead of a static marker.
  this.art(cell,new Vec3(at.x,.12,at.z),size*(kind==='heal'?1.0:.72),.24,true);
  const bodyScale=kind==='rock'?(mastery?1.18:.96):kind==='heal'?2.1:2.4;
  this.art(cell,body,size*bodyScale,Math.min(life,kind==='rock'?.82:1.2),false,kind==='summon'?.16:.10);
  if(mastery)this.art(cell,new Vec3(at.x,kind==='heal'?1.05:.68,at.z),size*(kind==='heal'?1.35:1.05),.52,false,.18);
  if(kind==='impact'||kind==='rock'||kind==='frost')this.art(10,new Vec3(at.x,.12,at.z),size*(kind==='impact'?1.05:.72),.28,true,.22);
  if(kind==='frost')for(let i=1;i<Math.ceil(life);i++)this.art(cell,body,size*2,1.05,false,i*.8);
  if(kind==='rock'&&mastery)this.art(cell,body,size*1.30,.66,false,.46);
  if(kind==='heal')this.art(10,new Vec3(at.x,.12,at.z),size*1.6,.65,true);
  this.trail(kind,at,life,size);
  const row=kind==='rock'||kind==='impact'?1:kind==='heal'||kind==='arrows'||kind==='summon'?2:0;
  const anchor=new Vec3(at.x,.085,at.z);
  if(!this.compact)this.mote(anchor,anchor,kind==='heal'?'#FFF1B8':kind==='rock'?'#E1CCA7':'#FFFFFF',size*(kind==='frost'?2.7:2.2),Math.max(.55,Math.min(1.35,life)),'cethiel-spells',true,0,0,row);

  if(kind==='rock'){
   // Keep the tank readable. The storm body is carried by the orbit layers
   // below instead of a pile of overlapping center fragments.
   const coreCount=this.compact?(mastery?1:0):mastery?2:1;
   for(let i=0;i<coreCount;i++)this.fragment('rock',new Vec3(at.x,.30,at.z),new Vec3(at.x,.30,at.z),.20+i*.04,.72,i*2.4);
  }
  if(kind==='frost'||kind==='arrows')for(let i=0;i<(this.compact?4:8);i++){const a=i*2.399,r=size*(.22+(i%4)*.21),to=new Vec3(at.x+Math.cos(a)*r,.10,at.z+Math.sin(a)*r);this.fragment(kind==='frost'?'ice':'arrow',new Vec3(to.x+.35,2.2+(i%3)*.3,to.z),to,kind==='frost'?.24:.66,.44+i*.04,i);}
  if(kind==='impact')for(let i=0;i<(this.compact?4:8);i++){const a=i*2.399;this.fragment('debris',new Vec3(at.x,.12,at.z),new Vec3(at.x+Math.cos(a)*size,.06,at.z+Math.sin(a)*size),.16,.64,i);}
  if(kind==='rock'){
   // A storm core: painted stones travel on staggered spiral arcs while the
   // physical debris keeps a second, lower orbit around the tank.
   const rings=mastery?3:2;
   const stones=this.compact?(mastery?8:6):(mastery?14:10);
   for(let i=0;i<stones;i++){
    const ring=i%rings,perRing=Math.ceil(stones/rings),slot=Math.floor(i/rings),a=slot*2.399+ring*.82,r=size*(.82+ring*.25),p=new Vec3(at.x+Math.cos(a)*r,.34+ring*.15,at.z+Math.sin(a)*r);
    const crystal=i%2===1;
    this.fragment(crystal?'crystal':'rock',p,p,crystal?.34:.38,mastery?3.35:2.65,a+(ring%2)*.7,0,at,mastery?(ring%2?2.8:-2.45):(ring%2?2.1:-1.8),.34+ring*.14);
   }
   // Both versions throw material outward from the tank. Mastery reaches
   // farther, then punctuates the outer ring with lightning arcs.
   const bursts=this.compact?(mastery?4:3):(mastery?9:6);
   for(let i=0;i<bursts;i++){
    const a=i*2.399+.35,r=size*(mastery?1.42:1.22)*(1+(i%3)*.16),end=new Vec3(at.x+Math.cos(a)*r,.18+(i%2)*.16,at.z+Math.sin(a)*r);
    this.fragment(i%2?'crystal':'rock',new Vec3(at.x,.25,at.z),end,mastery?.24:.20,mastery?.94:.80,i*1.71);
    if(mastery)this.art(i%2?7:10,end,.20+(i%3)*.04,.34,false,i*.045);
   }
   // The reference has a readable ground silhouette around the tank. Keep
   // these as two low-cost painted rings instead of a single bright center.
   this.mote(new Vec3(at.x,.075,at.z),new Vec3(at.x,.075,at.z),mastery?'#B9F0FF':'#C9E5E3',size*(mastery?1.48:1.24),2.25,'circle_05',true,0,0,-1);
   if(mastery)this.mote(new Vec3(at.x,.082,at.z),new Vec3(at.x,.082,at.z), '#D9F8FF',size*1.88,2.05,'circle_05',true,.08,0,-1);
   if(mastery){
    const arcs=this.compact?2:4;
    for(let i=0;i<arcs;i++){
     const a=i*Math.PI*2/arcs+.4,r=size*(.62+(i%2)*.18),p=new Vec3(at.x+Math.cos(a)*r,.46+(i%2)*.22,at.z+Math.sin(a)*r);
     this.trail('lightning',p,.62+i*.06,.22+(i%2)*.05);
     this.mote(p,new Vec3(at.x+Math.cos(a+1.0)*r*.35,1.05,at.z+Math.sin(a+1.0)*r*.35),'#D7F6FF',.17,.38,'trace_01',false,i*.06,.12);
    }
   }
  }
  if(kind==='arrows'||kind==='frost'){
   // Weather skills fall in readable volleys instead of appearing as one
   // centered card. Each volley has its own drop spacing and impact beat.
   const volleys=kind==='arrows'?(this.compact?(mastery?3:2):(mastery?5:3)):(this.compact?(mastery?3:2):(mastery?5:3)),drops=kind==='arrows'?(this.compact?3:(mastery?6:5)):(this.compact?3:(mastery?5:4));
   for(let volley=0;volley<volleys;volley++)for(let drop=0;drop<drops;drop++){
    const spread=(drop-(drops-1)*.5)*.55+(volley%2? .22:-.18),a=volley*1.71+drop*.73;
    const x=at.x+Math.cos(a)*size*(.25+Math.abs(spread)*.55),z=at.z+Math.sin(a)*size*(.25+Math.abs(spread)*.55);
    const from=new Vec3(x+.18,2.65+(drop%2)*.22,z),to=new Vec3(x,.10,z),delay=volley*.34+drop*.035;
    this.art(kind==='arrows'?8:0,from,size*(kind==='arrows'?.30:.42),kind==='arrows'?.34:.48,false,delay,to);
    this.art(10,to,size*(kind==='arrows'?.24:.32),.20,false,delay+(kind==='arrows'?.24:.34));
   }
  }
  if(mastery&&kind==='heal'){
   for(let i=0;i<(this.compact?3:5);i++){
    const a=i*2.399,r=size*(.35+(i%2)*.28),p=new Vec3(at.x+Math.cos(a)*r,.18,at.z+Math.sin(a)*r);
    this.art(3,p,size*.34,.72,false,i*.07,new Vec3(p.x,1.45,p.z));
   }
  }
  const colour=kind==='rock'?'#BAE2EE':kind==='arrows'?'#C4DFB1':kind==='heal'?'#FFE0A3':kind==='summon'?'#9EEA9B':'#A7ECFF';
  const count=this.compact?2:kind==='frost'?8:kind==='arrows'?7:9;
  for(let i=0;i<count;i++){
   const a=i*2.399,r=(.25+(i%5)/6)*size,end=new Vec3(at.x+Math.cos(a)*r,.10,at.z+Math.sin(a)*r);
   const from=new Vec3(end.x+(kind==='arrows'?.45:0),kind==='arrows'||kind==='frost'?2.0+i%3*.32:.15,end.z);
   if(kind==='heal'||kind==='summon'){this.mote(end,new Vec3(end.x,.7+(i%4)*.25,end.z),colour,.18+(i%3)*.04,.65,'spark_04',false,i*.05);}
   else this.mote(from,end,colour,kind==='arrows'?.23:.16,.42,kind==='arrows'?'trace_01':'star_04',false,i*.055);
  }
  if(!this.compact)this.mote(new Vec3(at.x,.07,at.z),new Vec3(at.x,.07,at.z),colour,size*2,.46,'circle_05',true);
 }

 private fragment(kind:Fragment['kind'],from:Vec3,to:Vec3,size:number,life:number,phase:number,orbit=0,orbitCenter?:Vec3,orbitSpeed=5.5,orbitHeight=.25):void{
  if(this.fragments.length>=(this.compact?14:44))this.recycleFragment(this.fragments.shift()!);
  let mesh=this.fragmentMeshes.get(kind);if(!mesh){
   mesh=utils.createMesh(kind==='arrow'||kind==='crystal'?primitives.cone(kind==='crystal'?.16:.10,kind==='crystal'?1.15:1,{radialSegments:kind==='crystal'?5:4}):kind==='ice'?primitives.sphere(.5,{segments:5}):primitives.box({width:1,height:.8,length:.9}));this.fragmentMeshes.set(kind,mesh);
  }
  let material=this.fragmentMaterials.get(kind);if(!material){material=new Material();material.copy(this.surfaceMaterial,{defines:{USE_ALBEDO_MAP:false,USE_NORMAL_MAP:false,USE_PBR_MAP:false}});
   material.setProperty('mainColor',new Color(kind==='arrow'?'#C7E7AA':kind==='crystal'?'#83D9F2':kind==='ice'?'#7ECEEC':'#B2A48A'));material.setProperty('roughness',kind==='ice'||kind==='crystal'?.35:.8);material.setProperty('metallic',kind==='crystal'?.12:0);this.fragmentMaterials.set(kind,material);}
  let node=this.fragmentPool.get(kind)?.pop();if(!node){node=new Node('技能实体碎片 '+kind);node.layer=this.root.layer;node.setParent(this.root);const r=node.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(material,0);}node.active=true;
  this.fragments.push({node,from:from.clone(),to:to.clone(),age:0,life,size,phase,kind,orbit,orbitCenter:orbitCenter?.clone(),orbitRadius:orbitCenter?Vec3.distance(from,orbitCenter):undefined,orbitSpeed:orbitCenter?orbitSpeed:undefined,orbitHeight:orbitCenter?orbitHeight:undefined});
 }
 private recycleFragment(f:Fragment):void{f.node.active=false;const pool=this.fragmentPool.get(f.kind)??[];pool.push(f.node);this.fragmentPool.set(f.kind,pool);}
 private trail(kind:Trail['kind'],point:Vec3,life:number,size:number,end?:Vec3):void{
  while(this.trails.length>=(this.compact?4:10)){const old=this.trails.shift()!;old.nodes.forEach(n=>this.energy.release(n));}
  const count=this.compact?(kind==='rock'?3:kind==='frost'?2:kind==='slash'?1:kind==='lightning'?1:2):(kind==='rock'?5:kind==='frost'?4:kind==='slash'?2:kind==='lightning'?3:3),colour=kind==='lightning'?'#D7F6FF':kind==='heal'?'#EAC58C':kind==='summon'?'#86C9A8':kind==='arrows'?'#9CCAAC':kind==='rock'?'#7BBCCD':'#A4DDED';
  const nodes=Array.from({length:count},(_,i)=>this.energy.arc(this.root,colour,i===0?'ground':kind==='frost'?'frost':'wind'));
  this.trails.push({nodes,kind,point:point.clone(),end:end?.clone(),age:0,life,size});
 }
 update(dt:number):void{
  this.time+=dt;
  for(let i=this.enemyLights.length-1;i>=0;i--){
   const e=this.enemyLights[i];
   if(!e.model.isValid||!e.node.isValid){e.material.destroy();this.enemyLights.splice(i,1);continue;}
   if(!e.model.activeInHierarchy)continue;
   const pulse=.5+.5*Math.sin(this.time*1.8+e.phase),size=(e.advanced?.26:.14)*(1+pulse*.22);
   e.node.setWorldScale(size,size,size);e.node.setWorldRotation(this.camera.node.worldRotation);
   e.material.setProperty('motion',new Vec4(this.time,(e.advanced?.24:.12)+pulse*.09,0,0));
  }

  for(let i=this.warnings.length-1;i>=0;i--){const w=this.warnings[i];w.age+=dt;if(w.age>=w.life){w.nodes.forEach(n=>this.energy.release(n));this.warnings.splice(i,1);continue;}const t=w.age/w.life;w.nodes.forEach((n,j)=>{const r=w.radius*(j===0?1:Math.max(.03,t));n.setPosition(w.point.x,.065+j*.008,w.point.z);n.setScale(r,1,r);n.setRotationFromEuler(0,j*180,0);this.energy.animate(n,w.age,j===0?.74:.32);});}
  for(let i=this.equipment.length-1;i>=0;i--){
   const e=this.equipment[i];if(!e.model.isValid){e.arcs.forEach(n=>this.energy.release(n));e.glowMaterial?.destroy();e.vines.forEach(v=>v.material.destroy());this.equipment.splice(i,1);continue;}
   const t=this.time+e.phase,pulse=.5+.5*Math.sin(t*1.65),burst=Math.pow(Math.max(0,Math.sin(t*.82)),8);
   e.arcs.forEach((n,j)=>{const size=e.role==='stone'?(j<2?1.65:.70):e.role==='crystal'?1.20+burst*1.7:e.role==='bubble'?1.05+burst*1.6:.75+pulse*.65;n.setWorldScale(size,size,size);n.setRotationFromEuler(e.role==='crystal'?75:25+j*36,t*(e.role==='bubble'?-46:54)+j*120,15);this.energy.animate(n,t,.25+pulse*.25+burst*.3);});
   if(e.glow?.isValid){const s=e.role==='leaf'?.32+pulse*.18:e.role==='spike'?.18+pulse*.08:.28+burst*.38;e.glow.setWorldScale(s,e.role==='leaf'?s*1.45:s,s);e.glow.setWorldRotation(this.camera.node.worldRotation);e.glowMaterial?.setProperty('motion',new Vec4(t,e.role==='leaf'?.48+pulse*.24:.20+pulse*.2+burst*.4,0,0));}
   const cycle=(t%6.5)/6.5,grow=Math.max(.004,Math.min(1,cycle/.62));e.vines.forEach((v,j)=>v.material.setProperty('motion',new Vec4(t,.52+.20*Math.sin(t*2-j),grow,0)));
  }
  for(let i=this.trails.length-1;i>=0;i--){
   const e=this.trails[i];e.age+=dt;if(e.age>=e.life){e.nodes.forEach(n=>this.energy.release(n));this.trails.splice(i,1);continue;}
   const fade=Math.min(1,e.age*7,(e.life-e.age)*4),t=e.age/e.life;
   e.nodes.forEach((n,j)=>{
    const ground=j===0,r=e.size*(ground?.36+t*.70:.70+j*.13),y=ground?.075:e.kind==='heal'?.12+e.age*.40:e.kind==='rock'?.21+j*.14:e.kind==='slash'?.70:.12+j*.16;
    n.setPosition(e.point.x,y,e.point.z);n.setScale(r,ground?1:r,r);n.setRotationFromEuler(e.kind==='slash'?50:e.kind==='lightning'?35:ground?0:j*5,e.age*(e.kind==='rock'?250:e.kind==='lightning'?480:75)+j*110,e.kind==='slash'?32:e.kind==='lightning'?j*48:0);this.energy.animate(n,e.age,fade*(ground?.33:e.kind==='lightning'?.68:.52));
   });
  }

  for(let i=this.fragments.length-1;i>=0;i--){
   const f=this.fragments[i];f.age+=dt;if(f.age>=f.life){this.recycleFragment(f);this.fragments.splice(i,1);continue;}
   const t=f.age/f.life,p=Vec3.lerp(new Vec3(),f.from,f.to,t);
   if(f.orbitCenter&&f.orbitRadius){const a=f.phase+f.age*(f.orbitSpeed??5.5);p.x=f.orbitCenter.x+Math.cos(a)*f.orbitRadius;p.z=f.orbitCenter.z+Math.sin(a)*f.orbitRadius;p.y=(f.orbitHeight??.25)+Math.sin(f.age*3.2+f.phase)*.10;}
   else if(f.orbit){const a=f.phase+f.age*5.5;p.x+=Math.cos(a)*f.orbit;p.z+=Math.sin(a)*f.orbit;p.y=.25+(f.phase%3)*.11+Math.sin(f.age*7+f.phase)*.08;}
   else if(f.kind==='debris')p.y+=Math.sin(t*Math.PI)*.75;
   f.node.setPosition(p);const envelope=f.orbit?Math.min(1,t*10,(1-t)*7):Math.min(1,(1-t)*8),scale=f.size*envelope;
   f.node.setScale(f.kind==='ice'||f.kind==='crystal'?scale*.35:scale,scale,f.kind==='ice'||f.kind==='crystal'?scale*.35:scale);
   if(f.kind==='arrow'){const d=Vec3.subtract(new Vec3(),f.to,f.from).normalize();f.node.setRotation(Quat.rotationTo(new Quat(),new Vec3(0,1,0),d));}
   else f.node.setRotationFromEuler(f.age*155+f.phase*37,f.age*180,f.age*100+f.phase*19);
  }
  for(let i=this.motes.length-1;i>=0;i--){
   const e=this.motes[i];e.age+=dt;if(e.age<0)continue;e.node.active=true;
   if(e.age>=e.life){this.recycleMote(e);this.motes.splice(i,1);continue;}
   const t=e.age/e.life,p=Vec3.lerp(new Vec3(),e.from,e.to,t);p.y+=Math.sin(t*Math.PI)*e.curve;e.node.setPosition(p);
   const s=e.size*(.72+Math.sin(t*Math.PI)*.4);e.node.setScale(s,s,s);
   if(e.ground)e.node.setRotationFromEuler(-90,0,e.sequence!==undefined&&e.sequence<0?t*18:e.spin+t*14);else e.node.setWorldRotation(this.camera.node.worldRotation);
   const layerAlpha=e.sequence===undefined?.70:e.sequence<0?.84:.80;
   e.material.setProperty('motion',new Vec4(this.time,Math.min(1,t*10,(1-t)*4)*layerAlpha,e.sequence===undefined?0:e.sequence+1,t));
  }
 }
 destroy():void{
  for(const e of this.enemyLights){if(e.node.isValid)e.node.destroy();e.material.destroy();}this.enemyLights=[];
  for(const f of this.fragments)f.node.destroy();this.fragments=[];for(const pool of this.fragmentPool.values())for(const n of pool)n.destroy();this.fragmentPool.clear();for(const m of this.fragmentMeshes.values())m.destroy();for(const m of this.fragmentMaterials.values())m.destroy();
  for(const pool of this.spritePool.values())for(const p of pool){p.node.destroy();p.material.destroy();}this.spritePool.clear();
  this.energy.destroy();for(const e of this.equipment){e.glowMaterial?.destroy();e.vines.forEach(v=>v.material.destroy());}
  for(const e of this.motes){e.node.destroy();e.material.destroy();}this.motes=[];this.equipment.length=0;this.quad.destroy();this.extraMeshes.forEach(m=>m.destroy());
 }
}
