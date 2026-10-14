import {enemyG1} from '../core/enemyG1Catalog';
import {softwareRendering} from './RenderBudget';
import {Camera,Color,EffectAsset,gfx,Mat4,Material,Mesh,MeshRenderer,Node,Quat,Texture2D,primitives,utils,Vec3,Vec4} from 'cc';
import type {Role} from '../core/types';
import {SculptedEnergy} from './SculptedEnergy';

type Trail={nodes:Node[];kind:'rock'|'frost'|'arrows'|'heal'|'summon'|'slash'|'impact'|'lightning';point:Vec3;end?:Vec3;age:number;life:number;size:number};
type Mote={texture:string;sequence?:number;directional?:boolean;essential?:boolean;node:Node;material:Material;from:Vec3;to:Vec3;age:number;life:number;size:number;ground:boolean;spin:number;curve:number};
type Fragment={node:Node;from:Vec3;to:Vec3;age:number;life:number;size:number;phase:number;kind:'rock'|'crystal'|'ice'|'arrow'|'debris';orbit:number;orbitCenter?:Vec3;orbitRadius?:number;orbitSpeed?:number;orbitHeight?:number};
type Equipment={model:Node;role:Role;rank:number;core?:Node;grip?:Node;arcs:Node[];glow?:Node;glowMaterial?:Material;vines:{node:Node;material:Material}[];phase:number};
const ACCENT:Record<Role,string>={stone:'#FFD179',spike:'#8DF04D',crystal:'#69DCFF',leaf:'#FFE679',bubble:'#C889FF'};
const find=(root:Node,name:string):Node|undefined=>root.name===name?root:root.children.map(n=>find(n,name)).find(Boolean);

/** Mesh ribbons, short textured impacts and rigid equipment sockets share the real 3D depth buffer. */
export class G1BattleEffects{
 private readonly compact=softwareRendering();
 private enemyLights:{model:Node;node:Node;material:Material;accents:{node:Node;material:Material}[];ribbons:Node[];advanced:boolean;boss:boolean;style:string;alive:boolean;controlled:boolean;casting:boolean;phase:number}[]=[];
 private enemyLightByModel=new Map<Node,G1BattleEffects['enemyLights'][number]>();
 private enemyColour(key?:string):string{
  const def=enemyG1(key??'');if(!def)return '#7DDAE8';
  if(/fire|mortar/i.test(def.effect)||/熔|焰|焚|火|赤怒/.test(def.name))return '#FF9A3F';
  if(/drain|web/i.test(def.effect)||/墨|幽|毒|孢/.test(def.name))return '#BA82F5';
  if(/rally|beacon|mend/i.test(def.effect)||/藤|苔|菌/.test(def.name))return '#92DE7B';
  return '#65D6F5';
 }
 attachEnemy(model:Node,key:string):void{
  if(this.enemyLightByModel.has(model))return;
  const asset=enemyG1(key);if(!asset||asset.kind!=='boss'&&asset.kind!=='elite'&&asset.id!=='M04')return;
  if(asset.id==='M04'&&this.enemyLights.filter(e=>!e.boss).length>16)return;
  const core=find(model,'FX_Enemy_Core');if(!core)return;
  const colour=this.enemyColour(key),boss=asset.kind==='boss',advanced=/^[HW]/.test(asset.id),style=colour==='#FF9A3F'?'fire':/drain|web/i.test(asset.effect)?'void':/rally|beacon|mend/i.test(asset.effect)?'nature':'tide';
  const glow=this.sprite(core,style==='fire'?'flame_01':'light_02',colour,true),accents:{node:Node;material:Material}[]=[],ribbons:Node[]=[];
  if(asset.id!=='M04')for(let i=0;i<(boss?3:2);i++){
   const socket=find(model,'FX_Enemy_Accent'+i)??(i===0?find(model,'FX_Enemy_Mouth'):undefined);if(!socket)continue;
   accents.push(this.sprite(socket,'star_04',colour,true));
  }
  // Short local energy strokes frame a boss's core, leaving the face and feet open.
  if(boss)for(let i=0;i<(advanced?2:1);i++)ribbons.push(this.energy.arc(core,colour,'weapon'));
  glow.node.active=false;accents.forEach(a=>a.node.active=false);ribbons.forEach(n=>n.active=false);
  const entry={model,...glow,accents,ribbons,advanced,boss,style,alive:true,controlled:false,casting:false,phase:this.enemyLights.length*1.63};this.enemyLights.push(entry);this.enemyLightByModel.set(model,entry);
 }
 enemyState(model:Node,alive:boolean,controlled:boolean,casting:boolean):void{
  const e=this.enemyLightByModel.get(model);if(!e)return;e.alive=alive;e.controlled=controlled;e.casting=casting;
  e.node.active=alive;for(const a of e.accents)a.node.active=alive;for(const n of e.ribbons)n.active=alive;
 }

