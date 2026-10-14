import {NativeResourceQueue} from './NativeResourceQueue';
import {runtimeQuery} from '../platform/runtimeQuery';
import {FusionRankVisuals,fusionModelScale} from './FusionRankVisuals';
import {approvedVfxTextures} from './ApprovedVfxArt';
import {expeditionSlots} from '../core/expeditionRules';
import {battleThemeIndex} from '../core/battleThemes';
import {FaunaAura} from './FaunaAura';
import {faunaAuraGrade} from '../core/faunaAura';
import {FAUNA_DIMENSIONS} from '../core/faunaDimensions';
import {ENEMY_G1,ENEMY_G1_GRADES,enemyG1,enemyG1Grade,g1EnemyAssetKeys,ORDINARY_G1} from '../core/enemyG1Catalog';
import {ENEMY_G1_DIMENSIONS} from '../core/enemyG1Dimensions';
import {FaunaRadiance} from './FaunaRadiance';
import {WORLD_BOSSES} from '../core/worldBoss';
import {softwareRendering} from './RenderBudget';
import {prepareBattleRig,attachRigidWeapon} from './BattleRigAnimation';
import {prepareEnemyLocomotion,prepareEnemyFeatureSockets,enemyWalkRate} from './EnemyLocomotion';
import {bossVisualKey,worldVisualKey,faunaVisual,faunaBase} from '../core/faunaPresentation';
import {FAUNA_MODELS,bossModelIndex,encounterModels,enemyModelFor} from '../core/faunaCatalog';
import {BOSSES} from '../core/bossCatalog';
import {QUALITY_COLORS,turtleQuality} from '../core/prototypeConfig';
import {AnimationClip, Camera, Color, EffectAsset, instantiate, Label, LabelOutline, Layers, Material, Mesh, MeshRenderer, Node, Prefab, primitives, resources, SkeletalAnimation, SkinnedMeshRenderer, UITransform, utils, Vec3,Vec4,Texture2D} from 'cc';
import {ENEMIES, BATTLE_MAPS, LEGACY_PAINTED_MAPS, LEGACY_TACTICAL_MAPS, LEGACY_EXPANDED_MAPS, LEGACY_CLEAR_MAPS,LEGACY_BATTLE_MAPS, ROLES} from '../core/data';
import type {BattleEnemy, BattleEvent, BattleState, BattleUnit} from '../core/battle';
import type {EnemyKind, Role, RunTurtle} from '../core/types';
import {receiveIslandShadows,lightBattle} from './WorldLighting';
import {modernIslandMesh} from './ModernIsland';
import {BattlePaint} from './BattlePaint';
import type {ArtV2Assets} from './ArtV2Assets';
import {HERO_LOOK} from './VisualIdentity';
import {TurtleMaterialAdapter} from './TurtleMaterialAdapter';
import {G1BattleEffects} from './G1BattleEffects';
import {VfxReview} from './VfxReview';
import {mapProps,placementIssue} from '../core/placement';

type Shape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'ring' | 'rangeRing' | 'terrain';
type EffectKind = 'bolt' | 'ring' | 'spark' | 'beam';
type Action = 'idle' | 'walk' | 'attack' | 'skill' | 'hit' | 'rest' | 'exit' | 'death' | 'castStart' | 'castLoop' | 'castRelease' | 'turnL' | 'turnR' | 'greeting';
interface Actor {
  id: string; kind: Role | EnemyKind; friendly: boolean; node: Node; body: Node;
  bar: Node; fill: Node; shieldFill: Node; control: Node; shieldRing: Node; hpLabel: Label;
  skills?:string[];fusionRank?:number;rankBadge?:Node;rankPedestal?:Node;rankPop?:number;advancedPaint?:Node;paint?:Node;qualityRing?:Node;arrivalTime?:number;station?:number;
  statusVisuals?:Set<string>;activationVisuals?:Record<string,number>;passiveFxAt?:number;
  model?:Node;summonKind?:'turtle'|'golem';attackIndex?:number;variant?:string;animationRates?:Map<string,number>;
  animations: SkeletalAnimation[]; realModel: boolean; alive: boolean; moving: boolean;
  motionX?:number;motionZ?:number;motionTick?:number;walkRate?:number;
  x: number; z: number; floor: number; height: number; yaw: number; targetYaw: number;
  phase: number; hitTime: number; actionTime: number; action: Action; deathTime: number; exitDuration:number;
}
interface Effect {
  node: Node; renderer: MeshRenderer; kind: EffectKind; start: Vec3; end: Vec3;
  age: number; duration: number; size: number; priority: number; active: boolean;
}
interface FloatingNumber { node: Node; label: Label; base: Vec3; age: number; duration: number; }

interface ModelSpec {path: string; material: string; scale: number; height: number; controlHeight: number}
const TURTLE_MODELS: Partial<Record<Role, ModelSpec>> = {
  stone: {path: 'models-g1/stone/stone/stone', material: 'G1_', scale: .59, height: 1.53, controlHeight: 1.46},
  spike: {path: 'models-g1/spike/spike/spike', material: 'G1_', scale: .55, height: 1.34, controlHeight: 1.26},
  crystal: {path: 'models-g1/crystal/crystal/crystal', material: 'G1_', scale: .55, height: 1.37, controlHeight: 1.29},
  leaf: {path: 'models-g1/leaf/leaf/leaf', material: 'G1_', scale: .55, height: 1.32, controlHeight: 1.26},
  bubble: {path: 'models-g1/bubble/bubble/bubble', material: 'G1_', scale: .55, height: 1.37, controlHeight: 1.29},
};
const ENEMY_MODELS: Partial<Record<EnemyKind, ModelSpec>> = Object.fromEntries(
 ENEMY_G1.filter(x=>['M01','M02','M03','M04','M05','E01','B01'].includes(x.id)).map(x=>[x.kind,{path:x.model,material:'G1_',scale:x.kind==='boss'?1:.5,height:x.kind==='boss'?2.12:1.12,controlHeight:x.kind==='boss'?2:1}])
);
const EFFECT_LIMIT = 48;
const TURTLE_FLOOR = .045;
const ENEMY_FLOOR = .045;
const WHITE = '#FFF0CF';
const HEAL = '#99E67E';
const SHIELD = '#A6E5F3';
const CONTROL = '#CEAFF3';
const ENEMY_COLORS: Record<EnemyKind, string> = {
  ink: '#565073', runner: '#E87B54', armored: '#858EA6', mist: '#B295D4',
  snail: '#8B7497', elite: '#C76C55', boss: '#A74E50',
};
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/** Presentation only: positions, HP and all outcomes come from the deterministic core. */
export class BattleWorld {
  private readonly root: Node;
  private readonly actorsRoot: Node;
  private readonly effectRoot: Node;
  private readonly rangePreview: Node;
  private readonly meshes = new Map<Shape, Mesh>();
  private readonly materials = new Map<string, Material>();
  private readonly units = new Map<string, Actor>();
  private readonly enemies = new Map<string, Actor>();
  private readonly vfxActors:Actor[]=[];
  private readonly rankVisuals=new FusionRankVisuals();
  private readonly retiringEnemies = new Set<Actor>();
  private readonly enemyPool = new Map<string,Actor[]>();
  private readonly effects: Effect[] = [];
  private coastTrial=false;private fixedStations=false;private ownedStations?:Set<number>;
  setStationOwnership(slots:readonly number[]):void{if(this.ownedStations&&slots.length===this.ownedStations.size&&slots.every(s=>this.ownedStations!.has(s)))return;this.ownedStations=new Set(slots);if(this.fixedStations)this.buildTemporaryEnvironment();}
  private readonly floatingNumbers: FloatingNumber[] = [];
  private readonly targetPoint = new Vec3();
  private environment?: Node;
  private environmentPrefab?: Prefab;
  private readonly turtlePrefabs = new Map<Role, Prefab>();
  private readonly advancedPrefabs = new Map<Role, Prefab>();
  private readonly advancedWeapons = new Map<Role, Prefab>();
  private readonly summonPrefabs = new Map<'turtle'|'golem',Prefab>();
  private readonly enemyPrefabs = new Map<EnemyKind, Prefab>();
  private readonly faunaPrefabs = new Map<string,Prefab>();
  private readonly faunaLoading = new Set<string>();
  private levelId = 0;
  private legacyModeLayout=false;
  private paintedLegacy=false;
  private themeWave=1;private themeBoss=0;private themeIndex=-1;
  private legacyGeometry=false;
  private legacyStations=false;
  private expandedLegacy=false;
  private get mapDefinition(){
    const maps=this.legacyGeometry?LEGACY_BATTLE_MAPS:this.legacyStations?LEGACY_TACTICAL_MAPS:this.previousCoast?LEGACY_CLEAR_MAPS:this.expandedLegacy?LEGACY_EXPANDED_MAPS:this.paintedLegacy?LEGACY_PAINTED_MAPS:BATTLE_MAPS;
    return maps.find(level=>level.id===this.levelId)
      ?? BATTLE_MAPS.find(level=>level.id===this.levelId)
      ?? maps[this.levelId]
      ?? BATTLE_MAPS[0];
  }
  private enemyFrameState?:BattleState;
  private enemyFrameTick=-1;private enemyFrameCount=-1;
  private enemyFrameEntities:BattleState['enemies']=[];
  private waveKey = '';
  private lastTick = -1;
  private lastEvent = 0;
  private disposed = false;
  private readonly resourceQueue=new NativeResourceQueue();
  private paused = false;
  private playbackSpeed = 1;
  private pendingModels = Object.keys(TURTLE_MODELS).length + Object.keys(ENEMY_MODELS).length;
  private modelLoadError?: Error;
  private readonly turtleMaterials:TurtleMaterialAdapter;
  private readonly faunaRadiance=new FaunaRadiance();
  private readonly faunaAura=new FaunaAura();
  private ocean?:Material;
  private oceanNode?:Node;
  private painted?:BattlePaint;
  private hudEffect?:EffectAsset;
  private previousCoast=false;
  private g1Effects?:G1BattleEffects;
  private vfxReview?:VfxReview;
  private readonly g1Assets:(EffectAsset|Texture2D)[]=[];
  private readonly props=new Map<string,Prefab>();
  private propMotion:{node:Node;kind:string;phase:number}[]=[];
  private sceneTime=0;
  private restoreShadows?:()=>void;
  private restoreLighting?:()=>void;
  setBattleArt(art?:ArtV2Assets):void{
    if(!art?.ready||!art.battleEffect||this.painted||this.disposed)return;
    this.hudEffect=art.battleEffect;this.rankVisuals.setEffect(art.battleEffect);
    this.painted=new BattlePaint(this.effectRoot,this.camera,art);
    this.buildTemporaryEnvironment();
  }
  private attachPaint(actor:Actor,kind:Role|EnemyKind|'golem'=actor.kind):void{
    if(!this.painted||actor.paint||!actor.node.isValid)return;
    for(const child of [...actor.body.children])this.retireNode(child);
    const result=this.painted.actor(actor.body,kind,actor.friendly);actor.paint=result.node;
    actor.animations=[];actor.realModel=false;actor.height=result.height;actor.floor=.035;
    actor.bar.setPosition(0,actor.height,0);actor.bar.setScale(.66,.8,1);actor.control.setPosition(0,actor.height,0);
    this.painted.shadow(actor.node,actor.friendly);if(actor.friendly&&ROLES[kind as Role]){this.painted.equipmentGlow(actor.paint,kind as Role);actor.arrivalTime=1.65;actor.qualityRing=this.painted.soulRing(actor.node);}
  }
  private terrainTexture?:Texture2D;
  setTerrainTexture(texture?:Texture2D):void{
    if(!texture||this.disposed||this.terrainTexture===texture)return;
    this.terrainTexture=texture;
    if(this.levelId===0&&!this.legacyGeometry)this.buildTemporaryEnvironment();
  }
  setOceanTexture(texture?:Texture2D):void{
    if(!texture||this.disposed||this.ocean)return;
    texture.setWrapMode(Texture2D.WrapMode.REPEAT,Texture2D.WrapMode.REPEAT);
    const material=new Material();material.copy(this.pipelineMaterial,{defines:{USE_ALBEDO_MAP:true,USE_VERTEX_COLOR:false}});
    material.setProperty('mainTexture',texture);material.setProperty('mainColor',Color.WHITE);material.setProperty('roughness',.72);material.setProperty('tilingOffset',new Vec4(4,4,0,0));
    this.ocean=material;this.materials.set('modern-ocean',material);this.oceanNode?.getComponent(MeshRenderer)?.setSharedMaterial(material,0);
  }

  get modelsReady(): boolean { return !this.disposed && this.pendingModels === 0 && (!this.modelLoadError || this.levelId === 56); }
  get loadingError(): Error | undefined { return this.levelId === 56 ? undefined : this.modelLoadError; }
  get loadedResourceCount():number{return this.turtlePrefabs.size+this.enemyPrefabs.size+this.faunaPrefabs.size+this.props.size+this.g1Assets.length;}
  setVisible(visible:boolean):void { if(!this.disposed)this.root.active=visible; }

  sampleVfxPose(time:number,playing:boolean):void{
    for(const a of this.vfxActors)if(a.node.active)for(const r of a.animations){
      const clip=r.clips.find(c=>c&&c.name.endsWith(a.action)),state=clip?r.getState(clip.name):undefined;if(!state)continue;
      if(playing)r.resume();else{state.time=time;state.sample();r.pause();}
    }
  }
  vfxMotionReport():string{return this.vfxActors.filter(a=>a.node.active).map(a=>a.kind+' '+a.animations.map(r=>{const clip=r.clips.find(c=>c&&c.name.endsWith(a.action));const state=clip?r.getState(clip.name):undefined;const nodes:Node[]=[];const visit=(n:Node)=>{nodes.push(n);n.children.forEach(visit);};visit(r.node);const limb=nodes.find(n=>/^(leg0\.L\.0|fin\.L\.0|head)$/.test(n.name));return `${a.action} ${state?.time.toFixed(2)??'-'}s / ${clip?.tracksCount??0}轨 ${state?.isPlaying?'播放':'停止'} ${state?.isPaused?'暂停':''} 骨骼网格${a.model?.getComponentsInChildren(SkinnedMeshRenderer).length} ${limb?.name}:${limb?.eulerAngles.x.toFixed(1)},${limb?.eulerAngles.z.toFixed(1)}`;}).join(',')).join(' · ');}
  beginVfxAcceptance():void{for(const actor of this.vfxActors)actor.node.active=false;}

