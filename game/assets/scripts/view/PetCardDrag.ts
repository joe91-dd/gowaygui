import {Canvas,EventTouch,Graphics,Node,UITransform,Vec3} from 'cc';
import {IslandUI,color} from './IslandUI';
import type {Turtle} from '../core/types';
import {pagingCardDrag,pagingCancelCard} from './SwipePaging';
export interface PetDropTarget {id:string;node:Node}

/** Touch and mouse share one gesture; cancellation never commits a drop. */
export function petCardDrag(ui:IslandUI,node:Node,pet:Turtle,targets:PetDropTarget[],options:{hold?:boolean;tap:()=>void;drop:(id:string)=>void}):void{
 let start:{x:number;y:number}|undefined,point:{x:number;y:number}|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 let dragging=false,moved=false,ghost:Node|undefined,outline:Node|undefined,target:PetDropTarget|undefined;
 const worldPoint=(p:{x:number;y:number})=>{let canvas:Canvas|null=null;for(let n:Node|null=ui.root;n&&!canvas;n=n.parent)canvas=n.getComponent(Canvas);return canvas?.cameraComponent?.screenToWorld(new Vec3(p.x,p.y,0));};
 const cancelTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
 const reset=()=>{cancelTimer();pagingCardDrag(node,false);ghost?.destroy();outline?.destroy();ghost=undefined;outline=undefined;target=undefined;start=undefined;point=undefined;dragging=false;if(ui.isInteractive(node))node.setScale(1,1,1);};
 pagingCancelCard(node,reset);
 const contains=(n:Node,p:{x:number;y:number})=>{if(!ui.isInteractive(n))return false;const t=n.getComponent(UITransform),world=worldPoint(p);if(!t||!world)return false;const q=t.convertToNodeSpaceAR(world);return Math.abs(q.x)<=t.width/2&&Math.abs(q.y)<=t.height/2;};
 const follow=()=>{if(!point||!ghost)return;const world=worldPoint(point);if(!world)return;const q=ui.root.getComponent(UITransform)!.convertToNodeSpaceAR(world);ghost.setPosition(q.x,q.y+18,0);
  const hit=targets.find(t=>t.node!==node&&contains(t.node,point!));if(hit===target)return;outline?.destroy();outline=undefined;target=hit;
  if(hit){const t=hit.node.getComponent(UITransform)!;outline=ui.group('放下后换位',0,0,hit.node,t.width,t.height);const g=outline.addComponent(Graphics);g.strokeColor=color('#00B8BD');g.lineWidth=4;g.roundRect(-t.width/2+3,-t.height/2+3,t.width-6,t.height-6,15);g.stroke();}
 };
 const begin=()=>{cancelTimer();if(!start||!ui.isInteractive(node)||moved)return;dragging=true;pagingCardDrag(node,true);ghost=ui.group('拖动伙伴预览',0,0,ui.root,124,143);ui.panel(0,0,120,140,ghost,'#F5FFFA',238,18);ui.pet(pet,0,9,98,ghost);ui.text('松手放置',0,-52,17,'#007E89',ghost,115,24);follow();};
 for(const type of [Node.EventType.TOUCH_START,Node.EventType.TOUCH_MOVE,Node.EventType.TOUCH_END,Node.EventType.TOUCH_CANCEL])node.off(type);
 node.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(!ui.isInteractive(node))return;reset();start=point=e.getLocation();moved=false;timer=setTimeout(begin,330);e.propagationStopped=true;});
 node.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!start)return;point=e.getLocation();if(Math.hypot(point.x-start.x,point.y-start.y)>8){moved=true;if(!dragging)cancelTimer();}if(dragging)follow();e.propagationStopped=true;});
 const finish=(e:EventTouch)=>{if(!start)return;if(!ui.isInteractive(node)){reset();return;}point=e.getLocation();if(dragging)follow();const drop=dragging?target?.id:undefined,tap=!dragging&&!moved;reset();e.propagationStopped=true;if(drop){ui.click();options.drop(drop);}else if(tap){ui.click();options.tap();}};
 node.on(Node.EventType.TOUCH_END,finish);
 // Creator sends TOUCH_CANCEL when a real release lands outside the original card.
 node.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(dragging&&e.getEventCode()===Node.EventType.TOUCH_END)finish(e);else reset();});node.once(Node.EventType.NODE_DESTROYED,reset);
}
