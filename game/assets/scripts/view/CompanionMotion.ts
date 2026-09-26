import {Color,Graphics,isValid,Node,Sprite,UITransform} from 'cc';
import type {Role} from '../core/types';
import type {ArtV2Assets} from './ArtV2Assets';
import {CompanionRig} from './CompanionRig';
import {COMPANION_PADDING} from './CompanionRigData';

/** Base companion presentation. The deferred 10-skill visual package is not loaded here. */
export class CompanionMotion {
 private rig:CompanionRig;
 constructor(private sprite:Sprite,role:Role,parent:Node,art:ArtV2Assets){
  const height=sprite.node.getComponent(UITransform)!.contentSize.height;
  const frame=art.battleFrame('signature-'+role+'-0')!;
  sprite.spriteFrame=frame;
  const width=height*frame.rect.width/frame.rect.height;
  sprite.node.getComponent(UITransform)!.setContentSize(width*COMPANION_PADDING,height*COMPANION_PADDING);
  const source=art.companionMaterial(false);sprite.customMaterial=source;
  this.rig=new CompanionRig(sprite.getMaterialInstance(0)!,role,frame,false,false,false);
  const shadow=new Node('伙伴脚底接触阴影');shadow.layer=parent.layer;shadow.setParent(parent);shadow.setSiblingIndex(0);shadow.setPosition(8,-height*.45);const g=shadow.addComponent(Graphics);
  for(let i=9;i>0;i--){g.fillColor=new Color(43,61,49,5+i);g.ellipse(0,0,width*(.23+i*.008),5+i*1.4);g.fill();}
  sprite.node.once(Node.EventType.NODE_DESTROYED,()=>{this.rig.destroy();source.destroy();});
 }
 update(dt:number,reduced=false):void{if(!isValid(this.sprite,true))return;this.rig.update(dt,reduced);}
}
