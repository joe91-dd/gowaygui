import {SoloMenus} from './SoloMenus';
import {SOLO_MILESTONES,milestoneValue,enableSolo} from '../core/soloProgress';
import {runtimeQuery} from '../platform/runtimeQuery';
import {recordNativeBattleStage,nativeBattleTraceText} from '../platform/nativeBattleTrace';
import {CAMERA_ORDER,battleCoverHalfHeight,homeAdventureFold} from './DisplayLayout';
import {PearlBattleArt} from './PearlBattleArt';
import {DEBUG} from 'cc/env';
import {chapterWaves} from '../core/expeditionRules';
import {SeaChart} from './SeaChart';
import {PatrolView,patrolEntry} from './PatrolView';
import {ENDLESS_ROUTE_WAVES} from '../core/endlessRewards';
import {orderedPets} from '../core/petOrder';
import {petCardDrag,PetDropTarget} from './PetCardDrag';
import {softwareRendering} from './RenderBudget';
import {visiblePets,accessiblePet,loanLabel} from '../core/petAccess';
import {matchArena} from '../core/arena';
import {ArenaWatchScreen} from './ArenaWatchScreen';
import {SkeletalReviewScreen} from './SkeletalReviewScreen';
import {ApprovedCastReviewScreen} from './ApprovedCastReviewScreen';
import {AccountClient,accountStorage} from '../platform/AccountClient';
import {TaskMenus} from './TaskMenus';
import {RoomClient} from './RoomClient';
import {RoomMenus} from './RoomMenus';
import {LiveRaidScreen} from './LiveRaidScreen';
import {WorldBossScreen} from './WorldBossScreen';
import {WorldBossMenus} from './WorldBossMenus';
import {PetDetails,talentStars} from './PetDetails';
import {RewardMenus} from './RewardMenus';
import {levelInfo,petPanel} from '../core/development';
import {raidMapId} from '../core/raids';
import {AchievementMenus} from './AchievementMenus';
import {CompanionMotion} from './CompanionMotion';
import {avatarPicker,paintAvatar} from './ProfileAvatar';
import {_decorator,EventTouch,UIOpacity,Sprite,Color,Graphics,Mask, Camera, Canvas, Component, Game, game as engineGame, isValid, Label, Layers, Material, Node, Prefab, profiler, ResolutionPolicy, resources, screen as displayScreen, sys, UITransform, Vec3, view,tween,assetManager} from 'cc';
import {mapBounds} from '../core/mapPresentation';
import {IslandUI, UI_COLORS,color} from './IslandUI';
import {IslandIcons, IslandIconId} from './IslandIcons';
import {IslandAudio} from './IslandAudio';
import {IslandPanels} from './IslandPanels';
import {TurtlePortraits} from './TurtlePortraits';
import {acquireLocalSession, LocalSession} from '../platform/localSession';
import {GameService, displayName} from '../core/game';
import {SaveRepository,SAVE_KEY,encodeSave} from '../core/save';
import {allMapsReviewSave} from '../core/allMapsReview';
import {EnemyG1ReviewScreen} from './EnemyG1ReviewScreen';
import {goldAmount,displayGold} from '../core/economy';
import {skillBookIssue} from '../core/skillBooks';
import {BATTLE_MAPS, LEVELS, MATERIAL_NAMES, ROLES, SKILL_BY_ID, SKILLS, skillsForRole} from '../core/data';
import type {Material as TrainingMaterial, RunMode, SkillId} from '../core/types';
import {pendingTakeaways} from '../core/prototype';
import {availablePets} from '../core/community';
import type {Role,Turtle} from '../core/types';
import {PROTOTYPE,turtleQuality} from '../core/prototypeConfig';
import {PrototypeMenus} from './PrototypeMenus';
import {CommunityMenus} from './CommunityMenus';
import {ChallengeScreen} from './ChallengeScreen';
import {BattleWorld} from './BattleWorld';
import {BattleScreen} from './BattleScreen';
import {lightIsland} from './WorldLighting';
import {LocalDiagnostics} from './LocalDiagnostics';
import {HOME_CAMERA, HomeWorld} from './HomeWorld';
import {ArtV2Assets,ArtV2Slice} from './ArtV2Assets';
import {ArtV2Backdrop} from './ArtV2Backdrop';
import {IslandArrival} from './IslandArrival';
import {ResourceLoadDeadline} from './ResourceLoadDeadline';
import {renderChapterMap} from './ChapterMap';
import {HERO_LOOK,visualName} from './VisualIdentity';
import {homeChat,HomeChatState} from './HomeChat';

const {ccclass,property}=_decorator;
type Screen='login'|'patrol'|'endless'|'adventure'|'home'|'levels'|'collection'|'detail'|'history'|'settings'|'workshop'|'community'|'battle';

