import {Color, ImageAsset, isValid, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D} from 'cc';
import type {Role} from '../core/types';

export const TURTLE_PORTRAIT_ROLES = ['stone','spike','crystal','leaf','bubble'] as const;
type PortraitState = 'idle'|'loading'|'ready'|'failed'|'destroyed';
interface OwnedPortrait {image:ImageAsset;texture?:Texture2D;frame?:SpriteFrame}
interface Binding {node:Node;sprite:Sprite;role:Role;onDestroyed:()=>void}
const SIDE=384;

/** Shared original RGBA portraits; the caller owns each node's position and size. */
export class TurtlePortraits {
  private phase:PortraitState='idle';
  private generation=0;
  private failure:string|null=null;
  private readonly portraits=new Map<Role,OwnedPortrait>();
  private readonly bindings=new Map<Node,Binding>();

  get state():PortraitState{return this.phase;}
  get ready():boolean{return this.phase==='ready';}
  get loadedCount():number{return this.portraits.size;}
  get error():string|null{return this.failure;}

  /** Idempotent. A failed batch waits for explicit retry rather than retrying each frame. */
  preload():void{
    if(this.phase!=='idle')return;
    this.phase='loading';this.failure=null;
    const generation=++this.generation;
    for(const role of TURTLE_PORTRAIT_ROLES){
      if(this.phase!=='loading'||this.generation!==generation)break;
      let settled=false;
      try{
        resources.load(`ui/portraits/portrait-${role}`,ImageAsset,(error,image)=>{
          if(settled)return;settled=true;
          // A late cached ImageAsset is not our reference until addRef below.
          if(this.phase!=='loading'||this.generation!==generation)return;
          if(error||!image){this.fail(error||new Error(`${role} 头像没有返回图片`));return;}
          try{
            if(image.width!==SIDE||image.height!==SIDE)throw new Error(`${role} 头像尺寸 ${image.width}×${image.height}，需要 ${SIDE}×${SIDE}`);
            image.addRef();
            const owned:OwnedPortrait={image};this.portraits.set(role,owned);
            const texture=new Texture2D();owned.texture=texture;
            texture.name=`龟龟头像:${role}`;texture.image=image;
            texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
            texture.setMipFilter(Texture2D.Filter.NONE);
            texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
            const frame=new SpriteFrame();owned.frame=frame;
            frame.name=`龟龟头像:${role}`;frame.packable=false;frame.texture=texture;
            frame.rect=new Rect(0,0,SIDE,SIDE);frame.originalSize=new Size(SIDE,SIDE);frame.rotated=false;
            if(this.portraits.size===TURTLE_PORTRAIT_ROLES.length){
              this.phase='ready';
              for(const binding of this.bindings.values())this.apply(binding);
              console.info('[GOWAYGUI_TURTLE_PORTRAITS]',JSON.stringify({state:'ready',images:this.portraits.size,width:SIDE,height:SIDE}));
            }
          }catch(reason){this.fail(reason);}
        });
      }catch(error){if(this.phase==='loading'&&this.generation===generation)this.fail(error);}
    }
  }

  /** Restarts a failed five-image batch; callbacks from the old generation are inert. */
  retry():void{
    if(this.phase!=='failed')return;
    this.phase='idle';this.preload();
  }

  /** Dedicated square UI node required; preserve its existing x/y/size and interaction. */
  attach(node:Node,role:Role):void{
    if(this.phase==='destroyed'||!isValid(node,true))return;
    if(!(TURTLE_PORTRAIT_ROLES as readonly string[]).includes(role))throw new Error(`未知头像类型：${role}`);
    const previous=this.bindings.get(node);
    if(previous?.role===role&&isValid(previous.sprite,true))return;
    if(previous)this.detach(node);
    const sprite=node.getComponent(Sprite)||node.addComponent(Sprite);
    sprite.enabled=false;sprite.spriteFrame=null;
    sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.type=Sprite.Type.SIMPLE;sprite.trim=false;sprite.color=Color.WHITE;
    // NODE_DESTROYED fires before the node's components are actually destroyed.
    const binding:Binding={node,sprite,role,onDestroyed:()=>{this.detach(node);}};
    this.bindings.set(node,binding);node.once(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    if(this.phase==='ready')this.apply(binding);else this.preload();
  }

  detach(node:Node):void{
    const binding=this.bindings.get(node);if(!binding)return;
    this.bindings.delete(node);
    if(isValid(node))node.off(Node.EventType.NODE_DESTROYED,binding.onDestroyed);
    // Clearing ownership is safe until actual destruction, including ToDestroy.
    // Strict checks are only for attaching/applying new content, not cleanup.
    if(isValid(binding.sprite)){
      binding.sprite.spriteFrame=null;binding.sprite.enabled=false;
    }
  }

  private apply(binding:Binding):void{
    if(!isValid(binding.node,true)||!isValid(binding.sprite,true)){this.detach(binding.node);return;}
    const frame=this.portraits.get(binding.role)?.frame;if(!frame)return;
    binding.sprite.spriteFrame=frame;binding.sprite.enabled=true;
  }

  private fail(error:unknown):void{
    if(this.phase==='destroyed'||this.phase==='failed')return;
    this.phase='failed';++this.generation;
    this.failure=error instanceof Error?error.message:String(error);
    for(const binding of this.bindings.values()){
      if(isValid(binding.sprite)){
        binding.sprite.spriteFrame=null;binding.sprite.enabled=false;
      }
    }
    this.releaseAssets();
    console.error('[GOWAYGUI_TURTLE_PORTRAITS]',JSON.stringify({state:'failed',message:this.failure,retryAvailable:true}));
  }

  private releaseAssets():void{
    for(const owned of this.portraits.values()){
      owned.frame?.destroy();owned.texture?.destroy();owned.image.decRef();
    }
    this.portraits.clear();
  }

  destroy():void{
    if(this.phase==='destroyed')return;
    this.phase='destroyed';++this.generation;
    for(const node of Array.from(this.bindings.keys()))this.detach(node);
    this.releaseAssets();
  }
}