  /** Stage the real source and target models beside the effect for visual acceptance. */
  stageVfxAcceptance(source:import('./VfxReview').VfxReviewActor,target:import('./VfxReview').VfxReviewActor,offset=0):{from:Vec3;to:Vec3;sourceModel?:Node;targetModel?:Node;sourceLabel:string;targetLabel:string}{
    const actorFor=(spec:import('./VfxReview').VfxReviewActor):Actor=>{
      let actor=this.vfxActors.find(x=>x.id===spec.id);
      if(actor){actor.node.active=true;return actor;}
      if(spec.kind==='role'&&spec.role){
        const id=spec.id;actor=this.createActor(id,spec.role,true);this.vfxActors.push(actor);this.setActorRank(actor,spec.rank??1);this.attachTurtle(actor);return actor;
      }
      const def=spec.variant?enemyG1(spec.variant):undefined,kind=def?.kind??'boss';actor=this.acquireEnemy('vfx-'+spec.id,kind,spec.variant);actor.variant=spec.variant;this.vfxActors.push(actor);if(spec.variant)this.loadLevelFauna(this.levelId,[spec.variant]);this.attachEnemy(actor);return actor;
    };
    const a=actorFor(source),b=actorFor(target),from=new Vec3(-2.35,a.floor+.78,0),to=new Vec3(1.25,b.floor+.62,offset);
    a.x=from.x;a.z=from.z;a.node.active=true;a.node.setPosition(a.x,a.floor,a.z);a.targetYaw=90;this.play(a,source.pose??(source.kind==='role'?'skill':'attack'),true);
    b.x=to.x;b.z=to.z;b.node.active=true;b.node.setPosition(b.x,b.floor,b.z);b.targetYaw=-90;this.play(b,target.pose??'idle',true);
    return{from,to,sourceModel:a.model,targetModel:b.model,sourceLabel:source.label,targetLabel:target.label};
  }

  constructor(parent: Node, private readonly camera: Camera, private readonly pipelineMaterial: Material,art?:ArtV2Assets,initialLevel=0) {
    this.turtleMaterials=new TurtleMaterialAdapter(pipelineMaterial,['G1_','CC0_']);
    this.root = this.node('战斗三维世界', parent);
    this.actorsRoot = this.node('战斗角色', this.root);
    this.effectRoot = this.node('战斗特效池', this.root);
    this.meshes.set('box', utils.createMesh(primitives.box()));
    this.meshes.set('sphere', utils.createMesh(primitives.sphere(.5, {segments: 16})));
    this.meshes.set('cylinder', utils.createMesh(primitives.cylinder(.5, .5, 1, {radialSegments: 24})));
    this.meshes.set('cone', utils.createMesh(primitives.cone(.5, 1, {radialSegments: 12})));
    this.meshes.set('ring', utils.createMesh(primitives.torus(.5, .035, {radialSegments: 8, tubularSegments: 32})));
    this.meshes.set('rangeRing', utils.createMesh(primitives.torus(.5, .004, {radialSegments: 6, tubularSegments: 96})));
    this.rangePreview=this.surface('伙伴范围提示',this.root,'rangeRing',WHITE,0,TURTLE_FLOOR+.035,0,1,1,1);
    this.rangePreview.active=false;
    for (let i = 0; i < EFFECT_LIMIT; i++) {
      const node = this.surface(`特效复用 ${i + 1}`, this.effectRoot, 'sphere', WHITE, 0, 0, 0, 1, 1, 1);
      node.active = false;
      this.effects.push({node, renderer: node.getComponent(MeshRenderer)!, kind: 'spark', start: new Vec3(), end: new Vec3(), age: 0, duration: 0, size: 1, priority: 0, active: false});
    }
    this.setLevel(initialLevel);
    if(this.root.scene)this.restoreLighting=lightBattle(this.root.scene);
    // Keep the approved map plate, but load real skinned characters above its ground plane.
    if(art?.ready&&art.battleEffect)this.setBattleArt(art);
    const shadows=this.root.scene?.globals.shadows;
    if(shadows){const previous={enabled:shadows.enabled,type:shadows.type,direction:shadows.planeDirection.clone(),height:shadows.planeHeight,bias:shadows.planeBias,color:shadows.shadowColor.clone()};this.restoreShadows=()=>{shadows.enabled=previous.enabled;shadows.type=previous.type;shadows.planeDirection=previous.direction;shadows.planeHeight=previous.height;shadows.planeBias=previous.bias;shadows.shadowColor=previous.color;};shadows.enabled=!softwareRendering();shadows.type=0;shadows.planeDirection=new Vec3(0,1,0);shadows.planeHeight=.041;shadows.planeBias=.003;shadows.shadowColor=new Color(28,48,51,88);}
    this.loadG1Effects();
    for(const key of ['palm','rock','gem','guard-beacon','golem','demon','mako','shark','captain','armored']){
      this.pendingModels++;
      this.resourceQueue.load(`models-cc0/${key}/${key}/${key}`,Prefab,(error,prefab)=>{
        if(this.disposed)return;this.pendingModels--;
        if(error||!prefab){this.modelLoadError=error??new Error(key+'模型未导入');return;}
        prefab.addRef();this.props.set(key,prefab);this.buildTemporaryEnvironment();
      });
    }
    for(const role of Object.keys(TURTLE_MODELS) as Role[]){
      const spec=TURTLE_MODELS[role]!;
      this.resourceQueue.load(spec.path,Prefab,(error,prefab)=>{
        if(this.disposed||!this.root.isValid)return;
        this.pendingModels--;
        try{
          if(error||!prefab)throw error||new Error(`${ROLES[role].name}资源为空`);
          prefab.addRef();this.turtlePrefabs.set(role,prefab);
          for(const actor of this.units.values())if(actor.kind===role)this.attachTurtle(actor);
          for(const actor of this.vfxActors)if(actor.kind===role)this.attachTurtle(actor);
          console.info('[GOWAYGUI_TURTLE]',JSON.stringify({role,path:spec.path}));
        }catch(failure){this.modelLoadError=failure instanceof Error?failure:new Error(String(failure));console.error('[BATTLE_TURTLE_LOAD]',role,failure);}
      });
    }
    for(const role of Object.keys(TURTLE_MODELS) as Role[])for(const weapon of [false,true]){
      this.pendingModels++;const path=`models-g1/${weapon?'advanced-weapons':'advanced'}/${role}/${role}/${role}`;
      this.resourceQueue.load(path,Prefab,(error,prefab)=>{if(this.disposed)return;this.pendingModels--;if(error||!prefab){this.modelLoadError=error??new Error('进阶模型未导入 '+role);return;}prefab.addRef();(weapon?this.advancedWeapons:this.advancedPrefabs).set(role,prefab);for(const actor of [...this.units.values(),...this.vfxActors])if(actor.kind===role&&(actor.fusionRank??1)>=2){if(weapon&&actor.model)this.attachAdvancedWeapon(actor);else this.attachTurtle(actor);}});
    }
    for(const [kind,id] of [['turtle','s01'],['golem','s02']] as const){
      this.resourceQueue.load(`models-g1/summons/${id}/${id}/${id}`,Prefab,(error,prefab)=>{
        if(this.disposed)return;
        if(error||!prefab){console.warn('[BATTLE_SUMMON_LOAD]',kind,error);return;}
        prefab.addRef();this.summonPrefabs.set(kind,prefab);
      });
    }
    for(const kind of Object.keys(ENEMY_MODELS) as EnemyKind[]){
      const spec=ENEMY_MODELS[kind]!;
      this.resourceQueue.load(spec.path,Prefab,(error,prefab)=>{
        if(this.disposed||!this.root.isValid)return;
        this.pendingModels--;
        try{
          if(error||!prefab)throw error||new Error(`${ENEMIES[kind].name}资源为空`);
          prefab.addRef();this.enemyPrefabs.set(kind,prefab);
          for(const actor of this.enemies.values())if(actor.kind===kind&&actor.alive)this.attachEnemy(actor);
          console.info('[GOWAYGUI_ENEMY]',JSON.stringify({kind,path:spec.path}));
        }catch(failure){this.modelLoadError=failure instanceof Error?failure:new Error(String(failure));console.error('[BATTLE_ENEMY_LOAD]',kind,failure);}
      });
    }
  }

  private async loadG1Effects():Promise<void>{
    this.pendingModels++;
    // Own every completed dependency immediately, including a partial batch.
    // A failed/cancelled arrival can then release it through normal world teardown.
    const load=<T extends EffectAsset|Texture2D>(path:string,type:new (...args:any[])=>T)=>new Promise<T>((resolve,reject)=>this.resourceQueue.load(path,type,(e,a)=>{
      if(e||!a){reject(e??new Error(path));return;}a.addRef();this.g1Assets.push(a);resolve(a);
    }));
    const loadApproved=async()=>{const textures=await approvedVfxTextures();
      if(this.disposed){for(const t of textures.values())t.destroy();throw new Error('World retired');}
      for(const t of textures.values()){t.addRef();this.g1Assets.push(t);}return textures;
    };
    try{
      const names=['light_02','flame_01','spark_04','star_04','trace_01','circle_05','cethiel-spells'];
      const [energy,particle,loaded,approved]=await Promise.all([
        load('models-approved/cast-energy',EffectAsset),load('models-g1/g1-particle',EffectAsset),
        Promise.all(names.map(name=>load('models-g1/fx/'+name+'/texture',Texture2D))),loadApproved()
      ]);
      const textures=new Map<string,Texture2D>(names.map((name,i)=>[name,loaded[i]]));
      for(const [key,texture]of approved)textures.set(key,texture);
      if(this.disposed)return;
      this.g1Effects=new G1BattleEffects(this.effectRoot,this.camera,energy,particle,textures,this.pipelineMaterial);
      this.vfxReview=VfxReview.create(this.g1Effects,this);
      for(const actor of this.units.values())if(actor.model)this.g1Effects.attach(actor.model,actor.kind as Role,actor.fusionRank??1);
      for(const actor of this.enemies.values())if(actor.model&&actor.variant)this.g1Effects.attachEnemy(actor.model,actor.variant);
      for(const prop of this.propMotion)if(prop.kind==='guard-beacon')this.g1Effects.attach(prop.node,'crystal');
    }catch(e){if(!this.disposed)this.modelLoadError=e instanceof Error?e:new Error(String(e));}
    finally{if(!this.disposed)this.pendingModels--;}
  }

  /** Call once for each newly entered run, including a restart of the same level. */
  setLevel(levelId: number): void {
    this.legacyModeLayout=false;this.legacyGeometry=false;this.legacyStations=false;this.previousCoast=false;this.expandedLegacy=false;this.paintedLegacy=false;this.themeWave=1;this.themeBoss=0;this.themeIndex=-1;
    if (this.disposed) return;
    if (!BATTLE_MAPS.some(level => level.id === levelId)) throw new Error('战斗场景关卡不存在');
    this.levelId = levelId;
    this.loadLevelFauna(levelId);
    this.rangePreview.active=false;
    this.clearActors(this.units);
    for (const actor of this.retiringEnemies) this.retireNode(actor.node);
    this.retiringEnemies.clear();
    this.clearWave();
    if (!this.environmentPrefab) this.buildTemporaryEnvironment();
  }

  /** Authored prefabs use the same local origin and the 22 × 12 battlefield footprint. */
  setEnvironment(prefab: Prefab): void {
    if (this.disposed || this.environmentPrefab === prefab) return;
    const replacement = instantiate(prefab);
    replacement.name = `正式海岛场景 · ${prefab.name}`;
    replacement.setParent(this.root);
    this.setWorldLayer(replacement);
    receiveIslandShadows(replacement,!softwareRendering());
    this.retireNode(this.environment);
    this.environmentPrefab?.decRef();
    prefab.addRef(); this.environmentPrefab = prefab;
    this.environment = replacement;
    this.surface('海面',replacement,'box','#599DA6',0,-1.12,0,64,.12,48);
  }

  slotWorld(slot: number): Vec3 {
    const point = this.mapDefinition.slots[slot];
    if (!point) throw new Error('战斗站位不存在');
    return Vec3.transformMat4(new Vec3(), new Vec3(point.x, TURTLE_FLOOR, point.z), this.root.worldMatrix);
  }

  /** A single reusable circle for planning; never changes target selection or collision. */
  showRange(slot:number|null,radius=0,healing=false,location?:{x:number;z:number}):void{
    if(this.disposed)return;
    const point=location??(slot===null?undefined:this.mapDefinition.slots[slot]);
    this.rangePreview.active=!!point&&Number.isFinite(radius)&&radius>0;
    if(!this.rangePreview.active||!point)return;
    this.rangePreview.setPosition(point.x,TURTLE_FLOOR+.035,point.z);
    this.rangePreview.setScale(radius*2,1,radius*2);
    this.rangePreview.getComponent(MeshRenderer)!.setMaterial(this.material(healing?HEAL:WHITE),0);
  }

  tintRange(valid:boolean):void{this.rangePreview.getComponent(MeshRenderer)!.setMaterial(this.material(valid?'#75DDAC':'#ED897B'),0);}
  /** Freeze both engine-driven skeletons and our presentation timers immediately. */
  setPaused(paused: boolean): void {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    for (const actors of [this.units, this.enemies, this.retiringEnemies]) for (const actor of actors.values()) {
      for (const animation of actor.animations) {
        if (paused) animation.pause(); else animation.resume();
      }
    }
  }
  setPlaybackSpeed(speed:number):void{
    if(this.disposed||!Number.isFinite(speed)||speed<=0||this.playbackSpeed===speed)return;
    this.playbackSpeed=speed;
    for(const actors of [this.units,this.enemies,this.retiringEnemies])for(const actor of actors.values())
      for(const animation of actor.animations)for(const clip of animation.clips){if(!clip)continue;const state=animation.getState(clip.name);if(state)state.speed=speed*(actor.animationRates?.get(clip.name)??1);}
  }

