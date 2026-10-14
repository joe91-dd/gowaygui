import {EventTouch,Node,view} from 'cc';
import type {IslandUI} from './IslandUI';

type PageButton={node:Node;action:()=>void;disabled:boolean};
type Pager={previous?:PageButton;next?:PageButton};
const pagers=new WeakMap<Node,Pager>();
const scrollSurfaces=new WeakSet<Node>();
const draggingCards=new WeakSet<Node>();
const cancelCardTouch=new WeakMap<Node,()=>void>();
/** A scroll list owns its vertical gesture; a held card owns its drag. */
export function reserveVerticalScroll(node:Node):void{scrollSurfaces.add(node);}
export function pagingCardDrag(node:Node,active:boolean):void{if(active)draggingCards.add(node);else draggingCards.delete(node);}
export function pagingCancelCard(node:Node,cancel:()=>void):void{cancelCardTouch.set(node,cancel);}
export function pageButtonDirection(label:string):-1|0|1{
  if(/^(上一页|上页|‹(?:\s*上一海域)?)$/.test(label))return -1;
  if(/^(下一页|下页|(?:下一海域\s*)?›)$/.test(label))return 1;
  return 0;
}
/** Capture at the page, so a swipe beginning on a card cannot open/buy it. */
export function registerPageButton(ui:IslandUI,parent:Node,node:Node,label:string,action:()=>void,disabled:boolean):void{
  const direction=pageButtonDirection(label);if(!direction)return;
  let pager=pagers.get(parent);
  if(!pager){
    pager={};pagers.set(parent,pager);const page=pager;
    let start:{x:number;y:number}|undefined,target:Node|undefined,touchId:number|null|undefined,verticalScroll=false,claimed=false,rejected=false;
    const available=()=>!!page.previous&&!!page.next&&ui.isInteractive(page.previous.node)&&ui.isInteractive(page.next.node);
    const chain=(check:(n:Node)=>boolean)=>{for(let n=target;n;n=n.parent??undefined){if(check(n))return true;if(n===parent)break;}return false;};
    const reset=()=>{start=undefined;target=undefined;touchId=undefined;claimed=false;rejected=false;};
    const stop=(e:EventTouch)=>{e.propagationStopped=true;e.propagationImmediateStopped=true;};
    const movement=(e:EventTouch)=>{const p=e.getLocation(),scale=Math.max(.1,view.getScaleY());return {x:(p.x-start!.x)/scale,y:(p.y-start!.y)/scale};};
    const matches=(e:EventTouch)=>start&&e.getID()===touchId;
    const releaseButtons=()=>{chain(n=>{cancelCardTouch.get(n)?.();if(n.name.startsWith('按钮:'))n.setScale(1,1,1);return false;});};
    parent.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{
      if(start){rejected=true;return;}if(!available())return;
      // Nested pagers handle their own gestures.
      for(let n=e.target as Node;n&&n!==parent;n=n.parent!)if(pagers.has(n))return;
      start=e.getLocation();target=e.target as Node;touchId=e.getID();claimed=false;rejected=false;verticalScroll=chain(n=>scrollSurfaces.has(n));
    },undefined,true);
    parent.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{
      if(!matches(e)||rejected)return;
      if(chain(n=>draggingCards.has(n))){rejected=true;return;}
      const d=movement(e),x=Math.abs(d.x),y=Math.abs(d.y);
      if(!claimed){if(Math.max(x,y)<18)return;if(verticalScroll&&y>x){rejected=true;return;}if(Math.max(x,y)<Math.min(x,y)*1.25)return;claimed=true;releaseButtons();}
      stop(e);
    },undefined,true);
    const finish=(e:EventTouch,cancelled:boolean)=>{
      if(!matches(e))return;
      const d=movement(e),x=Math.abs(d.x),y=Math.abs(d.y),owned=chain(n=>draggingCards.has(n));
      const swipe=!rejected&&!owned&&!(verticalScroll&&y>x)&&Math.max(x,y)>=56&&Math.max(x,y)>=Math.min(x,y)*1.25;
      // Creator rewrites event.type to CANCEL when a real release leaves the
      // original card; getEventCode retains the original input END/CANCEL.
      const released=!cancelled||e.getEventCode()===Node.EventType.TOUCH_END;
      const control=(x>=y?d.x<0:d.y>0)?page.next:page.previous;
      if(claimed||swipe){releaseButtons();stop(e);}reset();
      if(released&&swipe&&control&&!control.disabled&&available()){
        ui.click();try{control.action();}catch(error){if(ui.onActionError)ui.onActionError(error);else throw error;}
      }
    };
    parent.on(Node.EventType.TOUCH_END,(e:EventTouch)=>finish(e,false),undefined,true);
    parent.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>finish(e,true),undefined,true);
    parent.once(Node.EventType.NODE_DESTROYED,reset);
  }
  pager[direction<0?'previous':'next']={node,action,disabled};
}
