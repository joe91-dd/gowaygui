import {BlockInputEvents,EffectAsset,Graphics,ImageAsset,isValid,Material,Node,resources,Sprite,SpriteFrame,Texture2D,UITransform,Vec4,screen,view} from 'cc';
import {IslandUI,color} from './IslandUI';
import {sceneryCoverScale} from './DisplayLayout';

export class IslandArrival {
  private readonly root:Node;
  private readonly ui:IslandUI;
  private readonly scenery:Node;
  private readonly logo:Node;
  private readonly actions:Node;
  private readonly status;
  private readonly progress:Graphics;
  private readonly images:{image:ImageAsset;texture:Texture2D;frame?:SpriteFrame}[]=[];
  private readonly pending=new Set<string>();
  private readonly loaded=new Set<string>();
  private effect?:EffectAsset;
  private material?:Material;
  private sceneSprite?:Sprite;
  private sceneTexture?:Texture2D;
  private mistTexture?:Texture2D;
  private time=0;
  private failed=false;
  private disposed=false;
  private readonly solo:boolean;

  constructor(ui:IslandUI){
    this.solo=ui.soloStyle;
    this.root=ui.group('统一海岛过渡',0,0,ui.root.parent!,1280,720);
    this.root.addComponent(BlockInputEvents);
    this.ui=new IslandUI(this.root,ui.click);
    this.ui.soloStyle=this.solo;
    const base=this.root.addComponent(Graphics);base.fillColor=color('#173D50');base.rect(-640,-360,1280,720);base.fill();
    this.scenery=this.ui.group('伙伴启航原画',0,0,this.root,1280,720);
    if(this.solo)this.ui.panel(0,0,740,239,this.root,'#FFF9EC',250,24);
    this.logo=this.ui.group('登录页原画字标',-355,232,this.root,440,176);
    this.progress=this.ui.group('启航进度',0,-285).addComponent(Graphics);
    this.status=this.ui.text('正在驶向海岛…',0,-309,23,'#FFF0B7',this.root,390,34);
    if(this.solo){this.logo.active=false;this.status.node.setPosition(95,20);this.status.color=color('#15475A');this.progress.node.setPosition(70,-29);const thumbnail=this.ui.group('海岛预览',-253,22,this.root,168,116);this.loadImage('art-modern/home-environment-full',thumbnail,168,116);this.ui.text('准备冒险',94,73,28,'#123B51',this.root,370,43);}
    this.actions=this.ui.group('过渡操作',0,-316);
    const departure=this.ui.panel(-355,128,302,42,this.root,'#173D50',175,18);
    departure.active=!this.solo;
    this.ui.text('向着海岛，出发',0,0,27,'#FFF0BC',departure,294,40);
    this.ui.text(this.solo?'长按伙伴可拖动；同阶合成，不同阶换位':'伙伴正在准备迎接新的冒险',0,this.solo?-82:-343,16,this.solo?'#60838D':'#FFF1C3',this.root,640,26);
    this.loadArtwork();this.update(0,true);
    view.on('canvas-resize',this.resize,this);view.on('design-resolution-changed',this.resize,this);this.resize();
  }

  private readonly resize=():void=>{
    const size=screen.windowSize,sx=view.getScaleX(),sy=view.getScaleY();if(sx<=0||sy<=0)return;
    const width=size.width/sx,height=size.height/sy,scale=sceneryCoverScale(width,height);
    this.root.getComponent(UITransform)!.setContentSize(width,height);
    const base=this.root.getComponent(Graphics)!;base.clear();base.fillColor=color('#173D50');base.rect(-width/2,-height/2,width,height);base.fill();
    this.scenery.setScale(scale,scale,1);
  };

  private loadArtwork():void{
    this.loadImage(this.solo?'art-modern/home-environment-full':'art-modern/sailing-honor',this.scenery,1280,720);
    this.loadImage('art-v2/game-logo',this.logo,440,176);
    this.loadImage('art-modern/sailing-mist');
    const path='art-modern/sailing-arrival';
    const key=path+':effect';
    if(this.loaded.has(key)||this.pending.has(key))return;
    this.pending.add(key);
    resources.load(path,EffectAsset,(error,effect)=>{
      this.pending.delete(key);
      if(this.disposed||error||!effect)return;
      effect.addRef();this.effect=effect;this.loaded.add(key);this.prepareMaterial();
    });
  }

