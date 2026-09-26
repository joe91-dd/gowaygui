const fs=require('node:fs');
const root='game/assets/scripts/';
function edit(file,fn){const p=root+file,s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,fn(s));}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing anchor: '+a.slice(0,100));return s.replace(a,b);}
edit('view/ArtV2Assets.ts',s=>s.replaceAll("'home-environment'","'home-environment-full'"));
edit('view/IslandUI.ts',s=>{
 s=replace(s,"    const {primary=false,disabled=false,parent=this.root,selected=false}=options;","    const {primary=false,disabled=false,parent=this.root,selected=false}=options;\n    // Slim action buttons, while keeping large portrait and mode cards intact.\n    if(text && h>=68 && h<=96)h=60;");
 s=replace(s,"    if(!disabled){","    if(!disabled){\n      this.hover(n);");
 s=replace(s,"  line(x1:number",`  hover(n:Node):void{
    n.on(Node.EventType.MOUSE_ENTER,()=>{if(this.isInteractive(n))n.setScale(1.035,1.035,1);});
    n.on(Node.EventType.MOUSE_LEAVE,()=>{if(this.isInteractive(n))n.setScale(1,1,1);});
  }
  line(x1:number`);return s;
});
edit('view/GameEntry.ts',s=>{
 s="import {avatarPicker,paintAvatar} from './ProfileAvatar';\n"+s;
 s=replace(s,"    circlePortrait('crystal',-578,312,64);",`    const avatar=circlePortrait(s.avatar?.role??'crystal',-578,312,64);
    if(s.avatar?.image)paintAvatar(avatar,s.avatar.image,58);
    this.ui.hover(avatar);avatar.on(Node.EventType.TOUCH_END,()=>avatarPicker(this.ui,this.service!,()=>this.render(),e=>this.error(e)));
    this.ui.panel(-494,310,176,44,this.ui.root,'#FFF9EC',234,18);`);
 s=replace(s,"    const adventureStart=this.ui.root.children.length;","    const adventureStart=this.ui.root.children.length;\n    this.ui.panel(-450,-4,380,536,this.ui.root,'#FFF9EC',237,24);");
 s=replace(s,"-6,42,78,()=>","-6,28,56,()=>");
 s=replace(s,"    const quality=hero?turtleQuality(hero):undefined;",`    const quality=hero?turtleQuality(hero):undefined;
    this.ui.hover(info);info.on(Node.EventType.TOUCH_END,()=>{if(!hero)return;const p=this.ui.sheet(visualName(hero),'伙伴资料',()=>this.render());this.getPrototypeMenus().paintTurtle(hero,p);});`);
 s=replace(s,"const picked=t.id===hero?.id,x=portraitStart+i*143,n=circlePortrait(t.role,x,-191,112,this.ui.root,picked);","const picked=t.id===hero?.id,x=portraitStart+i*143,n=circlePortrait(t.role,x,-191,112,this.ui.root,picked);this.ui.hover(n);");
 s=replace(s,"n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();go();});","this.ui.hover(n);n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();go();});");
 return s;
});
edit('view/HomeChat.ts',s=>replace(s,"`${c?.aiPlayers[id]?.name??'岛友'}·AI`","`${(c?.aiPlayers[id]?.name??'岛友').replace(/·AI$/,'')}·AI`"));
edit('core/prototypeConfig.ts',s=>replace(s,"['#e6e3dc','#8eca80','#77beed','#b797ee','#f0ac57']","['#39A873','#318ED3','#D5B333','#EC882C','#D95252']"));
edit('view/BubbleReveal.ts',s=>replace(s,"stencil.clear();this.ui.art!.attach(this.root,'fusion-bubble',460,460);","stencil.clear();\n    // The cover is opaque even where the decorative bubble asset is translucent.\n    const seal=this.ui.group('不透明开奖覆盖',0,0,this.root,430,430).addComponent(Graphics);seal.fillColor=color('#BBDDDC',255);seal.circle(0,0,212);seal.fill();\n    this.ui.art!.attach(this.root,'fusion-bubble',460,460);"));
edit('view/BattleScreen.ts',s=>{
 const start=s.indexOf('    this.ui.portrait(t.role,-422,32,224,p);',s.indexOf('  private prototypeReveal()'));
 const end=s.indexOf('    const epoch=this.pageEpoch;',start);if(start<0||end<0)throw Error('reveal anchor');
 s=s.slice(0,start)+"    this.ui.portrait(t.role,0,0,310,p,true);\n"+s.slice(end);
 s=replace(s,"this.prototypeDetails(result.id,()=>{this.setPauseState(false,false);this.render();});return true;",`const resultPage=this.sheet('新伙伴现身','点击伙伴，查看天赋和技能。');
        const shape=this.ui.portrait(result.turtle.role,0,0,340,resultPage,true);this.ui.hover(shape);
        const details=()=>this.prototypeDetails(result.id,()=>{this.setPauseState(false,false);this.render();});
        shape.on(Node.EventType.TOUCH_END,details);this.button('查看伙伴',0,-260,280,56,details,{parent:resultPage,primary:true,size:25});return true;`);
 return s;
});
edit('view/PrototypeMenus.ts',s=>{
 s=replace(s,"this.sound('reveal');this.chooseSurvivor();}),this.available","this.sound('reveal');this.revealedShape();}),this.available");
 s=replace(s,"if(e.revealed){this.chooseSurvivor();return true;}","if(e.revealed){this.revealedShape();return true;}");
 s=replace(s,"  private chooseSurvivor():void{",`  private revealedShape():void{
    const e=this.service.snapshot.outsideFusion;if(!e)return;
    const p=this.open('新伙伴现身','点击伙伴查看天赋、技能，并选择保留。');
    const shape=this.ui.portrait(e.candidate.role,0,0,340,p,true);this.ui.hover(shape);
    shape.on(Node.EventType.TOUCH_END,()=>this.chooseSurvivor());
    this.button('查看伙伴',0,-260,280,p,()=>this.chooseSurvivor(),false,true);
  }
  private chooseSurvivor():void{`);return s;
});
edit('core/types.ts',s=>replace(s,"export interface GameSave {","export interface GameSave {\n  avatar?:{role:Role;image?:string};"));
edit('core/game.ts',s=>replace(s,"  updateSettings(commandId:string",`  updateAvatar(commandId:string,avatar:{role:Role;image?:string}):void{
    this.transact(commandId,'avatar',s=>{
      requireRule(ROLE_IDS.includes(avatar.role),'头像角色不存在');
      requireRule(avatar.image===undefined||avatar.image.length<=360000&&/^data:image\\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar.image),'头像格式或大小不合适');
      s.avatar={...avatar};
    });
  }
  updateSettings(commandId:string`));
edit('core/save.ts',s=>replace(s,"export function validateSave(s:GameSave):void{",`export function validateSave(s:GameSave):void{
  if(s.avatar)requireRule(!!ROLES[s.avatar.role]&&(s.avatar.image===undefined||typeof s.avatar.image==='string'&&s.avatar.image.length<=360000&&/^data:image\\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.avatar.image)),'头像资料损坏','SAVE');`));
console.log('Home, avatar save, quality palette, fusion reveal changes applied');
