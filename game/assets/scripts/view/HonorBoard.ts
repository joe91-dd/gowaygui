import {Component,EventTouch,EventMouse,Graphics,Mask,Node,UIOpacity,Vec3,tween,Tween,isValid} from 'cc';
import {IslandUI,UI_COLORS,color} from './IslandUI';
import {SeaChartMotion} from './SeaChart';
import type {Turtle} from '../core/types';

export interface HonorEntry {id:string;rank:number;name:string;metric:string;subject?:string;detail?:string;pets:Turtle[];rotate?:boolean;inspect:(pet?:Turtle)=>void}

/** Three independent animated displays. All rank data remains live UI, never baked into art. */
export class HonorMotion extends Component {
 reduced:()=>boolean=()=>false;private elapsed=0;private frame=0;private light?:Graphics;
 private displays:{host:Node;pets:Turtle[];index:number;ui:IslandUI;size:number;rotate:boolean;pet?:Turtle}[]=[];
 add(ui:IslandUI,host:Node,pets:Turtle[],size:number,rotate:boolean):()=>Turtle|undefined{
  const d={host,pets,index:0,ui,size,rotate,pet:pets[0]};this.displays.push(d);this.paint(d);return ()=>d.pet;
 }
 private paint(d:typeof this.displays[number]):void{
  for(const n of [...d.host.children]){n.removeFromParent();n.destroy();}
  d.pet=d.pets[d.index];if(!d.pet)return;
  const shadow=uiGraphics(d.ui,d.host);shadow.fillColor=color('#635235',42);shadow.ellipse(0,0,d.size*.24,9);shadow.fill();
  // The portrait image contains a short clear margin under the feet.
  const h=d.size*(d.pet.role==='stone'?1:.89),n=d.ui.portrait(d.pet.role,0,h*.43,d.size,d.host,true,d.pet.skills.length>=10);
  if(!this.reduced()){const a=n.addComponent(UIOpacity);a.opacity=0;n.setPosition(0,h*.43-9);tween(a).to(.42,{opacity:255}).start();tween(n).to(.55,{position:new Vec3(0,h*.43,0)},{easing:'sineOut'}).start();}
 }
 update(dt:number):void{
  if(typeof document!=='undefined'&&document.hidden)return;
  const old=Math.floor(this.elapsed/8);if(!this.reduced())this.elapsed+=Math.min(.1,dt);
  if(old!==Math.floor(this.elapsed/8))for(const d of this.displays)if(d.rotate&&d.pets.length>1){d.index=(d.index+1)%d.pets.length;this.paint(d);}
  this.frame+=dt;if(this.frame<1/24)return;this.frame=0;
  const g=this.light??=this.node.addComponent(Graphics);g.clear();if(this.reduced())return;
  const t=this.elapsed;
  // Moving highlights around the existing crown and laurel, behind the characters.
  for(let i=0;i<14;i++){const a=t*.23+i*2.399,x=-178+Math.cos(a)*125,y=100+Math.sin(a)*137;g.fillColor=color('#FFF0AA',Math.round(45+100*Math.pow(Math.max(0,Math.sin(t*1.4+i)),3)));g.circle(x,y,1+i%3*.45);g.fill();}
 }
 onDestroy():void{for(const d of this.displays)for(const n of d.host.children){Tween.stopAllByTarget(n);const a=n.getComponent(UIOpacity);if(a)Tween.stopAllByTarget(a);}this.displays=[];}
}

