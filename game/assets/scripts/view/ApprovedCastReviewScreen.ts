import {CastEquipmentEffects} from './CastEquipmentEffects';
import {Animation,AnimationClip,EffectAsset,ImageAsset,Texture2D,Camera,Color,EventTouch,instantiate,Label,Layers,Material,Mesh,MeshRenderer,Node,Prefab,primitives,resources,screen,Sprite,SpriteFrame,SkeletalAnimation,utils,Vec3,Vec4} from 'cc';
import {SculptedEnergy} from './SculptedEnergy';
import {IslandUI} from './IslandUI';
import {receiveIslandShadows} from './WorldLighting';
import {createVisualTrial,REVIEW_ROUTE,reviewPlacement} from '../core/visualTrial';
import {canCommandBattle,commandBattle,getBattleEvents,stepBattle} from '../core/battle';
import type {BattleEvent,BattleState,BattleUnit,BattleEnemy} from '../core/battle';
import type {Point,Role,SkillId} from '../core/types';
import {makeInitialSave} from '../core/game';
import {enablePrototype} from '../core/prototype';
import {enableLiving} from '../core/living';
import {createBattle} from '../core/battle';
function createCastTrial():BattleState{
 const save=makeInitialSave(1789444800000,731);enablePrototype(save);enableLiving(save);
 const active:Record<string,SkillId>={stone:'hold',spike:'piercingShot',crystal:'crystalCannon',leaf:'greatHeal',bubble:'bubbleRing'};
 const pets=(['stone','spike','crystal','leaf','bubble'] as Role[]).map(role=>{const p=Object.values(save.collection).find(p=>p.role===role)!;return {...p,skills:[active[role],'strong','swift'] as SkillId[]};});
 const b=createBattle(0,1,pets.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1})),{rulesVersion:'0.6',seed:918});const route=createVisualTrial();b.route=route.route;b.routeLength=route.routeLength;b.routes=undefined;b.routeLengths=undefined;b.spawns=route.spawns;
 b.units.forEach((u,i)=>{u.x=-3.7+i*1.9;u.z=1.0;u.placement={x:u.x,z:u.z};u.hp=u.maxHp*=4;u.attack*=1.4;});b.autoSkills=false;return b;
}

type Kind='stone'|'spike'|'crystal'|'leaf'|'bubble'|'crab';
const CAST_NAMES:Record<Kind,string>={stone:'岩盾',spike:'叶灵',crystal:'珊歌',leaf:'阳光',bubble:'潮行',crab:'礁甲蟹'};
const CAST_ROLES:Kind[]=['stone','spike','crystal','leaf','bubble'];
const CAST_ACTIVE:Record<string,SkillId>={stone:'hold',spike:'piercingShot',crystal:'crystalCannon',leaf:'greatHeal',bubble:'bubbleRing'};
type Actor={id:string;kind:Kind;root:Node;body:Node;model:Node;anim:Animation[];yaw:number;targetYaw:number;action:string;remaining:number;alive:boolean;attackIndex:number;hp:Node;bar:Node;tip?:Node;glows:Material[];ice?:Node;frozen?:boolean;walkTarget?:Point;turn?:{from:number;to:number;age:number};};
type FX={nodes:Node[];kind:'burst'|'bolt'|'rock'|'snow'|'ripple'|'slash'|'arrows'|'heal'|'summon'|'turtles';age:number;life:number;point:Vec3;target?:Vec3;owner?:string};

