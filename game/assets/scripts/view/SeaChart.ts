import {Component,EffectAsset,Graphics,Material,Node,resources,Sprite,Vec4,isValid} from 'cc';
import {IslandUI,color} from './IslandUI';
import type {ArtV2Image} from './ArtV2Assets';

type Drift={node:Node;x:number;y:number;kind:'ship'|'chest'|'boss';phase:number;glow?:Graphics};
export class SeaChartMotion extends Component {
  reduced:()=>boolean=()=>false;
  private elapsed=0;private step=0;private disposed=false;
  private drifts:Drift[]=[];private materials:Material[]=[];private effects:EffectAsset[]=[];
  drift(node:Node,kind:Drift['kind'],glow?:Graphics):void{this.drifts.push({node,x:node.position.x,y:node.position.y,kind,phase:this.drifts.length*1.7,glow});}
  surface(sprite:Sprite,kind=0):void{
    // Page artwork now loads on demand. The effect may arrive before its image.
    if(!sprite.spriteFrame){sprite.node.once(Sprite.EventType.SPRITE_FRAME_CHANGED,()=>{if(!this.disposed&&isValid(sprite.node,true))this.surface(sprite,kind);});return;}
    resources.load('art-modern/sea-chart',EffectAsset,(error,effect)=>{
      if(error||!effect||this.disposed||!isValid(this.node,true)||!isValid(sprite.node,true)||!sprite.spriteFrame)return;
      effect.addRef();this.effects.push(effect);const material=new Material();material.initialize({effectAsset:effect});
      material.setProperty('sceneTexture',sprite.spriteFrame!.texture);material.setProperty('chartMotion',new Vec4(0,kind,0,0));sprite.customMaterial=material;
      this.materials.push(material);const instance=sprite.getMaterialInstance(0);if(instance)this.surfaces.push({material:instance,kind});
    });
  }
  private surfaces:{material:Material;kind:number}[]=[];
  fullBoss(sprite:Sprite,key:ArtV2Image,ready:(loaded:boolean)=>void=()=>{}):void{
    // ArtV2Assets resolves world-boss-* to the current enemy-g1 portrait. The
    // retired art-modern/world-boss-* files are intentionally absent from APKs.
    // Reuse the attached frame; never disable it while loading a second image.
    const show=()=>{if(this.disposed||!isValid(this.node,true)||!isValid(sprite.node,true)||!sprite.spriteFrame)return;sprite.enabled=true;ready(true);this.surface(sprite,2);};
    if(sprite.spriteFrame)show();else sprite.node.once(Sprite.EventType.SPRITE_FRAME_CHANGED,show);
  }
  update(delta:number):void{
    if(typeof document!=='undefined'&&document.hidden)return;
    this.step+=delta;if(this.step<1/30)return;const dt=this.step;this.step=0;
    const enabled=!this.reduced();if(enabled)this.elapsed+=Math.min(dt,.1);const time=this.elapsed;
    for(const surface of this.surfaces)surface.material.setProperty('chartMotion',new Vec4(time,surface.kind,enabled?1:0,0));
    for(const item of this.drifts){
      const wave=enabled?Math.sin(time*(item.kind==='ship'?.95:1.25)+item.phase):0;
      item.node.setPosition(item.x,item.y+wave*(item.kind==='boss'?1.4:2.5));item.node.angle=item.kind==='ship'?wave*.8:0;
      if(item.kind==='boss')item.node.setScale(1+wave*.004,1+wave*.008,1);
      if(item.glow){const graphics=item.glow;graphics.clear();graphics.fillColor=color('#FFD971',enabled?31+Math.round((wave+1)*13):36);graphics.ellipse(0,-15,37,17);graphics.fill();graphics.fillColor=color('#FFF4B7',enabled?60+Math.round((wave+1)*25):70);graphics.circle(25,12,2);graphics.fill();}
    }
  }
  onDestroy():void{this.disposed=true;this.surfaces=[];this.drifts=[];for(const material of this.materials)material.destroy();for(const effect of this.effects)effect.decRef();}
}

export class SeaChart {
  readonly root:Node;readonly motion:SeaChartMotion;
  constructor(readonly ui:IslandUI,key:ArtV2Image,title:string,subtitle:string,back:()=>void,reduced:()=>boolean){
    this.root=ui.group('海图:'+key,0,0,ui.root,ui.pageWidth,ui.pageHeight);this.motion=this.root.addComponent(SeaChartMotion);this.motion.reduced=reduced;
    ui.secondaryPage(this.root);
    const sprite=ui.screenScenery(this.root,key);if(sprite)this.motion.surface(sprite);
    ui.text(title,-348,254,43,'#153B55',this.root,450,65).isBold=true;
    ui.text(subtitle,-347,205,19,'#527889',this.root,450,38);
    this.button('返回海岛',515,301,164,44,back);
  }
  button(text:string,x:number,y:number,width:number,height:number,action:()=>void,primary=false,disabled=false):Node{return this.ui.button(text,x,y,width,height,action,{parent:this.root,primary,disabled,size:height>50?26:20});}
  tag(text:string,x:number,y:number,width=150,selected=false,action?:()=>void):Node{
    const node=this.ui.button(text,x,y,width,40,action??(()=>{}),{parent:this.root,selected,primary:selected,size:20});return node;
  }
  boat(x:number,y:number,size=160):void{const node=this.ui.group('海图航船',x,y,this.root,size,size),sprite=this.ui.art?.attach(node,'chapter-boat',size,size);this.motion.drift(node,'ship');if(sprite)this.motion.surface(sprite,1);}
  chest(x:number,y:number,tier:number,action:()=>void,available=false,size=66):Node{
    const hit=this.ui.button('',x,y,size+12,size+12,action,{parent:this.root});hit.getComponent(Graphics)?.clear();
    const visual=this.ui.group('动态宝箱',0,0,hit,size,size),glow=visual.addComponent(Graphics);this.ui.art?.attach(visual,`chart-chest-${Math.min(2,tier)}`,size,size);this.motion.drift(visual,'chest',available?glow:undefined);return hit;
  }
  boss(key:ArtV2Image,x=0,y=52,size=380):void{const node=this.ui.group('今日世界首领',x,y,this.root,size,size),sprite=this.ui.art?.attach(node,key,size,size);this.motion.drift(node,'boss');if(sprite){const waiting=this.ui.text('首领正在登场…',0,0,20,'#153B55',node,260,40);this.motion.fullBoss(sprite,key,loaded=>{if(loaded)waiting.node.destroy();else waiting.string='画像暂未加载，请重新进入';});}}
}
