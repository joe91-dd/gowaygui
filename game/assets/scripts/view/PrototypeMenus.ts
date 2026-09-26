import {WishSequence} from './MenuMotion';
import {orderedPets} from '../core/petOrder';
import {petCardDrag,PetDropTarget} from './PetCardDrag';
import {PetDetails,talentStars,talentTickStars} from './PetDetails';
import {RewardMenus} from './RewardMenus';
import {levelInfo,petPanel} from '../core/development';
import {visualName} from './VisualIdentity';
import {EditBox,Node,tween,UIOpacity,Vec3} from 'cc';
import {GameService,displayName} from '../core/game';
import {pendingTakeaways} from '../core/prototype';
import {turtleQuality} from '../core/prototypeConfig';
import {ROLES,SKILL_BY_ID,SKILLS,skillsForRole,skillCategory,MATERIAL_NAMES} from '../core/data';
import type {Turtle,SkillId} from '../core/types';
import {IslandUI,UI_COLORS} from './IslandUI';
import {BubbleReveal} from './BubbleReveal';
import {previewFusion} from '../core/fusion';
import {TALENT_KEYS,TALENT_NAMES,talentDistribution} from '../core/talents';
import {ShopPool,ShopPackId,shopPrice,SHOP_CONFIG,SHOP_PACKS,packRemaining,packBookOdds} from '../core/shop';
import {displayGold,goldAmount} from '../core/economy';
import type {SkillBookReceipt} from '../core/skillBooks';
import {skillBookIssue} from '../core/skillBooks';
import type {ArtV2Slice} from './ArtV2Assets';