/** Isolated live Cocos scene. Geometry is skinned FBX; damage uses the actual combat core. */
export class ApprovedCastReviewScreen {
 private root:Node;private env:Node;private actors=new Map<string,Actor>();private prefabs=new Map<Kind,Prefab>();private mats=new Map<string,Material>();private meshes=new Map<string,Mesh>();private effects:FX[]=[];private b:BattleState=createCastTrial();private destroyed=false;private ready=false;private time=0;private mode:'pose'|'combat'='pose';private selected='';private angle=0;private close=true;private referenceOpen=false;private referenceFrames=new Map<string,SpriteFrame>();private ornamentNodes=new Map<string,Node[]>();private studio?:Node;private running=true;private slow=false;private status?:Label;private hint?:Label;private buttons:Label[]=[];private targeting=false;private dragId='';private moved=false;private input?:Node;private hitNodes=new Map<string,Node>();private pendingCast?:{id:string;point:Point;remaining:number};private crystalPhases:Node[]=[];private textures:Texture2D[]=[];private weaponWaves:Node[]=[];private oceanEffect?:EffectAsset;private guard?:Node;private guardLight?:Node;private tide:Node[]=[];private energy?:SculptedEnergy;private equipmentEffects?:CastEquipmentEffects;private energyAsset?:EffectAsset;private combo=false;private comboClock=0;
 constructor(parent:Node,private ui:IslandUI,private camera:Camera,private template:Material){this.root=this.node('三维动作验收',parent);this.env=this.node('有厚度的海岛',this.root);this.ui.clear();this.ui.label('正在载入三维骨骼资产…',0,0);this.resize();}
 async initialize():Promise<void>{
  await Promise.all(([...CAST_ROLES,'crab'] as Kind[]).map(kind=>new Promise<void>((resolve,reject)=>resources.load(`${kind==='crab'?'models-sculpted':'models-approved'}/${kind}/${kind}/${kind}`,Prefab,(error,prefab)=>{if(this.destroyed){resolve();return;}if(error||!prefab){reject(error??Error(kind+'模型未导入'));return;}prefab.addRef();this.prefabs.set(kind,prefab);resolve();}))));
  if(this.destroyed)return;this.oceanEffect=await new Promise<EffectAsset>((resolve,reject)=>resources.load('models-sculpted/review-water',EffectAsset,(err,e)=>err?reject(err):resolve(e!)));this.oceanEffect.addRef();this.energyAsset=await new Promise<EffectAsset>((resolve,reject)=>resources.load('models-approved/cast-energy',EffectAsset,(err,e)=>err?reject(err):resolve(e!)));this.energyAsset.addRef();this.energy=new SculptedEnergy(this.energyAsset);this.equipmentEffects=new CastEquipmentEffects(this.energyAsset);this.environment();this.studio=this.shape('造型对照摄影地面',this.root,'box','#EEE6D5',[0,-.02,0],[80,.12,80]);this.reset('pose');this.ready=true;this.render();
  console.info('[SCULPTED_REVIEW_READY]',JSON.stringify({assets:Array.from(this.prefabs.keys()),actors:this.actors.size,renderer:'skinned FBX, depth-tested 3D geometry',saveWrites:false}));
  console.info('[CAST_ANIMATION_BINDINGS]',JSON.stringify(Array.from(this.actors.values()).map(a=>({role:a.kind,animators:a.anim.map(v=>({node:v.node.name,clips:v.clips.map(c=>c?.name)}))}))));
 }
 private node(name:string,parent:Node):Node{const n=new Node(name);n.layer=Layers.Enum.DEFAULT;n.setParent(parent);return n;}
 private material(hex:string,glow=0,alpha=255):Material{
  const key=hex+':'+glow+':'+alpha;let m=this.mats.get(key);if(m)return m;m=new Material();m.copy(this.template,{technique:alpha<255?1:0,defines:{USE_ALBEDO_MAP:false,USE_PBR_MAP:false,USE_NORMAL_MAP:false,USE_OCCLUSION_MAP:false,USE_EMISSIVE_MAP:false,USE_VERTEX_COLOR:false}});const c=new Color(hex);c.a=alpha;m.setProperty('mainColor',c);m.setProperty('roughness',.65);m.setProperty('metallic',0);if(glow){m.setProperty('emissive',new Color(hex));m.setProperty('emissiveScale',new Vec3(glow,glow,glow));}this.mats.set(key,m);return m;
 }
 private geometry(kind:string):Mesh{let mesh=this.meshes.get(kind);if(mesh)return mesh;mesh=utils.createMesh(kind==='box'?primitives.box():kind==='cone'?primitives.cone(.5,1,{radialSegments:6}):kind==='cylinder'?primitives.cylinder(.5,.5,1,{radialSegments:24}):kind==='rock'?primitives.sphere(.5,{segments:7}):kind==='ring'?primitives.torus(.5,.012,{radialSegments:6,tubularSegments:64}):primitives.sphere(.5,{segments:16}));this.meshes.set(kind,mesh);return mesh;}
 private shape(name:string,parent:Node,kind:string,hex:string,p:readonly number[],s:readonly number[],glow=0,alpha=255):Node{const n=this.node(name,parent);n.setPosition(p[0],p[1],p[2]);n.setScale(s[0],s[1],s[2]);const r=n.addComponent(MeshRenderer);r.mesh=this.geometry(kind);r.setSharedMaterial(this.material(hex,glow,alpha),0);r.receiveShadow=alpha===255?1:0;r.shadowCastingMode=alpha===255&&!glow?MeshRenderer.ShadowCastingMode.ON:MeshRenderer.ShadowCastingMode.OFF;return n;}
 private surface(name:string,parent:Node,positions:number[],indices:number[],hex:string):Node{
  const normals=new Array<number>(positions.length).fill(0),uvs:number[]=[];
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ab=new Vec3(positions[b]-positions[a],positions[b+1]-positions[a+1],positions[b+2]-positions[a+2]),ac=new Vec3(positions[c]-positions[a],positions[c+1]-positions[a+1],positions[c+2]-positions[a+2]),n=Vec3.cross(new Vec3(),ab,ac);for(const k of [a,b,c]){normals[k]+=n.x;normals[k+1]+=n.y;normals[k+2]+=n.z;}}
  for(let i=0;i<positions.length;i+=3){const n=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=n;normals[i+1]/=n;normals[i+2]/=n;uvs.push(positions[i]/5,positions[i+2]/5);}
  const mesh=utils.createMesh({positions,indices,normals,uvs});this.meshes.set(name,mesh);const n=this.node(name,parent),r=n.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(this.material(hex),0);receiveIslandShadows(n);return n;
 }
 private texturedSurface(n:Node,kind:'grass'|'sand'):void{
  if(typeof document==='undefined')return;const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;let seed=918;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};ctx.fillStyle=kind==='grass'?'#A1B976':'#EDD8A6';ctx.fillRect(0,0,256,256);
  for(let i=0;i<2200;i++){const v=rand(),x=rand()*256,y=rand()*256,s=kind==='grass'?3+rand()*9:.4+rand()*1.7;ctx.fillStyle=kind==='grass'?(v>.5?'rgba(66,111,63,.035)':'rgba(230,230,171,.065)'):(v>.5?'rgba(120,99,61,.08)':'rgba(255,251,216,.15)');ctx.beginPath();ctx.ellipse(x,y,s,kind==='grass'?s*.5:s,rand()*6.28,0,Math.PI*2);ctx.fill();}
  const image=new ImageAsset(canvas),texture=new Texture2D();texture.image=image;texture.setWrapMode(Texture2D.WrapMode.REPEAT,Texture2D.WrapMode.REPEAT);this.textures.push(texture);const m=new Material();m.copy(this.template,{defines:{USE_ALBEDO_MAP:true,USE_PBR_MAP:false,USE_NORMAL_MAP:false,USE_VERTEX_COLOR:false}});m.setProperty('mainTexture',texture);m.setProperty('mainColor',Color.WHITE);m.setProperty('roughness',.92);m.setProperty('metallic',0);this.mats.set(kind+'-surface',m);n.getComponent(MeshRenderer)!.setSharedMaterial(m,0);
 }
 private environment():void{
  const n=72,top:number[]=[0,.10,0],tri:number[]=[];
  for(let i=0;i<n;i++){const a=i*2*Math.PI/n,r=1+.015*Math.sin(a*7)+.01*Math.cos(a*11);top.push(Math.cos(a)*8.6*r,.10,Math.sin(a)*4.55*r);}
  for(let i=0;i<n;i++)tri.push(0,(i+1)%n+1,i+1);this.surface('草地',this.env,top,tri,'A6BE79');this.texturedSurface(this.env.getChildByName('草地')!,'grass');
  const bank:number[]=[],bi:number[]=[];for(let i=0;i<n;i++){const a=i*2*Math.PI/n,r=1+.015*Math.sin(a*7)+.01*Math.cos(a*11);bank.push(Math.cos(a)*8.6*r,.08,Math.sin(a)*4.55*r,Math.cos(a)*8.95*r,-.35,Math.sin(a)*4.85*r,Math.cos(a)*8.60*r,-.88,Math.sin(a)*4.65*r);}
  for(let i=0;i<n;i++)for(let j=0;j<2;j++){const a=i*3+j,b=(i+1)%n*3+j;bi.push(a,b,a+1,b,b+1,a+1);}this.surface('真实岸壁厚度',this.env,bank,bi,'D8C3A0');
  const ocean=this.shape('海水',this.env,'box','#3299AD',[0,-.91,0],[70,.06,70]);const water=new Material();water.initialize({effectAsset:this.oceanEffect!});this.mats.set('ocean-live',water);ocean.getComponent(MeshRenderer)!.setSharedMaterial(water,0);
  for(let i=0;i<0;i++){const ring=this.shape('潮汐白沫',this.env,'ring','#BEE8E3',[0,-.39-i*.09,0],[18.1+i*.5,.6,9.8+i*.3],.12,45-i*5);this.tide.push(ring);}
  // One connected strip; joints use a miter so road corners have no gaps or overlaps.
  const road=(width:number,y:number,color:string,label:string)=>{const p:number[]=[],ii:number[]=[];REVIEW_ROUTE.forEach((v,i)=>{const prev=REVIEW_ROUTE[Math.max(0,i-1)],next=REVIEW_ROUTE[Math.min(REVIEW_ROUTE.length-1,i+1)],dx=next.x-prev.x,dz=next.z-prev.z,d=Math.hypot(dx,dz);p.push(v.x-dz/d*width,y,v.z+dx/d*width,v.x+dz/d*width,y,v.z-dx/d*width);if(i){const a=i*2;ii.push(a-2,a,a-1,a-1,a,a+1);}});this.surface(label,this.env,p,ii,color);};
  road(.72,.112,'C3A571','路肩');road(.61,.127,'EDDBAC','沙石路面');this.texturedSurface(this.env.getChildByName('沙石路面')!,'sand');
  for(let i=0;i<48;i++){const a=i*2*Math.PI/48,r=1+.03*Math.sin(i*2.1),x=Math.cos(a)*8.45*r,z=Math.sin(a)*4.4*r;if(Math.abs(z)<1.1&&Math.abs(x)>7.2)continue;const rock=this.shape('岸边圆石',this.env,'rock',i%3===0?'#B6B3A0':'#D4CEB7',[x,.17,z],[.40+(i%4)*.08,.3+(i%3)*.10,.4]);rock.setRotationFromEuler(i*7,i*47,i*3);}
  for(const [x,z,sz]of [[-6,2.9,1.2],[-6.7,-2.5,.9],[5.7,2.8,1.15],[5.9,-2.7,.8]])this.palm(x,z,sz);
  for(let i=0;i<32;i++){const x=Math.sin(i*23.17)*7.5,z=Math.cos(i*9.27)*3.8;if(Math.abs(z)<2.1&&Math.abs(x)<6)continue;for(let j=0;j<3;j++){const leaf=this.shape('岸边矮植被',this.env,'sphere',j===0?'#4D8861':'#6B9A65',[x+j*.075,.18,z],[.11,.40,.075]);leaf.setRotationFromEuler(18,0,(j-1)*35);}}
  for(const [x,z]of [[-4.5,-3.3],[4.4,3.2]])for(let j=0;j<3;j++){const gem=this.shape('岸边潮晶',this.env,'cone','#4DB5C1',[x+j*.18,.38+j*.12,z],[.25,.65+j*.22,.25],.15);gem.setRotationFromEuler(0,j*30,j*12-10);this.crystalPhases.push(gem);}
  this.guard=this.node('守护海心灯塔',this.env);this.guard.setPosition(7.1,.1,0);
  this.shape('灯塔地基',this.guard,'cylinder','#B6A583',[0,.12,0],[1.35,.24,1.35]);this.shape('灯塔底座',this.guard,'cylinder','#E6D6AF',[0,.30,0],[1.0,.22,1.0]);this.shape('灯塔主体',this.guard,'cylinder','#F5E9CA',[0,1.0,0],[.73,1.35,.73]);
  for(const y of [.40,1.52])this.shape('环形石檐',this.guard,'cylinder','#406879',[0,y,0],[.90,.12,.90]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;this.shape('灯室支柱',this.guard,'cylinder','#345C6C',[Math.cos(a)*.28,1.77,Math.sin(a)*.28],[.055,.48,.055]);}
  this.guardLight=this.shape('海心守护灯',this.guard,'sphere','#7AE0DE',[0,1.77,0],[.34,.48,.34],.85);this.shape('灯塔帽檐',this.guard,'cone','#2D637A',[0,2.12,0],[1.12,.42,1.12]);this.shape('灯塔尖顶',this.guard,'sphere','#D7B96F',[0,2.36,0],[.1,.17,.1]);
  this.shape('灯塔蓝色腰线',this.guard,'cylinder','#5B939A',[0,1.05,0],[.746,.11,.746]);this.shape('灯塔木门',this.guard,'box','#536B6B',[0,.70,.364],[.29,.51,.027]);this.shape('门把手',this.guard,'sphere','#C9B782',[.09,.7,.39],[.035,.035,.025]);for(let j=0;j<3;j++)this.shape('灯塔台阶',this.guard,'box','#DDCEAC',[0,.04+j*.06,.8-j*.14],[.64,.09+j*.06,.22]);
 }
 private palm(x:number,z:number,s:number):void{
  const root=this.node('弯干棕榈',this.env);root.setPosition(x,.10,z);root.setScale(s,s,s);
  const trunk:number[]=[],ti:number[]=[],rings=7,sides=10;
  for(let j=0;j<rings;j++){const t=j/(rings-1);for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides,r=.12-t*.05;trunk.push(Math.cos(a)*r+t*t*.22,t*1.6,Math.sin(a)*r);if(j){const k=j*sides+i,next=j*sides+(i+1)%sides;ti.push(k-sides,k,next-sides,k,next,next-sides);}}}
  this.surface('棕榈树干'+x+z,root,trunk,ti,'AE8A61');
  const p:number[]=[],ii:number[]=[];
  for(let f=0;f<8;f++){const a=f*Math.PI/4,base=p.length/3;for(let j=0;j<=9;j++){const t=j/9,r=t*(1.05+(f%3)*.10),y=1.60+Math.sin(t*Math.PI)*.27-t*.40,w=Math.sin(t*Math.PI)*.15;for(const side of [-1,0,1])p.push(.22+Math.cos(a)*r-Math.sin(a)*w*side,y+(side===0?.038:0),Math.sin(a)*r+Math.cos(a)*w*side);if(j){const k=base+j*3;for(let side=0;side<2;side++){const c=k+side;ii.push(c-3,c-2,c,c-2,c+1,c);}}}}
  this.surface('弧形棕榈叶'+x+z,root,p,ii,'70966B');
  for(let j=0;j<3;j++)this.shape('椰果',root,'sphere','#927A50',[.19+(j-1)*.07,1.53,j%2*.1],[.17,.19,.17]);
 }
 private nativeMaterials(model:Node,kind:Kind):Material[]{const glows:Material[]=[];for(const r of model.getComponentsInChildren(MeshRenderer)){r.receiveShadow=1;r.shadowCastingMode=MeshRenderer.ShadowCastingMode.ON;r.sharedMaterials.forEach((source,i)=>{if(!source)return;const key='model-'+kind+'-'+source.name;let m=this.mats.get(key);if(!m){m=new Material();m.copy(this.template,{defines:{USE_ALBEDO_MAP:false,USE_PBR_MAP:false,USE_VERTEX_COLOR:false,USE_NORMAL_MAP:false}});const c=source.getProperty('mainColor');m.setProperty('mainColor',c instanceof Color?c:Color.WHITE);m.setProperty('roughness',/aqua|violet|fire/.test(source.name)?.20:/pupil|iris|white/.test(source.name)?.16:/rock/.test(source.name)?.89:/robe|navy/.test(source.name)?.95:source.name.includes('gold')?.31:.61);m.setProperty('metallic',source.name.includes('gold')?.68:0);m.setProperty('specularIntensity',/rock|robe|navy/.test(source.name)?.22:.45);if(/aqua|violet|fire/.test(source.name)){m.setProperty('emissive',new Color(source.name.includes('violet')?'#9972DC':source.name.includes('fire')?'#FFC27B':'#209FC8')); m.setProperty('emissiveScale',new Vec3(.45,.45,.45));glows.push(m);}m.name=key;this.mats.set(key,m);}else if(/aqua|violet|fire/.test(source.name))glows.push(m);r.setSharedMaterial(m!,i);});}return glows;}
 private createActor(id:string,kind:Kind,p:Point):Actor{
  const root=this.node(id,this.root),body=this.node('骨骼角色方向',root),model=instantiate(this.prefabs.get(kind)!);model.setParent(body);model.setScale(kind==='stone'?.72:.65,kind==='stone'?.72:.65,kind==='stone'?.72:.65);for(const n of [model,...model.children])n.layer=Layers.Enum.DEFAULT;
  const anim=model.getComponentsInChildren(SkeletalAnimation).map(source=>{source.useBakedAnimation=false;source.stop();source.enabled=false;const driver=source.node.addComponent(Animation);driver.clips=source.clips;driver.playOnLoad=false;return driver;});for(const a of anim){for(const clip of a.clips)if(clip)clip.wrapMode=clip.name.endsWith('|idle')||clip.name.endsWith('|walk')||clip.name.endsWith('|skill_loop')?AnimationClip.WrapMode.Loop:AnimationClip.WrapMode.Normal;}
  const bar=this.node('生命信息',root),hp=this.shape('血量',bar,'box','#55AD82',[0,0,0],[.63,.045,.025]);bar.setPosition(0,kind==='crab'?.94:2.0,0);const a:Actor={id,kind,root,body,model,anim,yaw:22,targetYaw:22,action:'',remaining:0,alive:true,attackIndex:0,hp,bar,glows:this.nativeMaterials(model,kind)};
  if(kind!=='crab'&&kind!=='stone'){const find=(n:Node):Node|undefined=>n.name==='weapon_tip'?n:n.children.map(find).find(Boolean);const joint=find(model);if(joint){a.tip=joint;const colors:Record<string,string>={spike:'#9BC99A',crystal:'#69CFEF',leaf:'#FFD296',bubble:'#B49AE8'};const waves:Node[]=[];for(let i=0;i<(kind==='spike'?0:3);i++){const wave=this.energy!.arc(joint,colors[kind]??'#79CAE3','weapon');wave.setPosition(0,0,0);waves.push(wave);this.weaponWaves.push(wave);}this.ornamentNodes.set(id,waves);}}
  root.setPosition(p.x,.13,p.z);this.equipmentEffects?.attach(model,kind);this.actors.set(id,a);this.play(a,'arrive',1.1);return a;
 }
 private play(a:Actor,action:string,duration=0):void{if(a.action===action&&duration===0)return;a.action=action;a.remaining=duration;for(const anim of a.anim){const clip=anim.clips.find(c=>c?.name.endsWith('|'+action))??anim.clips.find(c=>c?.name===action);if(!clip)continue;anim.crossFade(clip.name,.13);const state=anim.getState(clip.name);if(state)state.speed=(duration>0?clip.duration/duration:action==='walk'?1.4:1)*(this.slow?.25:1);}}
 private reset(mode:'pose'|'combat'):void{this.equipmentEffects?.clear();this.ornamentNodes.clear();this.combo=false;this.comboClock=0;this.weaponWaves.forEach(n=>this.energy?.release(n));for(const a of this.actors.values())a.root.destroy();this.actors.clear();this.weaponWaves=[];this.effects.forEach(e=>e.nodes.forEach(n=>this.energy!.release(n)));this.effects=[];this.mode=mode;this.env.active=mode==='combat';if(this.studio)this.studio.active=mode==='pose';this.b=createCastTrial();this.pendingCast=undefined;this.targeting=false;for(const u of this.b.units)this.createActor(u.id,u.role as Kind,u);this.selected=this.b.units[0].id;this.running=true;}
 resize():void{const size=screen.windowSize,aspect=size.width/Math.max(1,size.height);this.camera.projection=Camera.ProjectionType.ORTHO;
  if(this.mode==='pose'){const focus=this.close?(this.actors.get(this.selected)?.root.position??new Vec3()):new Vec3(0,0,1);const a=this.angle*Math.PI/180;this.camera.orthoHeight=this.close?Math.max(1.75,2.8/aspect):Math.max(3.6,6.3/aspect);this.camera.node.setPosition(focus.x+Math.sin(a)*10,2.6,focus.z+Math.cos(a)*10);this.camera.node.lookAt(new Vec3(focus.x,1.11,focus.z));this.camera.clearColor=new Color('#E8E2D8');}
  else{this.camera.orthoHeight=Math.max(5.4,9.5/aspect);this.camera.node.setPosition(0,15,17);this.camera.node.lookAt(new Vec3(0,.25,0));this.camera.clearColor=new Color('#4FABB7');}
 }
 private showReference():void{const a=this.actors.get(this.selected);if(!a||a.kind==='crab')return;this.referenceOpen=true;this.running=false;for(const ac of this.actors.values())ac.anim.forEach(v=>v.pause());this.ui.clear();this.ui.panel(0,0,1240,680,this.ui.root,'#F9F5EC',255,20);this.ui.label('已确认三视图 · '+CAST_NAMES[a.kind],0,308,25);this.ui.button('回到实际模型',505,308,190,42,()=>{this.referenceOpen=false;this.running=true;this.actors.forEach(v=>v.anim.forEach(n=>n.resume()));this.render();},{surface:'paper',size:20});
  const holder=this.ui.group('已确认原画参考',0,-15,this.ui.root,900,600);const show=(sf:SpriteFrame)=>{if(!holder.isValid)return;const sp=holder.addComponent(Sprite);sp.sizeMode=Sprite.SizeMode.CUSTOM;sp.spriteFrame=sf;};const sf=this.referenceFrames.get(a.kind);if(sf)show(sf);else resources.load('models-approved/references/'+a.kind,ImageAsset,(err,res)=>{if(err||!res){if(holder.isValid)this.ui.label('原画暂未载入',0,0);return;}if(this.destroyed)return;const texture=new Texture2D();texture.image=res;this.textures.push(texture);const frame=new SpriteFrame();frame.texture=texture;frame.addRef();this.referenceFrames.set(a.kind,frame);show(frame);});
 }
 private render():void{
  this.ui.clear();this.hitNodes.clear();this.buttons=[];const root=this.ui.root;const ground=this.ui.group('三维角色交互',0,0,root,3000,1500);this.input=ground;
  ground.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{if(this.dragId){this.drop(this.dragId,this.ground(e));this.dragId='';}});
  this.ui.panel(-100,324,1000,48,root,'#FFF9EE',245,14);this.status=this.ui.label('五龟三维制作 · 已确认三视图 v2',-110,324,23,'#173F51',root,970,43);
  this.ui.button('返回游戏',520,324,160,48,()=>{if(typeof location!=='undefined')location.href='http://127.0.0.1:7473/';},{size:22,surface:'paper'});
  CAST_ROLES.forEach((kind,i)=>this.ui.button(CAST_NAMES[kind],-400+i*200,267,180,42,()=>{const a=Array.from(this.actors.values()).find(a=>a.kind===kind);if(a){this.selected=a.id;this.close=true;this.resize();this.render();}},{size:22,surface:'paper',selected:this.actors.get(this.selected)?.kind===kind}));
  this.ui.panel(0,-316,1220,68,root,'#FFF9EE',245,16);
  const items:[string,()=>void][]=[['原画对照',()=>this.showReference()],[this.close?'五龟全景':'单只近看',()=>{this.close=!this.close;this.resize();this.render();}],['转身 90°',()=>this.turn(90)],['转身 180°',()=>this.turn(180)],[this.combo?'停止连招':'连续普攻',()=>{this.combo=!this.combo;this.comboClock=0;this.render();}],['主动技能',()=>{const a=this.actors.get(this.selected);if(a)this.cast(a.id,{x:a.root.position.x,z:a.root.position.z+.9});}],['专精演示',()=>this.mastery()]];
  items.forEach(([label,fn],i)=>this.ui.button(label,-519+i*173,-316,161,44,fn,{size:21,surface:'paper'}));
  this.ui.button('镜头 ↶',-540,204,125,40,()=>{this.angle-=30;this.resize();},{size:20,surface:'paper'});this.ui.button('镜头 ↷',-403,204,125,40,()=>{this.angle+=30;this.resize();},{size:20,surface:'paper'});
  this.ui.button(this.slow?'恢复原速':'¼ 速慢放',398,204,135,40,()=>{this.slow=!this.slow;for(const a of this.actors.values())for(const anim of a.anim){const clip=anim.clips.find(c=>c?.name.endsWith('|'+a.action));if(clip){const state=anim.getState(clip.name);if(state)state.speed*=this.slow?.25:4;}}this.render();},{size:20,surface:'paper'});
  this.ui.button(this.running?'暂停':'继续',540,204,125,40,()=>{this.running=!this.running;this.actors.forEach(a=>a.anim.forEach(v=>this.running?v.resume():v.pause()));this.render();},{size:20,surface:'paper'});
  this.hint=this.ui.label('实际骨骼模型 · 造型 / 转身 / 普攻 / 施法分开核对',0,-259,20,'#426270',root,1100,32);
  this.ui.button(this.mode==='pose'?'进入战场':'回摄影棚',-525,-248,165,35,()=>{this.close=false;this.reset(this.mode==='pose'?'combat':'pose');this.resize();this.render();},{size:18,surface:'paper'});
  for(const a of this.actors.values())if(a.kind!=='crab')this.hit(a);this.resize();
 }
 private mastery():void{const a=this.actors.get(this.selected);if(!a)return;this.cast(a.id,{x:a.root.position.x,z:a.root.position.z+.8});const p=a.root.position;if(a.kind==='stone'){for(const s of [-1,1])this.fx('rock',new Vec3(p.x+s*1.35,.13,p.z),2.4,a.id);}else if(a.kind==='crystal'){this.fx('snow',new Vec3(p.x,.13,p.z+.8),6,a.id);}else if(a.kind==='spike'){this.fx('arrows',new Vec3(p.x,.13,p.z+.8),3,a.id);}else if(a.kind==='leaf'){this.fx('heal',new Vec3(p.x,.13,p.z),4,a.id);}else this.fx('summon',new Vec3(p.x,.13,p.z+.8),5,a.id);}
 private hit(a:Actor):void{if(this.hitNodes.has(a.id))return;const n=this.ui.group('选择三维角色 '+a.id,0,0,this.ui.root,82,112);this.hitNodes.set(a.id,n);let start:Vec3|undefined;
  n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{const p=e.getLocation();start=new Vec3(p.x,p.y);this.selected=a.id;this.moved=false;});
  n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!start||this.mode==='combat'&&a.kind==='crab')return;const p=e.getLocation();if(Math.hypot(p.x-start.x,p.y-start.y)>6){this.moved=true;this.dragId=a.id;const point=this.ground(e);this.hint!.string=reviewPlacement(point,[])??'松手后移动到此处';}});
  const finish=(e:EventTouch)=>{if(!start)return;start=undefined;if(this.moved)this.drop(a.id,this.ground(e));else{this.selected=a.id;this.hint!.string=CAST_NAMES[a.kind]+' · 已选中';if(this.close)this.resize();}this.dragId='';};n.on(Node.EventType.TOUCH_END,finish);n.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.type===Node.EventType.TOUCH_END)finish(e);else {start=undefined;this.dragId='';}});
 }
 private ground(e:EventTouch):Point{const p=e.getLocation(),ray=this.camera.screenPointToRay(p.x,p.y),t=(.13-ray.o.y)/ray.d.y;return {x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};}
 private drop(id:string,p:Point):void{const a=this.actors.get(id);if(!a)return;const other=Array.from(this.actors.values()).find(o=>o!==a&&o.kind!=='crab'&&Math.hypot(o.root.position.x-p.x,o.root.position.z-p.z)<.75);const goal=other?{x:other.root.position.x,z:other.root.position.z}:p;const issue=reviewPlacement(goal,Array.from(this.actors.values()).filter(o=>o!==a&&o!==other&&o.kind!=='crab').map(o=>({x:o.root.position.x,z:o.root.position.z})));if(issue){this.hint!.string=issue;return;}const size=screen.windowSize,scale=Math.min(size.width/1280,size.height/720),head=this.camera.worldToScreen(new Vec3(goal.x,a.kind==='crab'?1:1.9,goal.z)),foot=this.camera.worldToScreen(new Vec3(goal.x,.13,goal.z));if((head.y-size.height/2)/scale>212||(foot.y-size.height/2)/scale<-222||Math.abs((head.x-size.width/2)/scale)>566){this.hint!.string='此处会被操作栏遮挡，请放在地图可操作区域';return;}if(other)other.walkTarget={x:a.root.position.x,z:a.root.position.z};a.walkTarget=goal;this.hint!.string='伙伴转身并移动到新位置';}
 private turn(degrees:number):void{this.combo=false;const a=this.actors.get(this.selected);if(!a)return;if(this.mode==='combat'){this.hint!.string='转身展示请切换至动作展示';return;}a.turn={from:a.yaw,to:a.yaw+degrees,age:0};this.play(a,degrees>0?'turn_right':'turn_left',.85);this.render();}
 private strike(a:Actor):void{const name=a.kind==='crab'?'attack':['attack','attack_alt','attack_heavy'][a.attackIndex++%3];this.play(a,name,.62);}
 private demoAttack():void{const a=this.actors.get(this.selected);if(!a)return;if(this.mode==='combat')return;this.strike(a);const p=a.root.position,r=a.yaw*Math.PI/180,target=new Vec3(p.x+Math.sin(r)*1.1,.65,p.z+Math.cos(r)*1.1);if(a.kind!=='stone'&&a.kind!=='crab'){this.effects.push({nodes:[],kind:'bolt',age:-.22,life:.30,point:(a.tip?.worldPosition??new Vec3(p.x,1.4,p.z)).clone(),owner:a.id,target});}else this.fx('slash',new Vec3(p.x,.65,p.z),.38,a.kind,target);this.effects.push({nodes:[],kind:'burst',age:-.30,life:.7,point:target,owner:a.kind});}
 private cast(id:string,p:Point):void{const a=this.actors.get(id);if(!a||a.kind==='crab'||!this.running)return;this.selected=id;const wasCombo=this.combo;this.combo=false;if(wasCombo)this.render();if(this.mode==='pose'){this.play(a,'skill',3);const kind=a.kind==='stone'?'rock':a.kind==='crystal'?'snow':a.kind==='spike'?'arrows':a.kind==='leaf'?'heal':'turtles';this.effects.push({nodes:[],kind,age:-.75,life:4,point:new Vec3(a.kind==='stone'?a.root.position.x:p.x,.13,a.kind==='stone'?a.root.position.z:p.z),owner:a.id});return;}const u=this.b.units.find(u=>u.id===id)!;const skill=CAST_ACTIVE[a.kind];if(!u.alive||this.b.tick<(u.cooldowns[skill]??0)){this.hint!.string='技能尚在冷却或伙伴已倒下';return;}if(a.kind==='crystal'&&Math.hypot(u.x-p.x,u.z-p.z)>u.range){this.hint!.string='目标超出珊歌攻击范围';return;}if(this.pendingCast){this.hint!.string='伙伴正在抬手施法，请稍候';return;}if(!canCommandBattle(this.b,{type:'cast',unitId:id,skillId:skill,...(a.kind==='crystal'||a.kind==='bubble'?{point:p}:{})})){this.hint!.string='范围内没有合法目标，本次未消耗冷却';return;}this.play(a,a.kind==='stone'?'skill_start':'skill',a.kind==='stone'?.28:1.2);this.pendingCast={id,point:p,remaining:.28};}
 private fx(kind:FX['kind'],point:Vec3,life:number,owner?:string,target?:Vec3):void{
  const role=owner?this.actors.get(owner)?.kind:undefined;const tint=role==='spike'?'#ADD299':role==='leaf'?'#FFD38C':role==='bubble'?'#CBB0F2':'#7ACCE9';const f:FX={nodes:[],kind,point:point.clone(),age:0,life,owner,target:target?.clone()};
  if(kind==='rock'&&this.mode==='combat'){f.age=.32;f.life+=.32;}
  const count=kind==='arrows'?15:kind==='heal'?18:kind==='summon'||kind==='turtles'?2:kind==='rock'?14:kind==='snow'?36:kind==='burst'?9:kind==='slash'?0:kind==='bolt'?4:3;
  for(let i=0;i<count;i++){if(kind==='summon'){const golem=this.node('异时空石像',this.root);for(const [name,x,y,z,sx,sy,sz]of [['躯干',0,.48,0,.62,.68,.4],['头',0,.94,0,.40,.36,.36],['左臂',-.45,.53,0,.25,.72,.28],['右臂',.45,.53,0,.25,.72,.28],['左腿',-.19,.12,0,.24,.36,.28],['右腿',.19,.12,0,.24,.36,.28]] as [string,number,number,number,number,number,number][]){this.shape(name,golem,'rock','#69667B',[x,y,z],[sx,sy,sz]);}this.shape('核心',golem,'cone','#B69CEF',[0,.59,.23],[.16,.25,.1],.8);f.nodes.push(golem);continue;}if(kind==='turtles'){const small=instantiate(this.prefabs.get('bubble')!);small.setParent(this.root);small.layer=Layers.Enum.DEFAULT;this.nativeMaterials(small,'bubble');for(const anim of small.getComponentsInChildren(SkeletalAnimation)){anim.useBakedAnimation=false;const c=anim.clips.find(v=>v?.name.endsWith('|idle'));if(c){c.wrapMode=AnimationClip.WrapMode.Loop;anim.play(c.name);}}f.nodes.push(small);continue;}const n=this.shape('三维技能 '+kind,this.root,kind==='arrows'?'cone':kind==='rock'?'rock':kind==='snow'||kind==='burst'?'cone':'sphere',kind==='heal'?'#FFD992':kind==='arrows'?'#95C7A1':kind==='rock'?(i%4?'#64717C':'#399ABF'):kind==='burst'?(owner==='stone'?'#D3B681':'#B9E9F3'):(i%3?tint:'#E3F8FB'),[point.x,point.y,point.z],[.1,.1,.1],kind==='rock'?(i%4?0:.25):.55,kind==='rock'?255:175);f.nodes.push(n);}
  if(kind==='rock'||kind==='snow'||kind==='slash'||kind==='heal'||kind==='summon'){
   const arcs=kind==='slash'?1:kind==='rock'?4:3;
   for(let j=0;j<arcs;j++){const n=this.energy!.arc(this.root,kind==='heal'?'#FFDCA1':kind==='summon'?'#C4AAF2':kind==='rock'?'#329EC6':kind==='slash'?'#C9DDE4':'#74C5EB',kind==='snow'?'frost':'wind');n.name='stream-'+j;f.nodes.push(n);}
   if(kind!=='slash')for(let j=0;j<2;j++){const n=this.energy!.arc(this.root,kind==='rock'?'#CFB991':'#91D9F1','ground');n.name='ground-flash-'+j;f.nodes.push(n);}
  }
  this.effects.push(f);
 }
 private events(events:BattleEvent[]):void{for(const e of events){const a=e.sourceId?this.actors.get(e.sourceId):undefined,target=e.targetId?this.actors.get(e.targetId):undefined;
  if(e.type==='attack'&&a){if(target){const v=target.root.position,p=a.root.position;a.targetYaw=Math.atan2(v.x-p.x,v.z-p.z)*180/Math.PI;}if((e.effect==='windup'||a.kind==='crab')&&!this.effects.some(f=>f.kind==='rock'&&f.owner===a.id))this.strike(a);if(e.effect==='stone'&&target)this.fx('slash',new Vec3(a.root.position.x,.65,a.root.position.z),.28,'stone',target.root.position);if(a.kind!=='stone'&&a.kind!=='crab'&&e.effect!=='windup'){const p=a.tip?.worldPosition??new Vec3(a.root.position.x,1.4,a.root.position.z);this.fx('bolt',p,.16,a.id,new Vec3(e.x??0,.55,e.z??0));}}
  if(e.type==='damage'&&target){this.fx('burst',new Vec3(target.root.position.x,.52,target.root.position.z),.26,a?.kind);if(target.kind==='crab'&&target.remaining<.1)this.play(target,'hit',.23);}
  if(e.type==='skill'&&a){if(e.skillId==='hold'&&!e.effect){this.fx('rock',a.root.position,4,a.id);}if(e.skillId==='crystalCannon'&&!e.effect){this.fx('snow',new Vec3(e.x??0,.15,e.z??0),5,a.id);}}
  if(e.type==='skill'&&a&&!e.effect){if(e.skillId==='piercingShot')this.fx('arrows',new Vec3(e.x??a.root.position.x,.13,e.z??a.root.position.z+1),2.5,a.id);if(e.skillId==='greatHeal')this.fx('heal',a.root.position,3,a.id);if(e.skillId==='bubbleRing')this.fx('turtles',new Vec3(e.x??a.root.position.x,.13,e.z??a.root.position.z+1),4,a.id);}
  if(e.type==='skill'&&e.effect==='rockSplit')this.fx('burst',new Vec3(e.x??0,.25,e.z??0),.5,'stone');if(e.type==='skill'&&e.effect==='shatter')this.fx('burst',new Vec3(e.x??0,.65,e.z??0),.55,'crystal');
  if(e.type==='leak'&&this.guardLight){this.fx('burst',this.guardLight.worldPosition,.6,'stone');}
 }}
 update(dt:number):void{
  if(!this.ready||this.destroyed||!this.running)return;dt=Math.min(dt,.05)*(this.slow?.25:1);this.time+=dt;this.equipmentEffects?.update(this.time);if(this.mode==='pose'&&this.combo){this.comboClock-=dt;if(this.comboClock<=0){this.demoAttack();this.comboClock=1.0;}}
  if(this.mode==='combat'){
   if(this.pendingCast){this.pendingCast.remaining-=dt;if(this.pendingCast.remaining<=0){const cast=this.pendingCast;this.pendingCast=undefined;const u=this.b.units.find(u=>u.id===cast.id)!;if(!commandBattle(this.b,{type:'cast',unitId:u.id,skillId:CAST_ACTIVE[u.role],...(u.role==='crystal'||u.role==='bubble'?{point:cast.point}:{})}))this.hint!.string='目标已离开技能范围，本次未消耗冷却';}}
   stepBattle(this.b,dt);for(const e of this.b.enemies)if(e.alive&&!this.actors.has(e.id))this.createActor(e.id,'crab',e);this.events(getBattleEvents(this.b));
  }
  for(const a of this.actors.values()){
   if(this.mode==='pose')a.root.active=!this.close||a.id===this.selected;
   a.remaining=Math.max(0,a.remaining-dt);const state=this.mode==='combat'?(a.kind==='crab'?this.b.enemies.find(e=>e.id===a.id):this.b.units.find(u=>u.id===a.id)):undefined;
   if(state&&a.kind==='crab'){const frozen=state.statuses.some(v=>v.kind==='stun'&&v.untilTick>this.b.tick);if(frozen&&!a.ice)a.ice=this.shape('冻结冰壳',a.root,'cone','#B5E8E8',[0,.44,0],[1.36,1.0,1.36],.10,100);if(a.ice)a.ice.active=frozen;if(frozen!==!!a.frozen){for(const anim of a.anim)frozen?anim.pause():anim.resume();a.frozen=frozen;}}
   if(state&&!state.alive&&a.alive){a.alive=false;this.play(a,'death',1.2);}if(!a.alive){if(a.remaining===0)a.root.active=false;continue;}
   const p=a.root.position;
   if(a.walkTarget){const dx=a.walkTarget.x-p.x,dz=a.walkTarget.z-p.z,d=Math.hypot(dx,dz);a.targetYaw=Math.atan2(dx,dz)*180/Math.PI;if(d>.04){const step=Math.min(d,dt*.85);a.root.setPosition(p.x+dx/d*step,.13,p.z+dz/d*step);this.play(a,'walk');}else{a.walkTarget=undefined;this.play(a,'arrive',.6);}if(state&&a.kind!=='crab'){state.x=a.root.position.x;state.z=a.root.position.z;(state as BattleUnit).placement={x:state.x,z:state.z};state.actionUntilTick=this.b.tick+2;delete (state as BattleUnit).pendingAttack;}}
   else if(state&&a.kind==='crab'){const dx=state.x-p.x,dz=state.z-p.z;if(Math.hypot(dx,dz)>.001){a.targetYaw=Math.atan2(dx,dz)*180/Math.PI;a.root.setPosition(state.x,.13,state.z);if(!a.remaining)this.play(a,'walk');}else if(!a.remaining)this.play(a,'idle');}
   else if(a.remaining===0&&!this.effects.some(f=>f.kind==='rock'&&f.owner===a.id))this.play(a,'idle');
   if(a.turn){a.turn.age+=dt;const t=Math.min(1,a.turn.age/.85),s=t*t*(3-2*t);a.yaw=a.turn.from+(a.turn.to-a.turn.from)*s;a.targetYaw=a.yaw;if(t===1)a.turn=undefined;}else a.yaw+=((a.targetYaw-a.yaw+540)%360-180)*Math.min(1,dt*8);
   const storm=this.effects.find(f=>f.kind==='rock'&&f.owner===a.id);
   if(storm){const action=storm.age<.32?'skill_start':storm.age>storm.life-.42?'skill_end':'skill_loop';if(a.action!==action)this.play(a,action,action==='skill_start'?.32:action==='skill_end'?.42:0);}
   const phase=storm?Math.max(0,Math.min(1,(storm.age-.30)/(storm.life-.65))):0;const spin=storm?1080*(phase-Math.sin(phase*2*Math.PI)/(2*Math.PI)):0;a.body.setRotationFromEuler(0,a.yaw+spin,0);
   a.bar.setWorldRotation(this.camera.node.worldRotation);a.bar.active=this.mode==='combat';if(state)a.hp.setScale(Math.max(0,state.hp/state.maxHp)*.63,.045,.025);
   a.glows.forEach((m,i)=>{const vein=m.name.includes('Edge'),pulse=Math.pow(.5+.5*Math.sin(this.time*3.2-i*1.7),vein?4:1),g=vein?.16+pulse*.9:.20+pulse*.22;m.setProperty('emissiveScale',new Vec3(g,g,g));});
   const hit=this.hitNodes.get(a.id);if(hit){const q=this.camera.worldToScreen(new Vec3(a.root.position.x,a.kind==='crab'?.45:.9,a.root.position.z)),size=screen.windowSize,s=Math.min(size.width/1280,size.height/720);hit.setPosition((q.x-size.width/2)/s,(q.y-size.height/2)/s);hit.active=a.root.active;}
  }
  for(let j=this.effects.length-1;j>=0;j--){const f=this.effects[j];f.age+=dt;if(f.age<0)continue;if(!f.nodes.length){this.fx(f.kind,f.point,f.kind==='burst'?.35:f.life,f.owner,f.target);f.age=f.life;}if(f.age>=f.life){f.nodes.forEach(n=>this.energy!.release(n));this.effects.splice(j,1);continue;}const t=f.age/f.life,fade=Math.min(1,f.age*5,(f.life-f.age)*3);f.nodes.forEach((n,i)=>{const a=f.age*(f.kind==='rock'?(2+Math.min(f.age*4,6)):2.5)+i*2.399;if(n.name.startsWith('stream-')){const j=Number(n.name.slice(-1)),rock=f.kind==='rock',slash=f.kind==='slash';const radius=slash?1.05:rock?1.12+j*.21:1.45+j*.16;
     n.setPosition(f.point.x,f.point.y+(slash?.07:rock?.17+j*.22:.3+j*.44),f.point.z);
     const direction=slash&&f.target?Math.atan2(f.target.x-f.point.x,f.target.z-f.point.z)*180/Math.PI-135:0;
     n.setRotationFromEuler(slash?-15:j*5-8,direction+f.age*(slash?360:rock?430:95)+j*133,slash?18:j*7-6);n.setScale(radius,radius,radius);
     this.energy!.animate(n,f.age,fade*(slash?.8:rock?.55:.42));return;
    }
    if(n.name.startsWith('ground-flash')){const j=Number(n.name.slice(-1)),rock=f.kind==='rock',pulse=rock?Math.max(0,1-f.age/ .65):fade*.24;const size=rock?.4+Math.min(f.age/.65,1)*1.6:1.6+j*.10;n.setPosition(f.point.x,.145+j*.005,f.point.z);n.setScale(size,1,size);n.setRotationFromEuler(0,120*j+f.age*16,0);this.energy!.animate(n,f.age,pulse*.7);return;}
   if(f.kind==='rock'){const r=1.03+(i%3)*.30+Math.sin(f.age*3+i)*.10;n.setPosition(f.point.x+Math.cos(a)*r,f.point.y+.12+Math.min(1,f.age*2)*((i%4)*.22+.25)+Math.sin(a)*.09,f.point.z+Math.sin(a)*r);const s=(i%3===0?.38:.26)*fade;n.setScale(s,s*1.25,s);n.setRotationFromEuler(a*73,a*44,a*27);}
   if(f.kind==='arrows'){const r=Math.sqrt((i+.5)/15)*1.6,a=i*2.399,fall=(f.age*2+i*.11)%1;n.setPosition(f.point.x+Math.cos(a)*r,.15+(1-fall)*3.1,f.point.z+Math.sin(a)*r);n.setScale(.025,.65,.025);n.setRotationFromEuler(0,0,8);}
   if(f.kind==='heal'){const r=.35+(i%5)*.19,a=f.age*.75+i*2.399;n.setPosition(f.point.x+Math.cos(a)*r,.15+((f.age*.8+i*.17)%2.4),f.point.z+Math.sin(a)*r);const q=.065*fade;n.setScale(q,q*1.5,q);}
   if(f.kind==='turtles'){n.setPosition(f.point.x+(i?1:-1)*.55,.13,f.point.z);n.setScale(.27*fade,.27*fade,.27*fade);n.setRotationFromEuler(0,25+i*20,0);}
   if(f.kind==='summon'){const down=Math.max(0,1-f.age/.35),h=.72+down*down*4;n.setPosition(f.point.x+(i?1:-1)*.8,h,f.point.z);n.setScale(.66*fade,1.4*fade,.60*fade);n.setRotationFromEuler(0,i*80,0);}
   if(f.kind==='snow'){const r=Math.sqrt((i+.5)/f.nodes.length)*1.8,y=2.5-((f.age*2.5+i*.27)%2.4);n.setPosition(f.point.x+Math.cos(a)*r,f.point.y+y,f.point.z+Math.sin(a)*r);n.setScale(.045*fade,.22*fade,.045*fade);n.setRotationFromEuler(15,a*25,25);}
   if(f.kind==='burst'){const r=f.age*3.6,s=(1-t)*.045;n.setPosition(f.point.x+Math.cos(a)*r,f.point.y+Math.sin(i*2.6)*r+.15,f.point.z+Math.sin(a)*r);n.setScale(s,(1-t)*.21,s);n.setRotationFromEuler(i*43,a*29,i*63);}
   if(f.kind==='bolt'&&f.target){const q=Math.max(0,t-i*.09),pos=Vec3.lerp(new Vec3(),f.point,f.target,q);n.setPosition(pos);n.lookAt(f.target);const s=(.09-i*.02)*Math.min(1,(1-t)*8);n.setScale(s,s,.34-i*.075);}
  });}
  this.ornamentNodes.forEach((nodes,id)=>{const a=this.actors.get(id);if(!a)return;nodes.forEach((n,i)=>{const pulse=.5+.5*Math.sin(this.time*(a.kind==='leaf'?1.6:2.2)-i*1.3);n.setRotationFromEuler(a.kind==='crystal'?90:35,this.time*(a.kind==='crystal'?75:25)+i*120,15);const s=a.kind==='leaf'?.9+pulse*.65:a.kind==='bubble'?.5+Math.pow(pulse,4)*1.3:.7+pulse*.65;n.setWorldScale(s,s,s);this.energy!.animate(n,this.time,.15+pulse*(a.kind==='bubble'?.7:.4));});});this.crystalPhases.forEach((n,i)=>{n.setScale(.25,.65+(i%3)*.22,.25);});this.tide.forEach((n,i)=>n.setScale(18.1+i*.5+Math.sin(this.time*.6+i)*.18,.6,9.8+i*.3+Math.sin(this.time*.6+i)*.10));if(this.guardLight)this.guardLight.setScale(.32+.018*Math.sin(this.time*2),.46+.025*Math.sin(this.time*2),.32);
  if(this.status)this.status.string=this.mode==='pose'?'三维制作候选 · '+CAST_NAMES[this.actors.get(this.selected)?.kind??'stone']+' · 三视图 v2':`三维实战 · 守护 ${this.b.coreHealth}/20　 击败 ${this.b.kills}　 ${Math.floor(this.b.elapsed)} 秒`;
  if(this.mode==='combat'&&this.b.status!=='fighting'&&this.hint)this.hint.string=(this.b.status==='won'?'守护成功':'灯塔失守')+' · 回摄影棚再进入可重试，此处不产生奖励';
 }
 destroy():void{if(this.destroyed)return;this.destroyed=true;this.root.destroy();this.prefabs.forEach(p=>p.decRef());this.mats.forEach(m=>m.destroy());this.meshes.forEach(m=>m.destroy());this.textures.forEach(t=>t.destroy());this.oceanEffect?.decRef();this.equipmentEffects?.destroy();this.energy?.destroy();this.energyAsset?.decRef();this.referenceFrames.forEach(f=>f.decRef());}
}












