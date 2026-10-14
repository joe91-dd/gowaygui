import {Component,Graphics,Color,Node} from 'cc';
/** Subtle state animation, independent of paused simulation time and never scales the painted icon. */
export class BattleHudMotion extends Component {
 reduced:()=>boolean=()=>false;ready=false;selected=false;radius=40;width=0;height=0;
 private clock=0;private wasReady=false;private flash=0;private g?:Graphics;
 update(dt:number):void{
  this.clock+=dt;if(this.ready&&!this.wasReady)this.flash=.45;else if(!this.ready&&this.wasReady)this.flash=.3;this.wasReady=this.ready;this.flash=Math.max(0,this.flash-dt);
  this.g??=this.node.addComponent(Graphics);const g=this.g;g.clear();if(!this.ready&&!this.selected&&this.flash<=0)return;
  const breathing=this.reduced()?1:.5+.5*Math.sin(this.clock*Math.PI*2/(this.selected?.9:1.8));
  g.lineWidth=this.selected?2.5:1.6;g.strokeColor=new Color(this.selected?110:255,this.selected?233:221,this.selected?244:136,Math.round(90+breathing*130));
  if(this.width)g.roundRect(-this.width/2,-this.height/2,this.width,this.height,Math.min(22,this.height/2));else g.circle(0,0,this.radius);g.stroke();
  if(this.flash>0&&!this.reduced()&&!this.width){g.strokeColor=new Color(255,253,209,Math.round(this.flash/.45*245));g.lineWidth=3;const a=(1-this.flash/.45)*Math.PI*2;g.arc(0,0,this.radius+2,a,a+.8,false);g.stroke();}
 }
 static on(node:Node,reduced:()=>boolean):BattleHudMotion {const m=node.addComponent(BattleHudMotion);m.reduced=reduced;return m;}
}
