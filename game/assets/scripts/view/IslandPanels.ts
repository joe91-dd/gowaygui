import {Color, ImageAsset, isValid, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2} from 'cc';

export const ISLAND_PANEL_RADII = [10,14,18,21,22,24,16,19,20,21.5] as const;
type PanelState = 'idle'|'loading'|'ready'|'failed'|'destroyed';
type FramePart = 'fill'|'border'|'highlight';
interface LayerBinding {node:Node;sprite:Sprite}
interface PanelBinding {parent:Node;layers:LayerBinding[];onDestroyed:()=>void}

const ATLAS_PATH='ui/panels/panels-atlas';
const WIDTH=512,HEIGHT=1536,CELL=128,PADDING=8,STEP=144;
const PARTS:readonly FramePart[]=['fill','border','highlight'];

/** Owns one atlas and 30 sliced frames; individual panels borrow these immutable frames. */
export class IslandPanels {
  private phase:PanelState='idle';
  private image?:ImageAsset;
  private texture?:Texture2D;
  private readonly frames=new Map<string,SpriteFrame>();
  private readonly bindings=new Map<Node,PanelBinding>();
  private loading?:Promise<boolean>;
  private complete?: (ready:boolean)=>void;
  private attempt=0;
  get state():PanelState{return this.phase;}

  /** Shared startup gate. Destroying the owner settles an in-flight gate as false. */
  preload():Promise<boolean>{
    if(this.phase==='destroyed')return Promise.resolve(false);
    if(this.loading)return this.loading;
    this.phase='loading';
    this.loading=new Promise<boolean>(resolve=>{this.complete=resolve;});
    const attempt=++this.attempt;
    try{
      resources.load(ATLAS_PATH,ImageAsset,(error,image)=>{
        if(this.phase!=='loading'||attempt!==this.attempt)return;
        if(error||!image||!isValid(image)){this.fail(error||new Error('面板图集未返回有效 ImageAsset'));return;}
        try{
          if(image.width!==WIDTH||image.height!==HEIGHT)throw new Error(`面板图集尺寸 ${image.width}×${image.height}，需要 ${WIDTH}×${HEIGHT}`);
          image.addRef();this.image=image;
          const texture=new Texture2D();this.texture=texture;texture.name='海岛共用九宫格面板';
          texture.image=image;texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
          texture.setMipFilter(Texture2D.Filter.NONE);texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
          ISLAND_PANEL_RADII.forEach((radius,row)=>PARTS.forEach((part,column)=>{
            const key=`r${radius}-${part}`,frame=new SpriteFrame();this.frames.set(key,frame);
            frame.name='海岛面板:'+key;frame.packable=false;frame.texture=texture;
            frame.rect=new Rect(PADDING+STEP*column,PADDING+STEP*row,CELL,CELL);
            frame.originalSize=new Size(CELL,CELL);frame.offset=new Vec2(0,0);frame.rotated=false;
            // The source is 2x: radius + 2 logical transparent pixels on each side.
            const inset=2*(radius+2);
            frame.insetLeft=inset;frame.insetRight=inset;frame.insetTop=inset;frame.insetBottom=inset;
          }));
          this.phase='ready';this.settle(true);
          console.info('[GOWAYGUI_UI_PANELS]',JSON.stringify({state:'ready',path:ATLAS_PATH,frames:this.frames.size,width:WIDTH,height:HEIGHT}));
        }catch(reason){this.fail(reason);}
      });
    }catch(error){this.fail(error);}
    return this.loading;
  }

  /** A failed gate may explicitly retry; ordinary preload calls never start duplicate loads. */
  retry():Promise<boolean>{
    if(this.phase==='failed'){this.loading=undefined;this.phase='idle';}
    return this.preload();
  }

