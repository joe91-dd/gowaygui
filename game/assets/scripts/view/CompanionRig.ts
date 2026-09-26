import {Material,SpriteFrame,Vec4} from 'cc';
import type {Role} from '../core/types';
import {HOME_RIG,BATTLE_RIG,ROLE_NUMBER,rigMotion,gestureEnvelope,combatGesture,V4,COMPANION_PADDING} from './CompanionRigData';

/** One original texture, continuously deformed; emitters use those same source coordinates. */
export class CompanionRig {
 private time=0;private gestureTime=0;private duration=2.8;private playing=true;private lastPose=0;private lastDiagnostic=-10;private casting=false;
 constructor(readonly material:Material,readonly role:Role,frame:SpriteFrame,private battle=false,private ownsMaterial=true,private staticPaint=false){
  const profile=(battle?BATTLE_RIG:HOME_RIG)[role],r=frame.rect,t=frame.texture;
  this.put('rigRect',[r.x/t.width,r.y/t.height,r.width/t.width,r.height/t.height]);
  this.put('rigShape',[r.width/r.height,COMPANION_PADDING,battle?.76:1,0]);
  for(const [key,value] of Object.entries(profile))this.put('rig'+key[0].toUpperCase()+key.slice(1),value as V4);
  this.duration=battle?1.2:2.8;this.update(0);
 }
 private put(key:string,v:V4):void{this.material.setProperty(key,new Vec4(...v));}
 respond():void{if(this.playing)return;this.gestureTime=0;this.playing=true;}
 pose(index:number):void{if(index>0&&this.lastPose===0){this.gestureTime=0;this.playing=true;this.casting=index>=4;this.duration=this.casting?.9:.48;}this.lastPose=index;}
 update(dt:number,reduced=false):void{
  dt=Math.max(0,Math.min(.1,dt));this.time+=dt;
  if(this.playing){this.gestureTime+=dt;if(this.gestureTime>=this.duration)this.playing=false;}
  if(!this.battle&&!this.playing&&this.gestureTime>(this.role==='stone'?10:8)){this.gestureTime=0;this.playing=true;}
  if(!this.playing)this.gestureTime+=dt;
  const response=reduced?0:this.playing?(this.battle?combatGesture(this.gestureTime,this.casting):gestureEnvelope(this.gestureTime,this.duration)):0,m=rigMotion(this.role,this.time,response,reduced,this.battle);
  this.put('rigBody',m.body);this.put('rigAngles',m.angles);this.put('rigParams',[this.time,ROLE_NUMBER[this.role],response,reduced?0:1]);
  for(const pass of this.material.passes)pass.update();
  if(typeof window!=='undefined'&&window.location.search==='?qa=1'&&this.time-this.lastDiagnostic>2){
   this.lastDiagnostic=this.time;console.info('[COMPANION_FRAME]',JSON.stringify({role:this.role,time:this.time,blink:m.angles[3],gesture:response,battle:this.battle}));
  }
 }
 destroy():void{if(this.ownsMaterial)this.material.destroy();}
}
