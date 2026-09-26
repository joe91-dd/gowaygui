import {BubbleShimmer} from './BubbleShimmer';
import {Canvas,EventTouch,Graphics,Mask,Node,UITransform,Vec3} from 'cc';
import {IslandUI,color,UI_COLORS} from './IslandUI';

export interface RevealBubble {x:number;y:number;radius:number;layer:number;hue:number;gone:boolean}
/** Presentation randomness is separate from every gameplay random state. */
export function makeBubbleHeap(key:string):RevealBubble[]{
  let seed=2166136261;for(let i=0;i<key.length;i++)seed=Math.imul(seed^key.charCodeAt(i),16777619);
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const bubbles:RevealBubble[]=[];
  for(let layer=0;layer<3;layer++){
    const add=(x:number,y:number,radius:number)=>bubbles.push({x,y,radius,layer,hue:Math.floor(next()*6),gone:false});
    for(let i=0;i<55;i++){
      const radius=24+next()*52+layer*8;
      add((next()-.5)*(1080-2*radius),(next()-.5)*(370-2*radius),radius);
    }
    // Coverage probes do not become a visible grid: repairs use random offsets,
    // size and order, while the visible majority is sampled freely above.
    for(let x=-510;x<=510;x+=46)for(let y=-184;y<=184;y+=32){
      if(!bubbles.some(b=>b.layer===layer&&Math.hypot(b.x-x,b.y-y)<b.radius*.78)){
        add(x+(next()-.5)*28,y+(next()-.5)*24,52+next()*30);
      }
    }
  }
  return bubbles;
}
export function rubBubbleHeap(bubbles:RevealBubble[],x:number,y:number,budget=2,dirtyLayers?:Set<number>):number{
  let erased=0;
  for(let i=bubbles.length-1;i>=0&&erased<budget;i--){
    const b=bubbles[i];if(!b.gone&&Math.hypot(x-b.x,y-b.y)<=b.radius){b.gone=true;dirtyLayers?.add(b.layer);erased++;}
  }
  return erased;
}
const PALETTE=['#8ddde6','#daa5ed','#f1c98d','#91d8af','#b8c9f2','#f2b4c8'];
/** Reusable cover for already-persisted fusion and book outcomes. */
export class BubbleReveal {
  private readonly bubbles:RevealBubble[];
  private readonly root:Node;
  private readonly graphics:Graphics[]=[];
  private pressed=false;
  private previous?:{x:number;y:number};
  private finished=false;
  constructor(private readonly ui:IslandUI,parent:Node,key:string,private readonly complete:()=>boolean|void,
    private readonly available:()=>boolean=()=>true,private readonly onRub:()=>void=()=>{}){
    this.bubbles=makeBubbleHeap(key);this.root=ui.group('分层泡泡覆盖',0,0,parent,1100,400);
    if(ui.art?.ready){this.singleBubble(parent);return;}
    this.root.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    for(let layer=0;layer<3;layer++)this.graphics.push(ui.group(`泡泡第${layer+1}层`,0,0,this.root,1100,380).addComponent(Graphics));
    const progress=ui.text('点击戳破少量泡泡，按住滑动可以慢慢擦开。',0,-216,22,UI_COLORS.sand,parent,1100,28);
    const rub=(e:EventTouch,start:boolean)=>{
      if(!this.current()||(!start&&!this.pressed))return;
      if(start){this.pressed=true;this.previous=undefined;}
      let canvas:Canvas|null=null;for(let n:Node|null=ui.root;n&&!canvas;n=n.parent)canvas=n.getComponent(Canvas);
      const transform=this.root.getComponent(UITransform),camera=canvas?.cameraComponent;if(!transform||!camera)return;
      const screen=e.getLocation(),point=transform.convertToNodeSpaceAR(camera.screenToWorld(new Vec3(screen.x,screen.y,0)));
      const previous=this.previous??point,steps=Math.min(6,Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y)/24)));
      const dirtyLayers=new Set<number>();let changed=0;for(let i=1;i<=steps;i++)changed+=rubBubbleHeap(this.bubbles,previous.x+(point.x-previous.x)*i/steps,previous.y+(point.y-previous.y)*i/steps,start?2:1,dirtyLayers);
      this.previous={x:point.x,y:point.y};
      if(changed){this.draw(dirtyLayers);this.onRub();const cleared=this.bubbles.filter(b=>b.gone).length;
        progress.string=`泡泡慢慢散开了 ${Math.round(cleared/this.bubbles.length*100)}%`;
        if(cleared>=this.bubbles.length*.97)this.finish();}
    };
    this.root.on(Node.EventType.TOUCH_START,(e:EventTouch)=>rub(e,true));
    this.root.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>rub(e,false));
    const end=()=>{this.pressed=false;this.previous=undefined;};
    this.root.on(Node.EventType.TOUCH_END,end);this.root.on(Node.EventType.TOUCH_CANCEL,end);
    ui.button('直接揭晓',0,-276,400,88,()=>this.finish(),{parent,primary:true,size:32});this.draw();
  }
  private current():boolean{return !this.finished&&this.available()&&this.ui.isInteractive(this.root);}
  private singleBubble(parent:Node):void{
    this.root.name='五彩泡泡揭晓';this.root.getComponent(UITransform)!.setContentSize(580,580);this.root.setPosition(0,-30,0);
    const mask=this.root.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_STENCIL;mask.inverted=true;
    const stencil=mask.subComp as Graphics;stencil.clear();
    // The cover is opaque even where the decorative bubble asset is translucent.
    const seal=this.ui.group('不透明开奖覆盖',0,0,this.root,500,500).addComponent(Graphics);seal.fillColor=color('#BBDDDC',255);seal.circle(0,0,246);seal.fill();
    this.ui.art!.attach(this.root,'fusion-bubble',600,600);this.ui.group('泡泡虹彩流动',0,0,this.root,520,520).addComponent(BubbleShimmer).reduced=this.ui.reducedMotion;
    const samples:{x:number;y:number;gone:boolean}[]=[];for(let x=-246;x<=246;x+=20)for(let y=-246;y<=246;y+=20)if(Math.hypot(x,y)<=246)samples.push({x,y,gone:false});
    const hint=this.ui.text('擦开或轻点揭晓',0,-294,23,UI_COLORS.cream,parent,280,34);let travel=0;
    const brush=(event:EventTouch,start:boolean)=>{
      if(!this.current()||(!start&&!this.pressed))return;event.propagationStopped=true;
      let canvas:Canvas|null=null;for(let n:Node|null=this.ui.root;n&&!canvas;n=n.parent)canvas=n.getComponent(Canvas);const camera=canvas?.cameraComponent;if(!camera)return;
      const location=event.getLocation(),point=this.root.getComponent(UITransform)!.convertToNodeSpaceAR(camera.screenToWorld(new Vec3(location.x,location.y,0)));
      if(start){if(Math.hypot(point.x,point.y)>278)return;this.pressed=true;this.previous=undefined;travel=0;}
      const before=this.previous??point,distance=Math.hypot(point.x-before.x,point.y-before.y);travel+=distance;const steps=Math.min(32,Math.max(1,Math.ceil(distance/16)));
      for(let i=1;i<=steps;i++){const x=before.x+(point.x-before.x)*i/steps,y=before.y+(point.y-before.y)*i/steps;stencil.circle(x,y,43);stencil.fill();for(const sample of samples)if(Math.hypot(sample.x-x,sample.y-y)<43)sample.gone=true;}
      this.previous={x:point.x,y:point.y};this.onRub();const ratio=samples.filter(s=>s.gone).length/samples.length;hint.string=`揭晓 ${Math.round(ratio*100)}%`;if(ratio>.96)this.finish();
    };
    this.root.on(Node.EventType.TOUCH_START,(e:EventTouch)=>brush(e,true));this.root.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>brush(e,false));
    this.root.on(Node.EventType.TOUCH_END,()=>{const tap=this.pressed&&travel<12;this.pressed=false;this.previous=undefined;if(tap)this.finish();});this.root.on(Node.EventType.TOUCH_CANCEL,()=>{this.pressed=false;this.previous=undefined;});
    this.ui.button('直接揭晓',0,-337,340,42,()=>this.finish(),{parent,primary:true,size:28});
  }
  private finish():void{if(!this.current())return;if(this.complete()!==false)this.finished=true;}
  private draw(layers:ReadonlySet<number>=new Set([0,1,2])):void{
    this.graphics.forEach((g,i)=>{if(layers.has(i))g.clear();});
    for(const bubble of this.bubbles){if(bubble.gone||!layers.has(bubble.layer))continue;const g=this.graphics[bubble.layer],{x,y,radius:r}=bubble;
      g.fillColor=color(PALETTE[bubble.hue],bubble.layer===0?224:198);g.circle(x,y,r);g.fill();
      g.strokeColor=color('#ffffff',116);g.lineWidth=1.7;g.circle(x,y,r-1);g.stroke();
      g.fillColor=color('#ffffff',110);g.ellipse(x-r*.28,y+r*.35,r*.2,r*.1);g.fill();
    }
  }
}