/** V0.6 asset choices reuse the existing island components and art. */
export class PrototypeMenus {
  private parents:string[]=[];
  private pendingSelection='';
  private parentSlot=0;
  private selectedBook:SkillId|undefined;
  private lastBook?:SkillBookReceipt;
  private inventoryReturn?:()=>void;
  constructor(private readonly ui:IslandUI,private readonly service:GameService,private readonly command:(kind:string)=>string,
    private readonly available:()=>boolean,private readonly refresh:()=>void,private readonly home:()=>void,
    private readonly collection:()=>void,private readonly detail:(id:string)=>void,private readonly error:(error:unknown)=>void,
    private readonly sound:(kind:'rub'|'reveal'|'fusionStart'|'fusionComplete'|'purchase'|'learn'|'learnComplete')=>void){}
  private open(title:string,subtitle:string,back?:()=>void):Node{this.ui.clear();return this.ui.sheet(title,subtitle,back);}
  private action(fn:()=>void):boolean{if(!this.available())return false;try{fn();return true;}catch(error){this.error(error);return false;}}
  private button(text:string,x:number,y:number,w:number,p:Node,action:()=>void,disabled=false,primary=false):Node{
    return this.ui.button(text,x,y,w,88,()=>this.action(action),{parent:p,disabled,primary,size:30});
  }
  private petName(t:Turtle):string{return this.ui.art?.ready?visualName(t):displayName(t);}
  private ordered():Turtle[]{return orderedPets(this.service.snapshot,true);}
  private card(t:Turtle,index:number,p:Node,action:()=>void,selected=false):void{
    const x=-384+(index%3)*384,y=104-Math.floor(index/3)*192,q=turtleQuality(t);
    this.ui.panel(x,y,364,180,p,q.color,255,22);
    this.ui.card(t.role,this.petName(t),`${ROLES[t.role].job} · ${t.skills.length}技能`,`${q.name}${t.locked?' · 锁定':''}`,x,y,()=>this.action(action),{parent:p,selected,turtle:t});
  }
  workshop():void{this.parents=[];this.chooseParents();}
  chooseParents(page=0):void{
    const all=this.ordered(),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1));this.parents=this.parents.map(id=>all.some(t=>t.id===id)?id:'');this.ui.clear();const p=this.ui.sceneSheet('合成工坊',this.home,'fusion-background');
    const targets:PetDropTarget[]=[];
    const pick=(t:Turtle,slot:number)=>this.action(()=>{if(t.locked)throw new Error('请先解除这只龟龟的锁定，再选择为亲本');const other=slot===0?1:0;if(this.parents[other]===t.id)this.parents[other]=this.parents[slot]??'';this.parents[slot]=t.id;this.parentSlot=this.parents[other]?slot:other;this.ui.feedback?.('equip');this.chooseParents(current);});
    const drop=(t:Turtle,id:string)=>{if(id.startsWith('parent:')){pick(t,Number(id.slice(7)));return;}this.action(()=>{this.service.swapCollectionOrder(this.command('petOrder'),t.id,id);this.ui.feedback?.('equip');this.chooseParents(current);});};
    this.ui.panel(-363,-27,419,486,p,'#FFF9EC',225,24);this.ui.panel(230,-27,737,486,p,'#FFF9EC',235,24);
    this.ui.text('两只龟龟可能合成\n一只更好的龟龟',-363,182,24,UI_COLORS.ink,p,357,67,true);
    [0,1].forEach(i=>{const t=this.service.snapshot.collection[this.parents[i]],tap=()=>{this.parentSlot=i;this.chooseParents(current);},n=this.ui.button('',-451+i*176,35,169,229,tap,{parent:p,selected:this.parentSlot===i});targets.push({id:'parent:'+i,node:n});this.ui.text(i?'副龟 · 40%':'主龟 · 60%',0,73,20,UI_COLORS.ink,n,152,32);if(t){this.ui.pet(t,0,5,104,n);this.ui.text(this.petName(t),0,-69,21,UI_COLORS.ink,n,152,34);petCardDrag(this.ui,n,t,targets,{tap,drop:id=>drop(t,id)});}else{this.ui.decoration('decor-empty',0,1,104,103,n);this.ui.text('拖入伙伴',0,-77,23,UI_COLORS.sand,n,150,36);}});
    this.ui.text('拖动可换位，也可拖入主龟或副龟',-363,-124,18,UI_COLORS.sand,p,367,58,true);
    all.slice(current*6,current*6+6).forEach((t,i)=>{const tap=()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:this.parentSlot===0?'选择为主龟':'选择为副龟',disabled:t.locked,confirm:()=>pick(t,this.parentSlot)}),n=this.ui.button('',-13+i%3*246,96-Math.floor(i/3)*200,220,186,tap,{parent:p,selected:this.parents.includes(t.id)});targets.push({id:t.id,node:n});this.ui.pet(t,0,37,110,n);this.ui.text(this.petName(t),0,-47,23,UI_COLORS.ink,n,204,36);this.ui.text('Lv.'+levelInfo(t).level+' · '+t.skills.length+' 技能'+(t.locked?' · 锁定':''),0,-76,18,UI_COLORS.sand,n,209,29);petCardDrag(this.ui,n,t,targets,{tap,drop:id=>drop(t,id)});});
    this.ui.button('‹',84,-224,99,51,()=>this.chooseParents(current-1),{parent:p,disabled:current===0,size:27});this.ui.text((current+1)+' / '+pages,235,-224,23,UI_COLORS.ink,p,150,35);this.ui.button('›',384,-224,99,51,()=>this.chooseParents(current+1),{parent:p,disabled:current===pages-1,size:27});
    this.ui.button('查看合成方案',-363,-215,372,59,()=>this.action(()=>this.confirmParents()),{parent:p,primary:true,disabled:!this.parents[0]||!this.parents[1],size:26});this.ui.text('新伙伴继承双亲平均经验，属性点可重新分配。',0,-315,19,UI_COLORS.ink,p,1110,34);
  }
  private candidate(t:Turtle,page:number):void{
    const p=this.open(this.petName(t),'查看天赋与技能后，选择是否作为合成亲本。',()=>this.chooseParents(page));this.paintTurtle(t,p);
    this.button('主龟 · 60%造型',-270,-276,480,p,()=>{if(this.parents[1]===t.id)this.parents[1]=this.parents[0];this.parents[0]=t.id;this.chooseParents(page);},t.locked,true);
    this.button('副龟 · 40%造型',270,-276,480,p,()=>{if(this.parents[0]===t.id)this.parents[0]=this.parents[1];this.parents[1]=t.id;this.chooseParents(page);},t.locked||!this.parents[0]);
  }
  shop(pool:ShopPool='turtle',page=0):void{
    const s=this.service.snapshot,pending=s.shop?.pending;
    if(pending){
      const pages=Math.ceil(pending.draws.length/6),current=Math.max(0,Math.min(page,pages-1)),single=pending.draws.length===1;
      this.ui.clear();const p=this.ui.art?.ready?this.ui.sceneSheet(pending.pool==='pack'?'礼包已打开':'新的收获',undefined,'market-pavilion'):this.ui.sheet('招募结果','结果已保存到库存');
      this.ui.text('已收入背包 · 本次 '+displayGold(pending.cost)+' 金币',0,219,23,UI_COLORS.ink,p,1000,36);
      pending.draws.slice(current*6,current*6+6).forEach((d,i)=>{
        const tag=d.guarantee==='hundred'?'百次保底':d.guarantee==='ten'?'十次保底':'招募获得';
        if(single){
          const n=this.ui.panel(0,-5,426,390,p,'#FFF9EC',243,26);
          if(d.turtle){this.ui.pet(d.turtle,0,34,196,n);this.ui.text(this.petName(d.turtle),0,-99,31,UI_COLORS.ink,n,380,48);this.ui.button('查看伙伴',0,-152,250,42,()=>this.inspect(d.turtle!,()=>this.shop(pending.pool,current)),{parent:n,primary:true,size:24});}
          else if(d.skillId){this.ui.bookIcon(d.skillId,0,34,174,n);this.ui.text(SKILL_BY_ID[d.skillId].name,0,-97,31,UI_COLORS.ink,n,380,48);this.ui.button('查看技能',0,-152,250,42,()=>this.inspectBook(d.skillId!,()=>this.shop(pending.pool,current)),{parent:n,primary:true,size:24});}
          else{this.ui.text(MATERIAL_NAMES[d.material!]+' × '+d.amount,0,0,34,UI_COLORS.ink,n,380,130);}
          this.ui.text(tag,0,155,23,UI_COLORS.sand,n,380,40);
        }else if(d.turtle)this.card(d.turtle,i,p,()=>this.inspect(d.turtle!,()=>this.shop(pending.pool,current)));
        else if(d.material){const n=this.ui.panel(-384+i%3*384,104-Math.floor(i/3)*192,360,176,p);this.ui.text(MATERIAL_NAMES[d.material]+' × '+d.amount,0,20,34,UI_COLORS.gold,n,334,80);}
        else{const n=this.ui.button('',-384+i%3*384,104-Math.floor(i/3)*192,360,176,()=>this.inspectBook(d.skillId!,()=>this.shop(pending.pool,current)),{parent:p});this.ui.bookIcon(d.skillId!,-110,0,116,n);this.ui.text(SKILL_BY_ID[d.skillId!].name,64,34,28,UI_COLORS.gold,n,214,52);this.ui.text(tag,64,-32,25,UI_COLORS.sand,n,214,44);}
      });
      if(pages>1){this.button('上一页',-474,-276,176,p,()=>this.shop(pending.pool,current-1),current===0);this.button('下一页',-270,-276,176,p,()=>this.shop(pending.pool,current+1),current===pages-1);}
      this.button('收好，返回商城',pages>1?240:0,-276,560,p,()=>{this.service.finishShopReveal('shopReveal:'+pending.id);this.shop(pending.pool);},false,true);return;
    }
    if(this.ui.art?.ready){if(pool==='pack')this.shopPacksV2();else this.summonGallery(pool);return;}
    const p=this.open('海岛商城',`金币 ${displayGold(s.gold)}`,this.home),count=pool==='turtle'?(s.shop?.turtleCount??0):(s.shop?.bookCount??0);
    this.button('龟龟招募',-374,134,350,p,()=>this.shop('turtle'),false,pool==='turtle');this.button('技能书祈愿',0,134,350,p,()=>this.shop('book'),false,pool==='book');this.button('金币礼包',374,134,350,p,()=>this.shop('pack'),false,pool==='pack');
    if(pool==='pack'){
      SHOP_PACKS.forEach((pack,i)=>{const remaining=packRemaining(s,Math.max(Date.now(),s.clockHighWater),pack.id),n=this.ui.button('',-374+i%3*374,12-Math.floor(i/3)*138,350,124,()=>this.packDetail(pack.id),{parent:p});this.ui.text(pack.name,0,36,27,UI_COLORS.cream,n,334,38);this.ui.text(`${displayGold(goldAmount(s,pack.price))} 金币`,0,-4,25,UI_COLORS.gold,n,332,34);this.ui.text(`今日剩余 ${remaining}/20`,0,-42,22,UI_COLORS.sand,n,330,32);});
      this.ui.text('每天北京时间 0 点更新 · 每种限购20次 · 礼包不计入招募保底',0,-276,25,UI_COLORS.sand,p,1120,72,true);return;
    }
    const showcase=this.ui.panel(-324,-46,438,270,p);
    if(pool==='turtle'){this.ui.portrait('bubble',0,5,190,showcase,true);this.ui.text('新的海岛伙伴',0,-106,24,UI_COLORS.ink,showcase,390,36);}
    else{(['strong','scatter','crystalCannon'] as const).forEach((id,i)=>{this.ui.bookIcon(id,-136+i*136,20,112,showcase);this.ui.text(['通用','珍贵','职业主动'][i],-136+i*136,-67,22,UI_COLORS.sand,showcase,126,34);});}
    this.ui.text(pool==='turtle'?'海岛伙伴招募':'海洋秘典',228,40,38,UI_COLORS.ink,p,584,54);
    this.ui.text(pool==='turtle'?'1～4技能伙伴 · 十次至少一只4技能以上':'通用被动与职业主动 · 点击规则查看概率',228,-24,25,UI_COLORS.sand,p,584,70,true);
    this.ui.text(`再招募 ${100-count%100} 次必得${pool==='turtle'?'6技能伙伴':'职业主动'}`,228,-91,26,UI_COLORS.gold,p,584,44);
    this.ui.panel(228,-143,520,10,p,'#C8DDDA');this.ui.panel(-32+260*(count%100)/100,-143,Math.max(6,520*(count%100)/100),10,p,UI_COLORS.green);
    this.button('规则 / 概率',-456,-276,230,p,()=>this.shopRules(pool));
    for(const [i,n] of ([1,10] as const).entries()){const cost=shopPrice(s,pool,n);this.button(`${n===1?'单次':'十次 · 九折'}\n${displayGold(cost)} 金币`,-64+i*444,-276,414,p,()=>{this.service.purchaseShop(this.command('shop'),pool,n);this.sound('purchase');this.shop(pool);},s.gold<cost||pool==='turtle'&&Object.keys(s.collection).length+n>s.capacity,true);}
  }
  private summonGallery(pool:'turtle'|'book'):void{
    this.ui.clear();const s=this.service.snapshot,p=this.ui.sceneSheet(pool==='turtle'?'海岛伙伴招募':'技能书祈愿',this.home,'market-pavilion'),count=pool==='turtle'?(s.shop?.turtleCount??0):(s.shop?.bookCount??0);
    this.ui.button('伙伴招募',-484,198,204,44,()=>this.shop('turtle'),{parent:p,selected:pool==='turtle',size:23});this.ui.button('技能书祈愿',-262,198,204,44,()=>this.shop('book'),{parent:p,selected:pool==='book',size:23});this.ui.button('补给礼包',-40,198,204,44,()=>this.shop('pack'),{parent:p,size:23});
    this.ui.atmosphere(p,'wish',-261,-27,540,350);const display=this.ui.group('祈愿展示',-261,-27,p,460,364);
    if(pool==='turtle')(['stone','spike','crystal'] as const).forEach((role,i)=>{const n=this.ui.group('伙伴:'+role,(i-1)*137,i===1?9:-13,display,163,218);this.ui.portrait(role,0,0,i===1?254:230,n,true);});
    else(['strong','hold','crystalCannon','combo','greatHeal'] as const).forEach((id,i)=>{const angle=i/5*Math.PI*2,x=Math.cos(angle)*158,y=Math.sin(angle)*119,n=this.ui.group('祈愿技能:'+id,x,y,display,103,103);this.ui.bookIcon(id,0,0,i===0?104:88,n);if(!this.ui.reducedMotion())tween(n).delay(i*.15).repeatForever(tween().by(1.2,{position:new Vec3(0,8,0)},{easing:'sineInOut'}).by(1.2,{position:new Vec3(0,-8,0)},{easing:'sineInOut'})).start();});
    const card=this.ui.panel(306,-12,489,323,p,'#FFF9EC',239,24);this.ui.text(pool==='turtle'?'下一位，命定伙伴':'让天赋成为力量',0,111,34,UI_COLORS.ink,card,448,48);this.ui.text(pool==='turtle'?'十次至少一位 4 技能伙伴':'通用被动 · 职业主动',0,53,25,UI_COLORS.sand,card,442,39);
    this.ui.text('再 '+(100-count%100)+' 次获得'+(pool==='turtle'?' 6 技能伙伴':'职业主动'),0,-11,23,'#008E94',card,436,42);this.ui.progress(0,-52,370,10,(count%100)/100,UI_COLORS.green,card);
    this.ui.button('查看完整概率',0,-111,300,43,()=>this.shopRules(pool),{parent:card,size:21});
    this.ui.icon('gold',-495,-287,35,p);this.ui.text(displayGold(s.gold),-405,-287,24,UI_COLORS.ink,p,138,36);
    ([1,10] as const).forEach((n,i)=>{const cost=shopPrice(s,pool,n);this.ui.button((n===1?'祈愿一次':'祈愿十次 · 九折')+'  '+displayGold(cost),-90+i*423,-287,397,68,()=>this.action(()=>{this.service.purchaseShop(this.command('shop'),pool,n);this.sound('purchase');WishSequence.play(this.ui,this.ui.root,pool,()=>this.shop(pool));}),{parent:p,primary:true,size:26,disabled:s.gold<cost||pool==='turtle'&&Object.keys(s.collection).length+n>s.capacity});});
  }
  private shopPacksV2():void{
    const s=this.service.snapshot;this.ui.clear();const p=this.ui.sceneSheet('商城',this.home,'market-pavilion');
    this.ui.icon('gold',-480,284,34,p);this.ui.text(displayGold(s.gold),-348,284,26,UI_COLORS.gold,p,210,40);
    this.ui.button('推荐礼包',-486,128,174,78,()=>this.shop('pack'),{parent:p,selected:true,size:27});
    this.ui.button('龟龟招募',-486,28,174,78,()=>this.shop('turtle'),{parent:p,size:27});
    this.ui.button('技能书祈愿',-486,-72,174,78,()=>this.shop('book'),{parent:p,size:25});
    this.ui.button('购买规则',-486,-230,174,62,()=>{const q=this.open('购买规则','',()=>this.shop('pack'));this.ui.text('每种礼包每日限购20次，北京时间0点刷新。\n金币购买后立即保存结果。礼包独立于招募保底。\n完整概率可在对应礼包详情中查看。',0,30,30,UI_COLORS.cream,q,1020,240,true);},{parent:p,size:24});
    const names=['1–4技能龟龟包','4–5技能龟龟包','随机技能包','攻击技能包','随机培养材料','培养组合礼包'];
    SHOP_PACKS.forEach((pack,i)=>{const remaining=packRemaining(s,Math.max(Date.now(),s.clockHighWater),pack.id),x=-216+i%3*306,y=105-Math.floor(i/3)*266,n=this.ui.button('',x,y,288,250,()=>this.packDetail(pack.id),{parent:p,surface:'paper'});
      this.ui.text(names[i],0,98,24,UI_COLORS.ink,n,252,34);const picture=this.ui.group('礼包物品图',0,17,n,132,132);if(i===2||i===3)this.ui.bookIcon(i===2?'strong':'combo',0,0,128,picture);else this.ui.art!.attach(picture,`shop-${i}` as ArtV2Slice,130,130);
      this.ui.icon('gold',-109,-58,28,n);this.ui.text(displayGold(goldAmount(s,pack.price)),-40,-58,24,UI_COLORS.ink,n,124,38);this.ui.text(`今日${remaining}/20`,81,-58,18,UI_COLORS.sand,n,105,30);
      this.ui.panel(0,-100,240,38,n,UI_COLORS.green,255,16);this.ui.text('查看',0,-100,21,'#FFFFFF',n,224,28);
    });
  }
  private packDetail(id:ShopPackId):void{
    const pack=SHOP_PACKS.find(p=>p.id===id)!,s=this.service.snapshot,remaining=packRemaining(s,Math.max(Date.now(),s.clockHighWater),id),cost=goldAmount(s,pack.price),p=this.open(pack.name,`今日剩余 ${remaining}/20 · 不计入招募保底`,()=>this.shop('pack'));
    this.ui.text(pack.description,0,40,32,UI_COLORS.cream,p,1060,240,true);
    if(id==='bookRandom'||id==='bookAttack')this.button('查看完整概率',0,-152,520,p,()=>this.packOdds(id));
    this.button(`购买并打开 · ${displayGold(cost)} 金币`,0,-276,760,p,()=>{this.service.purchaseShopPack(this.command('shopPack'),id);this.sound('purchase');this.shop('pack');},remaining<=0||s.gold<cost||(id==='turtleBasic'||id==='turtleAdvanced')&&Object.keys(s.collection).length>=s.capacity,true);
  }
  private packOdds(id:ShopPackId,page=0):void{
    const rows=packBookOdds(id),pages=Math.ceil(rows.length/20),index=Math.max(0,Math.min(page,pages-1)),p=this.open('技能包概率',`第 ${index+1}/${pages} 页 · 显示四舍五入，按完整权重抽取`,()=>this.packDetail(id));
    rows.slice(index*20,index*20+20).forEach((row,i)=>this.ui.text(`${SKILL_BY_ID[row.skillId].name}  ${(row.chance*100).toFixed(3)}%`,-278+(i%2)*556,174-Math.floor(i/2)*40,26,UI_COLORS.cream,p,526,38));
    this.button('上一页',-326,-276,280,p,()=>this.packOdds(id,index-1),index===0);this.button('返回礼包',0,-276,300,p,()=>this.packDetail(id));this.button('下一页',326,-276,280,p,()=>this.packOdds(id,index+1),index===pages-1);
  }
  private inspectBook(id:SkillId,back:()=>void):void{this.ui.skillDetail(id);}
  private shopRules(pool:ShopPool):void{
    const p=this.open('招募规则','金币招募，不设额外币种。',()=>this.shop(pool));
    const text=pool==='turtle'?'普通次数：1技能54%、2技能30%、3技能13%、4技能3%。\n十次购买内自然出现4技能或以上时，不额外增加伙伴。\n累计第100、200…次：该次替换为随机6技能龟。\n六技能不保证高天赋、满成长或完美搭配。':'普通次数：通用90%、职业主动10%，同类别内随机。\n商城不产出珍贵与专精；请通过副本、竞技场或世界挑战获取。\n十次至少一本攻击类书；累计第100、200…次必出一本主动书。\n两种保底可以在同一十次中生效，不额外扣费。';
    this.ui.text(text,0,30,29,UI_COLORS.cream,p,1100,330,true);this.button('知道了',0,-276,540,p,()=>this.shop(pool),false,true);
  }
  private confirmParents(page=0):void{
    const s=this.service.snapshot,[a,b]=this.parents.map(id=>s.collection[id]);if(!a||!b){this.chooseParents();return;}
    if(this.ui.art?.ready){this.confirmParentsModern(a,b);return;}
    const all=this.ordered().filter(t=>!t.locked),pages=Math.max(1,Math.ceil(all.length/3)),current=Math.max(0,Math.min(page,pages-1));
    const branches=previewFusion(a,b);let p:Node;if(this.ui.art?.ready){this.ui.clear();p=this.ui.sceneSheet('合成工坊',()=>this.chooseParents(),'fusion-background');}else p=this.open('局外合成',`点击亲本看资料；下方选择替换${this.parentSlot===0?'主龟':'副龟'}。`,()=>this.chooseParents());
    [a,b].forEach((t,i)=>{
      const x=this.ui.art?.ready?-400+i*800:-384+i*384,n=this.ui.button('',x,70,360,226,()=>this.inspect(t,()=>this.confirmParents(current)),{parent:p});
      this.ui.text(`${i===0?'主龟·60%造型':'副龟·40%造型'}`,0,86,28,UI_COLORS.gold,n,330,40);
      this.ui.pet(t,-100,3,104,n);this.ui.text(this.petName(t),60,28,28,UI_COLORS.cream,n,200,42);
      this.ui.text(`${t.skills.length}技能 · ${turtleQuality(t).score.toFixed(1)}分`,60,-20,26,UI_COLORS.sand,n,204,40);
      this.ui.text(`攻${t.innate.attack+t.training.attack} 生${t.innate.health+t.training.health} 防${t.innate.defense+t.training.defense}`,0,-78,26,UI_COLORS.sand,n,330,40);
      this.ui.button(`替换${i===0?'主龟':'副龟'}`,x,-88,340,60,()=>{this.parentSlot=i;this.confirmParents(current);},{parent:p,selected:this.parentSlot===i,size:28});
    });
    const previewX=this.ui.art?.ready?0:384,preview=this.ui.button('',previewX,70,360,226,()=>this.fusionDetails(a,b,()=>this.confirmParents(current)),{parent:p});
    this.ui.text('合成预览',0,86,30,UI_COLORS.gold,preview,330,40);
    branches.forEach((branch,i)=>{this.ui.portrait(branch.role,branches.length===1?0:-82+i*164,22,74,preview);this.ui.text(`${Math.round(branch.probability*100)}%`,branches.length===1?0:-82+i*164,-34,26,UI_COLORS.sand,preview,140,34);});
    this.ui.text(`最好 ${Math.max(...branches.flatMap(x=>x.counts.map(c=>c.value)))} 技能 · 点击看范围`,0,-78,26,UI_COLORS.sand,preview,340,40);
    this.ui.button('主副互换',previewX,-88,340,60,()=>{this.parents.reverse();this.confirmParents(current);},{parent:p,size:28});
    all.slice(current*3,current*3+3).forEach((t,i)=>{
      const n=this.ui.button('',-384+i*384,-180,360,102,()=>{const other=1-this.parentSlot;if(this.parents[other]===t.id)this.parents.reverse();else this.parents[this.parentSlot]=t.id;this.confirmParents(current);},{parent:p,selected:this.parents.includes(t.id)});
      this.ui.pet(t,-130,0,72,n);this.ui.text(this.petName(t),48,22,28,UI_COLORS.cream,n,236,36);this.ui.text(`${t.skills.length}技能 · 攻${t.innate.attack+t.training.attack} · 生${t.innate.health+t.training.health}`,48,-22,24,UI_COLORS.sand,n,244,34);
    });
    this.button('上一页',-464,-276,172,p,()=>this.confirmParents(current-1),current===0);
    this.button('下一页',-264,-276,172,p,()=>this.confirmParents(current+1),current===pages-1);
    const command=this.command('outsideFusion');this.button('确认合成',232,-276,620,p,()=>{this.service.startOutsideFusion(command,a.id,b.id);this.sound('fusionStart');this.resume();},false,true);
  }
  private confirmParentsModern(a:Turtle,b:Turtle):void{
    this.ui.clear();const p=this.ui.sceneSheet('合成工坊',()=>this.chooseParents(),'fusion-background'),branches=previewFusion(a,b);
    this.ui.atmosphere(p,'fusion',0,0,560,390);this.ui.panel(-378,1,332,450,p,'#FFF9EC',205,24);this.ui.panel(378,1,332,450,p,'#FFF9EC',205,24);this.ui.decoration('decor-seascape',-378,35,318,290,p);this.ui.decoration('decor-seascape',378,35,318,290,p);this.ui.panel(0,-26,360,204,p,'#FFF9EC',235,22);
    [a,b].forEach((t,i)=>{const x=i?378:-378,n=this.ui.group('合成亲本:'+t.id,x,23,p,294,330);this.ui.text(i?'副龟 · 40%造型':'主龟 · 60%造型',0,158,25,'#008B99',n,284,38);this.ui.portrait(t.role,0,27,238,n,true,t.skills.length>=10);this.ui.text(this.petName(t),0,-89,29,UI_COLORS.ink,n,278,40);this.ui.text('Lv.'+levelInfo(t).level+' · '+turtleQuality(t).name+' · '+t.skills.length+' 技能',0,-126,21,UI_COLORS.sand,n,286,34);this.ui.hover(n);n.on(Node.EventType.TOUCH_END,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t));this.ui.button(i?'替换副龟':'替换主龟',x,-179,258,44,()=>{this.parentSlot=i;this.chooseParents();},{parent:p,size:22});});
    this.ui.modernIcon(1,0,116,112,p);this.ui.text('相遇，孕育新伙伴',0,27,28,UI_COLORS.ink,p,410,43);
    const possible=branches.flatMap(x=>x.counts.filter(c=>c.probability>0).map(c=>c.value));this.ui.text('可能获得 '+Math.min(...possible)+'～'+Math.max(...possible)+' 个技能',0,-24,23,UI_COLORS.sand,p,400,37);
    this.ui.button('查看完整概率',0,-79,292,45,()=>this.fusionDetails(a,b,()=>this.confirmParentsModern(a,b)),{parent:p,size:23});this.ui.button('主副互换',0,-179,258,44,()=>{this.parents.reverse();this.confirmParents();},{parent:p,size:22});
    this.ui.text('揭晓后选择保留主龟、副龟或新伙伴之一；其余两位会离开。',0,-246,22,UI_COLORS.ink,p,1110,36);
    const command=this.command('outsideFusion');this.button('确认合成',0,-304,690,p,()=>{this.service.startOutsideFusion(command,a.id,b.id);this.sound('fusionStart');this.resume();},false,true);
  }
  private fusionDetails(a:Turtle,b:Turtle,back:()=>void,page=0):void{
    const branches=previewFusion(a,b),p=this.open('可能合成的结果','以下展示可能范围，不代表保底。',back);
    TALENT_KEYS.forEach((key,i)=>{const d=talentDistribution(a,b,key),ticks=(v:number)=>Math.max(0,Math.min(50,v-(key==='growth'?60:50))),y=176-i*45;
      this.ui.text(TALENT_NAMES[key],-459,y,23,UI_COLORS.ink,p,156,35);talentTickStars(this.ui,ticks(d[0].value),-255,y,p,20);this.ui.text('→',0,y,25,UI_COLORS.sand,p,60,33);talentTickStars(this.ui,ticks(d[d.length-1].value),196,y,p,20);
    });
    const counts=branches.flatMap(x=>x.counts.filter(c=>c.probability>0).map(c=>c.value));
    this.ui.text(Math.min(...counts)+'–'+Math.max(...counts)+'技能',0,-11,27,'#008B99',p,1000,38);
    this.ui.text(branches.map(x=>this.petName(x.role===a.role?a:b)+'造型 '+Math.round(x.probability*100)+'%').join('     ·     '),0,-53,24,UI_COLORS.ink,p,1080,38);
    const skills=Array.from(new Set(branches.flatMap(x=>x.pool))),pages=Math.max(1,Math.ceil(skills.length/12)),current=Math.max(0,Math.min(page,pages-1));
    this.ui.text('可能继承的技能 · 点击查看',0,-91,19,UI_COLORS.sand,p,1000,30);
    skills.slice(current*12,current*12+12).forEach((id,i)=>{const n=this.ui.button('',-465+i%6*186,-141-Math.floor(i/6)*78,174,66,()=>this.ui.skillDetail(id),{parent:p});this.ui.bookIcon(id,-53,0,46,n);this.ui.text(SKILL_BY_ID[id].name,29,0,19,UI_COLORS.ink,n,106,54,true);});
    this.button('返回合成台',0,-292,420,p,back,false,true);
    if(pages>1){this.ui.button('‹',-354,-292,94,47,()=>this.fusionDetails(a,b,back,current-1),{parent:p,disabled:current===0,size:24});this.ui.button('›',354,-292,94,47,()=>this.fusionDetails(a,b,back,current+1),{parent:p,disabled:current===pages-1,size:24});this.ui.text((current+1)+' / '+pages,493,-292,19,UI_COLORS.sand,p,120,30);}
  }
  skillInventory(category=0,page=0):void{
    this.inventoryReturn=()=>this.skillInventory(category,page);
    const s=this.service.snapshot,owned=SKILLS.filter(x=>(s.skillBooks?.[x.id]??0)>0),list=owned.filter(x=>category===0||category===1&&x.active||category===2&&x.specialization||category===3&&x.precious||category===4&&!x.active&&!x.specialization&&!x.precious);
    const pages=Math.max(1,Math.ceil(list.length/10));page=Math.max(0,Math.min(page,pages-1));
    const p=this.open('技能背包',`持有 ${owned.reduce((n,x)=>n+(s.skillBooks?.[x.id]??0),0)} 枚技能 · 点击图标查看与学习`,this.home);
    this.ui.button('礼包 '+Object.values(s.bookPacks??{}).reduce((n,v)=>n+(v??0),0),460,-279,160,48,()=>new RewardMenus(this.ui,this.service,this.command,this.error).packs(()=>this.skillInventory(category,page)),{parent:p,size:22});
    ['全部','职业主动','职业专精','珍贵技能','通用技能'].forEach((name,i)=>this.ui.button(name,-432+i*216,180,196,44,()=>this.skillInventory(i),{parent:p,primary:i===category,size:22}));
    if(!list.length){this.ui.bookIcon(category===2?'stoneMastery':'calm',0,30,112,p);this.ui.text('这里还没有技能，可从市场招募或冒险宝箱获得。',0,-86,24,UI_COLORS.sand,p,940,68,true);}
    list.slice(page*10,page*10+10).forEach((skill,i)=>{const n=this.ui.button('',-436+i%5*218,57-Math.floor(i/5)*183,200,166,()=>this.inventorySkill(skill.id,category,page),{parent:p});this.ui.bookIcon(skill.id,-24,23,86,n);this.ui.text('×'+s.skillBooks![skill.id],64,26,22,UI_COLORS.ink,n,57,37);this.ui.text(skill.name,0,-40,23,UI_COLORS.ink,n,190,33);this.ui.text(skillCategory(skill),0,-66,17,UI_COLORS.sand,n,185,25);});
    this.ui.button('上一页',-222,-279,180,48,()=>this.skillInventory(category,page-1),{parent:p,disabled:page===0,size:22});this.ui.text(`${page+1} / ${pages}`,0,-279,22,UI_COLORS.ink,p,146,34);this.ui.button('下一页',222,-279,180,48,()=>this.skillInventory(category,page+1),{parent:p,disabled:page+1>=pages,size:22});
  }
  private inventorySkill(id:SkillId,category:number,page:number):void{
    const skill=SKILL_BY_ID[id],d=this.ui.dialog(skill.name,skillCategory(skill),()=>d.parent?.destroy(),800,430);
    this.ui.bookIcon(id,-240,8,128,d);this.ui.text(skill.description,80,5,23,UI_COLORS.ink,d,442,170,true);
    this.ui.button('选择龟龟学习',0,-158,300,52,()=>{d.parent?.destroy();this.inventoryLearner(id,category,page);},{parent:d,primary:true,size:24});
  }
  private inventoryLearner(id:SkillId,category:number,page:number,petPage=0):void{
    const list=this.ordered(),pages=Math.max(1,Math.ceil(list.length/6));petPage=Math.max(0,Math.min(petPage,pages-1));
    const p=this.open('选择学习伙伴',SKILL_BY_ID[id].name+' · '+(SKILL_BY_ID[id].specialization?'保留职业主动，随机覆盖其他一个技能位':'随机覆盖一个现有技能位'),()=>this.skillInventory(category,page));
    list.slice(petPage*6,petPage*6+6).forEach((t,i)=>{const issue=skillBookIssue(t,id),n=this.ui.button('',-370+i%3*370,99-Math.floor(i/3)*190,350,164,()=>{this.selectedBook=id;this.skillBooks(t.id);},{parent:p,disabled:!!issue});this.ui.pet(t,-110,19,86,n);this.ui.text(this.petName(t),54,40,26,UI_COLORS.ink,n,214,39);this.ui.text(`${t.skills.length}技能 · ${turtleQuality(t).name}`,54,0,21,UI_COLORS.sand,n,214,34);this.ui.text(issue??'查看学习详情',0,-54,19,issue?UI_COLORS.muted:UI_COLORS.gold,n,325,40,true);});
    this.ui.button('上一页',-220,-279,180,48,()=>this.inventoryLearner(id,category,page,petPage-1),{parent:p,disabled:petPage===0,size:22});this.ui.text(`${petPage+1} / ${pages}`,0,-279,22,UI_COLORS.ink,p,150,34);this.ui.button('下一页',220,-279,180,48,()=>this.inventoryLearner(id,category,page,petPage+1),{parent:p,disabled:petPage+1>=pages,size:22});
  }
  skillBooks(id:string,page=0):void{
    const s=this.service.snapshot,t=s.collection[id];if(!t){this.collection();return;}
    const pending=s.bookReveal,books=SKILLS.filter(x=>(s.skillBooks?.[x.id]??0)>0),pages=Math.max(1,Math.ceil(books.length/3)),current=Math.max(0,Math.min(page,pages-1));
    if(pending){
      this.ui.clear();const cover=this.ui.art?.ready?this.ui.sceneSheet('技能蜕变',undefined,'fusion-background'):this.ui.sheet('技能蜕变','擦开泡泡，揭晓本次学习结果');
      this.ui.fusionCard(pending.turtle,cover);
      new BubbleReveal(this.ui,cover,pending.commandId,()=>this.action(()=>{this.service.finishBookReveal('bookReveal:'+pending.commandId);this.lastBook=pending.receipt;this.sound('learnComplete');this.skillBooks(id,current);}),this.available,()=>this.sound('rub'));
      return;
    }
    const p=this.open(`${this.petName(t)} · 学习技能书`,pending?'擦开泡泡查看技能变化；本次结果已经保存。':this.lastBook?.turtleId===id?`${SKILL_BY_ID[this.lastBook.replacedSkillId].name} → ${SKILL_BY_ID[this.lastBook.bookSkillId].name}，技能总数不变`:this.selectedBook&&SKILL_BY_ID[this.selectedBook].specialization?'专精占一个技能位；学习保留职业主动，随机覆盖其他一项。':'确认学习将随机覆盖一项；覆盖职业主动会使对应专精暂时失效。',pending?undefined:this.inventoryReturn??(()=>this.detail(id)));
    t.skills.forEach((skill,i)=>this.ui.skillTile(skill,-490+(i%6)*196,138-Math.floor(i/6)*126,p,78,178));
    this.ui.text(books.length?`技能书库存 · 第 ${current+1}/${pages} 页`:'还没有技能书，可从无尽宝藏和交易行获得',0,-82,28,UI_COLORS.sand,p,1100,40);
    books.slice(current*3,current*3+3).forEach((skill,i)=>{
      const issue=skillBookIssue(t,skill.id),n=this.ui.button('',-384+i*384,-169,360,104,()=>{this.selectedBook=skill.id;this.skillBooks(id,current);},{parent:p,disabled:!!pending||!!issue,selected:this.selectedBook===skill.id});
      this.ui.bookIcon(skill.id,-130,0,82,n);this.ui.text(`${skill.name} ×${s.skillBooks![skill.id]}`,45,22,25,UI_COLORS.cream,n,244,38);this.ui.text(issue??skillCategory(skill),45,-24,20,UI_COLORS.sand,n,244,36,true);
    });
    this.button('上一页',-460,-276,176,p,()=>this.skillBooks(id,current-1),current===0||!!pending);
    this.button('下一页',-252,-276,176,p,()=>this.skillBooks(id,current+1),current===pages-1||!!pending);
    const book=this.selectedBook,can=book&&!skillBookIssue(t,book)&&(s.skillBooks?.[book]??0)>0;
    const command=this.command('skillBook');
    this.button(pending?'继续打书':book?`确认学习「${SKILL_BY_ID[book].name}」`:'先选择一本技能书',230,-276,624,p,()=>{
      this.service.learnSkillBook(command,id,book!);this.sound('learn');
      this.selectedBook=undefined;this.skillBooks(id,current);
    },!!pending||!can,true);

  }
  /** Returns true when an unfinished permanent operation owns the screen. */
  resume():boolean{
    const s=this.service.snapshot;
    if(s.shop?.pending){this.shop(s.shop.pending.pool);return true;}
    if(s.outsideFusion){
      const e=s.outsideFusion;
      if(e.revealed){this.chooseSurvivor();return true;}
      let p:Node;
      if(this.ui.art?.ready){this.ui.clear();p=this.ui.sceneSheet('揭晓伙伴',undefined,'fusion-background');
        this.ui.fusionCard(e.candidate,p);e.parents.forEach((t,i)=>{const n=this.ui.panel(i===0?-469:469,0,228,364,p);this.ui.pet(t,0,34,146,n);this.ui.text(i===0?'主龟':'副龟',0,152,22,UI_COLORS.gold,n,238,38);this.ui.text(this.petName(t),0,-55,27,UI_COLORS.cream,n,238,42);this.ui.text(`${t.skills.length}技能`,0,-100,25,UI_COLORS.sand,n,238,36);});
      }else{p=this.open('泡泡里藏着新伙伴','结果已保存。揭晓后，从 A / B / C 中留下一个。');this.ui.fusionCard(e.candidate,p);}
      new BubbleReveal(this.ui,p,e.id,()=>this.action(()=>{this.service.revealOutsideFusion(`outsideReveal:${e.id}`);this.sound('fusionComplete');this.chooseSurvivor();}),this.available,()=>this.sound('rub'));
      if(this.ui.art?.ready)this.parentsEnterBubble(p,e.parents);return true;
    }
    if(s.bookReveal){this.skillBooks(s.bookReveal.turtle.id);return true;}
    return false;
  }
  /** Cosmetic copies converge; the saved candidate and interactive reveal never wait on animation. */
  private parentsEnterBubble(parent:Node,parents:readonly Turtle[]):void{
    parents.forEach((t,i)=>{
      const copy=this.ui.portrait(t.role,i===0?-424:424,65,198,parent,true,t.skills.length>=10);copy.name='亲本汇入泡泡';
      const opacity=copy.addComponent(UIOpacity);opacity.opacity=170;
      const motion=tween(copy).to(.9,{position:new Vec3(i===0?-40:40,0,0),scale:new Vec3(.35,.35,1)},{easing:'quadIn'}).call(()=>copy.destroy());
      const fade=tween(opacity).to(.75,{opacity:0},{easing:'quadIn'});
      copy.once(Node.EventType.NODE_DESTROYED,()=>{motion.stop();fade.stop();});motion.start();fade.start();
    });
  }
  private revealedShape():void{
    const e=this.service.snapshot.outsideFusion;if(!e)return;
    this.ui.clear();const p=this.ui.sceneSheet('新伙伴现身',undefined,'fusion-background');
    const shape=this.ui.portrait(e.candidate.role,0,0,340,p,true);this.ui.hover(shape);
    shape.on(Node.EventType.TOUCH_END,()=>this.chooseSurvivor());
    this.button('查看伙伴',0,-260,280,p,()=>this.chooseSurvivor(),false,true);
  }
  private chooseSurvivor():void{
    const e=this.service.snapshot.outsideFusion;if(!e||!e.revealed){this.refresh();return;}
    let p:Node;if(this.ui.art?.ready){this.ui.clear();p=this.ui.sceneSheet('合成结果 · 选择保留',undefined,'fusion-background');}else p=this.open('A / B / C，只留下一个','请先比较。确认留下后，另外两位将永久消耗。');
    const turtles=[...e.parents,e.candidate],letters=['A','B','C'] as const;
    turtles.forEach((t,i)=>{
      const x=-384+i*384,n=this.ui.panel(x,12,360,350,p,UI_COLORS.dark,248,18),q=turtleQuality(t);
      this.ui.text(`${letters[i]} · ${i===2?'合成结果':'原有伙伴'}`,0,138,32,UI_COLORS.ink,n,330,44);
      this.ui.portrait(t.role,0,54,112,n,true,t.skills.length>=10);
      this.ui.text(`${t.skills.length} 技能 · ${q.name}`,0,-28,30,UI_COLORS.ink,n,330,40);
      if(this.service.snapshot.livingVersion){this.ui.text('成长',-125,-68,22,UI_COLORS.ink,n,66,33);talentStars(this.ui,t,'growth',-14,-68,n,18);}else this.ui.text(`成长 ${((t.innate.growth+t.training.growth)/100).toFixed(2)}`,0,-68,28,UI_COLORS.ink,n,330,36);
      this.button('查看完整资料',0,-124,320,n,()=>this.inspect(t,()=>this.chooseSurvivor()));
      this.button('留下',x,-276,336,p,()=>this.confirmSurvivor(letters[i]),false,i===2);
    });
    if(this.ui.art?.ready)this.ui.panel(0,-198,940,54,p);this.ui.text('确认后仅保留一位，其余两位消耗。',0,-198,28,UI_COLORS.cream,p,1080,36);
  }
  private confirmSurvivor(choice:'A'|'B'|'C'):void{
    const e=this.service.snapshot.outsideFusion;if(!e)return;const kept=choice==='C'?e.candidate:e.parents[choice==='A'?0:1];
    this.ui.clear();const p=this.ui.dialog('确认留下','这一步会永久消耗另外两个个体。',()=>this.chooseSurvivor(),780,530);
    this.ui.pet(kept,0,24,124,p);
    this.ui.text(`留下 ${this.petName(kept)}\n其余两位消耗，无法恢复为两位亲本。`,0,-92,24,UI_COLORS.cream,p,700,88,true);
    const command=this.command('outsideKeep');
    this.button('返回比较',-188,-208,310,p,()=>this.chooseSurvivor());
    this.button('留下',188,-208,310,p,()=>{const t=this.service.keepOutsideFusion(command,choice);this.sound('reveal');this.parents=[];this.chooseParents();},false,true);
  }
  paintTurtle(t:Turtle,p:Node,summary?:string):void{
    const q=turtleQuality(t),value=(key:'attack'|'health'|'defense'|'growth')=>t.innate[key]+t.training[key];
    this.ui.pet(t,-422,32,224,p);
    this.ui.text(`${ROLES[t.role].job} · ${q.name}`,-422,-110,30,q.color,p,300,44);
    this.ui.text(`综合 ${q.score.toFixed(1)} 分`,-422,-156,28,UI_COLORS.sand,p,300,36);
    if(summary)this.ui.text(summary,0,180,22,UI_COLORS.sand,p,1080,38);else (['attack','health','defense','growth'] as const).forEach((key,i)=>{this.ui.text(['攻击','生命','防御','成长'][i],-480+i*287,207,18,UI_COLORS.ink,p,76,28);talentStars(this.ui,t,key,-373+i*287,207,p,18);});
    t.skills.forEach((id,i)=>this.ui.skillTile(id,-136+(i%4)*204,90-Math.floor(i/4)*128,p,82,178));
  }
  inspect(t:Turtle,back:()=>void):void{
    if(this.service.snapshot.livingVersion){new PetDetails(this.ui,this.service,this.command,this.error).show(t,{back});return;}
    const p=this.open(this.petName(t),`${ROLES[t.role].job} · ${t.skills.length} 项技能 · 品质仅供参考`,back);this.paintTurtle(t,p);
    this.button('返回比较',0,-276,424,p,back,false,true);
  }
  manage(id:string,back=this.refresh):void{
    const t=this.service.snapshot.collection[id];if(!t){back();return;}
    this.ui.clear();const p=this.ui.dialog('管理伙伴',this.petName(t),back,760,440);
    this.button('给伙伴改名',0,42,440,p,()=>this.rename(id,back));
    this.button(t.locked?'解除收藏锁定':'锁定收藏伙伴',0,-34,440,p,()=>{this.service.setLocked(this.command('lock'),id,!t.locked);this.ui.feedback?.('equip');back();});
    this.button('放弃这位收藏伙伴',0,-110,440,p,()=>this.confirmRelease(id,back),t.locked||Object.keys(this.service.snapshot.collection).length<=1);
    this.ui.text('收藏锁防止误操作，与本局备战栏的刷新锁分别生效。',0,-176,19,UI_COLORS.sand,p,660,42,true);
  }
  rename(id:string,back:()=>void):void{
    const t=this.service.snapshot.collection[id];if(!t){back();return;}
    const p=this.open('给伙伴改名','最多6个汉字或12个英文字符；改名不改变属性和概率。',back);
    this.ui.text(`原名：${this.petName(t)}`,0,120,32,UI_COLORS.cream,p,1060,90,true);
    const n=this.ui.panel(0,-2,1000,100,p),edit=n.addComponent(EditBox);
    const automaticLabels=[edit.textLabel?.node,edit.placeholderLabel?.node];
    edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=EditBox.InputFlag.DEFAULT;
    edit.textLabel=this.ui.text('',0,0,34,UI_COLORS.cream,n,940,80);edit.placeholderLabel=this.ui.text('输入新名字',0,0,34,UI_COLORS.muted,n,940,80);
    for(const label of automaticLabels)if(label){label.removeFromParent();label.destroy();}
    edit.maxLength=12;edit.string=t.name;edit.placeholder='输入新名字';this.ui.anchorInput?.(edit);
    const command=this.command('rename');this.button('保存名字',0,-250,480,p,()=>{this.service.rename(command,id,edit.string);back();},false,true);
  }
  private confirmRelease(id:string,back:()=>void):void{
    const t=this.service.snapshot.collection[id];if(!t){back();return;}
    this.ui.clear();const p=this.ui.dialog('确认放弃收藏伙伴','此操作会永久移除选中的个体。',()=>this.manage(id,back),760,480);
    this.ui.pet(t,0,10,124,p);this.ui.text(this.petName(t),0,-82,26,UI_COLORS.cream,p,650,46,true);
    const command=this.command('release');this.button('继续保留',-180,-174,290,p,back);
    this.button('确认放弃',180,-174,290,p,()=>{this.service.releaseTurtle(command,id);this.collection();});
  }
  takeaways(page=0):void{
    const s=this.service.snapshot,all=pendingTakeaways(s),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1));
    if(!all.length){this.home();return;}if(!all.some(u=>u.id===this.pendingSelection))this.pendingSelection=all[0].id;
    const p=this.open('整理上局伙伴',`收藏 ${Object.keys(s.collection).length}/50 · ${all.length} 位通关新伙伴等待决定`,this.home);
    all.slice(current*6,current*6+6).forEach((u,i)=>this.card(u.turtle,i,p,()=>{this.pendingSelection=u.id;this.takeaways(current);},this.pendingSelection===u.id));
    this.ui.text('整理现有收藏后可带回；放弃新伙伴不会删除原有收藏。',0,-202,28,UI_COLORS.sand,p,1080,36);
    this.button('上一页',-468,-276,152,p,()=>this.takeaways(current-1),current===0);
    this.button('下一页',-296,-276,152,p,()=>this.takeaways(current+1),current===pages-1);
    this.button('整理收藏',-84,-276,224,p,this.collection);
    this.button('带回',166,-276,224,p,()=>{this.service.takeHome(this.command('takeHome'),this.pendingSelection);this.takeaways(current);},Object.keys(s.collection).length>=50,true);
    this.button('放弃新龟',422,-276,240,p,()=>this.confirmDiscard(current));
  }
  private confirmDiscard(page:number):void{
    const id=this.pendingSelection,u=pendingTakeaways(this.service.snapshot).find(u=>u.id===id);if(!u){this.takeaways();return;}
    const p=this.open('确认不带走这位新伙伴','仅放弃本次通关的新个体，不影响原有收藏。',()=>this.takeaways(page));
    this.ui.pet(u.turtle,0,40,180,p);this.ui.text(this.petName(u.turtle),0,-106,34,UI_COLORS.cream,p,1080,90,true);
    const command=this.command('discardTakeaway');this.button('先保留决定',-264,-276,400,p,()=>this.takeaways(page));
    this.button('确认放弃新龟',264,-276,400,p,()=>{this.service.discardTakeaway(command,id);this.takeaways(page);});
  }
}
