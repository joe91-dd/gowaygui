import {Component,Graphics,Color} from 'cc';
/** Iridescent arcs share the reveal mask, so scratched areas remain genuinely clear. */
export class BubbleShimmer extends Component {
 radius=246;reduced:()=>boolean=()=>false;private age=0;private frame=0;private g?:Graphics;
 update(dt:number):void{
  if(this.reduced()){this.g?.clear();return;}
  this.age+=Math.min(dt,.08);this.frame+=dt;if(this.frame<1/30)return;this.frame=0;
  const g=this.g??=this.node.addComponent(Graphics);g.clear();
  const palette=[[131,246,255],[191,177,255],[255,179,224],[255,224,151],[178,255,217]];
  // Wide translucent ribbons and their bright cores move together around the soap film.
  for(let band=0;band<5;band++){
   const a=this.age*(band%2?-.22:.3)+band*Math.PI*.4,r=this.radius-7-band%2*8,c=palette[band];
   for(let layer=0;layer<2;layer++){
    g.lineWidth=layer?3:17;g.strokeColor=new Color(c[0],c[1],c[2],layer?175:42);
    for(let j=0;j<=15;j++){const theta=a+j/15*.82,x=Math.cos(theta)*r,y=Math.sin(theta)*r;if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
   }
   // An airy internal highlight follows the outer ribbon; the opaque seal below remains intact.
   g.lineWidth=7;g.strokeColor=new Color(c[0],c[1],c[2],22);const q=r*.86;
   g.moveTo(Math.cos(a)*q,Math.sin(a)*q);g.bezierCurveTo(-q*.8,Math.sin(a+.7)*q,q*.6,Math.sin(a+1)*q,Math.cos(a+1.2)*q,Math.sin(a+1.2)*q);g.stroke();
  }
  for(let i=0;i<6;i++){
   const a=this.age*.35+i*Math.PI/3,r=this.radius-9,x=Math.cos(a)*r,y=Math.sin(a)*r,s=2+5*Math.pow(Math.max(0,Math.sin(this.age*1.5+i)),6);
   g.strokeColor=new Color(255,251,223,210);g.lineWidth=1.5;g.moveTo(x-s*1.8,y);g.lineTo(x+s*1.8,y);g.moveTo(x,y-s*1.8);g.lineTo(x,y+s*1.8);g.stroke();g.fillColor=new Color(255,255,244,220);g.circle(x,y,s*.45);g.fill();
  }
 }
}
