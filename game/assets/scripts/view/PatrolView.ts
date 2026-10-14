import {Component,Graphics,Label,Node,UIOpacity,Vec3,isValid,tween} from 'cc';
import {GameService} from '../core/game';
import {MATERIAL_NAMES,SKILL_BY_ID} from '../core/data';
import {displayGold} from '../core/economy';
import {PATROL,patrolGoldPerMinute} from '../core/patrol';
import type {Material,SkillId} from '../core/types';
import {IslandUI,UI_COLORS,color} from './IslandUI';
import {SeaChartMotion} from './SeaChart';

class PatrolRefresh extends Component {
  refresh:()=>void=()=>{};
  private elapsed=0;
  update(delta:number):void{if(typeof document!=='undefined'&&document.hidden)return;this.elapsed+=delta;if(this.elapsed>=1){this.elapsed=0;this.refresh();}}
}
export function patrolEntry(ui:IslandUI,service:GameService,open:()=>void):void{
  const hit=ui.group('主页巡海入口',538,-83,ui.root,174,92);
  const visual=ui.group('巡海动态字标',0,0,hit,184,104),sprite=ui.art?.attach(visual,'patrol-entry',184,104);
  const motion=hit.addComponent(SeaChartMotion);motion.reduced=ui.reducedMotion;motion.drift(visual,'ship');if(sprite)motion.surface(sprite,3);
  ui.hover(hit);hit.on(Node.EventType.TOUCH_END,()=>{if(ui.isInteractive(hit)){ui.click();open();}});
  const badge=ui.panel(32,-40,106,24,hit,'#FFF9EC',250,12),notice=ui.text('',0,0,15,'#007E8E',badge,104,23);
  const update=()=>{const patrol=service.snapshot.patrol;badge.active=!!patrol&&patrol.gold>0;notice.string=patrol&&patrol.bankMs>=PATROL.capMinutes*PATROL.minuteMs?'已满 · 可领取':'可领取';};
  hit.addComponent(PatrolRefresh).refresh=update;update();
}
export class PatrolView {
  private root!:Node;
  private clockLabel!:Label;
  private status!:Label;
  private gold!:Label;
  private meat!:Label;
  private other!:Label;
  private claimLabel!:Label;
  private progress!:Graphics;
  constructor(private ui:IslandUI,private service:GameService,private command:(kind:string)=>string,private back:()=>void,private error:(error:unknown)=>void,private saved:()=>void){}
  open():void{
    try{this.service.refreshClock(this.command('clock'));}catch(error){this.error(error);return;}
    const ui=this.ui;ui.clear();this.root=ui.group('巡海全景',0,0,ui.root,ui.pageWidth,ui.pageHeight);ui.secondaryPage(this.root);
    const motion=this.root.addComponent(SeaChartMotion);motion.reduced=ui.reducedMotion;
    const background=ui.screenScenery(this.root,'patrol-ocean');if(background)motion.surface(background);
    const ship=ui.group('巡海伙伴航船',22,124,this.root,476,476),sprite=ui.art?.attach(ship,'patrol-boat',476,476);motion.drift(ship,'ship');if(sprite)motion.surface(sprite,4);
    ui.text('巡海',-492,288,68,UI_COLORS.ink,this.root,230,92);
    const status=ui.panel(-492,223,210,39,this.root,'#FFF9EC',242,19);this.status=ui.text('自动巡航中',0,0,22,'#087F9E',status,200,32);
    const strip=ui.panel(-412,176,404,43,this.root,'#FFF9EC',239,21);
    this.clockLabel=ui.text('',-5,0,18,UI_COLORS.ink,strip,384,32);
    const track=ui.group('巡海累计进度',-413,145,this.root,398,10);this.progress=track.addComponent(Graphics);
    ui.button('返回海岛',522,308,172,48,this.back,{parent:this.root,size:23,sound:'back'});
    const tray=ui.panel(0,-219,1240,234,this.root,'#FFF9EC',252,28);
    ui.line(-222,-86,-222,82,tray);ui.line(256,-86,256,82,tray);
    ui.text('本次收获',-482,82,28,UI_COLORS.ink,tray,214,38);
    const rewardIcon=(index:number,x:number,y:number,size:number)=>ui.art?.attach(ui.group('巡海奖励图标',x,y,tray,size,size),`patrol-reward-${index}`,size,size);
    rewardIcon(0,-516,3,98);rewardIcon(1,-340,3,98);
    this.gold=ui.text('',-516,-61,22,UI_COLORS.ink,tray,185,35);this.meat=ui.text('',-340,-61,22,UI_COLORS.ink,tray,170,35);
    this.other=ui.text('',-443,-94,16,UI_COLORS.sand,tray,310,27);
    ui.button('明细',-274,83,67,33,()=>this.details(),{parent:tray,size:17});
    ui.text('每30分钟有机会获得',12,82,24,UI_COLORS.ink,tray,430,38);
    rewardIcon(1,-134,3,88);rewardIcon(2,16,3,88);ui.portrait('leaf',166,3,82,tray,true);
    ui.text('随机培养肉',-134,-51,19,UI_COLORS.ink,tray,145,29);ui.text('随机技能书',16,-51,19,UI_COLORS.ink,tray,145,29);ui.text('随机1-5技能龟龟',166,-51,18,UI_COLORS.ink,tray,153,29);
    const claim=ui.button('',437,-1,306,87,()=>this.claim(),{parent:tray,primary:true});claim.name='巡海一键领取';
    this.claimLabel=ui.text('一键领取',0,0,36,'#FFFFFF',claim,294,64);
    ui.text(`每分钟 ${patrolGoldPerMinute(this.service.snapshot)} 金币`,436,-67,20,UI_COLORS.sand,tray,320,31);
    ui.text('离线累计 · 最多12小时',436,-96,17,UI_COLORS.sand,tray,320,27);
    const rules=ui.button('规则',557,246,84,34,()=>this.rules(),{parent:this.root,size:18});rules.name='巡海规则';
    this.root.addComponent(PatrolRefresh).refresh=()=>this.refresh();this.refresh();
  }
  private refresh():void{
    if(!isValid(this.root,true))return;
    let save=this.service.snapshot,patrol=save.patrol;if(!patrol)return;
    let elapsed=Math.min(PATROL.capMinutes*PATROL.minuteMs,patrol.bankMs+Math.max(0,Date.now()-patrol.lastAt));
    if(Math.floor(elapsed/PATROL.minuteMs)>patrol.creditedMinutes){
      try{this.service.refreshClock(this.command('clock'));save=this.service.snapshot;patrol=save.patrol!;elapsed=patrol.bankMs;}catch(error){this.error(error);return;}
    }
    const seconds=Math.floor(elapsed/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60;
    this.clockLabel.string=`已累计 ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} / 12小时`;
    this.status.string=elapsed>=PATROL.capMinutes*PATROL.minuteMs?'收获已满 · 等待领取':'自动巡航中';
    this.gold.string='金币 '+displayGold(patrol.gold);this.meat.string='培养肉 ×'+Object.values(patrol.materials).reduce((sum,value)=>sum+(value??0),0);
    const books=Object.values(patrol.books).reduce((sum,value)=>sum+(value??0),0);this.other.string=books||patrol.pets.length?`另有技能书 ×${books} · 龟龟 ×${patrol.pets.length}`:`奇遇进度 ${patrol.encounterMinutes}/30分钟`;
    this.claimLabel.string=patrol.gold?'一键领取':'收获积累中';
    const graphics=this.progress;graphics.clear();graphics.fillColor=color('#D4E7E4',220);graphics.roundRect(-199,-5,398,10,5);graphics.fill();
    const width=398*elapsed/(PATROL.capMinutes*PATROL.minuteMs);if(width>1){graphics.fillColor=color('#00ADB9');graphics.roundRect(-199,-5,width,10,Math.min(5,width/2));graphics.fill();}
  }
  private claim():void{
    try{
      const rewards=this.service.claimPatrol(this.command('claimPatrol'));this.ui.feedback?.('reward');this.refresh();this.saved();
      const count=Object.values(rewards.materials).reduce((sum,value)=>sum+(value??0),0),books=Object.values(rewards.books).reduce((sum,value)=>sum+(value??0),0),summary=`已领取 ${displayGold(rewards.gold)} 金币`+(count?` · 肉×${count}`:'')+(books?` · 书×${books}`:'')+(rewards.pets.length?` · 龟龟×${rewards.pets.length}`:'');
      const message=this.ui.text(summary,-2,-70,24,'#FFFFFF',this.root,950,46),node=message.node;
      if(this.ui.reducedMotion()){this.ui.toast(message.string);node.destroy();return;}
      const opacity=node.addComponent(UIOpacity);tween(node).to(.9,{position:new Vec3(-2,-29,0)},{easing:'quadOut'}).delay(.5).call(()=>{if(isValid(node))node.destroy();}).start();tween(opacity).delay(.75).to(.65,{opacity:0}).start();
    }catch(error){this.error(error);}
  }
  private details():void{
    const patrol=this.service.snapshot.patrol;if(!patrol)return;
    const lines=[`金币 ${displayGold(patrol.gold)}`,...Object.entries(patrol.materials).map(([key,count])=>`${MATERIAL_NAMES[key as Material]} ×${count}`),...Object.entries(patrol.books).map(([key,count])=>`${SKILL_BY_ID[key as SkillId].name}技能书 ×${count}`),...patrol.pets.map(pet=>`${pet.skills.length}技能龟龟 · ${pet.name||({stone:'岩盾',spike:'荆棘',crystal:'潮光',leaf:'叶灵',bubble:'泡泡'}[pet.role])}`)];
    this.detailPage(lines,0);
  }
  private detailPage(lines:string[],page:number):void{
    const panel=this.ui.dialog('巡海收获明细','领取后放入背包',()=>panel.parent?.destroy(),760,530);
    lines.slice(page*8,page*8+8).forEach((line,index)=>this.ui.text(line,0,125-index*33,23,UI_COLORS.ink,panel,640,32));
    const pages=Math.ceil(lines.length/8);if(pages>1){this.ui.button('上一页',-170,-205,170,43,()=>{panel.parent?.destroy();this.detailPage(lines,page-1);},{parent:panel,disabled:!page});this.ui.text(`${page+1}/${pages}`,0,-205,20,UI_COLORS.sand,panel,90,32);this.ui.button('下一页',170,-205,170,43,()=>{panel.parent?.destroy();this.detailPage(lines,page+1);},{parent:panel,disabled:page===pages-1});}
  }
  private rules():void{
    const panel=this.ui.dialog('巡海规则','自动累计，无需保持在线',()=>panel.parent?.destroy(),880,560);
    const lines=[`每满1分钟获得 ${patrolGoldPerMinute(this.service.snapshot)} 金币，最多累计12小时。`,'每满30分钟独立进行一次奇遇：','30% 随机培养肉 ×1；3% 随机普通技能书 ×1；','1% 随机龟龟 ×1；66% 没有额外物品。','龟龟1 / 2 / 3 / 4 / 5技能概率：50 / 30 / 15 / 4 / 1%。','培养肉：蟹肉30% / 蚌肉30% / 鱼肉25% / 海参15%。','领取保留不足1分钟与30分钟奇遇进度。','满12小时停止累计；背包不足时所有收获保留。'];
    lines.forEach((line,index)=>this.ui.text(line,0,145-index*40,21,UI_COLORS.ink,panel,820,36));
  }
}
