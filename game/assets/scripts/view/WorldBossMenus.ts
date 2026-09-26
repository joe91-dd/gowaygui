import {HonorBoard,HonorEntry} from './HonorBoard';
import {ShowcaseMenu} from './ShowcaseMenu';
import {showcasePets} from '../core/honor';
import {SeaChart,SeaChartMotion} from './SeaChart';
import {Node} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {RoomClient} from './RoomClient';
import {PetDetails} from './PetDetails';
import {RewardMenus,rewardLabel} from './RewardMenus';
import {visualName} from './VisualIdentity';
import {levelInfo} from '../core/development';
import {WORLD_BOSSES,WORLD_DAMAGE_TIERS,WORLD_RANK_TIERS,worldBossDay,worldTierGrants,worldRankGrants} from '../core/worldBoss';

const number=(n:number)=>n>=10000?(n/10000).toFixed(n%10000?1:0)+'万':n.toLocaleString();
export class WorldBossMenus {
 private epoch=0;private pending=false;private rankingPage=0;
 constructor(private ui:IslandUI,private service:GameService,private client:RoomClient,private command:(kind:string)=>string,private home:()=>void,private battle:()=>void,private error:(e:unknown)=>void,private localReview=false){}
 private page(title:string,back=this.home):Node{this.epoch++;this.ui.clear();return this.ui.sceneSheet(title,back);}
 private async act(fn:()=>Promise<unknown>,done:()=>void){if(this.pending)return;this.pending=true;const epoch=this.epoch,page=this.ui.root.children.find(n=>n.active&&n.isValid);try{await fn();if(epoch===this.epoch&&page?.isValid)done();}catch(e){if(epoch===this.epoch&&page?.isValid)this.ui.toast(e instanceof Error?e.message:'连接失败，请重试');}finally{this.pending=false;}}
 open(refresh=true):void{
  const s=this.service.snapshot,owned=Object.keys(s.collection);this.client.worldSelection=Array.from(new Set((this.client.worldSelection.length?this.client.worldSelection:s.homeTeam??[]).concat(owned))).filter(id=>s.collection[id]).slice(0,5);
  if(this.localReview&&!this.client.world){const now=Date.now(),day=worldBossDay(now);this.client.world={day:day.key,bossIndex:day.bossIndex,closes:day.closes,next:day.next,serverTime:now,canStart:true,attempts:0,best:0,claimed:[],ranking:[],participants:0};}
  if(!this.localReview&&(refresh||!this.client.world)){const p=this.page('世界挑战 · 世界 BOSS');this.ui.text('正在连接今日首领与伤害榜…',0,16,29,UI_COLORS.ink,p,1000,85);this.ui.button('重新连接',0,-95,340,49,()=>void this.act(()=>this.client.worldState(this.client.worldSelection),()=>this.open(false)),{parent:p,size:24});void this.act(()=>this.client.worldState(this.client.worldSelection),()=>this.open(false));return;}
  this.epoch++;this.ui.clear();
  const v=this.client.world!,def=WORLD_BOSSES[v.bossIndex],chart=new SeaChart(this.ui,'chart-world','世界 BOSS','每日轮换 · 今日首领',this.home,()=>!!this.service.snapshot.settings.reducedMotion),p=chart.root,epoch=this.epoch;
  chart.boss(def.art,0,61,371);chart.boat(-437,-195,117);
  this.ui.panel(-370,43,320,310,p,'#FFF9EC',235,22);this.ui.panel(394,62,306,296,p,'#FFF9EC',235,22);
  this.ui.text(def.name,0,252,32,UI_COLORS.ink,p,380,49);
  this.ui.text(def.subtitle,-370,115,24,UI_COLORS.ink,p,302,67,true);
  this.ui.text(def.counter,-370,22,20,UI_COLORS.sand,p,299,109,true);
  chart.button('首领图鉴',-370,-75,208,43,()=>this.bossInfo(v.bossIndex));
  this.ui.text('今日最高伤害',394,166,23,UI_COLORS.sand,p,290,40);
  const best=this.ui.text(number(v.best),394,114,43,UI_COLORS.ink,p,299,60);
  const rank=this.ui.text('',394,67,21,UI_COLORS.sand,p,290,35);
  chart.button('今日伤害榜',394,9,230,45,()=>this.rankings());
  const countdown=this.ui.text('',394,-57,18,UI_COLORS.sand,p,300,57,true);
  this.ui.text('伤害达标宝箱',0,-139,20,UI_COLORS.ink,p,420,30);
  const cells:{refresh:()=>void}[]=[];
  WORLD_DAMAGE_TIERS.forEach((damage,index)=>{const x=-310+index*89,node=chart.chest(x,-173,index<3?0:index<7?1:2,()=>this.chest(index),v.best>=damage&&!v.claimed.includes(index),49);
    this.ui.text(number(damage),0,-35,16,UI_COLORS.ink,node,85,24);
    const state=this.ui.text('',0,-57,14,UI_COLORS.sand,node,85,23);
    cells.push({refresh:()=>{const data=this.client.world!;state.string=data.claimed.includes(index)?'已领取':data.best>=damage?'可领取':'未达标';}});
  });
  chart.button('调整阵容',-332,-281,222,54,()=>this.picker([...this.client.worldSelection]));
  const active=v.fight?.phase==='combat',can=v.canStart&&v.attempts<3;
  chart.button(active?'继续挑战':'进入布阵',0,-281,326,59,()=>{const latest=this.client.world!;if(latest.fight?.phase!=='combat'&&(!latest.canStart||latest.attempts>=3)){this.ui.toast('今日挑战已结束，明天再来');return;}this.battle();},true,!active&&(!can||this.client.worldSelection.length!==5));
  chart.button('排名奖励',332,-281,222,54,()=>this.rankRewards());
  this.ui.panel(0,-327,590,28,p,'#FFF9EC',235,12);
  const attempts=this.ui.text('',0,-327,18,UI_COLORS.sand,p,880,30);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{const data=this.client.world!,seconds=Math.max(0,Math.floor((data.closes-data.serverTime)/1000));best.string=number(data.best);rank.string='我的排名 '+(data.rank??'未上榜');countdown.string=seconds?'距结算 '+Math.floor(seconds/3600)+'时 '+Math.floor(seconds/60)%60+'分':'今日已结算 · 次日刷新';attempts.string='剩余 '+Math.max(0,3-data.attempts)+' / 3 次 · 每次 90 秒 · 取单次最高';cells.forEach(cell=>cell.refresh());};update();
  p.once(Node.EventType.NODE_DESTROYED,()=>{if(timer)clearTimeout(timer);});
  const poll=async()=>{try{const before=this.client.world!;if(this.localReview){update();}else{await this.client.worldState(this.client.worldSelection);if(epoch!==this.epoch||!p.isValid)return;const after=this.client.world!;if(before.day!==after.day||before.bossIndex!==after.bossIndex||before.best!==after.best||before.canStart!==after.canStart||before.attempts!==after.attempts||before.fight?.phase!==after.fight?.phase){this.open(false);return;}update();}}catch{if(p.isValid)countdown.string='暂时离线 · 正在重新连接';}if(epoch===this.epoch&&p.isValid)timer=setTimeout(poll,1500);};timer=setTimeout(poll,1500);
 }
 private rankings():void{
  this.epoch++;this.ui.clear();const data=this.client.world!,s=this.service.snapshot,board=new HonorBoard(this.ui,'世界首领 · 讨伐荣耀','每日22:00结算 · 取每日单次最高伤害',()=>this.open(false)),back=()=>this.rankings();
  const rows:HonorEntry[]=data.ranking.map(r=>({id:r.id,rank:r.rank,name:r.name,metric:number(r.damage),pets:r.own?showcasePets(s):r.showcase??r.roster?.slice(0,1)??[],rotate:r.own?(s.community?.showcase?.rotate??true):!!r.rotate,inspect:pet=>{
   if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet,{readOnly:true});
   else {const p=this.ui.dialog(r.name+' · 讨伐记录','第 '+r.rank+' 名 · 最高伤害 '+number(r.damage),()=>p.parent?.destroy(),780,430);this.ui.text('该玩家尚未设置展示伙伴',0,0,25,UI_COLORS.sand,p,690,90);}
  }}));
  board.winners(rows.slice(0,3));board.list(rows.slice(3),'今日伤害榜');
  const menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error),saved=()=>{back();void this.act(()=>this.client.worldShowcase(),back);};
  board.footer(data.rank?String(data.rank):'未上榜',number(data.best)+' 伤害',showcasePets(s)[0],()=>menu.open(saved),s.community?.showcase?.rotate??true,()=>menu.toggle(saved));
  board.button('排名奖励',505,-296,142,42,()=>this.rankRewards());
 }

 private chest(tier:number):void{const d=this.client.world!,claimed=d.claimed.includes(tier),eligible=d.best>=WORLD_DAMAGE_TIERS[tier];new RewardMenus(this.ui,this.service,this.command,this.error).detail('第 '+(tier+1)+' 档 · '+number(WORLD_DAMAGE_TIERS[tier])+' 伤害',worldTierGrants(tier),eligible&&!claimed?()=>void this.act(()=>this.client.worldClaim(tier),()=>{this.open(false);this.ui.feedback?.('reward');this.ui.toast('奖励已发到系统邮箱，请领取附件');}):undefined,claimed?'今天已经领取':eligible?'每天每档领取一次，领取后奖励存入系统邮箱':'今日单次最高伤害达到此档，即可领取');}
 private bossInfo(i:number):void{const b=WORLD_BOSSES[i],p=this.ui.dialog(b.name,i===this.client.world?.bossIndex?'今日首领':'按四日顺序轮流登场',()=>p.parent?.destroy(),820,580);const sprite=this.ui.art?.attach(this.ui.group(b.name,-204,-10,p,284,284),b.art,284,284);if(sprite){const motion=p.addComponent(SeaChartMotion);motion.reduced=()=>!!this.service.snapshot.settings.reducedMotion;motion.fullBoss(sprite,b.art);}this.ui.text(b.subtitle,152,95,27,UI_COLORS.ink,p,364,83,true);this.ui.text(b.counter,157,-23,24,UI_COLORS.sand,p,360,144,true);this.ui.text('巨大体型 · 缓慢横穿长堤 · 挑战限时 90 秒',0,-227,21,UI_COLORS.ink,p,742,39);}
 private rankRewards():void{const p=this.ui.dialog('每日排名奖励','北京时间 22:00 结算，通过系统邮件发放；伤害相同，先达成者在前',()=>p.parent?.destroy(),940,611);WORLD_RANK_TIERS.forEach((r,i)=>{const y=151-i*65;this.ui.text(r.name,-306,y,24,UI_COLORS.ink,p,250,44);this.ui.text(worldRankGrants(i===0?1:WORLD_RANK_TIERS[i-1].max+1).map(rewardLabel).join(' · '),106,y,22,UI_COLORS.sand,p,552,50,true);});}
 private picker(selection:string[],page=0):void{const pets=Object.values(this.service.snapshot.collection),pages=Math.max(1,Math.ceil(pets.length/6)),p=this.page('世界首领 · 出战阵容',()=>this.open());this.ui.text(`已选 ${selection.length} / 5 · 点击伙伴查看详细资料`,0,214,24,UI_COLORS.sand,p,1100,40);pets.slice(page*6,page*6+6).forEach((t,i)=>{const chosen=selection.includes(t.id);this.ui.card(t.role,visualName(t),`Lv.${levelInfo(t).level} · ${t.skills.length} 技能`,chosen?'已选择 '+(selection.indexOf(t.id)+1):'查看并选择',-383+i%3*383,90-Math.floor(i/3)*197,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:chosen?'取消出战':'确定出战',disabled:!chosen&&selection.length>=5,confirm:()=>this.picker(chosen?selection.filter(id=>id!==t.id):selection.concat(t.id),page)}),{parent:p,turtle:t,selected:chosen});});this.ui.button('‹',-496,-282,82,54,()=>this.picker(selection,page-1),{parent:p,disabled:page===0,size:28});this.ui.text(`${page+1} / ${pages}`,-381,-282,22,UI_COLORS.ink,p,128,36);this.ui.button('›',-263,-282,82,54,()=>this.picker(selection,page+1),{parent:p,disabled:page===pages-1,size:28});this.ui.button('保存阵容',246,-282,542,54,()=>{this.client.worldSelection=selection;this.open();},{parent:p,primary:true,disabled:selection.length!==5,size:26});}
}