/** Persistent UI with separately owned home and battle scenes. */
@ccclass('GameEntry')
export class GameEntry extends Component {
  @property(Material) pipelineMaterial:Material|null=null;
  private ui!:IslandUI;
  private icons?:IslandIcons;
  private panels?:IslandPanels;
  private portraits?:TurtlePortraits;
  private art?:ArtV2Assets;
  private backdrop?:ArtV2Backdrop;
  private arrivalView?:IslandArrival;
  private entered=false;
  private interfaceReady=false;
  private uiCamera?:Node;
  private uiCanvas?:Node;
  private orientationGuide?:Node;
  private audio?:IslandAudio;
  private unlockAudio=()=>this.audio?.unlock();
  private session?:LocalSession;
  private service?:GameService;
  private accountClient?:AccountClient;
  private tasks():TaskMenus{return new TaskMenus(this.ui,this.service!,this.accountClient??=new AccountClient(this.service!),()=>this.go('home'),e=>this.error(e));}
  private screen:Screen='home';
  private selectedId='';
  private detailTab:'traits'|'skills'='traits';
  private detailOrigin:'collection'|'history'='collection';
  private detailReturnPage=0;
  private page=0;
  private homeChatOpen=false;
  private companionMotion?:CompanionMotion;
  private homeHeroRole:Role='stone';
  private homeHeroId='';
  private homeAdventureCollapsed=false;
  private homeAnimateCollapse=false;
  private homeChatState:HomeChatState={expanded:false,channel:'world',recipient:'',draft:''};
  private collectionRole:Role|'all'='all';
  private collectionLocked=false;
  private commandNumber=0;
  private readonly solo=runtimeQuery().get('edition')==='solo';
  private readonly soloReview=this.solo&&runtimeQuery().get('review')==='1';
  private soloMenus():SoloMenus{return new SoloMenus(this.ui,this.service!,k=>this.command(k),()=>this.go('home'),e=>this.error(e));}
  private sessionTag=Date.now().toString(36);
  private homeWorld?:HomeWorld;
  private homeArrival?:{world?:HomeWorld;error?:unknown;failed:boolean};
  private initialization?:Promise<void>;
  private mainCamera?:Camera;
  private battleFov=36;
  private battleScreen?:BattleScreen|ChallengeScreen|LiveRaidScreen|ArenaWatchScreen|WorldBossScreen;
  private communityMenus?:CommunityMenus;
  private watchOpponent='';private roomClient?:RoomClient;private roomMenus?:RoomMenus;private roomPoll=0;
  private rooms():RoomMenus{return this.roomMenus??=new RoomMenus(this.ui,this.service!,this.roomClient??=new RoomClient(this.service!,this.accountClient??=new AccountClient(this.service!)),k=>this.command(k),()=>this.go('home'),()=>this.openBattle('online'),e=>this.error(e));}
  private rewards():RewardMenus{return new RewardMenus(this.ui,this.service!,k=>this.command(k),e=>this.error(e));}
  private challengeMode?:'raid'|'arena'|'online'|'watch'|'world';
  private prototypeMenus?:PrototypeMenus;
  private battleArrival?:{world:BattleWorld;islandPending:boolean;startedAt:number;deadline:ResourceLoadDeadline;controllerReady?:boolean;error?:unknown};
  private battleArrivalPage=0;
  private teamSelection:string[]=[];
  private goldLabel?:Label;
  private staminaLabel?:Label;
  private clockElapsed=0;
  private errorPanel?:Node;
  private diagnostics?:LocalDiagnostics;
  private disposed=false;
  private skeletalReview?:SkeletalReviewScreen|ApprovedCastReviewScreen|EnemyG1ReviewScreen;
  private appHidden=false;
  private readonly g1Showcase=typeof location!=='undefined'&&runtimeQuery().get('showcase')==='g1';
  // This APK is a debug-only, offline test build; release builds never get trial unlocks.
  private readonly nativeTrial=DEBUG&&sys.isNative&&sys.os===sys.OS.ANDROID;
  private readonly allMapsReview=this.nativeTrial||(typeof location!=='undefined'&&['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&runtimeQuery().get('preview')==='all-maps');
  private get isolatedReview():boolean{return this.g1Showcase||this.allMapsReview;}
  private g1ShowcaseStarted=false;
  private g1ShowcaseWarmup=0;

  start():void{
    if(this.disposed||this.initialization)return;
    this.initialization=this.initialize();void this.initialization.catch(error=>this.error(error));
  }
  private async initialize():Promise<void>{
    this.diagnostics=new LocalDiagnostics(this.node);
    if(this.diagnostics.enabled)profiler.showStats();else profiler.hideStats();
    if(softwareRendering()){view.enableRetina(false);engineGame.frameRate=30;}
    if(sys.isNative){
      engineGame.frameRate=30;
      assetManager.downloader.maxConcurrency=2;assetManager.downloader.maxRequestsPerFrame=2;
      for(const preset of ['default','preload','scene'])Object.assign(assetManager.presets[preset],{maxConcurrency:2,maxRequestsPerFrame:2});
    }
    // Native phones fill their landscape viewport; gameplay and HUD retain a
    // uniform 720-unit height instead of a fixed 16:9 letterboxed surface.
    view.setDesignResolutionSize(1280,720,sys.isNative?ResolutionPolicy.FIXED_HEIGHT:ResolutionPolicy.SHOW_ALL);
    const canvasNode=new Node('海岛界面');this.uiCanvas=canvasNode;canvasNode.layer=Layers.Enum.UI_2D;canvasNode.setParent(this.node.scene);
    canvasNode.addComponent(UITransform).setContentSize(1280,720);
    const cameraNode=new Node('界面相机');this.uiCamera=cameraNode;cameraNode.setParent(this.node.scene);cameraNode.setPosition(0,0,1000);
    const camera=cameraNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=360;
    camera.near=.1;camera.far=2000;camera.visibility=Layers.Enum.UI_2D;camera.clearFlags=Camera.ClearFlag.DEPTH_ONLY;camera.priority=CAMERA_ORDER.ui;
    const canvas=canvasNode.addComponent(Canvas);canvas.alignCanvasWithScreen=true;canvas.cameraComponent=camera;
    const reviewMode=typeof location!=='undefined'&&runtimeQuery().get('review')==='3d';
    this.icons=new IslandIcons();if(!reviewMode)this.icons.preload();
    this.panels=new IslandPanels();if(!reviewMode)void this.panels.preload();
    this.portraits=new TurtlePortraits();if(!reviewMode)this.portraits.preload();
    void PearlBattleArt.preload();this.art=new ArtV2Assets();if(!reviewMode)this.art.preload();
    const contentNode=new Node('当前页面');contentNode.layer=Layers.Enum.UI_2D;contentNode.setParent(canvasNode);contentNode.addComponent(UITransform).setContentSize(1280,720);
    this.ui=new IslandUI(contentNode,kind=>{this.audio?.unlock();this.audio?.effect(kind==='back'?'sfx_ui_back':'sfx_ui_confirm');},this.icons);
    this.ui.soloStyle=this.solo;
    this.bindUiAudio();
    if(!reviewMode){this.arrivalView=new IslandArrival(this.ui);this.arrivalView.show();}
    const mainCamera=this.node.scene.getChildByName('Main Camera');
    mainCamera?.setPosition(...HOME_CAMERA.position);mainCamera?.lookAt(new Vec3(...HOME_CAMERA.target));
    const sceneCamera=mainCamera?.getComponent(Camera);if(sceneCamera){this.mainCamera=sceneCamera;sceneCamera.priority=CAMERA_ORDER.world;sceneCamera.visibility=Layers.Enum.DEFAULT;sceneCamera.clearColor=new Color(83,159,169);}
    view.on('canvas-resize',this.resizeViewport,this);view.on('design-resolution-changed',this.resizeViewport,this);this.resizeViewport();
    lightIsland(this.node.scene);
    if(typeof location!=='undefined'&&runtimeQuery().get('review')==='3d'){
      if(!this.mainCamera||!this.pipelineMaterial)throw Error('三维验收需要场景相机与材质');
      if(this.orientationGuide){this.orientationGuide.destroy();this.orientationGuide=undefined;}
      const cast=runtimeQuery().get('cast');
      this.skeletalReview=new (cast==='enemies'?EnemyG1ReviewScreen:cast==='v2'?ApprovedCastReviewScreen:SkeletalReviewScreen)(this.node,this.ui,this.mainCamera,this.pipelineMaterial);
      await this.skeletalReview.initialize();return;
    }
    engineGame.on(Game.EVENT_HIDE,this.onHide,this);engineGame.on(Game.EVENT_SHOW,this.onShow,this);
    const baseStorage=accountStorage(sys.localStorage);
    const nativeStorage={getItem:(key:string)=>baseStorage.getItem('android-trial:'+key),setItem:(key:string,value:string)=>baseStorage.setItem('android-trial:'+key,value)};
    const soloStorage={getItem:(key:string)=>baseStorage.getItem('solo-v1:'+key),setItem:(key:string,value:string)=>baseStorage.setItem('solo-v1:'+key,value)};
    const session=await acquireLocalSession(this.solo?soloStorage:this.nativeTrial?nativeStorage:baseStorage,sys.isNative);
    if(this.disposed){session.close();return;}this.session=session;
    const previewData=new Map<string,string>();
    // The preview stays on the approved base turtle presentation. The deferred
    // 10-skill visual package is intentionally not injected into game saves.
    if(this.nativeTrial){if(!session.storage.getItem(SAVE_KEY))session.storage.setItem(SAVE_KEY,encodeSave(allMapsReviewSave(Date.now(),false,true)));}
    else if(this.allMapsReview)previewData.set(SAVE_KEY,encodeSave(allMapsReviewSave(Date.now(),false,runtimeQuery().get('balance')==='coast')));
    if(this.soloReview){const seed=allMapsReviewSave(Date.now(),false,true);enableSolo(seed);seed.solo!.best=[30,30,30];previewData.set(SAVE_KEY,encodeSave(seed));}
    const previewStorage={getItem:(key:string)=>previewData.get(key)??null,setItem:(key:string,value:string)=>{previewData.set(key,value);},removeItem:(key:string)=>{previewData.delete(key);}};
    this.service=new GameService(new SaveRepository(this.soloReview||this.isolatedReview&&!this.nativeTrial&&!this.solo?previewStorage:this.session.storage));this.service.enablePrototype(this.command('v06'));this.service.enableIncrement(this.command('economyV2'));this.service.enableLiving(this.command('livingV1'));this.service.refreshClock(this.command('clock'));if(this.solo){this.service.enableSolo(this.command('solo'));this.ui.soloStyle=true;}this.roomClient=new RoomClient(this.service);if(!this.isolatedReview&&!this.solo)void this.roomClient.sync().catch(()=>{});
    this.audio=new IslandAudio(this.node,this.service.settingsSnapshot);
    if(!this.solo)this.service.enablePatrol(this.command('enablePatrol'));
    if(typeof document!=='undefined'){document.addEventListener('pointerdown',this.unlockAudio,true);document.addEventListener('keydown',this.unlockAudio,true);}
    this.audio.unlock();
    this.accountClient=new AccountClient(this.service);
    if(this.appHidden)this.audio.pause();
    if((this.allMapsReview||this.solo)&&!(typeof location!=='undefined'&&runtimeQuery().get('login')==='1')){this.entered=true;this.screen='home';}
    this.beginHomeArrival();this.render();
    console.info('[GOWAYGUI_BOOT]',JSON.stringify({engine:'Cocos Creator 3.8.8',scene:this.node.scene.name,stage:'five-turtle home + persistent UI',revision:this.service.snapshot.revision}));
  }
  private beginHomeArrival(retry=false):void{
    if(this.disposed||this.screen!=='home')return;
    if(this.homeArrival&&!retry)return;
    if(this.homeWorld?.error){this.homeWorld.destroy();this.homeWorld=undefined;}
    if(retry&&this.icons?.state==='failed')this.icons.retry();
    if(retry&&this.panels?.state==='failed')void this.panels.retry();
    if(retry&&this.portraits?.state==='failed')this.portraits.retry();
    if(retry&&this.art?.state==='failed')this.art.retry();
    const arrival={world:undefined as HomeWorld|undefined,error:undefined as unknown,failed:false};
    this.homeArrival=arrival;
    try{
      if(!this.pipelineMaterial)throw new Error('缺少海岛材质');
      // The approved illustrated home does not display the old 3D island or its
      // five legacy rigs. Do not decode them alongside the first battle roster.
      if(this.art){this.syncHomePresentation();return;}
      arrival.world=this.homeWorld??new HomeWorld(this.node,this.pipelineMaterial,{reducedMotion:this.service?.settingsSnapshot.reducedMotion});
      this.homeWorld=arrival.world;this.syncHomePresentation();
    }catch(error){arrival.error=error;}
  }
  private homeLoadingError():unknown{
    if(this.homeArrival?.error||this.homeArrival?.world?.error)return this.homeArrival.error||this.homeArrival.world?.error;
    if(this.icons?.state==='failed')return new Error(this.icons.error||'海岛图标准备失败');
    if(this.panels?.state==='failed')return new Error('首页面板准备失败');
    if(this.portraits?.state==='failed')return new Error(this.portraits.error||'伙伴头像准备失败');
    if(this.art?.state==='failed')return new Error(this.art.error||'新版美术载入失败');
    return undefined;
  }
  private syncHomePresentation():void{
    if(this.art?.ready){this.backdrop??=new ArtV2Backdrop(this.node.scene,this.art);const visible=!this.appHidden&&this.screen!=='battle'&&!this.homeArrival;this.backdrop.show(visible?this.screen==='login'?'login-background':'home-background':undefined);if(this.mainCamera)this.mainCamera.clearFlags=visible?Camera.ClearFlag.DEPTH_ONLY:Camera.ClearFlag.SOLID_COLOR;}
    const home=this.homeWorld;if(!home)return;
    const pending=this.service?.snapshot;const choosing=!!pending?.outsideFusion||!!pending?.bookReveal;
    home.setReducedMotion(!!this.service?.settingsSnapshot.reducedMotion);
    home.setPaused(this.appHidden||this.screen!=='home'||!!this.homeArrival||choosing);
    home.setVisible(!this.art?.ready&&!this.appHidden&&this.screen==='home'&&!this.homeArrival&&!choosing);
  }
  private showHomeArrival(failed=false):void{
    const arrival=this.homeArrival;if(!arrival||this.screen!=='home'||this.disposed)return;
    this.goldLabel=undefined;this.staminaLabel=undefined;
    this.arrivalView?.show(failed,()=>{
      if(this.disposed||this.screen!=='home'||this.homeArrival!==arrival)return;
      this.beginHomeArrival(true);this.render();
    });
  }
  private finishHomeArrival():void{
    const arrival=this.homeArrival;
    if(!arrival||this.disposed||this.appHidden||this.screen!=='home'||!this.service)return;
    let error=this.homeLoadingError();
    const loaded=(this.art?this.art.ready:!!arrival.world?.ready)&&this.panels?.state==='ready'&&!!this.portraits?.ready&&!!this.icons?.ready;
    let activationFailed=false;
    if(!error&&loaded&&arrival.world){
      // Activate the fully assembled world while the loading UI still owns the
      // gate. Cocos onLoad and first idle initialization finish synchronously;
      // keep skeletons paused until both activation and formal UI handoff succeed.
      try{
        const home=arrival.world!;home.setPaused(true);home.setVisible(true);
        if(!home.ready)error=home.error||new Error('首页伙伴动作未能准备完成');
      }catch(failure){error=failure;}
      activationFailed=!!error;
    }
    if(error){
      if(!arrival.failed){
        arrival.error=error;arrival.failed=true;
        if(arrival.world&&(arrival.world.error||activationFailed)){arrival.world.destroy();if(this.homeWorld===arrival.world)this.homeWorld=undefined;}
        console.error('[HOME_ARRIVAL]',error);this.showHomeArrival(true);
      }
      return;
    }
    if(!loaded)return;
    // Retain the healthy shared UI across world unload/reload cycles. Only the
    // first successful arrival replaces the small bootstrap fallback.
    if(!this.interfaceReady){
      this.ui=new IslandUI(this.ui.root,this.ui.click,this.icons,this.panels,this.portraits,this.art);this.ui.soloStyle=this.solo;this.ui.soloGold=()=>this.service!.snapshot.gold;this.bindUiAudio();
      this.ui.requestReward=(kind,context,done)=>this.tasks().ad(kind,context,done);
      this.ui.share=(title,text)=>this.tasks().share(title,text);
      this.interfaceReady=true;
    }
    const home=arrival.world;this.homeArrival=undefined;if(this.art?.ready&&!this.entered)this.screen='login';this.syncHomePresentation();this.resizeViewport();this.render();
    console.info('[GOWAYGUI_HOME]',JSON.stringify({models:5,environment:'home-island',ready:true}));
    this.scheduleOnce(()=>{if(!this.disposed&&this.homeWorld===home&&this.screen==='home')this.diagnostics?.markReady();},0);
  }
  update(dt:number):void{
    if(this.disposed)return;
    if(this.skeletalReview){this.skeletalReview.update(dt);return;}
    if(this.allMapsReview&&!this.nativeTrial&&!this.g1ShowcaseStarted&&this.interfaceReady&&!this.homeArrival&&this.service){
      this.g1ShowcaseStarted=true;const raw=runtimeQuery().get('map'),id=raw===null?-1:Number(raw);
      // Local art-review link keeps the actual loading component visible until Return.
      if(runtimeQuery().get('arrival')==='review')this.arrivalView?.show(false,undefined,()=>this.arrivalView?.hide());
      if(Number.isInteger(id)&&id>=0&&id<=56){
       try{const pets=Object.keys(this.service.snapshot.collection).slice(0,5);
        if(id<=50){this.service.beginPrototypeRun(this.command('map-review'),id===50?50:id,pets,id===50?'endless':'chapter');this.openBattle();}
        else if(id===56){this.roomClient!.worldSelection=pets;this.openBattle('world');}
        else if(id===54){const enemy=matchArena(this.service.snapshot);this.service.beginArena(this.command('arena-review'),enemy,pets);this.openBattle('arena');}
        else{this.service.beginRaid(this.command('raid-review'),id===55?3:id-51,pets);this.openBattle('raid');}
       }catch(e){this.error(e);}
      }
    }
    if(this.g1Showcase&&!this.g1ShowcaseStarted&&this.interfaceReady&&!this.homeArrival&&this.service){
      this.g1ShowcaseStarted=true;this.entered=true;
      this.service.beginPrototypeRun(this.command('g1-preview'),0,Object.values(this.service.snapshot.collection).slice(0,5).map(t=>t.id),'chapter');
      this.openBattle();
    }
    if(this.g1Showcase&&this.battleScreen instanceof BattleScreen&&!this.battleArrival){
      this.g1ShowcaseWarmup+=dt;if(this.g1ShowcaseWarmup>2)this.battleScreen.startG1Presentation();
    }
    this.audio?.update(dt);
    if(!this.appHidden)this.arrivalView?.update(dt,!!this.service?.settingsSnapshot.reducedMotion);
    if(!this.appHidden)this.backdrop?.update(dt,!!this.service?.settingsSnapshot.reducedMotion);
    this.diagnostics?.recordFrame(dt,{screen:this.screen,...(this.screen==='battle'?this.battleScreen?.diagnosticContext:{})});
    if(this.screen==='battle'){if(this.battleArrival)this.finishBattleArrival();else this.battleScreen?.update(dt);}
    else if(this.screen==='home'&&!this.appHidden){this.finishHomeArrival();this.homeWorld?.update(dt);this.companionMotion?.update(dt,!!this.service?.settingsSnapshot.reducedMotion);}
    this.roomPoll+=dt;if(!this.isolatedReview&&this.roomPoll>=8&&this.entered&&this.screen!=='battle'){this.roomPoll=0;void this.roomClient?.sync().catch(()=>{});}
    this.clockElapsed+=dt;if(this.clockElapsed>=30){this.clockElapsed=0;this.refreshResources();if(!this.isolatedReview)void this.accountClient?.save().catch(e=>this.ui.toast(e instanceof Error?e.message:'云端保存暂未完成'));}
  }
  private command(kind:string):string{return `${kind}:${this.sessionTag}:${++this.commandNumber}`;}
  private readonly resizeViewport=():void=>{
    if(this.skeletalReview){this.skeletalReview.resize();return;}
    if(!this.mainCamera)return;
    const size=displayScreen.windowSize;if(size.width<=0||size.height<=0)return;
    const base=this.screen==='battle'?this.battleFov:HOME_CAMERA.baseVerticalFovDegrees,expand=Math.max(1,(1280/720)/(size.width/size.height));
    this.mainCamera.projection=this.screen==='battle'&&this.art?.ready?Camera.ProjectionType.ORTHO:Camera.ProjectionType.PERSPECTIVE;
    if(this.ui)this.ui.battleFrameLocked=false;
    if(this.screen==='battle'&&this.art?.ready){
      const id=this.challengeMode==='world'?56:this.challengeMode==='watch'?54:this.challengeMode==='online'?raidMapId(this.roomClient?.room?.tier??0):this.challengeMode==='raid'?raidMapId(this.service?.snapshot.community?.raid?.tier??0):this.challengeMode==='arena'?54:this.service?.snapshot.run?.levelId??0;
      const bounds=mapBounds(BATTLE_MAPS[id]),aspect=size.width/size.height;
      if(this.ui)this.ui.battleFrameLocked=!!(BATTLE_MAPS[id].sceneArt?.startsWith('map-coast-stage-')||BATTLE_MAPS[id].sceneArt?.startsWith('map-mode-scene-'));
      // Oblique orthographic framing compresses long north/south terrain without scaling actors or changing routes.
      this.mainCamera.orthoHeight=sys.isNative&&this.ui?.battleFrameLocked?battleCoverHalfHeight(size.width,size.height,id>=50):(id===0||BATTLE_MAPS[id].sceneArt)?5.0625*expand:Math.max((bounds.rz*Math.SQRT1_2+.85)/.88,(bounds.rx+(id===56?2.1:.65))/aspect);
    }
    this.mainCamera.clearColor=this.ui?.battleFrameLocked?new Color(18,36,42):new Color(83,159,169);
    this.mainCamera.fov=2*Math.atan(Math.tan(base*Math.PI/360)*expand)*180/Math.PI;
    this.ui?.layoutBattleEdges?.();
    if(this.screen==='home'&&this.homeAdventureCollapsed){const fold=this.ui?.root.getChildByName('主页冒险区:收起展开');fold?.setPosition(homeAdventureFold(this.ui.pageWidth).tabX,-6,0);}
    if(isValid(this.orientationGuide,true)){this.orientationGuide.active=false;this.orientationGuide.removeFromParent();this.orientationGuide.destroy();}
    this.orientationGuide=undefined;
    const scale=view.getScaleY();
    if(size.width<size.height&&scale>0&&this.ui&&isValid(this.uiCanvas,true)){
      const width=Math.min(540,size.width-32)/scale,height=44/scale;
      const guide=this.ui.group('横屏提示',0,-360-36/scale,this.uiCanvas,width,height);this.orientationGuide=guide;
      this.ui.label(sys.isMobile?'请横屏游玩':'横屏 16:9 · 调宽窗口可放大战场',0,0,13/scale,'#B1C7C8',guide,width-24/scale,height-8/scale);
    }
  };
  private menuAvailable():boolean{return !this.disposed&&!this.appHidden&&this.interfaceReady&&!this.homeArrival&&this.screen!=='battle';}
  private getPrototypeMenus():PrototypeMenus{
    return this.prototypeMenus??=new PrototypeMenus(this.ui,this.service!,kind=>this.command(kind),()=>this.menuAvailable(),()=>this.render(),
      ()=>this.go('home'),()=>this.go('collection'),id=>{this.selectedId=id;this.detailOrigin='collection';this.detailReturnPage=0;this.detailTab='skills';this.go('detail');},
      error=>this.error(error),kind=>this.audio?.effect({rub:'sfx_bubble_pop',reveal:'sfx_collect',fusionStart:'sfx_fusion_start',fusionComplete:'sfx_fusion_complete',purchase:'sfx_purchase',learn:'sfx_learn',learnComplete:'sfx_learn_complete'}[kind],kind==='rub'?90:0));
  }
  private getCommunityMenus():CommunityMenus{return this.communityMenus??=new CommunityMenus(this.ui,this.service!,kind=>this.command(kind),()=>this.menuAvailable(),()=>this.go('home'),(t,back)=>this.getPrototypeMenus().inspect(t,back),mode=>this.openBattle(mode),(e,start)=>this.error(e,start),id=>{this.watchOpponent=id;this.openBattle('watch');},this.allMapsReview?undefined:()=>this.rooms().open());}
  private bindUiAudio():void{
    this.ui.reducedMotion=()=>!!this.service?.settingsSnapshot.reducedMotion;
    this.ui.onActionError=error=>this.error(error);
    this.ui.feedback=kind=>this.audio?.effect({reward:'sfx_collect',purchase:'sfx_purchase',upgrade:'sfx_upgrade',equip:'sfx_equip',chest:'sfx_chest',learnComplete:'sfx_learn_complete',error:'sfx_ui_error',wishStart:'sfx_wish_start',wishGather:'sfx_wish_gather',wishBurst:'sfx_wish_burst'}[kind]);
  }
  private act(action:()=>void):void{if(!this.menuAvailable())return;try{action();this.render();}catch(error){this.error(error);}}
  private go(screen:Screen,page=0):void{
    if(this.disposed||this.appHidden||this.homeArrival||(!this.interfaceReady&&screen!=='home'))return;
    if(this.screen==='battle'&&screen!=='home')return;
    if(screen!=='battle'){
      if(this.battleScreen){try{this.battleScreen.checkpoint();}catch(error){this.error(error);return;}this.battleScreen.destroy();this.battleScreen=undefined;}
      this.cancelBattleArrival();
      this.mainCamera?.node.setPosition(...HOME_CAMERA.position);this.mainCamera?.node.lookAt(new Vec3(...HOME_CAMERA.target));
    }
    this.screen=screen;
    if(screen==='home'&&!this.art?.ready&&!this.homeWorld?.ready)this.beginHomeArrival();
    this.syncHomePresentation();this.resizeViewport();this.page=page;
    if(screen!=='battle')void this.audio?.playMusic('bgm_home');this.render();
  }
  private render():void{
    if(this.disposed||!this.service)return;this.syncHomePresentation();
    this.ui.battleStyle=this.screen==='battle';
    if(this.screen==='battle'){this.battleScreen?.render();return;}
    if(this.homeArrival){if(this.screen==='home')this.showHomeArrival(!!this.homeLoadingError());return;}
    if(!this.interfaceReady)return;
    if(!this.g1ShowcaseStarted){
      const requested=this.allMapsReview&&!this.nativeTrial?runtimeQuery().get('map'):null;
      if(this.g1Showcase||(requested!==null&&Number.isInteger(Number(requested))&&Number(requested)>=0&&Number(requested)<=56))return;
    }
    this.ui.clear();this.goldLabel=undefined;this.staminaLabel=undefined;const s=this.service.snapshot;
    if(s.rulesVersion==='0.6'&&this.getPrototypeMenus().resume()){if(!this.battleArrival)this.arrivalView?.hide();return;}
    this.arrivalView?.hide();
    if(this.screen==='login'){this.login();return;}
    if(this.screen==='patrol'){new PatrolView(this.ui,this.service,kind=>this.command(kind),()=>this.go('home'),error=>this.error(error),()=>{void this.accountClient?.save().catch(error=>this.ui.toast(error instanceof Error?error.message:'云端保存稍后重试'));}).open();return;}
    if(this.screen==='home')this.home();else if(this.screen==='endless')this.endless();else if(this.screen==='levels')this.levels();else if(this.screen==='adventure')this.adventure();
    else if(this.screen==='collection'||this.screen==='history')this.collection();else if(this.screen==='detail')this.detail();else if(this.screen==='workshop')this.getPrototypeMenus().workshop();else if(this.screen==='community')this.getCommunityMenus().main();else this.settings();
  }
  private resourceBar():void{
    const s=this.service!.snapshot;
    this.ui.panel(174,310,256,68);this.ui.icon('gold',80,310,42);this.goldLabel=this.ui.text(displayGold(s.gold),190,310,27,UI_COLORS.cream,this.ui.root,180,38);
    this.ui.panel(423,310,226,68);this.ui.icon('stamina',340,310,38);this.staminaLabel=this.ui.text(`${s.stamina}/30`,410,310,27,UI_COLORS.cream,this.ui.root,114,38);
    this.ui.button('+',494,310,62,62,()=>this.energyDialog(),{size:30});this.ui.button('设置',580,310,84,68,()=>this.go('settings'),{size:23});
  }
  private login():void{
    if(this.art?.ready){const logo=this.ui.group('哥喂龟字标',0,198);this.art.attach(logo,'game-logo',608,243);}else this.ui.text('哥喂龟',0,230,92,'#FFF1CC',this.ui.root,730,126);
    this.ui.button('开始游戏',0,-218,430,96,()=>{this.entered=true;this.go('home');},{primary:true,size:38});
    this.ui.text('本地试玩',0,-285,22,UI_COLORS.cream,this.ui.root,220,34);
    this.ui.button('说明',-164,-329,136,42,()=>this.loginInfo('说明','当前可在本机保存与游玩。真实平台登录、公告与客服在发布接入时启用。'),{size:20});
    this.ui.button('存档与隐私',40,-329,228,42,()=>this.loginInfo('存档与隐私','养成进度保存在当前浏览器。副本房间服务保存昵称、备战阵容、战斗和奖励送达状态；清除浏览器数据会删除本地进度。'),{size:20});
    this.ui.button('设置',552,300,106,68,()=>this.go('settings'),{size:24});
  }
  private loginInfo(title:string,text:string):void{const p=this.ui.sheet(title,'',()=>p.parent?.destroy());this.ui.text(text,0,0,30,UI_COLORS.cream,p,900,210,true);this.ui.button('返回',0,-276,320,88,()=>p.parent?.destroy(),{parent:p,size:28});}
  private home():void{
    if(this.solo){this.soloHome();return;}
    if(!this.art?.ready){this.legacyHome();return;}
    const s=this.service!.snapshot,ongoing=s.run,pending=pendingTakeaways(s).length;
    if(this.allMapsReview)this.ui.button('全地图验收',15,319,164,42,()=>this.reviewMaps(),{size:20});
    const animateCollapse=this.homeAnimateCollapse&&!s.settings.reducedMotion;this.homeAnimateCollapse=false;
    const roles:Role[]=['stone','spike','crystal','leaf','bubble'];
    const available=availablePets(s),pets=available.map(p=>p.turtle);
    const field=ongoing&&ongoing.phase!=='result'?Object.values(ongoing.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot!==null).sort((a,b)=>a.slot!-b.slot!).map(u=>u.turtle):[];
    const selected=(s.homeTeam??[]).map(id=>available.find(p=>p.id===id)?.turtle).filter((t):t is Turtle=>!!t);
    const suggested=roles.map(role=>pets.find(p=>p.role===role)).filter((t):t is Turtle=>!!t);
    const team=[...selected,...suggested.filter(t=>!selected.includes(t)),...pets.filter(t=>!selected.includes(t)&&!suggested.includes(t))].slice(0,5);
    const hero=team.find(t=>t.id===this.homeHeroId)??team.find(t=>t.role===this.homeHeroRole)??pets[0],role=hero?.role??this.homeHeroRole;
    const circlePortrait=(r:Role,x:number,y:number,size:number,parent=this.ui.root,selected=false,qualityColor?:string,advanced=false)=>{
      const n=this.ui.group('圆形伙伴:'+r,x,y,parent,size,size),g=n.addComponent(Graphics);
      g.fillColor=Color.WHITE;g.circle(0,0,size/2);g.fill();
      g.strokeColor=new Color(qualityColor??(selected?'#FF8755':'#E3EAE6'));g.lineWidth=2;g.circle(0,0,size/2-2);g.stroke();
      const clip=this.ui.group('头像裁切',0,0,n,size-8,size-8);clip.addComponent(Mask).type=Mask.Type.GRAPHICS_ELLIPSE;
      this.art?.attach(clip,`portrait-${r}`,size-8,size-8);return n;
    };
    const avatar=circlePortrait(s.avatar?.role??'crystal',-578,312,64);
    if(s.avatar?.image)paintAvatar(avatar,s.avatar.image,58);
    this.ui.hover(avatar);avatar.on(Node.EventType.TOUCH_END,()=>avatarPicker(this.ui,this.service!,()=>this.render(),e=>this.error(e)));
    this.ui.text(s.community?.name??'小岛主',-469,310,24,UI_COLORS.ink,this.ui.root,120,38);
    const rename=this.ui.button('',-386,311,34,34,()=>this.communityEntry('rename'));this.art?.attach(rename,'control-5',24,24);
    const mailButton=this.ui.button('✉',142,319,54,46,()=>this.rewards().mailbox(()=>this.go('home')),{size:30});mailButton.name='系统邮件';if(s.mailbox?.items.some(m=>!m.read||!m.claimed&&m.grants.length))this.ui.text('●',21,15,13,'#F08E69',mailButton,20,20);
    if(this.roomClient?.room)this.ui.button('我的队伍',58,263,138,40,()=>{this.go('community');this.rooms().lobby();},{size:20});
    const coins=this.ui.panel(278,319,178,46,this.ui.root,'#07536C',255,23);this.ui.icon('gold',-66,0,35,coins);
    this.goldLabel=this.ui.text(displayGold(s.gold),15,0,27,'#FFFFFF',coins,135,36);this.goldLabel.overflow=Label.Overflow.SHRINK;
    const energy=this.ui.panel(460,319,174,46,this.ui.root,'#07536C',255,23);this.ui.icon('stamina',-63,0,33,energy);
    this.staminaLabel=this.ui.text(`${s.stamina}/30`,-1,0,26,'#FFFFFF',energy,94,36);
    this.ui.button('+',61,0,38,38,()=>this.energyDialog(),{parent:energy,primary:true,size:31});
    const settings=this.ui.button('',589,319,56,56,()=>this.go('settings'),{primary:true});this.art?.attach(settings,'control-4',35,35);
    const left=(text:string,x:number,y:number,size:number,w:number)=>{const l=this.ui.text(text,x,y,size,UI_COLORS.ink,this.ui.root,w,size*1.4);l.horizontalAlign=Label.HorizontalAlign.LEFT;return l;};
    const adventureStart=this.ui.root.children.length;
    this.ui.panel(-450,7,380,514,this.ui.root,'#FFF9EC',193,24);
    this.ui.panel(-603,245,7,27,this.ui.root,UI_COLORS.green,255,3);left('冒险',-511,245,31,156);
    const modes:[string,number,()=>void][]=[['关卡',7,()=>this.go('levels',Math.floor(s.unlockedLevel/5))],['无尽',8,()=>this.go('endless')],['副本',9,()=>this.communityEntry('raids')],['竞技场',10,()=>this.communityEntry('arena')]];
    modes.forEach(([title,icon,action],i)=>{const n=this.ui.button('',-529+(i%2)*163,160-Math.floor(i/2)*117,158,110,action,{primary:i===0});n.name='冒险模式:'+title;const pict=this.ui.group('模式图标',0,17,n,70,70);this.art?.attach(pict,`control-${i}`,70,70);this.ui.text(title,0,-34,27,i===0?'#FFFFFF':UI_COLORS.ink,n,138,37);});
    const level=LEVELS[ongoing&&ongoing.mode!=='endless'&&ongoing.phase!=='result'?ongoing.levelId:s.unlockedLevel]??LEVELS[0];
    const wave=ongoing?.levelId===level.id&&ongoing.phase!=='result'?ongoing.wave:0;
    this.ui.panel(-603,-45,7,25,this.ui.root,UI_COLORS.green,255,3);left('当前挑战',-491,-44,24,194);
    left(`第${level.id+1}关 · ${level.name}`,-447,-87,30,330);
    const waveLimit=ongoing?.levelId===level.id&&ongoing.phase!=='result'?(ongoing.waveLimit??level.waves):chapterWaves(level.id);
    this.ui.progress(-516,-126,177,18,wave/waveLimit,UI_COLORS.green);left(`进度 ${wave}/${waveLimit}波`,-341,-126,20,123);
    const primary=this.ui.button(pending?'整理伙伴':ongoing&&ongoing.phase!=='result'?'继续冒险':'开始冒险',-448,-202,330,84,()=>pending?this.getPrototypeMenus().takeaways():ongoing&&ongoing.phase!=='result'?this.openBattle():this.go('levels',Math.floor(s.unlockedLevel/5)),{primary:true,size:38});primary.name='主页开始冒险';const arrow=this.ui.group('继续箭头',130,0,primary,37,37);this.art?.attach(arrow,'control-7',37,37);for(const child of primary.children){const label=child.getComponent(Label);if(label){child.setPosition(-16,0);child.getComponent(UITransform)?.setContentSize(258,65);}}
    const adventureNodes=this.ui.root.children.slice(adventureStart),adventure=this.ui.group('可收起冒险区');
    const foldLayout=homeAdventureFold(this.ui.pageWidth);
    adventureNodes.forEach(n=>n.setParent(adventure));const adventureX=this.homeAdventureCollapsed?foldLayout.hiddenX:0;adventure.setPosition(animateCollapse?(this.homeAdventureCollapsed?0:foldLayout.hiddenX):adventureX,0);
    if(animateCollapse)tween(adventure).to(.22,{position:new Vec3(adventureX,0,0)},{easing:'quadOut'}).call(()=>{if(isValid(adventure,true)&&this.homeAdventureCollapsed)adventure.active=false;}).start();
    else adventure.active=!this.homeAdventureCollapsed;
    const fold=this.ui.button(this.homeAdventureCollapsed?'›':'‹',this.homeAdventureCollapsed?foldLayout.tabX:-258,-6,28,56,()=>{this.audio?.effect('sfx_panel_slide');this.homeAdventureCollapsed=!this.homeAdventureCollapsed;this.homeAnimateCollapse=true;this.render();},{primary:true,size:32});fold.name='主页冒险区:收起展开';const foldOpacity=fold.addComponent(UIOpacity);foldOpacity.opacity=150;fold.on(Node.EventType.MOUSE_ENTER,()=>foldOpacity.opacity=225);fold.on(Node.EventType.MOUSE_LEAVE,()=>foldOpacity.opacity=150);
    fold.on(Node.EventType.MOUSE_ENTER,()=>fold.setScale(1.08,1.08,1));fold.on(Node.EventType.MOUSE_LEAVE,()=>fold.setScale(1,1,1));
    const heroScale=role==='stone'?1:.89,heroHeight=423*heroScale;
    const image=this.ui.group('主页主角',this.homeAdventureCollapsed?0:68,106-(423-heroHeight)*.45,this.ui.root,490*heroScale,heroHeight);image.setSiblingIndex(0);
    const heroSprite=this.art?.attach(image,`hero-${role}`,490*heroScale,heroHeight);if(heroSprite)this.companionMotion=new CompanionMotion(heroSprite,role,image,this.art!);
    const info=this.ui.panel(this.homeAdventureCollapsed?268:330,this.homeChatState.expanded?-44:-6,154,98,this.ui.root,'#FFF9EC',222,20);
    this.ui.text(hero?visualName(hero):HERO_LOOK[role].name,-3,24,26,UI_COLORS.ink,info,136,34);
    const quality=hero?turtleQuality(hero):undefined;
    this.ui.hover(info);info.on(Node.EventType.TOUCH_END,()=>{if(!hero||!this.ui.isInteractive(info))return;this.ui.click();new PetDetails(this.ui,this.service!,k=>this.command(k),e=>this.error(e)).show(hero,{owned:true,learn:()=>{this.selectedId=hero.id;if(this.solo)this.getPrototypeMenus().skillBooks(hero.id);else this.skillBooksDialog();}});});
    this.ui.text(HERO_LOOK[role].job,-35,-6,18,UI_COLORS.ink,info,61,25);
    const badge=this.ui.panel(35,-6,54,24,info,quality?.color??'#119B68',255,12);this.ui.text(quality?.name??'良好',0,0,16,'#FFFFFF',badge,52,24);
    this.ui.text(`${hero?.skills.length??2}技能  ›`,0,-32,17,UI_COLORS.sand,info,128,24);
    this.ui.panel(-204,-109,6,21,this.ui.root,UI_COLORS.green,255,3);
    left(`出战小队  ${team.filter(Boolean).length}/5`,-99,-109,23,193);
    patrolEntry(this.ui,this.service!,()=>this.go('patrol'));
    this.ui.button('换阵容',50,-109,92,33,()=>this.chooseTeam(level.id,false,'chapter',true),{size:18});
    const portraitStart=this.homeAdventureCollapsed?-(team.length-1)*143/2:-130;
    team.forEach((t,i)=>{const picked=t.id===hero?.id,x=portraitStart+i*143,n=circlePortrait(t.role,x,-191,112,this.ui.root,picked,turtleQuality(t).color,t.skills.length>=10);this.ui.hover(n);n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();this.homeHeroRole=t.role;this.homeHeroId=t.id;this.render();});const marker=picked?this.ui.panel(x,-255,91,10,this.ui.root,'#FF8755',255,5):undefined;
      if(animateCollapse){const before=(this.homeAdventureCollapsed?-130:-(team.length-1)*143/2)+i*143;n.setPosition(before,-191);tween(n).to(.22,{position:new Vec3(x,-191,0)},{easing:'quadOut'}).start();if(marker){marker.setPosition(before,-255);tween(marker).to(.22,{position:new Vec3(x,-255,0)},{easing:'quadOut'}).start();}}
    });
    const nav=this.ui.panel(0,-313,1220,82,this.ui.root,'#FFF9EC',250,24);
    const entries:[string,number,()=>void][]=[['龟龟',0,()=>this.go('collection')],['技能',1,()=>this.getPrototypeMenus().skillInventory()],['合成',1,()=>this.go('workshop')],['市场',2,()=>this.marketHub()],['任务',6,()=>this.tasks().open()],['图鉴',6,()=>new AchievementMenus(this.ui,this.service!,k=>this.command(k),()=>this.go('home'),e=>this.error(e)).open()],['好友',5,()=>this.communityEntry('friends')],['排行',6,()=>this.communityEntry('rankings')],['世界挑战',7,()=>this.openWorldBoss()]];
    entries.forEach(([title,icon,go],i)=>{const x=(i-4)*128,n=this.ui.group('主页导航:'+title,x,0,nav,112,78);const mark=title==='任务'?this.ui.art?.attach(this.ui.group('任务宝箱',0,16,n,40,40),'chest-1',40,40):title==='技能'?this.ui.modernIcon(13,0,12,35,n):this.ui.modernIcon(icon,0,17,40,n);this.ui.text(title,0,-24,22,UI_COLORS.ink,n,112,30);this.ui.hover(n);n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();go();});if(i<entries.length-1)this.ui.line(x+64,-25,x+64,25,nav,'#D6DEDA');});
    homeChat(this.ui,this.service!,this.homeChatState,()=>this.render(),kind=>this.command(kind),e=>this.error(e));
  }
  private soloHome():void{
    const ui=this.ui,s=this.service!.snapshot,r=s.run,pending=pendingTakeaways(s).length;
    const pets=Object.values(s.collection),team=(s.homeTeam??pets.slice(0,5).map(t=>t.id)).map(id=>s.collection[id]).filter(Boolean);
    const hero=team.find(t=>t.id===this.homeHeroId)??team.find(t=>t.role===this.homeHeroRole)??pets[0],role=hero?.role??'stone';
    const margin=Math.max(0,(ui.pageWidth-1280)/2),leftX=-430-margin*.59;
    ui.pet(hero??pets[0],-577-margin*.55,310,64);ui.text(s.community?.name??'小岛主',-469-margin*.55,310,25,UI_COLORS.ink,ui.root,132,37);
    if(this.soloReview)ui.text('验收试玩 · 全部解锁',90,314,20,'#07536C',ui.root,265,34);
    const coins=ui.panel(423+margin*.55,313,239,52,ui.root,'#07536C',250,26);ui.icon('gold',-83,0,37,coins);this.goldLabel=ui.text(displayGold(s.gold),20,0,28,'#FFFFFF',coins,173,38);
    const settings=ui.button('',592+margin*.55,313,62,59,()=>this.go('settings'),{primary:true});ui.art?.attach(settings,'control-4',37,37);
    const box=ui.panel(leftX,-30,366+margin*.62,569,ui.root,'#FFF9EC',235,25);box.active=!this.homeAdventureCollapsed;ui.button(this.homeAdventureCollapsed?'›':'‹',this.homeAdventureCollapsed?-ui.pageWidth/2+29:leftX+183+margin*.31,-15,38,62,()=>{this.homeAdventureCollapsed=!this.homeAdventureCollapsed;this.render();},{primary:true,size:31});
    ui.text('冒险',-86,242,32,UI_COLORS.ink,box,170,44);
    [['关卡',0,()=>this.go('levels',Math.floor(s.unlockedLevel/5))],['无尽',1,()=>this.go('endless')]].forEach((item,i)=>{
      const n=ui.button('',-85-margin*.16+i*(170+margin*.32),159,157+margin*.29,111,item[2] as ()=>void,{parent:box,primary:i===0});ui.art?.attach(ui.group('冒险图标',0,16,n),`control-${i}`,62,57);ui.text(item[0] as string,0,-33,27,i===0?'#FFFFFF':UI_COLORS.ink,n,138,37);
    });
    const level=LEVELS[r&&r.phase!=='result'&&r.mode==='chapter'?r.levelId:s.unlockedLevel]??LEVELS[0],wave=r?.phase!=='result'&&r?.levelId===level.id?r.wave:0,limit=chapterWaves(level.id);
    ui.text('当前挑战',-65,65,23,UI_COLORS.sand,box,219,34);ui.text(`第${level.id+1}关 · ${level.name}`,0,23,27,UI_COLORS.ink,box,331,43);
    ui.progress(-57,-20,197,12,wave/limit,UI_COLORS.green,box);ui.text(wave+'/'+limit+' 波',108,-20,19,UI_COLORS.sand,box,100,28);ui.line(-157,-55,157,-55,box,'#CEDFD9');
    const next=SOLO_MILESTONES.find(m=>milestoneValue(s,m.kind)<m.target),value=next?milestoneValue(s,next.kind):1;
    ui.modernIcon(6,-133,-92,40,box);ui.text(next?'下一目标：'+next.name:'全部里程碑已达成',26,-87,22,UI_COLORS.ink,box,275,34);ui.text(next?.detail??'继续探索新的技能搭配',25,-119,19,UI_COLORS.sand,box,278,28);
    ui.progress(-19,-156,270,12,next?value/next.target:1,UI_COLORS.green,box);ui.text(next?Math.min(value,next.target)+'/'+next.target:'完成',136,-156,18,UI_COLORS.sand,box,65,28);
    ui.button(pending?'整理伙伴':r&&r.phase!=='result'?'继续冒险':'开始冒险',0,-227,326+margin*.62,80,()=>pending?this.getPrototypeMenus().takeaways():r&&r.phase!=='result'?this.openBattle():this.go('levels',Math.floor(s.unlockedLevel/5)),{parent:box,primary:true,size:36});
    const scale=role==='stone'?1:.89,image=ui.group('单机主页主角',120,95,ui.root,485*scale,416*scale);image.setSiblingIndex(0);const sprite=this.art?.attach(image,`hero-${role}`,485*scale,416*scale);if(sprite)this.companionMotion=new CompanionMotion(sprite,role,image,this.art!);
    const info=ui.button('',416,9,164,101,()=>{if(hero)new PetDetails(ui,this.service!,k=>this.command(k),e=>this.error(e)).show(hero,{owned:true,learn:()=>{this.selectedId=hero.id;if(this.solo)this.getPrototypeMenus().skillBooks(hero.id);else this.skillBooksDialog();}});});
    ui.text(hero?visualName(hero):'岩盾',0,27,27,UI_COLORS.ink,info,151,38);ui.text(HERO_LOOK[role].job+' · '+(hero?turtleQuality(hero).name:''),0,-7,19,UI_COLORS.sand,info,155,28);ui.text((hero?.skills.length??4)+'技能 ›',0,-34,18,'#008F96',info,151,28);
    ui.text('出战小队 '+team.length+'/5',-82,-113,23,UI_COLORS.ink,ui.root,223,35);ui.button('换阵容',515,-113,111,38,()=>this.chooseTeam(level.id,false,'chapter',true),{size:20});
    team.forEach((t,i)=>{const x=-125-margin*.2+i*(143+margin*.14),n=ui.group('单机出战头像',x,-199,ui.root,108,108),mask=n.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_ELLIPSE;ui.art?.attach(n,`portrait-${t.role}`,108,108);n.on(Node.EventType.TOUCH_END,()=>{ui.click();this.homeHeroId=t.id;this.homeHeroRole=t.role;this.render();});ui.hover(n);if(t.id===hero?.id)ui.panel(x,-259,82,7,ui.root,'#FF9866',255,3);});
    const nav=ui.panel(164+margin*.43,-313,740,78,ui.root,'#FFF9EC',250,23);
    const entries:[string,number,()=>void][]=[['龟龟',0,()=>this.go('collection')],['技能',13,()=>this.getPrototypeMenus().skillInventory()],['合成',1,()=>this.go('workshop')],['商城',2,()=>this.openShop()],['成就',6,()=>this.soloMenus().achievements()]];
    entries.forEach(([name,icon,go],i)=>{const n=ui.button('',(i-2)*139,0,131,74,go,{parent:nav,surface:'bare'});ui.modernIcon(icon,0,15,36,n);ui.text(name,0,-23,23,UI_COLORS.ink,n,126,32);});
  }
  private openWorldBoss():void{new WorldBossMenus(this.ui,this.service!,this.roomClient??=new RoomClient(this.service!,this.accountClient??=new AccountClient(this.service!)),k=>this.command(k),()=>this.go('home'),()=>this.openBattle('world'),e=>this.error(e),this.allMapsReview).open();}
  private marketHub():void{
    this.ui.clear();const p=this.ui.sceneSheet('海岛市场',()=>this.go('home'),'market-pavilion');
    const items:[string,number,string,()=>void][]=[['招募与补给',2,'伙伴 · 技能 · 培养材料',()=>this.openShop()],['伙伴交易',3,'自由交换 · 发现新搭配',()=>this.communityEntry('trade')],['租赁助战',4,'借一位伙伴 · 多一种战术',()=>this.communityEntry('rental')]];
    items.forEach(([title,icon,caption,action],i)=>{const n=this.ui.button('',(i-1)*373,-159,283,225,action,{parent:p});this.ui.decoration('decor-market',0,2,326,261,n);this.ui.modernIcon(icon,0,52,88,n);this.ui.text(title,0,-13,28,UI_COLORS.ink,n,254,42);this.ui.text(caption,0,-50,17,UI_COLORS.sand,n,267,30);this.ui.text('›',0,-90,31,'#00A8B7',n,58,34);});
    this.ui.text('海风相伴，好物相逢',0,182,28,'#124C65',p,780,46);
  }
  private legacyHome():void{
    const s=this.service!.snapshot,ongoing=s.run,pending=pendingTakeaways(s).length;
    if(this.art?.ready){const cast:[Role,number,number,number][]=[['stone',-155,-80,220],['leaf',157,-80,212],['spike',-298,-126,208],['bubble',307,-130,216],['crystal',0,-97,196]];cast.forEach(([role,x,y,side])=>this.ui.portrait(role,x,y,side));}
    this.resourceBar();
    this.ui.panel(-424,300,386,94);this.ui.portrait('crystal',-568,300,76);
    this.ui.text(s.community?.name??'新岛主',-423,302,28,UI_COLORS.cream,this.ui.root,184,42);
    this.ui.button('改名',-283,300,94,64,()=>this.communityEntry('rename'),{size:23});
    const entry=(name:string,x:number,y:number,action:()=>void)=>{const n=this.ui.button('',x,y,200,68,action,{size:27});if(this.art?.ready){for(const child of [...n.children]){child.removeFromParent();child.destroy();}this.art.attach(n,'wood',200,68);this.ui.text(name,0,0,27,UI_COLORS.cream,n,180,40);}else this.ui.text(name,0,0,27,UI_COLORS.cream,n,180,40);};
    entry('合成工坊',-382,133,()=>this.go('workshop'));entry('交易行',-506,28,()=>this.communityEntry('trade'));
    entry('我的龟龟',-460,-185,()=>this.go('collection'));entry('租赁市场',330,138,()=>this.communityEntry('rental'));
    entry('商城',490,28,()=>this.openShop());entry('排行',470,-138,()=>this.communityEntry('rankings'));entry('好友',505,-225,()=>this.communityEntry('friends'));
    this.ui.button('无尽之海',0,192,222,64,()=>this.go('endless'),{size:28});
    this.ui.button(pending?'整理伙伴':ongoing&&ongoing.phase!=='result'?'继续冒险':'开始冒险',0,-246,410,92,()=>pending?this.getPrototypeMenus().takeaways():ongoing&&ongoing.phase!=='result'?this.openBattle():this.go('levels',Math.floor(s.unlockedLevel/5)),{primary:true,size:36});
    const challenge=s.community?.raid&&!s.community.raid.settled?'raid':s.community?.arena&&!s.community.arena.settled?'arena':undefined;
    if(challenge)this.ui.button('继续'+(challenge==='raid'?'副本':'竞技场'),0,-147,244,58,()=>this.openBattle(challenge),{size:25});
    const modes:[string,()=>void][]=[['关卡',()=>this.go('levels',Math.floor(s.unlockedLevel/5))],['无尽',()=>this.go('endless')],['副本',()=>this.communityEntry('raids')],['竞技场',()=>this.communityEntry('arena')]];
    modes.forEach(([name,go],i)=>this.ui.button(name,-225+i*150,-327,140,64,go,{size:26,selected:i===0}));
    const messages=(s.community?.messages??[]).filter(m=>m.to==='world').slice(-2),chat=this.ui.panel(-454,-303,326,this.homeChatOpen?102:58);
    this.ui.text(this.homeChatOpen?messages.map(m=>`${m.from==='local-player'?'你':s.community?.aiPlayers[m.from]?.name??'岛友'}：${m.text}`).join('\n')||'暂无消息':'聊天',-12,this.homeChatOpen?5:0,19,UI_COLORS.cream,chat,274,this.homeChatOpen?70:30,true);
    this.ui.button(this.homeChatOpen?'收起':'展开',132,0,52,46,()=>{this.homeChatOpen=!this.homeChatOpen;this.render();},{parent:chat,size:18});
    if(this.homeChatOpen)this.ui.button('聊天',-450,-236,180,46,()=>this.communityEntry('chat'),{size:21});
  }
  private endless():void{
    if(this.solo){this.soloMenus().endless(()=>this.chooseTeam(PROTOTYPE.endless.map,false,'endless'));return;}
    if(this.art?.ready){this.endlessV2();return;}
    const s=this.service!.snapshot,locked=!s.cleared.includes(PROTOTYPE.endless.unlockAfter),p=this.ui.sheet('无尽模式','',()=>this.go('home'));
    this.ui.text('最高波次',-408,151,28,UI_COLORS.sand,p,320,40);this.ui.text(String(s.endlessBest?.waves??0),-408,72,78,UI_COLORS.gold,p,320,112);
    this.ui.text('主要产出',390,154,28,UI_COLORS.sand,p,310,42);['gold','attack-medicine','health-medicine','defense-medicine','growth-history'].forEach((key,i)=>this.ui.icon(key as IslandIconId,260+(i%3)*116,58-Math.floor(i/3)*104,72,p));
    this.ui.text('阶段奖励',0,-112,28,UI_COLORS.sand,p,500,44);[5,10,15,20,25,30].forEach((wave,i)=>{const n=this.ui.panel(-450+i*180,-184,160,82,p);this.ui.text(`${wave}波`,0,0,27,UI_COLORS.cream,n,144,40);});
    this.ui.button('规则',-440,-278,224,84,()=>this.loginInfo('无尽规则','五只龟守护中心。每波入口轮换，逐步增加至四路同时来袭。每五波获得一次宝藏，点暂停抽取后，可金币续开或放弃。'),{parent:p,size:28});
    this.ui.button(locked?'通关第2关开启':'开始挑战',152,-278,650,88,()=>this.chooseTeam(PROTOTYPE.endless.map,false,'endless'),{parent:p,primary:true,disabled:locked,size:34});
  }
  private endlessV2():void{
    const s=this.service!.snapshot,locked=!s.cleared.includes(PROTOTYPE.endless.unlockAfter),chart=new SeaChart(this.ui,'chart-endless','无尽之海','乘风破浪 · 挑战百波',()=>this.go('home'),()=>!!this.service!.settingsSnapshot.reducedMotion),p=chart.root;
    p.getChildByName('按钮:返回海岛')?.setPosition(-491,312);
    this.ui.text('最高抵达',-459,131,23,UI_COLORS.sand,p,310,36);
    this.ui.text((s.endlessBest?.waves??0)+' 波',-459,76,47,UI_COLORS.ink,p,310,64);
    const positions=[[-227,-89],[-106,-27],[8,41],[149,92],[279,144],[417,199],[535,265]];
    ENDLESS_ROUTE_WAVES.forEach((wave,index)=>{const [x,y]=positions[index],earned=(s.progression?.chests??[]).filter(chest=>chest.id.startsWith('endless:')&&chest.title===wave+'波里程宝箱'),ready=earned.some(chest=>!chest.claimed);
      chart.chest(x,y,index<2?0:index<5?1:2,()=>this.rewards().endlessMilestone(wave,()=>this.go('endless')),ready,index===6?72:61);
      chart.tag(wave+' 波',x,y-42,86,ready,()=>this.rewards().endlessMilestone(wave,()=>this.go('endless')));
    });
    chart.boat(-354,-96,157);
    chart.button('我的宝箱',-332,-264,210,52,()=>this.rewards().boxes('endless',()=>this.go('endless'),0,0,true));
    chart.button(locked?'通关第2关开启':'开始远征',0,-264,340,58,()=>this.chooseTeam(PROTOTYPE.endless.map,false,'endless'),true,locked);
    chart.button('奖励 / 规则',332,-264,210,52,()=>this.rewards().boxes('endless',()=>this.go('endless')));
    this.ui.panel(0,-319,594,29,p,'#FFF9EC',235,12);
    this.ui.text('每 5 波奖励提升 · 征召无上限 · 同阶合成进化',0,-319,17,UI_COLORS.ink,p,580,27);
  }
  private communityEntry(entry:'friends'|'rankings'|'trade'|'rental'|'raids'|'arena'|'chat'|'rename'):void{
    this.go('community');
    // 副本始终进入完整的海图、备战、匹配和邀请流程；试玩环境也保留这层界面。
    if(entry==='raids'&&!this.nativeTrial){this.rooms().open();return;}
    this.getCommunityMenus().entry(entry);
  }
  private openShop():void{if(this.solo){this.soloMenus().shop(pool=>this.getPrototypeMenus().shop(pool));return;}this.getPrototypeMenus().shop(this.art?.ready?'pack':'turtle');}
  private adventure():void{
    const s=this.service!.snapshot,p=this.heading('选择冒险','普通关卡、无尽、副本与竞技场分别挑战。');
    const entries:[string,string,()=>void,boolean][]=[
      ['海岛关卡',`已通关 ${s.cleared.length}/50 · 每五关一个区域`,()=>this.go('levels',Math.floor(s.unlockedLevel/5)),false],
      ['无尽模式',`最高 ${s.endlessBest?.waves??0} 波 · 培养资源`,()=>this.chooseTeam(PROTOTYPE.endless.map,false,'endless'),!s.cleared.includes(PROTOTYPE.endless.unlockAfter)],
      ['四大副本','五人队 · 高难度 · 自有龟挑战',()=>this.communityEntry('raids'),false],
      ['竞技场','安排五龟顺序与站位',()=>this.communityEntry('arena'),false]];
    entries.forEach(([name,tip,action,locked],i)=>{const n=this.ui.button('',-276+i%2*552,104-Math.floor(i/2)*200,520,176,action,{parent:p,disabled:locked});this.ui.text(name,0,38,36,UI_COLORS.gold,n,488,48);this.ui.text(locked?'通关第 2 关后开启':tip,0,-35,27,UI_COLORS.sand,n,488,72,true);});
  }
  private heading(title:string,subtitle:string):Node{
    return this.ui.sheet(title,subtitle,()=>this.go('home'),'返回海岛');
  }
  private reviewMaps(page=0):void{
    this.ui.clear();const maps=BATTLE_MAPS,pages=Math.ceil(maps.length/12),p=this.ui.sheet('全地图验收','独立试玩进度 · 关卡、无尽、副本、竞技场全部可进入',()=>this.go('home'));
    maps.slice(page*12,page*12+12).forEach((map,i)=>this.ui.button((map.id<50?'第'+(map.id+1)+'关 · ':'')+map.name,-410+i%3*410,155-Math.floor(i/3)*100,390,80,()=>{if(this.nativeTrial){this.openNativeTrialMap(map.id);return;}location.href='?preview=all-maps&all-modes=1'+(runtimeQuery().get('balance')==='coast'?'&balance=coast':'')+'&map='+map.id+(this.diagnostics?.enabled?'&qa=1':'');},{parent:p,size:21}));
    this.ui.button('上一页',-300,-277,220,48,()=>this.reviewMaps(page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / '+pages,0,-277,22,UI_COLORS.ink,p,160,35);this.ui.button('下一页',300,-277,220,48,()=>this.reviewMaps(page+1),{parent:p,disabled:page+1===pages,size:22});
  }
  private openNativeTrialMap(id:number,replace=false):void{
    if(!this.nativeTrial||!this.menuAvailable()||!Number.isInteger(id)||id<0||id>56)return;
    try{const s=this.service!,pets=Object.keys(s.snapshot.collection).slice(0,5);
      if(id<=50){s.beginPrototypeRun(this.command('native-map'),id,pets,id===50?'endless':'chapter',replace);void this.openBattle();}
      else if(id===56){this.roomClient!.worldSelection=pets;void this.openBattle('world');}
      else if(id===54){s.beginArena(this.command('native-arena'),matchArena(s.snapshot),pets,replace);void this.openBattle('arena');}
      else{s.beginRaid(this.command('native-raid'),id===55?3:id-51,pets,replace);void this.openBattle('raid');}
    }catch(error){this.error(error,()=>this.openNativeTrialMap(id,true));}
  }
  private levels():void{
    if(this.solo){this.soloMenus().levels(this.page,id=>this.chooseTeam(id),page=>{this.page=page;this.render();});return;}
    const s=this.service!.snapshot,pages=Math.ceil(LEVELS.length/5);this.page=Math.max(0,Math.min(this.page,pages-1));
    const regions=['初晴海湾','珊瑚潮汐','翠竹长湾','日光遗迹','远洋回声','翡翠林岸','双庭圣殿','白沙环礁','深海回廊','终焉海庭'];
    if(this.art?.ready){renderChapterMap(this.ui,LEVELS,this.page,regions[this.page],s,id=>this.chooseTeam(id),page=>{this.page=page;this.render();},()=>this.go('home'));return;}
    const p=this.ui.sceneSheet(regions[this.page],()=>this.go('home'),(BATTLE_MAPS[this.page*5].sceneArt??'approved-coast') as any);
    this.ui.panel(0,0,1200,458,p,'#143E4E',75,18);
    LEVELS.slice(this.page*5,this.page*5+5).forEach((level,i)=>{
      const big=i===0,x=big?-379:4+(i-1)%2*370,y=big?5:111-Math.floor((i-1)/2)*212;
      const n=this.ui.scenicCard((level.sceneArt??'approved-coast') as any,x,y,big?390:350,big?402:190,'第 '+(level.id+1)+' 关 · '+level.name,s.cleared.includes(level.id)?'✓ 已通关 · 重新挑战':chapterWaves(level.id)+' 波守护 · 每波首领祝福',()=>this.chooseTeam(level.id),p,level.id>s.unlockedLevel);
      if(level.id===s.unlockedLevel)this.ui.panel(-110,(big?201:95)-20,132,27,n,'#009CA4',245,10),this.ui.text('当前挑战',-110,(big?201:95)-20,17,'#FFFFFF',n,124,25);
    });
    this.ui.button('‹ 上一海域',-383,-278,255,52,()=>{this.page--;this.render();},{parent:p,disabled:this.page===0,size:23});
    const marker=this.ui.panel(0,-278,265,49,p,'#FFF9EC',238,18);this.ui.text('海域 '+(this.page+1)+' / '+pages,0,0,23,UI_COLORS.ink,marker,245,36);
    this.ui.button('下一海域 ›',383,-278,255,52,()=>{this.page++;this.render();},{parent:p,disabled:this.page===pages-1,size:23});
  }
  private chooseTeam(levelId:number,keep=false,mode:RunMode='chapter',homeEdit=false):void{
    if(!this.menuAvailable()||!(homeEdit?['home','collection'].includes(this.screen):['levels','adventure','endless'].includes(this.screen)))return;
    const s=this.service!.snapshot,available=homeEdit?Object.values(s.collection):availablePets(s).map(p=>({...p.turtle,id:p.id}));
    const modern=s.rulesVersion==='0.6',order=modern?['stone','spike','crystal','leaf','bubble']:available.some(t=>t.role==='spike')?['spike','stone','crystal','leaf','bubble']:['crystal','stone','bubble','leaf','spike'];
    const all=available.sort((a,b)=>order.indexOf(a.role)-order.indexOf(b.role));
    if(!keep){
      const suggested=modern?order.map(role=>all.find(t=>t.role===role)).filter((t):t is Turtle=>!!t):[];
      const saved=(s.homeTeam??[]).filter(id=>all.some(t=>t.id===id));
      this.teamSelection=[...saved,...[...suggested,...all.filter(t=>!suggested.includes(t))].map(t=>t.id).filter(id=>!saved.includes(id))].slice(0,5);this.page=0;
    }
    const p=this.ui.sheet(homeEdit?'主页首发阵容':'一起出发吧',homeEdit?'选择主页展示与下次出战默认使用的五只伙伴，不会更改进行中的战斗。':modern?mode==='chapter'?'选择五只征召模板；空场开局，初始干粮可征召两只。':'选择首发伙伴；战斗中征召、合成并收集祝福。':'第一位先入场，后续每波可再加入一位。最多带五只。',()=>this.go('home'));
    const pages=Math.max(1,Math.ceil(all.length/6));this.page=Math.min(this.page,pages-1);
    all.slice(this.page*6,this.page*6+6).forEach((t,i)=>{
      const index=this.teamSelection.indexOf(t.id);
      this.ui.card(t.role,this.art?.ready?visualName(t):displayName(t),`${ROLES[t.role].job} · ${t.skills.length} 技能${loanLabel(s,t.id)?" · "+loanLabel(s,t.id):""}`,index>=0?(modern?`位置 ${index+1}`:`第 ${index+1} 位出场`):'点击加入',-384+(i%3)*384,104-Math.floor(i/3)*192,()=>{
        if(!this.menuAvailable()||!isValid(p,true))return;
        new PetDetails(this.ui,this.service!,k=>this.command(k),e=>this.error(e)).show(t,{confirmText:index>=0?'取消出战':'确定出战',disabled:index<0&&this.teamSelection.length>=5,confirm:()=>{const found=this.teamSelection.indexOf(t.id);if(found>=0)this.teamSelection.splice(found,1);else if(this.teamSelection.length<5)this.teamSelection.push(t.id);p.parent?.destroy();this.chooseTeam(levelId,true,mode,homeEdit);}});
      },{parent:p,turtle:t,selected:index>=0,disabled:false});
    });
    const lead=all.find(t=>t.id===this.teamSelection[0]),hasStone=all.some(t=>this.teamSelection.includes(t.id)&&t.role==='stone');
    const advice=lead&&(lead.role==='spike'||lead.role==='crystal')?`推荐：${ROLES[lead.role].name}先打输出，${hasStone?'石头龟随后帮忙抵挡。':'后续再补充抵挡和治疗伙伴。'}`:'先带现有伙伴出发，波次之间可以招募新龟补充队伍。';
    this.ui.text(this.teamSelection.length===5?'已选满五只；想换伙伴，请先取消一只。':modern?'选择同职业的不同个体也可以；每位伙伴只占一个位置。':advice,0,-202,28,UI_COLORS.sand,p,1100,36);
    this.ui.button('上一页',-478,-276,164,88,()=>{this.page=Math.max(0,this.page-1);p.parent?.destroy();this.chooseTeam(levelId,true,mode,homeEdit);},{parent:p,size:28,disabled:this.page===0});
    this.ui.button('下一页',-286,-276,164,88,()=>{this.page=Math.min(pages-1,this.page+1);p.parent?.destroy();this.chooseTeam(levelId,true,mode,homeEdit);},{parent:p,size:28,disabled:this.page===pages-1});
    this.ui.text(`第 ${this.page+1}/${pages} 页\n已选 ${this.teamSelection.length}/5 只`,-60,-276,28,UI_COLORS.sand,p,240,76,true);
    const free=levelId===0&&!s.tutorialStarted;
    this.ui.button(homeEdit?'保存首发阵容':mode==='endless'?'开始挑战':this.solo?'开始冒险':free?'首次出发':'出发 · 5 体力',360,-276,400,88,()=>{
      if(homeEdit){try{this.service!.setHomeTeam(this.command('homeTeam'),this.teamSelection);this.ui.feedback?.('equip');this.go('home');}catch(error){this.error(error);}return;}
      if(!this.menuAvailable()||!['levels','adventure','endless'].includes(this.screen)||!isValid(p,true)||!isValid(p.parent,true))return;
      const selected=[...this.teamSelection],command=this.command('adventure');
      const start=(replacePending=false)=>{if(modern)this.service!.beginPrototypeRun(command,levelId,selected,mode,replacePending);else this.service!.beginRun(command,levelId,selected,replacePending);this.openBattle();};
      try{start();}catch(error){this.error(error,()=>start(true));}
    },{parent:p,primary:true,disabled:homeEdit?this.teamSelection.length<Math.min(5,all.length):this.teamSelection.length===0,size:32});
  }
  private async openBattle(challengeMode?:'raid'|'arena'|'online'|'watch'|'world',restart=false):Promise<void>{
    let requestPage:number|undefined;
    try{
      if(this.disposed||this.appHidden||this.homeArrival||!this.interfaceReady||!this.service||!this.mainCamera||!this.pipelineMaterial||!this.audio)return;
      if(this.screen==='battle'&&(this.battleScreen||this.battleArrival)&&!restart){
        if(this.challengeMode===challengeMode){if(this.battleArrival)this.showBattleArrival();else{this.arrivalView?.hide();this.battleScreen?.show();}return;}
        this.battleScreen?.checkpoint();
      }
      const saved=this.service.snapshot;
      if(challengeMode==='raid'&&!saved.community?.raid)throw new Error('没有待继续的副本');
      if(challengeMode==='arena'&&!saved.community?.arena)throw new Error('没有待继续的竞技场');
      if(challengeMode==='online'&&!this.roomClient?.room?.raid)throw new Error('副本尚未开始，请先返回队伍房间');
      if(challengeMode==='world'&&!this.allMapsReview&&!this.roomClient?.world)throw new Error('请先连接世界首领');
      this.challengeMode=challengeMode;const levelId=challengeMode==='world'?56:challengeMode==='watch'?54:challengeMode==='online'?raidMapId(this.roomClient?.room?.tier??0):challengeMode==='raid'?(this.service.snapshot.community?.raid?.battle?.levelId??raidMapId(this.service.snapshot.community?.raid?.tier??0)):challengeMode==='arena'?(this.service.snapshot.community?.arena?.battle.levelId??54):this.service.snapshot.run?.levelId;if(levelId===undefined)throw new Error('没有进行中的冒险');
      this.battleScreen?.destroy();this.battleScreen=undefined;this.cancelBattleArrival();this.screen='battle';this.ui.battleStyle=true;this.syncHomePresentation();
      // Decode only this battle's scene before constructing meshes that use it.
      // Page tokens prevent a slow load from reopening a battle after Back/retry.
      this.showBattleArrival();requestPage=this.battleArrivalPage;
      recordNativeBattleStage('准备地图图片',levelId);
      try{if(this.art&&BATTLE_MAPS[levelId].sceneArt)await this.art.ensure([BATTLE_MAPS[levelId].sceneArt!]);}
      catch(error){if(this.disposed||requestPage!==this.battleArrivalPage)return;throw error;}
      if(this.disposed||this.screen!=='battle'||requestPage!==this.battleArrivalPage)return;
      this.art?.retainBattleScene(BATTLE_MAPS[levelId].sceneArt);
      recordNativeBattleStage('创建战场',levelId);
      const map=BATTLE_MAPS[levelId],points=(map.routes??[map.route]).flat().concat(map.slots);
      this.battleFov=Math.min(44,Math.max(28,Math.max(...points.map(p=>Math.abs(p.x)))*3.35,Math.max(...points.map(p=>Math.abs(p.z)))*6.3))*.84;
      if(this.art?.ready){if(levelId===0||BATTLE_MAPS[levelId].sceneArt){this.mainCamera.node.setPosition(0,20,12);this.mainCamera.node.lookAt(new Vec3(0,0,0));}else{this.mainCamera.node.setPosition(0,20,20);this.mainCamera.node.lookAt(new Vec3(0,0,0));}}else{this.mainCamera.node.setPosition(0,20,17);this.mainCamera.node.lookAt(new Vec3(0,0,1.25));}this.resizeViewport();
      const world=new BattleWorld(this.node,this.mainCamera,this.pipelineMaterial,this.art,levelId);world.setOceanTexture(this.art?.oceanTexture);world.setTerrainTexture?.(this.art?.battleTerrainTexture);world.setBattleArt?.(this.art);
      recordNativeBattleStage('载入伙伴与怪物模型',levelId);
      const islands:Record<number,string>={0:'tutorial-island',1:'tidal-island',2:'coral-bend',3:'dusk-bay',4:'boss-bay'};
      const snapshot=challengeMode===undefined?this.service.snapshot.run?.battle:undefined;const island=snapshot&&!snapshot.layoutVersion?islands[levelId]:undefined;
      const islandPath=island?`environment/${island}/${island}/${island}`:undefined;
      const startedAt=Date.now(),arrival={world,islandPending:!!islandPath,error:undefined as unknown,startedAt,deadline:new ResourceLoadDeadline(startedAt)};this.battleArrival=arrival;
      world.setVisible(false);world.setLevel(levelId);
      this.showBattleArrival();
      if(islandPath)resources.load(islandPath,Prefab,(error,prefab)=>{
        if(this.disposed||this.battleArrival!==arrival||!arrival.islandPending)return;
        arrival.islandPending=false;
        try{if(error||!prefab)throw error||new Error('海岛资源为空');world.setEnvironment(prefab);}catch(failure){arrival.error=failure;}
      });
    }catch(error){
      this.cancelBattleArrival();
      if(this.screen==='battle'){console.error('[BATTLE_ARRIVAL]',error);this.showBattleArrival(true);}
      else this.error(error);
    }
  }
  private cancelBattleArrival():void{
    this.battleArrivalPage++;
    const arrival=this.battleArrival;this.battleArrival=undefined;arrival?.world.destroy();
  }
  private showBattleArrival(failed=false):void{
    if(this.disposed||this.screen!=='battle')return;
    const page=++this.battleArrivalPage;
    const current=():boolean=>!this.disposed&&!this.appHidden&&!this.homeArrival&&this.screen==='battle'&&this.battleArrivalPage===page;
    this.ui.clear();
    this.arrivalView?.show(failed,()=>{if(current())this.openBattle(this.challengeMode,true);},()=>{if(current())this.go('home');});
  }
  private finishBattleArrival():void{
    const arrival=this.battleArrival;if(!arrival||this.disposed||this.appHidden||this.screen!=='battle')return;
    const ready=!arrival.islandPending&&arrival.world.modelsReady&&PearlBattleArt.ready;
    this.arrivalView?.setBattleProgress(arrival.world.loadedResourceCount);
    const expired=arrival.deadline.expired(Date.now(),arrival.world.loadedResourceCount+(arrival.islandPending?0:1),ready);
    const error=arrival.error||arrival.world.loadingError||(PearlBattleArt.error?new Error(PearlBattleArt.error):undefined)||(expired?new Error('战斗资源加载超时，请重试'):undefined);
    if(error){this.failBattleArrival(error);return;}
    if(arrival.islandPending||!arrival.world.modelsReady||!PearlBattleArt.ready)return;
    try{
      const alreadyPrepared=arrival.controllerReady;
      if(!arrival.controllerReady){
      // Controllers may request additional map-specific resources. Construct once, then wait without ticking.
      let controller:BattleScreen|ChallengeScreen|LiveRaidScreen|ArenaWatchScreen|WorldBossScreen|undefined;
      let initializationError:unknown,initializationFailed=false;
      const home=()=>{if(controller&&!this.disposed&&this.screen==='battle'&&this.battleScreen===controller)this.go('home');};
      const failure=(error:unknown)=>{if(!controller){initializationError=error;initializationFailed=true;return;}if(!this.disposed&&this.screen==='battle'&&this.battleScreen===controller){if(this.battleArrival===arrival)arrival.error=error;else this.error(error);}};
      controller=this.challengeMode==='world'?new WorldBossScreen(this.service!,this.roomClient!,this.ui,arrival.world,this.mainCamera!,this.audio!,k=>this.command(k),()=>{home();if(!this.allMapsReview)this.openWorldBoss();},failure,this.allMapsReview):this.challengeMode==='watch'?new ArenaWatchScreen(this.service!,this.watchOpponent,this.ui,arrival.world,()=>{home();this.communityEntry('arena');},this.audio!,this.mainCamera!):this.challengeMode==='online'?new LiveRaidScreen(this.service!,this.roomClient!,this.ui,arrival.world,this.mainCamera!,this.audio!,k=>this.command(k),home,failure):this.challengeMode?new ChallengeScreen(this.challengeMode,this.service!,this.ui,arrival.world,this.mainCamera!,this.audio!,kind=>this.command(kind),home,failure):
        new BattleScreen(this,this.service!,this.ui,arrival.world,this.mainCamera!,this.audio!,kind=>this.command(kind),home,failure);
      this.battleScreen=controller;
      if(initializationFailed)throw initializationError;
      arrival.controllerReady=true;
      }
      if(arrival.world.loadingError)throw arrival.world.loadingError;
      if(!arrival.world.modelsReady){this.showBattleArrival();return;}
      if(alreadyPrepared)this.battleScreen?.render();
      recordNativeBattleStage('显示战场');
      arrival.world.setVisible(true);
      this.diagnostics?.markReady();
      this.battleArrival=undefined;this.battleArrivalPage++;
      this.arrivalView?.hide();
      recordNativeBattleStage('战斗就绪');
      // Battle now owns its own references. Retire only our home instance; shared
      // turtle assets remain owned by BattleWorld and the resource cache.
      const oldHome=this.homeWorld;this.homeWorld=undefined;oldHome?.destroy();
    }catch(error){this.failBattleArrival(error);}
  }
  private failBattleArrival(error:unknown):void{
    recordNativeBattleStage('加载失败：'+(error instanceof Error?error.message:String(error)).slice(0,100));
    console.error('[BATTLE_ARRIVAL]',error);
    this.battleScreen?.destroy();this.battleScreen=undefined;this.cancelBattleArrival();this.showBattleArrival(true);
  }
  private collection():void{
    if(this.solo&&this.screen==='collection'){const inspect=(t:Turtle)=>new PetDetails(this.ui,this.service!,k=>this.command(k),e=>this.error(e)).show(t,{owned:true,learn:()=>{this.selectedId=t.id;if(this.solo)this.getPrototypeMenus().skillBooks(t.id);else this.skillBooksDialog();},manage:()=>this.getPrototypeMenus().manage(t.id,()=>this.go('collection')),rename:()=>this.getPrototypeMenus().rename(t.id,()=>this.go('collection'))});this.soloMenus().collection(inspect,()=>this.chooseTeam(0,false,'chapter',true));return;}
    if(this.art?.ready&&this.screen!=='history'){this.collectionV2();return;}
    const s=this.service!.snapshot,history=this.screen==='history',all=history?Object.values(s.history).map(h=>h.turtle):Object.values(s.collection),p=this.heading(history?'成长历史':'我的龟龟',history?'每一次成长，都留下一段故事':'技能、天赋与成长，共同组成独一无二的伙伴');
    if(s.rulesVersion==='0.6'&&!history)all.sort((a,b)=>turtleQuality(b).tier-turtleQuality(a).tier||turtleQuality(b).score-turtleQuality(a).score||a.id.localeCompare(b.id));
    if(!all.length){this.ui.text(history?'这里会记下确认收录前的伙伴。\n暂不收录时，原龟仍留在“我的龟龟”。':'伙伴们会在这里等你。\n先去海岛，开始第一次冒险吧。',0,-30,32,UI_COLORS.sand,p,1040,160,true);return;}
    const pages=Math.max(1,Math.ceil(all.length/6));this.page=Math.min(this.page,pages-1);
    all.slice(this.page*6,this.page*6+6).forEach((t,i)=>{
      const q=turtleQuality(t),modern=s.rulesVersion==='0.6';
      if(modern)this.ui.panel(-384+(i%3)*384,104-Math.floor(i/3)*192,368,184,p,q.color,255,22);
      this.ui.card(t.role,this.art?.ready?visualName(t):displayName(t),`${ROLES[t.role].job} · ${ROLES[t.role].gender==='male'?'男':'女'}`,modern?`${q.name}·${t.skills.length}技能`:`${t.skills.length}技能${t.locked?' · 锁定':''}`,-384+(i%3)*384,104-Math.floor(i/3)*192,()=>{
        this.selectedId=t.id;this.detailTab='traits';this.detailOrigin=history?'history':'collection';this.detailReturnPage=this.page;this.go('detail');
      },{parent:p,turtle:t});
    });
    this.ui.text(history?'点击伙伴，查看当时的天赋与技能。':s.rulesVersion==='0.6'?`收藏 ${all.length}/50 · 按品质排序 · 点击查看与培养`:'点击伙伴，查看技能或进行培养。',0,-202,28,UI_COLORS.sand,p,1100,36);
    this.ui.text(`第 ${this.page+1} / ${pages} 页`,0,-276,30,UI_COLORS.sand,p,248,44);
    this.ui.button('上一页',-272,-276,176,88,()=>{this.page=Math.max(0,this.page-1);this.render();},{parent:p,size:30,disabled:this.page===0});
    this.ui.button('下一页',272,-276,176,88,()=>{this.page=Math.min(pages-1,this.page+1);this.render();},{parent:p,size:30,disabled:this.page===pages-1});
    if(s.rulesVersion==='0.6'&&!history){
      this.ui.button('工坊',-484,-276,144,88,()=>this.go('workshop'),{parent:p,size:28});
      if(pendingTakeaways(s).length)this.ui.button('待带回',484,-276,144,88,()=>this.getPrototypeMenus().takeaways(),{parent:p,size:28});
    }
  }
  private collectionV2():void{
    const s=this.service!.snapshot,owned=Object.values(s.collection),all=orderedPets(s).filter(t=>(this.collectionRole==='all'||t.role===this.collectionRole)&&(!this.collectionLocked||t.locked));
    const p=this.ui.sceneSheet('我的龟龟',()=>this.go('home')),pages=Math.max(1,Math.ceil(all.length/6));this.page=Math.min(this.page,pages-1);
    this.ui.text(owned.length+' / '+s.capacity,-456,284,23,UI_COLORS.sand,p,180,35);
    this.ui.panel(-240,-4,729,478,p,'#FFF9EC',235,22);this.ui.panel(384,-4,407,478,p,'#FFF9EC',244,22);this.ui.decoration('decor-seascape',384,-34,384,264,p);
    (['all','spike','stone','crystal','leaf','bubble'] as const).forEach((role,i)=>this.ui.button(role==='all'?'全部':HERO_LOOK[role].job,-541+i*118,211,111,42,()=>{this.collectionRole=role;this.page=0;this.render();},{parent:p,selected:this.collectionRole===role,primary:this.collectionRole===role,size:20}));
    this.ui.button(this.collectionLocked?'已锁定':'所有伙伴',390,211,345,42,()=>{this.collectionLocked=!this.collectionLocked;this.page=0;this.render();},{parent:p,size:21});
    const shown=all.slice(this.page*6,this.page*6+6),selected=all.find(t=>t.id===this.selectedId)??shown[0];if(selected)this.selectedId=selected.id;
    const targets:PetDropTarget[]=[];
    shown.forEach((t,i)=>{const tap=()=>{this.selectedId=t.id;this.render();},n=this.ui.button('',-481+i%3*242,103-Math.floor(i/3)*205,220,196,tap,{parent:p,selected:t.id===selected?.id});targets.push({id:t.id,node:n});this.ui.pet(t,0,34,118,n);if((s.homeTeam??owned.slice(0,5).map(t=>t.id)).includes(t.id))this.ui.text('已出战',56,74,18,'#008F96',n,92,26);this.ui.text(visualName(t),0,-45,26,UI_COLORS.ink,n,200,35);this.ui.text('Lv.'+levelInfo(t).level+' · '+t.skills.length+' 技能'+(loanLabel(s,t.id)?' · '+loanLabel(s,t.id):t.locked?' · 锁定':''),0,-76,19,UI_COLORS.sand,n,209,26);petCardDrag(this.ui,n,t,targets,{hold:true,tap,drop:id=>this.act(()=>{this.service!.swapCollectionOrder(this.command('petOrder'),t.id,id);this.ui.feedback?.('equip');})});});
    this.ui.button('出战阵容 '+(s.homeTeam?.length??5)+'/5',-420,-292,290,45,()=>{this.screen='home';this.chooseTeam(0,false,'chapter',true);},{parent:p,primary:true,size:21});

    if(selected){const t=selected,q=turtleQuality(t),stats=petPanel(t);this.ui.text(visualName(t),388,153,30,UI_COLORS.ink,p,355,45);this.ui.text(HERO_LOOK[t.role].job+' · '+q.name+' · Lv.'+levelInfo(t).level,388,109,21,UI_COLORS.sand,p,355,32);this.ui.portrait(t.role,388,-14,262,p,true,t.skills.length>=10);this.ui.text('攻击 '+stats.attack+'  ·  生命 '+stats.health+'  ·  防御 '+stats.defense,388,-163,20,UI_COLORS.ink,p,375,36);this.ui.button('资料 · 培养与技能',388,-210,364,55,()=>{this.detailOrigin='collection';this.go('detail');},{parent:p,primary:true,size:24});}
    if(!shown.length)this.ui.text('没有符合条件的伙伴',-239,-3,27,UI_COLORS.sand,p,689,58);
    this.ui.button('‹',-121,-292,90,50,()=>{this.page--;this.render();},{parent:p,disabled:this.page===0,size:28});this.ui.text((this.page+1)+' / '+pages,4,-292,23,UI_COLORS.ink,p,166,38);this.ui.button('›',128,-292,90,50,()=>{this.page++;this.render();},{parent:p,disabled:this.page===pages-1,size:28});
    this.ui.button('合成工坊',430,-292,270,50,()=>this.go('workshop'),{parent:p,size:25});if(pendingTakeaways(s).length)this.ui.button('待带回 '+pendingTakeaways(s).length,430,-340,240,38,()=>this.getPrototypeMenus().takeaways(),{parent:p,size:23});
  }
  private detail():void{
    const s=this.service!.snapshot,t=accessiblePet(s,this.selectedId)||s.history[this.selectedId]?.turtle;if(!t){this.go('collection');return;}
    if(s.livingVersion){this.collectionV2();new PetDetails(this.ui,this.service!,k=>this.command(k),e=>this.error(e)).show(t,{owned:!!s.collection[t.id],back:()=>this.go('collection'),learn:()=>this.skillBooksDialog(),manage:()=>this.getPrototypeMenus().manage(t.id,()=>this.go('collection')),rename:()=>this.getPrototypeMenus().rename(t.id,()=>this.go('detail'))});return;}
    if(this.art?.ready&&this.detailTab==='skills'){
      const historic=!!s.history[t.id],rows=Math.ceil(t.skills.length/4),height=Math.max(430,rows*128+220),p=this.ui.dialog(visualName(t)+' · 技能',`${t.skills.length}项技能同时生效`,()=>this.go(this.detailOrigin,this.detailReturnPage),1060,height);
      this.ui.pet(t,-394,12,164,p);this.ui.text(turtleQuality(t).name,-394,-102,23,turtleQuality(t).color,p,200,32);
      t.skills.forEach((id,i)=>this.ui.skillTile(id,-160+i%4*188,height/2-176-Math.floor(i/4)*128,p,82,172));
      this.ui.button('天赋与培养',-204,-height/2+48,300,54,()=>{this.detailTab='traits';this.render();},{parent:p,size:25});
      if(!historic)this.ui.button('学习技能书',180,-height/2+48,300,54,()=>this.skillBooksDialog(),{parent:p,primary:true,size:25,disabled:!!s.run&&s.run.phase!=='result'});return;
    }
    const historic=!!s.history[t.id],p=this.ui.sheet(this.art?.ready?visualName(t):displayName(t),this.art?.ready?`${HERO_LOOK[t.role].job} · ${HERO_LOOK[t.role].gender} · ${t.skills.length}技能`:`${ROLES[t.role].job} · ${ROLES[t.role].gender==='male'?'男':'女'} · 第 ${t.generation} 代 · ${t.skills.length} 技能全部生效`,()=>this.go(this.detailOrigin,this.detailReturnPage));
    if(!historic)this.ui.button('改名',338,282,144,64,()=>this.getPrototypeMenus().rename(t.id,()=>this.render()),{parent:p,size:28,disabled:!!s.run&&s.run.phase!=='result'});
    this.ui.pet(t,-422,64,224,p);
    const modern=s.rulesVersion==='0.6',quality=turtleQuality(t);
    this.ui.text(historic?'历史档案':modern?`${quality.name} · ${quality.score.toFixed(1)}分`:t.locked?'已锁定':'自在成长',-422,-88,30,modern?quality.color:UI_COLORS.sand,p,288,40);
    if(!historic)this.ui.button(modern?'管理伙伴':t.locked?'解锁伙伴':'锁定伙伴',-422,-156,264,88,()=>modern?this.getPrototypeMenus().manage(t.id):this.act(()=>this.service!.setLocked(this.command('lock'),t.id,!t.locked)),{parent:p,size:30,icon:'collection-lock',iconSize:40,disabled:modern&&!!s.run&&s.run.phase!=='result'});
    if(!historic)this.ui.button('学习技能书',-422,-268,264,88,()=>this.skillBooksDialog(),{parent:p,size:30,disabled:!!s.run&&s.run.phase!=='result'});
    this.ui.button('天赋与培养',-40,150,384,88,()=>{this.detailTab='traits';this.render();},{parent:p,size:32,selected:this.detailTab==='traits'});
    this.ui.button(`技能 · ${t.skills.length} 项`,368,150,384,88,()=>{this.detailTab='skills';this.render();},{parent:p,size:32,selected:this.detailTab==='skills'});
    if(this.detailTab==='traits'){
      const traits:[TrainingMaterial,string][]=[['attack','攻击天赋'],['health','生命天赋'],['defense','防御天赋'],['growth','成长天赋']];
      const medicineIcons:Record<TrainingMaterial,IslandIconId>={attack:'attack-medicine',health:'health-medicine',defense:'defense-medicine',growth:'growth-medicine'};
      traits.forEach(([key,name],i)=>{
        const n=this.ui.panel(-40+(i%2)*408,12-Math.floor(i/2)*164,384,152,p,'#395750'),value=t.innate[key]+t.training[key];
        this.ui.icon(medicineIcons[key],-154,47,36,n);
        this.ui.text(name,-58,47,30,UI_COLORS.sand,n,148,40);
        this.ui.text(key==='growth'?(value/100).toFixed(2):String(value),113,47,30,UI_COLORS.cream,n,126,40);
        if(historic)this.ui.text(`原始 ${key==='growth'?(t.innate[key]/100).toFixed(2):t.innate[key]}\n培养 +${key==='growth'?(t.training[key]/100).toFixed(2):t.training[key]}`,0,-27,28,UI_COLORS.sand,n,344,76,true);
        else{
          const cost=goldAmount(s,key==='growth'?300:100);
          this.ui.button(`培养 ${cost} 金币\n${MATERIAL_NAMES[key]} ×1（现有${s.materials[key]}）`,0,-27,344,88,()=>this.act(()=>{this.service!.train(this.command('train'),t.id,key);this.ui.feedback?.('upgrade');}),{parent:n,size:28,disabled:s.gold<cost||s.materials[key]<1});
        }
      });
    }else{
      t.skills.forEach((id,i)=>this.ui.skillTile(id,-136+(i%4)*204,50-Math.floor(i/4)*128,p,80,178));
    }
    const note=historic?'这份档案记录当时的样子，无法继续培养。':this.detailTab==='traits'?`持有金币 ${displayGold(s.gold)}\n培养后的面板参与合成继承。`:'全部技能生效；点击技能查看具体效果。';
    this.ui.text(note,160,-280,28,UI_COLORS.sand,p,824,74,true);
  }
  private skillBooksDialog(page=0):void{
    if(this.service?.snapshot.rulesVersion==='0.6'){this.getPrototypeMenus().skillBooks(this.selectedId,page);return;}
    if(!this.menuAvailable()||this.screen!=='detail')return;
    const s=this.service!.snapshot,t=s.collection[this.selectedId];if(!t)return;
    const books=SKILLS.filter(skill=>(s.skillBooks?.[skill.id]??0)>0),allowed=skillsForRole(t.role);
    const p=this.ui.sheet('学习技能书','消耗一本书，随机覆盖一项现有技能；技能数量不变。',()=>p.parent?.destroy());
    if(!books.length){
      this.ui.text('还没有技能书',0,64,40,UI_COLORS.cream,p,1040,64);
      this.ui.text('获得的技能书会保存在这里。\n学习前可以放弃；确认学习后无法撤回。',0,-44,30,UI_COLORS.sand,p,1040,120,true);
      this.ui.button('知道了',0,-250,328,88,()=>p.parent?.destroy(),{parent:p,primary:true,size:32});return;
    }
    const pages=Math.ceil(books.length/6),current=Math.max(0,Math.min(page,pages-1));
    books.slice(current*6,current*6+6).forEach((skill,i)=>{
      const owned=t.skills.includes(skill.id),compatible=!skillBookIssue(t,skill.id),canLearn=compatible&&!owned&&(!s.run||s.run.phase==='result');
      const n=this.ui.button('',-384+(i%3)*384,104-Math.floor(i/3)*192,360,176,()=>this.confirmSkillBook(t.id,skill.id),{parent:p,disabled:!canLearn});
      n.name='技能书:'+skill.id;
      this.ui.bookIcon(skill.id,-128,27,76,n);this.ui.text(`${skill.name}技能书`,42,48,28,UI_COLORS.cream,n,250,44);
      this.ui.text(`持有 ${s.skillBooks![skill.id]} 本`,42,0,28,UI_COLORS.sand,n,250,40);
      this.ui.text(owned?'已经拥有':!compatible?skillBookIssue(t,skill.id)!:canLearn?'点击查看学习风险':'本局结束后可用',0,-48,28,canLearn?UI_COLORS.sand:UI_COLORS.muted,n,336,40);
    });
    this.ui.text('主动技能也可能被覆盖；学习不会重抽天赋或成长。',0,-202,28,UI_COLORS.sand,p,1100,36);
    this.ui.text(`第 ${current+1} / ${pages} 页`,0,-276,30,UI_COLORS.sand,p,248,44);
    this.ui.button('上一页',-272,-276,176,88,()=>{p.parent?.destroy();this.skillBooksDialog(current-1);},{parent:p,size:30,disabled:current===0});
    this.ui.button('下一页',272,-276,176,88,()=>{p.parent?.destroy();this.skillBooksDialog(current+1);},{parent:p,size:30,disabled:current===pages-1});
  }
  private confirmSkillBook(turtleId:string,skillId:SkillId):void{
    if(!this.menuAvailable()||this.screen!=='detail')return;
    const t=this.service!.snapshot.collection[turtleId];if(!t)return;
    const skill=SKILL_BY_ID[skillId],p=this.ui.sheet('确认学习技能书','请确认愿意承担随机替换的结果。',()=>p.parent?.destroy());
    this.ui.text(`${this.art?.ready?visualName(t):displayName(t)}学习「${skill.name}」`,0,126,34,UI_COLORS.cream,p,1080,88,true);
    this.ui.text(`消耗 1 本${skill.name}技能书。\n${skill.specialization?'保留职业主动，随机覆盖其他一项。':'随机覆盖一项，主动技能也可能被替换。'}\n技能数量保持 ${t.skills.length} 项；确认后无法撤回。`,0,8,30,UI_COLORS.sand,p,1080,160,true);
    if(this.service!.snapshot.run?.phase==='result')this.ui.text('上局已生成的伙伴不会继承这次学习；再收录时请重新比较。',0,-144,28,UI_COLORS.sand,p,1080,76,true);
    // One consent panel owns one idempotency key, including late repeated input.
    const command=this.command('skillBook');
    this.ui.button('再想一想',-264,-276,400,88,()=>p.parent?.destroy(),{parent:p,size:32});
    this.ui.button('确认学习',264,-276,400,88,()=>{
      if(!this.menuAvailable()||!isValid(p,true)||!isValid(p.parent,true))return;
      try{
        const receipt=this.service!.learnSkillBook(command,turtleId,skillId);this.audio?.effect('sfx_learn');this.render();
        if(this.service!.snapshot.rulesVersion==='0.6')return;
        const result=this.ui.sheet('学习完成','新的技能已经保存在这位伙伴身上。');
        this.ui.text(`${SKILL_BY_ID[receipt.replacedSkillId].name}\n↓\n${SKILL_BY_ID[receipt.bookSkillId].name}`,0,28,38,UI_COLORS.gold,result,1040,184,true);
        this.ui.button('查看伙伴',0,-250,400,88,()=>{result.parent?.destroy();this.detailTab='skills';this.render();},{parent:result,primary:true,size:32});
      }catch(error){this.error(error);}
    },{parent:p,primary:true,size:32});
  }
  private soloSettings(tab=0):void{
    const ui=this.ui;ui.clear();const p=ui.soloPage('设置',()=>this.go('home'),true),settings=this.service!.settingsSnapshot;
    ['声音','画面','操作'].forEach((name,i)=>ui.button(name,-417+i*260,230,243,45,()=>this.soloSettings(i),{parent:p,primary:tab===i,size:25}));
    ui.portrait('stone',415,-123,247,p,true);
    if(tab===0){
      (['music','effects'] as const).forEach((key,i)=>{const y=130-i*107;ui.text(key==='music'?'音乐':'音效',-464,y,26,UI_COLORS.ink,p,132,40);const hit=ui.group('声音滑块:'+key,-95,y,p,540,62),label=ui.text(Math.round(settings[key]*100)+'%',226,y,23,UI_COLORS.ink,p,91,34);let value=settings[key],track:Node|undefined;
        const draw=()=>{if(track){track.removeFromParent();track.destroy();}track=ui.group('滑块显示',0,0,hit);ui.progress(0,0,520,13,value,'#11B5BE',track);ui.panel(-260+520*value,0,24,24,track,'#FFFFFF',255,12);label.string=Math.round(value*100)+'%';};draw();
        const update=(event:EventTouch)=>{const point=event.getUILocation(),local=hit.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(point.x,point.y,0));value=Math.max(0,Math.min(1,(local.x+260)/520));draw();event.propagationStopped=true;};
        hit.on(Node.EventType.TOUCH_START,update);hit.on(Node.EventType.TOUCH_MOVE,update);hit.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{update(event);const next=this.service!.updateSettings(this.command('volume'),{[key]:Math.round(value*100)/100});this.audio?.apply(next);if(key==='effects')this.audio?.effect('sfx_collect',0);});
      });ui.line(-537,-40,247,-40,p);ui.text('当前音乐：海岛时光',-287,-83,23,UI_COLORS.sand,p,462,39);ui.button('试听',148,-83,153,44,()=>{this.audio?.unlock();void this.audio?.playMusic('bgm_home');},{parent:p,size:22});
      ui.text('单机存档',-451,-165,24,UI_COLORS.ink,p,177,37);ui.text('冒险进度自动保存在本机',-241,-208,21,UI_COLORS.sand,p,600,37);
    }else if(tab===1){ui.text('动态效果',-373,111,28,UI_COLORS.ink,p,307,43);ui.button(settings.reducedMotion?'减少动态：开':'减少动态：关',-57,36,438,64,()=>{this.service!.updateSettings(this.command('motion'),{reducedMotion:!settings.reducedMotion});this.soloSettings(tab);},{parent:p,primary:settings.reducedMotion,size:25});ui.text('减少非必要摆动与装饰动画，保留战斗提示。',-134,-61,23,UI_COLORS.sand,p,726,83,true);}
    else{[['拖动伙伴','长按龟龟后拖动；同阶合成，异阶换位'],['手动施法','点击技能切换施法者，再选择目标释放'],['页面翻动','在列表区域左右滑动或使用翻页按钮']].forEach(([title,body],i)=>{ui.text(title,-378,130-i*111,26,UI_COLORS.ink,p,321,40);ui.text(body,-143,83-i*111,21,UI_COLORS.sand,p,742,52,true);});}
    ui.button('完成 ›',431,-270,255,58,()=>this.go('home'),{parent:p,primary:true,size:28});

  }
  private settings():void{
    if(this.solo){this.soloSettings();return;}
    const s=this.service!.snapshot,p=this.heading('设置',this.solo?'声音、画面与操作':'声音、画面与账号服务');
    if(!this.solo)this.ui.button('账号与服务  ›',0,181,600,43,()=>this.tasks().account(),{parent:p,primary:true,size:25});
    if(this.solo)this.ui.button('操作说明',0,181,600,43,()=>this.loginInfo('操作说明','长按龟龟拖动换位；拖到同阶龟龟上合成。\n不同阶或满阶互换；点击技能切换施法者，再点击目标释放。\n左右滑动翻页；局外金币与局内干粮互不通用。'),{parent:p,size:25});
    (['music','effects'] as const).forEach((key,i)=>{
      const y=88-i*127;this.ui.text(key==='music'?'背景音乐':'游戏音效',-424,y,28,UI_COLORS.cream,p,224,50);
      this.ui.button('－',-244,y,88,88,()=>this.changeVolume(key,-.1),{parent:p,size:36});
      this.ui.progress(-20,y-16,260,20,s.settings[key],UI_COLORS.gold,p);
      this.ui.text(`${Math.round(s.settings[key]*100)}%`,-20,y+27,30,UI_COLORS.cream,p,180,44);
      this.ui.button('＋',208,y,88,88,()=>this.changeVolume(key,.1),{parent:p,size:36});
      this.ui.button(s.settings[key]===0?'恢复':'静音',428,y,216,88,()=>this.act(()=>{const settings=this.service!.updateSettings(this.command('volume'),{[key]:s.settings[key]===0?.65:0});this.audio?.apply(settings);}),{parent:p,size:30});
    });
    this.ui.button(s.settings.reducedMotion?'减少动态：开':'减少动态：关',0,-184,424,64,()=>this.act(()=>this.service!.updateSettings(this.command('motion'),{reducedMotion:!s.settings.reducedMotion})),{parent:p,size:25});
    if(this.nativeTrial)this.ui.button('加载诊断',410,-184,168,54,()=>{const d=this.ui.dialog('战斗加载记录','如再次退出，可将本页记录发给开发者',()=>d.parent?.destroy(),880,480);this.ui.text(nativeBattleTraceText(),0,-20,22,UI_COLORS.ink,d,800,310,true);},{parent:p,size:23});
    this.ui.text(this.solo?'单机进度自动保存在本机；清除应用数据会删除本地存档':this.accountClient?.session?'账号进度自动同步至当前配套服务；游客进度独立保留':'当前为本机游客；可在“账号与服务”中注册保存进度',0,-281,23,UI_COLORS.sand,p,1040,40);
  }
  private changeVolume(key:'music'|'effects',delta:number):void{this.act(()=>{const s=this.service!.settingsSnapshot,settings=this.service!.updateSettings(this.command('volume'),{[key]:Math.min(1,Math.max(0,Math.round((s[key]+delta)*100)/100))});this.audio?.apply(settings);if(key==='effects')this.audio?.effect('sfx_collect',0);});}
  private energyDialog():void{
    if(!this.menuAvailable())return;
    this.refreshResources();
    const s=this.service!.snapshot,p=this.ui.sheet('补充体力','每十分钟自然恢复一点，最多三十点。',()=>p.parent?.destroy());
    const remaining=Math.max(0,Math.min(3-s.dailyAds.counts.stamina,6-s.dailyAds.total));
    this.ui.text(`${s.stamina} / 30`,0,104,64,UI_COLORS.gold,p,500,96);
    this.ui.text('自愿完整观看后获得体力；也可等待自然恢复。',0,-4,27,UI_COLORS.sand,p,1040,78,true);
    this.ui.text(s.stamina===30?'体力已经满啦':`今天此项剩余 ${remaining} 次`,0,-86,30,UI_COLORS.cream,p,880,48);
    this.ui.button('稍后再来',-250,-250,344,88,()=>p.parent?.destroy(),{parent:p,size:32});
    this.ui.button('自愿看广告 · 体力＋5',238,-250,560,64,()=>{if(this.menuAvailable())this.tasks().ad('stamina',undefined,()=>this.go('home'));},{parent:p,primary:true,size:27,disabled:s.stamina===30||remaining===0});
  }
  private restartPendingBattle():void{
    const s=this.service!.snapshot,c=s.community,command=this.command('newBattle');
    if(c?.raid&&!c.raid.settled){this.service!.beginRaid(command,c.raid.tier,c.raid.members[0].roster.map(p=>p.id),true);this.openBattle('raid',true);}
    else if(c?.arena&&!c.arena.settled){if(c.arena.practice)this.service!.beginArenaPractice(command,c.arena.opponentId,true);else this.service!.beginArena(command,c.arena.opponentId,[...c.arenaAttack],true);this.openBattle('arena',true);}
    else if(s.run&&s.run.phase!=='result'){const r=s.run;if(r.rulesVersion==='0.6')this.service!.beginPrototypeRun(command,r.levelId,[...r.selectedSources],r.mode??'chapter',true);else this.service!.beginRun(command,r.levelId,[...r.selectedSources],true);this.openBattle(undefined,true);}
  }
  private error(error:unknown,startNewBattle?:()=>void):void{
    this.audio?.effect('sfx_ui_error');
    this.arrivalView?.hide();
    console.error('[GOWAYGUI]',error);if(this.disposed||!this.ui||this.errorPanel?.isValid)return;
    if(this.skeletalReview&&typeof location!=='undefined'){const p=this.ui.dialog('三维样板暂时无法继续','',()=>location.reload(),740,330);this.errorPanel=p;this.ui.text(error instanceof Error?error.message:String(error),0,20,25,UI_COLORS.ink,p,670,108,true);this.ui.button('重新载入',-170,-110,280,56,()=>location.reload(),{parent:p,size:25});this.ui.button('返回现有试玩',160,-110,290,56,()=>{location.href='http://127.0.0.1:7473/';},{parent:p,primary:true,size:25});return;}
    const close=()=>{const panel=this.errorPanel;this.errorPanel=undefined;panel?.parent?.destroy();};
    const s=this.service?.snapshot,mode=this.screen==='battle'&&(this.challengeMode==='online'||this.challengeMode==='world')?this.challengeMode:s?.community?.raid&&!s.community.raid.settled?'raid':s?.community?.arena&&!s.community.arena.settled?'arena':this.roomClient?.room?.raid&&!this.roomClient.room.raid.settled?'online':this.roomClient?.world?.fight?.phase==='combat'?'world':undefined;
    const pending=mode||s?.run&&s.run.phase!=='result';
    const message=error instanceof Error?error.message:String(error);
    const canStartNew=!!pending&&['请先结束副本或竞技场挑战','请先结束当前挑战','请先结束当前冒险','请先结束副本或竞技场战斗'].includes(message);
    const p=this.ui.dialog('暂时无法操作','',close,740,canStartNew?420:330);this.errorPanel=p;
    this.ui.text(message,0,canStartNew?72:20,25,UI_COLORS.ink,p,670,108,true);
    if(canStartNew)this.ui.text('直接进入将结束旧战斗，并按退出规则结算。',0,5,23,UI_COLORS.ink,p,670,44,true);
    this.ui.button('知道了',-170,canStartNew?-67:-110,280,canStartNew?60:56,close,{parent:p,size:25});
    this.ui.button(pending?'继续未完成的战斗':'返回海岛',160,canStartNew?-67:-110,290,canStartNew?60:56,()=>{close();if(pending)this.openBattle(mode,true);else this.go('home');},{parent:p,primary:!canStartNew,size:25});
    if(canStartNew)this.ui.button('直接进入新战斗',0,-149,620,64,()=>{
      if(this.disposed||this.appHidden||this.homeArrival||!this.interfaceReady||!isValid(p,true)||!isValid(p.parent,true))return;
      close();try{if(startNewBattle)startNewBattle();else this.restartPendingBattle();}catch(failure){this.error(failure);}
    },{parent:p,primary:true,size:27});
  }
  private onHide():void{if(this.disposed)return;this.appHidden=true;this.syncHomePresentation();this.audio?.pause();this.battleScreen?.hide();}
  private refreshResources():void{
    if(!this.service)return;
    try{this.service.refreshClock(this.command('clock'));const s=this.service.snapshot;if(isValid(this.goldLabel,true))this.goldLabel.string=displayGold(s.gold);if(isValid(this.staminaLabel,true))this.staminaLabel.string=`${s.stamina}/30`;}
    catch(error){this.error(error);}
  }
  private onShow():void{if(this.disposed)return;this.appHidden=false;this.syncHomePresentation();this.refreshResources();this.audio?.resume();this.battleScreen?.show();}
  onDestroy():void{if(typeof document!=='undefined'){document.removeEventListener('pointerdown',this.unlockAudio,true);document.removeEventListener('keydown',this.unlockAudio,true);}this.arrivalView?.destroy();this.skeletalReview?.destroy();if(this.disposed)return;this.disposed=true;this.homeArrival=undefined;this.homeWorld?.destroy();this.homeWorld=undefined;this.cancelBattleArrival();view.off('canvas-resize',this.resizeViewport,this);view.off('design-resolution-changed',this.resizeViewport,this);engineGame.off(Game.EVENT_HIDE,this.onHide,this);engineGame.off(Game.EVENT_SHOW,this.onShow,this);this.diagnostics?.destroy();this.battleScreen?.destroy();this.icons?.destroy();if(this.ui&&isValid(this.ui.root,true))this.ui.clear();this.portraits?.destroy();this.panels?.destroy();this.backdrop?.destroy();this.art?.destroy();if(isValid(this.uiCanvas,true))this.uiCanvas.destroy();if(isValid(this.uiCamera,true))this.uiCamera.destroy();this.audio?.destroy();this.session?.close();}
}

