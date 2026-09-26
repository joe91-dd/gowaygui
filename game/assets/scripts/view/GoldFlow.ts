import {_decorator,Component,Graphics,Color} from 'cc';
const {ccclass}=_decorator;
/** A restrained moving highlight, distinct from a static yellow rarity border. */
@ccclass('GoldFlow')
export class GoldFlow extends Component {
 side=80;private time=0;private g?:Graphics;
 update(dt:number):void{this.time+=Math.min(.1,dt);const g=this.g??=this.node.addComponent(Graphics),s=this.side/2-2;g.clear();g.strokeColor=new Color(211,153,34,210);g.lineWidth=2;g.roundRect(-s,-s,s*2,s*2,10);g.stroke();
  for(let j=0;j<2;j++)for(let i=0;i<12;i++){const p=(this.time*.24+j*.5-i*.004)%1,q=(p+1)%1*8*s;let x=-s,y=-s;if(q<2*s)x+=q;else if(q<4*s){x=s;y+=q-2*s;}else if(q<6*s){x=s-(q-4*s);y=s;}else{y=s-(q-6*s);}g.fillColor=new Color(255,237,153,Math.round(225*(1-i/12)));g.circle(x,y,1.8);g.fill();}
 }
}