export class HonorBoard {
 readonly root:Node;readonly motion:HonorMotion;
 constructor(readonly ui:IslandUI,title:string,subtitle:string,back:()=>void,private petMode=false){
  this.root=ui.group('荣耀榜:'+title,0,0,ui.root,1280,720);ui.secondaryPage(this.root);
  const sprite=ui.art?.attach(this.root,petMode?'honor-pet-terrace':'honor-terrace',1280,720);
  if(sprite){const ambient=this.root.addComponent(SeaChartMotion);ambient.reduced=ui.reducedMotion;ambient.surface(sprite,petMode?6:5);}
  // Honor art uses its own ocean/gold mask; the battle map mask would move stone.
  const effects=ui.group('冠冕月桂流光',petMode?178:0,petMode?70:0,this.root);this.motion=effects.addComponent(HonorMotion);this.motion.reduced=ui.reducedMotion;
  const titleBar=ui.panel(-25,316,690,62,this.root,'#FFF9EC',248,24);this.edge(titleBar,690,62);ui.text(title,0,0,36,UI_COLORS.ink,titleBar,650,54);
  this.button('返回',551,316,132,46,back);
  if(subtitle){const bar=ui.panel(-28,258,750,35,this.root,'#FFF9EC',234,16);ui.text(subtitle,0,0,18,UI_COLORS.sand,bar,728,30);}
 }
 edge(n:Node,w:number,h:number):void{const g=uiGraphics(this.ui,n);g.lineWidth=1.5;g.strokeColor=color('#D5B67C');g.roundRect(-w/2+1,-h/2+1,w-2,h-2,17);g.stroke();}
 button(label:string,x:number,y:number,w:number,h:number,action:()=>void,primary=false,parent=this.root,disabled=false):Node{const n=this.ui.button(label,x,y,w,h,action,{parent,primary,disabled,size:h<44?19:22});this.edge(n,w,h);return n;}
 tabs(active:string,go:(id:string)=>void):void{['宠物','关卡','无尽','竞技场'].forEach((label,i)=>this.button(label,-365+i*213,259,204,42,()=>go(label),label===active));}
 winners(rows:HonorEntry[]):void{
  const spots=this.petMode?[{x:0,y:42,w:193,labelY:-37,medalY:15},{x:-288,y:2,w:182,labelY:-68,medalY:-19},{x:279,y:-1,w:184,labelY:-70,medalY:-26}]:[{x:-182,y:-53,w:238,labelY:-137,medalY:-86},{x:-426,y:-85,w:201,labelY:-163,medalY:-112},{x:45,y:-94,w:207,labelY:-168,medalY:-120}];
  spots.forEach((spot,i)=>{
   const r=rows.find(r=>r.rank===i+1),host=this.ui.group('荣誉伙伴:'+String(i+1),spot.x,spot.y,this.root,spot.w,spot.w);
   const shadow=uiGraphics(this.ui,host);shadow.fillColor=color('#635235',40);shadow.ellipse(0,0,spot.w*.25,9);shadow.fill();
   const displayed=this.motion.add(this.ui,host,r?.pets??[],spot.w,!!r?.rotate);
   this.ui.text(String(i+1),spot.x,spot.medalY,29,i===0?'#FFF8D0':'#FFFFFF',this.root,58,45);
   this.ui.text(r?.name??'虚位以待',spot.x,spot.labelY+12,21,UI_COLORS.ink,this.root,202,32);
   this.ui.text(r?.metric??'等待新的传奇',spot.x,spot.labelY-13,18,i===0?'#94702D':UI_COLORS.sand,this.root,208,25);
   if(r?.detail&&!this.petMode)this.ui.text(r.detail,spot.x,spot.labelY-35,13,UI_COLORS.sand,this.root,204,18);
   this.button(r?'查看详情':'尚未上榜',spot.x,this.petMode?-108:-229,190,36,()=>r?.inspect(displayed()),false,this.root,!r);
  });
 }
 list(rows:HonorEntry[],heading:string,empty='完成挑战后即可上榜'):void{
  if(this.petMode){this.wideList(rows);return;}
  const p=this.ui.panel(431,0,363,454,this.root,'#FFF9EC',247,20);this.edge(p,363,454);this.ui.text(heading,0,190,26,UI_COLORS.ink,p,320,42);
  const viewport=this.ui.group('荣耀排名滚动区',0,-20,p,341,354),mask=viewport.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_RECT;
  const content=this.ui.group('荣耀排名列表',0,0,viewport,341,Math.max(354,rows.length*68));let offset=0,origin=0,before=0;
  const max=Math.max(0,rows.length*68-350),scroll=(n:number)=>{offset=Math.max(0,Math.min(max,n));content.setPosition(0,offset);};
  viewport.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{origin=e.getLocation().y;before=offset;});viewport.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>scroll(before+e.getLocation().y-origin));viewport.on(Node.EventType.MOUSE_WHEEL,(e:EventMouse)=>scroll(offset-e.getScrollY()*.45));
  rows.forEach((r,i)=>{
   const y=142-i*68,n=this.ui.button('',0,y,336,63,()=>{if(Math.abs(offset-before)<12)r.inspect(r.pets[0]);},{parent:content});n.getComponent(Graphics)?.clear();
   // Keep one continuous list surface; native button skin is hidden, hit target retained.
   for(const c of n.children)c.active=false;
   this.ui.text(String(r.rank),-145,0,23,UI_COLORS.ink,n,37,32);
   if(r.pets[0])this.ui.pet(r.pets[0],-103,0,39,n);
   this.ui.text(r.name,-3,12,19,UI_COLORS.ink,n,140,29);
   this.ui.text(r.metric,r.detail?-29:-3,-14,17,UI_COLORS.sand,n,153,26);
   if(r.detail)this.ui.text(r.detail,106,-14,14,UI_COLORS.sand,n,99,24);
   this.ui.text('›',147,0,25,UI_COLORS.gold,n,28,34);this.ui.line(-158,-32,158,-32,n,'#D8D2BF');
  });
  if(!rows.length)this.ui.text(empty,0,4,22,UI_COLORS.sand,p,298,130,true);
  if(max>0)this.ui.text('上下滑动查看更多',0,-207,15,UI_COLORS.sand,p,290,25);
 }
 private wideList(rows:HonorEntry[]):void{
  const p=this.ui.panel(0,-200,1186,130,this.root,'#FFF9EC',247,20);this.edge(p,1186,130);
  this.ui.text('排名',-505,46,18,UI_COLORS.sand,p,100,27);this.ui.text('伙伴 / 岛主',-29,46,18,UI_COLORS.sand,p,420,27);this.ui.text('评分',426,46,18,UI_COLORS.sand,p,200,27);
  const viewport=this.ui.group('宠物榜滚动区',0,-13,p,1136,92);viewport.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
  const content=this.ui.group('宠物榜列表',0,0,viewport,1136,Math.max(92,rows.length*46));let offset=0,origin=0,before=0;
  const scroll=(n:number)=>{offset=Math.max(0,Math.min(Math.max(0,rows.length*46-92),n));content.setPosition(0,offset);};
  viewport.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{origin=e.getLocation().y;before=offset;});viewport.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>scroll(before+e.getLocation().y-origin));viewport.on(Node.EventType.MOUSE_WHEEL,(e:EventMouse)=>scroll(offset-e.getScrollY()*.4));
  rows.forEach((r,i)=>{const n=this.ui.button('',0,23-i*46,1126,45,()=>{if(Math.abs(offset-before)<12)r.inspect(r.pets[0]);},{parent:content});n.getComponent(Graphics)?.clear();for(const c of n.children)c.active=false;this.ui.text(String(r.rank),-505,0,23,UI_COLORS.ink,n,90,33);if(r.pets[0])this.ui.pet(r.pets[0],-393,0,37,n);this.ui.text((r.subject?r.subject+' · ':'')+r.name,-41,0,21,UI_COLORS.ink,n,500,33);this.ui.text(r.metric,426,0,21,UI_COLORS.gold,n,231,33);this.ui.line(-530,-22,530,-22,n,'#D8D2BF');});
  if(!rows.length)this.ui.text('暂无其他排名',0,0,22,UI_COLORS.sand,viewport,880,50);
 }
 footer(rank:string,metric:string,pet:Turtle|undefined,choose:()=>void,rotate:boolean,toggle:()=>void,compact=false):void{
  const height=compact?64:this.petMode?78:91,p=this.ui.panel(0,compact?-280:this.petMode?-310:-296,1186,height,this.root,'#FFF9EC',248,22);this.edge(p,1186,height);
  this.ui.text('我的排名 '+rank,-443,13,23,UI_COLORS.ink,p,265,33);this.ui.text(metric,-443,-19,18,UI_COLORS.sand,p,265,28);
  if(pet)this.ui.pet(pet,-255,0,55,p);
  this.button('更换展示龟龟',-17,0,330,51,choose,true,p);
  this.button(rotate?'轮换展示 · 开':'轮换展示 · 关',278,0,232,47,toggle,false,p);
 }
}
function uiGraphics(ui:IslandUI,parent:Node):Graphics{return ui.group('细节光影',0,0,parent).addComponent(Graphics);}
