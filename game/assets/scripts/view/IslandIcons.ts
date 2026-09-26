import {ImageAsset, isValid, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D} from 'cc';

export const ISLAND_ICON_IDS = ['gold','stamina','attack-medicine','health-medicine','defense-medicine','growth-medicine','collection-lock','growth-history'] as const;
export type IslandIconId = typeof ISLAND_ICON_IDS[number];
type IconState = 'idle'|'loading'|'ready'|'failed'|'destroyed';
interface Binding {node:Node;sprite:Sprite;id:IslandIconId;onDestroyed:()=>void}

const ATLAS_PATH='ui/island-icons';
const CELL=256,WIDTH=1024,HEIGHT=512;

/** One owned texture and eight shared frames, guarded by the formal UI startup gate. */
export class IslandIcons {
  private phase:IconState='idle';
  private generation=0;
  private failure:string|null=null;
  private image?:ImageAsset;
  private texture?:Texture2D;
  private readonly frames=new Map<IslandIconId,SpriteFrame>();
  private readonly bindings=new Map<Node,Binding>();
  get state():IconState{return this.phase;}
  get ready():boolean{return this.phase==='ready';}
  get error():string|null{return this.failure;}

  preload():void{
    if(this.phase!=='idle')return;this.phase='loading';this.failure=null;
    const generation=++this.generation;let settled=false;
    try{
      resources.load(ATLAS_PATH,ImageAsset,(error,image)=>{
        if(settled)return;settled=true;
        if(this.phase!=='loading'||this.generation!==generation)return;
        if(error||!image||!isValid(image)){this.fail(error||new Error('图集未返回有效 ImageAsset'));return;}
        try{
          if(image.width!==WIDTH||image.height!==HEIGHT)throw new Error(`图集尺寸 ${image.width}×${image.height}，需要 ${WIDTH}×${HEIGHT}`);
          image.addRef();this.image=image;
          const texture=new Texture2D();this.texture=texture;texture.name='海岛界面图标图集';
          texture.image=image;texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
          texture.setMipFilter(Texture2D.Filter.NONE);texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
          ISLAND_ICON_IDS.forEach((id,index)=>{
            const frame=new SpriteFrame();this.frames.set(id,frame);frame.name='海岛图标:'+id;frame.packable=false;
            frame.texture=texture;frame.rect=new Rect(index%4*CELL,Math.floor(index/4)*CELL,CELL,CELL);
            frame.originalSize=new Size(CELL,CELL);frame.rotated=false;
          });
          this.phase='ready';
          for(const binding of Array.from(this.bindings.values()))this.apply(binding);
          console.info('[GOWAYGUI_UI_ICONS]',JSON.stringify({state:'ready',path:ATLAS_PATH,width:WIDTH,height:HEIGHT,frames:this.frames.size}));
        }catch(reason){this.fail(reason);}
      });
    }catch(error){if(this.phase==='loading'&&this.generation===generation)this.fail(error);}
  }

  /** Only an explicit retry starts a new failed batch; ready assets stay shared. */
  retry():void{
    if(this.phase!=='failed')return;
    this.phase='idle';this.preload();
  }

  /** The caller supplies a dedicated UI node with its final content size. */
  attach(node:Node,id:IslandIconId):void{
    if(this.phase==='destroyed'||!isValid(node,true))return;
    const previous=this.bindings.get(node);if(previous?.id===id)return;if(previous)this.detach(previous);
    const sprite=node.getComponent(Sprite)||node.addComponent(Sprite);
    sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.type=Sprite.Type.SIMPLE;sprite.trim=false;sprite.enabled=false;
    // NODE_DESTROYED runs before Cocos destroys the node's live components.
    const binding:Binding={node,sprite,id,onDestroyed:()=>{this.detach(binding);}};
    this.bindings.set(node,binding);node.once(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    if(this.phase==='ready')this.apply(binding);else this.preload();
  }

  private apply(binding:Binding):void{
    if(!isValid(binding.node,true)||!isValid(binding.sprite,true)){this.detach(binding);return;}
    const frame=this.frames.get(binding.id);if(!frame)return;
    binding.sprite.spriteFrame=frame;binding.sprite.enabled=true;
  }

  private detach(binding:Binding):void{
    this.bindings.delete(binding.node);
    if(isValid(binding.node))binding.node.off(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    // ToDestroy components still own their frame; only new bindings use strict validity.
    if(isValid(binding.sprite)){binding.sprite.spriteFrame=null;binding.sprite.enabled=false;}
  }

  private fail(error:unknown):void{
    if(this.phase==='destroyed'||this.phase==='failed')return;this.phase='failed';++this.generation;
    this.failure=error instanceof Error?error.message:String(error);
    for(const binding of Array.from(this.bindings.values())){
      if(isValid(binding.sprite)){binding.sprite.spriteFrame=null;binding.sprite.enabled=false;}
    }
    this.releaseAssets();
    console.error('[GOWAYGUI_UI_ICONS]',JSON.stringify({state:'failed',path:ATLAS_PATH,message:this.failure,retryAvailable:true,gate:'图标未准备好，正式界面等待显式重试；不能计作美术验收通过'}));
  }

  private releaseAssets():void{
    for(const frame of Array.from(this.frames.values()))frame.destroy();this.frames.clear();
    this.texture?.destroy();this.texture=undefined;
    this.image?.decRef();this.image=undefined;
  }

  destroy():void{
    if(this.phase==='destroyed')return;this.phase='destroyed';++this.generation;
    for(const binding of Array.from(this.bindings.values()))this.detach(binding);
    this.releaseAssets();
  }
}
