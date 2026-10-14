import {assetManager,ImageAsset,Texture2D,SpriteFrame,Rect,Size,Sprite,Node,UITransform,resources,Color} from 'cc';
import type {BuffId} from '../core/expeditionRules';

export type PearlAsset='dock'|'plaque'|'recruit'|'start'|'secondary'|'card'|'station'|'rations';
const RECTS:Record<PearlAsset,number[]>={dock:[16,40,1508,198],plaque:[28,302,350,120],recruit:[400,302,356,120],start:[780,302,354,120],secondary:[1160,302,350,120],card:[16,450,500,535],station:[550,520,440,441],rations:[1083,493,435,489]};
const BUFF_ORDER:BuffId[]=['attack','defense','health','range','haste','drain','speed','regen','crit','guard','desperate','phoenix','waveGrowth','killAttack','killDefense','killHealth','treasury','tauntGuard','cleanseSurge','tidePierce','crystalBurst','healingTide'];
/** Standalone atlas source is also copied by the script builder; never edits shared Cocos bundles. */
export class PearlBattleArt {
 static ready=false;static error='';private static promise?:Promise<void>;private static frames=new Map<string,SpriteFrame>();
 static preload():Promise<void>{
  if(this.promise)return this.promise;
  const load=(name:string)=>new Promise<Texture2D>((resolve,reject)=>{
   const done=(error:Error|null,image:ImageAsset)=>{if(error||!image){reject(error??Error('珍珠界面素材缺失'));return;}const t=new Texture2D();t.image=image;t.addRef();t.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);t.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);resolve(t);};
   if(typeof location!=='undefined'&&/^https?:/.test(location.protocol)&&!location.pathname.includes('/preview/'))assetManager.loadRemote<ImageAsset>(new URL('presentation/battle-pearl/'+name+'.png',location.href).href,{ext:'.png'},done);
   else resources.load('battle-pearl/'+name,ImageAsset,done);
  });
  this.promise=Promise.all([load('ui'),load('blessings')]).then(([ui,blessings])=>{
   const slice=(key:string,t:Texture2D,r:number[])=>{const f=new SpriteFrame();f.texture=t;f.rect=new Rect(...r as [number,number,number,number]);f.originalSize=new Size(r[2],r[3]);f.packable=false;f.addRef();this.frames.set(key,f);};
   for(const [key,rect]of Object.entries(RECTS))slice(key,ui,rect);
   BUFF_ORDER.forEach((id,i)=>{const row=Math.floor(i/6),col=i%6,x=row===3?[255,479,703,923][col]:[49,270,486,704,923,1143][col],y=[147,390,633,879][row];slice('buff-'+id,blessings,[x,y,183,174]);});
   for(const key of ['plaque','recruit','start','secondary']){const f=this.frames.get(key)!;f.insetLeft=key==='plaque'?94:46;f.insetRight=46;f.insetTop=36;f.insetBottom=36;}
   this.ready=true;
  }).catch(error=>{this.error=String(error);console.error('PearlBattleArt',error);});return this.promise;
 }
 static frame(key:PearlAsset|`buff-${BuffId}`):SpriteFrame|undefined{return this.frames.get(key);}
 static attach(parent:Node,key:PearlAsset|`buff-${BuffId}`,width:number,height:number):Node|undefined {
  const frame=this.frame(key);if(!frame)return;const n=new Node('珍珠浅金:'+key);n.layer=parent.layer;n.setParent(parent);n.addComponent(UITransform).setContentSize(width,height);const s=n.addComponent(Sprite);s.spriteFrame=frame;s.sizeMode=Sprite.SizeMode.CUSTOM;
  const sliced=['plaque','recruit','start','secondary'].includes(key);if(sliced){s.type=Sprite.Type.SLICED;n.setScale(.5,.5,1);}
  s.trim=false;n.getComponent(UITransform)!.setContentSize(width*(sliced?2:1),height*(sliced?2:1));
  s.color=Color.WHITE;return n;
 }
}