  /** Preparation/between-wave sync also restores defeated turtles to their stations. */
  syncRunUnits(runUnits: RunTurtle[]): void {
    if (this.disposed) return;
    const definition=BATTLE_MAPS[this.levelId],occupied:{x:number;z:number}[]=[];
    const present = new Set<string>();
    for (const unit of runUnits) {
      if (unit.consumedBy || unit.removed || unit.slot === null) continue;
      const requested=unit.placement??definition.slots[unit.slot];
      // Older saves may contain a free point from the pre-theme geometry. Repair
      // that point before the first frame and carry the repaired placement into
      // the next wave, so a turtle never starts on a road, prop, or water.
      const position=(!requested||placementIssue(definition,requested,occupied))
        ? definition.slots.find(p=>!placementIssue(definition,p,occupied))??requested
        : requested;
      if (!position) continue;
      if(!unit.placement||unit.placement.x!==position.x||unit.placement.z!==position.z)unit.placement={...position};
      occupied.push(position);
      present.add(unit.id);
      const actor = this.unitActor(unit.id, unit.turtle.role,unit.turtle.skills.length,unit.fusionRank??1);
      if(actor.qualityRing){this.painted?.soulColor(actor.qualityRing,turtleQuality(unit.turtle).color);}
      const moved=actor.station!==unit.slot||Math.hypot(actor.x-position.x,actor.z-position.z)>.05;
      if(moved){actor.station=unit.slot;actor.arrivalTime=1.65;}
      actor.alive = true; actor.deathTime = 0; actor.hitTime = 0; actor.actionTime = 0;
      actor.x = position.x; actor.z = position.z;
      actor.yaw = actor.targetYaw = 0;
      actor.node.active = true;
      actor.node.setPosition(actor.x, actor.floor, actor.z);
      actor.body.setPosition(0, 0, 0); actor.body.setScale(1, 1, 1);
      actor.body.setRotationFromEuler(0, actor.yaw, 0);
      actor.shieldRing.active = false; actor.control.active = false;
      this.health(actor, 1, 0, 0, 0);
      this.play(actor, moved&&actor.realModel?'greeting':'idle', true);
    }
    for (const [id, actor] of this.units) if (!present.has(id)) { this.retireNode(actor.node); this.units.delete(id); }
    this.clearWave(true);
    this.billboardBars();
  }

  get hasPendingExits(): boolean { return this.retiringEnemies.size > 0; }

  /** Finish visual exits between waves without advancing rules or delaying committed rewards. */
  updatePresentation(dt: number): void {
    if (this.disposed || this.paused) return;
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.advanceRetiring(elapsed);
    for(const actor of this.units.values()){if(actor.paint){actor.phase+=elapsed;actor.body.setRotationFromEuler(0,0,0);actor.arrivalTime=Math.max(0,(actor.arrivalTime??0)-elapsed);const f=actor.arrivalTime>1.30?1:actor.arrivalTime>.35?2:actor.arrivalTime>0?3:0;this.painted?.pose(actor.paint,actor.kind,f);actor.body.setPosition(0,0,0);actor.body.setScale(1-Math.sin(actor.phase*1.7)*.005,1+Math.sin(actor.phase*1.7)*.016,1);if(actor.qualityRing)actor.qualityRing.setRotationFromEuler(-90,0,0);this.painted?.face(actor.paint);}}
    this.tickEffects(Math.min(.1, elapsed));
    this.tickFloating(Math.min(.1, elapsed));
    this.painted?.update(Math.min(.1,elapsed));
    if(this.vfxReview)this.vfxReview.update(Math.min(.1,elapsed));else this.g1Effects?.update(Math.min(.1,elapsed));this.animateProps(Math.min(.1,elapsed));
    for(const actor of this.units.values())if(actor.realModel&&actor.action==='greeting'){actor.actionTime=Math.max(0,actor.actionTime-elapsed);if(!actor.actionTime)this.play(actor,'idle',true);}
    this.billboardBars();
  }

  private advanceRetiring(dt: number): void {
    for (const actor of this.retiringEnemies) {
      actor.deathTime += actor.realModel ? dt : Math.min(.1, dt);
      if (!actor.node.isValid || actor.deathTime >= actor.exitDuration) {
        this.recycleEnemy(actor); this.retiringEnemies.delete(actor); continue;
      }
      actor.hitTime = Math.max(0, actor.hitTime - dt);
      const fall = clamp(actor.deathTime / .4), scale = actor.realModel ? 1 : Math.max(.04, 1 - fall * .8);
      const pulse=actor.paint&&actor.actionTime>0?Math.sin(Math.min(1,actor.actionTime/.35)*Math.PI)*.055:0;
    actor.body.setScale(scale*(1-pulse),scale*(1+pulse),scale);
    if(actor.paint)actor.paint.setScale(actor.friendly?(Math.sin(actor.yaw*Math.PI/180)>0?1:-1):(Math.sin(actor.yaw*Math.PI/180)>0?-1:1),1,1);
      actor.body.setPosition(actor.hitTime > 0 ? Math.sin(actor.hitTime * 60) * .045 : 0, actor.realModel ? 0 : -fall * .13, 0);
      actor.body.setRotationFromEuler(0, actor.yaw, actor.realModel ? 0 : fall * 65);
    }
  }

