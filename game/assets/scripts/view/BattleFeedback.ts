import {Camera,Color,Label,LabelOutline,Node,UIOpacity,Vec3,screen,tween,isValid} from 'cc';
import type {BattleEvent,BattleState} from '../core/battle';
import {SKILL_BY_ID} from '../core/data';
import {IslandUI} from './IslandUI';

type Popup={node:Node;label:Label;amount:number;tick:number;lastTick:number;key:string;type:string};
/** One shared presentation path for chapter, endless, arena, live raid and world boss. */
export class BattleFeedback {
 private live:Popup[]=[];private notices=new Map<string,number>();
 constructor(private ui:IslandUI,private camera:Camera){}
 show(battle:BattleState,event:BattleEvent):void {
  const amount=Math.round(event.amount??0),numeric=amount>0&&['damage','heal','shield'].includes(event.type);
  const continuing=['cooldown','landing','burn','rockPulse','rockSplit','arrowRain','blizzardPulse','shatter','splash'].includes(event.effect??'');
  const skill=event.skillId?SKILL_BY_ID[event.skillId]:undefined;
  const name=event.effect==='fusion2'?'二阶合成':event.effect==='fusion3'?'三阶觉醒':event.effect==='castInterrupted'?'打断':event.type==='control'?(event.effect==='web'?'束缚':event.effect==='slow'?'减速':event.skillId==='polymorph'?'变形':event.skillId==='root'?'缠绕':'眩晕'):event.type==='skill'&&skill&&!continuing?skill.name:event.type==='shield'&&event.effect==='不灭珍珠'?'不灭珍珠':undefined;
  if(!numeric&&!name)return;
  const caster=!numeric&&event.type!=='control',id=caster?event.sourceId:event.targetId??event.sourceId;
  const actor=battle.units.find(u=>u.id===id)??battle.enemies.find(e=>e.id===id)??battle.summons?.find(p=>p.id===id);if(!actor)return;
  const key=`${battle.levelId}:${battle.wave}:${id}:${numeric?event.type+(event.critical?'Crit':''):name}`;
  this.live=this.live.filter(p=>isValid(p.node,true)&&!!p.node.parent);
  // Sum nearby rapid hits on the same recipient; never discard their numeric value.
  const previous=numeric?this.live.find(p=>p.key===key&&event.tick-p.tick<=4&&event.tick>=p.tick):undefined;
  const format=(n:number)=>(event.critical?'暴击 ':'')+(event.type==='damage'?'-':'+')+n.toLocaleString();
  if(previous){previous.amount+=amount;previous.lastTick=event.tick;previous.label.string=format(previous.amount);return;}
  if(!numeric){if(battle.tick-(this.notices.get(key)??-100)<24)return;this.notices.set(key,battle.tick);}
  if(this.live.length>=28){const old=this.live.shift()!;if(isValid(old.node,true))old.node.destroy();}
  const size=screen.windowSize,scale=Math.min(size.width/1280,size.height/720);
  const projected=this.camera.worldToScreen(new Vec3(actor.x,2.05,actor.z));
  const x=(projected.x-size.width/2)/scale,y=(projected.y-size.height/2)/scale+(caster?15:0);
  const tint=event.critical?'#FF575F':event.type==='shield'?'#8DEAFF':event.type==='heal'?'#8FFFA5':numeric?'#FFF8DE':'#FFEBA3';
  const label=this.ui.text(numeric?format(amount):name!,x,y,event.critical?26:numeric?21:18,tint,this.ui.root,230,36,true);
  const outline=label.node.addComponent(LabelOutline);outline.width=2;outline.color=new Color(event.critical?'#702339':'#253847');
  const opacity=label.node.addComponent(UIOpacity),drift=caster?(x>0?-50:50):((event.id%3)-1)*9;
  this.live.push({node:label.node,label,amount,tick:event.tick,lastTick:event.tick,key,type:event.type});
  label.node.setScale(.86,.86,1);
  tween(label.node).to(.10,{scale:new Vec3(event.critical?1.16:1.06,event.critical?1.16:1.06,1)}).to(.14,{scale:new Vec3(1,1,1)}).start();
  tween(label.node).to(.78,{position:new Vec3(x+drift,y+(caster?56:42),0)}).call(()=>{if(isValid(label.node,true))label.node.destroy();}).start();
  tween(opacity).delay(.43).to(.35,{opacity:0}).start();
 }
}
