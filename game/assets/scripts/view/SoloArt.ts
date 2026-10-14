import {assetManager,ImageAsset,Texture2D,SpriteFrame,Rect,Size,Sprite,Node,UITransform,isValid} from 'cc';

/** Only illustration regions of approved boards are used; labels and controls are live UI. */
export class SoloArt {
 private static frames=new Map<string,SpriteFrame>();private static loading=new Map<string,Promise<void>>();
 private static load(sheet:'endless'|'gold'|'chapter'):Promise<void>{
  if(this.loading.has(sheet))return this.loading.get(sheet)!;
  const task=new Promise<void>((resolve,reject)=>{
   assetManager.loadRemote<ImageAsset>(new URL('presentation/solo-ui/'+sheet+'.png',location.href).href,{ext:'.png'},(err,image)=>{
    if(err||!image){reject(err);return;}const t=new Texture2D();t.image=image;t.addRef();t.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
    // Normalized to the approved 1844 × 853 design board.
    const regions=sheet==='chapter'?[[0,0,1844,853]]:sheet==='endless'?[[172,133,455,200],[697,130,448,200],[1217,133,446,200]]:[[290,299,310,235],[763,283,330,255],[1186,277,408,267]];
    regions.forEach((r,i)=>{const x=image.width/1844,y=image.height/853,f=new SpriteFrame();f.texture=t;f.rect=new Rect(Math.round(r[0]*x),Math.round(r[1]*y),Math.round(r[2]*x),Math.round(r[3]*y));f.originalSize=new Size(f.rect.width,f.rect.height);f.packable=false;f.addRef();this.frames.set(sheet+i,f);});resolve();
   });
  }).catch(e=>{console.warn('Solo illustration unavailable',sheet,String(e));});this.loading.set(sheet,task);return task;
 }
 static attach(parent:Node,sheet:'endless'|'gold'|'chapter',index:number,width:number,height:number):void{
  const draw=()=>{if(!isValid(parent,true))return;const f=this.frames.get(sheet+index);if(!f)return;const n=new Node('已确认插画:'+sheet+index);n.layer=parent.layer;n.setParent(parent);n.addComponent(UITransform).setContentSize(width,height);const sprite=n.addComponent(Sprite);sprite.spriteFrame=f;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.trim=false;n.getComponent(UITransform)!.setContentSize(width,height);};
  if(this.frames.has(sheet+index))draw();else void this.load(sheet).then(draw);
 }
}