  update(battle: BattleState, events: BattleEvent[], dt: number): void {
    this.coastTrial=battle.expedition?.coastTrial===1;
    if (this.disposed) return;
    if (battle.levelId !== this.levelId) this.setLevel(battle.levelId);
    const fixed=battle.formationVersion===2;if(fixed!==this.fixedStations){this.fixedStations=fixed;this.buildTemporaryEnvironment();}
    const previousCoast=battle.levelId===0&&battle.stationVersion===2;if(previousCoast!==this.previousCoast){this.previousCoast=previousCoast;this.buildTemporaryEnvironment();}
    const expandedLegacy=battle.levelId!==0&&battle.stationVersion===4;if(expandedLegacy!==this.expandedLegacy){this.expandedLegacy=expandedLegacy;this.buildTemporaryEnvironment();}
    const oldStations=battle.layoutVersion===2&&battle.stationVersion!==2&&battle.stationVersion!==3&&battle.stationVersion!==4&&battle.stationVersion!==5&&battle.stationVersion!==6;if(oldStations!==this.legacyStations){this.legacyStations=oldStations;this.buildTemporaryEnvironment();}
    // A themed map is presentation-only: keep legacy combat geometry while
    // allowing the themed terrain renderer to use the unchanged live route.
    const oldGeometry=battle.layoutVersion!==2&&!this.mapDefinition.sceneArt;if(this.legacyGeometry!==oldGeometry){this.legacyGeometry=oldGeometry;this.buildTemporaryEnvironment();}
    const oldPaint=battle.stationVersion===5;
    this.themeWave=battle.wave;this.themeBoss=battle.enemies.find(e=>e.worldBossIndex!==undefined)?.worldBossIndex??0;
    if(battle.levelId===50&&typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)){
      const query=runtimeQuery(),reviewWave=Number(query.get('themeWave'));
      if(query.get('preview')==='all-maps'&&[1,6,11,16,21].includes(reviewWave))this.themeWave=reviewWave;
    }
    const theme=battleThemeIndex(battle.levelId,this.themeWave,this.themeBoss);
    if(oldPaint!==this.paintedLegacy||theme!==this.themeIndex){this.paintedLegacy=oldPaint;this.themeIndex=theme;this.buildTemporaryEnvironment();}
    const oldLayout=!!BATTLE_MAPS[this.levelId].routes&&!battle.routes;
    if(this.legacyModeLayout!==oldLayout){this.legacyModeLayout=oldLayout;this.environment?.destroy();this.buildTemporaryEnvironment();}
    const key = battle.rulesVersion==='0.6'?`${battle.levelId}/${battle.wave}`:`${battle.levelId}/${battle.wave}/${battle.units.map(unit => unit.id).join(',')}`;
    if (key !== this.waveKey || battle.tick < this.lastTick) { this.clearWave(); this.g1Effects?.clearTransient();this.waveKey = key; }
    const tickChanged = battle.tick !== this.lastTick;
    this.lastTick = battle.tick;
    // Skeletons receive the engine's full dt. Only procedural interpolation is capped.
    const elapsed = !this.paused && Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const frame = Math.min(.1, elapsed);
    this.advanceRetiring(elapsed);
    const present = new Set<string>();
    for (const unit of battle.units) {
      const actor = this.unitActor(unit.id, unit.role,unit.skills.length,unit.fusionRank??1);
      present.add(unit.id);
      actor.skills=unit.skills;this.syncActor(actor, unit, frame, tickChanged, elapsed);if(actor.qualityRing&&unit.fusionRank!==3&&unit.qualityTier!==undefined)this.painted?.soulColor(actor.qualityRing,QUALITY_COLORS[unit.qualityTier]??QUALITY_COLORS[0]);
      this.health(actor, unit.hp / unit.maxHp, unit.shield / unit.maxHp, unit.hp, unit.maxHp);
    }
    for(const pet of battle.summons??[]){
      if(!pet.alive)continue;let actor=this.units.get(pet.id);
      const dedicated=this.summonPrefabs.get(pet.kind);
      if(actor&&dedicated&&actor.summonKind!==pet.kind){this.retireNode(actor.node);this.units.delete(pet.id);actor=undefined;}
      if(!actor){
        if(dedicated){
          actor=this.createActor(pet.id,pet.kind==='golem'?'stone':'bubble',true);
          for(const child of [...actor.body.children])child.destroy();
          const model=instantiate(dedicated);model.setParent(actor.body);model.setScale(.72,.72,.72);
          this.setWorldLayer(model);receiveIslandShadows(model,!softwareRendering());this.turtleMaterials.apply(model);
          actor.model=model;actor.realModel=true;actor.summonKind=pet.kind;actor.animations=prepareBattleRig(model);
          actor.height=1.55;actor.bar.setPosition(0,actor.height,0);actor.floor=TURTLE_FLOOR;
          this.painted?.shadow(actor.node,true);this.units.set(pet.id,actor);this.play(actor,'idle',true);
        }else if(pet.kind==='golem'){
          actor=this.createActor(pet.id,'stone',true);for(const child of [...actor.body.children])child.destroy();
          const summonPrefab=this.props.get('golem');
          if(summonPrefab){
            const model=instantiate(summonPrefab);model.setParent(actor.body);model.setScale(.77,.77,.77);this.painted?.shadow(actor.node,true);this.setWorldLayer(model);receiveIslandShadows(model,!softwareRendering());this.turtleMaterials.apply(model);
            actor.model=model;actor.realModel=true;actor.animations=prepareBattleRig(model);
            actor.height=1.95;actor.bar.setPosition(0,actor.height,0);actor.floor=TURTLE_FLOOR;this.units.set(pet.id,actor);this.play(actor,'idle',true);
          }else{
          const rock=(name:string,x:number,y:number,z:number,w:number,h:number,d:number)=>this.surface(name,actor!.body,'box','#71858A',x,y,z,w,h,d);
          rock('石人胸甲',0,.85,0,.85,.9,.55);rock('石人头',0,1.55,.02,.55,.52,.46);
          for(const sign of [-1,1]){rock('肩部',sign*.55,1.05,0,.42,.45,.44);rock('拳臂',sign*.65,.6,.08,.35,.65,.35);rock('石腿',sign*.25,.26,0,.37,.55,.4);this.surface('青光眼',actor.body,'sphere','#8AEFE4',sign*.14,1.61,.26,.085,.07,.045);}
          this.surface('通灵之心',actor.body,'sphere','#72E3DF',0,1.02,.3,.24,.27,.08);actor.height=2;actor.bar.setPosition(0,2,0);this.units.set(pet.id,actor);
          }
        }else actor=this.unitActor(pet.id,'bubble');
      }
      present.add(pet.id);this.syncActor(actor,{...pet,statuses:[]} as unknown as BattleUnit,frame,tickChanged,elapsed);
      if(actor.paint&&pet.kind==='golem')this.painted?.pose(actor.paint,'golem',actor.actionTime>.1?2:0);
      const scale=pet.kind==='golem'?.72:.43;actor.node.setScale(scale,scale,scale);
      const fall=pet.kind==='golem'?Math.max(0,1-(battle.tick-pet.bornTick)/10)*4:0;actor.node.setPosition(pet.x,actor.floor+fall,pet.z);
      this.health(actor,pet.hp/pet.maxHp,pet.kind==='golem'?1:0,pet.hp,pet.maxHp);
    }
    for (const [id, actor] of this.units) if (!present.has(id)) { this.retireNode(actor.node); this.units.delete(id); }
    // Keep checkpoint history intact, but render only living/retiring actors.
    // A restored snapshot is a new object and invalidates this presentation cache.
    if(this.enemyFrameState!==battle||this.enemyFrameTick!==battle.tick||this.enemyFrameCount!==battle.enemies.length){
      this.enemyFrameState=battle;this.enemyFrameTick=battle.tick;this.enemyFrameCount=battle.enemies.length;
      this.enemyFrameEntities=battle.enemies.filter(e=>e.alive||this.enemies.has(e.id));
    }
    for (const enemy of this.enemyFrameEntities) {
      let actor = this.enemies.get(enemy.id);
      if (!actor) {
        // Dead enemies in a restored snapshot need no model or repeated exit animation.
        if(!enemy.alive)continue;
        const index=enemy.worldBossIndex??Math.max(0,BOSSES.findIndex(b=>b.id===enemy.bossId));
        const ordinal=Number(enemy.id.split('-').slice(-1)[0])||0;
        const variant=enemy.worldBossIndex!==undefined?worldVisualKey(enemy.worldBossIndex):enemy.kind==='boss'?bossVisualKey(index):enemyModelFor(battle.levelId,enemy.kind,ordinal).key;
        if(!enemy.turtleRole&&!enemy.mechanismOwner&&!this.faunaPrefabs.has(variant))this.loadLevelFauna(battle.levelId,[variant]);
        actor = enemy.mechanismOwner?this.createActor(enemy.id,'snail',false):enemy.turtleRole?this.createActor(enemy.id,enemy.turtleRole,false):this.acquireEnemy(enemy.id,enemy.kind,variant);
        this.enemies.set(enemy.id, actor);
        if(enemy.turtleRole)this.attachTurtle(actor);else if(enemy.mechanismOwner){
          for(const child of [...actor.body.children])child.destroy();
          this.surface('回潮机关底座',actor.body,'cylinder','#37616C',0,.14,0,.8,.28,.8);
          this.surface('回潮机关晶心',actor.body,'sphere','#52E0BA',0,.75,0,.58,1.05,.58);
          this.surface('回潮机关环',actor.body,'ring','#FFE5AD',0,.72,0,1.05,1,1.05);actor.height=1.65;actor.bar.setPosition(0,actor.height,0);
        }else this.attachEnemy(actor);
      }
      this.syncActor(actor, enemy, frame, tickChanged, elapsed);
      if(enemy.turtleRole)actor.skills=enemy.turtleSkills??[];
      const grade=enemyG1Grade(battle.levelId,battle.wave),boss=BOSSES.find(b=>b.id===enemy.bossId);
      const world=enemy.worldBossIndex===undefined?undefined:WORLD_BOSSES[((enemy.worldBossIndex%4)+4)%4];
      if(actor.model&&!enemy.turtleRole){
        const tier=world?6:boss?.tier??grade,colour=world?.color??boss?.color??ENEMY_G1_GRADES[grade].color;
        this.faunaRadiance.apply(actor.model,tier,colour,enemy.kind==='boss'||enemy.kind==='elite',actor.variant);
        this.faunaAura.apply(actor.node,actor.height,faunaAuraGrade(enemy.kind,battle.levelId,boss?.tier,!!world,battle.wave),enemy.kind==='boss',enemy.alive);
      }
      if(actor.realModel&&enemy.kind==='boss'){
        const size=world?1.92:boss?.tier===5?1.62:ENEMY_G1_GRADES[Math.min(4,boss?.tier??grade)].scale;
        actor.node.setScale(size,size,size);
      }else if(actor.realModel&&enemy.kind==='elite'){
        const size=1+(ENEMY_G1_GRADES[grade].scale-1)*.6;actor.node.setScale(size,size,size);
      }
      if(enemy.worldBossIndex!==undefined&&actor.paint){this.painted?.worldBoss(actor.paint,enemy.worldBossIndex);actor.node.setScale(1,1,1);actor.height=3.4;actor.node.getChildByName('落地接触')?.setScale(2.6,.72,1);actor.node.getChildByName('日照投影')?.setScale(2.4,.82,1);}
      else if(enemy.bossId&&actor.paint){const index=BOSSES.findIndex(b=>b.id===enemy.bossId);if(index>=0){this.painted?.boss(actor.paint,index);const size=BOSSES[index].size*(battle.mode==='chapter'&&battle.wave!==5?.88:1);actor.node.setScale(size,size,size);}}
      if(actor.paint)this.painted?.animateEnemy(actor.paint,actor.moving&&actor.alive&&!enemy.statuses.some(s=>s.kind==='stun'||s.kind==='sheep'),actor.phase,enemy.worldBossIndex!==undefined?2.1:enemy.kind==='boss'?4.2:enemy.kind==='runner'?13:8);
      if(!actor.alive&&!actor.node.active){this.recycleEnemy(actor);this.enemies.delete(enemy.id);continue;}
      this.health(actor, enemy.hp / enemy.maxHp, 0, enemy.hp, enemy.maxHp);
    }
    // A resume may supply historical events. State is current; old audiovisual events are expendable.
    let processed = 0;
    for (let i = Math.max(0, events.length - 160); i < events.length; i++) {
      const event = events[i];
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (event.tick < battle.tick - 8 || ++processed > 120) continue;
      this.event(event);
    }
    this.tickEffects(frame);
    this.tickFloating(frame);
    this.painted?.update(frame);
    if(this.vfxReview)this.vfxReview.update(frame);else this.g1Effects?.update(frame);this.faunaRadiance.update(frame);this.faunaAura.update(frame);this.animateProps(frame);
    this.billboardBars();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.restoreShadows?.();this.restoreShadows=undefined;
    this.restoreLighting?.();this.restoreLighting=undefined;
    this.vfxReview?.destroy();this.vfxReview=undefined;
    this.resourceQueue.destroy();this.g1Effects?.destroy();this.g1Effects=undefined;for(const a of this.g1Assets)a.decRef();this.g1Assets.length=0;
    this.painted?.destroy();this.painted=undefined;
    this.rankVisuals.destroy();this.faunaAura.destroy();this.faunaRadiance.destroy();this.turtleMaterials.destroy();
    for(const actor of this.vfxActors)this.retireNode(actor.node);this.vfxActors.length=0;
    this.retireNode(this.root);
    this.units.clear(); this.enemies.clear(); this.retiringEnemies.clear();this.enemyPool.clear(); this.effects.length = 0;
    this.environmentPrefab?.decRef();
    for(const prefab of this.turtlePrefabs.values())prefab.decRef();
    this.turtlePrefabs.clear();
    for(const prefab of this.advancedPrefabs.values())prefab.decRef();this.advancedPrefabs.clear();
    for(const prefab of this.advancedWeapons.values())prefab.decRef();this.advancedWeapons.clear();
    for(const prefab of this.summonPrefabs.values())prefab.decRef();this.summonPrefabs.clear();
    for(const prefab of this.enemyPrefabs.values())prefab.decRef();
    this.enemyPrefabs.clear();
    for(const prefab of this.faunaPrefabs.values())prefab.decRef();this.faunaPrefabs.clear();
    for(const p of this.props.values())p.decRef();this.props.clear();
    for (const mesh of this.meshes.values()) mesh.destroy();
    for (const material of this.materials.values()) material.destroy();
    this.meshes.clear(); this.materials.clear();
  }

  private node(name: string, parent: Node): Node {
    const node = new Node(name); node.layer = Layers.Enum.DEFAULT; node.setParent(parent); return node;
  }
  private setWorldLayer(node: Node): void { node.layer = Layers.Enum.DEFAULT; for (const child of node.children) this.setWorldLayer(child); }
  private retireNode(node?: Node): void { if (node?.isValid) { node.active = false; node.removeFromParent(); node.destroy(); } }
  private material(hex: string): Material {
    let material = this.materials.get(hex);
    if (!material) {
      material = new Material(); material.copy(this.pipelineMaterial);
      const color = new Color(); Color.fromHEX(color, hex);
      material.setProperty('mainColor', color); material.setProperty('roughness', .78);
      this.materials.set(hex, material);
    }
    return material;
  }
  private surface(name: string, parent: Node, shape: Shape, hex: string, x: number, y: number, z: number, sx: number, sy: number, sz: number): Node {
    const node = this.node(name, parent); node.setPosition(x, y, z); node.setScale(sx, sy, sz);
    const renderer = node.addComponent(MeshRenderer); renderer.mesh = this.meshes.get(shape)!; renderer.setMaterial(this.material(hex), 0);
    return node;
  }

  private buildTemporaryEnvironment(): void {
    if(!this.legacyGeometry||this.painted&&this.levelId===54){
      this.retireNode(this.environment);
      const base=this.node('现代海岛 · 清爽战场',this.root);this.environment=base;
      if(this.painted&&!this.legacyStations){
        if(this.levelId===0&&!this.mapDefinition.sceneArt)this.painted.ground(base,!this.previousCoast);else this.painted.themedGround(base,this.mapDefinition,true,this.themeWave,this.themeBoss);
        if(this.fixedStations)for(const [i,p] of expeditionSlots(this.levelId).entries())this.painted.station(base,p.x,p.z,!this.ownedStations||this.ownedStations.has(i));
        this.addG1Scenery(base);
        return;
      }
      const textured=this.levelId===0&&!!this.terrainTexture;
      const mesh=modernIslandMesh(this.mapDefinition,textured),old=this.meshes.get('terrain');this.meshes.set('terrain',mesh);old?.destroy();
      const terrain=this.node('海岸与路线合批',base),renderer=terrain.addComponent(MeshRenderer);renderer.mesh=mesh;
      const key=textured?'premium-terrain':'modern-terrain';
      let material=this.materials.get(key);if(!material){material=new Material();material.copy(this.pipelineMaterial,{defines:{USE_VERTEX_COLOR:true,USE_ALBEDO_MAP:textured}});material.setProperty('mainColor',Color.WHITE);material.setProperty('roughness',.85);if(textured)material.setProperty('mainTexture',this.terrainTexture!);this.materials.set(key,material);}renderer.setSharedMaterial(material,0);
      this.oceanNode=this.surface('远海',base,'box','#30B5D3',0,-1,0,80,.12,65);
      if(this.ocean)this.oceanNode.getComponent(MeshRenderer)!.setSharedMaterial(this.ocean,0);
      const route=this.mapDefinition.route,p=route[route.length-1];
      this.surface('珍珠台',base,'cylinder','#F0DEC0',p.x,.18,p.z,1.3,.3,1.3);
      this.surface('守护珍珠',base,'sphere','#FFF2CD',p.x,.72,p.z,.78,.78,.78);
      if(textured){
        this.surface('珍珠台青玉边',base,'ring','#6CCBC9',p.x,.36,p.z,1.36,.5,1.36);
        for(let i=0;i<7;i++){const a=i*Math.PI/6;const petal=this.surface('贝壳瓣',base,'sphere','#F8E8CA',p.x+Math.cos(a)*.48,.42+Math.sin(a)*.18,p.z+.38,.26,.64,.18);petal.setRotationFromEuler(0,0,55-i*18);}
        const start=route[0];const gate=this.surface('潮汐入口',base,'ring','#48D4DF',start.x,.72,start.z-.25,1.3,1.3,1.3);gate.setRotationFromEuler(90,0,0);
        for(const dx of [-.72,.72])this.surface('入口石柱',base,'cylinder','#E6D4B3',start.x+dx,.46,start.z-.25,.25,.92,.25);
      }
      return;
    }
    this.retireNode(this.environment);
    const base = this.node('临时场景资源 · 战斗底盘与路线', this.root);
    this.environment = base;
    this.surface('临时海面', base, 'box', '#599DA6', 0, -.55, 0, 34, .12, 23);
    this.surface('临时海岛底盘 22×12', base, 'box', '#BCAD81', 0, -.28, 0, 22, .5, 12);
    this.surface('临时草地', base, 'box', '#829567', 0, -.015, 0, 21.6, .08, 11.6);
    const level = this.mapDefinition;
    const routes=this.legacyModeLayout?[level.route]:level.routes??[level.route];
    for(const route of routes)for (let i = 0; i < route.length; i++) {
      const point = route[i];
      this.surface(`临时砂路连接 ${i + 1}`, base, 'cylinder', '#DCC493', point.x, .024, point.z, 1.5, .08, 1.5);
      if (i === 0) continue;
      const previous = route[i - 1], dx = point.x - previous.x, dz = point.z - previous.z;
      const road = this.surface(`临时砂路 ${i}`, base, 'box', '#DCC493', (point.x + previous.x) / 2, .024, (point.z + previous.z) / 2, 1.5, .08, Math.hypot(dx, dz));
      road.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
    }
    (this.legacyModeLayout?level.legacySlots??level.slots:level.slots).forEach((point, i) => {
      this.surface(`临时站位 ${i + 1}`, base, 'cylinder', '#9A967A', point.x, .142, point.z, 1.65, .30, 1.65);
      this.surface(`站位 ${i + 1} 边线`, base, 'ring', '#E9D4A6', point.x, .30, point.z, 1.6, .65, 1.6);
    });
    const goal = routes[0][routes[0].length - 1];
    this.surface('临时珍珠底座', base, 'cylinder', '#8CBAAA', goal.x, .19, goal.z, 1.25, .24, 1.25);
    this.surface('临时守护珍珠', base, 'sphere', WHITE, goal.x, .75, goal.z, .82, .82, .82);
  }

  private addG1Scenery(base:Node):void{
    if(this.mapDefinition.sceneArt?.startsWith('map-mode-scene-')){this.propMotion=[];this.painted?.modeLandmarkGlow(base,this.mapDefinition);return;}
    this.propMotion=[];
    const add=(key:string,x:number,z:number,height:number,phase:number)=>{
      const prefab=this.props.get(key);if(!prefab)return;
      const node=instantiate(prefab);node.setParent(base);node.setPosition(x,.036,z);
      const native=key==='palm'?3.3:key==='rock'?.9:key==='gem'?.55:key==='guard-beacon'?1.15:1.9,s=height/native;node.setScale(s,s,s);node.setRotationFromEuler(0,phase*47,0);
      this.setWorldLayer(node);receiveIslandShadows(node,!softwareRendering());this.turtleMaterials.apply(node);this.propMotion.push({node,kind:key,phase});return node;
    };
    for(const [i,p] of mapProps(this.mapDefinition).entries())add([4,8,9,11].includes(p.tile)?'gem':[0,1,2,10].includes(p.tile)?'palm':'rock',p.x,p.z,p.height,i*1.73);
    // Match existing obstacle coordinates in the approved first-map art.
    // The coast-stage backgrounds already contain their rocks and shoreline
    // props. Do not add the legacy tutorial obstacles on top of them (they
    // could occupy a recommended station and make a turtle look road-bound).
    if(this.levelId===0&&!this.mapDefinition.sceneArt?.startsWith('map-coast-stage-')){
      for(const [i,p] of [{x:-4.64,z:-2.26},{x:-1.46,z:-3.39},{x:.48,z:-3.39}].entries())add(i===0?'rock':'gem',p.x,p.z,i===0?.44:.50,i+1);
    }
    if(this.levelId!==56){
      const goal=this.levelId===55&&!this.mapDefinition.sceneArt?{x:0,z:0}:this.mapDefinition.route[this.mapDefinition.route.length-1];
      this.addPearl(base,goal.x,goal.z);
    }
  }
  private addPearl(parent:Node,x:number,z:number):void{
    if(this.painted){
      // The five approved 初晴海湾 backgrounds already contain the confirmed
      // pearl artwork; avoid drawing a second shell over the baked target.
      if(this.mapDefinition.sceneArt?.startsWith('map-coast-stage-'))return;
      this.painted.guard(parent,this.mapDefinition);
      return;
    }
    const shell=new Node('贝壳珍珠 · 怪物终点');shell.setParent(parent);shell.setPosition(x,.03,z);
    this.surface('金色贝缘',shell,'sphere','#DFAF70',0,.14,0,1.30,.22,.92);
    this.surface('柔粉贝心',shell,'sphere','#F4DADC',0,.22,0,1.16,.15,.80);
    for(let i=-3;i<=3;i++){
      const a=i*.31;
      const edge=this.surface('扇贝金边',shell,'sphere','#E6BE85',Math.sin(a)*.44,.45+Math.cos(a)*.35,-.32,.32,.78,.16);
      edge.setRotationFromEuler(-20,0,-i*18);
      const petal=this.surface('珠母贝瓣',shell,'sphere',i%2?'#D7C7E9':'#F1DCE6',Math.sin(a)*.43,.45+Math.cos(a)*.35,-.225,.25,.69,.13);
      petal.setRotationFromEuler(-20,0,-i*18);
    }
    const pearl=this.surface('悬浮海心珍珠',shell,'sphere','#DFFBFF',0,.66,.06,.62,.62,.62);
    this.surface('珠光暖晕',pearl,'sphere','#F8E8FB',.02,-.16,.37,.65,.35,.20);
    this.surface('珍珠高光',pearl,'sphere','#FFFFFF',-.20,.30,.32,.30,.23,.12);
    this.propMotion.push({node:pearl,kind:'pearl',phase:0});
    const ring=this.surface('潮光环',shell,'ring','#80DCEB',0,.022,0,1.10,.012,1.10);
    this.propMotion.push({node:ring,kind:'pearl-glow',phase:0});
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      const mote=this.surface('珍珠微光',shell,'sphere','#E6FFFF',Math.cos(a)*.68,.28+i*.11,Math.sin(a)*.46,.045,.045,.045);
      this.propMotion.push({node:mote,kind:'pearl-mote',phase:a});
    }
  }
  private animateProps(dt:number):void{
    this.sceneTime+=dt;
    for(const p of this.propMotion){if(!p.node.isValid)continue;const t=this.sceneTime+p.phase;
      if(p.kind==='palm')p.node.setRotationFromEuler(Math.sin(t*.8)*1.1,p.phase*47,Math.cos(t*.65)*1.3);
      if(p.kind==='pearl-mote')p.node.setPosition(Math.cos(t*.45)*.68,.25+(Math.sin(t*.8)+1)*.40,Math.sin(t*.45)*.46);
      if(p.kind==='pearl'){p.node.setPosition(p.node.position.x,.66+Math.sin(t*1.6)*.055,p.node.position.z);const s=1+Math.sin(t*2)*.025;p.node.setScale(.62*s,.62*s,.62*s);}
      if(p.kind==='pearl-glow'){const s=1.10+Math.sin(t*1.6)*.045;p.node.setScale(s,.012,s);p.node.setRotationFromEuler(0,t*8,0);}
      if(p.kind==='gem')p.node.setRotationFromEuler(0,p.phase*47+this.sceneTime*10,Math.sin(t*1.4)*2);
    }
  }

  private clearActors(actors: Map<string, Actor>): void { for (const actor of actors.values()) this.retireNode(actor.node); actors.clear(); }
  private acquireEnemy(id:string,kind:EnemyKind,variant?:string):Actor{
    const actor=this.enemyPool.get(kind+'/'+(variant??''))?.pop();
    if(!actor){const fresh=this.createActor(id,kind,false);fresh.variant=variant;return fresh;}
    Object.assign(actor,{id,alive:true,moving:false,x:0,z:0,motionX:undefined,motionZ:undefined,motionTick:undefined,walkRate:1,yaw:90,targetYaw:90,hitTime:0,actionTime:0,deathTime:0,action:'idle'});
    actor.node.active=true;actor.node.setScale(1,1,1);actor.body.setScale(1,1,1);actor.body.setPosition(0,0,0);actor.control.active=false;actor.shieldRing.active=false;actor.bar.active=true;
    this.play(actor,'walk',true);return actor;
  }
  private loadLevelFauna(level:number,extra:string[]=[]):void{
    const required=new Set<string>([...g1EnemyAssetKeys(level),...extra]);
    for(const key of required){
      if(this.faunaPrefabs.has(key)||this.faunaLoading.has(key))continue;
      this.faunaLoading.add(key);this.pendingModels++;
      this.resourceQueue.load(enemyG1(key)?.model??`models-fauna/${key}/${key}/${key}`,Prefab,async (error,prefab)=>{
        if(this.disposed)return;
        try{
          if(error||!prefab)throw error??new Error(key+'怪物资源未完成');
          prefab.addRef();this.faunaPrefabs.set(key,prefab);
          // Surface detail maps are optional. Several authored bosses only ship their albedo atlas.
          const normalPath=`models-fauna/${key}/${key}_normal/texture`,surfacePath=`models-fauna/${key}/${key}_surface/texture`;
          if(resources.getInfoWithPath(normalPath,Texture2D)&&resources.getInfoWithPath(surfacePath,Texture2D)){
            const loadSurface=(path:string)=>new Promise<Texture2D>((resolve,reject)=>this.resourceQueue.load(path,Texture2D,(e,t)=>{
              if(e||!t){reject(e??new Error(path));return;}t.addRef();this.g1Assets.push(t);resolve(t);
            }));
            const [normal,surface]=await Promise.all([loadSurface(normalPath),loadSurface(surfacePath)]);
            if(this.disposed)return;this.turtleMaterials.registerSurface(key,normal,surface);
          }
          if(this.disposed)return;
          for(const actor of [...this.enemies.values(),...this.vfxActors])if(actor.variant===key&&actor.alive)this.attachEnemy(actor);
          // World-boss keys have their own presentation records and do not
          // need the ordinary fauna warm-up actor.  Treat that warm-up as an
          // optional cache step so a valid boss prefab never blocks battle
          // arrival merely because it is not part of the ordinary fauna table.
          const spec=faunaBase(key);
          if(spec){const warm=this.acquireEnemy('warm-'+key,spec.kind,key);this.attachEnemy(warm);this.recycleEnemy(warm);}
        }catch(e){
          // Fauna detail maps and warm-up actors are presentation extras.  A
          // missing optional map must fall back to the authored primitive or
          // base prefab instead of preventing the whole battle from arriving.
          if(!this.disposed)console.warn('[BATTLE_FAUNA_OPTIONAL]',key,e);
        }
        finally{if(!this.disposed){this.pendingModels--;this.faunaLoading.delete(key);}}
      });
    }
  }
  private recycleEnemy(actor:Actor):void{
    if(this.disposed||!actor.node.isValid||TURTLE_MODELS[actor.kind as Role]||!actor.realModel){this.retireNode(actor.node);return;}
    const key=actor.kind+'/'+(actor.variant??''),pool=this.enemyPool.get(key)??[];
    if(pool.includes(actor))return;
    // Keep a bounded pool through waves so a new group doesn't re-upload meshes.
    if(pool.length>=6||Array.from(this.enemyPool.values()).reduce((n,p)=>n+p.length,0)>=64){this.retireNode(actor.node);return;}
    actor.node.active=false;for(const animation of actor.animations)animation.stop();pool.push(actor);this.enemyPool.set(key,pool);
  }
  private clearWave(finishExits = false): void {
    for (const actor of this.enemies.values()) {
      if (finishExits && !actor.alive && actor.node.active && actor.deathTime < actor.exitDuration) this.retiringEnemies.add(actor);
      else this.recycleEnemy(actor);
    }
    this.enemies.clear(); this.waveKey = ''; this.lastTick = -1; this.lastEvent = 0;
    if (!finishExits) for (const effect of this.effects) { effect.active = false; effect.node.active = false; }
  }
  private unitActor(id: string, role: Role,skillCount=0,rank=1): Actor {
    let actor = this.units.get(id);
    if (actor && actor.kind !== role) { this.retireNode(actor.node); this.units.delete(id); actor = undefined; }
    if (!actor) { actor = this.createActor(id, role, true); this.units.set(id, actor); }
    this.setActorRank(actor,rank);this.attachTurtle(actor);
    return actor;
  }
  private setActorRank(actor:Actor,rank:number):void{
    rank=Math.max(1,Math.min(3,rank));if(actor.fusionRank===rank)return;
    actor.fusionRank=rank;actor.realModel=false;actor.animations.forEach(a=>a.stop());actor.animations=[];
    this.retireNode(actor.rankBadge);this.retireNode(actor.rankPedestal);
    actor.rankBadge=this.rankVisuals.badge(actor.bar,rank);actor.rankPedestal=rank===3?this.rankVisuals.pedestal(actor.node,actor.kind as Role):undefined;
  }
  /** Same production models and rank furniture, side by side for local visual checks. */
  stageRankAcceptance(role:Role):void{
    this.beginVfxAcceptance();
    for(const rank of [1,2,3]){
      const id=`rank-review-${role}-${rank}`;let actor=this.vfxActors.find(a=>a.id===id);
      if(!actor){actor=this.createActor(id,role,true);this.vfxActors.push(actor);this.setActorRank(actor,rank);this.attachTurtle(actor);}
      actor.node.active=true;actor.x=-4+(rank-1)*3.4;actor.z=1;actor.node.setPosition(actor.x,actor.floor,actor.z);actor.body.setRotationFromEuler(0,0,0);this.play(actor,'idle',true);
    }
  }
  private createActor(id: string, kind: Role | EnemyKind, friendly: boolean): Actor {
    const name = ROLES[kind as Role]?.name ?? ENEMIES[kind as EnemyKind].name;
    const node = this.node(`${name} · ${id}`, this.actorsRoot), body = this.node('朝向与动作', node);
    const large = kind === 'boss' ? 1.7 : kind === 'elite' ? 1.3 : 1;
    const bar = this.node('生命与护盾', node);
    this.surface('血条背景', bar, 'box', '#182E35', 0, 0, 0, 1.12 * large, .10, .025);
    const fill = this.surface('当前生命', bar, 'box', friendly ? '#91D7A2' : '#F29376', 0, 0, .022, 1.04 * large, .06, .024);
    const shieldFill = this.surface('当前护盾', bar, 'box', SHIELD, 0, -.095, .022, 1.04 * large, .035, .024);
    // Health is information, not a lit 3D surface: identical contrast on every map.
    if(this.hudEffect)for(const [index,n]of bar.children.entries()){
      const hex=index===0?'#182E35':index===1?(friendly?'#91D7A2':'#F29376'):'#93D9EF',key='hud-'+hex;
      let material=this.materials.get(key);if(!material){material=new Material();material.initialize({effectAsset:this.hudEffect,states:{priority:205,depthStencilState:{depthTest:false,depthWrite:false}}});material.setProperty('keyParams',new Vec4(-1,0,0,0));material.setProperty('mainColor',new Color(hex));this.materials.set(key,material);}
      n.getComponent(MeshRenderer)?.setSharedMaterial(material,0);
    }
    const hpTextNode=this.node('当前生命数值',bar);const hpBox=hpTextNode.addComponent(UITransform);hpBox.setContentSize(170*large,26);
    hpTextNode.setPosition(0,.02,.05);const hpLabel=hpTextNode.addComponent(Label);hpLabel.string='';hpLabel.fontSize=11*large;hpLabel.lineHeight=13*large;hpLabel.isBold=true;hpLabel.color=new Color(255,248,224,255);hpLabel.horizontalAlign=Label.HorizontalAlign.CENTER;hpLabel.verticalAlign=Label.VerticalAlign.CENTER;hpLabel.overflow=Label.Overflow.SHRINK;
    const control = this.surface('控制状态标记', node, 'ring', CONTROL, 0, 1.02 * large, 0, .66 * large, 1, .66 * large);
    const shieldRing = this.surface('护盾状态标记', node, 'ring', SHIELD, 0, .075, 0, 1.48 * large, 1, 1.48 * large);
    control.active = false; shieldRing.active = false;
    const actor: Actor = {id, kind, friendly, node, body, bar, fill, shieldFill, control, shieldRing, hpLabel, animations: [], realModel: false, alive: true, moving: false, x: 0, z: 0, floor: TURTLE_MODELS[kind as Role] ? TURTLE_FLOOR : ENEMY_FLOOR, height: 1.2 * large, yaw: friendly ? -90 : 90, targetYaw: friendly ? -90 : 90, phase: this.units.size + this.enemies.size, hitTime: 0, actionTime: 0, action: 'idle', deathTime: 0,exitDuration:.55};
    if(TURTLE_MODELS[kind as Role]){if(!this.turtlePrefabs.has(kind as Role))this.temporaryTurtle(actor,kind as Role);}
    else if(!this.enemyPrefabs.has(kind as EnemyKind))this.temporaryEnemy(actor,kind as EnemyKind,large);
    bar.setPosition(0, actor.height, 0);
    return actor;
  }

  private temporaryTurtle(actor: Actor, role: Role): void {
    const holder = this.node(`临时角色资源 · ${ROLES[role].name} · 等待正式模型`, actor.body), color = ROLES[role].color;
    this.surface('临时身体', holder, 'sphere', color, 0, .4, 0, .98, .68, 1.04);
    this.surface('临时头部', holder, 'sphere', '#BACC97', 0, .42, .55, .56, .49, .55);
    for (const x of [-.4, .4]) for (const z of [-.34, .32]) this.surface('临时脚', holder, 'sphere', '#BACC97', x, .14, z, .28, .22, .35);
    for (const x of [-.13, .13]) this.surface('临时眼点', holder, 'sphere', '#263E40', x, .52, .785, .065, .09, .045);
    if (role === 'spike') {
      for (const x of [-.28, 0, .28]) this.surface('射手职业尖刺', holder, 'cone', '#F0C979', x, .85, -.10, .23, .38, .23);
    } else if (role === 'crystal') {
      const crystal = this.surface('法师职业晶体', holder, 'box', '#B2EBF2', 0, .87, -.06, .31, .47, .31); crystal.setRotationFromEuler(0, 45, 25);
    } else if (role === 'leaf') {
      const leaf = this.surface('治疗职业叶片', holder, 'sphere', '#D2E99A', 0, .84, -.04, .34, .1, .73); leaf.setRotationFromEuler(0, 25, 20);
    } else if (role === 'bubble') {
      this.surface('控制职业泡泡', holder, 'sphere', '#CCEFF1', -.11, .88, -.04, .35, .35, .35);
      this.surface('控制职业小泡泡', holder, 'sphere', '#CCEFF1', .22, .8, -.16, .24, .24, .24);
    }
  }
  private temporaryEnemy(actor: Actor, kind: EnemyKind, size: number): void {
    const holder = this.node(`临时敌人资源 · ${ENEMIES[kind].name} · 等待正式模型`, actor.body), color = ENEMY_COLORS[kind];
    holder.setScale(size, size, size);
    const crab = kind === 'runner' || kind === 'armored' || kind === 'elite' || kind === 'boss';
    this.surface('临时敌人身体', holder, 'sphere', color, 0, .38, 0, crab ? 1 : .8, .7, .84);
    if (crab) {
      for (const x of [-.65, .65]) {
        this.surface('临时蟹钳', holder, 'sphere', color, x, .38, .35, .46, .32, .5);
        for (const z of [-.24, .18]) this.surface('临时蟹腿', holder, 'box', color, x * .85, .14, z, .42, .12, .12);
      }
      if (kind === 'armored') this.surface('临时铁壳', holder, 'box', '#C5C9D0', 0, .69, -.04, .66, .16, .58);
      if (kind === 'boss') this.surface('临时首领标识', holder, 'cone', '#E4C48D', 0, .96, 0, .39, .45, .39);
    } else if (kind === 'snail') {
      this.surface('临时螺壳', holder, 'sphere', '#D2ADA1', 0, .69, -.14, .69, .7, .62);
      this.surface('临时喷口', holder, 'cylinder', '#645472', 0, .35, .49, .28, .4, .28).setRotationFromEuler(90, 0, 0);
    } else if (kind === 'mist') {
      this.surface('临时雾泡顶', holder, 'sphere', '#D0BDDF', .23, .76, 0, .34, .34, .34);
    }
    for (const x of [-.16, .16]) this.surface('临时敌人眼点', holder, 'sphere', WHITE, x, .55, .36, .095, .13, .06);
  }
  private attachTurtle(actor: Actor): void {
    const role=actor.kind as Role,spec=TURTLE_MODELS[role],advanced=(actor.fusionRank??1)>=2,prefab=(advanced?this.advancedPrefabs:this.turtlePrefabs).get(role);
    if (!spec || !prefab || !actor.node.isValid || actor.realModel) return;
    for (const child of [...actor.body.children]) this.retireNode(child);
    const model = instantiate(prefab); model.name = `${ROLES[role].name} · G1 骨骼角色`; model.setParent(actor.body);const modelScale=(advanced?spec.height/2:spec.scale)*fusionModelScale(actor.fusionRank??1);model.setScale(modelScale,modelScale,modelScale);
    this.setWorldLayer(model);
    receiveIslandShadows(model,!softwareRendering());
    this.turtleMaterials.apply(model);
    actor.model=model;actor.animations = advanced?model.getComponentsInChildren(SkeletalAnimation):prepareBattleRig(model);if(advanced)for(const animation of actor.animations)animation.useBakedAnimation=false;
    if(advanced)this.attachAdvancedWeapon(actor);
    actor.realModel = true; actor.height = spec.height*fusionModelScale(actor.fusionRank??1)+.10; actor.bar.setPosition(0, actor.height, 0); actor.control.setPosition(0, spec.controlHeight*fusionModelScale(actor.fusionRank??1), 0);
    actor.floor=TURTLE_FLOOR;actor.bar.setScale(.66,.72,1);this.painted?.shadow(actor.node,true);this.g1Effects?.attach(model,role,actor.fusionRank??1);
    this.play(actor, actor.alive ? 'greeting' : 'rest', true);
  }
  private attachAdvancedWeapon(actor:Actor):void{const role=actor.kind as Role,prefab=this.advancedWeapons.get(role),model=actor.model;if(!prefab||!model||model.getChildByName('进阶武器已挂载'))return;const mark=new Node('进阶武器已挂载');mark.setParent(model);const weapon=instantiate(prefab);weapon.setParent(model);this.setWorldLayer(weapon);this.turtleMaterials.apply(weapon);attachRigidWeapon(model,weapon,role,false);this.g1Effects?.attach(model,role,actor.fusionRank??1);}

  private play(actor: Actor, action: Action, force = false): void {
    if (!force && actor.action === action && actor.actionTime > 0) return;
    actor.action = action; let duration = action === 'attack' ? .35 : action === 'skill' ? .55 : .22;
    const chosen=action==='attack'&&((actor.attackIndex=(actor.attackIndex??0)+1)%2===0)?'attack2':action;
    for (const animation of actor.animations) {
      const matches=(name:string,key:string)=>name===key||name.endsWith(`|${key}`)||name.endsWith(`_${key}`);
      // The production rigs currently ship the approved nine-clip contract.
      // Newer action names stay explicit in the state machine and gracefully
      // fall back to the closest authored clip until a rig receives a bespoke
      // clip (death→exit, cast phases→skill, turn→walk).
      const aliases:Record<string,string[]>={greeting:['idle'],rest:['idle'],death:actor.friendly?['rest','exit']:['death','exit'],castStart:['castStart','skill'],castLoop:['castLoop','skill'],castRelease:['castRelease','skill'],turnL:['turnL','walk'],turnR:['turnR','walk']};
      const candidates=[chosen,...(aliases[action]??[]),action];
      const clip=candidates.reduce<any>((found,key)=>found??animation.clips.find(candidate=>candidate&&matches(candidate.name,key)),undefined);
      if (!clip) continue;
      const state = animation.getState(clip.name);
      const enemyPace=!actor.friendly&&actor.variant?(action==='attack'?clip.duration/(actor.kind==='boss'?.76:.46):action==='skill'?clip.duration/1.15:action==='walk'?(actor.walkRate??1)*clip.duration:1):1;
      (actor.animationRates??=new Map()).set(clip.name,enemyPace);
      if (state){state.wrapMode = action === 'idle' || action === 'walk' || action === 'rest' ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;state.speed=this.playbackSpeed*enemyPace;}
      animation.crossFade(clip.name,action==='hit'?.055:action==='attack'?.085:action==='death'?.10:.16);
      // play() starts a state even if a prior state was paused; this also covers late Prefabs.
      if (this.paused) animation.pause();
      duration = Math.max(duration, clip.duration/enemyPace);
    }
    actor.actionTime = action === 'idle' || action === 'walk' || action === 'rest' ? 0 : duration;
  }
  private attachEnemy(actor:Actor):void{
    const kind=actor.kind as EnemyKind,spec=ENEMY_MODELS[kind],prefab=actor.variant?this.faunaPrefabs.get(actor.variant):this.enemyPrefabs.get(kind);
    if(!spec||!prefab||!actor.node.isValid||actor.realModel||!actor.alive)return;
    for(const child of [...actor.body.children])this.retireNode(child);
    const variant=actor.variant?(this.faunaPrefabs.get(actor.variant)??this.props.get(actor.variant)):undefined;
    const model=instantiate(variant??prefab);model.name=`${ENEMIES[kind].name} · G1 骨骼怪物`;model.setParent(actor.body);model.setScale(spec.scale,spec.scale,spec.scale);
    const fauna=faunaVisual(actor.variant??'');
    let visualHeight=spec.height;
    if(fauna){const height=kind==='boss'?2.0:kind==='elite'?1.25:kind==='armored'?1.15:.94;
      const extent=ENEMY_G1_DIMENSIONS[actor.variant??'']??FAUNA_DIMENSIONS[actor.variant??''],spanLimit=kind==='boss'?2.25:kind==='elite'?1.65:1.45;
      const scale=Math.min(height/fauna.height,extent?spanLimit/Math.max(extent[0],extent[2]):Infinity);
      model.setScale(scale,scale,scale);visualHeight=fauna.height*scale+.12;
    }
    this.setWorldLayer(model);receiveIslandShadows(model,kind==='boss'&&!softwareRendering());this.turtleMaterials.apply(model);
    actor.model=model;prepareEnemyFeatureSockets(model);actor.animations=model.getComponentsInChildren(SkeletalAnimation);const species=enemyG1(actor.variant??'');prepareEnemyLocomotion(actor.animations,species?.rigFamily??'unknown',species?.flying??false);
    if(actor.variant)this.g1Effects?.attachEnemy(model,actor.variant);
    actor.realModel=true;actor.height=visualHeight;actor.floor=ENEMY_FLOOR;
    actor.bar.setPosition(0,actor.height,0);actor.control.setPosition(0,actor.height*.55,0);
    this.painted?.shadow(actor.node,false);
    const base=faunaBase(actor.variant??''),floating=base?.flying??false;
    if(floating)actor.floor+=.12;
    const contact=actor.node.getChildByName('落地接触'),cast=actor.node.getChildByName('日照投影');
    if(contact){contact.setPosition(0,.025-actor.floor,0);contact.setScale(kind==='boss'?1.4:.88,floating?.26:.43,1);}
    if(cast){cast.setPosition(.13,.02-actor.floor,.10);cast.setScale(kind==='boss'?1.65:1.04,.46,1);}
    actor.exitDuration=Math.max(.55,...actor.animations.flatMap(animation=>animation.clips.filter(clip=>clip&&(/(^|[|_])exit$/).test(clip.name)).map(clip=>clip!.duration)));
    this.play(actor,actor.action,true);
  }
  private syncActor(actor: Actor, state: BattleUnit | BattleEnemy, dt: number, tickChanged: boolean, elapsed: number): void {
    const controlled=state.statuses.some(status=>status.kind==='web'||status.kind==='stun'||status.kind==='root');
    // Rendering can outpace the fixed simulation tick; keep its last motion decision.
    if (tickChanged) {
      const mx=state.x-(actor.motionX??state.x),mz=state.z-(actor.motionZ??state.z);
      const seconds=actor.motionTick===undefined?0:Math.max(.05,(this.lastTick-actor.motionTick)*.05);
      actor.moving = mx*mx+mz*mz > .00000001;
      if(!actor.friendly&&actor.moving&&seconds>0)actor.walkRate=Math.max(enemyG1(actor.variant??'')?.flying?.85:0,enemyWalkRate(Math.hypot(mx,mz)/seconds,actor.height));
      actor.motionX=state.x;actor.motionZ=state.z;actor.motionTick=this.lastTick;
      if (actor.moving && actor.actionTime <= 0) actor.targetYaw = Math.atan2(mx, mz) * 180 / Math.PI;
    }
    actor.x = state.x; actor.z = state.z; actor.phase += dt;
    const statusVisuals=new Set<string>(state.statuses.map(s=>s.kind));
    if('sleepUntilWave' in state&&state.sleepUntilWave&&!state.alive)statusVisuals.add('sleep');
    for(const status of statusVisuals)if(['armorDown','resistDown','weaken','sleep'].includes(status)&&!actor.statusVisuals?.has(status))this.g1Effects?.status(status,this.point(actor),.8);
    actor.statusVisuals=statusVisuals;
    if('skillActivations' in state){
      const changes=Object.entries(state.skillActivations).filter(([id,n])=>n>(actor.activationVisuals?.[id]??0));
      // Main spell/projectile events already carry feedback. Quiet stat passives flash only on arrival.
      const quiet=['strong','armor','resist','swift','reach','steady'];
      const distinct=changes.find(([id])=>['block','share','caprice','arcane','sleep','lastShield','counterStorm'].includes(id)||(!actor.activationVisuals&&quiet.includes(id)));
      if(distinct&&this.lastTick-(actor.passiveFxAt??-100)>14){this.g1Effects?.status(['block','share','lastShield','armor','resist'].includes(distinct[0])?'shield':distinct[0]==='sleep'?'sleep':'encourage',this.point(actor),.55);actor.passiveFxAt=this.lastTick;}
      actor.activationVisuals={...state.skillActivations};
    }

    if(!actor.friendly&&actor.model)this.g1Effects?.enemyState(actor.model,state.alive,controlled,actor.action==='skill'||actor.action==='castStart'||actor.action==='castLoop');
    const justDied = actor.alive && !state.alive;
    if (justDied) { actor.alive = false; actor.deathTime = 0; this.play(actor, 'death', true); }
    if (!actor.alive && state.alive) { actor.alive = true; actor.deathTime = 0; actor.node.active = true; this.play(actor, 'idle', true); }
    const actionDt = actor.realModel ? elapsed : dt;
    if (!justDied) actor.actionTime = Math.max(0, actor.actionTime - actionDt);
    actor.hitTime = Math.max(0, actor.hitTime - dt);
    const restingAction:Action=actor.moving&&!controlled?'walk':'idle';
    // A light hit must not lock a walking enemy's feet for the whole hit clip.
    // Attacks/casts still play when the simulation stops that enemy to act.
    if(!actor.friendly&&actor.alive&&actor.moving&&!controlled&&(actor.action==='hit'||actor.action==='attack'))actor.actionTime=0;
    if (actor.alive && actor.actionTime === 0 && actor.action !== restingAction) this.play(actor, restingAction, true);
    if(!actor.friendly&&actor.action==='walk')for(const animation of actor.animations){
      const clip=animation.clips.find(c=>c&&/(^|[|_])walk$/i.test(c.name));if(!clip)continue;
      const state=animation.getState(clip.name),rate=(actor.walkRate??1)*clip.duration;(actor.animationRates??=new Map()).set(clip.name,rate);
      if(state)state.speed=this.playbackSpeed*rate;
    }
    const turn = ((actor.targetYaw - actor.yaw + 540) % 360) - 180;
    actor.yaw += turn * Math.min(1, dt * 12);
    const bob = actor.alive && !actor.realModel ? Math.sin(actor.phase * (actor.friendly ? 3 : 10)) * .022 : 0;
    const kick = !actor.realModel&&actor.hitTime > 0 ? Math.sin(actor.hitTime * 60) * .045 : 0;
    const lunge = actor.alive && !actor.realModel && actor.actionTime > 0 && actor.action === 'attack' ? Math.sin(Math.min(1, actor.actionTime / .35) * Math.PI) * .12 : 0;
    actor.node.setPosition(actor.x, actor.floor, actor.z);
    if (!actor.alive) {
      if (!justDied) actor.deathTime += actionDt;
      if (!actor.friendly && actor.deathTime >= actor.exitDuration) actor.node.active = false;
    }
    const fall = actor.alive ? 0 : clamp(actor.deathTime / .4);
    const scale = !actor.alive && !actor.friendly&&!actor.realModel ? Math.max(.04, 1 - fall * .8) : 1;
    const growth=actor.realModel&&state.statuses.some(s=>s.kind==='giant')?1.35:1;
    actor.body.setScale(scale*growth, scale*growth, scale*growth);
    actor.body.setPosition(kick + Math.sin(actor.yaw * Math.PI / 180) * lunge, bob - (actor.realModel?0:fall * (actor.friendly ? .09 : .13)), Math.cos(actor.yaw * Math.PI / 180) * lunge);
    actor.body.setRotationFromEuler(0, actor.yaw, !actor.alive && !actor.realModel ? fall * 65 : 0);
    if(actor.paint){
      const giant=state.statuses.some(s=>s.kind==='giant'),sheep=state.statuses.some(s=>s.kind==='sheep');
      const growth=giant?1.4:1;
      const pace=actor.kind==='boss'?3.4:actor.kind==='runner'?13:7;
      const gait=actor.alive&&actor.moving&&!controlled?Math.sin(actor.phase*pace):0;
      const breath=actor.alive?Math.sin(actor.phase*(actor.kind==='stone'?1.7:2.25))*.006:0;
      // Scale from the foot pivot and push towards the target on release. Do not float the actor upward.
      actor.body.setScale(scale*growth*(1-breath+gait*.013),scale*growth*(1+breath-gait*.010),scale*growth);
      const purposefulLunge=actor.friendly&&actor.kind!=='stone'?lunge*.22:lunge;
      actor.body.setPosition(kick*.32+Math.sin(actor.yaw*Math.PI/180)*purposefulLunge,0,Math.cos(actor.yaw*Math.PI/180)*purposefulLunge);
      actor.body.setRotationFromEuler(0,0,0);
      const poseKind=sheep?'sheep':actor.kind;const frame=!actor.alive?3:sheep?Math.floor(actor.phase*3)%2:actor.actionTime>0?(actor.actionTime>.22?1:actor.actionTime>.10?2:3):'trait' in state&&state.trait==='bulwark'&&state.statuses.some(s=>s.kind==='hold')?1:0;
      actor.arrivalTime=Math.max(0,(actor.arrivalTime??0)-dt);if('slot' in state&&actor.station!==state.slot){actor.station=state.slot;actor.arrivalTime=1.65;}
      const casting=actor.action==='skill'||actor.action==='castStart'||actor.action==='castLoop'||actor.action==='castRelease';
      this.painted?.pose(actor.paint,poseKind,actor.friendly&&casting&&actor.actionTime>0?4:actor.friendly&&actor.alive&&actor.actionTime<=0&&(actor.arrivalTime??0)>0?(actor.arrivalTime!>1.3?1:actor.arrivalTime!>.35?2:3):frame);if(actor.qualityRing){actor.qualityRing.active=actor.alive;actor.qualityRing.setRotationFromEuler(-90,0,0);}
      const facing=Math.sin(actor.targetYaw*Math.PI/180),nativeLeft=['stone','ink','runner','armored','snail','boss'].includes(poseKind);if(Math.abs(facing)>.12)actor.paint.setScale((facing<0)!==nativeLeft?-1:1,1,1);
    }
    if(actor.fusionRank===3&&actor.qualityRing){actor.qualityRing.active=actor.alive;const glow=1.12+Math.sin(actor.phase*2)*.045;actor.qualityRing.setScale(glow,.30,glow);}
    if(actor.advancedPaint){const n=actor.advancedPaint;n.active=actor.alive;n.setPosition(0,Math.sin(actor.phase*2)*.015,0);n.setScale(1+(actor.actionTime>0?.018:0),1+(actor.actionTime>0?.018:0),1);if(actor.qualityRing){actor.qualityRing.active=actor.alive;actor.qualityRing.setScale(1.1+Math.sin(actor.phase*2)*.06,.30,1.1+Math.sin(actor.phase*2)*.06);}}
    actor.control.active = actor.alive && controlled;
    actor.control.setRotationFromEuler(0, actor.phase * 110, 0);
    actor.shieldRing.active = actor.alive && ('shield' in state ? state.shield > .01 : false);
  }
  private health(actor: Actor, hp: number, shield: number, currentHp=0, maxHp=0): void {
    const large = actor.kind === 'boss' ? 1.7 : actor.kind === 'elite' ? 1.3 : 1, width = 1.04 * large;
    const value = clamp(hp), shieldValue = clamp(shield);
    actor.bar.active = actor.alive;
    actor.fill.active = value > 0; actor.fill.setScale(width * Math.max(.001, value), .06, .024); actor.fill.setPosition(-width * (1 - value) / 2, 0, .022);
    actor.shieldFill.active = shieldValue > 0; actor.shieldFill.setScale(width * Math.max(.001, shieldValue), .035, .024); actor.shieldFill.setPosition(-width * (1 - shieldValue) / 2, -.095, .022);
    actor.hpLabel.string=currentHp>0&&maxHp>0&&(actor.friendly||actor.kind==='boss')?`${Math.max(0,Math.ceil(currentHp)).toLocaleString()} / ${Math.max(1,Math.ceil(maxHp)).toLocaleString()}`:'';
  }
  private tickFloating(dt:number):void{
    if(!this.floatingNumbers.length)return;
    const elapsed=Math.max(0,Number.isFinite(dt)?dt:0),rotation=this.camera.node.worldRotation;
    for(const item of this.floatingNumbers){
      if(!item.node.active)continue;
      item.age+=elapsed;const t=Math.min(1,item.age/item.duration);
      if(t>=1){item.node.active=false;continue;}
      item.node.setPosition(item.base.x,item.base.y+t*.48,item.base.z);item.node.setWorldRotation(rotation.x,rotation.y,rotation.z,rotation.w);
      const c=item.label.color.clone();c.a=Math.round(255*(1-Math.max(0,(t-.58)/.42)));item.label.color=c;
    }
  }
  private floatNumber(text:string,point:Vec3,hex:string):void{
    let item=this.floatingNumbers.find(candidate=>!candidate.node.active);
    if(!item){
      if(this.floatingNumbers.length>=42)return;
      const node=this.node('战斗飘字',this.effectRoot),box=node.addComponent(UITransform);box.setContentSize(220,36);
      const label=node.addComponent(Label);label.fontSize=19;label.lineHeight=22;label.isBold=true;label.horizontalAlign=Label.HorizontalAlign.CENTER;label.verticalAlign=Label.VerticalAlign.CENTER;label.overflow=Label.Overflow.SHRINK;
      const outline=node.addComponent(LabelOutline);outline.width=3;outline.color=new Color('#173B44');
      item={node,label,base:new Vec3(),age:0,duration:.9};this.floatingNumbers.push(item);
    }
    item.base.set(point.x,point.y+.24,point.z);item.age=0;item.duration=.9;item.node.active=true;item.node.setPosition(item.base);item.label.string=text;const c=new Color();Color.fromHEX(c,hex);c.a=255;item.label.color=c;
  }
  private billboardBars(): void {
    const rotation = this.camera.node.worldRotation;
    for(const actor of [...this.units.values(),...this.vfxActors]){
      if(actor.rankPedestal){actor.rankPedestal.active=actor.alive;const pulse=1+Math.sin(this.sceneTime*1.8)*.012;actor.rankPedestal.setScale(pulse,1,pulse);}
      if(actor.rankBadge){const pop=Math.min(.5,Math.max(0,(actor.rankPop??0)-this.sceneTime));const size=1+Math.sin(pop/.5*Math.PI)*.25;actor.rankBadge.setScale(size,size,size);}
    }
    for(const actor of this.vfxActors)if(actor.node.active)actor.bar.setWorldRotation(rotation);

    if(this.painted)for(const actors of [this.units,this.enemies,this.retiringEnemies])for(const actor of actors.values())if(actor.paint){
      this.painted.face(actor.paint);
      actor.bar.setPosition(Vec3.transformQuat(new Vec3(),new Vec3(0,actor.height+.11,0),rotation));
      actor.control.setPosition(Vec3.transformQuat(new Vec3(),new Vec3(0,actor.height+.28,0),rotation));
    }
    for (const actor of this.units.values()) if (actor.node.active) actor.bar.setWorldRotation(rotation.x, rotation.y, rotation.z, rotation.w);
    for (const actor of this.enemies.values()) if (actor.node.active) actor.bar.setWorldRotation(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  private actor(id?: string): Actor | undefined { return id ? this.units.get(id) || this.enemies.get(id) : undefined; }
  private point(actor: Actor, y = .6): Vec3 { return new Vec3(actor.x, actor.floor + y, actor.z); }
  private face(source: Actor, point: Vec3): void { const dx = point.x - source.x, dz = point.z - source.z; if (dx * dx + dz * dz > .001) source.targetYaw = Math.atan2(dx, dz) * 180 / Math.PI; }
  private event(event: BattleEvent): void {
    const source = this.actor(event.sourceId), target = this.actor(event.targetId);
    const destination = event.x!==undefined&&event.z!==undefined?new Vec3(event.x,target?this.point(target).y:.7,event.z):target?this.point(target):new Vec3(source?.x??0,.7,source?.z??0);
    const color = source?.friendly ? HERO_LOOK[source.kind as Role].accent : '#746588';
    const continuing=['rockPulse','rockSplit','arrowRain','blizzardPulse','shatter','cooldown','burn','landing','splash','blessing'].includes(event.effect??'');
    if(this.g1Effects){
      const role=source&&ROLES[source.kind as Role]?source.kind as Role:undefined;
      if(event.effect?.startsWith('bossTell-')){this.g1Effects.telegraph(destination,event.radius??1.5,event.duration??1.35,['bossTell-rally','bossTell-beacon'].includes(event.effect)?'#FFBD58':'#FF4C54',event.sourceId);if(source){source.actionTime=event.duration??1.35;this.play(source,'castStart',true);}}
      if(event.effect==='castInterrupted'||event.type==='defeat')this.g1Effects.cancelWarnings(event.type==='defeat'?event.targetId:event.sourceId);
      if(event.effect==='blessing')this.g1Effects.status('encourage',destination,.8);
      if(event.effect==='recruit')this.g1Effects.spawn(destination,'turtle');
      if(event.effect==='fusion2'||event.effect==='fusion3'){this.g1Effects.fusion(destination,event.effect==='fusion3');if(source)source.rankPop=this.sceneTime+.5;}
      if(event.effect==='slamTell')this.g1Effects.telegraph(destination,1.65,1.6,'#FF4C54',event.sourceId);
      if(event.effect==='dashTell')this.g1Effects.telegraph(destination,.7,.75,'#FF9B54',event.sourceId);
      if(event.type==='attack'&&source&&event.effect!=='windup'&&event.effect!=='heal'){
        const start=event.fromX!==undefined?new Vec3(event.fromX,.7,event.fromZ!):this.point(source,.8);
        if(event.effect==='pierce')this.g1Effects.piercing(start,destination);
        else if(role)this.g1Effects.attack(event.fromX!==undefined?undefined:source.model,role,start,destination,!!event.critical,event.skillId==='combo'?.12:0);
        else this.g1Effects.enemyAttack(start,destination,['snail','mist'].includes(source.kind)||['B05','B09','B10','H02','M01','M07','M09','M11','M12','M13'].includes(enemyG1(source.variant??'')?.id??''),source.kind==='boss',source.variant,source.model);
      }
      if(event.type==='damage'&&target&&(event.amount??0)>0)this.g1Effects.impact(destination,!!event.critical);
      if(event.type==='heal'){
        if(source&&target&&source!==target)this.g1Effects.healLink(this.point(source,.8),destination,event.effect==='siphon');
        this.g1Effects.status(event.effect==='enemyMend'?'enemyMend':'heal',destination,.55);
        if(['revive','rebirth'].includes(event.effect??event.skillId??''))this.g1Effects.status('revive',destination,1.05);
      }
      if(event.type==='shield')this.g1Effects.status(event.effect==='不灭珍珠'?'revive':'shield',destination,.85);
      if(event.type==='control')this.g1Effects.status(event.effect??event.skillId??'stun',destination,event.effect==='web'?1.2:.8);
      if(event.type==='spawn')this.g1Effects.spawn(destination,event.effect==='golem'?'golem':event.effect==='turtle'?'turtle':'enemy');
      if(event.type==='defeat')this.g1Effects.death(destination,target?.kind==='boss');
      if(event.type==='leak')this.g1Effects.pearlHit(destination);
      if(event.type==='waveEnd')this.g1Effects.wave(event.effect==='won'?'victory':event.effect==='lost'?'defeat':'defeat',destination);
      if(event.type==='skill'){
        const id=event.skillId,effect=event.effect;
        if(effect==='splash')this.g1Effects.splash(destination,event.radius??1.5);
        else if(id==='hold'&&!continuing)this.g1Effects.cast('rock',source?this.point(source,0):destination,1.75,3.6,!!source?.skills?.includes('stoneMastery'));
        else if(effect==='rockSplit')this.g1Effects.cast('rock',destination,.7,.75);
        else if(id==='crystalCannon'&&!continuing)this.g1Effects.cast('frost',destination,1.65,source?.skills?.includes('crystalMastery')?4.5:3,!!source?.skills?.includes('crystalMastery'));
        else if(effect==='blizzardPulse')this.g1Effects.cast('frost',destination,1.25,.45);
        else if(effect==='arrowRain')this.g1Effects.cast('arrows',destination,1.50,.85,true);
        else if(id==='piercingShot')this.g1Effects.piercing(source?this.point(source,.8):destination,destination);
        else if(id==='bubbleRing'&&!continuing)this.g1Effects.cast('summon',destination,1.25,1.1);
        else if(id==='spirit'&&effect==='landing')this.g1Effects.cast('impact',destination,1.4,.65);
        else if(['greatHeal','holyLight','leafMastery','rebirth'].includes(id??''))this.g1Effects.cast('heal',destination,1.05,1.1,id==='leafMastery');
        else if(['counterStorm','reflect'].includes(id??''))this.g1Effects.cast('rock',destination,1.0,.6);
        else if(effect==='shatter')this.g1Effects.cast('frost',destination,1,.55);
        else if(effect==='cooldown')this.g1Effects.cast('frost',source?this.point(source):destination,.40,.40);
        else if(['fervor','giant','taunt','cleanse','encourage'].includes(id??''))this.g1Effects.status(id!,target?destination:source?this.point(source):destination,id==='giant'?1.05:.72);
        else if(effect==='castInterrupted')this.g1Effects.status('castInterrupted',destination);
        else if(effect==='burn')this.g1Effects.impact(destination);
        else if(effect==='shellBrace')this.g1Effects.status('shield',destination);
        else if(effect==='crabSlam')this.g1Effects.cast('impact',destination,1.6,.8);
        else if(effect==='crabSummon')this.g1Effects.bossCast('rally',destination,destination,source?.variant);
        else if(effect?.startsWith('boss-')){this.g1Effects.cancelWarnings(event.sourceId);if(source)this.play(source,'castRelease',true);this.g1Effects.bossCast(effect.slice(5),destination,source?this.point(source,1.1):destination,source?.variant);}
      }
    }
    if(this.painted&&!this.g1Effects){
      if(event.effect?.startsWith('bossTell-')){this.painted.storm(destination,event.effect==='bossTell-drain'?5.2:3,1.35,4);if(source)source.actionTime=1.35;}
      if(event.effect?.startsWith('boss-'))this.painted.storm(destination,event.effect==='boss-drain'?5.2:3,.75,event.effect==='boss-frost'?2:5);
      if(event.effect==='castInterrupted')this.painted.storm(destination,.8,.4,2);

      if(event.effect==='dashTell')this.effect('ring',destination,destination,'#E6AC58',.75,1.2,2);
      if(event.effect==='slamTell')this.effect('ring',destination,destination,'#E97865',1.6,3.3,3);
      if(event.effect==='shellBrace')this.painted.flash(4,destination,1.05,.55);
      if(event.effect==='enemyMend')this.effect('beam',source?this.point(source):destination,destination,'#B7C899',.5,.08,2);
      if(event.type==='damage'&&source&&['scatter','extraTarget','combo','bounce'].includes(event.skillId??''))this.painted.flash(source.kind==='crystal'?1:0,this.point(source,.46),.43,.16,destination);
      if(event.type==='skill'&&['fervor','giant','rebirth','counterStorm'].includes(event.skillId??''))this.painted.flash(event.skillId==='rebirth'?2:event.skillId==='counterStorm'?1:4,destination,1.3,.55);
      if(event.type==='control'&&event.skillId==='polymorph')this.painted.flash(3,destination,.9,.4);
      if(event.type==='attack'&&source&&event.effect!=='windup'){
        const from=source.friendly&&source.paint&&source.kind!=='stone'?this.painted.emitter(source.paint,source.kind as Role):this.point(source,.48),index=event.effect==='heal'?2:source.kind==='spike'?0:source.kind==='crystal'?1:source.kind==='bubble'?3:5;
        this.painted.flash(index,from,source.kind==='spike'?.95:.60,source.kind==='stone'?.16:.23,destination);
      }else if(event.type==='damage'&&target&&(event.amount??0)>0)this.painted.flash(5,destination,event.critical?.62:.30,.19);
      else if(event.type==='heal')this.painted.flash(2,destination,.78,.48);
      else if(event.type==='shield')this.painted.flash(4,destination,.9,.48);
      else if(event.type==='skill'){
        if(event.skillId==='hold'){if(!continuing)this.painted.storm(destination,4.6,4);}
        else if(event.effect==='rockSplit')this.painted.storm(destination,2.4,.9);
        else if(event.effect==='arrowRain')this.painted.storm(destination,4,1,1);
        else if(event.skillId==='crystalCannon'&&!continuing){this.painted.storm(destination,3.6,source?.skills?.includes('crystalMastery')?5:3,6);this.painted.flash(1,new Vec3(destination.x,.35,destination.z),2.7,.75);}
        else if(event.skillId==='bubbleRing'&&!continuing)this.painted.storm(destination,3,1.5,7);
        else if(event.skillId==='spirit'&&event.effect==='landing')this.painted.storm(destination,3,.7,5);
        else if(['counterStorm','reflect'].includes(event.skillId??''))this.painted.storm(destination,2.7,.7,0);
        else if(['greatHeal','holyLight','leafMastery','rebirth'].includes(event.skillId??''))this.painted.storm(destination,2,.85,3);
        else if(event.effect==='shatter')this.painted.storm(destination,1.7,.65,2);
        else if(event.effect==='cooldown')this.painted.storm(destination,.85,.55,2);
        else{const id=event.skillId,index=id==='crystalCannon'?1:id==='greatHeal'||id==='holyLight'?2:id==='bubbleRing'||id==='spirit'?3:id==='piercingShot'?0:5;
          this.painted.flash(index,destination,index===1||index===3?2.1:1.45,.65,undefined,index===1||index===3);}
      }
    }
    if (event.type === 'attack' && source) {
      this.face(source, destination); if (source.alive&&!event.secondary&&(source.friendly||!source.moving)&&(event.effect==='windup'||source.action!=='attack')) this.play(source, 'attack', true);
      if(event.effect==='windup')return;
      const start = this.point(source), healing = event.effect === 'heal';
      const melee = source.kind === 'stone' || (!source.friendly && !['snail', 'boss'].includes(source.kind));
      if(!this.painted)this.effect(melee ? 'beam' : 'bolt', start, destination, healing ? HEAL : color, .15, melee ? .12 : .17, 2);
    } else if (event.type === 'damage' && target && (event.amount ?? 0) > 0) {
      if(source&&event.skillId==='reflect'){
        if(this.g1Effects)this.g1Effects.attack(source.model,source.friendly?source.kind as Role:undefined,this.point(source,.8),destination,!!event.critical);
        else this.effect('beam',this.point(source),destination,event.skillId==='reflect'?'#E8BA67':color,.14,.11,1);
      }
      target.hitTime = .16;
      if (target.alive && target.actionTime <= .05 && (target.friendly||!target.moving)) this.play(target, 'hit');
      if(!this.g1Effects)this.effect('spark', destination, destination, event.critical ? '#FFE077' : WHITE, .18, event.critical ? .46 : .23, event.critical ? 2 : 0);
    } else if (event.type === 'heal') {
      if(!this.g1Effects)this.effect('ring', destination, destination, event.skillId==='rebirth'?'#FFD782':HEAL, .42, event.skillId === 'greatHeal'||event.skillId==='rebirth' ? 1.45 : .85, 1);
    } else if (event.type === 'shield') {
      if(!this.g1Effects)this.effect('ring', destination, destination, SHIELD, .4, 1.25, 2);
    } else if (event.type === 'control') {
      if(!this.g1Effects)this.effect('ring', destination, destination, CONTROL, .35, .95, 1);
    } else if (event.type === 'skill') {
      if (source?.alive&&!continuing&&!event.effect?.startsWith('bossTell-')&&!event.effect?.startsWith('boss-')&&!['encourage','cleanse','fervor'].includes(event.skillId??'')) { this.face(source, destination); this.play(source, 'skill', true); }
      if(source?.paint&&event.effect==='slamTell')source.actionTime=1.6;
      if(source?.paint&&event.effect==='crabSlam')source.actionTime=.20;
      if(this.g1Effects)return;
      const start = source ? this.point(source) : destination;
      if(event.skillId==='crystalCannon'){
        this.effect('ring',destination,destination,'#ABDDEB',.65,3.6,3);
        for(let i=0;i<8;i++){const a=i*Math.PI/4,at=new Vec3(destination.x+Math.cos(a)*1.3,.12,destination.z+Math.sin(a)*1.3);this.effect('bolt',new Vec3(at.x,2.8,at.z),at,'#E6F9FF',.4,.11,2);}
      } else if(event.skillId==='counterStorm'||event.skillId==='spirit'||event.skillId==='holyLight'){
        this.effect('ring',destination,destination,event.skillId==='holyLight'?'#F5D58A':event.skillId==='spirit'?'#E5AA74':'#A8CFD0',.55,event.skillId==='holyLight'?1.3:3,2);
      } else if (event.skillId === 'piercingShot') {
        this.effect('beam', start, destination, '#FFE077', .32, .20, 3);
        this.effect('ring', destination, destination, color, .5, 1.35, 3);
      } else if (event.skillId === 'bubbleRing') {
        this.effect('ring', destination, destination, '#B8E8F0', .65, 3, 3);
      } else if (event.skillId === 'greatHeal' || event.skillId === 'cleanse') {
        this.effect('ring', start, start, HEAL, .65, 2, 3);
      } else if (event.skillId === 'hold') {
        if(!this.painted)this.effect('ring', start, start, '#F6D79B', .7, 4.6, 3);
      } else if (event.effect === 'crabSlam' || event.effect === 'crabSummon') {
        this.effect('ring', destination, destination, '#E3A08C', .65, event.effect === 'crabSlam' ? 3 : 2, 3);
      }
    } else if (event.type === 'spawn' && source?.alive) {
      if(!this.g1Effects)this.effect('ring', this.point(source), this.point(source), '#BEB0D0', .3, .85, 0);
    } else if (event.type === 'defeat') {
      this.effect('spark', destination, destination, '#DBCBB4', .4, .5, 1);
    } else if (event.type === 'leak' && source) {
      const point = this.point(source); this.effect('ring', point, point, '#F0A48B', .5, 1.5, 2);
    }
  }

  private effect(kind: EffectKind, start: Vec3, end: Vec3, color: string, duration: number, size: number, priority: number): void {
    let effect = this.effects.find(candidate => !candidate.active);
    if (!effect) {
      // Important casts may replace an older small impact, never the reverse.
      effect = this.effects.filter(candidate => candidate.priority <= priority).sort((a, b) => a.priority - b.priority || b.age / b.duration - a.age / a.duration)[0];
      if (!effect) return;
    }
    effect.active = true; effect.node.active = true; effect.kind = kind; effect.start.set(start); effect.end.set(end);
    effect.age = 0; effect.duration = duration; effect.size = size; effect.priority = priority;
    const mesh=this.meshes.get(kind === 'ring' ? 'ring' : kind === 'beam' ? 'box' : 'sphere')!;
    // In Cocos 3.8.8 assigning even the same mesh rebuilds the render model.
    if(effect.renderer.mesh!==mesh)effect.renderer.mesh=mesh;
    const material=this.material(color);if(effect.renderer.getSharedMaterial(0)!==material)effect.renderer.setSharedMaterial(material,0);
    effect.node.setRotationFromEuler(0, 0, 0);
  }
  private tickEffects(dt: number): void {
    for (const effect of this.effects) {
      if (!effect.active) continue;
      effect.age += dt; const t = clamp(effect.age / effect.duration);
      if (t >= 1) { effect.active = false; effect.node.active = false; continue; }
      const s = effect.size;
      if (effect.kind === 'bolt') {
        Vec3.lerp(this.targetPoint, effect.start, effect.end, t);
        this.targetPoint.y += Math.sin(t * Math.PI) * .3;
        effect.node.setPosition(this.targetPoint); effect.node.setScale(s, s, s * 1.7);
        effect.node.setRotationFromEuler(0, Math.atan2(effect.end.x - effect.start.x, effect.end.z - effect.start.z) * 180 / Math.PI, 0);
      } else if (effect.kind === 'beam') {
        Vec3.lerp(this.targetPoint, effect.start, effect.end, .5); effect.node.setPosition(this.targetPoint);
        Vec3.transformMat4(this.targetPoint, effect.end, this.effectRoot.worldMatrix); effect.node.lookAt(this.targetPoint);
        const width = s * (1 - t * .8); effect.node.setScale(width, width, Math.max(.05, Vec3.distance(effect.start, effect.end)));
      } else if (effect.kind === 'ring') {
        effect.node.setPosition(effect.end.x, .315 + Math.sin(t * Math.PI) * .2, effect.end.z);
        const radius = s * (.5 + t * .5); effect.node.setScale(radius, Math.max(.05, 1 - t), radius);
      } else {
        effect.node.setPosition(effect.end.x, effect.end.y + t * .35, effect.end.z);
        const scale = s * Math.sin(t * Math.PI); effect.node.setScale(scale, scale * 1.4, scale);
      }
    }
  }
}