  /** Never round a dynamic radius or squeeze fixed corners to fit an undersized target. */
  supports(radius:number,width:number,height:number):boolean{
    return ISLAND_PANEL_RADII.some(value=>value===radius)&&Number.isFinite(width)&&Number.isFinite(height)&&width>=2*radius&&height>=2*radius;
  }

  /** The caller keeps its own layout/hit area; only decoration children are created. */
  attach(parent:Node,width:number,height:number,radius:number,fill:Color):boolean{
    if(!this.supports(radius,width,height)||!isValid(parent,true))return false;
    if(this.phase!=='ready')throw new Error(`海岛面板预载尚未完成（${this.phase}），请在 preload 成功后注入 IslandUI`);
    const previous=this.bindings.get(parent);if(previous)this.detach(previous,true);
    const binding:PanelBinding={parent,layers:[],onDestroyed:()=>this.detach(binding,false)};
    this.bindings.set(parent,binding);parent.once(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    const layers:[string,FramePart,Color,number,number][]=[
      ['shadow','fill',new Color(19,45,48,90),3,-5],
      ['fill','fill',new Color(fill.r,fill.g,fill.b,fill.a),0,0],
      ['border','border',new Color(180,135,77,255),0,0],
      ['highlight','highlight',new Color(255,242,207,65),0,0],
    ];
    try{
      layers.forEach(([name,part,tint,x,y],index)=>{
        const frame=this.frames.get(`r${radius}-${part}`);if(!frame)throw new Error('面板共享帧缺失');
        const node=new Node('面板装饰:'+name);node.layer=parent.layer;node.setParent(parent);node.setSiblingIndex(index);
        let sprite:Sprite;
        try{sprite=node.addComponent(Sprite);}catch(error){node.removeFromParent();node.destroy();throw error;}
        const layer:LayerBinding={node,sprite};binding.layers.push(layer);
        node.setPosition(x,y,0);node.setScale(.5,.5,1);
        const transform=node.getComponent(UITransform)||node.addComponent(UITransform);
        transform.setAnchorPoint(.5,.5);transform.setContentSize(2*(width+4),2*(height+4));
        layer.sprite.type=Sprite.Type.SLICED;layer.sprite.sizeMode=Sprite.SizeMode.CUSTOM;layer.sprite.trim=false;
        layer.sprite.spriteFrame=frame;layer.sprite.color=tint;
      });
    }catch(error){this.detach(binding,true);throw error;}
    return true;
  }

  private detach(binding:PanelBinding,removeNodes:boolean):void{
    if(this.bindings.get(binding.parent)!==binding)return;
    this.bindings.delete(binding.parent);
    if(isValid(binding.parent))binding.parent.off(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    for(const {node,sprite} of binding.layers){
      // Pending-destroy components still retain sliced-frame listeners until cleared.
      if(isValid(sprite)){sprite.spriteFrame=null;sprite.enabled=false;}
      if(removeNodes&&isValid(node)){node.removeFromParent();node.destroy();}
    }
  }

  private settle(ready:boolean):void{const complete=this.complete;this.complete=undefined;complete?.(ready);}
  private fail(error:unknown):void{
    if(this.phase==='destroyed')return;
    this.phase='failed';this.releaseAssets();this.settle(false);
    console.error('[GOWAYGUI_UI_PANELS]',JSON.stringify({state:'failed',path:ATLAS_PATH,message:error instanceof Error?error.message:String(error),gate:'面板预载未通过，不能把 Graphics 退化计作 Sprite 美术或性能通过'}));
  }
  private releaseAssets():void{
    for(const frame of this.frames.values())frame.destroy();this.frames.clear();
    this.texture?.destroy();this.texture=undefined;
    this.image?.decRef();this.image=undefined;
  }
  destroy():void{
    if(this.phase==='destroyed')return;
    this.phase='destroyed';this.attempt++;this.settle(false);
    for(const binding of Array.from(this.bindings.values()))this.detach(binding,true);
    this.releaseAssets();
  }
}
