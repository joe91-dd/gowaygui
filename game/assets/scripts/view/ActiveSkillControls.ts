import {BattleHudMotion} from './BattleHudMotion';
import {Camera,Canvas,EventTouch,Graphics,Label,Node,UITransform,Vec3} from 'cc';
import {BattleCommand,BattleState,BattleUnit,canCommandBattle,commandAllSkills,commandBattle,legalSkillTargets,skillTargetMode,skillCastRange,focusBattle} from '../core/battle';
import {GameService} from '../core/game';
import {SKILL_BY_ID} from '../core/data';
import {SkillId} from '../core/types';
import {IslandUI,UI_COLORS,color} from './IslandUI';
/** One saved preference controls our skills in every mode; opponents retain their own AI. */
export class ActiveSkillControls {
  private aim?:{overlay:Node;unitId:string;skill:SkillId;hover:Graphics;point?:{x:number;z:number};targetId?:string;valid:boolean;done:()=>void};
  private focusDone?:()=>void;
  private items:{id:string;skill?:SkillId;label:Label;mask:Graphics;round?:boolean;motion?:BattleHudMotion}[]=[];
  constructor(private ui:IslandUI,private camera:Camera,private service:GameService,private command:(kind:string)=>string,
    private context:<T>(action:(battle:BattleState)=>T)=>T,private targeting:(value:boolean)=>void,private repaint:()=>void,private available:()=>boolean,private remote?:{focus?:(targetId?:string)=>boolean;cast:(command:BattleCommand)=>boolean;changed:()=>void;key:(unit:BattleUnit)=>string}){}
  dispose():void{const aim=this.aim;this.aim=undefined;this.focusDone?.();this.focusDone=undefined;if(aim){aim.overlay.destroy();this.targeting(false);}}
  private selectFocus():void{
    if(!this.available()||this.aim||this.focusDone)return;
    this.targeting(true);const overlay=this.ui.group('集火目标选择',0,0,this.ui.root,1280,720);
    let closed=false;const done=()=>{if(closed)return;closed=true;this.focusDone=undefined;overlay.destroy();this.targeting(false);};this.focusDone=done;
    this.ui.panel(0,290,650,42,overlay,UI_COLORS.dark,235,14);this.ui.text('点击敌人集火 · 队伍会优先攻击射程内的目标',0,290,21,UI_COLORS.cream,overlay,635,34);
    this.context(b=>{for(const enemy of b.enemies.filter(e=>e.alive))this.ring(overlay,enemy.x,enemy.z,.5);});
    overlay.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
    overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{if(e.target!==overlay)return;const p=e.getLocation(),ray=this.camera.screenPointToRay(p.x,p.y);if(Math.abs(ray.d.y)<.001)return;const t=(.15-ray.o.y)/ray.d.y,x=ray.o.x+ray.d.x*t,z=ray.o.z+ray.d.z*t;
      this.context(b=>{const enemy=b.enemies.filter(e=>e.alive&&Math.hypot(e.x-x,e.z-z)<1.15).sort((a,c)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(c.x-x,c.z-z))[0];if(!enemy){this.ui.toast('点击高亮的敌人，或取消');return;}const ok=this.remote?!!this.remote.focus?.(enemy.id):focusBattle(b,enemy.id);if(ok){done();this.ui.toast('已指定集火目标');this.repaint();}});
    });
    this.ui.button('取消',-95,-285,160,48,()=>{done();this.repaint();},{parent:overlay,size:23});
    this.ui.button('取消集火',95,-285,160,48,()=>{this.context(b=>this.remote?this.remote.focus?.():focusBattle(b));done();this.repaint();},{parent:overlay,size:23});
  }
  private key(u:BattleUnit):string{return this.remote?.key(u)??u.turtleId;}
  private cast(command:BattleCommand):boolean{return this.remote?this.remote.cast(command):this.context(b=>commandBattle(b,command));}
  render(roster:BattleUnit[],layout:'standard'|'battleDock'='standard'):void{
    if(layout==='battleDock'){this.renderBattleDock(roster);return;}
    const start=this.ui.root.children.length,count=Math.max(1,Math.min(5,roster.length)),width=140+count*112;this.items=[];this.ui.panel(616-width/2,-267,width,166,this.ui.root,UI_COLORS.dark,245,16);
    for(let i=0;i<count;i++){
      const u=roster[i],skill=u?.skills.find(id=>SKILL_BY_ID[id].active);
      const n=this.ui.button('',10+(i+5-count)*112,-274,104,108,()=>{if(u&&skill){if(this.isAutomatic(u))this.hold(u);else this.select(u.id,skill);}},{disabled:!u,size:20});
      n.name='主动技能栏:'+i;if(u&&skill)this.bindPress(n,u,skill);
      const displaySkill=u&&skill?(u.skills.find(id=>SKILL_BY_ID[id].requires===skill)??skill):skill;
      if(u&&displaySkill&&this.ui.art?.ready){this.ui.bookIcon(displaySkill,0,14,66,n);}else if(u)this.ui.portrait(u.role,-22,18,54,n);
      if(displaySkill&&displaySkill!==skill)this.ui.text('专',-34,33,16,UI_COLORS.gold,n,22,24);
      this.ui.text(String(i+1),29,32,22,UI_COLORS.sand,n,26,30);
      const mask=this.ui.group('技能冷却遮罩',0,0,n,104,108).addComponent(Graphics);
      const label=this.ui.text(skill?SKILL_BY_ID[skill].name:u?'未学主动':'空位',0,-39,18,UI_COLORS.cream,n,94,24);
      if(u){this.items.push({id:u.id,skill,label,mask});
        const held=this.service.settingsSnapshot.manualSkillTurtles?.includes(this.key(u))??false;
        this.ui.button(held?'手动保留':'跟随自动',10+(i+5-count)*112,-205,104,30,()=>{
          if(!this.available())return;const ids=new Set(this.service.settingsSnapshot.manualSkillTurtles??[]);if(ids.has(this.key(u)))ids.delete(this.key(u));else ids.add(this.key(u));
          const value=Array.from(ids);this.service.updateSettings(this.command('holdSkill'),{manualSkillTurtles:value});this.context(b=>{if(!this.remote)b.manualSkillTurtles=value;});this.remote?.changed();this.repaint();
        },{selected:held,size:16,disabled:!skill});
      }
    }
    if(!this.remote||this.remote.focus)this.ui.button('指定集火',-102,-274,104,108,()=>this.selectFocus(),{size:21});
    const auto=this.service.settingsSnapshot.autoSkills??false;
    const toggle=this.ui.button(`一键释放\n${auto?'已开启':'已关闭'}`,564,-274,88,108,()=>{
      if(!this.available())return;
      const value=!(this.service.settingsSnapshot.autoSkills??false);
      this.service.updateSettings(this.command('autoSkills'),{autoSkills:value});
      this.context(b=>{if(!this.remote)b.autoSkills=value;});this.remote?.changed();this.repaint();
    },{primary:auto,selected:auto,size:17});toggle.name='一键释放开关';if(this.ui.pinBattleFrom)this.ui.pinBattleFrom(start,.72,188,-103,'bottom',1);else this.ui.compactFrom(start,.72,188,-103);this.update();
  }
  private renderBattleDock(roster:BattleUnit[]):void{
    const count=Math.max(1,Math.min(5,roster.length));this.items=[];
    const auto=this.service.settingsSnapshot.autoSkills??false;
    for(let i=0;i<count;i++){
      const u=roster[i],skill=u?.skills.find(id=>SKILL_BY_ID[id].active),x=count===1?252:70+i*81;
      const n=this.ui.button('',x,-281,76,92,()=>{if(u&&skill){if(this.isAutomatic(u))this.hold(u);else this.select(u.id,skill);}},{surface:'bare',disabled:!u});
      n.name='战斗技能:'+i;if(u&&skill)this.bindPress(n,u,skill);
      const displaySkill=u&&skill?(u.skills.find(id=>SKILL_BY_ID[id].requires===skill)??skill):skill;
      if(displaySkill&&this.ui.art?.ready)this.ui.battleSkillIcon(displaySkill,0,12,64,n);else if(u)this.ui.portrait(u.role,0,12,62,n);
      const mask=this.ui.group('圆形技能冷却遮罩',0,12,n,64,64).addComponent(Graphics);
      const label=this.ui.text(skill?'':u?'未学主动':'空位',0,12,16,'#FFFFFF',n,64,26);
      if(u)this.items.push({id:u.id,skill,label,mask,round:true,motion:BattleHudMotion.on(this.ui.group('技能状态光',0,12,n),this.ui.reducedMotion)});
    }
    if(count===1&&(!this.remote||this.remote.focus))this.ui.button('指定集火',111,-280,106,57,()=>this.selectFocus(),{size:20});
    this.ui.button(auto?'自动施法':'手动施法',491,-259,119,38,()=>{
      if(!this.available())return;const value=!(this.service.settingsSnapshot.autoSkills??false);
      this.service.updateSettings(this.command('autoSkills'),{autoSkills:value});this.context(b=>{if(!this.remote)b.autoSkills=value;});this.remote?.changed();this.repaint();
    },{surface:'hud',size:19});
    this.ui.button('一键释放',491,-305,119,38,()=>{
      if(!this.available())return;let count=0;this.context(b=>{for(const u of roster){const skill=u.skills.find(id=>SKILL_BY_ID[id].active);if(!skill)continue;const cmd={type:'cast' as const,unitId:u.id,skillId:skill};if(canCommandBattle(b,cmd)&&this.cast(cmd))count++;}});if(!count)this.ui.toast('技能冷却中或暂无有效目标');
    },{surface:'hud',size:19});this.update();
  }
  update():void{
    this.context(b=>{
      if(!this.remote)b.manualSkillTurtles=[...(this.service.settingsSnapshot.manualSkillTurtles??[])];
      for(const item of this.items){
        const u=b.units.find(x=>x.id===item.id),s=item.skill,g=item.mask;g.clear();
        if(!u){item.label.string='等待上场';if(item.motion){item.motion.ready=false;item.motion.selected=false;}continue;}if(!s)continue;
        const left=Math.max(0,((u.cooldowns[s]??0)-b.tick)*.05),ready=canCommandBattle(b,{type:'cast',unitId:u.id,skillId:s});
        if(item.round){
          item.label.string=!u.alive?'倒下':left>0?left.toFixed(1):'';item.label.color=color('#FFFFFF');
          if(!u.alive||left>0){const fraction=!u.alive?1:Math.min(1,left/SKILL_BY_ID[s].cooldown!);g.fillColor=color('#092E4C',165);g.moveTo(0,0);g.lineTo(0,31);for(let j=0;j<=48;j++){const a=Math.PI/2+fraction*Math.PI*2*j/48;g.lineTo(Math.cos(a)*31,Math.sin(a)*31);}g.close();g.fill();}
          if(ready){g.strokeColor=color('#8DEBFF',200);g.lineWidth=2;g.circle(0,0,33);g.stroke();}
          if(item.motion){item.motion.radius=34;item.motion.ready=ready;item.motion.selected=this.aim?.unitId===u.id;}
          continue;
        }
        item.label.string=!u.alive?'已倒下':left>0?`${left.toFixed(1)}秒`:SKILL_BY_ID[s].name;item.label.color=color(this.ui.battleStyle?(ready?'#147B7E':'#5C6C70'):(ready?UI_COLORS.gold:UI_COLORS.sand));
        if(left>0){const h=106*Math.min(1,left/SKILL_BY_ID[s].cooldown!);g.fillColor=color('#0B1E2B',180);g.rect(-51,54-h,102,h);g.fill();}
        if(ready){g.strokeColor=color('#75DCDD');g.lineWidth=2;g.roundRect(-50,-52,100,104,16);g.stroke();}
        if(u.alive&&this.isAutomatic(u)){
          const per=408,pos=(b.tick*3)%per,point=(d:number)=>{d=(d+per)%per;return d<100?[-50+d,52]:d<204?[50,52-(d-100)]:d<304?[50-(d-204),-52]:[-50,-52+(d-304)];};
          for(let k=0;k<12;k++){const a=point(pos-k*5),c=point(pos-(k+1)*5);g.strokeColor=color('#17D1CE',245-k*15);g.lineWidth=4;g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.stroke();}
        }
      }
    });
  }
  private project(x:number,y:number,z:number):Vec3|undefined{
    let canvas:Canvas|null=null;for(let n:Node|null=this.ui.root;n&&!canvas;n=n.parent)canvas=n.getComponent(Canvas);
    const cam=canvas?.cameraComponent,transform=this.ui.root.getComponent(UITransform);if(!cam||!transform)return;
    const p=this.camera.worldToScreen(new Vec3(x,y,z));return transform.convertToNodeSpaceAR(cam.screenToWorld(new Vec3(p.x,p.y,0)));
  }
  private ring(parent:Node,x:number,z:number,radius:number):void{
    const g=this.ui.group('技能作用范围',0,0,parent).addComponent(Graphics);g.strokeColor=color('#73F0EB');g.fillColor=color('#53D9D0',30);g.lineWidth=3;
    for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,p=this.project(x+Math.cos(a)*radius,.2,z+Math.sin(a)*radius);if(!p)continue;if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.close();g.fill();g.stroke();
  }
  private isAutomatic(u:BattleUnit):boolean{return !!this.service.settingsSnapshot.autoSkills&&!this.service.settingsSnapshot.manualSkillTurtles?.includes(this.key(u));}
  private hold(u:BattleUnit):void{
    const ids=Array.from(new Set([...(this.service.settingsSnapshot.manualSkillTurtles??[]),u.turtleId]));this.service.updateSettings(this.command('holdSkill'),{manualSkillTurtles:ids});this.context(b=>{if(!this.remote)b.manualSkillTurtles=ids;});this.remote?.changed();this.repaint();this.ui.toast('已保留此技能，点击或长按手动释放');
  }
  private bindPress(n:Node,u:BattleUnit,skill:SkillId):void{
    let timer:ReturnType<typeof setTimeout>|undefined,holding=false,start:{x:number;y:number}|undefined;
    const cancelTimer=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
    n.off(Node.EventType.TOUCH_START);n.off(Node.EventType.TOUCH_END);n.off(Node.EventType.TOUCH_CANCEL);
    n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{start=e.getLocation();holding=false;cancelTimer();timer=setTimeout(()=>{if(!this.available()||!this.ui.isInteractive(n))return;holding=true;if(this.isAutomatic(u)){this.hold(u);return;}this.select(u.id,skill,true);},280);});
    n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!start||!this.available())return;const p=e.getLocation();if(!holding&&Math.hypot(p.x-start.x,p.y-start.y)>8){cancelTimer();holding=true;if(this.isAutomatic(u)){this.hold(u);return;}this.select(u.id,skill,true);}if(holding&&this.aim)this.aimAt(p.x,p.y);});
    const finish=(e:EventTouch)=>{cancelTimer();if(!this.available()||!start)return;start=undefined;if(holding){if(this.aim){const p=e.getLocation();this.aimAt(p.x,p.y);this.releaseAim();}}else if(this.isAutomatic(u))this.hold(u);else this.select(u.id,skill);holding=false;};
    n.on(Node.EventType.TOUCH_END,finish);n.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.getEventCode()===Node.EventType.TOUCH_END)finish(e);else{cancelTimer();start=undefined;this.aim?.done();}});n.once(Node.EventType.NODE_DESTROYED,cancelTimer);
  }
  private aimAt(x:number,y:number):void{
    const aim=this.aim;if(!aim)return;const ray=this.camera.screenPointToRay(x,y);if(Math.abs(ray.d.y)<.001)return;
    const t=(.15-ray.o.y)/ray.d.y,p={x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};aim.point=p;aim.targetId=undefined;aim.hover.clear();
    this.context(b=>{const u=b.units.find(x=>x.id===aim.unitId);if(!u)return;const mode=skillTargetMode(aim.skill),targets=legalSkillTargets(b,u,aim.skill);
      if(mode==='enemy'||mode==='team'){const target=targets.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<1).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];aim.targetId=target?.id;}
      aim.valid=mode==='enemy'||mode==='team'?!!aim.targetId&&canCommandBattle(b,{type:'cast',unitId:u.id,skillId:aim.skill,targetId:aim.targetId}):canCommandBattle(b,{type:'cast',unitId:u.id,skillId:aim.skill,...(mode==='area'?{point:p}:{})});
      const center=mode==='enemy'||mode==='team'?targets.find(e=>e.id===aim.targetId)??p:mode==='self'?u:p,g=aim.hover;
      g.strokeColor=color(aim.valid?'#61D790':'#DE947F');g.lineWidth=3;
      for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,r=mode==='area'?1.5:.48,q=this.project(center.x+Math.cos(a)*r,.18,center.z+Math.sin(a)*r);if(q){if(i===0)g.moveTo(q.x,q.y);else g.lineTo(q.x,q.y);}}g.stroke();
    });
  }
  private releaseAim():void{
    const aim=this.aim;if(!aim||!this.available())return;const mode=skillTargetMode(aim.skill);
    const accepted=aim.valid&&this.cast({type:'cast',unitId:aim.unitId,skillId:aim.skill,...(mode==='area'?{point:aim.point}:mode==='enemy'||mode==='team'?{targetId:aim.targetId}:{})});
    if(accepted)aim.done();else this.ui.toast('未选中合法目标，技能未消耗');
  }
  private select(unitId:string,skillId:SkillId,hold=false):void{
    if(!this.available()||this.aim)return;
    this.context(b=>{
      const u=b.units.find(x=>x.id===unitId);if(!u)return;
      if(!canCommandBattle(b,{type:'cast',unitId,skillId,...(skillId==='bubbleRing'?{point:{x:u.x,z:u.z}}:{})})){this.ui.toast(!u.alive?'伙伴已倒下':(u.cooldowns[skillId]??0)>b.tick?'技能正在冷却':'当前没有合法目标');return;}
      const mode=skillTargetMode(skillId);if(mode==='self'){if(this.cast({type:'cast',unitId,skillId}))this.repaint();return;}this.targeting(true);
      const overlay=this.ui.group('技能目标选择',0,0,this.ui.root,1280,720);overlay.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);this.ring(overlay,u.x,u.z,skillCastRange(b,u));
      const done=()=>{this.aim=undefined;overlay.destroy();this.targeting(false);if(this.available())this.repaint();};
      const hover=this.ui.group('技能瞄准落点',0,0,overlay).addComponent(Graphics);this.aim={overlay,unitId,skill:skillId,hover,valid:false,done};
      this.ui.panel(0,290,620,40,overlay,UI_COLORS.dark,235,14);this.ui.text(`${SKILL_BY_ID[skillId].name} · ${hold?'拖到目标后松开':'点击高亮目标释放'}`,0,290,21,UI_COLORS.ink,overlay,600,32);
      for(const target of legalSkillTargets(b,u,skillId))this.ring(overlay,target.x,target.z,.38);
      overlay.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=e.getLocation();this.aimAt(p.x,p.y);});
      overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{if(e.target!==overlay)return;const p=e.getLocation();this.aimAt(p.x,p.y);this.releaseAim();});
      this.ui.button('取消',0,-285,150,48,done,{parent:overlay,size:23});
    });
  }
}
