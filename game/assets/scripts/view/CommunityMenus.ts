import {HonorBoard,HonorEntry} from './HonorBoard';
import {ShowcaseMenu} from './ShowcaseMenu';
import {showcasePets} from '../core/honor';
import {SeaChart} from './SeaChart';
import {loanLabel} from '../core/petAccess';
import {matchArena as findArenaOpponent} from '../core/arena';
import {arenaSettlementAt,arenaWeeklyGrants} from '../core/progression';
import {PetDetails} from './PetDetails';
import {RewardMenus,MenuTicker} from './RewardMenus';
import {ARENA_TIERS,arenaTier,arenaRankLabel,arenaLocked} from '../core/progression';
import {AchievementMenus} from './AchievementMenus';
import {visualName} from './VisualIdentity';
import {filterMarket} from '../core/marketView';
import type {Role} from '../core/types';
import {displayGold,goldAmount} from '../core/economy';
import {EditBox,Node,Mask,Graphics,EventTouch,EventMouse} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService,displayName} from '../core/game';
import {LOCAL_PLAYER,availablePets,petRanking,progressRanking,playerName,taxFor,usableLoans} from '../core/community';
import type {CommunityAction,Listing,PetChoice} from '../core/communityTypes';
import type {SkillId,Turtle} from '../core/types';
import {ROLES,SKILL_BY_ID,SKILLS} from '../core/data';
import {turtleQuality} from '../core/prototypeConfig';
import {RAIDS} from '../core/raids';