  private loadImage(path:string,node?:Node,width=0,height=0):void{
    if(this.loaded.has(path)||this.pending.has(path))return;
    this.pending.add(path);
    resources.load(path,ImageAsset,(error,image)=>{
      this.pending.delete(path);
      if(this.disposed||(node&&!isValid(node,true))||error||!image)return;
      image.addRef();const texture=new Texture2D();texture.image=image;
      texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
      texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
      let frame:SpriteFrame|undefined;
      if(node){
        frame=new SpriteFrame();frame.texture=texture;frame.packable=false;
        const sprite=node.addComponent(Sprite);sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.trim=false;
        node.getComponent(UITransform)!.setContentSize(width,height);
        if(node===this.scenery){this.sceneSprite=sprite;this.sceneTexture=texture;}
      }else this.mistTexture=texture;
      this.images.push({image,texture,frame});this.loaded.add(path);this.prepareMaterial();
    });
  }

  private prepareMaterial():void{
    if(this.solo)return;
    if(this.material||!this.effect||!this.sceneSprite||!this.sceneTexture||!this.mistTexture)return;
    const material=new Material();material.initialize({effectAsset:this.effect});
    material.setProperty('sceneTexture',this.sceneTexture);material.setProperty('mistTexture',this.mistTexture);
    material.setProperty('arrivalMotion',new Vec4(this.time,0,0,0));
    this.sceneSprite.customMaterial=material;this.material=material;
  }

  show(failed=false,retry?:()=>void,back?:()=>void):void{
    if(this.disposed)return;
    this.root.active=true;this.root.setSiblingIndex(this.root.parent!.children.length-1);
    this.failed=failed;this.status.string=failed?'暂未抵达，再试一次':'正在驶向海岛…';
    for(const child of [...this.actions.children]){child.removeFromParent();child.destroy();}
    this.actions.setPosition(0,this.solo?(failed?-155:-169):(failed?-235:-316));
    if(failed){
      if(back)this.ui.button('返回海岛',retry?-105:0,0,188,48,back,{parent:this.actions,size:21});
      if(retry)this.ui.button('重新加载',back?105:0,0,188,48,retry,{parent:this.actions,primary:true,size:21});
    }else if(back)this.ui.button('返回海岛',535,0,156,40,back,{parent:this.actions,size:18});
    this.loadArtwork();this.update(0,true);
  }

  hide():void{if(!this.disposed)this.root.active=false;}

  setBattleProgress(completed:number):void{
    if(!this.disposed&&!this.failed&&this.root.active)this.status.string=`正在准备战斗 · 已完成 ${completed} 项`;
  }

  update(dt:number,reduced:boolean):void{
    if(this.disposed||!this.root.active)return;
    if(!reduced)this.time+=Math.min(.05,Math.max(0,dt));
    this.material?.setProperty('arrivalMotion',new Vec4(this.time,0,0,0));
    this.progress.clear();
    if(this.failed)return;
    const half=this.solo?190:285;
    this.progress.lineWidth=2;this.progress.strokeColor=color(this.solo?'#D4E7E5':'#E4C077');
    this.progress.fillColor=color(this.solo?'#D4E7E5':'#173D50',216);this.progress.roundRect(-half,-9,half*2,18,9);this.progress.fill();this.progress.stroke();
    // Indeterminate until the real loader completes; never reports a fabricated percentage.
    const phase=(1-Math.cos(this.time*Math.PI/3.8))/2;
    const segment=this.solo?108:190,travel=half*2-segment-10;
    this.progress.fillColor=color('#0FBDCB');this.progress.roundRect(-half+5+phase*travel,-5,segment,10,5);this.progress.fill();
    this.progress.fillColor=color('#FFF6CF',200);this.progress.circle(-half+5+segment/2+phase*travel,0,4);this.progress.fill();

  }

  destroy():void{
    if(this.disposed)return;this.disposed=true;view.off('canvas-resize',this.resize,this);view.off('design-resolution-changed',this.resize,this);this.root.destroy();
    this.material?.destroy();this.effect?.decRef();
    for(const owned of this.images){owned.frame?.destroy();owned.texture.destroy();owned.image.decRef();}
    this.images.length=0;
  }
}
