import {Component,Graphics,Color,Node,UIOpacity,Vec3,EventTouch} from 'cc';
import type {IslandUI} from './IslandUI';

/** Small batched scene lights; does not touch the economy RNG or character pose. */
export class MenuMotion extends Component {
 mode:'ambient'|'wish'|'fusion'='ambient';
 width=1120;height=490;age=0;reduced:()=>boolean=()=>false;
 private g?:Graphics;private frame=0;
 update(dt:number):void{
  if(this.reduced()){if(this.g)this.g.clear();return;}
  this.age+=Math.min(dt,.08);this.frame+=dt;if(this.frame<1/30)return;this.frame=0;
  const g=this.g??=this.node.addComponent(Graphics);g.clear();const t=this.age;
  const special=this.mode!=='ambient';
  if(special){for(let ring=0;ring<3;ring++){const f=(t*.18+ring/3)%1;g.lineWidth=2*(1-f)+.5;g.strokeColor=new Color(140,242,245,Math.round((1-f)*90));g.ellipse(0,-this.height*.27,(.16+f*.31)*this.width,12+f*37);g.stroke();}}
  g.fillColor=new Color(233,255,250,special?140:64);
  for(let i=0;i<(special?19:12);i++){const x=Math.sin(i*23.61)*this.width*.45+Math.sin(t*.37+i)*12,y=(((t*(special?24:10)+i*71.3)%this.height)-this.height/2),r=1.1+Math.pow(Math.max(0,Math.sin(t*1.3+i)),5)*1.7;g.circle(x,y,r);}
  g.fill();
 }
}

/** Cosmetic reveal of an already committed draw. Closing or skipping cannot purchase again. */
export class WishSequence extends Component {
 private age=0;private ended=false;private complete:()=>void=()=>{};private art?:Node;private light?:Graphics;private reduced:()=>boolean=()=>false;
 private ui?:IslandUI;private orbit:Node[]=[];private rays:Node[]=[];private phase=0;private frame=0;
 static play(ui:IslandUI,parent:Node,pool:'turtle'|'book',done:()=>void):void{
  const layer=ui.group('祈愿揭晓动画',0,0,parent,1280,720),g=layer.addComponent(Graphics);g.fillColor=new Color(8,35,58,236);g.rect(-640,-360,1280,720);g.fill();
  layer.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);layer.on(Node.EventType.TOUCH_END,(e:EventTouch)=>e.propagationStopped=true);
  const seq=layer.addComponent(WishSequence);seq.complete=done;seq.reduced=ui.reducedMotion;seq.ui=ui;
  const stage=ui.group('海心祈愿',0,0,layer,760,560);seq.light=stage.addComponent(Graphics);
  for(let i=0;i<3;i++){const n=ui.decoration('decor-magic',0,8,520+i*140,370+i*110,stage);n.addComponent(UIOpacity).opacity=100+i*40;seq.rays.push(n);}
  seq.art=ui.group('凝聚的祈愿之光',0,8,stage,210,210);ui.art?.attach(seq.art,pool==='turtle'?'fusion-bubble':'book-crystalCannon',210,210);
  for(let i=0;i<8;i++){const n=ui.group('回旋星辉:'+i,0,0,stage,60,60);if(pool==='book')ui.bookIcon((['hold','piercingShot','crystalCannon','greatHeal','bubbleRing','strong','combo','calm'] as const)[i],0,0,52,n);else ui.art?.attach(n,'fusion-bubble',40+i%3*9,40+i%3*9);n.addComponent(UIOpacity);seq.orbit.push(n);}
  ui.text(pool==='turtle'?'海风带来新的伙伴':'星光正在回应祈愿',0,239,34,'#F4FFFF',layer,860,58);
  ui.text('潮光汇聚 · 命运即将揭晓',0,-217,22,'#BDECEF',layer,780,42);
  ui.button('跳过动画',0,-287,238,46,()=>seq.finish(),{parent:layer,size:22});
  if(!ui.reducedMotion())ui.feedback?.('wishStart');
 }
 update(dt:number):void{
  if(this.ended)return;this.age+=Math.max(0,dt);if(this.reduced()||this.age>=4.2){this.finish();return;}
  if(this.age>=1.3&&this.phase===0){this.phase=1;this.ui?.feedback?.('wishGather');}
  if(this.age>=3.15&&this.phase===1){this.phase=2;this.ui?.feedback?.('wishBurst');}
  this.frame+=dt;if(this.frame<1/30)return;this.frame=0;
  const t=this.age,g=this.light!;g.clear();const gather=Math.min(1,t/3.1),burst=Math.max(0,(t-3.15)/1.05),fade=Math.max(0,1-burst);
  for(let ring=0;ring<4;ring++){const r=92+(1-gather)*120+ring*20+burst*280;g.lineWidth=ring===0?4:1.5;g.strokeColor=new Color(ring%2?255:94,ring%2?230:234,ring%2?154:255,Math.round(fade*150));g.ellipse(0,-39,r,r*.44);g.stroke();}
  for(let band=0;band<2;band++){g.strokeColor=new Color(band?255:108,band?232:233,band?176:255,Math.round(fade*170));g.lineWidth=band?2:4;for(let j=0;j<56;j++){const a=j/55*Math.PI*3+t*(band?-2:2),r=100+Math.sin(a*.45+t)*34+burst*250,x=Math.cos(a)*r,y=Math.sin(a)*r*.53;if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}
  g.fillColor=new Color(218,255,249,Math.round(fade*210));for(let i=0;i<42;i++){const a=i*2.399+t*(i%2?1:-1),r=65+(1-gather)*(170+i%5*20)+burst*360;g.circle(Math.cos(a)*r,Math.sin(a)*r*.67,1.5+i%3);}g.fill();
  this.orbit.forEach((n,i)=>{const a=i*Math.PI/4+t*(.9+gather*1.6),r=240*(1-gather*.86)+burst*330;n.setPosition(Math.cos(a)*r,Math.sin(a)*r*.62,0);const z=(.8+Math.sin(a)*.12)*(1-burst*.4);n.setScale(z,z,1);n.angle=Math.sin(a)*9;n.getComponent(UIOpacity)!.opacity=Math.round(220*fade);});
  this.rays.forEach((n,i)=>{n.angle=t*(i%2?-18:12);const scale=.65+gather*.4+burst*.8;n.setScale(scale,scale,1);n.getComponent(UIOpacity)!.opacity=Math.round((100+Math.sin(t*3+i)*35)*fade);});
  if(this.art){const scale=.82+gather*.42+burst*.7;this.art.setScale(new Vec3(scale,scale,1));this.art.angle=Math.sin(t*2)*3;const opacity=this.art.getComponent(UIOpacity)??this.art.addComponent(UIOpacity);opacity.opacity=Math.round(255*fade);}
 }
 private finish():void{if(this.ended)return;this.ended=true;this.node.removeFromParent();this.node.destroy();this.complete();}
}