/** Local AI opponents are explicit. All economic changes go through the same saved transaction boundary. */
export class CommunityMenus {
  private marketAsset:'all'|'pet'|'book'='all';private marketRole:'all'|Role='all';private marketSearch='';private marketSort:'asc'|'desc'='asc';private raidTier=0;
  constructor(private ui:IslandUI,private service:GameService,private command:(kind:string)=>string,private available:()=>boolean,
    private home:()=>void,private inspect:(t:Turtle,back:()=>void)=>void,private challenge:(mode:'raid'|'arena')=>void,private error:(e:unknown,startNewBattle?:()=>void)=>void,private watch?:(id:string)=>void,private openRooms?:()=>void){}
  private petName(t:Turtle):string{return this.ui.art?.ready?visualName(t):displayName(t);}
  private get c(){return this.service.snapshot.community!;}
  private open(title:string,subtitle:string,back:()=>void=()=>this.home()):Node{this.ui.clear();return this.ui.sheet(title,subtitle,back);}
  private button(text:string,x:number,y:number,w:number,p:Node,action:()=>void,disabled=false,primary=false,h=88):Node{
    let n:Node;n=this.ui.button(text,x,y,w,h,()=>{if(this.available()&&this.ui.isInteractive(n))try{action();}catch(e){this.error(e);}},{parent:p,disabled,primary,size:h<80?26:28});return n;
  }
  private startBattle(mode:'raid'|'arena',start:(replacePending:boolean)=>unknown):void{
    const enter=(replacePending=false)=>{start(replacePending);this.challenge(mode);};
    try{enter();}catch(error){this.error(error,()=>enter(true));}
  }
  private dispatch(action:CommunityAction):unknown{
    const result=this.service.communityAction(this.command(action.kind),action);
    if(['buy','rent'].includes(action.kind))this.ui.feedback?.('purchase');
    else if(action.kind==='aiPurchase')this.ui.feedback?.('reward');
    else if(['assists','arenaDefense','arenaAttack','borrow','list','cancelListing'].includes(action.kind))this.ui.feedback?.('equip');
    return result;
  }
  private input(p:Node,text:string,y:number,placeholder:string,max=16):EditBox{
    const n=this.ui.panel(0,y,1024,88,p),edit=n.addComponent(EditBox),old=[edit.textLabel?.node,edit.placeholderLabel?.node];edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=EditBox.InputFlag.DEFAULT;
    edit.textLabel=this.ui.text('',0,0,32,UI_COLORS.cream,n,976,68);edit.placeholderLabel=this.ui.text('',0,0,30,UI_COLORS.muted,n,976,68);
    for(const label of old)if(label){label.removeFromParent();label.destroy();}edit.maxLength=max;edit.string=text;edit.placeholder=placeholder;this.ui.anchorInput?.(edit);return edit;
  }
  private pager(p:Node,page:number,pages:number,go:(n:number)=>void,y=-276):void{
    this.button('上一页',-468,y,176,p,()=>go(page-1),page===0);this.button('下一页',-260,y,176,p,()=>go(page+1),page>=pages-1);
  }
  entry(name:'friends'|'rankings'|'trade'|'rental'|'raids'|'arena'|'chat'|'rename'):void{
    this.dispatch({kind:this.service.snapshot.community?'refresh':'init'});
    if(name==='trade'||name==='rental')this.market(name);else if(name==='chat')this.chat('world');else if(name==='rename')this.rename();else if(name==='friends')this.friends();else if(name==='rankings')this.rankings();else if(name==='raids')this.openRooms?this.openRooms():this.raids();else this.arena();
  }
  main():void{
    this.dispatch({kind:this.service.snapshot.community?'refresh':'init'});const c=this.c,s=this.service.snapshot;
    const p=this.open('海岛广场',`${c.name} · ${s.gold} 金币 · 当前为本地AI测试世界`,this.home);
    const entries:[string,string,()=>void][]=[['好友与聊天','添加好友、援助与借用',()=>this.friends()],['交易行','龟龟和技能书 · 成交税20%',()=>this.market('trade')],['租赁市场','一场战斗 / 一小时',()=>this.market('rental')],['排行榜','宠物、关卡、无尽、竞技场',()=>this.rankings()],['海岛副本','组队匹配、邀请与 AI 补位',()=>this.openRooms?this.openRooms():this.raids()],['竞技场','安排五龟，突破三只获胜',()=>this.arena()]];
    entries.forEach(([name,tip,action],i)=>{const n=this.button('',-384+(i%3)*384,104-Math.floor(i/3)*192,360,p,action,false,false,176);this.ui.modernIcon([5,3,4,6,8,9][i],-111,12,78,n);this.ui.text(name,52,36,28,UI_COLORS.ink,n,216,44);this.ui.text(tip,52,-34,22,UI_COLORS.sand,n,216,74,true);});
    this.button('改岛主名',-404,-276,264,p,()=>this.rename());this.button('我的借用',-100,-276,264,p,()=>this.loans());
    const pending=c.raid&&!c.raid.settled?'raid':c.arena&&!c.arena.settled?'arena':undefined;
    this.button(pending?'继续未完挑战':'本地AI角色可交互',306,-276,480,p,()=>{if(pending)this.challenge(pending);},!pending,!!pending);
  }
  private rename():void{const p=this.open('修改岛主名','此名称用于聊天、交易和排行榜。'),edit=this.input(p,this.c.name,36,'输入岛主名字');this.button('保存名字',0,-250,520,p,()=>{this.dispatch({kind:'renamePlayer',name:edit.string});this.home();},false,true);}
  private friends(page=0):void{
    const c=this.c,all=Object.values(c.aiPlayers),pages=Math.ceil(all.length/6),current=Math.max(0,Math.min(page,pages-1)),p=this.open('好友与聊天','本地AI岛主；聊天回复为本地模拟。');
    all.slice(current*6,current*6+6).forEach((a,i)=>{const n=this.button('',-384+(i%3)*384,104-Math.floor(i/3)*192,360,p,()=>this.friend(a.id),false,false,176);this.ui.portrait(Object.values(a.pets)[0].role,-109,20,94,n);this.ui.text(a.name,55,40,28,UI_COLORS.cream,n,202,42);const badge=this.ui.panel(55,-3,178,32,n,c.friends.includes(a.id)?UI_COLORS.green:'#E9F3F0',245,14);this.ui.text(c.blocked.includes(a.id)?'已屏蔽':c.friends.includes(a.id)?'我的好友':'添加好友',0,0,20,c.friends.includes(a.id)?'#FFFFFF':UI_COLORS.sand,badge,168,29);this.ui.line(-150,-38,150,-38,n);this.ui.text(`援助伙伴 ${a.assists.length} 只   ›`,0,-62,22,UI_COLORS.gold,n,310,32);});
    this.pager(p,current,pages,n=>this.friends(n));this.button('世界聊天',40,-276,248,p,()=>this.chat('world'));
    this.button('我的援助·3只',358,-276,360,p,()=>this.pick('设置三只援助伙伴',[...c.assists],3,false,ids=>{this.dispatch({kind:'assists',ids});this.friends();},()=>this.friends()));
  }
  private friend(id:string):void{
    const c=this.c,a=c.aiPlayers[id],isFriend=c.friends.includes(id),blocked=c.blocked.includes(id),p=this.open(a.name,'援助仅限关卡、无尽；1小时内出发，不影响主人使用。',()=>this.friends());
    a.assists.map(id=>a.pets[id]).filter(Boolean).forEach((t,i)=>{const n=this.button('',-384+i*384,76,360,p,()=>this.inspect(t,()=>this.friend(id)),false,false,246);this.ui.pet(t,0,46,112,n);this.ui.text(`${this.petName(t)} · ${t.skills.length}技能`,0,-42,28,UI_COLORS.cream,n,336,48);this.ui.text(`评分 ${turtleQuality(t).score.toFixed(1)}`,0,-94,27,UI_COLORS.sand,n,336,36);this.button('借用一次',-384+i*384,-116,340,p,()=>{this.dispatch({kind:'borrow',ownerId:id,petId:t.id});this.loans();},!isFriend||blocked,false);});
    this.button(isFriend?'移除好友':'添加好友',-390,-276,300,p,()=>{this.dispatch({kind:'friend',id,action:isFriend?'remove':'add'});this.friend(id);},blocked);
    this.button('发送消息',0,-276,300,p,()=>this.chat(id),!isFriend||blocked,true);
    this.button(blocked?'解除屏蔽':'屏蔽',390,-276,300,p,()=>{this.dispatch({kind:'friend',id,action:blocked?'unblock':'block'});this.friend(id);});
  }
  private chat(to:string):void{
    const c=this.c,lines=c.messages.filter(m=>to==='world'?m.to==='world':m.from===to&&m.to===LOCAL_PLAYER||m.from===LOCAL_PLAYER&&m.to===to).slice(-4);
    const p=this.open(to==='world'?'世界聊天':`与 ${c.aiPlayers[to].name} 聊天`,'AI回复为本地测试，未连接真人聊天服务器。',()=>this.friends());
    if(!lines.length)this.ui.text('打个招呼，聊聊合成、援助或副本吧。',0,106,30,UI_COLORS.sand,p,1080,64);
    lines.forEach((line,i)=>{const n=this.ui.panel(0,130-i*78,1096,70,p);this.ui.text(`${playerName(this.service.snapshot,line.from)}：${line.text}`,0,0,25,line.from===LOCAL_PLAYER?UI_COLORS.gold:UI_COLORS.cream,n,1060,64,true);});
    const edit=this.input(p,'',-196,'输入消息，最多120字',120);this.button('发送',0,-286,520,p,()=>{this.dispatch({kind:'chat',to,text:edit.string});this.chat(to);},false,true,76);
  }
  private loans(page=0):void{
    const s=this.service.snapshot,all=this.c.loans.slice().reverse(),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1)),p=this.open('我的借用','借用和租赁仅限关卡、无尽；副本和竞技场仅可使用自有龟。');
    all.slice(current*6,current*6+6).forEach((l,i)=>{const usable=!l.finished&&!l.usedBy&&l.expiresAt>s.clockHighWater,n=this.button('',-384+(i%3)*384,104-Math.floor(i/3)*192,360,p,()=>this.inspect(l.turtle,()=>this.loans(current)),false,false,176);this.ui.pet(l.turtle,-112,0,100,n);this.ui.text(this.petName(l.turtle),62,50,30,UI_COLORS.cream,n,212,46);this.ui.text(usable?`剩余${Math.ceil((l.expiresAt-s.clockHighWater)/60000)}分钟`:l.usedBy&&!l.finished?'本次战斗使用中':'已用完或到期',62,0,24,UI_COLORS.gold,n,216,48,true);this.ui.text(l.kind==='rental'?'租赁伙伴':'好友援助',62,-57,26,UI_COLORS.sand,n,214,36);});
    if(!all.length)this.ui.text('还没有借用伙伴，去好友援助栏或租赁市场看看。',0,0,32,UI_COLORS.sand,p,1080,112,true);
    this.pager(p,current,pages,n=>this.loans(n));this.button('返回海岛出战',230,-276,616,p,this.home,false,true);
  }
  private market(kind:'trade'|'rental',page=0,mine=false):void{
    const c=this.c,s=this.service.snapshot,all=filterMarket(c.listings,{kind,mine,ownerId:LOCAL_PLAYER,asset:this.marketAsset,role:this.marketRole,search:this.marketSearch,sort:this.marketSort}),pages=Math.max(1,Math.ceil(all.length/4)),current=Math.max(0,Math.min(page,pages-1));
    const p=this.open(mine?(kind==='rental'?'我的租赁':'我的上架'):kind==='rental'?'租赁市场':'交易行',`${displayGold(s.gold)} 金币 · 成交税20% · ${current+1}/${pages}页${kind==='rental'?` · 今日租 ${c.daily.borrowed}/5`:''}`);
    if(kind==='trade')(['all','pet','book'] as const).forEach((asset,i)=>this.button(['全部','龟龟','技能书'][i],-460+i*184,170,172,p,()=>{this.marketAsset=asset;this.market(kind,0,mine);},false,this.marketAsset===asset,56));
    else{const roles:('all'|Role)[]=['all','stone','spike','crystal','leaf','bubble'];this.button(`造型：${this.marketRole==='all'?'全部':ROLES[this.marketRole].name} · 点击切换`,-276,170,536,p,()=>{this.marketRole=roles[(roles.indexOf(this.marketRole)+1)%roles.length];this.market(kind,0,mine);},false,false,56);}
    this.button(this.marketSort==='asc'?'价格 ↑ 由低到高':'价格 ↓ 由高到低',322,170,450,p,()=>{this.marketSort=this.marketSort==='asc'?'desc':'asc';this.market(kind,0,mine);},false,false,56);
    const input=this.ui.panel(-182,104,744,56,p),edit=input.addComponent(EditBox),old=[edit.textLabel?.node,edit.placeholderLabel?.node];edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=EditBox.InputFlag.DEFAULT;
    edit.textLabel=this.ui.text('',0,0,26,UI_COLORS.cream,input,704,44);edit.placeholderLabel=this.ui.text('',0,0,26,UI_COLORS.muted,input,704,44);for(const label of old)if(label){label.removeFromParent();label.destroy();}
    edit.maxLength=32;edit.string=this.marketSearch;edit.placeholder='搜索名称或职业';this.ui.anchorInput?.(edit);
    this.button('搜索',306,104,200,p,()=>{this.marketSearch=edit.string;this.market(kind,0,mine);},false,true,56);this.button('清空',480,104,136,p,()=>{this.marketSearch='';this.market(kind,0,mine);},false,false,56);
    all.slice(current*4,current*4+4).forEach((l,i)=>{const n=this.button('',-280+(i%2)*560,-14-Math.floor(i/2)*148,540,p,()=>this.listing(l.id,kind,mine),false,false,132);
      if(l.pet)this.ui.pet(l.pet,-208,0,92,n);else this.ui.bookIcon(l.skillId!,-208,0,86,n);
      this.ui.text(l.pet?this.petName(l.pet):SKILL_BY_ID[l.skillId!].name+'书',60,36,29,UI_COLORS.cream,n,386,42);
      this.ui.text(`${displayGold(l.price)} 金币`,60,-6,28,UI_COLORS.gold,n,386,38);this.ui.text(playerName(s,l.ownerId),60,-44,23,UI_COLORS.sand,n,386,32);
    });
    if(!all.length)this.ui.text('没有符合条件的商品，试试其他筛选。',0,-64,30,UI_COLORS.sand,p,1080,88);
    this.pager(p,current,pages,n=>this.market(kind,n,mine));this.button(mine?'看市场':kind==='rental'?'我的租赁':'我的上架',0,-276,240,p,()=>this.market(kind,0,!mine));
    this.button(kind==='rental'?'我要租赁':'我要上架',268,-276,240,p,()=>this.listForm(kind==='rental'?'rental':'pet'));this.button('账本',492,-276,152,p,()=>this.receipts());
  }
  private listing(id:string,kind:'trade'|'rental',mine:boolean):void{
    const s=this.service.snapshot,l=this.c.listings.find(x=>x.id===id);if(!l||l.status!=='listed'){this.market(kind,0,mine);return;}
    const p=this.open(l.kind==='book'?`${SKILL_BY_ID[l.skillId!].name}技能书`:this.petName(l.pet!),`持有人：${playerName(s,l.ownerId)}`,()=>this.market(kind,0,mine));
    if(l.pet)this.ui.pet(l.pet,0,98,144,p);else this.ui.bookIcon(l.skillId!,0,108,136,p);
    this.ui.text(`${l.price} 金币 · 税 ${taxFor(l.price)} · 出售者实收 ${l.price-taxFor(l.price)}`,0,-10,30,UI_COLORS.gold,p,1100,58);
    this.ui.text(l.kind==='rental'?'仅限关卡、无尽；一场战斗或一小时内有效，不影响主人使用。\n每天最多租五只，同一本体每天最多被租五次。':l.kind==='book'?SKILL_BY_ID[l.skillId!].description:'成交后，这只龟将完整转移给买家。',0,-112,28,UI_COLORS.sand,p,1080,114,true);
    if(l.pet)this.button('查看技能与天赋',-366,-276,348,p,()=>this.inspect(l.pet!,()=>this.listing(id,kind,mine)));
    if(mine){this.button('下架取回',0,-276,300,p,()=>{this.dispatch({kind:'cancelListing',id});this.market(kind,0,true);});this.button('找AI试购',366,-276,348,p,()=>{this.dispatch({kind:'aiPurchase',id});this.receipts();},false,true);}
    else this.button(l.kind==='rental'?'确认租赁':'确认购买',220,-276,616,p,()=>{this.dispatch({kind:l.kind==='rental'?'rent':'buy',id});l.kind==='rental'?this.loans():this.receipts();},s.gold<l.price,true);
  }
  private listForm(asset:'pet'|'book'|'rental',selected='',price=''):void{
    const s=this.service.snapshot,p=this.open(asset==='rental'?'上架出租':'上架交易','成交税20%，税费向上取整为整数金币；上架前可以返回取消。',()=>this.market(asset==='rental'?'rental':'trade',0,true));
    if(asset!=='rental'){this.button('出售龟龟',-264,142,448,p,()=>this.listForm('pet'),false,asset==='pet');this.button('出售技能书',264,142,448,p,()=>this.listForm('book'),false,asset==='book');}
    const name=selected?(asset==='book'?SKILL_BY_ID[selected as SkillId]?.name+'技能书':s.collection[selected]?this.petName(s.collection[selected]):'已不在收藏'):'选择要上架的物品';
    this.button(name,0,28,1040,p,()=>asset==='book'?this.pickBook(id=>this.listForm(asset,id,price)):this.pick('选择自有龟上架',selected?[selected]:[],1,false,ids=>this.listForm(asset,ids[0],price),()=>this.listForm(asset,selected,price)),false,false);
    const edit=this.input(p,price,-94,'输入金币价格',12);this.ui.text('输入整数金币价格。出售龟龟会先离开收藏，进入交易托管。',0,-190,26,UI_COLORS.sand,p,1080,60,true);
    this.button('确认上架',0,-276,616,p,()=>{this.dispatch({kind:'list',asset,id:selected,price:Number(edit.string)});this.market(asset==='rental'?'rental':'trade',0,true);},!selected,true);
  }
  private pickBook(done:(id:string)=>void,page=0):void{
    const s=this.service.snapshot,all=SKILLS.filter(x=>(s.skillBooks?.[x.id]??0)>0),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1)),p=this.open('选择技能书','每次上架一本书。');
    all.slice(current*6,current*6+6).forEach((skill,i)=>{this.button(`${skill.name}\n持有 ${s.skillBooks![skill.id]} 本`,-384+(i%3)*384,104-Math.floor(i/3)*192,360,p,()=>done(skill.id),false,false,176);});
    if(!all.length)this.ui.text('还没有可出售的技能书',0,0,34,UI_COLORS.sand,p,1080,80);this.pager(p,current,pages,n=>this.pickBook(done,n));
  }
  private receipts(page=0):void{
    const rows=this.c.receipts.slice().reverse(),pages=Math.max(1,Math.ceil(rows.length/5)),current=Math.max(0,Math.min(page,pages-1)),p=this.open('交易账本',`当前金币 ${this.service.snapshot.gold} · 每笔税费与实收永久记录`);
    rows.slice(current*5,current*5+5).forEach((r,i)=>{const names={buy:'买入',sell:'卖出',rent:'租入',rentalIncome:'出租收入'};this.ui.text(`${names[r.kind]} · ${playerName(this.service.snapshot,r.otherId)} · 成交 ${r.gross} · 税 ${r.tax} · 卖方净收 ${r.net}`,0,142-i*74,27,UI_COLORS.cream,p,1096,58,true);});
    if(!rows.length)this.ui.text('还没有交易记录',0,0,34,UI_COLORS.sand,p,1080,80);this.pager(p,current,pages,n=>this.receipts(n));
  }
  private rankings(kind:'pet'|'chapter'|'endless'|'arena'='pet',page=0):void{
    if(kind==='arena'){this.arena();return;}
    this.dispatch({kind:'refresh'});this.ui.clear();const s=this.service.snapshot,c=this.c,back=()=>this.rankings(kind);
    const board=new HonorBoard(this.ui,'海岛荣耀榜','',this.home,kind==='pet');
    board.tabs(({pet:'宠物',chapter:'关卡',endless:'无尽'} as const)[kind],label=>this.rankings(({宠物:'pet',关卡:'chapter',无尽:'endless',竞技场:'arena'} as const)[label]??'pet'));
    const rows:HonorEntry[]=kind==='pet'?petRanking(s).map((r,i)=>({id:r.ownerId,rank:i+1,name:r.ownerName,subject:this.petName(r.turtle),metric:'评分 '+r.score.toFixed(1),pets:r.ownerId===LOCAL_PLAYER?showcasePets(s,r.turtle):[r.turtle],rotate:r.ownerId===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:pet=>new PetDetails(this.ui,this.service,this.command,this.error).show(pet??r.turtle,{readOnly:r.ownerId!==LOCAL_PLAYER})})):
      progressRanking(s,kind).map((r,i)=>{const pets=r.id===LOCAL_PLAYER?showcasePets(s):Object.values(c.aiPlayers[r.id]?.pets??{}).slice(i%5,i%5+1);return {id:r.id,rank:i+1,name:r.name,metric:kind==='chapter'?'第 '+(r.progress+1)+' 关':r.progress+' 波',detail:r.seconds.toFixed(1)+' 秒',pets,rotate:r.id===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:(pet?:Turtle)=>{if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet,{readOnly:r.id!==LOCAL_PLAYER});else this.ui.toast('该岛主暂未公开展示伙伴');}};});
    board.winners(rows.slice(0,3));board.list(rows.slice(3),kind==='pet'?'伙伴评分榜':kind==='chapter'?'关卡远征榜':'无尽远征榜');
    const ours=rows.find(r=>r.id===LOCAL_PLAYER),menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error);
    board.footer(ours?String(ours.rank):'未上榜',ours?.metric??'完成挑战，争取登台',showcasePets(s)[0],()=>menu.open(back),c.showcase?.rotate??true,()=>menu.toggle(back));
    board.button(c.hideRankings?'公开上榜':'隐藏资料',505,kind==='pet'?-310:-296,143,42,()=>{this.dispatch({kind:'rankVisibility',hidden:!c.hideRankings});back();});
  }
  private rankPet(t:Turtle,ownerId:string):void{
    this.inspect(t,()=>this.rankings());if(ownerId===LOCAL_PLAYER){const hidden=this.c.hiddenPets.includes(t.id);this.button(hidden?'让这只龟上榜':'这只龟不上榜',0,-202,560,this.ui.root,()=>{this.dispatch({kind:'rankVisibility',petId:t.id,hidden:!hidden});this.rankings();},false,false,60);}
  }
  private raids():void{
    // 副本入口沿用已确认的海图布局；地图上的四个岛屿同时承担选关和主题展示。
    // 这里只替换页面呈现，备战、AI 补位和战斗流程仍走原有本地副本逻辑。
    const c=this.c;
    this.ui.clear();
    const chart=new SeaChart(this.ui,'chart-raid','海岛副本','五人同行 · 探索秘境',this.home,()=>!!this.service.snapshot.settings.reducedMotion),p=chart.root;
    const positions:[number,number][]=[[-441,-93],[-81,-10],[218,110],[475,32]];
    RAIDS.forEach((raid,index)=>{const [x,y]=positions[index];
      chart.tag(raid.name,x,y,182,index===this.raidTier,()=>{this.raidTier=index;this.raids();});
      this.ui.panel(x,y-35,182,26,p,'#FFF9EC',232,11);
      this.ui.text(index===3?'180 秒 · 双庭围攻':raid.waves+' 波 · 难度 '+(index+1),x,y-35,17,UI_COLORS.ink,p,195,28);
    });
    chart.boat(-232,-161,155);
    this.ui.panel(99,-180,375,43,p,'#FFF9EC',236,16);
    this.ui.text(RAIDS[this.raidTier].name+' · 五人小队',99,-180,24,UI_COLORS.ink,p,650,40);
    chart.button('副本宝箱',-342,-275,223,52,()=>new RewardMenus(this.ui,this.service,this.command,this.error).boxes('raid',()=>this.raids(),this.raidTier));
    chart.button('组队挑战',0,-275,330,59,()=>this.pick(RAIDS[this.raidTier].name+' · 选择五只自有龟备战',Object.keys(this.service.snapshot.collection).slice(0,5),5,false,ids=>{
      const command=this.command('raid');this.startBattle('raid',replace=>this.service.beginRaid(command,this.raidTier,ids,replace));
    },()=>this.raids(),0,true),true);
    chart.button('队伍 / 邀请',342,-275,223,52,()=>this.openRooms?this.openRooms():this.ui.toast('试玩版使用本地 AI，请点击组队挑战'));
    if(c.raid&&!c.raid.settled)chart.button('继续当前副本',0,-214,300,42,()=>this.challenge('raid'));
  }  private arena():void{
    if(this.ui.art?.ready){this.arenaV2();return;}
    const c=this.c,ours=c.arenaOrder.indexOf(LOCAL_PLAYER),p=this.open('竞技场',`当前第 ${ours+1} 名 · 可挑战前面三名 · 进攻顺序固定，突破三只获胜`);
    c.arenaOrder.slice(Math.max(0,ours-3),Math.min(c.arenaOrder.length,ours+2)).filter(id=>id!==LOCAL_PLAYER||!c.hideRankings).forEach((id,i)=>{
      const rank=c.arenaOrder.indexOf(id)+1,n=this.button('',0,128-i*72,1096,p,()=>id===LOCAL_PLAYER?this.defensePreview():this.arenaOpponent(id),false,false,64);
      this.ui.text(`第 ${rank} 名 · ${playerName(this.service.snapshot,id)}${id===LOCAL_PLAYER?'（你）':rank<ours+1?' · 查看防守并挑战':''}`,0,0,28,id===LOCAL_PLAYER?UI_COLORS.gold:UI_COLORS.cream,n,1060,52);
    });
    this.button('设置防守站位',-358,-276,352,p,()=>this.pick('防守站位：顺序对应位置1–5',c.arenaDefense.length===5?[...c.arenaDefense]:Object.keys(this.service.snapshot.collection).slice(0,5),5,false,ids=>{this.dispatch({kind:'arenaDefense',ids});this.defensePreview();},()=>this.arena(),0,true));
    this.button('设置进攻顺序',22,-276,352,p,()=>this.pick('进攻顺序：1–5依次进场',[...c.arenaAttack],5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});this.arena();},()=>this.arena(),0,true));
    this.button(c.arena&&!c.arena.settled?'继续挑战':'查看其他榜',402,-276,300,p,()=>c.arena&&!c.arena.settled?this.challenge('arena'):this.rankings());
  }
  private arenaV2(tierPage?:number):void{
    if(tierPage!==undefined){this.arenaDetails(tierPage);return;}
    this.service.refreshClock(this.command('arenaClock'));this.ui.clear();const s=this.service.snapshot,c=this.c,a=s.progression!.arena,locked=arenaLocked(s.clockHighWater),back=()=>this.arenaV2();
    const board=new HonorBoard(this.ui,'竞技场 · 王者之巅','',this.home);
    const rows:HonorEntry[]=c.arenaOrder.filter(id=>id!==LOCAL_PLAYER||!c.hideRankings).map((id,i)=>({id,rank:i+1,name:playerName(s,id),metric:id===LOCAL_PLAYER?arenaRankLabel(a.rating):'本地 AI · 第 '+(i+1)+' 名',pets:id===LOCAL_PLAYER?showcasePets(s):Object.values(c.aiPlayers[id]?.pets??{}).slice(i%5,i%5+1),rotate:id===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:pet=>this.arenaRankDetail(id,pet)}));
    board.winners(rows.slice(0,3));board.list(rows.slice(3),'本周排名');
    const menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error);
    board.footer(c.hideRankings?'未公开':String(c.arenaOrder.indexOf(LOCAL_PLAYER)+1),arenaRankLabel(a.rating),showcasePets(s)[0],()=>menu.open(back),c.showcase?.rotate??true,()=>menu.toggle(back),true);
    const own=c.arenaAttack.length===5?[...c.arenaAttack]:Object.keys(s.collection).slice(0,5);
    board.button('进攻阵容',-454,-335,205,36,()=>this.pick('进攻阵容',own,5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});back();},back,0,true));
    board.button('防守阵容',-231,-335,205,36,()=>this.pick('防守阵容',c.arenaDefense.length===5?[...c.arenaDefense]:own,5,false,ids=>{this.dispatch({kind:'arenaDefense',ids});back();},back,0,true));
    board.button(c.arena&&!c.arena.settled?'继续对战':locked?'周一开启':'开始匹配',52,-335,322,36,()=>{if(c.arena&&!c.arena.settled)this.challenge('arena');else this.arenaMatching();},true,board.root,locked&&!(c.arena&&!c.arena.settled));
    board.button('段位 / 结算奖励',393,-335,310,36,()=>this.arenaDetails());
    const clockPanel=this.ui.panel(-28,258,750,35,board.root,'#FFF9EC',234,16);
    const countdown=this.ui.text('',0,0,16,UI_COLORS.ink,clockPanel,728,30),tick=()=>{const remain=Math.max(0,arenaSettlementAt(Date.now())-Date.now()),h=Math.floor(remain/3600000);countdown.string=locked?'本周已结算 · 奖励投递邮箱':'本地 AI 排位 · 本周结算倒计时 '+Math.floor(h/24)+'天 '+h%24+'时 '+Math.floor(remain/60000)%60+'分';};board.root.addComponent(MenuTicker).step=tick;tick();
  }
  private arenaRankDetail(id:string,pet?:Turtle):void{
    const s=this.service.snapshot,c=this.c,own=id===LOCAL_PLAYER,p=this.ui.dialog(playerName(s,id)+' · 荣誉阵容','点击伙伴查看天赋、加点与技能',()=>p.parent?.destroy(),1060,560);
    const pets=own?c.arenaDefense.map(id=>s.collection[id]).filter(Boolean):Object.values(c.aiPlayers[id]?.pets??{}).slice(0,5);
    pets.forEach((t,i)=>{const n=this.ui.button('',-410+i*205,20,187,223,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{readOnly:!own}),{parent:p});this.ui.portrait(t.role,0,20,155,n,true,t.skills.length>=10);this.ui.text(this.petName(t),0,-74,21,UI_COLORS.ink,n,176,32);});
    if(pet)this.ui.text('当前展示：'+this.petName(pet),0,-143,23,UI_COLORS.gold,p,830,40);
    this.ui.button('查看展示伙伴',-226,-205,380,46,()=>{if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet,{readOnly:!own});},{parent:p,disabled:!pet,size:23});
    this.ui.button(own?'我的防守':'查看对方战斗',226,-205,380,46,()=>{p.parent?.destroy();if(own)this.defensePreview();else this.arenaOpponent(id);},{parent:p,primary:true,size:23});
  }
  private arenaDetails(tierPage?:number):void{
    this.service.refreshClock(this.command('arenaClock'));const c=this.c,s=this.service.snapshot,a=s.progression!.arena,current=arenaTier(a.rating),tier=tierPage??current,locked=arenaLocked(s.clockHighWater);this.ui.clear();const p=this.ui.sceneSheet('竞技场 · 潮汐赛季',()=>this.arenaV2(),'arena-background'),rewards=new RewardMenus(this.ui,this.service,this.command,this.error);
    const left=this.ui.panel(-361,-4,397,442,p,'#FFF9EC',246,22);this.ui.text('我的段位 · '+ARENA_TIERS[current].name,0,186,23,UI_COLORS.ink,left,354,38);this.ui.modernIcon(6,0,101,105,left);this.ui.text(ARENA_TIERS[tier].name,0,15,35,UI_COLORS.ink,left,340,52);this.ui.text(tier===current?arenaRankLabel(a.rating):'每小段 3 星 · III → II → I',0,-30,23,UI_COLORS.sand,left,337,35);
    this.ui.button('‹',-148,31,47,58,()=>this.arenaV2(Math.max(0,tier-1)),{parent:left,disabled:tier===0,size:30});this.ui.button('›',148,31,47,58,()=>this.arenaV2(Math.min(5,tier+1)),{parent:left,disabled:tier===5,size:30});
    let start=0;left.on(Node.EventType.TOUCH_START,(e:EventTouch)=>start=e.getLocation().x);left.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{const d=e.getLocation().x-start;if(Math.abs(d)>60)this.arenaV2(Math.max(0,Math.min(5,tier+(d<0?1:-1))));});
    const claimed=a.tierClaims.includes(tier),eligible=a.games>0&&a.best>=ARENA_TIERS[tier].min&&!claimed,grants=[{kind:'gold' as const,amount:goldAmount(s,80+tier*90)},{kind:'material' as const,material:'attack' as const,amount:1+tier}];
    this.ui.button(claimed?'段位宝箱 · 已领取':eligible?'领取段位宝箱':'查看段位宝箱',0,-96,324,49,()=>rewards.detail(ARENA_TIERS[tier].name+' 段位宝箱',grants,eligible?()=>{this.service.claimArenaTier(this.command('tierChest'),tier);this.ui.feedback?.('chest');this.arenaV2(tier);}:undefined,claimed?'本赛季已经领取':'本赛季首次达到该段位即可领取'),{parent:left,primary:eligible,size:23});
    this.ui.text((tier+1)+' / 6 · 左右滑动查看',0,-151,18,UI_COLORS.sand,left,350,30);this.ui.text('胜 +1★　负 −1★　平局不变',0,-187,18,UI_COLORS.sand,left,350,29);
    const right=this.ui.panel(214,-4,698,442,p,'#FFF9EC',246,22);this.ui.text('海岛排行',-179,186,27,UI_COLORS.ink,right,270,39);this.ui.text('上下滑动 · 点击查看阵容与战斗',133,186,18,UI_COLORS.sand,right,387,30);
    const viewport=this.ui.group('竞技排行滚动区',0,-20,right,654,349),mask=viewport.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_RECT;const content=this.ui.group('排行列表',0,0,viewport,654,Math.max(349,c.arenaOrder.length*66));let offset=0,origin=0,before=0;
    const scroll=(value:number)=>{offset=Math.max(0,Math.min(Math.max(0,c.arenaOrder.length*66-339),value));content.setPosition(0,offset);};
    viewport.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{origin=e.getLocation().y;before=offset;});viewport.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>scroll(before+e.getLocation().y-origin));viewport.on(Node.EventType.MOUSE_WHEEL,(e:EventMouse)=>scroll(offset-e.getScrollY()*.4));
    c.arenaOrder.forEach((id,i)=>{const ours=id===LOCAL_PLAYER,n=this.ui.button('',0,139-i*66,638,59,()=>{if(Math.abs(offset-before)>12)return;if(ours)this.defensePreview();else this.arenaOpponent(id);},{parent:content,selected:ours});this.ui.text(String(i+1),-283,0,25,UI_COLORS.ink,n,49,36);const t=ours?s.collection[c.arenaDefense[0]]:Object.values(c.aiPlayers[id]?.pets??{})[0];if(t)this.ui.pet(t,-227,0,43,n);this.ui.text(playerName(s,id)+(ours?' · 你':' · AI'),-27,0,23,UI_COLORS.ink,n,320,37);this.ui.text('查看 ›',252,0,20,UI_COLORS.sand,n,102,34);});
    const countdown=this.ui.text('',0,-249,20,UI_COLORS.ink,p,1090,34),tick=()=>{const left=Math.max(0,arenaSettlementAt(Date.now())-Date.now()),h=Math.floor(left/3600000),m=Math.floor(left/60000)%60;countdown.string=locked?'本周已结算，奖励已投递邮箱；周一重新开启':'本周结算倒计时 '+Math.floor(h/24)+'天 '+h%24+'时 '+m+'分 · 周日22:00投递邮箱';};p.addComponent(MenuTicker).step=tick;tick();
    this.ui.button('进攻阵容',-441,-303,222,51,()=>this.pick('进攻阵容',c.arenaAttack.length===5?[...c.arenaAttack]:Object.keys(s.collection).slice(0,5),5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});this.arenaV2(tier);},()=>this.arenaV2(tier),0,true),{parent:p,size:23});
    this.ui.button('防守阵容',-200,-303,222,51,()=>this.pick('防守阵容',c.arenaDefense.length===5?[...c.arenaDefense]:Object.keys(s.collection).slice(0,5),5,false,ids=>{this.dispatch({kind:'arenaDefense',ids});this.arenaV2(tier);},()=>this.arenaV2(tier),0,true),{parent:p,size:23});
    this.ui.button('结算宝箱',46,-303,234,51,()=>rewards.boxes('arena',()=>this.arenaV2(tier)),{parent:p,size:23});
    this.ui.button(c.arena&&!c.arena.settled?'继续对战':locked?'周一开启':'开始匹配',376,-303,365,51,()=>{if(c.arena&&!c.arena.settled)this.challenge('arena');else this.arenaMatching();},{parent:p,primary:true,disabled:locked&&!(c.arena&&!c.arena.settled),size:25});
  }
  private arenaMatching():void{
    const p=this.ui.dialog('正在匹配对手','正在寻找排名接近的对手 · 当前试玩为 AI 排位',()=>p.parent?.destroy(),880,420),label=this.ui.text('匹配中…',0,12,34,UI_COLORS.ink,p,750,60);let seconds=0;const ticker=p.addComponent(MenuTicker);ticker.step=()=>{seconds++;label.string='匹配中 · '+seconds+' 秒';if(seconds>=3){ticker.step=undefined;try{const id=findArenaOpponent(this.service.snapshot);p.parent?.destroy();this.arenaOpponent(id,true);}catch(e){p.parent?.destroy();this.error(e);}}};this.ui.button('取消匹配',0,-139,420,54,()=>p.parent?.destroy(),{parent:p,size:24});
  }
  private defensePreview():void{
    const s=this.service.snapshot,ids=this.c.arenaDefense,p=this.open('我的防守阵容','位置1–5已保存。防守演练使用AI进攻，不改变排位。',()=>this.arena());
    ids.map(id=>s.collection[id]).filter(Boolean).forEach((t,i)=>{const n=this.button('',-432+i*216,50,200,p,()=>this.inspect(t,()=>this.defensePreview()),false,false,250);this.ui.pet(t,0,50,112,n);this.ui.text(`位置${i+1}`,0,-28,28,UI_COLORS.gold,n,180,42);this.ui.text(`${t.skills.length}技能`,0,-84,26,UI_COLORS.sand,n,180,40);});
    this.button('让AI进攻，演练防守',0,-276,720,p,()=>{const command=this.command('defensePractice'),opponent=Object.keys(this.c.aiPlayers)[0];this.startBattle('arena',replace=>this.service.beginArenaPractice(command,opponent,replace));},ids.length!==5,true);
  }
  private arenaOpponent(id:string,matched=false):void{
    const a=this.c.aiPlayers[id];if(!a)return;const p=this.open((matched?'匹配成功 · ':'')+a.name,'对手防守阵容 · 点击伙伴查看资料',()=>this.arena());
    Object.values(a.pets).slice(0,5).forEach((t,i)=>{const n=this.ui.button('',-444+i*222,69,204,247,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t),{parent:p});this.ui.pet(t,0,38,114,n);this.ui.text(this.petName(t),0,-52,25,UI_COLORS.ink,n,188,39);this.ui.text(t.skills.length+' 技能 · '+turtleQuality(t).name,0,-95,20,UI_COLORS.sand,n,192,34);});
    this.ui.text('进攻伙伴依次进入防线，至少三只通过即可获胜。',0,-130,24,UI_COLORS.sand,p,1080,45);
    const selection=this.c.arenaAttack.length===5?[...this.c.arenaAttack]:Object.keys(this.service.snapshot.collection).slice(0,5);
    this.ui.button('观看防线演练',-359,-264,338,58,()=>this.watch?.(id),{parent:p,disabled:!this.watch,size:24});this.ui.button('调整进攻阵容',0,-264,338,58,()=>this.pick('我的进攻阵容',selection,5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});this.arenaOpponent(id,matched);},()=>this.arenaOpponent(id,matched),0,true),{parent:p,size:24});
    const rank=this.c.arenaOrder.indexOf(LOCAL_PLAYER),eligible=Math.abs(this.c.arenaOrder.indexOf(id)-rank)<=3;
    this.ui.button('开始对战',359,-264,338,58,()=>{if(!this.available()||!this.ui.isInteractive(p))return;const command=this.command('arena');this.startBattle('arena',replace=>this.service.beginArena(command,id,selection,replace));},{parent:p,primary:true,disabled:!eligible||arenaLocked(this.service.snapshot.clockHighWater),size:25});
  }
  private pick(title:string,selection:string[],limit:number,borrowed:boolean,done:(ids:string[])=>void,back:()=>void,page=0,exact=false):void{
    const s=this.service.snapshot,all=availablePets(s).filter(p=>borrowed||!p.loanId),valid=selection.filter(id=>all.some(p=>p.id===id)),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1));
    const p=this.open(title,`已选 ${valid.length}/${limit} · 点击已选项取消，再按希望的顺序选择。`,back);
    all.slice(current*6,current*6+6).forEach((pet,i)=>{const at=valid.indexOf(pet.id),t=pet.turtle,n=this.button('',-384+(i%3)*384,104-Math.floor(i/3)*192,360,p,()=>{new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:at>=0?'取消出战':'确定出战',disabled:at<0&&valid.length>=limit&&limit!==1,confirm:()=>{const next=[...valid],index=next.indexOf(pet.id);if(index>=0)next.splice(index,1);else if(next.length<limit)next.push(pet.id);else if(limit===1)next[0]=pet.id;this.pick(title,next,limit,borrowed,done,back,current,exact);}});},false,false,176);if(at>=0)this.ui.panel(-170,0,4,140,n,UI_COLORS.green,255,2);
      this.ui.pet(t,-112,0,104,n);this.ui.text(this.petName(t),58,48,30,at>=0?UI_COLORS.ink:UI_COLORS.cream,n,212,44);this.ui.text(`${t.skills.length}技能 · ${pet.loanId?loanLabel(s,pet.id):'自有'}`,58,-4,25,at>=0?UI_COLORS.ink:UI_COLORS.sand,n,216,38);this.ui.text(at>=0?`已选 ${at+1}`:`${turtleQuality(t).score.toFixed(1)}分`,58,-52,26,at>=0?UI_COLORS.ink:UI_COLORS.sand,n,208,38);
    });
    this.pager(p,current,pages,n=>this.pick(title,valid,limit,borrowed,done,back,n,exact));
    this.button('查看所选资料',42,-276,288,p,()=>{const t=all.find(t=>t.id===valid[valid.length-1]);if(t)this.inspect(t.turtle,()=>this.pick(title,valid,limit,borrowed,done,back,current,exact));},!valid.length);
    this.button('确认选择',394,-276,336,p,()=>done(valid),exact?valid.length!==limit:limit===3?false:!valid.length,false);
  }
}
