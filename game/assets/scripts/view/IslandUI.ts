import {GoldFlow} from './GoldFlow';
import {CompanionDisplay} from './CompanionDisplay';
import {MenuMotion} from './MenuMotion';
import {Color, Graphics, Mask, isValid, Label, Layers, Node, UITransform, Vec3, EventTouch, tween,screen as displayScreen,Canvas,EditBox} from 'cc';
import {IslandIcons, IslandIconId} from './IslandIcons';
import {IslandPanels} from './IslandPanels';
import type {TurtlePortraits} from './TurtlePortraits';
import type {Role,SkillId,Turtle} from '../core/types';
import type {ArtV2Assets,ArtV2Image,ArtV2Skin} from './ArtV2Assets';

import {turtleQuality} from '../core/prototypeConfig';
import {ROLES,SKILL_BY_ID,skillCategory} from '../core/data';
import {poseRow} from './BattlePoseData';
import {hudPlacementIssue,HudRect} from '../core/hudPlacement';
export const UI_COLORS={ink:'#153B55',cream:'#153B55',sand:'#527889',gold:'#007F97',edge:'#BDDADF',green:'#00AABB',dark:'#FFF9EC',muted:'#76939A',red:'#C95243'};
export const color=(hex:string,alpha=255):Color=>{const c=new Color();Color.fromHEX(c,hex);c.a=alpha;return c;};
export class IslandUI {
  reducedMotion:()=>boolean=()=>false;
  // Only secondary-page trees receive the approved pearl skin. Home stays untouched.
  private pearlSurfaces=new WeakSet<Node>();
  secondaryPage(parent:Node):void{this.pearlSurfaces.add(parent);}
  private pearlSurface(parent:Node):boolean{for(let n:Node|null=parent;n;n=n.parent)if(this.pearlSurfaces.has(n))return true;return false;}
  feedback?:(kind:'reward'|'purchase'|'upgrade'|'equip'|'chest'|'learnComplete'|'error'|'wishStart'|'wishGather'|'wishBurst')=>void;
  requestReward?:(kind:import('../core/types').AdKind|'supplies',context?:string,done?:()=>void)=>void;
  share?:(title?:string,text?:string)=>void;
  private static inputIndex=100;
  /** Align native web inputs with the actual camera projection, including letterboxed phones. */
  anchorInput(edit:EditBox):void{
    const box=edit.node.getComponent(UITransform);if(box)for(const label of [edit.textLabel,edit.placeholderLabel])if(label){const t=label.node.getComponent(UITransform)!;t.setAnchorPoint(0,1);t.setContentSize(box.width-12,box.height);label.node.setPosition(-box.width/2+12,box.height/2,0);label.horizontalAlign=Label.HorizontalAlign.LEFT;label.verticalAlign=Label.VerticalAlign.CENTER;}
    if(typeof document==='undefined')return;
    edit.tabIndex=++IslandUI.inputIndex;let observer:MutationObserver|undefined;
    edit.node.on('editing-did-began',()=>{
      let ancestor:Node|null=this.root;while(ancestor&&!ancestor.getComponent(Canvas))ancestor=ancestor.parent;
      const element=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[tabindex="${edit.tabIndex}"]`),canvas=document.querySelector<HTMLCanvasElement>('canvas'),camera=ancestor?.getComponent(Canvas)?.cameraComponent,t=edit.node.getComponent(UITransform);
      if(!element||!canvas||!camera||!t)return;
      const align=()=>{if(!edit.node.isValid)return;const rect=canvas.getBoundingClientRect(),a=camera.worldToScreen(t.convertToWorldSpaceAR(new Vec3(-t.width/2,-t.height/2,0))),b=camera.worldToScreen(t.convertToWorldSpaceAR(new Vec3(t.width/2,t.height/2,0))),sx=rect.width/canvas.width,sy=rect.height/canvas.height;
        const style:Record<string,string>={position:'fixed',left:(rect.left+a.x*sx)+'px',top:(rect.bottom-b.y*sy)+'px',bottom:'auto',width:((b.x-a.x)*sx)+'px',height:((b.y-a.y)*sy)+'px',transform:'none','transform-origin':'0 0','font-size':Math.max(12,(edit.textLabel?.fontSize??22)*(b.y-a.y)*sy/t.height)+'px','overflow':'hidden','z-index':'100'};
        if(edit.inputFlag===EditBox.InputFlag.PASSWORD)style['-webkit-text-security']='disc';
        for(const [key,value]of Object.entries(style))if(element.style.getPropertyValue(key)!==value)element.style.setProperty(key,value,'important');
      };align();observer?.disconnect();observer=new MutationObserver(align);observer.observe(element,{attributes:true,attributeFilter:['style']});
    });
    const stop=()=>{observer?.disconnect();observer=undefined;};edit.node.on('editing-did-ended',stop);edit.node.once(Node.EventType.NODE_DESTROYED,stop);
  }
  onActionError?:(error:unknown)=>void;
  battleFrameLocked=false;
  private battleAnchors:{node:Node;x:number;y:number;edge:'top'|'bottom';side:number}[]=[];
  pinBattleFrom(index:number,scale:number,x:number,y:number,edge:'top'|'bottom',side=0):void{
    if(!this.art?.ready)return;
    const nodes=this.root.children.slice(index),group=this.group(`战斗贴边:${edge}`,x,y);
    nodes.forEach(n=>n.setParent(group));group.setScale(scale,scale,1);
    this.battleAnchors=this.battleAnchors.filter(a=>isValid(a.node,true));
    this.battleAnchors.push({node:group,x,y,edge,side});this.layoutBattleEdges();
  }
  layoutBattleEdges():void{
    const size=displayScreen?.windowSize;if(!size?.width||!size.height)return;
    // Landscape HUD follows the physical viewport, including non-16:9 phones.
    const scale=Math.min(size.width/1280,size.height/720),landscape=size.width>=size.height;
    const dx=landscape&&!this.battleFrameLocked?Math.max(0,(size.width/scale-1280)/2):0,dy=landscape&&!this.battleFrameLocked?Math.max(0,(size.height/scale-720)/2):0;
    this.battleAnchors=this.battleAnchors.filter(a=>isValid(a.node,true));
    for(const a of this.battleAnchors)a.node.setPosition(a.x+dx*a.side,a.y+(a.edge==='top'?dy:-dy),0);
  }
  battleLandingIssue(feet:{x:number;y:number},head:{x:number;y:number}):string|undefined{
    if(!this.art?.ready)return;
    const root=this.root.getComponent(UITransform)!;
    // Reserve the combat skill tray even when it is folded during deployment.
    const size=displayScreen?.windowSize,scale=size?Math.min(size.width/1280,size.height/720):1,dx=size&&size.width>=size.height&&!this.battleFrameLocked?Math.max(0,(size.width/scale-1280)/2):0;
    const rects:HudRect[]=[{left:164+dx,right:640+dx,bottom:-360,top:-255},{left:-640-dx,right:640+dx,bottom:301,top:360}];
    for(const a of this.battleAnchors.filter(a=>isValid(a.node,true)&&a.node.activeInHierarchy))for(const n of a.node.children){
      const t=n.getComponent(UITransform);if(!t||!n.activeInHierarchy||t.width<1||t.height<1)continue;
      const l=root.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new Vec3(-t.width*t.anchorX,-t.height*t.anchorY,0)));
      const r=root.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new Vec3(t.width*(1-t.anchorX),t.height*(1-t.anchorY),0)));
      rects.push({left:Math.min(l.x,r.x),right:Math.max(l.x,r.x),bottom:Math.min(l.y,r.y),top:Math.max(l.y,r.y)});
    }
    return hudPlacementIssue(feet,head,rects);
  }
  constructor(readonly root:Node,readonly click:(kind?:'back')=>void=()=>{},private readonly icons?:IslandIcons,private readonly panels?:IslandPanels,private readonly portraits?:TurtlePortraits,readonly art?:ArtV2Assets){}
  clear():void{for(const child of [...this.root.children]){child.removeFromParent();child.destroy();}}
  group(name:string,x=0,y=0,parent=this.root,w=0,h=0):Node{
    const n=new Node(name);n.layer=Layers.Enum.UI_2D;n.setParent(parent);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);return n;
  }
  label(text:string,x:number,y:number,size=24,hex=UI_COLORS.cream,parent=this.root,width=400,height=48):Label{
    const n=this.group('文字:'+text.slice(0,18),x,y,parent,width,height),l=n.addComponent(Label);
    l.string=text;l.fontSize=size;l.lineHeight=Math.round(size*1.35);l.color=color(hex);l.fontFamily='Microsoft YaHei';l.isBold=size>=24;
    l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;l.enableWrapText=true;return l;
  }
  /** Explicit phone typography. Layout must provide room instead of shrinking key information. */
  text(text:string,x:number,y:number,size=30,hex=UI_COLORS.cream,parent=this.root,width=400,height=44,wrap=false):Label{
    const label=this.label(text,x,y,size,hex,parent,width,height);
    label.overflow=Label.Overflow.CLAMP;label.enableWrapText=wrap;label.lineHeight=Math.ceil(size*1.2);label.isBold=size>=22;
    return label;
  }
  portrait(role:Role,x:number,y:number,side=104,parent=this.root,fullBody=false,_advanced=false):Node{if(fullBody&&this.art?.ready){const n=this.group('龟龟全身:'+role,x,y,parent,side,side),height=side*(role==='stone'?1:.89),sprite=this.art.attach(n,`hero-${role}` as any,side,height);if(sprite)n.addComponent(CompanionDisplay).setup(sprite,role,n,this.art,this.reducedMotion);return n;}return this.roleMark(role,x,y,side/2,parent);}
  private clip(n:Node,side:number,radius:number):void{
    const mask=n.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_STENCIL;
    const g=mask.subComp as Graphics;g.clear();g.roundRect(-side/2,-side/2,side,side,radius);g.fill();
  }
  pet(t:Turtle,x:number,y:number,side=104,parent=this.root):Node{
    const n=this.group('伙伴头像:'+t.id,x,y,parent,side,side),inside=this.group('头像裁切',0,0,n,side-4,side-4);
    this.clip(inside,side-4,Math.min(16,side*.16));this.art?.attach(inside,`portrait-${t.role}` as any,side-4,side-4);
    if(!this.art?.ready)this.roleMark(t.role,0,0,(side-4)/2,inside);
    const g=n.addComponent(Graphics);g.lineWidth=2;g.strokeColor=color(turtleQuality(t).color);g.roundRect(-side/2,-side/2,side,side,Math.min(17,side*.17));g.stroke();if(turtleQuality(t).tier===6){const glow=this.group('完美品质流光',0,0,n);glow.addComponent(GoldFlow).side=side;}return n;
  }
  fusionCard(t:Turtle,parent:Node):void{
    const card=this.panel(0,-30,410,264,parent,'#FFF9EC',255,18);card.name='泡泡内完整伙伴卡';
    this.portrait(t.role,-122,-1,176,card,true,t.skills.length>=10);this.text(t.name||ROLES[t.role].name,78,103,24,UI_COLORS.ink,card,240,34);
    (['attack','health','defense','growth'] as const).forEach((key,i)=>{const tick=Math.max(0,Math.min(50,t.innate[key]+t.training[key]-(key==='growth'?60:50))),full=Math.floor(tick/10),line=['攻击','生命','防御','成长'][i]+' '+'★'.repeat(full)+'☆'.repeat(5-full);this.text(line,83,65-i*28,18,UI_COLORS.ink,card,226,27);});
    t.skills.forEach((id,i)=>this.bookIcon(id,-5+i%6*35,-59-Math.floor(i/6)*35,31,card));this.text(turtleQuality(t).name,-122,-106,19,turtleQuality(t).color,card,142,30);
  }
  battleFigure(role:Role,x:number,y:number,side:number,parent=this.root):Node{
    const n=this.group('完整战斗角色:'+role,x,y,parent,side,side),pose=poseRow(role);
    if(pose&&this.art?.ready){const key=`pose-${pose.atlas}-${pose.row}-0`,f=this.art.battleFrame(key)!;this.art.attach(n,key as any,side*f.rect.width/f.rect.height,side);}else this.portrait(role,0,0,side,n,true);return n;
  }
  bookIcon(id:SkillId,x:number,y:number,side:number,parent=this.root):Node{
    const n=this.group('技能图标:'+id,x,y,parent,side,side);this.clip(n,side,side*.19);
    if(!this.art?.attach(n,`book-${id}`,side,side))this.icon('growth-history',0,0,side,n);const skill=SKILL_BY_ID[id];const g=this.group('技能品质边框',0,0,n).addComponent(Graphics);g.lineWidth=2;g.strokeColor=color(skill.active||skill.specialization?'#C99C38':skill.precious?'#D95252':'#E0C449');g.roundRect(-side/2+1,-side/2+1,side-2,side-2,side*.18);g.stroke();if(skill.active||skill.specialization){const glow=this.group('职业主动金色流光',0,0,n);glow.addComponent(GoldFlow).side=side;}return n;
  }
  /** The reference battle dock uses round spell medallions, never book frames. */
  battleSkillIcon(id:SkillId,x:number,y:number,side:number,parent=this.root):Node{
    const n=this.group('战斗圆形技能:'+id,x,y,parent,side,side),g=n.addComponent(Graphics);
    g.fillColor=color('#00AEE5',25);g.circle(0,0,side/2+5);g.fill();
    g.fillColor=color('#FFFFFF');g.circle(0,0,side/2+2);g.fill();
    const inside=this.group('圆形技能裁切',0,0,n,side,side);this.clip(inside,side,side/2);
    this.art?.attach(inside,`book-${id}`,side*1.1,side*1.1);
    const ring=this.group('技能银边',0,0,n).addComponent(Graphics);ring.strokeColor=color('#64A6BB');ring.lineWidth=1.5;ring.circle(0,0,side/2);ring.stroke();return n;
  }
  hudSymbol(index:number,x:number,y:number,side:number,parent=this.root):Node{
    const n=this.group('HUD标记:'+index,x,y,parent,side,side);this.art?.attach(n,`hud-symbol-${index}` as any,side,side);return n;
  }
  battlePortrait(t:Turtle,parent:Node):void{
    const n=this.group('战斗头像裁切',0,19,parent,78,64),mask=n.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_STENCIL;
    const g=mask.subComp as Graphics;g.clear();g.roundRect(-39,-32,78,64,4);g.fill();
    this.art?.attach(n,`portrait-${t.role}` as any,78,78);
  }
  skillTile(id:SkillId,x:number,y:number,parent:Node,side=82,width=174):Node{
    const skill=SKILL_BY_ID[id],n=this.button('',x,y,width,120,()=>this.skillDetail(id),{parent});
    this.bookIcon(id,0,12,side,n);this.text(skill.name,0,-44,21,UI_COLORS.ink,n,width-12,30);return n;
  }
  skillDetail(id:SkillId):void{
    const skill=SKILL_BY_ID[id],p=this.dialog(skill.name,skillCategory(skill),()=>p.parent?.destroy(),760,390);
    this.bookIcon(id,-238,-10,132,p);this.text(skill.description,86,-12,23,UI_COLORS.ink,p,458,188,true);
  }
  dialog(title:string,subtitle='',close?:()=>void,width=760,height=440):Node{
    const veil=this.group('紧凑弹窗遮罩',0,0,this.root,1280,720),g=veil.addComponent(Graphics);g.fillColor=color('#102F43',145);g.rect(-640,-360,1280,720);g.fill();veil.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
    this.secondaryPage(veil);
    const p=this.panel(0,0,width,height,veil,UI_COLORS.dark,252,22);this.text(title,-30,height/2-44,30,UI_COLORS.ink,p,width-140,42);
    if(subtitle)this.text(subtitle,0,height/2-88,20,UI_COLORS.sand,p,width-60,34,true);
    if(close)this.button('×',width/2-38,height/2-35,48,48,close,{parent:p,size:28,sound:'back'});
    p.setScale(.975,.975,1);tween(p).to(.14,{scale:new Vec3(1,1,1)},{easing:'quadOut'}).start();return p;
  }
  /** Six large cards fit the 1280×720 view; the whole visible card is the target. */
  card(role:Role,title:string,middle:string,bottom:string,x:number,y:number,action:()=>void,options:{parent?:Node;selected?:boolean;disabled?:boolean;turtle?:Turtle}={}):Node{
    const node=this.button('',x,y,360,176,action,{...options,selected:false});
    if(options.selected){const g=node.addComponent(Graphics);g.strokeColor=color('#00A9B6');g.lineWidth=3;g.roundRect(-179,-87,358,174,16);g.stroke();this.text('✓',156,62,22,'#008E9B',node,28,30);}
    if(options.turtle)this.pet(options.turtle,-114,4,104,node);else this.portrait(role,-114,4,104,node);
    const chars=Array.from(title),name=chars.length>6?chars.slice(0,5).join('')+'…':title;
    this.text(name,58,48,32,UI_COLORS.cream,node,192,40);
    this.text(middle,58,4,28,UI_COLORS.sand,node,192,36);
    this.text(bottom,58,-48,28,UI_COLORS.sand,node,192,36);
    return node;
  }
  sheet(title:string,subtitle='',close?:()=>void,closeText='返回'):Node{
    const veil=this.group('页面遮罩',0,0,this.root,1280,720),graphics=veil.addComponent(Graphics);
    this.pearlSurfaces.add(veil);
    if(this.art?.ready){const scenery=this.group('页面海岛背景',0,0,veil,1280,720);this.art.attach(scenery,'home-background',1280,720);this.atmosphere(scenery);}
    graphics.fillColor=color('#143C50',this.art?.ready?12:150);graphics.rect(-640,-360,1280,720);graphics.fill();
    veil.on(Node.EventType.TOUCH_START,(event:EventTouch)=>event.propagationStopped=true);
    const panel=this.panel(0,0,1200,660,veil,UI_COLORS.dark,235,22);
    if(this.art?.ready){this.decoration('decor-title',-Math.min(330,title.length*17)-61,284,94,36,panel);this.line(-548,248,548,248,panel);}
    this.text(title,0,284,34,UI_COLORS.cream,panel,816,56);
    if(subtitle)this.text(subtitle,0,230,19,UI_COLORS.sand,panel,900,40);
    if(close)this.button(closeText,504,284,144,54,close,{parent:panel,size:30,sound:'back'});
    return panel;
  }
  scenicCard(image:ArtV2Image,x:number,y:number,w:number,h:number,title:string,caption:string,action:()=>void,parent=this.root,disabled=false):Node{
    const n=this.button('',x,y,w,h,action,{parent,disabled});
    const picture=this.group('海域插画',0,0,n,w-4,h-4);this.art?.attach(picture,image,w-4,h-4);
    this.panel(0,-h/2+43,w-4,82,n,'#123D4D',230,0);
    this.text(title,-2,-h/2+58,27,'#FFF7E5',n,w-34,40);
    this.text(caption,-2,-h/2+22,18,'#B9E2DB',n,w-30,28);
    if(disabled){const cover=this.panel(0,0,w,h,n,'#112F3A',128,12);this.text('未解锁',0,33,24,'#FFFFFF',cover,w-40,40);}
    return n;
  }
  sceneSheet(title:string,close?:()=>void,background:ArtV2Image='home-background'):Node{
    if(!this.art?.ready)return this.sheet(title,'',close);
    const scene=this.group('场景页面:'+title,0,0,this.root,1280,720);this.pearlSurfaces.add(scene);this.art.attach(scene,background,1280,720);this.atmosphere(scene);
    scene.on(Node.EventType.TOUCH_START,(event:EventTouch)=>event.propagationStopped=true);
    const p=this.group('页面内容',0,0,scene,1200,660);this.panel(0,285,1176,68,p,UI_COLORS.dark,223,22);
    this.decoration('decor-title',-Math.min(330,title.length*17)-61,284,94,36,p);this.text(title,0,284,35,UI_COLORS.cream,p,680,50);if(close)this.button('返回',504,284,144,52,close,{parent:p,size:28,sound:'back'});return p;
  }
  decoration(key:string,x:number,y:number,w:number,h:number,parent=this.root):Node{const n=this.group('界面装饰:'+key,x,y,parent,w,h);this.art?.attach(n,key as any,w,h);return n;}
  atmosphere(parent:Node,mode:'ambient'|'wish'|'fusion'='ambient',x=0,y=0,w=1120,h=490):Node{const n=this.group('海岛光尘:'+mode,x,y,parent,w,h),motion=n.addComponent(MenuMotion);motion.mode=mode;motion.width=w;motion.height=h;motion.reduced=this.reducedMotion;return n;}
  panel(x:number,y:number,w:number,h:number,parent=this.root,hex=UI_COLORS.dark,opacity=244,radius=24):Node{
    const n=this.group('海岛面板',x,y,parent,w,h);
    if(this.art?.ready){
      const neutral=['#47645C','#725132','#395551','#395750','#436F79','#123A54','#FFF4DD'].includes(hex);
      if(neutral)hex=UI_COLORS.dark;
      const isTeal=hex===UI_COLORS.gold||hex===UI_COLORS.green,isPaper=hex===UI_COLORS.dark||['#FFF9EC','#FFF4DD','#E9F3F0','#F1F4EC','#F6F5E9','#F0F6F3'].includes(hex),isSelected=hex==='#DDF8F0',isDisabled=hex==='#D8E0DD';
      if(this.pearlSurface(parent)&&w>=94&&h>=38&&radius>=10&&(isTeal||isPaper||isSelected||isDisabled)){
        const key=isTeal?'pearl-primary':isSelected?'pearl-selected':isDisabled?'pearl-disabled':h>105?'pearl-panel':'pearl-secondary';
        this.art.attach(n,key,w,h,color(isTeal?'#DCF8FF':'#FFFFFF',opacity));return n;
      }
      const g=n.addComponent(Graphics),r=Math.min(radius,w/2,h/2);
      g.fillColor=color('#124758',25);g.roundRect(-w/2+1,-h/2-3,w,h,r);g.fill();
      g.fillColor=color(hex,opacity);g.roundRect(-w/2,-h/2,w,h,r);g.fill();
      if(hex===UI_COLORS.gold||hex===UI_COLORS.green){
        // A quiet cyan highlight matches the approved home controls; no ornate frame.
        for(let band=0;band<24;band++){
          const y=-h/2+band*h/24,top=y+h/24,t=(band+.5)/24;
          const edgeY=Math.max(Math.abs(y),Math.abs(top)),corner=Math.max(0,edgeY-(h/2-r));
          const inset=corner>0?r-Math.sqrt(Math.max(0,r*r-corner*corner)):0;
          g.fillColor=new Color(0,Math.round(123+65*t),Math.round(145+58*t),opacity);
          g.rect(-w/2+inset,y,w-2*inset,h/24+.3);g.fill();
        }
        g.lineWidth=3;g.strokeColor=color('#50E7E8',80);g.roundRect(-w/2-2,-h/2-2,w+4,h+4,r+2);g.stroke();
        g.lineWidth=1.5;g.strokeColor=color('#E7FFFF',240);g.roundRect(-w/2+2,-h/2+2,w-4,h-4,Math.max(0,r-2));g.stroke();
      }
      g.lineWidth=1.5;g.strokeColor=color(hex===UI_COLORS.gold||hex===UI_COLORS.green?'#92F4F2':'#C7DDDC',230);g.roundRect(-w/2,-h/2,w,h,r);g.stroke();
      return n;
    }
    if(this.panels?.supports(radius,w,h)){this.panels.attach(n,w,h,radius,color(hex,opacity));return n;}
    const g=n.addComponent(Graphics);
    g.fillColor=color('#132D30',90);g.roundRect(-w/2+3,-h/2-5,w,h,radius);g.fill();
    g.fillColor=color(hex,opacity);g.roundRect(-w/2,-h/2,w,h,radius);g.fill();
    g.strokeColor=color(UI_COLORS.edge);g.lineWidth=2;g.roundRect(-w/2,-h/2,w,h,radius);g.stroke();
    g.strokeColor=color(UI_COLORS.cream,65);g.lineWidth=1;g.roundRect(-w/2+5,-h/2+5,w-10,h-10,Math.max(2,radius-5));g.stroke();return n;
  }
  modernIcon(index:number,x:number,y:number,size=52,parent=this.root,tint=Color.WHITE):Node{const n=this.group('功能图标:'+index,x,y,parent,size,size);this.art?.attach(n,`modern-${index}`,size,size,tint);return n;}
  icon(id:IslandIconId,x:number,y:number,size=48,parent=this.root):Node{
    const n=this.group('海岛图标:'+id,x,y,parent,size,size);this.icons?.attach(n,id);return n;
  }
  /** Ignore late touches from retired pages, including deferred Cocos destruction. */
  isInteractive(node:Node):boolean{
    for(let current:Node|null=node;current;current=current.parent){
      if(!isValid(current,true)||!current.active)return false;
      if(current===this.root)return true;
    }
    return false;
  }
  button(text:string,x:number,y:number,w:number,h:number,action:()=>void,options:{primary?:boolean;disabled?:boolean;parent?:Node;size?:number;selected?:boolean;icon?:IslandIconId;iconSize?:number;surface?:'paper'|'wood'|'bare'|'hud';sound?:'back'}={}):Node{
    const {primary=false,disabled=false,parent=this.root,selected=false}=options;
    // Slim action buttons, while keeping large portrait and mode cards intact.
    if(this.art?.ready && text && h>=68 && h<=96&&options.surface!=='hud'&&options.surface!=='bare')h=54;
    const n=options.surface==='bare'?this.group('HUD点击区',x,y,parent,w,h):this.panel(x,y,w,h,parent,options.surface==='hud'?'#F7FCFC':disabled?'#D8E0DD':primary?UI_COLORS.gold:selected?'#DDF8F0':options.surface==='paper'?'#FFF4DD':options.surface==='wood'?'#725132':'#47645C',255,options.surface==='hud'?8:Math.min(14,h/2));
    if(selected&&!primary&&!this.pearlSurface(parent)){const border=this.group('选中描边',0,0,n,w,h),g=border.addComponent(Graphics);g.lineWidth=2.5;g.strokeColor=color('#00A4B2');g.roundRect(-w/2+1,-h/2+1,w-2,h-2,Math.min(13,h/2));g.stroke();}
    n.name='按钮:'+text;
    const iconSize=options.icon?Math.min(options.iconSize??48,h-10):0;
    if(options.icon)this.icon(options.icon,-w/2+12+iconSize/2,1,iconSize,n);
    const font=options.size??(h>=88?30:22),hex=disabled?'#748B91':primary?'#FFFFFF':UI_COLORS.ink;
    const textX=iconSize?(iconSize+8)/2:0,textWidth=iconSize?w-24-iconSize-8:w-18;
    if(h>=88)this.text(text,textX,1,font,hex,n,textWidth,h-10,true);
    else this.label(text,textX,1,font,hex,n,textWidth,h-10);
    if(options.surface==='hud'){const label=n.getComponentInChildren(Label);if(label){label.isBold=true;label.color=color('#07385E');}}
    if(!disabled){
      let touchStart:{x:number;y:number}|undefined,moved=false;
      IslandUI.prototype.hover.call(this,n);
      n.on(Node.EventType.TOUCH_START,(e?:EventTouch)=>{touchStart=e?.getLocation?.();moved=false;if(!this.isInteractive(n))return;tween(n).stop();n.setScale(.97,.97,1);});
      n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=e.getLocation();if(touchStart&&Math.hypot(p.x-touchStart.x,p.y-touchStart.y)>9)moved=true;});
      n.on(Node.EventType.TOUCH_CANCEL,()=>{touchStart=undefined;moved=true;if(this.isInteractive(n))n.setScale(1,1,1);});
      n.on(Node.EventType.TOUCH_END,(e?:EventTouch)=>{if(!this.isInteractive(n))return;n.setScale(1,1,1);touchStart=undefined;if(moved)return;if(e)e.propagationStopped=true;this.click(options.sound);try{action();}catch(error){if(this.onActionError)this.onActionError(error);else throw error;}});
    }
    return n;
  }
  compactFrom(index:number,scale:number,x=0,y=0):void{
    if(!this.art?.ready)return;const nodes=this.root.children.slice(index),group=this.group('紧凑功能栏',x,y);
    nodes.forEach(n=>n.setParent(group));group.setScale(scale,scale,1);
  }
  hover(n:Node):void{
    n.on(Node.EventType.MOUSE_ENTER,()=>{if(this.isInteractive(n))n.setScale(1.035,1.035,1);});
    n.on(Node.EventType.MOUSE_LEAVE,()=>{if(this.isInteractive(n))n.setScale(1,1,1);});
  }
  line(x1:number,y1:number,x2:number,y2:number,parent=this.root,hex=UI_COLORS.edge):void{
    const n=this.group('分隔线',0,0,parent),g=n.addComponent(Graphics);g.strokeColor=color(hex,120);g.lineWidth=1;g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  }
  progress(x:number,y:number,w:number,h:number,value:number,hex=UI_COLORS.gold,parent=this.root):Node{
    const n=this.group('进度',x,y,parent,w,h),g=n.addComponent(Graphics);g.fillColor=color('#DCE3DF');g.roundRect(-w/2,-h/2,w,h,h/2);g.fill();
    const width=Math.max(h,Math.min(1,Math.max(0,value))*w);
    if(value>0){g.fillColor=color(hex);g.roundRect(-w/2,-h/2,width,h,h/2);g.fill();}return n;
  }
  modal(title:string,subtitle=''):Node{
    const veil=this.group('弹窗遮罩',0,0,this.root,1280,720),g=veil.addComponent(Graphics);
    g.fillColor=color('#10292C',180);g.rect(-640,-360,1280,720);g.fill();veil.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
    const p=this.panel(0,0,1060,596,veil);this.label(title,0,246,32,UI_COLORS.cream,p,920,56);
    if(subtitle)this.label(subtitle,0,200,18,UI_COLORS.sand,p,920,44);return p;
  }
  toast(message:string):void{
    const n=this.panel(0,156,Math.min(620,Math.max(240,message.length*22)),52,this.root,'#07536C',244,24);n.name='简短操作提示';
    this.text(message,0,0,22,'#FFFFFF',n,580,38);tween(n).delay(1.8).call(()=>n.destroy()).start();
  }
  skillPill(name:string,x:number,y:number,parent:Node,active=false,width=144,description?:string):void{
    const p=this.panel(x,y,width,34,parent,active?'#436F79':'#395551',255,10);this.label(name,0,0,16,active?'#007D93':UI_COLORS.cream,p,width-8,30);
    if(description)p.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{
      event.propagationStopped=true;this.click();const detail=this.modal(name,active?'主动技能':'被动技能');
      this.label(description,0,24,28,UI_COLORS.cream,detail,850,150);
      this.button('知道了',0,-190,246,56,()=>detail.parent?.destroy(),{parent:detail,primary:true,size:23});
    });
  }
  roleMark(role:Role,x:number,y:number,size=32,parent=this.root):Node{
    if(this.art?.ready){if(size>64&&this.pearlSurface(parent))return this.portrait(role,x,y,size*2,parent,true);const n=this.group('龟龟立绘:'+role,x,y,parent,size*2,size*2);this.art.attach(n,size<=64?`portrait-${role}`:`hero-${role}`,size*2,size*2);return n;}
    if(this.portraits){
      if(!this.portraits.ready)throw new Error('龟龟头像尚未准备好');
      const portrait=this.group('龟龟头像:'+role,x,y,parent,size*2,size*2);
      this.portraits.attach(portrait,role);return portrait;
    }
    const n=this.group('职业图案',x,y,parent,size*2,size*2),g=n.addComponent(Graphics);
    const colors:Record<string,string>={stone:'#9EAA94',spike:'#F2BC58',crystal:'#67D4EF',leaf:'#ACD477',bubble:'#9EDDE9'};
    g.fillColor=color(colors[role]||UI_COLORS.gold);g.strokeColor=color(UI_COLORS.cream);g.lineWidth=2;
    if(role==='crystal'){g.moveTo(0,size);g.lineTo(size*.65,0);g.lineTo(0,-size);g.lineTo(-size*.65,0);g.close();g.fill();g.stroke();}
    else if(role==='spike'){
      for(let i=0;i<10;i++){const r=i%2?size*.48:size,a=Math.PI/2+i*Math.PI/5;if(i===0)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.close();g.fill();g.stroke();
    }else if(role==='leaf'){g.ellipse(0,0,size*.6,size);g.fill();g.moveTo(0,-size*.8);g.lineTo(0,size*.8);g.stroke();}
    else if(role==='bubble'){g.circle(0,0,size*.8);g.stroke();g.circle(-size*.22,size*.22,size*.27);g.fill();g.circle(size*.62,size*.76,size*.19);g.fill();}
    else{for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;if(i===0)g.moveTo(Math.cos(a)*size,Math.sin(a)*size);else g.lineTo(Math.cos(a)*size,Math.sin(a)*size);}g.close();g.fill();g.stroke();}
    return n;
  }
}
