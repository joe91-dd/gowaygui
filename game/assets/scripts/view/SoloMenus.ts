import {Node,Mask,Graphics} from 'cc';
import type {Turtle,Role} from '../core/types';
import {LEVELS} from '../core/data';
import {levelInfo} from '../core/development';
import {chapterWaves} from '../core/expeditionRules';
import {visualName} from './VisualIdentity';
import {SoloArt} from './SoloArt';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {SOLO_MILESTONES,milestoneValue,soloChapter,soloBest,soloFusion,difficultyUnlocked,unlockedBuffs,skillUnlocked} from '../core/soloProgress';
import {BUFFS,BuffId} from '../core/expeditionRules';
import {SKILLS} from '../core/data';
import {PearlBattleArt} from './PearlBattleArt';
import {SHOP_PACKS,ShopPool,shopPrice,packRemaining} from '../core/shop';
import {goldAmount} from '../core/economy';

/** Data-bound solo pages. Existing collection, learning and fusion transactions stay authoritative. */
export class SoloMenus {
 constructor(private ui:IslandUI,private service:GameService,private command:(s:string)=>string,private home:()=>void,private error:(e:unknown)=>void){}
 private act(fn:()=>void):void{try{fn();}catch(e){this.error(e);}}
 collection(inspect:(t:Turtle)=>void,editTeam:()=>void,role:Role|'all'='all',page=0):void{
  const ui=this.ui,s=this.service.snapshot,all=Object.values(s.collection),team=(s.homeTeam??all.slice(0,5).map(t=>t.id)).map(id=>s.collection[id]).filter(Boolean);ui.clear();
  const p=ui.soloPage('我的龟龟',this.home,true),strip=ui.panel(0,185,1110,106,p,'#FFF9EC',250,18);ui.text('已出战 '+team.length+'/5',-442,0,26,UI_COLORS.ink,strip,207,40);
  team.forEach((t,i)=>{const n=ui.button('',-257+i*137,0,102,101,()=>inspect(t),{parent:strip,surface:'bare'});const face=ui.group('已出战头像',0,10,n,67,67);face.addComponent(Mask).type=Mask.Type.GRAPHICS_ELLIPSE;ui.art?.attach(face,`portrait-${t.role}`,67,67);ui.text(visualName(t),0,-35,18,UI_COLORS.ink,n,100,26);});
  ui.button('编辑阵容',447,185,180,53,editTeam,{parent:p,size:23});
  const roles:('all'|Role)[]=['all','stone','spike','crystal','leaf','bubble'];['全部','肉盾','射手','法师','治疗','召唤'].forEach((name,i)=>ui.button(name,-460+i*184,88,172,39,()=>this.collection(inspect,editTeam,roles[i]),{parent:p,primary:role===roles[i],size:21}));
  const list=all.filter(t=>role==='all'||t.role===role),pages=Math.max(1,Math.ceil(list.length/10));page=Math.max(0,Math.min(page,pages-1));
  list.slice(page*10,page*10+10).forEach((t,i)=>{const n=ui.button('',-444+i%5*222,-22-Math.floor(i/5)*158,208,148,()=>inspect(t),{parent:p});
   const frame=ui.group('伙伴头部',0,23,n,191,91);frame.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;const picture=ui.group('原版头像',0,-29,frame);ui.art?.attach(picture,`portrait-${t.role}`,191,191);
   const badge=ui.panel(62,52,77,29,n,'#00AABB',255,10);ui.text(t.skills.length+'技能',0,0,17,'#FFFFFF',badge,73,25);ui.text(visualName(t),0,-37,23,UI_COLORS.ink,n,196,33);
   ui.text(team.some(x=>x.id===t.id)?'✓ 已出战':t.locked?'已锁定':'Lv.'+levelInfo(t).level,0,-62,16,'#008E96',n,192,24);
  });if(!list.length)ui.text('还没有这个职业的伙伴',0,-81,27,UI_COLORS.sand,p,800,60);
  this.pages(p,page,pages,n=>this.collection(inspect,editTeam,role,n));
 }
 levels(page:number,choose:(id:number)=>void,navigate:(page:number)=>void,selected?:number):void{
  const ui=this.ui,s=this.service.snapshot;ui.clear();page=Math.max(0,Math.min(9,page));const levels=LEVELS.slice(page*5,page*5+5),id=selected??Math.min(s.unlockedLevel,page*5+4),level=levels.find(l=>l.id===id)??levels[0];
  const p=ui.soloPage('关卡',this.home),bg=ui.group('确认稿海岛',0,0,p,1556,720);bg.setSiblingIndex(0);SoloArt.attach(bg,'chapter',0,1556,720);
  const points=[[-580,14],[-446,118],[-224,95],[-55,31],[113,-37]];
  levels.forEach((l,i)=>{const [x,y]=points[i],locked=l.id>s.unlockedLevel,n=ui.button(String(l.id+1),x,y,65,63,()=>this.levels(page,choose,navigate,l.id),{parent:p,primary:l.id===level.id,disabled:locked,size:30});ui.text(s.cleared.includes(l.id)?'✓':locked?'锁定':'',28,-32,18,s.cleared.includes(l.id)?'#00AC81':UI_COLORS.sand,n,60,28);});
  const detail=ui.panel(416,-15,390,588,p,'#FFF9EC',250,23);ui.text('第'+(level.id+1)+'关 · '+level.name,0,245,29,UI_COLORS.ink,detail,367,45);
  ui.art?.attach(ui.group('关卡场景预览',0,140,detail),(level.sceneArt??'map-coast-stage-1') as any,346,147);ui.text('敌人波数    '+chapterWaves(level.id)+' 波',0,27,24,UI_COLORS.ink,detail,354,39);ui.line(-172,-11,172,-11,detail);ui.text('通关奖励',-85,-45,24,UI_COLORS.ink,detail,169,37);
  ui.icon('gold',-113,-116,66,detail);ui.bookIcon('swift',0,-116,66,detail);ui.pet(Object.values(s.collection)[0],113,-116,66,detail);['金币','技能书','伙伴'].forEach((name,i)=>ui.text(name,(i-1)*113,-171,20,UI_COLORS.ink,detail,105,34));
  ui.button(level.id>s.unlockedLevel?'尚未解锁':s.cleared.includes(level.id)?'再次挑战 ›':'开始冒险 ›',0,-239,352,75,()=>choose(level.id),{parent:detail,primary:true,disabled:level.id>s.unlockedLevel,size:32});
  const first=Math.max(0,Math.min(7,page-1));[0,1,2].forEach(i=>{const chapter=first+i,l=LEVELS[chapter*5],n=ui.button('',-474+i*239,-236,225,94,()=>navigate(chapter),{parent:p,selected:chapter===page});ui.art?.attach(ui.group('海域缩略图',-68,0,n),l.sceneArt as any,72,77);ui.text(l.name.replace(/[1-5]$/,''),40,0,21,chapter*5>s.unlockedLevel?UI_COLORS.muted:UI_COLORS.ink,n,126,63,true);});
  ui.button('‹',-612,-236,42,66,()=>navigate(page-1),{parent:p,disabled:page===0,size:29});ui.button('›',159,-236,42,66,()=>navigate(page+1),{parent:p,disabled:page===9,size:29});ui.text((page+1)+' / 10',-224,-316,23,UI_COLORS.ink,p,440,36);

 }
 achievements(tab:'milestones'|'buffs'|'skills'='milestones',page=0,detailed=false):void{
  if(tab==='milestones'&&!detailed){this.milestoneOverview();return;}
  const ui=this.ui,s=this.service.snapshot;ui.clear();const p=ui.sheet('成就','解锁新的搭配，让每次冒险都有收获',this.home);
  ['里程碑','祝福收藏','技能收藏'].forEach((name,i)=>ui.button(name,-358+i*358,191,330,48,()=>this.achievements((['milestones','buffs','skills'] as const)[i]),{parent:p,primary:i===(tab==='milestones'?0:tab==='buffs'?1:2),size:24}));
  if(tab==='milestones'){
   [['主线进度',soloChapter(s)+' / 50'],['无尽纪录',soloBest(s)+' 波'],['合成进度',soloFusion(s)+' / 12 技能']].forEach(([label,value],i)=>{const n=ui.panel(-371+i*371,110,350,83,p,'#E9F3F0',255,16);ui.text(label,0,19,19,UI_COLORS.sand,n,310,28);ui.text(value,0,-17,28,UI_COLORS.ink,n,310,38);});
   const pages=Math.ceil(SOLO_MILESTONES.length/4);page=Math.max(0,Math.min(page,pages-1));
   SOLO_MILESTONES.slice(page*4,page*4+4).forEach((m,i)=>{const value=milestoneValue(s,m.kind),complete=value>=m.target,claimed=s.solo!.claims.includes(m.id),n=ui.panel(i%2?283:-283,-24-Math.floor(i/2)*139,548,126,p,'#FFF9EC',250,18);
    ui.modernIcon(6,-223,5,58,n);ui.text(m.name,-44,34,25,UI_COLORS.ink,n,287,34);ui.text(m.detail,-21,0,18,UI_COLORS.sand,n,328,30);ui.progress(-59,-37,265,9,Math.min(1,value/m.target),UI_COLORS.green,n);
    ui.text(Math.min(value,m.target)+' / '+m.target,137,-38,17,UI_COLORS.sand,n,120,25);
    ui.button(claimed?'已领取':complete?'领取':'进行中',187,29,129,43,()=>this.act(()=>{const gold=this.service.claimSoloMilestone(this.command('achievement'),m.id);this.achievements(tab,page);ui.toast('获得 '+gold+' 金币');}),{parent:n,primary:complete&&!claimed,disabled:!complete||claimed,size:20});
   });this.pages(p,page,pages,n=>this.achievements(tab,n,true));
  }else{
   const list=tab==='buffs'?Object.keys(BUFFS):SKILLS.filter(x=>!x.specialization).map(x=>x.id),pages=Math.ceil(list.length/10),allowed=unlockedBuffs(s);page=Math.max(0,Math.min(page,pages-1));
   list.slice(page*10,page*10+10).forEach((id,i)=>{const buff=tab==='buffs'?BUFFS[id as BuffId]:undefined,skill=SKILLS.find(x=>x.id===id),open=buff?allowed.includes(id as BuffId):skillUnlocked(s,skill!.id),name=buff?.name??skill!.name;
    const n=ui.button('',-444+i%5*222,51-Math.floor(i/5)*169,205,157,()=>{const d=ui.dialog(name,open?'已加入获取池':'随主线 / 无尽进度解锁',()=>d.parent?.destroy(),730,380);ui.text(buff?.description??skill!.description,0,12,23,UI_COLORS.ink,d,638,137,true);ui.text(open?'冒险中有机会获得':['desperate','phoenix','tauntGuard','cleanseSurge'].includes(id)||skill?.precious?'主线20关或无尽30波':['waveGrowth','killAttack','killDefense','killHealth','treasury'].includes(id)?'主线10关或无尽20波':'主线5关或无尽10波',0,-107,21,UI_COLORS.sand,d,660,46);},{parent:p});
    if(buff)PearlBattleArt.attach(ui.group('祝福:'+id,0,23,n),`buff-${id as BuffId}`,79,76);else ui.bookIcon(skill!.id,0,23,74,n);
    ui.text(name,0,-34,22,UI_COLORS.ink,n,193,31);ui.text(open?'已解锁':'未解锁',0,-62,17,open?'#008C92':UI_COLORS.muted,n,190,25);
   });this.pages(p,page,pages,n=>this.achievements(tab,n));
  }
 }
 private milestoneOverview():void{
  const ui=this.ui,s=this.service.snapshot;ui.clear();const p=ui.soloPage('成就',this.home,true);
  ['里程碑','战斗成就','解锁收藏'].forEach((name,i)=>ui.button(name,-367+i*367,233,347,47,()=>i===0?this.milestoneOverview():i===1?this.achievements('milestones',0,true):this.achievements('buffs'),{parent:p,primary:i===0,size:25}));
  const rows=[{name:'主线旅程',value:soloChapter(s),max:50,steps:[5,10,20,30,40,50],icon:'chart-chapter',note:'已通关 '+soloChapter(s)+' / 50 关'}, {name:'无尽挑战',value:soloBest(s),max:50,steps:[10,15,25,30,40,50],icon:'chart-endless',note:(s.solo?.best??[0,0,0]).map((x,i)=>['I','II','III'][i]+'  '+x+'波').join('     ')},{name:'合成成长',value:soloFusion(s),max:12,steps:[4,6,8,10,12],icon:'hero-stone',note:'最高 '+soloFusion(s)+' 技能伙伴'}];
  rows.forEach((r,i)=>{const y=116-i*148,n=ui.panel(0,y,1107,133,p,'#F5F7F0',250,17);ui.art?.attach(ui.group('成长插画',-471,0,n),r.icon as any,107,93);ui.text(r.name,-307,29,27,UI_COLORS.ink,n,190,39);ui.text(r.note,-286,-22,19,UI_COLORS.sand,n,230,42,true);ui.progress(92,12,426,11,Math.min(1,r.value/r.max),'#1FBCBA',n);r.steps.forEach((v,j)=>{const x=-104+j*392/(r.steps.length-1);ui.panel(x,12,14,14,n,r.value>=v?'#18BFC0':'#BDD1D2',255,7);ui.text(String(v),x,-24,18,UI_COLORS.sand,n,57,29);});ui.button('查看奖励 ›',435,0,170,49,()=>this.achievements('milestones',0,true),{parent:n,size:23});});
  ui.text('已解锁：技能 '+SKILLS.filter(x=>!x.specialization&&skillUnlocked(s,x.id)).length+' 项  ·  祝福 '+unlockedBuffs(s).length+'/'+Object.keys(BUFFS).length,-266,-284,21,UI_COLORS.sand,p,653,35);
 }
 private pages(p:Node,page:number,count:number,go:(n:number)=>void):void{this.ui.button('上一页',-242,-281,180,47,()=>go(page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / '+count,0,-281,23,UI_COLORS.ink,p,160,36);this.ui.button('下一页',242,-281,180,47,()=>go(page+1),{parent:p,disabled:page+1>=count,size:22});}
 endless(start:(d:1|2|3)=>void,selected:1|2|3=this.service.snapshot.solo?.difficulty??1):void{
  const ui=this.ui,s=this.service.snapshot;ui.clear();const p=ui.soloPage('无尽挑战',this.home);
  (['潮起','浪涌','深渊'] as const).forEach((name,i)=>{const d=(i+1) as 1|2|3,open=difficultyUnlocked(s,d),n=ui.panel((i-1)*371,9,346,402,p,'#FFF9EC',250,24);
   SoloArt.attach(ui.group('难度海岛',0,123,n),'endless',i,316,139);
   ui.text('无尽 '+['I','II','III'][i]+'  '+name,0,23,30,UI_COLORS.ink,n,313,43);ui.text('最高 '+(s.solo?.best[i]??0)+' 波',0,-23,23,UI_COLORS.sand,n,310,36);
   ui.text(i===0?'从容搭配，稳固防线':i===1?'敌人强化 · 金币 +30%':'极限防线 · 金币 +60%',0,-62,18,UI_COLORS.sand,n,310,29);
   ui.icon('gold',-78,-109,43,n);ui.icon('growth-history',0,-109,43,n);ui.bookIcon(i===0?'swift':i===1?'crystalCannon':'critical',78,-109,43,n);
   const requirement=i===0?'主线通关第2关':i===1?'难度 I 达到15波':'难度 II 达到25波';
   ui.button(open?(selected===d?'✓ 已选择':'选择'):requirement,0,-157,290,52,()=>this.endless(start,d),{parent:n,primary:open&&selected===d,disabled:!open,size:23});
  });ui.button('祝福收藏',-429,-277,241,51,()=>this.achievements('buffs'),{parent:p,size:23});ui.button('开始挑战 ›',396,-277,345,61,()=>this.act(()=>{this.service.selectSoloDifficulty(this.command('difficulty'),selected);start(selected);}),{parent:p,primary:true,disabled:!difficultyUnlocked(s,selected),size:28});
 }
 shop(open:(pool:'turtle'|'book'|'pack')=>void,category=0,selected=0):void{
  const ui=this.ui,s=this.service.snapshot;ui.clear();const p=ui.soloPage('商城',this.home);
  ui.panel(-205,-20,711,584,p,'#FFF9EC',245,23);ui.panel(376,-20,416,584,p,'#FFF9EC',245,23);
  ['龟龟','技能书','培养材料'].forEach((name,i)=>ui.button(name,-444+i*239,241,226,45,()=>this.shop(open,i),{parent:p,primary:category===i,size:25}));
  const packs=SHOP_PACKS.filter(x=>category===0?x.id.startsWith('turtle'):category===1?x.id.startsWith('book'):x.id.startsWith('material'));
  const pool:ShopPool=category===0?'turtle':'book';
  const items=[...(category<2?[1,10].map(count=>({name:(category===0?'伙伴招募':'技能书祈愿')+(count===1?' · 单次':' · 十次'),price:shopPrice(s,pool,count as 1|10),key:category===0?'portrait-stone':'book-calm',detail:count===1?'随机获得一份；具体概率可在详情查看。':'十次招募，按实际招募规则结算。',buy:()=>{this.service.purchaseShop(this.command('shop'),pool,count as 1|10);open(pool);},odds:()=>open(pool),disabled:s.gold<shopPrice(s,pool,count as 1|10)})):[]),...packs.map(pack=>({name:pack.name,price:goldAmount(s,pack.price),key:pack.id.startsWith('turtle')?'portrait-spike':pack.id.startsWith('book')?'book-strong':'shop-4',detail:pack.description.replace('专精与珍贵技能从高级活动获得。','珍贵技能随冒险进度解锁。'),buy:()=>{this.service.purchaseShopPack(this.command('shopPack'),pack.id);open('pack');},odds:()=>open('pack'),disabled:packRemaining(s,Date.now(),pack.id)<=0||s.gold<goldAmount(s,pack.price)}))];
  selected=Math.max(0,Math.min(selected,items.length-1));const item=items[selected];
  items.forEach((it,i)=>{const n=ui.button('',-435+i%3*231,115-Math.floor(i/3)*211,211,190,()=>this.shop(open,category,i),{parent:p,selected:i===selected});ui.art?.attach(ui.group('商品插画',0,25,n),it.key as any,101,101);ui.text(it.name,0,-49,20,UI_COLORS.ink,n,198,36);ui.icon('gold',-41,-78,23,n);ui.text(it.price.toLocaleString(),25,-78,21,UI_COLORS.ink,n,120,31);});
  ui.text(item.name,376,218,27,UI_COLORS.ink,p,374,45);ui.art?.attach(ui.group('商品大图',376,108,p),item.key as any,148,148);ui.text(item.detail,376,-18,21,UI_COLORS.sand,p,366,120,true);ui.text('合计  '+item.price.toLocaleString()+' 金币',376,-135,26,UI_COLORS.ink,p,369,43);
  ui.button('购买 ›',376,-210,358,66,()=>{const d=ui.dialog('购买确认',item.name,()=>d.parent?.destroy(),662,390);ui.art?.attach(ui.group('购买商品',-129,0,d),item.key as any,111,111);ui.text(item.price.toLocaleString()+' 金币',88,0,28,UI_COLORS.ink,d,263,53);ui.button('取消',-140,-130,227,53,()=>d.parent?.destroy(),{parent:d,size:24});ui.button('购买',140,-130,227,53,()=>this.act(()=>{d.parent?.destroy();item.buy();}),{parent:d,primary:true,size:24,disabled:item.disabled});},{parent:p,primary:true,size:30,disabled:item.disabled});
  ui.button('金币礼包',-406,-272,216,47,()=>this.goldPacks(()=>this.shop(open,category,selected)),{parent:p,size:22});ui.button('精选礼包',-160,-272,216,47,()=>this.featuredPacks(()=>this.shop(open,category,selected)),{parent:p,size:22});ui.button('规则与概率',376,-269,245,39,item.odds,{parent:p,size:20});
 }
 private featuredPacks(back:()=>void):void{
  const ui=this.ui;ui.clear();const p=ui.sheet('精选礼包','商品内容展示 · 正式上架后开放购买',back);
  [8,10,12].forEach((count,i)=>{const n=ui.panel((i-1)*371,4,345,367,p,'#FFF9EC',255,22);ui.portrait((['stone','crystal','bubble'] as const)[i],0,73,171,n,true);ui.text(count+'技能伙伴礼包',0,-32,27,UI_COLORS.ink,n,319,40);ui.text('造型与技能以商品详情为准',0,-77,19,UI_COLORS.sand,n,322,33);ui.button('查看内容',0,-135,290,55,()=>{const d=ui.dialog(count+'技能伙伴礼包','尚未开放购买',()=>d.parent?.destroy(),720,390);ui.text('包含 '+count+' 技能伙伴一只。\n具体造型、技能池、天赋范围和当地价格，\n将在正式商品详情中明确展示。',0,-1,23,UI_COLORS.ink,d,641,147,true);ui.button('知道了',0,-137,277,47,()=>d.parent?.destroy(),{parent:d,primary:true,size:23});},{parent:n,primary:true,size:23});});
  ui.button('技能书礼包',0,-264,330,51,()=>{const d=ui.dialog('技能书礼包','尚未开放购买',()=>d.parent?.destroy(),730,410);(['strong','crystalCannon','critical'] as const).forEach((id,i)=>ui.bookIcon(id,(i-1)*137,11,70,d));ui.text('通用技能 · 职业主动 · 珍贵技能',0,-58,22,UI_COLORS.ink,d,643,38);ui.text('数量、可选范围与价格将在正式商品详情中公布',0,-112,19,UI_COLORS.sand,d,666,52,true);},{parent:p,size:24});
 }
 private goldPacks(back:()=>void):void{
  const ui=this.ui;ui.clear();const p=ui.sheet('金币礼包','商品展示 · 平台购买接入后开放',back);
  ['一小袋金币','一箱金币','一库金币'].forEach((name,i)=>{const n=ui.panel((i-1)*373,-14,350,391,p,'#FFF9EC',250,22);SoloArt.attach(ui.group('金币礼包',0,61,n),'gold',i,280,183);ui.text(name,0,-47,28,UI_COLORS.ink,n,325,39);ui.text([1000,6000,20000][i].toLocaleString()+' 金币 · 价格待定',0,-88,21,UI_COLORS.sand,n,316,32);ui.button('查看礼包',0,-148,282,55,()=>{const d=ui.dialog(name,'尚未开放购买',()=>d.parent?.destroy(),680,368);ui.text('金币数量与当地售价将在正式上架时公布。\n当前试玩不会扣款，也不会发起支付。',0,3,24,UI_COLORS.ink,d,585,130,true);ui.button('知道了',0,-126,250,49,()=>d.parent?.destroy(),{parent:d,primary:true,size:24});},{parent:n,primary:true,size:24});});
 }
}
