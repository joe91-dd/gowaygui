import {_decorator,Component,Graphics,Color} from 'cc';
import {FAUNA_AURAS} from '../core/faunaAura';
const {ccclass}=_decorator;
/** Ocean spirit flames match the battle palette; no fog over the face or card copy. */
@ccclass('CodexAura')
export class CodexAura extends Component {
 width=140;height=144;grade=0;front=false;private time=0;private step=0;private g?:Graphics;
 update(dt:number):void{
  this.time+=Math.min(dt,.1);this.step+=dt;if(this.step<.05)return;this.step=0;
  const g=this.g??=this.node.addComponent(Graphics),c=FAUNA_AURAS[this.grade]??FAUNA_AURAS[0],w=this.width,h=this.height;
  g.clear();
  const base=-h*.35;
  for(let j=0;j<(this.front?2:4);j++){
   const sign=j%2?1:-1,phase=this.time*1.5+j*1.9,bend=Math.sin(phase)*w*.035;
   const x=sign*w*(this.front?.19:.28),rise=h*(this.front?.20:.37)*(1+.12*Math.sin(phase));
   const fill=new Color(c.color);fill.a=this.front?62:91;g.fillColor=fill;
   g.moveTo(x,base);g.bezierCurveTo(x+sign*w*.18,base+rise*.25,x-sign*w*.09+bend,base+rise*.64,x+sign*w*.04+bend,base+rise);
   g.bezierCurveTo(x-sign*w*.18+bend,base+rise*.59,x+sign*w*.04,base+rise*.22,x,base);g.close();g.fill();
   const edge=new Color(c.highlight);edge.a=120+Math.round(50*Math.sin(phase));g.strokeColor=edge;g.lineWidth=this.front?1.2:1.7;
   g.moveTo(x,base);g.bezierCurveTo(x+sign*w*.13,base+rise*.28,x-sign*w*.10+bend,base+rise*.70,x+sign*w*.04+bend,base+rise);g.stroke();
   const t=(this.time*.25+j*.29)%1,mote=new Color(c.highlight);mote.a=Math.round(Math.sin(t*Math.PI)*160);g.fillColor=mote;g.circle(x+Math.sin(t*5+j)*w*.10,base+rise*t,1.2);g.fill();
  }
 }
}
