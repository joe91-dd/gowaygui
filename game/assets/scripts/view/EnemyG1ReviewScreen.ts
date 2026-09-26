import {AnimationClip,Camera,Color,instantiate,Material,Mesh,MeshRenderer,Node,Prefab,primitives,Quat,resources,SkeletalAnimation,utils,Vec3} from 'cc';
import {ENEMY_G1,ENEMY_G1_GRADES} from '../core/enemyG1Catalog';
import {RAID_BOSSES} from '../core/bossCatalog';
import {prepareBattleRig} from './BattleRigAnimation';
import {FaunaRadiance} from './FaunaRadiance';
import {TurtleMaterialAdapter} from './TurtleMaterialAdapter';
import {IslandUI} from './IslandUI';

/** Local asset inspection uses the same imported prefabs, GPU animation and materials as combat. */
export class EnemyG1ReviewScreen {
 private root:Node;private model?:Node;private prefab?:Prefab;private animations:SkeletalAnimation[]=[];
 private index=0;private grade=0;private action='idle';private yaw=0;private turn=false;private generation=0;private destroyed=false;
 private radiance=new FaunaRadiance();private floor:Mesh;private material:Material;private status?:HTMLDivElement;
 private materialAdapter:TurtleMaterialAdapter;
 private controls?:HTMLDivElement;private heading?:HTMLHeadingElement;private buttons=new Map<string,HTMLButtonElement>();
 private baseRotation=new Quat();private loop=true;private info='';private readoutClock=0;
 constructor(parent:Node,private ui:IslandUI,private camera:Camera,template:Material){
  this.root=new Node('G1怪物验收');this.root.setParent(parent);
  this.materialAdapter=new TurtleMaterialAdapter(template,['G1_']);
  const floor=new Node('摄影地面');floor.setParent(this.root);floor.setPosition(0,-.035,0);floor.setScale(30,.05,30);
  this.floor=utils.createMesh(primitives.box());this.material=new Material();this.material.copy(template,{defines:{USE_ALBEDO_MAP:false,USE_PBR_MAP:false,USE_NORMAL_MAP:false,USE_VERTEX_COLOR:false}});
  this.material.setProperty('mainColor',new Color('#CFDDD6'));this.material.setProperty('roughness',.9);
  const renderer=floor.addComponent(MeshRenderer);renderer.mesh=this.floor;renderer.setSharedMaterial(this.material,0);
  if(typeof document!=='undefined'){this.status=document.createElement('div');this.status.setAttribute('role','status');this.status.style.cssText='position:fixed;bottom:4px;right:8px;background:#203d42;color:white;font:12px sans-serif;padding:5px;pointer-events:none;max-width:80vw';document.body.appendChild(this.status);}
  this.createControls();this.resize();
 }
 async initialize():Promise<void>{const id=new URLSearchParams(location.search).get('enemy');this.index=Math.max(0,ENEMY_G1.findIndex(x=>x.id===id));await this.select(this.index);}
 private async select(index:number):Promise<void>{
  const generation=++this.generation;this.index=index;const def=ENEMY_G1[index];this.ui.clear();this.ui.text('正在载入 '+def.name,0,170,26,'#214750');
  if(this.model){this.model.active=false;this.materialAdapter.release(this.model);this.model.destroy();}this.model=undefined;this.animations=[];this.radiance.destroy();this.radiance=new FaunaRadiance();this.prefab?.decRef();this.prefab=undefined;
  if(this.status)this.status.textContent=def.id+' 载入中';
  try{
   const prefab=await new Promise<Prefab>((resolve,reject)=>resources.load(def.model,Prefab,(err,p)=>err||!p?reject(err??Error('Missing prefab')):resolve(p)));
   if(this.destroyed||generation!==this.generation)return;
   prefab.addRef();this.prefab=prefab;const model=instantiate(prefab);model.setParent(this.root);this.model=model;this.baseRotation.set(model.rotation);this.materialAdapter.apply(model);this.animations=prepareBattleRig(model);this.yaw=0;
   this.grade=0;this.action='idle';this.play('idle');this.tint();this.render();
  }catch(error){if(this.destroyed||generation!==this.generation)return;this.render();if(this.status)this.status.textContent=def.id+' 加载失败：'+String(error);}
 }
 private play(action:string):void{
  this.action=action;const found:string[]=[];
  for(const animation of this.animations){const clip=animation.clips.find(c=>c&&(c.name===action||c.name.endsWith('|'+action)||c.name.endsWith('_'+action)));if(!clip)continue;
   animation.play(clip.name);const state=animation.getState(clip.name);if(state)state.wrapMode=this.loop?AnimationClip.WrapMode.Loop:AnimationClip.WrapMode.Normal;found.push(clip.name);
  }
  this.info=ENEMY_G1[this.index].id+' · '+action+' · '+found.length+' 个骨骼播放器 · '+this.animations.flatMap(a=>a.clips.map(c=>c?.name)).join(', ');if(this.status)this.status.textContent=this.info;
 }
 private tint():void{const def=ENEMY_G1[this.index],advanced=RAID_BOSSES.find(b=>b.assetId===def.id);if(this.model)this.radiance.apply(this.model,advanced?5:this.grade,advanced?.color??ENEMY_G1_GRADES[this.grade].color,def.kind==='boss'||def.kind==='elite',def.key);}
 private rotate():void{if(this.model){const q=Quat.fromEuler(new Quat(),0,this.yaw,0);Quat.multiply(q,q,this.baseRotation);this.model.setRotation(q);}}
 private createControls():void{
  if(typeof document==='undefined')return;
  const controls=document.createElement('div');controls.className='g1-review-controls';this.controls=controls;
  const style=document.createElement('style');style.textContent=`.g1-review-controls{position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#214750}.g1-review-controls button{pointer-events:auto;min-width:0;min-height:42px;border:2px solid #b2cfca;border-radius:12px;background:#fff9e9;color:#214750;font:600 clamp(11px,1.35vw,19px) system-ui;cursor:pointer;box-shadow:0 3px 0 #638b8033}.g1-review-controls button[aria-pressed="true"]{background:#008ca5;color:white;border-color:#59cad9}.g1-review-controls button:disabled{opacity:.42;cursor:default}.g1-review-controls .roster{position:absolute;left:2.5%;right:2.5%;top:4%;max-height:15%;overflow-y:auto;display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px}.g1-review-controls h2{position:absolute;top:20.5%;left:0;right:0;text-align:center;font-size:clamp(18px,2.2vw,29px);margin:0}.g1-review-controls .actions{position:absolute;bottom:15.5%;left:8.5%;right:8.5%;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.g1-review-controls .grades{position:absolute;bottom:7%;left:2%;right:2%;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.g1-review-controls label{position:absolute;bottom:6px;left:24px;pointer-events:auto;font-size:13px;background:#fff9e9;padding:3px 9px;border-radius:6px}`;
  controls.appendChild(style);
  const group=(name:string)=>{const div=document.createElement('div');div.className=name;controls.appendChild(div);return div;};
  const button=(parent:HTMLElement,key:string,label:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;parent.appendChild(b);this.buttons.set(key,b);return b;};
  const roster=group('roster');ENEMY_G1.forEach((d,i)=>button(roster,d.id,d.id+' '+d.name,()=>{void this.select(i);}));
  this.heading=document.createElement('h2');controls.appendChild(this.heading);
  const actions=group('actions');['idle','walk','attack','skill','hit','exit'].forEach((action,i)=>button(actions,action,['待机','行走','攻击','技能','受击','退场'][i],()=>{this.play(action);this.render();}));
  const grades=group('grades');button(grades,'rotate','转向',()=>{this.yaw+=45;this.rotate();});
  ENEMY_G1_GRADES.forEach((g,i)=>button(grades,'grade-'+i,g.name,()=>{this.grade=i;this.tint();this.render();}));
  button(grades,'turn','自动旋转',()=>{this.turn=!this.turn;this.render();});
  const label=document.createElement('label'),loop=document.createElement('input');loop.type='checkbox';loop.checked=this.loop;loop.onchange=()=>{this.loop=loop.checked;this.play(this.action);};label.append(loop,document.createTextNode('循环播放'));controls.appendChild(label);
  document.body.appendChild(controls);
 }
 private render():void{
  this.ui.clear();const def=ENEMY_G1[this.index];
  if(this.controls){
   if(this.heading)this.heading.textContent=def.name+' · '+(def.id.startsWith('H')?'高级首领':def.kind==='boss'?'普通首领':def.kind==='elite'?'精英':'小怪');
   for(const [key,b] of this.buttons){b.setAttribute('aria-pressed',String(key===def.id||key===this.action||key==='grade-'+this.grade));if(key.startsWith('grade-'))b.disabled=!def.id.startsWith('B')&&def.id!=='E01';}
   this.buttons.get('turn')!.textContent=this.turn?'停止旋转':'自动旋转';return;
  }
  ENEMY_G1.forEach((d,i)=>this.ui.button(d.id,-550+(i%10)*122,308-Math.floor(i/10)*48,112,40,()=>{void this.select(i);},{size:19,primary:i===this.index}));
  this.ui.text(def.name+' · '+(def.id.startsWith('H')?'高级首领':def.kind==='boss'?'普通首领':def.kind==='elite'?'精英':'小怪'),0,188,30,'#214750');
  ['idle','walk','attack','skill','hit','exit'].forEach((action,i)=>this.ui.button(['待机','行走','攻击','技能','受击','退场'][i],-450+i*180,-222,163,48,()=>{this.play(action);this.render();},{size:23,primary:this.action===action}));
  ENEMY_G1_GRADES.forEach((grade,i)=>this.ui.button(grade.name,-348+i*174,-284,158,44,()=>{this.grade=i;this.tint();this.render();},{size:22,primary:this.grade===i,disabled:!def.id.startsWith('B')&&def.id!=='E01'}));
  this.ui.button('转向',-535,-284,166,44,()=>{this.yaw+=45;this.rotate();},{size:21});
  this.ui.button(this.turn?'停止旋转':'自动旋转',535,-284,166,44,()=>{this.turn=!this.turn;this.render();},{size:21});
 }
 resize():void{this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.orthoHeight=2.9;this.camera.node.setPosition(3,2.8,6);this.camera.node.lookAt(new Vec3(0,1,0));}
 update(dt:number):void{this.radiance.update(dt);if(this.turn&&this.model){this.yaw+=dt*24;this.rotate();}this.readoutClock+=dt;if(this.readoutClock>.4&&this.animations.length&&this.status){this.readoutClock=0;const animation=this.animations[0],clip=animation.clips.find(c=>c&&(c.name===this.action||c.name.endsWith('|'+this.action)||c.name.endsWith('_'+this.action))),state=clip?animation.getState(clip.name):undefined;this.status.textContent=this.info+(state?' · 播放 '+state.time.toFixed(1)+'s':'');}}
 destroy():void{this.destroyed=true;this.generation++;this.root.destroy();this.radiance.destroy();this.materialAdapter.destroy();this.prefab?.decRef();this.floor.destroy();this.material.destroy();this.status?.remove();this.controls?.remove();}
}
