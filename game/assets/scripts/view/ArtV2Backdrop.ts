import {Camera,Canvas,Color,isValid,Layers,Material,Node,UITransform,Vec4} from 'cc';
import {ArtV2Assets,ArtV2Image} from './ArtV2Assets';

/** A pre-rendered distant island plate behind the live 3D actors, never a flattened UI. */
export class ArtV2Backdrop {
  private root:Node;private camera:Node;private content:Node;private current?:ArtV2Image;
  private motion?:Material;private time=0;
  constructor(scene:Node,private readonly assets:ArtV2Assets){
    const layer=1<<19;this.root=new Node('V2海岛远景');this.root.layer=layer;this.root.setParent(scene);this.root.addComponent(UITransform).setContentSize(1280,720);
    this.camera=new Node('V2远景相机');this.camera.setParent(scene);this.camera.setPosition(0,0,1000);
    const camera=this.camera.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=360;camera.near=.1;camera.far=2000;camera.visibility=layer;camera.priority=-5;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color(36,117,156);
    const canvas=this.root.addComponent(Canvas);canvas.alignCanvasWithScreen=true;canvas.cameraComponent=camera;
    this.content=new Node('远景原画');this.content.layer=layer;this.content.setParent(this.root);this.content.addComponent(UITransform).setContentSize(1280,720);this.root.active=false;this.camera.active=false;
  }
  show(key:ArtV2Image|undefined):void{
    if(!isValid(this.root,true))return;this.root.active=!!key;this.camera.active=!!key;if(!key||key===this.current)return;
    for(const child of [...this.content.children]){child.removeFromParent();child.destroy();}
    const sprite=this.assets.attach(this.content,key,1280,720);this.motion=undefined;
    if(sprite&&['home-background','login-background','arena-background'].includes(key)){const m=this.assets.motionMaterial();sprite.customMaterial=m;this.motion=sprite.getMaterialInstance(0)!;sprite.node.once(Node.EventType.NODE_DESTROYED,()=>m.destroy());}
    this.current=key;
  }
  update(dt:number,reduced:boolean):void{if(!this.root.active||!this.motion)return;this.time+=Math.min(.05,Math.max(0,dt));this.motion.setProperty('portraitMotion',new Vec4(reduced?0:this.time,reduced?0:6,0,0));for(const pass of this.motion.passes)pass.update();}
  destroy():void{if(isValid(this.root,true))this.root.destroy();if(isValid(this.camera,true))this.camera.destroy();}
}
