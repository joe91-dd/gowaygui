import {THEME_ATLASES} from '../core/battleThemes';
import {ENEMY_G1,enemyG1,WORLD_G1_IDS} from '../core/enemyG1Catalog';
import {FAUNA_MODELS,bossModelIndex} from '../core/faunaCatalog';
import {BOSSES} from '../core/bossCatalog';
import {MAIN_POSES,SUPPORT_POSES,ENEMY_POSES} from './BattlePoseData';
import {Color,EffectAsset,Material,ImageAsset,isValid,Node,Rect,resources,Size,Sprite,SpriteFrame,Texture2D,UITransform} from 'cc';

export type ArtV2Image=`map-mode-scene-${number}`|'map-guardian-pearl'|`map-atlas-${string}`|`map-coast-stage-${number}`|'hud-symbols'|'honor-pet-terrace'|'honor-terrace'|'patrol-boat'|'patrol-rewards'|'patrol-ocean'|'patrol-entry'|'pet-detail-shell'|'pet-display-sanctuary'|`enemy-g1-${string}`|`advanced-portrait-${'stone'|'spike'|'crystal'|'leaf'|'bubble'}`|`home-advanced-${'stone'|'spike'|'crystal'|'leaf'|'bubble'}`|'ui-decoration'|'pearl-skins'|'chart-chests'|'chart-chapter'|'chart-raid'|'chart-endless'|'chart-arena'|'chart-world'|'chapter-map'|'chapter-boat'|'boss-finished-roster'|'world-finished-roster'|'market-pavilion'|"map-garden-fork"|"map-tidal-fork"|"map-switchback"|"map-world-arena"|"map-raid-courtyard"|"map-theme-coral"|"map-theme-moon"|'terrain-material-atlas'|'fauna-roster'|'world-boss-leviathan'|'world-boss-crab'|'world-boss-kraken'|'world-boss-tortoise'|'world-boss-shark'|'reward-chests'|"boss-green-roster"|"boss-blue-roster"|"boss-purple-roster"|"boss-yellow-roster"|"boss-red-roster"|"boss-gold-roster"|"skill-mastery-symbols"|"enemy-guard-props"|"companion-signatures"|"abyss-bosses"|"enemy-motion-poses"|"biome-landscapes"|"portraits-clean"|"terrain-biomes"|"island-props"|"approved-coast"|"skill-symbols-common"|"skill-symbols-special"|"combat-main-poses"|"combat-support-poses"|'battle-island-painted'|'battle-enemies-painted'|'battle-vfx-painted'|'battle-terrain-atlas'|'shop-packs-release'|'skill-icons-release'|'skill-books-common'|'skill-books-release'|'water-surface'|'game-logo'|'quality-frames'|'login-background'|'home-background'|'arena-background'|'fusion-background'|'fusion-bubble'|'ui-skins'|'hero-stone'|'hero-spike'|'hero-crystal'|'hero-leaf'|'hero-bubble'|'skill-icons'|'shop-icons'|'hero-lineup-keyed'|'functional-icons'|'home-stone-keyed'|'home-controls-keyed';
export type ArtV2Skin='gold'|'blue'|'navy'|'wood'|'paper'|'resource';
export type ArtV2Slice=`patrol-reward-${number}`|'pearl-panel'|'pearl-primary'|'pearl-selected'|'pearl-secondary'|'pearl-disabled'|'pearl-navy'|`chart-chest-${number}`|`chest-${number}`|`book-${string}`|ArtV2Skin|'quality-0'|'quality-1'|'quality-2'|'quality-3'|'quality-4'|'portrait-stone'|'portrait-spike'|'portrait-crystal'|'portrait-leaf'|'portrait-bubble'|`advanced-portrait-${'stone'|'spike'|'crystal'|'leaf'|'bubble'}`|'skill-stone'|'skill-spike'|'skill-crystal'|'skill-leaf'|'skill-bubble'|'shop-0'|'shop-1'|'shop-2'|'shop-3'|'shop-4'|'shop-5'|`modern-${number}`|`control-${number}`;
const IMAGES:ArtV2Image[]=['hud-symbols','honor-pet-terrace','honor-terrace','pet-detail-shell','pet-display-sanctuary','ui-decoration','pearl-skins','chart-chests','chart-chapter','chart-raid','chart-endless','chart-arena','chart-world','chapter-map','chapter-boat','boss-finished-roster','world-finished-roster','market-pavilion',"map-garden-fork","map-tidal-fork","map-switchback","map-world-arena","map-raid-courtyard","map-theme-coral","map-theme-moon",'map-coast-stage-1','map-coast-stage-2','map-coast-stage-3','map-coast-stage-4','map-coast-stage-5','map-coast-stage-6','map-coast-stage-7','map-coast-stage-8','map-coast-stage-9','map-coast-stage-10','map-coast-stage-11','map-coast-stage-12','map-coast-stage-13','map-coast-stage-14','map-coast-stage-15','terrain-material-atlas','fauna-roster','reward-chests',"skill-mastery-symbols","enemy-guard-props","companion-signatures","enemy-motion-poses","biome-landscapes","portraits-clean","terrain-biomes","island-props","approved-coast","skill-symbols-common","skill-symbols-special","combat-main-poses","combat-support-poses",'battle-island-painted','battle-enemies-painted','battle-vfx-painted','battle-terrain-atlas','shop-packs-release','skill-icons-release','skill-books-common','skill-books-release','game-logo','quality-frames','login-background','home-background','arena-background','fusion-background','fusion-bubble','ui-skins','hero-stone','hero-spike','hero-crystal','hero-leaf','hero-bubble','skill-icons','shop-icons','hero-lineup-keyed','functional-icons','home-stone-keyed','home-controls-keyed','water-surface'];
IMAGES.push('map-guardian-pearl');
for(const role of ['stone','spike','crystal','leaf','bubble'])IMAGES.push(('home-advanced-'+role) as ArtV2Image);
for(let i=16;i<=50;i++)IMAGES.push((`map-coast-stage-${i}`) as ArtV2Image);
for(let i=50;i<=56;i++)IMAGES.push((`map-mode-scene-${i}`) as ArtV2Image);
IMAGES.push(...THEME_ATLASES.map(x=>(`map-atlas-${x}` as ArtV2Image)));
IMAGES.push('patrol-ocean','patrol-entry','patrol-boat','patrol-rewards',...ENEMY_G1.map(x=>('enemy-g1-'+x.id.toLowerCase()) as ArtV2Image));
// Only shared slice atlases and the visible home are startup dependencies. Whole
// page illustrations, unused advanced portraits and boss galleries load on demand.
const STARTUP_IMAGES:ArtV2Image[]=[
  'ui-skins','skill-icons','shop-icons','quality-frames','hero-lineup-keyed','ui-decoration','pearl-skins','portraits-clean',
  'terrain-biomes','island-props','biome-landscapes','companion-signatures','enemy-guard-props','fauna-roster',
  'battle-enemies-painted','battle-vfx-painted','home-stone-keyed','hud-symbols','functional-icons','skill-books-release',
  'skill-books-common','home-controls-keyed','skill-icons-release','chart-chests','patrol-rewards','reward-chests',
  'shop-packs-release','combat-main-poses','combat-support-poses','enemy-motion-poses','skill-symbols-common',
  'skill-symbols-special','skill-mastery-symbols','water-surface','terrain-material-atlas','battle-terrain-atlas',
  'approved-coast','battle-island-painted','home-background','game-logo',
  ...IMAGES.filter(key=>key.startsWith('map-')&&!/^map-(coast-stage|mode-scene)-/.test(key)),
];
/** Decode artwork once; upload full-page textures only when a screen uses them. */
class Owned {
  private uploaded?:Texture2D;
  private wholeFrame?:SpriteFrame;
  constructor(readonly image:ImageAsset){image.addRef();}
  get texture():Texture2D{
    if(!this.uploaded){const texture=new Texture2D();texture.image=this.image;texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);texture.setMipFilter(Texture2D.Filter.NONE);texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);this.uploaded=texture;}
    return this.uploaded;
  }
  get frame():SpriteFrame{
    if(!this.wholeFrame){const frame=new SpriteFrame();frame.texture=this.texture;frame.packable=false;frame.rect=new Rect(0,0,this.image.width,this.image.height);frame.originalSize=new Size(this.image.width,this.image.height);this.wholeFrame=frame;}
    return this.wholeFrame;
  }
  destroy():void{this.wholeFrame?.destroy();this.uploaded?.destroy();this.wholeFrame=undefined;this.uploaded=undefined;this.image.decRef();}
}
/** New assets have their own lifetime and paths. The frozen gameplay artwork is untouched. */
export class ArtV2Assets {
  private images=new Map<ArtV2Image,Owned>();
  private ownedImages=new Map<ImageAsset,Owned>();
  private iconAliases=new Map<string,ArtV2Image>();
  private frames=new Map<ArtV2Slice,SpriteFrame>();
  private sliced=new Set<ArtV2Slice>();
  private bindings=new Set<Sprite>();
  private generation=0;
  private pendingImages=new Map<ArtV2Image,Promise<void>>();
  private cancelImageRequests=new Set<()=>void>();
  private imagePaths:Partial<Record<ArtV2Image,string>>={};
  private recentBattleScenes:string[]=[];
  battleEffect?:EffectAsset; terrainEffect?:EffectAsset;
  private companionEffect?:EffectAsset;private companionWorldEffect?:EffectAsset;
  companionMaterial(world=false):Material{const m=new Material();m.initialize({effectAsset:(world?this.companionWorldEffect:this.companionEffect)!,defines:world?{}:{USE_TEXTURE:true}});return m;}
  battleFrame(key:string):SpriteFrame|undefined{return this.frames.get(key as ArtV2Slice)??this.images.get(this.iconAliases.get(key)??key as ArtV2Image)?.frame;}
  private keyMaterial?:Material;
  motionMaterial():Material{const m=new Material();m.copy(this.keyMaterial!);return m;}
  private iconMaterial?:Material;
  state:'idle'|'loading'|'ready'|'failed'|'destroyed'='idle';
  error='';
  get ready():boolean{return this.state==='ready';}
  get oceanTexture():Texture2D|undefined{return this.ready?this.images.get('water-surface')?.texture:undefined;}
  get battleTerrainTexture():Texture2D|undefined{return this.ready?this.images.get('battle-terrain-atlas')?.texture:undefined;}
  preload():void{
    if(this.state!=='idle')return;this.state='loading';const generation=++this.generation;
    resources.load('art-modern/coastal-terrain',EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'地形材质未载入';this.state='failed';return;}
      effect.addRef();this.terrainEffect=effect;this.finishLoading();
    });
    resources.load('art-modern/battle-paint',EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'战斗绘制材质载入失败';this.state='failed';return;}
      effect.addRef();this.battleEffect=effect;this.finishLoading();
    });
    resources.load('art-modern/chroma-sprite',EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'角色材质未载入';this.state='failed';return;}
      this.keyMaterial=new Material();this.keyMaterial.initialize({effectAsset:effect,defines:{USE_TEXTURE:true}});
      this.iconMaterial=new Material();this.iconMaterial.initialize({effectAsset:effect,defines:{USE_TEXTURE:true,CREAM_KEY:true}});
      this.finishLoading();
    });
    const modern:Partial<Record<ArtV2Image,string>>={'hud-symbols':'hud-symbols','honor-pet-terrace':'honor-pet-terrace','honor-terrace':'honor-terrace','pet-detail-shell':'pet-detail-shell','pet-display-sanctuary':'pet-display-sanctuary','ui-decoration':'ui-decoration','pearl-skins':'pearl-skins','boss-finished-roster':'boss-finished-roster','world-finished-roster':'world-finished-roster','terrain-material-atlas':'terrain-material-atlas','fauna-roster':'fauna-roster','reward-chests':'reward-chests',"boss-green-roster":"boss-green-roster","boss-blue-roster":"boss-blue-roster","boss-purple-roster":"boss-purple-roster","boss-yellow-roster":"boss-yellow-roster","boss-red-roster":"boss-red-roster","boss-gold-roster":"boss-gold-roster","skill-mastery-symbols":"skill-mastery-symbols","enemy-guard-props":"enemy-guard-props","companion-signatures":"companion-signatures-refined","abyss-bosses":"abyss-bosses","enemy-motion-poses":"enemy-motion-poses","biome-landscapes":"biome-landscapes","portraits-clean":"portraits-clean-refined","terrain-biomes":"terrain-biomes","island-props":"island-props","approved-coast":"approved-coast","skill-symbols-common":"skill-symbols-common","skill-symbols-special":"skill-symbols-special","combat-main-poses":"combat-main-poses-refined","combat-support-poses":"combat-support-poses-refined",'battle-island-painted':'battle-island-painted','battle-enemies-painted':'battle-enemies-painted','battle-vfx-painted':'battle-vfx-painted','battle-terrain-atlas':'battle-terrain-atlas','shop-packs-release':'shop-packs-release','skill-icons-release':'skill-icons-release','skill-books-common':'skill-books-common','skill-books-release':'skill-books-release','water-surface':'water-surface','home-background':'home-environment-full','login-background':'home-environment-full','arena-background':'home-environment-full','fusion-background':'fusion-environment','hero-lineup-keyed':'hero-lineup-keyed','functional-icons':'functional-icons','home-stone-keyed':'home-stone-keyed','home-controls-keyed':'home-controls-keyed'};
    for(const role of ['stone','spike','crystal','leaf','bubble'])modern[('home-advanced-'+role) as ArtV2Image]='home-advanced-'+role;
    for(const key of IMAGES)if(key.startsWith('patrol-')||key.startsWith('chart-')||key.startsWith('chapter-')||key.startsWith('world-boss-')||key.startsWith('map-')||key==='market-pavilion')modern[key]=key;
    this.imagePaths=modern;
    void this.ensure(STARTUP_IMAGES).then(()=>this.finishLoading()).catch(reason=>{if(generation===this.generation&&this.state==='loading'){this.error=String(reason);this.state='failed';}});
    for(const [key,world] of [['companion-surface',false],['companion-world',true]] as const)resources.load('art-modern/'+key,EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'伙伴动态材质未载入';this.state='failed';return;}
      effect.addRef();if(world)this.companionWorldEffect=effect;else this.companionEffect=effect;this.finishLoading();
    });
  }
  /** Deduplicate requests across UI bindings and battle arrival, including aliases. */
  ensure(keys:readonly string[]):Promise<void>{
    if(this.state==='destroyed'||this.state==='idle')return Promise.reject(new Error('Artwork is not initialized'));
    return Promise.all(keys.map(key=>{
      if(this.frames.has(key as ArtV2Slice))return Promise.resolve();
      const imageKey=this.iconAliases.get(key)??key as ArtV2Image;
      if(this.images.has(imageKey))return Promise.resolve();
      if(!IMAGES.includes(imageKey))return Promise.reject(new Error('Unknown artwork: '+key));
      const current=this.pendingImages.get(imageKey);if(current)return current;
      const generation=this.generation;
      const request=new Promise<void>((resolve,reject)=>{
        const path=imageKey.startsWith('enemy-g1-')?`enemy-g1/icons/${imageKey.slice(9)}`:this.imagePaths[imageKey]?`art-modern/${this.imagePaths[imageKey]}`:`art-v2/${imageKey}`;
        let settled=false;
        const finish=(failure?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);this.cancelImageRequests.delete(cancel);if(failure)reject(failure);else resolve();};
        const cancel=()=>finish(new Error('Artwork request retired'));
        const timer=setTimeout(()=>finish(new Error('图片加载超时，请重试：'+imageKey)),90000);
        this.cancelImageRequests.add(cancel);
        try{
        resources.load(path,ImageAsset,(error,image)=>{
          if(settled)return;
          if(generation!==this.generation||this.state==='destroyed'){cancel();return;}
          if(error||!image||!isValid(image)){finish(error??new Error(imageKey+' unavailable'));return;}
          try{let owned=this.ownedImages.get(image);if(!owned){owned=new Owned(image);this.ownedImages.set(image,owned);}this.images.set(imageKey,owned);finish();}catch(reason){finish(reason);}
        });
        }catch(reason){finish(reason);}
      });
      this.pendingImages.set(imageKey,request);
      void request.then(()=>{if(this.pendingImages.get(imageKey)===request)this.pendingImages.delete(imageKey);},()=>{if(this.pendingImages.get(imageKey)===request)this.pendingImages.delete(imageKey);});
      return request;
    })).then(()=>undefined);
  }
  retry():void{if(this.state!=='failed')return;this.release();this.state='idle';this.preload();}
  /** Call after retiring the previous world; keep two maps, not a whole chapter in GPU memory. */
  retainBattleScene(key?:string):void{
    if(!key)return;this.recentBattleScenes=[key,...this.recentBattleScenes.filter(k=>k!==key)].slice(0,2);
    for(const [old,owned] of this.images){
      if(!/^map-(coast-stage|mode-scene)-/.test(old)||this.recentBattleScenes.includes(old))continue;
      if([...this.bindings].some(s=>isValid(s)&&s.node.name==='ArtV2:'+old))continue;
      this.images.delete(old);
      if(![...this.images.values()].includes(owned)){this.ownedImages.delete(owned.image);owned.destroy();}
    }
  }
  private finishLoading():void{if(STARTUP_IMAGES.every(key=>this.images.has(key))&&this.keyMaterial&&this.battleEffect&&this.terrainEffect&&this.companionEffect&&this.companionWorldEffect&&this.state==='loading'){this.makeSkins();this.state='ready';}}
  private makeSkins():void{
    const source=this.images.get('ui-skins')!;
    const specs:[ArtV2Skin,number,number,number,number,number,number][]=[['gold',24,158,448,206,64,56],['blue',521,158,480,205,68,54],['navy',1048,159,467,204,64,54],['wood',26,535,462,255,64,64],['paper',535,463,463,384,68,68],['resource',1050,464,464,380,64,64]];
    specs.forEach(([key,x,y,w,h,side,top])=>{
      const frame=new SpriteFrame();frame.texture=source.texture!;frame.packable=false;frame.rect=new Rect(x,y,w,h);frame.originalSize=new Size(w,h);
      frame.insetLeft=side;frame.insetRight=side;frame.insetTop=top;frame.insetBottom=top;this.frames.set(key,frame);this.sliced.add(key);
    });
    (['spike','stone','crystal','leaf','bubble'] as const).forEach((role,i)=>{const frame=new SpriteFrame();frame.texture=this.images.get('skill-icons')!.texture!;frame.packable=false;frame.rect=new Rect(47+i*420,149,400,400);frame.originalSize=new Size(400,400);this.frames.set(`skill-${role}`,frame);});
    for(let i=0;i<6;i++){const frame=new SpriteFrame();frame.texture=this.images.get('shop-icons')!.texture!;frame.packable=false;frame.rect=new Rect(16+i%3*512,16+Math.floor(i/3)*512,480,480);frame.originalSize=new Size(480,480);this.frames.set(`shop-${i}` as ArtV2Slice,frame);}
    for(let i=0;i<5;i++){const frame=new SpriteFrame();frame.texture=this.images.get('quality-frames')!.texture!;frame.packable=false;frame.rect=new Rect(28+i*386,170,384,384);frame.originalSize=new Size(384,384);this.frames.set(`quality-${i}` as ArtV2Slice,frame);}
    const atlas=this.images.get('hero-lineup-keyed')!.texture!;
    const crops:[string,number,number,number,number][]=[['stone',82,319,252,264],['spike',533,226,310,374],['crystal',935,217,305,384],['leaf',1334,228,318,375],['bubble',1740,210,345,394]];
    const frame=(texture:Texture2D,x:number,y:number,w:number,h:number)=>{const f=new SpriteFrame();f.texture=texture;f.packable=false;f.rect=new Rect(x,y,w,h);f.originalSize=new Size(w,h);return f;};
    const decor=this.images.get('ui-decoration')!.texture!;for(const [key,x,y,w,h]of [['decor-title',45,42,438,151],['decor-seascape',566,31,399,197],['decor-market',184,278,143,192],['decor-empty',663,278,211,215],['decor-rank-1',35,545,141,181],['decor-rank-2',187,545,145,181],['decor-rank-3',342,545,145,181],['decor-magic',602,527,325,219]] as const)this.frames.set(key as ArtV2Slice,frame(decor,x,y,w,h));
    const pearl=this.images.get('pearl-skins')!.texture!;
    const pearlRects:[ArtV2Slice,number,number,number,number][]=[['pearl-panel',52,182,442,226],['pearl-primary',544,182,449,226],['pearl-selected',1042,182,449,226],['pearl-secondary',52,600,443,212],['pearl-disabled',544,600,447,212],['pearl-navy',1039,600,451,213]];
    pearlRects.forEach(([key,x,y,w,h])=>{const f=frame(pearl,x,y,w,h);f.insetLeft=60;f.insetRight=60;f.insetTop=60;f.insetBottom=60;this.frames.set(key,f);if(key==='pearl-panel'||key==='pearl-selected')this.sliced.add(key);});
    for(const [role,x,y,w,h] of crops){
      this.frames.set(`hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));
      this.frames.set(`battle-hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));
      const side=w*.72;this.frames.set(`portrait-${role}` as ArtV2Slice,frame(atlas,Math.round(x+w*.18),Math.round(y+h*.10),Math.round(side),Math.round(side)));
    }
    const faces=this.images.get('portraits-clean')!,cw=faces.image.width/5;
    ['stone','spike','crystal','leaf','bubble'].forEach((role,i)=>{this.frames.get(`portrait-${role}` as ArtV2Slice)?.destroy();this.frames.set(`portrait-${role}` as ArtV2Slice,frame(faces.texture!,Math.round(i*cw+4),[170,225,155,175,160][i],Math.floor(cw-8),Math.floor(cw-8)));});
    for(const atlasName of ['terrain-biomes','island-props'] as const){const atlas=this.images.get(atlasName)!,cell=atlas.image.width/4;for(let i=0;i<16;i++)this.frames.set(`${atlasName}-${i}` as ArtV2Slice,frame(atlas.texture!,i%4*cell+2,Math.floor(i/4)*cell+2,cell-4,cell-4));}
    const landscapes=this.images.get('biome-landscapes')!,lw=Math.floor(landscapes.image.width/2),lh=Math.floor(landscapes.image.height/2);for(let i=0;i<4;i++)this.frames.set(('landscape-'+i) as ArtV2Slice,frame(landscapes.texture!,i%2*lw+2,Math.floor(i/2)*lh+2,lw-4,lh-4));
    const signatures=this.images.get('companion-signatures')!,sy=[0,253,516,790,1067],sh=[249,263,275,274,305];
    ['stone','spike','crystal','leaf','bubble'].forEach((role,row)=>{for(let col=0;col<4;col++)this.frames.set(('signature-'+role+'-'+col) as ArtV2Slice,frame(signatures.texture!,col*280.5,sy[row],280.5,sh[row]));});
    ['spike','crystal','leaf','bubble'].forEach((role,i)=>{const row=i+1;this.frames.set(('hero-'+role) as ArtV2Slice,frame(signatures.texture!,0,sy[row],280.5,sh[row]));this.frames.set(('battle-hero-'+role) as ArtV2Slice,frame(signatures.texture!,0,sy[row],280.5,sh[row]));});
    const props=this.images.get('enemy-guard-props')!;const propRects=[[25,45,405,544],[437,32,400,558],[840,82,410,527],[26,592,407,612],[443,665,414,515],[914,612,320,595]];propRects.forEach(([x,y,w,h],i)=>this.frames.set(('enemy-prop-'+i) as ArtV2Slice,frame(props.texture!,x,y,w,h)));
    FAUNA_MODELS.forEach((m,i)=>this.frames.set(m.key as ArtV2Slice,frame(this.images.get('fauna-roster')!.texture!,i%8*256,Math.floor(i/8)*256,256,256)));
    const iconAlias=(key:string,id:string)=>this.iconAliases.set(key,('enemy-g1-'+id.toLowerCase()) as ArtV2Image);
    ENEMY_G1.forEach(x=>iconAlias(x.key,x.id));
    BOSSES.forEach((boss,i)=>iconAlias('boss-'+i,boss.assetId??'B01'));
    ['world-boss-leviathan','world-boss-crab','world-boss-kraken','world-boss-tortoise'].forEach((key,i)=>iconAlias(key,WORLD_G1_IDS[i]));
    iconAlias('world-boss-shark','H01');
    const enemy=this.images.get('battle-enemies-painted')!;
    const enemyCrops=[[42,120,355,294],[470,95,361,320],[903,79,411,338],[1384,54,348,375],[40,503,353,334],[447,514,377,331],[826,457,522,389],[1370,488,391,354]];
    enemyCrops.forEach(([x,y,w,h],i)=>this.frames.set(('battle-enemy-'+i) as ArtV2Slice,frame(enemy.texture!,x,y,w,h)));
    const vfx=this.images.get('battle-vfx-painted')!;
    for(let i=0;i<6;i++){const w=vfx.image.width/3,h=vfx.image.height/2;this.frames.set(('battle-vfx-'+i) as ArtV2Slice,frame(vfx.texture!,i%3*w,Math.floor(i/3)*h,w,h));}
    const tank=this.images.get('home-stone-keyed')!;
    this.frames.set('hero-stone' as ArtV2Slice,frame(tank.texture!,0,0,tank.image.width,tank.image.height));

    for(let i=0;i<9;i++)this.frames.set(('hud-symbol-'+i) as ArtV2Slice,frame(this.images.get('hud-symbols')!.texture!,i*128,0,128,128));
    const icons=this.images.get('functional-icons')!,bound=[0,314,627,941,1254];
    for(let i=0;i<16;i++)this.frames.set(`modern-${i}`,frame(icons.texture!,bound[i%4]+12,bound[Math.floor(i/4)]+12,bound[i%4+1]-bound[i%4]-24,bound[Math.floor(i/4)+1]-bound[Math.floor(i/4)]-24));
    const books=this.images.get('skill-books-release')!;
    ['scatter','daze','arcane','holyLight','spirit','counterStorm','bubbleRing','crystalCannon','piercingShot','hold','greatHeal','combo','rebirth','sleep','extraTarget','taunt'].forEach((id,i)=>this.frames.set(`book-${id}`,frame(books.texture!,bound[i%4]+8,bound[Math.floor(i/4)]+8,bound[i%4+1]-bound[i%4]-16,bound[Math.floor(i/4)+1]-bound[Math.floor(i/4)]-16)));
    const common=this.images.get('skill-books-common')!;
    ['strong','armor','resist','swift'].forEach((id,i)=>this.frames.set(`book-${id}`,frame(common.texture!,[22,309,580,848][i],10,270,257)));
    // The atlas rows are intentionally cropped to the actual book silhouettes,
    // rather than an assumed grid that clips clasps and cover edges.
    const bookRows=[{x:[20,280,530,772,1008],w:[252,254,246,235,236],y:270,h:240},
      {x:[22,267,514,750,993],w:[238,242,237,238,246],y:510,h:235},
      {x:[22,267,514,750,993],w:[240,242,240,238,246],y:746,h:231},
      {x:[22,267,514,750,993],w:[240,242,240,238,246],y:980,h:245}];
    ['steady','regen','openingShield','lastShield','encourage','block','reflect','share','critical','lifesteal','bounce','spellDrain','shredResist','doubleHeal','healShield','cleanse','shredArmor','root','weaken','pursuit'].forEach((id,i)=>{const row=bookRows[Math.floor(i/5)],col=i%5;this.frames.set(`book-${id}`,frame(common.texture!,row.x[col],row.y,row.w[col],row.h));});
    const controls=this.images.get('home-controls-keyed')!;
    for(let i=0;i<8;i++){const w=controls.image.width/4,h=controls.image.height/2;this.frames.set(`control-${i}`,frame(controls.texture!,Math.round(i%4*w+30),Math.round(Math.floor(i/4)*h+30),Math.floor(w-60),Math.floor(h-60)));}
    const skills=[['stone',11],['spike',12],['crystal',13],['leaf',14],['bubble',15]] as const;
    for(const [role,index] of skills){this.frames.get(`skill-${role}`)?.destroy();this.frames.set(`skill-${role}`,this.frames.get(`modern-${index}`)!);}
    const release=this.images.get('skill-icons-release')!;
    this.frames.set('book-reach',frame(release.texture!,842,630,396,435));
    ['stone','spike','crystal','leaf','bubble'].forEach((role,i)=>this.frames.set(`skill-${role}` as ArtV2Slice,frame(release.texture!,i%3*412+103,Math.floor(i/3)*470+250,248,252)));
    const chartChests=this.images.get('chart-chests')!,cell=chartChests.image.width/3;for(let index=0;index<3;index++)this.frames.set(`chart-chest-${index}`,frame(chartChests.texture!,index*cell,0,cell,chartChests.image.height));
    const patrolRewards=this.images.get('patrol-rewards')!,patrolCell=patrolRewards.image.width/3;for(let index=0;index<3;index++)this.frames.set(`patrol-reward-${index}`,frame(patrolRewards.texture!,index*patrolCell,0,patrolCell,patrolRewards.image.height));
    const chests=this.images.get('reward-chests')!;for(let i=0;i<3;i++)this.frames.set(`chest-${i}`,frame(chests.texture!,i*724,0,724,724));
    const packs=this.images.get('shop-packs-release')!;
    for(let i=0;i<6;i++){this.frames.get(`shop-${i}` as ArtV2Slice)?.destroy();this.frames.set(`shop-${i}` as ArtV2Slice,frame(packs.texture!,i%3*418+6,Math.floor(i/3)*560+92,406,490));}
    for(const [atlas,rows] of [['main',MAIN_POSES],['support',SUPPORT_POSES],['enemy',ENEMY_POSES]] as const){const texture=this.images.get((atlas==='enemy'?'enemy-motion-poses':'combat-'+atlas+'-poses') as ArtV2Image)!.texture!;rows.forEach((row,r)=>row.forEach(([x,y,w,h],c)=>this.frames.set(('pose-'+atlas+'-'+r+'-'+c) as ArtV2Slice,frame(texture,x,y,w,h))));}
    const commonSymbols=this.images.get('skill-symbols-common')!.texture!;
    const commonIds=['pursuit','rebirth','sleep','extraTarget','strong','armor','resist','swift','reach','steady','regen','openingShield','lastShield','encourage','block','reflect','share','critical','lifesteal','bounce','spellDrain','shredResist','doubleHeal','healShield','cleanse','shredArmor','root','weaken','taunt','combo'];
    const commonXs=[30,229,431,633,836,1041],commonYs=[33,226,420,615,810,1008];
    commonIds.forEach((id,i)=>this.frames.set(('book-'+id) as ArtV2Slice,frame(commonSymbols,commonXs[i%6],commonYs[Math.floor(i/6)],185,184)));
    const specialSymbols=this.images.get('skill-symbols-special')!.texture!;
    const specialIds=['scatter','daze','arcane','holyLight','spirit','counterStorm','fervor','caprice','polymorph','giant','hold','piercingShot','crystalCannon','greatHeal','bubbleRing'];
    specialIds.forEach((id,i)=>this.frames.set(('book-'+id) as ArtV2Slice,frame(specialSymbols,26+i%4*305,27+Math.floor(i/4)*300,289,282)));
    const mastery=this.images.get('skill-mastery-symbols')!.texture!;
    ['hold','stoneMastery','spikeMastery','crystalMastery','leafMastery','spirit','calm'].forEach((id,i)=>this.frames.set(('book-'+id) as ArtV2Slice,frame(mastery,25+i%4*375,104+Math.floor(i/4)*382,362,362)));
    for(const [role,id] of [['stone','hold'],['spike','piercingShot'],['crystal','crystalCannon'],['leaf','greatHeal'],['bubble','bubbleRing']])this.frames.set(('skill-'+role) as ArtV2Slice,this.frames.get(('book-'+id) as ArtV2Slice)!);

  }

  attach(parent:Node,key:ArtV2Image|ArtV2Slice,w:number,h:number,tint=Color.WHITE):Sprite|undefined{
    if(!this.ready||!isValid(parent,true))return;
    const frame=this.battleFrame(key);
    const sliced=this.sliced.has(key as ArtV2Slice),n=new Node(`ArtV2:${key}`);n.layer=parent.layer;n.setParent(parent);n.addComponent(UITransform).setContentSize(w*(sliced?2:1),h*(sliced?2:1));if(sliced)n.setScale(.5,.5,1);
    const sprite=n.addComponent(Sprite);sprite.spriteFrame=frame??null;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.type=sliced?Sprite.Type.SLICED:Sprite.Type.SIMPLE;sprite.trim=false;sprite.color=tint;
    const hero=key.startsWith('hero-')||key.startsWith('portrait-');
    if(key.startsWith('hero-')||key.startsWith('pose-')||key.startsWith('signature-')||key.startsWith('enemy-prop-')||key.startsWith('island-props-')||key.startsWith('control-'))sprite.customMaterial=this.keyMaterial!;
    else if(key.startsWith('modern-'))sprite.customMaterial=this.iconMaterial!;
    // Assigning a frame in Sprite's default TRIMMED mode resets UITransform.
    // Set the final target dimensions after selecting CUSTOM mode.
    if(frame&&hero&&key.startsWith('hero-')){const ratio=frame.rect.width/frame.rect.height;if(w/h>ratio)w=h*ratio;else h=w/ratio;}
    n.getComponent(UITransform)!.setContentSize(w*(sliced?2:1),h*(sliced?2:1));
    if(!frame){const generation=this.generation;void this.ensure([key]).then(()=>{
      if(generation!==this.generation||!isValid(n,true)||!isValid(sprite))return;
      sprite.spriteFrame=this.battleFrame(key)??null;n.getComponent(UITransform)!.setContentSize(w,h);
    }).catch(error=>{if(generation===this.generation&&isValid(n,true))console.warn('[ART_ON_DEMAND]',key,error);});}
    this.bindings.add(sprite);n.once(Node.EventType.NODE_DESTROYED,()=>{if(isValid(sprite))sprite.spriteFrame=null;this.bindings.delete(sprite);});return sprite;
  }
  destroy():void{if(this.state==='destroyed')return;this.generation++;this.state='destroyed';this.release();}
  private release():void{
    for(const cancel of this.cancelImageRequests)cancel();this.cancelImageRequests.clear();
    this.pendingImages.clear();
    this.recentBattleScenes=[];
    for(const sprite of this.bindings)if(isValid(sprite)){sprite.spriteFrame=null;sprite.enabled=false;}this.bindings.clear();
    this.companionEffect?.decRef();this.companionWorldEffect?.decRef();this.companionEffect=undefined;this.companionWorldEffect=undefined;
    this.terrainEffect?.decRef();this.terrainEffect=undefined;this.battleEffect?.decRef();this.battleEffect=undefined;
    this.keyMaterial?.destroy();this.iconMaterial?.destroy();this.keyMaterial=undefined;this.iconMaterial=undefined;
    for(const frame of new Set(this.frames.values()))frame.destroy();this.frames.clear();this.sliced.clear();
    for(const owned of this.ownedImages.values())owned.destroy();this.ownedImages.clear();this.images.clear();this.iconAliases.clear();
  }
}



