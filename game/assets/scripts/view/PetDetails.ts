import {accessiblePet,editablePet,loanLabel} from '../core/petAccess';
import {Graphics,Node,EventTouch,isValid,UITransform} from 'cc';
import {IslandUI,UI_COLORS,color} from './IslandUI';
import {visualName,HERO_LOOK} from './VisualIdentity';
import {GameService} from '../core/game';
import {levelInfo,petPanel,talentTicks,resetPointCost,trainingCost} from '../core/development';
import {turtleQuality} from '../core/prototypeConfig';
import {MATERIAL_NAMES,SKILL_BY_ID} from '../core/data';
import {displayGold} from '../core/economy';
import type {Turtle,Material,Aptitude} from '../core/types';

/** Five stars, each with ten genuinely fractional fill positions. */
export function talentStars(ui:IslandUI,t:Turtle,key:Material,x:number,y:number,parent:Node,size=25):void{
 talentTickStars(ui,talentTicks(t,key),x,y,parent,size);
}
export function talentTickStars(ui:IslandUI,ticks:number,x:number,y:number,parent:Node,size=25,showValue=true):void{
 const n=ui.group('天赋星级:'+ticks,x,y,parent,size*6,size),g=n.addComponent(Graphics);
 for(let s=0;s<5;s++){
  const cx=(s-2)*size*1.22,r=size/2,points=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;return {x:cx+Math.cos(a)*rr,y:Math.sin(a)*rr};});
  const paint=(p:{x:number;y:number}[],hex:string)=>{if(!p.length)return;g.fillColor=color(hex);g.moveTo(p[0].x,p[0].y);p.slice(1).forEach(v=>g.lineTo(v.x,v.y));g.close();g.fill();};paint(points,'#D4DDD6');
  const fraction=Math.max(0,Math.min(1,(ticks-s*10)/10)),cut=cx-r+fraction*r*2,clipped:{x:number;y:number}[]=[];
  if(fraction>0)for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],aa=a.x<=cut,bb=b.x<=cut;if(aa)clipped.push(a);if(aa!==bb)clipped.push({x:cut,y:a.y+(b.y-a.y)*(cut-a.x)/(b.x-a.x)});}paint(clipped,'#E5AD37');
 }
 if(showValue)ui.text(`${Math.floor(ticks/10)}星${ticks%10}刻`,size*6.3,0,17,UI_COLORS.sand,n,112,26);
}