 private readonly energy:SculptedEnergy;private readonly quad:Mesh;private readonly equipment:Equipment[]=[];
 private fragments:Fragment[]=[];private fragmentPool=new Map<string,Node[]>();private fragmentMeshes=new Map<string,Mesh>();private fragmentMaterials=new Map<string,Material>();
 private spritePool=new Map<string,{node:Node;material:Material}[]>();
 private warnings:{nodes:Node[];point:Vec3;age:number;life:number;radius:number;owner?:string}[]=[];
 private links:{node:Node;age:number;life:number}[]=[];
 private trails:Trail[]=[];private motes:Mote[]=[];private extraMeshes:Mesh[]=[];private time=0;
 clearTransient():void{
  for(const link of this.links)this.energy.release(link.node);this.links=[];
  for(const e of this.motes)this.recycleMote(e);this.motes=[];
  for(const f of this.fragments)this.recycleFragment(f);this.fragments=[];
  for(const t of this.trails)t.nodes.forEach(n=>this.energy.release(n));this.trails=[];
  for(const w of this.warnings)w.nodes.forEach(n=>this.energy.release(n));this.warnings=[];
 }
 constructor(private root:Node,private camera:Camera,private energyEffect:EffectAsset,private particleEffect:EffectAsset,private textures:Map<string,Texture2D>,private surfaceMaterial:Material){
  this.energy=new SculptedEnergy(energyEffect);
  this.quad=utils.createMesh({positions:[-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,1,1,1,0,0,1,0],indices:[0,1,2,2,1,3]});
 }
 private sprite(parent:Node,texture:string,colour:string,surfaceGlow=false):{node:Node;material:Material}{
  const node=new Node('G1 光粒子');node.layer=this.root.layer;node.setParent(parent);const renderer=node.addComponent(MeshRenderer);renderer.mesh=this.quad;
  const material=new Material();material.initialize({effectAsset:this.particleEffect,states:{priority:210,...(surfaceGlow?{depthStencilState:{depthTest:false,depthWrite:false}}:{}),...(['spell-volumes-v1','approved-projectiles','approved-volumes'].includes(texture)?{blendState:{targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.ONE,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]}}:{})}});material.setProperty('mainTexture',this.textures.get(texture)??this.textures.get('light_02')!);material.setProperty('tint',new Color(colour));material.setProperty('motion',new Vec4(0,1,0,0));renderer.setSharedMaterial(material,0);return{node,material};
 }
 attach(model:Node,role:Role,rank=1):void{
  const previous=this.equipment.find(e=>e.model===model);
  if(previous){previous.rank=rank;if(previous.core||!find(model,'FX_Weapon_Core'))return;previous.arcs.forEach(n=>this.energy.release(n));previous.vines.forEach(v=>{v.node.destroy();v.material.destroy();});this.equipment.splice(this.equipment.indexOf(previous),1);}
  const core=find(model,'FX_Weapon_Core'),grip=find(model,'FX_Weapon_Grip');
  const e:Equipment={model,role,rank,core,grip,arcs:[],vines:[],phase:this.equipment.length*1.71};
  if(core){
   if(role!=='spike'||rank===3)for(let i=0;i<(rank===3?2:role==='stone'?2:3);i++)e.arcs.push(this.energy.arc(core,ACCENT[role],'weapon'));
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
 telegraph(at:Vec3,radius:number,life=1.35,tint='#FF4C54',owner?:string):void{
  // Each danger disc is tied to the authoritative caster, radius and landing delay.
  const nodes=[this.energy.arc(this.root,tint,'warning'),this.energy.arc(this.root,tint,'disc')];
  this.warnings.push({nodes,point:at.clone(),age:0,life,radius,owner});
 }
 cancelWarnings(owner?:string):void{
  if(!owner)return;
  this.warnings=this.warnings.filter(w=>{if(w.owner!==owner)return true;w.nodes.forEach(n=>this.energy.release(n));return false;});
 }
 status(kind:string,at:Vec3,radius=.8):void{
  const p=new Vec3(at.x,.65,at.z),head=new Vec3(at.x,1.35,at.z);
  const cell=kind==='web'?5:kind==='root'?11:['shield','openingShield','hold','lastShield'].includes(kind)?6:['armorDown','armorBreak','resistDown','weaken','silence'].includes(kind)?9:['frost','slow','stun','crystalMastery'].includes(kind)?0:['sleep','sheep','polymorph'].includes(kind)?4:['heal','enemyMend','cleanse','encourage','revive','rebirth'].includes(kind)?3:10;
  if(kind==='web'){this.art(5,new Vec3(at.x,.075,at.z),radius*2.1,.85,true);return;}
  if(kind==='root'){this.art(11,new Vec3(at.x,.30,at.z),radius*1.35,.70);return;}
  if(['shield','openingShield','lastShield'].includes(kind)){this.volume(6,p,radius*2.1,.70);return;}
  if(['revive','rebirth'].includes(kind))this.volume(8,p,radius*1.9,.95);
  if(kind==='crystalMastery'||kind==='stun')this.volume(5,p,radius*1.7,.55);
  this.art(cell,['fervor','taunt','giant','encourage','castInterrupted','cooldown'].includes(kind)?head:p,radius*(cell===6?1.5:1.2),kind==='revive'?1.0:.48);
  if(['revive','rebirth','cleanse'].includes(kind))for(let i=0;i<4;i++){const a=i*1.57,from=new Vec3(at.x+Math.cos(a)*.4,.2,at.z+Math.sin(a)*.4);this.mote(from,new Vec3(from.x,1.4,from.z),'#FFE6A2',.16,.65,'spark_04',false,i*.05);}
 }
 healLink(from:Vec3,to:Vec3,siphon=false):void{
  const direction=Vec3.subtract(new Vec3(),to,from),length=direction.length();
  if(length>.01){const node=this.energy.arc(this.root,siphon?'#D995FF':'#FFE888','link');node.setPosition(from);node.setScale(length,1,1);node.setRotation(Quat.rotationTo(new Quat(),new Vec3(1,0,0),direction.normalize()));this.links.push({node,age:0,life:.48});}
  this.projectile(siphon?4:3,from,to,.8,.28,0,.22,true);
  this.art(siphon?4:3,to,.68,.3,false,.23);
 }
 splash(at:Vec3,radius:number):void{
  for(let i=0;i<(this.compact?4:6);i++){const a=i*Math.PI*2/(this.compact?4:6),end=new Vec3(at.x+Math.cos(a)*radius*.65,.35,at.z+Math.sin(a)*radius*.65);this.projectile(0,at,end,.52,.22);}
 }
 fusion(at:Vec3,advanced:boolean):void{
  this.art(6,new Vec3(at.x,.7,at.z),advanced?2:1.5,.6);this.art(10,new Vec3(at.x,.08,at.z),advanced?2.2:1.6,.65,true);
  for(let i=0;i<(advanced?6:4);i++){const a=i*2.4,p=new Vec3(at.x+Math.cos(a)*.6,.1,at.z+Math.sin(a)*.6);this.mote(p,new Vec3(p.x,1.6,p.z),advanced?'#FFE284':'#83EDFF',.19,.7,'star_04',false,i*.04);}
 }
 pearlHit(at:Vec3):void{this.volume(10,at,1.6,.3);this.art(10,at,1.1,.18);}
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
  const asset=enemyG1(key??''),id=asset?.id??'',effect=asset?.effect??'';
  ranged=ranged||['ink','mortar','ranged','focusFire','web','magic','slow','silence','heal','shield'].includes(effect);
  const cell=effect==='web'?5:effect==='focusFire'?10:effect==='ranged'?11:effect==='ink'||effect==='silence'?9:effect==='heal'?3:effect==='frost'||effect==='slow'?0:['M06','B05','H02'].includes(id)?5:['M04','M05','B09','H04','W04'].includes(id)?0:['M13','E08'].includes(id)?10:['M12','E07'].includes(id)?11:['H03','W03','B10'].includes(id)?1:ranged?9:6;
  this.projectile(cell,from,to,boss?1.1:.70,ranged?.28:.16,0,cell===9?.38:0,true);
  if(!ranged)this.art(10,to,boss?.8:.46,.20,false,.12);
 }
  bossCast(kind:string,at:Vec3,source:Vec3,key?:string):void{
  if(enemyG1(key??'')?.id==='H03'){
   for(let i=0;i<(this.compact?5:8);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*1.4,.1,at.z+Math.sin(a)*1.4);this.mote(at,p,'#FFA461',.26,.48,'flame_01',false,i*.018,.5);}
  }

  if(kind==='web'){this.art(5,source,1,.32,false,0,at);this.art(5,new Vec3(at.x,.09,at.z),3.1,1.5,true,.3);return;}
  if(kind==='fireRain'){for(let i=0;i<(this.compact?4:7);i++){const a=i*2.399,r=.35+(i%4)*.33,p=new Vec3(at.x+Math.cos(a)*r,3+(i%3)*.25,at.z+Math.sin(a)*r),end=new Vec3(p.x,.3,p.z);this.art(1,p,.8,.4,false,i*.09,end);this.volume(11,end,1.5,.48,false,.38+i*.09);}return;}
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
  if(kind==='shock'){this.cast('impact',at,1.65,.62);if(['H03','W03'].includes(enemyG1(key??'')?.id??''))this.art(1,new Vec3(at.x,.4,at.z),1.6,.45);for(let i=0;i<4;i++){const a=i*Math.PI/2,p=new Vec3(at.x+Math.cos(a)*.7,.65,at.z+Math.sin(a)*.7);this.mote(p,p,'#B9F2FF',.28,.38,'star_04',false,i*.06);}return;}
  if(kind==='frost'){this.cast('frost',at,1.5,.85);return;}
  if(kind==='drain'){this.volume(9,new Vec3(at.x,.085,at.z),3.5,.55,true);return;}
  if(kind==='rally'){this.volume(4,new Vec3(source.x,.3,source.z),1.2,.45);return;}
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
  this.projectile(8,from,to,1.3,.26,0,0,true);
  for(let i=1;i<=4;i++){const p=Vec3.lerp(new Vec3(),from,to,i/4);this.art(10,p,.38,.17,false,i*.05);}
 }
 private volume(cell:number,at:Vec3,size:number,life:number,ground=false,delay=0):void{this.mote(at,at,'#FFFFFF',size,life,'approved-volumes',ground,delay,0,-cell-2);}
 private projectile(cell:number,from:Vec3,to:Vec3,size:number,life=.28,delay=0,curve=0,essential=false):void{
  this.mote(from,to,'#FFFFFF',size,life,'approved-projectiles',false,delay,curve,-cell-2,true,essential);
 }
 private mote(from:Vec3,to:Vec3,colour:string,size:number,life:number,texture='spark_04',ground=false,delay=0,curve=0,sequence?:number,directional=false,essential=false):void{
  // Software rendering is the lowest common denominator for the preview and
  // older laptops. Keep the live sprite budget tight so weather volleys do not
  // turn into a queue of translucent quads.
  if(this.motes.length>=(this.compact?64:112)){
   const decorative=this.motes.findIndex(m=>!m.directional&&m.sequence===undefined);
   const impact=decorative>=0?decorative:this.motes.findIndex(m=>!m.essential);
   // Never evict a live projectile: every valid multi-shot must remain visible.
   if(impact>=0){const [old]=this.motes.splice(impact,1);this.recycleMote(old);}
   else if(!essential)return;
  }
  const p=this.spritePool.get(texture)?.pop()??this.sprite(this.root,texture,colour);p.material.setProperty('tint',new Color(colour));p.material.setProperty('motion',new Vec4(0,0,0,0));p.node.active=delay<=0;this.motes.push({...p,texture,sequence,directional,essential,from:from.clone(),to:to.clone(),age:-delay,life,size,ground,spin:this.time*17+this.motes.length*31,curve});
 }
 attack(model:Node|undefined,role:Role|undefined,from:Vec3,to:Vec3,critical=false,delay=0):void{
  const start=model&&role?this.emitter(model,role)??from:from;
  const cell=role==='stone'?7:role==='spike'?8:role==='crystal'?0:role==='leaf'?3:role==='bubble'?4:6;
  if(role==='stone')this.volume(1,new Vec3(to.x,.6,to.z),1.25,.22);
  this.projectile(role==='stone'?6:cell,start,to,role==='stone'?1.05:.94,role==='stone'?.18:.28,delay,role==='leaf'?.18:0,true);
  this.art(role==='spike'?10:cell,to,critical?1.1:.66,.22,false,delay+.20);
 }
 impact(at:Vec3,critical=false):void{this.art(10,at,critical?.92:.44,.18);}
 cast(kind:'rock'|'frost'|'arrows'|'heal'|'summon'|'impact',at:Vec3,size=1,life=1,mastery=false):void{
  if(kind==='heal'){this.volume(3,new Vec3(at.x,.65,at.z),size*2.2,.85);if(mastery)this.status('revive',at,size);return;}
  if(kind==='summon'){this.volume(4,new Vec3(at.x,.12,at.z),size*1.7,.75,true);for(let i=0;i<3;i++){const p=new Vec3(at.x+(i-1)*.24,.1,at.z);this.mote(p,new Vec3(p.x,1.1,p.z),'#C795FF',.16,.55,'spark_04',false,i*.08);}return;}
  if(kind==='impact'){this.art(7,new Vec3(at.x,.4,at.z),size*1.25,.38);for(let i=0;i<4;i++){const a=i*2.4;this.fragment('debris',at,new Vec3(at.x+Math.cos(a)*size,.05,at.z+Math.sin(a)*size),.14,.4,a);}return;}
  if(kind==='rock'){
   this.volume(7,new Vec3(at.x,.35,at.z),size*2.3,Math.min(life,2.8));
   const count=this.compact?5:8;
   for(let i=0;i<count;i++){const a=i/count*Math.PI*2,r=size*.80,p=new Vec3(at.x+Math.cos(a)*r,.25,at.z+Math.sin(a)*r);this.fragment(i%3?'rock':'crystal',p,p,.23,Math.min(life,3),a,0,at,2.8,.22);}
   this.trail('rock',at,Math.min(life,2.8),size*.83);return;
  }
  if(kind==='arrows')this.volume(2,new Vec3(at.x,1.0,at.z),size*1.6,.35);
  if(kind==='frost')this.volume(0,new Vec3(at.x,1.25,at.z),size*2.3,Math.min(life,2.8));
  // Area skills: discrete falling volleys, open centers, no opaque weather card.
  const volleys=Math.max(1,Math.min(4,Math.ceil(life/.65))),drops=this.compact?4:6;
  for(let v=0;v<volleys;v++)for(let i=0;i<drops;i++){
   const a=i*2.399+v*.7,r=size*(.22+(i%3)*.26),to=new Vec3(at.x+Math.cos(a)*r,.12,at.z+Math.sin(a)*r),from=new Vec3(to.x+.25,2.2,to.z),delay=v*.6+i*.045;
   this.projectile(kind==='arrows'?8:0,from,to,kind==='arrows'?.9:1.08,.26,delay);
   this.art(kind==='arrows'?10:0,to,kind==='arrows'?.50:.82,.26,false,delay+.23);
  }
  this.trail(kind,at,Math.min(life,2.5),size);
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
  for(let i=this.links.length-1;i>=0;i--){const e=this.links[i];e.age+=dt;if(e.age>=e.life){this.energy.release(e.node);this.links.splice(i,1);}else this.energy.animate(e.node,e.age,Math.min(1,e.age*15,(e.life-e.age)*8));}
  for(let i=this.enemyLights.length-1;i>=0;i--){
   const e=this.enemyLights[i];
   if(!e.model.isValid||!e.node.isValid){e.material.destroy();e.accents.forEach(a=>a.material.destroy());e.ribbons.forEach(n=>this.energy.release(n));this.enemyLightByModel.delete(e.model);this.enemyLights.splice(i,1);continue;}
   if(!e.model.activeInHierarchy||!e.alive)continue;
   e.node.active=true;e.accents.forEach(a=>a.node.active=true);e.ribbons.forEach(n=>n.active=true);
   const t=this.time+e.phase,pulse=.5+.5*Math.sin(t*(e.style==='fire'?3.8:e.style==='nature'?1.4:2)),charge=e.casting?1.35:1,fade=e.controlled?.50:1;
   const size=(e.advanced?.62:e.boss?.48:.32)*(1+pulse*.18)*charge;
   e.node.setWorldScale(size,e.style==='fire'?size*1.3:size,size);e.node.setWorldRotation(this.camera.node.worldRotation);
   e.material.setProperty('motion',new Vec4(t,((e.boss?.23:.20)+pulse*.10)*fade,0,0));
   e.accents.forEach((a,j)=>{const sparkle=.5+.5*Math.sin(t*2.5-j*1.3),s=(e.boss?.22:.16)*(1+sparkle*.3)*charge;a.node.setWorldScale(s,s,s);a.node.setWorldRotation(this.camera.node.worldRotation);a.material.setProperty('motion',new Vec4(t,(.20+sparkle*.16)*fade,0,0));});
   e.ribbons.forEach((n,j)=>{const size=(e.advanced?1.2:.85)*charge;n.setWorldScale(size,size,size);n.setRotationFromEuler(35+j*60,t*22+j*130,20);this.energy.animate(n,t,(.35+pulse*.15)*fade);});
  }

  for(let i=this.warnings.length-1;i>=0;i--){const w=this.warnings[i];w.age+=dt;if(w.age>=w.life){w.nodes.forEach(n=>this.energy.release(n));this.warnings.splice(i,1);continue;}const t=w.age/w.life;w.nodes.forEach((n,j)=>{const r=w.radius*(j===0?1:Math.max(.03,Math.sqrt(t)));n.setPosition(w.point.x,.065+j*.008,w.point.z);n.setScale(r,1,r);n.setRotationFromEuler(0,j*180,0);this.energy.animate(n,w.age,j===0?.95:.38);});}
  for(let i=this.equipment.length-1;i>=0;i--){
   const e=this.equipment[i];if(!e.model.isValid){e.arcs.forEach(n=>this.energy.release(n));e.glowMaterial?.destroy();e.vines.forEach(v=>v.material.destroy());this.equipment.splice(i,1);continue;}
   const t=this.time+e.phase,pulse=.5+.5*Math.sin(t*1.65),burst=Math.pow(Math.max(0,Math.sin(t*.82)),8);
   e.arcs.forEach((n,j)=>{const size=e.rank===3?.65+pulse*.16:e.role==='stone'?(j<2?1.65:.70):e.role==='crystal'?1.20+burst*1.7:e.role==='bubble'?1.05+burst*1.6:.75+pulse*.65;n.setWorldScale(size,size,size);n.setRotationFromEuler(e.role==='crystal'?75:25+j*36,t*(e.role==='bubble'?-46:54)+j*120,15);this.energy.animate(n,t,e.rank===3?.55+pulse*.22:.25+pulse*.25+burst*.3);});
   if(e.glow?.isValid){const s=e.rank===3?.40+pulse*.12:e.role==='leaf'?.32+pulse*.18:e.role==='spike'?.18+pulse*.08:.28+burst*.38;e.glow.setWorldScale(s,e.role==='leaf'?s*1.45:s,s);e.glow.setWorldRotation(this.camera.node.worldRotation);e.glowMaterial?.setProperty('motion',new Vec4(t,e.rank===3?.62+pulse*.18:e.role==='leaf'?.48+pulse*.24:.20+pulse*.2+burst*.4,0,0));}
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
   const s=e.size*(e.directional?1:.65+Math.sin(t*Math.PI)*.40);e.node.setScale(s,s,s);
   if(e.directional){const a=this.camera.worldToScreen(e.from),b=this.camera.worldToScreen(e.to),q=Quat.fromEuler(new Quat(),0,0,Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);e.node.setWorldRotation(Quat.multiply(new Quat(),this.camera.node.worldRotation,q));}
   else if(e.ground)e.node.setRotationFromEuler(-90,0,e.sequence!==undefined&&e.sequence<0?t*18:e.spin+t*14);else e.node.setWorldRotation(this.camera.node.worldRotation);
   const layerAlpha=e.texture==='approved-volumes'?.78:e.directional?1:e.sequence===undefined?.65:e.sequence<0?.94:.80;
   e.material.setProperty('motion',new Vec4(this.time,Math.min(1,t*10,(1-t)*4)*layerAlpha,e.sequence===undefined?0:e.sequence+1,t));
  }
 }
 destroy():void{
  for(const e of this.enemyLights){if(e.node.isValid)e.node.destroy();e.material.destroy();for(const a of e.accents){if(a.node.isValid)a.node.destroy();a.material.destroy();}e.ribbons.forEach(n=>this.energy.release(n));}this.enemyLights=[];this.enemyLightByModel.clear();
  for(const f of this.fragments)f.node.destroy();this.fragments=[];for(const pool of this.fragmentPool.values())for(const n of pool)n.destroy();this.fragmentPool.clear();for(const m of this.fragmentMeshes.values())m.destroy();for(const m of this.fragmentMaterials.values())m.destroy();
  for(const pool of this.spritePool.values())for(const p of pool){p.node.destroy();p.material.destroy();}this.spritePool.clear();
  this.energy.destroy();for(const e of this.equipment){e.glowMaterial?.destroy();e.vines.forEach(v=>v.material.destroy());}
  for(const e of this.motes){e.node.destroy();e.material.destroy();}this.motes=[];this.equipment.length=0;this.quad.destroy();this.extraMeshes.forEach(m=>m.destroy());
 }
}
