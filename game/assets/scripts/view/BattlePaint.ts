import {CoastalTerrain} from './CoastalTerrain';
import {PearlBattleArt} from './PearlBattleArt';
import {illustratedBattleEffect} from './BattleArtDirection';
import {ThemedBattleTerrain} from './ThemedBattleTerrain';
import {mapProps} from '../core/placement';
import {BOSSES} from '../core/bossCatalog';
import {WORLD_BOSSES} from '../core/worldBoss';
import {CompanionRig} from './CompanionRig';
import {COMPANION_PADDING,BATTLE_RIG} from './CompanionRigData';
import {Camera,Color,Layers,Material,Mesh,MeshRenderer,Node,SpriteFrame,utils,Vec3,Vec4,Quat} from 'cc';
import type {ArtV2Assets} from './ArtV2Assets';
import type {EnemyKind,Role,LevelDefinition} from '../core/types';
import {mapBounds,mapTheme,routeClearance} from '../core/mapPresentation';
import {COAST_DEPTH} from '../core/coastStageGeometry';
import {MODE_DEPTH,isModeStage,modePoint} from '../core/modeStageGeometry';
import {MAIN_POSES,SUPPORT_POSES,ENEMY_POSES,poseRow} from './BattlePoseData';

/** Approved character artwork rendered at real world positions. Combat owns all timing and targets. */
export class BattlePaint {
  private meshes=new Map<string,Mesh>();
  private materials=new Map<string,Material>();
  private ambient:{node:Node;phase:number;kind:'plant'|'water'|'crystal'|'stone';x:number;z:number}[]=[];
  private time=0;
  private terrain?:CoastalTerrain;
  private themeTerrain?:ThemedBattleTerrain;
  private soulMaterials=new Set<Material>();
  private enemyMaterials=new Map<Node,Material>();
  private rigs=new Map<Node,{rig:CompanionRig;mesh:Mesh;role:Role}>();
  private equipment:{node:Node;role:string;phase:number;x:number;y:number;size:number}[]=[];
  private waterMaterials=new Map<Material,number>();
  private flashes:{node:Node;age:number;duration:number;size:number;point:Vec3;end?:Vec3;ground:boolean;index:number}[]=[];
  private liveEffects:{node:Node;material:Material;age:number;duration:number;style:number}[]=[];
  private pearlMotion:{node:Node;phase:number;kind:'body'|'mote';x:number;y:number;z:number}[]=[];
  constructor(private root:Node,private camera:Camera,private art:ArtV2Assets){}
  private node(name:string,parent:Node,mesh:Mesh,material:Material):Node{
    if(!material.passes.length)throw new Error('战场材质未生成渲染通道：'+name);
    const n=new Node(name);n.layer=Layers.Enum.DEFAULT;n.setParent(parent);const r=n.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(material,0);return n;
  }
  private material(key:string,frame:SpriteFrame,mode:number):Material{
    let m=this.materials.get(key);if(!m){m=new Material();m.initialize({effectAsset:mode===0?illustratedBattleEffect(this.art.battleEffect!):this.art.battleEffect!,states:{priority:mode===0||mode===4||mode===-1?100:[2,3,5,6].includes(mode)?190:130,depthStencilState:{depthTest:true,depthWrite:![2,3,5,6].includes(mode)}}});m.setProperty('mainTexture',frame.texture);m.setProperty('mainColor',Color.WHITE);m.setProperty('keyParams',new Vec4(mode,0,0,0));this.materials.set(key,m);}return m;
  }
  private quad(key:string,frame:SpriteFrame,height:number,centered=false):Mesh{
    let mesh=this.meshes.get(key);if(mesh)return mesh;
    const r=frame.rect,t=frame.texture,w=height*r.width/r.height,base=centered?-height/2:0;
    const u=r.x/t.width,v=r.y/t.height,du=r.width/t.width,dv=r.height/t.height;
    mesh=this.grid(-w/2,base,w,height,u,v,du,dv);this.meshes.set(key,mesh);return mesh;
  }
  actor(parent:Node,kind:Role|EnemyKind|'golem',friendly:boolean):{node:Node;height:number}{
    const pose=poseRow(kind);if(pose){const frame=this.art.battleFrame(`pose-${pose.atlas}-${pose.row}-0`)!;const n=this.node('战斗动作:'+kind,parent,this.poseMesh(kind,0),this.material('pose-'+pose.atlas,frame,1));this.face(n);return{node:n,height:kind==='boss'?1.85:kind==='stone'?1.5:friendly?1.35:.80};}
    const hero=['stone','spike','crystal','leaf','bubble'].includes(kind);
    const key=hero?`battle-hero-${kind}`:`battle-enemy-${['ink','runner','armored','mist','snail','elite','boss','golem'].indexOf(kind)}`;
    const frame=this.art.battleFrame(key)!;
    const height=hero?(kind==='stone'?1.38:1.32):kind==='boss'?1.5:kind==='elite'?1.0:kind==='golem'?1.4:kind==='mist'?.84:.72;
    const n=this.node(`战斗立绘:${kind}`,parent,this.quad(key,frame,height),this.material(hero?'approved-heroes':'painted-enemies',frame,1));
    this.face(n);return{node:n,height};
  }
  advancedActor(parent:Node,role:Role):Node|undefined{const key='home-advanced-'+role,frame=this.art.battleFrame(key);if(!frame)return;const node=this.node('局内进阶:'+role,parent,this.quad(key,frame,1.85),this.material(key,frame,1));this.face(node);return node;}
  equipmentGlow(parent:Node,role:Role):void{
    const row=poseRow(role)!,frame=this.art.battleFrame(`pose-${row.atlas}-${row.row}-0`)!,material=this.art.companionMaterial(true);
    material.setProperty('mainTexture',frame.texture);const mesh=this.poseMesh(role,0,true),rig=new CompanionRig(material,role,frame,true);
    const renderer=parent.getComponent(MeshRenderer)!;renderer.mesh=mesh;renderer.setSharedMaterial(material,0);this.rigs.set(parent,{rig,mesh,role});
  }
  soulRing(parent:Node):Node{
    const f=this.art.battleFrame('water-surface')!,m=new Material();m.initialize({effectAsset:this.art.battleEffect!,states:{priority:190,depthStencilState:{depthTest:true,depthWrite:false}}});m.setProperty('mainColor',new Color('#39A873'));m.setProperty('keyParams',new Vec4(6,0,0,0));this.soulMaterials.add(m);
    const n=this.node('贴地品质魂环',parent,this.quad('soul-ring',f,1.18,true),m);
    // The painted map uses a top-down camera with illustrated perspective. Match
    // its ground ellipses and keep the ring below the character's sprite plane.
    n.setRotationFromEuler(-90,0,0);n.setScale(1,.30,1);n.setPosition(0,-.003,0);return n;
  }
  soulColor(n:Node,hex:string):void{n.getComponent(MeshRenderer)?.getSharedMaterial(0)?.setProperty('mainColor',new Color(hex));}
  animateEnemy(n:Node,moving:boolean,phase:number,pace:number):void{
    const r=n.getComponent(MeshRenderer)!;let m=this.enemyMaterials.get(n);if(!m){m=new Material();m.initialize({effectAsset:this.art.battleEffect!,states:{priority:130}});m.setProperty('mainColor',Color.WHITE);this.enemyMaterials.set(n,m);}
    const source=r.getSharedMaterial(0)!;if(source!==m)m.setProperty('mainTexture',source.getProperty('mainTexture') as import('cc').Texture2D);
    m.setProperty('keyParams',new Vec4(7,moving?1:0,phase*pace,0));r.setSharedMaterial(m,0);for(const pass of m.passes)pass.update();
  }
  private grid(x:number,y:number,w:number,h:number,u:number,v:number,du:number,dv:number):Mesh{
    const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],count=8;
    for(let row=0;row<=count;row++)for(let col=0;col<=count;col++){positions.push(x+w*col/count,y+h*row/count,0);normals.push(0,0,1);uvs.push(u+du*col/count,v+dv*(1-row/count));}
    for(let row=0;row<count;row++)for(let col=0;col<count;col++){const a=row*(count+1)+col,b=a+count+1;indices.push(a,a+1,b,b,a+1,b+1);}return utils.createMesh({positions,normals,uvs,indices});
  }
  boss(node:Node,index:number):void{const f=this.art.battleFrame('boss-'+index);if(!f)return;const r=node.getComponent(MeshRenderer)!;r.mesh=this.quad('boss-'+index,f,1.85);r.setSharedMaterial(this.material(BOSSES[index]?.art??'boss-atlas',f,1),0);}
  worldBoss(node:Node,index:number):void{const key=WORLD_BOSSES[index].art,f=this.art.battleFrame(key);if(!f)return;const r=node.getComponent(MeshRenderer)!;r.mesh=this.quad(key,f,3.8);r.setSharedMaterial(this.material(key,f,1),0);node.setPosition(0,-.1,0);node.setScale(1,1,1);}
  guard(parent:Node,level:LevelDefinition):void{const p=level.id===55&&!level.sceneArt?{x:0,z:0}:level.route[level.route.length-1],f=this.art.battleFrame('map-guardian-pearl')!;const n=this.node('贝壳珍珠 · 守护目标',parent,this.quad('guard-pearl',f,1.85),this.material('guard-pearl',f,1));n.setPosition(p.x,.025,p.z);this.face(n);this.pearlMotion.push({node:n,phase:0,kind:'body',x:p.x,y:.025,z:p.z});const glow=this.art.battleFrame('battle-vfx-3')!,light=this.node('守护珍珠潮光',n,this.quad('guard-glow',glow,.56,true),this.material('guard-light',glow,2));light.setPosition(0,.87,.025);this.equipment.push({node:light,role:'pearl',phase:0,x:0,y:.87,size:.56});for(let i=0;i<3;i++){const a=i*Math.PI*2/3,mote=this.node('守护珍珠潮光粒子',n,this.quad(`guard-mote-${i}`,glow,.15,true),this.material('guard-mote',glow,2));mote.setPosition(Math.cos(a)*.52,.60+Math.sin(a)*.14,.03);this.pearlMotion.push({node:mote,phase:a,kind:'mote',x:Math.cos(a)*.52,y:.60+Math.sin(a)*.14,z:.03});}}
  shadow(parent:Node,friendly:boolean):void{
    const f=this.art.battleFrame('approved-coast')!;
    for(const [name,size,x,z] of [['落地接触',.81,0,.010],['日照投影',1.06,.17,.13]] as const){
      const n=this.node(name,parent,this.quad('shadow-'+name,f,size,true),this.material('shadow-'+name,f,3));
      n.setRotationFromEuler(-90,0,0);n.setPosition(x,-.002,z);n.setScale(friendly?1:.84,.40,1);
    }
  }
  station(parent:Node,x:number,z:number,mine=true):void{
    const f=PearlBattleArt.frame('station');if(!f)return;
    const n=this.node('贴地珍珠石座',parent,this.quad('pearl-station',f,.88,true),this.material(mine?'pearl-station':'pearl-station-ally',f,1));
    if(!mine)n.getComponent(MeshRenderer)!.getSharedMaterial(0)!.setProperty('mainColor',new Color('#9BBED8'));
    n.setRotationFromEuler(-90,0,0);n.setScale(1,.60,1);n.setPosition(x,-.025,z);
  }
  face(node:Node):void{const q=this.camera.node.worldRotation;node.setWorldRotation(q.x,q.y,q.z,q.w);}
  emitter(node:Node,role:Role):Vec3{const p=poseRow(role)!,[sx,sy,w,h,ax,ay]=(p.atlas==='main'?MAIN_POSES:SUPPORT_POSES)[p.row][0],gear=BATTLE_RIG[role].gear;return Vec3.transformMat4(new Vec3(),new Vec3((sx+w*gear[0]-ax)*p.scale,(ay-sy-h*gear[1])*p.scale,.025),node.worldMatrix);}
  private poseMesh(kind:string,index:number,padded=false):Mesh{
    const p=poseRow(kind)!,key=`pose-${kind}-${index}${padded?'-rig':''}`,prior=this.meshes.get(key);if(prior)return prior;
    const [sx,sy,w,h,ax,ay]=(p.atlas==='main'?MAIN_POSES:p.atlas==='enemy'?ENEMY_POSES:SUPPORT_POSES)[p.row][index];
    const frame=this.art.battleFrame(`pose-${p.atlas}-${p.row}-${index}`)!,tw=frame.texture.width,th=frame.texture.height;
    const pad=padded?(COMPANION_PADDING-1)*.5:0;
    const x=(sx-ax-w*pad)*p.scale,y=(ay-sy-h-h*pad)*p.scale,r=x+w*(1+pad*2)*p.scale,t=y+h*(1+pad*2)*p.scale;
    const mesh=this.grid(x,y,r-x,t-y,sx/tw,sy/th,w/tw,h/th);this.meshes.set(key,mesh);return mesh;
  }
  pose(node:Node,kind:string,index:number):void{const entry=this.rigs.get(node);if(entry&&kind===entry.role){const r=node.getComponent(MeshRenderer)!;r.mesh=entry.mesh;r.setSharedMaterial(entry.rig.material,0);entry.rig.pose(index);return;}if(['elite','mist'].includes(kind)){const f=this.art.battleFrame('enemy-prop-'+(kind==='elite'?0:1))!;const r=node.getComponent(MeshRenderer)!;r.mesh=this.quad('marine-'+kind,f,kind==='elite'?1.05:.92);r.setSharedMaterial(this.material('marine-atlas',f,1),0);return;}const p=poseRow(kind);if(!p){const key='battle-enemy-'+['ink','runner','armored','mist','snail','elite','boss','golem'].indexOf(kind);const frame=this.art.battleFrame(key);if(frame){const r=node.getComponent(MeshRenderer)!;r.mesh=this.quad(key,frame,kind==='boss'?1.5:kind==='elite'?1:kind==='mist'?.84:.72);r.setSharedMaterial(this.material('painted-enemies',frame,1),0);}return;}const r=node.getComponent(MeshRenderer)!;r.mesh=this.poseMesh(kind,index);r.setSharedMaterial(this.material('pose-'+p.atlas,this.art.battleFrame(`pose-${p.atlas}-${p.row}-${index}`)!,1),0);}
  ground(parent:Node,approved=false):void{
    if(approved)this.groundBleed(parent,'approved-coast',false);
    if(approved){const f=this.art.battleFrame('approved-coast')!;let mesh=this.meshes.get('approved-coast');if(!mesh){mesh=utils.createMesh({positions:[-9,-.08,-5.065,9,-.08,-5.065,-9,-.08,5.065,9,-.08,5.065],normals:[0,1,0,0,1,0,0,1,0,0,1,0],uvs:[0,0,1,0,0,1,1,1],indices:[0,2,1,1,2,3]});this.meshes.set('approved-coast',mesh);}const coast=this.material('approved-coast',f,0);this.waterMaterials.set(coast,0);this.node('已确认海湾场景',parent,mesh,coast);return;}
    const frame=this.art.battleFrame('battle-island-painted')!;
    const xs=[[-9,0],[-6.588,.123],[-4.612,.235],[-3.294,.296],[-1.976,.39],[.659,.53],[3.294,.673],[3.953,.720],[5.271,.786],[6.588,.862],[9,1]];
    const zs=[[-5.25,0],[-3.2,.160],[-2.504,.233],[-1.054,.357],[.461,.495],[2.372,.678],[5.25,1]];
    const positions:number[]=[],uvs:number[]=[],normals:number[]=[],indices:number[]=[];
    for(const [z,v] of zs)for(const [x,u] of xs){positions.push(x,-.045,z);uvs.push(u,v);normals.push(0,1,0);}
    for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+xs.length;indices.push(a,b,a+1,a+1,b,b+1);}
    let mesh=this.meshes.get('painted-ground');if(!mesh){mesh=utils.createMesh({positions,normals,uvs,indices});this.meshes.set('painted-ground',mesh);}
    const material=this.material('painted-ground',frame,0);material.setProperty('keyParams',new Vec4(0,1,0,0));
    const sea=this.material('painted-ocean',frame,-1);sea.setProperty('mainColor',new Color('#52BDD0'));
    const ocean=this.node('宁静远海',parent,mesh,sea);ocean.setScale(8,1,8);ocean.setPosition(0,-.1,0);
    this.node('正式海岸场景',parent,mesh,material);
  }
  themedGround(parent:Node,level:LevelDefinition,threeDScenery=false,wave=1,bossIndex=0):void{
    if(level.sceneArt?.startsWith('map-coast-stage-')||isModeStage(level)){
      // Authored maps stay registered to their routes. Extend actual ocean under
      // them on wide phones instead of stretching the map or exposing clearColor.
      const ocean=this.art.battleFrame('water-surface')!,seaMat=this.material('authored-ocean',ocean,0);
      const sea=this.node('宽屏远海延伸',parent,this.quad('authored-ocean',ocean,48,true),seaMat);
      sea.setRotationFromEuler(-90,0,0);sea.setPosition(0,-.12,0);this.waterMaterials.set(seaMat,1);
      const key=level.sceneArt!;const f=this.art.battleFrame(key)!;let mesh=this.meshes.get(key);
      // Undo the camera's ground foreshortening. The orthographic camera stays
      // at the 1280x720 design scale shared by the HUD, actors and touch input.
      const halfDepth=(isModeStage(level)?MODE_DEPTH:COAST_DEPTH)/2;
      if(!mesh)mesh=utils.createMesh({positions:[-9,-.08,-halfDepth,9,-.08,-halfDepth,-9,-.08,halfDepth,9,-.08,halfDepth],normals:[0,1,0,0,1,0,0,1,0,0,1,0],uvs:[0,0,1,0,0,1,1,1],indices:[0,2,1,1,2,3]}),this.meshes.set(key,mesh);
      const mat=this.material(key,f,0);this.waterMaterials.set(mat,4);const ground=this.node('初晴海湾确认美术:'+key,parent,mesh,mat);ground.setPosition(0,0,-.08*.6);return;
    }
    if(level.sceneArt||((level.stationVersion??0)>=6)){
      this.themeTerrain??=new ThemedBattleTerrain();this.themeTerrain.create(parent,level,this.art,wave,bossIndex);
      const ocean=this.art.battleFrame('water-surface')!,mat=this.material('theme-ocean',ocean,0);
      const sea=this.node('远海延伸',parent,this.quad('theme-ocean',ocean,48,true),mat);sea.setRotationFromEuler(-90,0,0);sea.setPosition(0,-.12,0);this.waterMaterials.set(mat,1);
      return;
    }
    if(level.sceneArt){
      this.groundBleed(parent,level.sceneArt,!!level.sceneMirror);
      const f=this.art.battleFrame(level.sceneArt)!;const key=level.sceneArt+(level.sceneMirror?'-mirror':'');let mesh=this.meshes.get(key);
      if(!mesh){const l=level.sceneMirror?1:0,r=1-l;mesh=utils.createMesh({positions:[-9,-.08,-5.065,9,-.08,-5.065,-9,-.08,5.065,9,-.08,5.065],normals:[0,1,0,0,1,0,0,1,0,0,1,0],uvs:[l,0,r,0,l,1,r,1],indices:[0,2,1,1,2,3]});this.meshes.set(key,mesh);}
      const mat=this.material(key,f,0);this.waterMaterials.set(mat,4);this.node('手绘海岸:'+level.sceneArt,parent,mesh,mat);
      if(level.id!==56&&!threeDScenery)this.guard(parent,level);return;
    }
    this.terrain?.destroy();this.terrain=new CoastalTerrain();
    const ocean=this.art.battleFrame('water-surface')!,mat=this.material('themed-sea',ocean,0);
    const sea=this.node('流动远海',parent,this.quad('themed-sea',ocean,48,true),mat);sea.setRotationFromEuler(-90,0,0);sea.setPosition(0,-.48,0);
    this.waterMaterials.set(mat,1);
    this.terrain.create(parent,level,this.art.battleFrame('terrain-material-atlas')!.texture as import('cc').Texture2D,this.art.terrainEffect!);
    if(level.id!==56&&!threeDScenery)this.guard(parent,level);
  }
  /** Extend scenery behind the floating HUD without changing the playable map or routes. */
  private groundBleed(parent:Node,art:string,mirror:boolean):void{
    const key='hud-bleed-'+art+(mirror?'-mirror':''),f=this.art.battleFrame(art)!;let mesh=this.meshes.get(key);
    if(!mesh){const xs=[[-18,.5],[-9,0],[9,1],[18,.5]],zs=[[-14,.9],[-5.065,0],[5.065,1],[14,.1]],positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
      for(const [z,v]of zs)for(const [x,u]of xs){positions.push(x,-.085,z);normals.push(0,1,0);uvs.push(mirror?1-u:u,v);}
      for(let z=0;z<3;z++)for(let x=0;x<3;x++){const a=z*4+x;indices.push(a,a+4,a+1,a+1,a+4,a+5);}mesh=utils.createMesh({positions,normals,uvs,indices});this.meshes.set(key,mesh);
    }
    this.node('HUD后方海岸延伸',parent,mesh,this.material(key,f,0));
  }
  flash(index:number,point:Vec3,size:number,duration=.42,end?:Vec3,ground=false):void{
    if(this.flashes.length>=26){const old=this.flashes.shift()!;old.node.destroy();}
    const frame=this.art.battleFrame(`battle-vfx-${index}`)!;
    const n=this.node('技能绘制:'+index,this.root,this.quad('vfx'+index,frame,1,true),this.material('vfx',frame,2));
    this.flashes.push({node:n,age:0,duration,size,point:point.clone(),end:end?.clone(),ground,index});
    n.setPosition(point);n.setScale(size,size,size);if(ground)n.setRotationFromEuler(-90,0,0);else this.face(n);
  }
  storm(point:Vec3,size:number,duration:number,style=0):void{
    if(this.liveEffects.length>=24){const first=this.liveEffects.shift()!;first.node.destroy();first.material.destroy();}
    const frame=this.art.battleFrame('water-surface')!,m=new Material();m.initialize({effectAsset:this.art.battleEffect!,states:{priority:190,depthStencilState:{depthTest:true,depthWrite:false}}});m.setProperty('mainColor',Color.WHITE);m.setProperty('keyParams',new Vec4(5,style,0,0));
    const n=this.node('持续技能效果:'+style,this.root,this.quad('live-storm',frame,1,true),m);n.setRotationFromEuler(-90,0,0);n.setPosition(point.x,.14,point.z);n.setScale(size,size,size);
    this.liveEffects.push({node:n,material:m,age:0,duration,style});
  }
  modeLandmarkGlow(parent:Node,level:LevelDefinition):void{
    const centers:Record<number,number[]>={50:[1550,603],51:[1574,390],52:[1562,584],53:[1552,481],54:[1580,398],56:[1545,384]};
    const center=centers[level.id];if(!center)return;
    const p=modePoint(center[0],center[1]),frame=this.art.battleFrame('battle-vfx-3')!;
    const mat=this.material('approved-mode-pearl-glint',frame,2);mat.setProperty('mainColor',new Color(180,230,255,100));
    this.pearlMotion=this.pearlMotion.filter(e=>e.node.isValid);
    for(let i=0;i<4;i++){const angle=i*Math.PI*2/3,x=p.x+(i?Math.cos(angle)*.30:0),z=p.z+(i?Math.sin(angle)*.22:0);
      const n=this.node('确认珍珠微光:'+i,parent,this.quad('mode-pearl-'+i,frame,i?.16:.43,true),mat);this.face(n);n.setPosition(x,.06,z);
      this.pearlMotion.push({node:n,phase:i*1.7,kind:i?'mote':'body',x,y:.06,z});
    }
  }
  update(dt:number):void{
    this.time+=Math.min(.1,dt);
    for(const m of this.soulMaterials){m.setProperty('keyParams',new Vec4(6,0,this.time,0));for(const p of m.passes)p.update();}
    for(const [n,m] of this.enemyMaterials)if(!n.isValid){m.destroy();this.enemyMaterials.delete(n);}

    for(const [node,entry] of this.rigs){if(!node.isValid){entry.rig.destroy();this.rigs.delete(node);}else entry.rig.update(dt);}
    for(const p of this.pearlMotion){if(!p.node.isValid)continue;const t=this.time+p.phase;if(p.kind==='body'){const s=1+Math.sin(t*1.45)*.018;p.node.setPosition(p.x,p.y+Math.sin(t*1.45)*.035,p.z);p.node.setScale(s,s,1);}else{const pulse=.72+.28*Math.sin(t*2.1);p.node.setPosition(p.x+Math.cos(t*.65+p.phase)*.08,p.y+Math.sin(t*1.05+p.phase)*.10,p.z);p.node.setScale(pulse,pulse,1);}}
    this.equipment=this.equipment.filter(e=>e.node.isValid);for(const e of this.equipment){const t=this.time+e.phase,pulse=.65+.35*Math.sin(t*(e.role==='leaf'?1.5:2.3)),burst=e.role==='bubble'?1+Math.pow(Math.max(0,Math.sin(t*1.8)),8)*.9:1;const size=e.size*pulse*burst;e.node.setScale(size,size,1);e.node.setRotationFromEuler(0,0,e.role==='crystal'?t*75:e.role==='bubble'?-t*38:e.role==='spike'?Math.sin(t*2)*18:0);e.node.setPosition(e.x+(e.role==='spike'?Math.sin(t*2)*.09:0),e.y,.026);}

    for(const [m,mode] of this.waterMaterials)if(m.isValid){m.setProperty('keyParams',new Vec4(0,mode,this.time,1));for(const pass of m.passes)pass.update();}
    for(let i=this.liveEffects.length-1;i>=0;i--){const e=this.liveEffects[i];e.age+=dt;if(e.age>=e.duration||!e.node.isValid){if(e.node.isValid)e.node.destroy();e.material.destroy();this.liveEffects.splice(i,1);continue;}e.material.setProperty('keyParams',new Vec4(5,e.style,e.age,e.age/e.duration));for(const pass of e.material.passes)pass.update();}
    for(const a of this.ambient){if(!a.node.isValid)continue;const t=this.time+a.phase;if(a.kind==='water'){a.node.setPosition(Math.sin(t*.13)*.12,-.12,Math.cos(t*.11)*.10);}else if(a.kind==='plant'){a.node.setScale(1+Math.sin(t*1.3)*.017,1+Math.cos(t*1.1)*.012,1);}else if(a.kind==='crystal'){const m=a.node.getComponent(MeshRenderer)?.getSharedMaterial(0);m?.setProperty('keyParams',new Vec4(8,0,t,0));}}
    for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.age+=dt;const t=f.age/f.duration;if(t>=1){f.node.destroy();this.flashes.splice(i,1);continue;}
      const s=f.size*(f.end?1:.65+Math.sin(t*Math.PI)*.35)*(t>.8?(1-t)*5:1);f.node.setScale(s,s,s);
      if(f.end)f.node.setPosition(Vec3.lerp(new Vec3(),f.point,f.end,t));
      else f.node.setPosition(f.point.x,f.point.y+(f.ground?0:t*.12),f.point.z);
      if(!f.ground){this.face(f.node);if(f.end&&f.index===0){const a=this.camera.worldToScreen(f.point),b=this.camera.worldToScreen(f.end),angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+36;f.node.setWorldRotation(Quat.multiply(new Quat(),this.camera.node.worldRotation,Quat.fromEuler(new Quat(),0,0,angle)));}}
    }
  }
  clear():void{for(const f of this.flashes)f.node.destroy();this.flashes=[];for(const e of this.liveEffects){if(e.node.isValid)e.node.destroy();e.material.destroy();}this.liveEffects=[];this.ambient=this.ambient.filter(a=>a.node.isValid);}
  destroy():void{this.themeTerrain?.destroy();this.terrain?.destroy();this.clear();this.pearlMotion=[];for(const m of this.soulMaterials)m.destroy();this.soulMaterials.clear();for(const m of this.enemyMaterials.values())m.destroy();this.enemyMaterials.clear();for(const entry of this.rigs.values())entry.rig.destroy();this.rigs.clear();for(const m of this.meshes.values())m.destroy();for(const m of this.materials.values())m.destroy();this.meshes.clear();this.materials.clear();}
}