export interface PetDetailOptions {readOnly?:boolean;owned?:boolean;confirm?:()=>void;confirmText?:string;disabled?:boolean;back?:()=>void;learn?:()=>void;manage?:()=>void;rename?:()=>void}
export class PetDetails {
 private pane?:Node;
 private content?:Node;
 private petId='';
 private tab:'panel'|'talents'|'skills'='panel';
 private draft:Record<Aptitude,number>={attack:0,health:0,defense:0};
 constructor(private ui:IslandUI,private service:GameService,private command:(kind:string)=>string,private error:(e:unknown)=>void){}
 private retire(n?:Node):void{if(n&&isValid(n,true)){n.removeFromParent();n.destroy();}}
 private outline(n:Node,w:number,h:number,hex='#D6B572',radius=14):void{
  const edge=this.ui.group('浅金细边',0,0,n,w,h),g=edge.addComponent(Graphics);g.lineWidth=1.3;g.strokeColor=color(hex,210);g.roundRect(-w/2+1,-h/2+1,w-2,h-2,radius);g.stroke();
 }
 private action(label:string,x:number,y:number,w:number,h:number,fn:()=>void,parent:Node,primary=false,disabled=false,size=23):Node{
  const n=this.ui.button(label,x,y,w,h,fn,{parent,primary,disabled,size});this.outline(n,w,h,disabled?'#D9E2E4':this.ui.soloStyle?'#BBDDD7':'#D8B879');return n;
 }
 show(turtle:Turtle,options:PetDetailOptions={}):void{
  const s=this.service.snapshot,t=options.readOnly?turtle:accessiblePet(s,turtle.id)??turtle,canAllocate=!options.readOnly&&!!editablePet(s,t.id),loan=options.readOnly?'':loanLabel(s,t.id),info=levelInfo(t),q=turtleQuality(t),stats=petPanel(t),identity=(options.readOnly?'external:':'')+t.id+':'+t.role;
  if(this.petId!==identity||!this.pane||!isValid(this.pane,true)){
   this.retire(this.pane?.parent??undefined);this.petId=identity;this.draft={attack:0,health:0,defense:0};this.tab='panel';
   const veil=this.ui.screenVeil('伙伴培养遮罩','#102F43',152);
   if(this.ui.soloStyle)this.ui.screenScenery(veil,'home-background');
   this.ui.secondaryPage(veil);this.pane=this.ui.group('伙伴培养详情',0,0,veil,1240,698);
   if(this.ui.soloStyle){this.ui.panel(195,-24,774,599,this.pane,'#FFF9EC',247,24);this.ui.soloHeader(this.pane,'我的龟龟',()=>{this.retire(this.pane?.parent??undefined);this.pane=undefined;options.back?.();});}else{this.ui.art?.attach(this.pane,'pet-detail-shell',1240,698);const backdrop=this.ui.group('伙伴海湾展示台',-393,22,this.pane,368,434);this.ui.art?.attach(backdrop,'pet-display-sanctuary',368,434);}
   // Feet sit on the stone top, at 70% of the display art's height.
   const shadow=this.ui.group('伙伴接触阴影',-393,-65,this.pane),sg=shadow.addComponent(Graphics);sg.fillColor=color('#635642',42);sg.ellipse(0,0,90,13);sg.fill();
   this.ui.portrait(t.role,-393,86,t.role==='stone'?306:324,this.pane,true,t.skills.length>=10);
   if(!this.ui.soloStyle)this.ui.line(-199,244,-199,-264,this.pane,'#D3C7A5');
  }
  const p=this.pane!;
  // Rebuild controls only. The living portrait and its rig survive tab changes.
  this.retire(this.content);const c=this.content=this.ui.group('培养内容:'+this.tab,0,0,p,1240,698);
  const close=()=>{this.retire(this.pane?.parent??undefined);this.pane=undefined;this.content=undefined;this.draft={attack:0,health:0,defense:0};options.back?.();};
  const act=(fn:()=>void)=>{try{fn();this.show(t,options);}catch(e){this.error(e);}};
  this.ui.text(visualName(t),-393,this.ui.soloStyle?231:282,36,UI_COLORS.ink,c,330,48);
  this.ui.panel(-393,this.ui.soloStyle?192:239,229,32,c,'#E8F1EF',255,12);this.ui.text(`${HERO_LOOK[t.role].job} · ${q.name}`,-393,this.ui.soloStyle?192:239,22,UI_COLORS.ink,c,229,30);
  this.ui.text('Lv.'+info.level+' / 50',-393,-148,30,UI_COLORS.ink,c,320,42);
  this.ui.progress(-393,-181,282,12,info.needed?info.current/info.needed:1,'#26C3C5',c);
  this.ui.text(info.needed?`${info.current} / ${info.needed} 经验`:'已经满级',-393,-211,21,UI_COLORS.sand,c,320,32);
  this.ui.text(loan?loan:'每级 3 点 · 战斗获得经验',-393,-247,19,UI_COLORS.sand,c,332,30);
  if(options.owned&&options.rename)this.action('改名',-393,-293,254,50,()=>{close();options.rename!();},c);
  else if(this.ui.share&&!this.ui.soloStyle)this.action('分享伙伴',-393,-293,254,50,()=>this.ui.share?.('我的海岛伙伴 · '+visualName(t),`${q.name} ${t.skills.length} 技能 · Lv.${info.level}，一起来守护龟岛！`),c);
  if(!this.ui.soloStyle)this.action('×',583,302,46,46,()=>{this.ui.click('back');close();},c,false,false,29);
  (['panel','talents','skills'] as const).forEach((tab,i)=>this.action(['属性加点','星级天赋',`技能 ${t.skills.length}`][i],-61+i*240,273,230,54,()=>{this.tab=tab;this.show(t,options);},c,this.tab===tab,false,26));
  const heading=(title:string,note:string)=>{
   this.ui.text(title,8,190,29,UI_COLORS.ink,c,302,46);this.ui.text(note,390,190,19,UI_COLORS.sand,c,320,38);this.ui.line(-164,156,552,156,c,'#C7BA99');
  };
  if(this.tab==='panel'){
   const points=t.development?.points??{attack:0,health:0,defense:0};
   // A refreshed save may have fewer points; never let a stale draft exceed it.
   let budget=info.available;for(const key of ['attack','health','defense'] as const){this.draft[key]=Math.min(this.draft[key],Math.max(0,budget));budget-=this.draft[key];}
   const left=budget;
   const preview=petPanel({...t,development:{version:1,xp:t.development?.xp??0,points:{attack:points.attack+this.draft.attack,health:points.health+this.draft.health,defense:points.defense+this.draft.defense}}});
   heading('属性培养',`可用属性点  ${left}`);
   (['attack','health','defense'] as const).forEach((key,i)=>{
    const y=111-i*88;
    this.ui.icon((key+'-medicine') as 'attack-medicine'|'health-medicine'|'defense-medicine',-132,y,40,c);
    this.ui.text(['攻击','生命','防御'][i],-65,y,25,UI_COLORS.ink,c,86,40);
    this.ui.text(preview[key]!==stats[key]?`${stats[key]} → ${preview[key]}`:String(stats[key]),62,y,preview[key]!==stats[key]?24:32,UI_COLORS.ink,c,152,46);
    this.ui.text(`已加 ${points[key]}${this.draft[key]?'  +'+this.draft[key]:''}`,212,y,22,UI_COLORS.sand,c,154,40);
    if(canAllocate){this.action('−',349,y,50,48,()=>{this.draft[key]=Math.max(0,this.draft[key]-1);this.show(t,options);},c,false,!this.draft[key],27);this.action('+',414,y,50,48,()=>{this.draft[key]++;this.show(t,options);},c,false,left<=0,27);this.action('+3',491,y,76,48,()=>{this.draft[key]+=Math.min(3,left);this.show(t,options);},c,false,left<=0,24);}
    if(i<2)this.ui.line(-161,y-44,549,y-44,c,'#D8CFB7');
   });
   this.ui.text(`剩余 ${left} 点 · 法术抗性 ${stats.resist}`,195,-138,23,UI_COLORS.ink,c,685,40);
   if(canAllocate){
    this.action('重置 · '+displayGold(resetPointCost(s,t)),15,-211,319,52,()=>{const d=this.ui.dialog('重置加点',`消耗 ${displayGold(resetPointCost(s,t))} 金币，返还全部已分配属性点。${loan?'仅重置自己的租借加点。':''}`,()=>d.parent?.destroy(),700,310);this.ui.button('确认重置',0,-88,280,50,()=>{this.retire(d.parent??undefined);act(()=>{this.service.resetPetPoints(this.command('reset'),t.id);this.ui.feedback?.('equip');this.draft={attack:0,health:0,defense:0};});},{parent:d,primary:true,size:23,disabled:s.gold<resetPointCost(s,t)});},c,false,!Object.values(points).some(n=>n>0));
    this.action('保存加点',372,-211,319,52,()=>act(()=>{this.service.allocatePetPoints(this.command('allocate'),t.id,this.draft);this.ui.feedback?.('upgrade');this.draft={attack:0,health:0,defense:0};}),c,true,!Object.values(this.draft).some(n=>n>0));
   }
  }else if(this.tab==='talents'){
   heading('天赋培养','每份食材提升 1 刻');
   (['attack','health','defense','growth'] as const).forEach((key,i)=>{
    const y=114-i*87,ticks=talentTicks(t,key),remainder=ticks===50?10:ticks%10;
    this.ui.icon((key+'-medicine') as 'attack-medicine'|'health-medicine'|'defense-medicine'|'growth-medicine',-138,y,37,c);
    this.ui.text(['攻击天赋','生命天赋','防御天赋','成长天赋'][i],-51,y,22,UI_COLORS.ink,c,128,38);
    talentTickStars(this.ui,ticks,131,y+10,c,28,false);
    for(let tick=0;tick<10;tick++)this.ui.panel(47+tick*18.7,y-21,16,9,c,tick<remainder?'#E5AD37':'#D8DFDD',255,2);
    this.ui.text(`${Math.floor(ticks/10)}星${ticks%10}刻`,304,y,23,UI_COLORS.ink,c,135,36);
    if(options.owned&&!loan)this.action(ticks>=50?'已满星':'培养 +1刻',457,y,167,49,()=>{const cost=trainingCost(s,t,key),d=this.ui.dialog('培养天赋',`消耗 ${MATERIAL_NAMES[key]} ×1（持有 ${s.materials[key]}）与 ${displayGold(cost)} 金币，提升 1 刻。`,()=>d.parent?.destroy(),760,310);this.ui.button('确认培养',0,-88,320,50,()=>{this.retire(d.parent??undefined);act(()=>{this.service.train(this.command('train'),t.id,key);this.ui.feedback?.('upgrade');});},{parent:d,primary:true,size:23,disabled:s.gold<cost||s.materials[key]<1});},c,false,s.materials[key]<1||ticks>=50,22);
    if(i<3)this.ui.line(-162,y-44,549,y-44,c,'#D8CFB7');
   });this.ui.text('10 刻填满一颗星',197,-213,21,UI_COLORS.sand,c,640,34);
  }else{
   heading('已掌握技能','点击图标查看详情');
   const dense=t.skills.length>8,tileH=dense?121:161,step=dense?129:171,first=dense?87:69;
   t.skills.forEach((id,i)=>{
    const skill=SKILL_BY_ID[id],tile=this.ui.button('',-80+i%4*185,first-Math.floor(i/4)*step,173,tileH,()=>this.ui.skillDetail(id),{parent:c});
    this.outline(tile,173,tileH,skill.precious?'#D9A2A0':'#DFC999');
    this.ui.bookIcon(id,0,dense?21:27,dense?59:79,tile);
    this.ui.text(skill.name,0,dense?-20:-26,dense?20:23,UI_COLORS.ink,tile,161,30);
    const precious=!!skill.precious,profession=skill.active||skill.specialization;
    this.ui.panel(0,dense?-47:-60,145,23,tile,precious?'#F9E6E2':profession?'#F8E5B4':'#E2EFF1',255,10);
    this.ui.text(skill.specialization?'职业专精':skill.active?'职业主动':precious?'珍贵被动':'通用被动',0,dense?-47:-60,16,precious?'#A74642':profession?'#806024':'#436877',tile,142,23);
   });
   // Empty sockets are intentionally omitted: the visible skill count is the
   // learned count, so an 8-skill pet reads simply “技能 8” without a misleading cap.
  }
  this.ui.line(-167,-261,548,-261,c,'#D3C7A5');
  if(options.confirm){this.action('返回',3,-293,327,54,close,c);this.action(options.confirmText??'确定出战',372,-293,345,54,()=>{close();options.confirm!();},c,true,!!options.disabled,25);}
  else{
   if(options.owned&&options.manage)this.action('管理伙伴',3,-293,327,54,()=>{close();options.manage!();},c);
   else this.action('返回',3,-293,327,54,close,c);
   if(options.owned&&options.learn&&!loan)this.action('学习技能',372,-293,345,54,()=>{close();options.learn!();},c,true,false,25);
   else this.action('返回',372,-293,345,54,close,c,true);
  }
 }
}
