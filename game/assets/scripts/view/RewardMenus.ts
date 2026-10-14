import {ENDLESS_REWARD_WAVES} from '../core/endlessRewards';
import {EventTouch,Node,Component} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {PACK_NAMES,packForWave,packPool} from '../core/rewardPacks';
import {goldAmount,displayGold} from '../core/economy';
import {MATERIAL_NAMES,SKILL_BY_ID} from '../core/data';
import {RAIDS} from '../core/raids';
import {ARENA_TIERS,arenaWeeklyGrants,arenaSettlementAt} from '../core/progression';
import type {RewardGrant,BookPackGrade} from '../core/types';
import type {RewardChest} from '../core/progression';
export const rewardLabel=(g:RewardGrant)=>g.kind==='gold'?displayGold(g.amount)+' 金币':(g.kind==='material'?MATERIAL_NAMES[g.material]:g.kind==='book'?SKILL_BY_ID[g.skillId].name:PACK_NAMES[g.grade])+' ×'+g.amount;
export class MenuTicker extends Component {elapsed=0;step?:()=>void;update(dt:number){this.elapsed+=dt;if(this.elapsed>=1){this.elapsed=0;this.step?.();}}}
export class RewardMenus {
 constructor(private ui:IslandUI,private service:GameService,private command:(s:string)=>string,private error:(e:unknown)=>void){}
 private act(fn:()=>void){try{fn();}catch(e){this.error(e);}}
 detail(title:string,grants:RewardGrant[],claim?:()=>void,caption='奖励内容'):void{
  const p=this.ui.dialog(title,caption,()=>p.parent?.destroy(),800,Math.min(630,220+grants.length*57));
  grants.forEach((g,i)=>{const y=(Math.min(630,220+grants.length*57))/2-137-i*55;if(g.kind==='gold')this.ui.icon('gold',-278,y,38,p);else if(g.kind==='book')this.ui.bookIcon(g.skillId,-278,y,42,p);else if(g.kind==='bookPack')this.ui.bookIcon(packPool(g.grade)[0],-278,y,42,p);else this.ui.icon((g.material+'-medicine') as any,-278,y,38,p);this.ui.text(rewardLabel(g),36,y,23,UI_COLORS.ink,p,534,40);});
  this.ui.button(claim?'领取奖励':'知道了',0,-Math.min(630,220+grants.length*57)/2+48,350,48,()=>this.act(()=>{claim?.();p.parent?.destroy();}),{parent:p,primary:!!claim,size:24});
 }
 endlessMilestone(wave:number,back:()=>void):void{
  const s=this.service.snapshot,chests=(s.progression?.chests??[]).filter(chest=>chest.id.startsWith('endless:')&&chest.title===wave+'波里程宝箱'),chest=chests.find(item=>!item.claimed)??chests[chests.length-1];
  if(chest){this.detail(wave+' 波里程宝箱',chest.grants,!chest.claimed?()=>{this.service.claimChest(this.command('chest'),chest.id);this.ui.feedback?.('chest');back();}:undefined,chest.claimed?'已经领取，可再次远征获得新宝箱':'挑战结算奖励，领取后保存到背包');return;}
  this.detail(wave+' 波里程宝箱',[{kind:'gold',amount:goldAmount(s,30+wave*5)}],undefined,'另含随机技能礼包 ×1 · '+(wave>=60?'高阶奖池':'基础奖池')+' · 达标后结算获得');
 }
 boxes(mode:'endless'|'raid'|'arena',back:()=>void,tier=0,page=0,owned=false):void{
  this.ui.clear();const s=this.service.snapshot,p=this.ui.sceneSheet(mode==='endless'?'无尽 · 潮汐宝藏':mode==='raid'?'副本 · 星级宝箱':'竞技场 · 结算奖励',back),list=(s.progression?.chests??[]).filter(c=>c.id.startsWith(mode+':')||mode==='arena'&&c.id.startsWith('arena-')).reverse();
  this.ui.button('奖励预览',-142,210,252,46,()=>this.boxes(mode,back,tier,0,false),{parent:p,selected:!owned,size:23});this.ui.button('我的宝箱 '+list.filter(c=>!c.claimed).length,142,210,252,46,()=>this.boxes(mode,back,tier,0,true),{parent:p,selected:owned,size:23});
  let previews:RewardChest[];
  if(owned)previews=list;
  else if(mode==='endless')previews=ENDLESS_REWARD_WAVES.map(wave=>{return {id:'preview:'+wave,title:wave+' 波里程宝箱',stars:Math.min(3,1+Math.floor(wave/30)),at:0,claimed:false,grants:[{kind:'gold',amount:goldAmount(s,30+wave*5)},{kind:'bookPack',grade:packForWave(wave),amount:1}]};});
  else if(mode==='raid')previews=[1,2,3].map(stars=>({id:'preview:'+stars,title:['基本通过','顺利通过','完美通过'][stars-1],stars,at:0,claimed:false,grants:[{kind:'gold',amount:goldAmount(s,RAIDS[tier].gold*stars/5)},{kind:'material',material:'growth',amount:stars},{kind:'bookPack',grade:stars===3?'precious':'common',amount:1}]}));
  else previews=ARENA_TIERS.map((row,i)=>({id:'tier:'+i,title:row.name+' 周结算',stars:Math.min(3,1+Math.floor(i/2)),at:0,claimed:false,grants:arenaWeeklyGrants(s,i)}));
  const pages=Math.max(1,Math.ceil(previews.length/3)),current=Math.max(0,Math.min(page,pages-1));
  previews.slice(current*3,current*3+3).forEach((c,i)=>{const n=this.ui.button('',(i-1)*369,7,344,319,()=>{if(mode==='endless'&&!owned){this.endlessMilestone(Number(c.id.split(':')[1]),back);return;}this.detail(c.title,c.grants,owned&&!c.claimed?()=>{this.service.claimChest(this.command('chest'),c.id);this.ui.feedback?.('chest');this.boxes(mode,back,tier,current,owned);}:undefined,owned?(c.claimed?'已经领取':'点击领取，奖励会保存到背包'):'通关结算后获得，可到“我的宝箱”领取');},{parent:p});this.ui.art?.attach(this.ui.group('奖励宝箱',0,62,n,118,112),`chest-${Math.max(0,Math.min(2,c.stars-1))}` as any,118,112);this.ui.text('★'.repeat(c.stars),0,133,25,'#D6A631',n,300,35);this.ui.text(c.title,0,-15,28,UI_COLORS.ink,n,320,42);this.ui.text(mode==='endless'&&!owned?rewardLabel(c.grants[0])+'\n随机技能礼包 ×1':c.grants.map(rewardLabel).join('\n'),0,-77,20,UI_COLORS.sand,n,300,85,true);if(owned)this.ui.text(c.claimed?'已领取':'可以领取',0,-137,20,c.claimed?UI_COLORS.sand:'#008E9B',n,300,30);});
  if(!previews.length)this.ui.text('完成挑战后，宝箱会保存在这里。',0,15,29,UI_COLORS.ink,p,1000,80);
  this.ui.button('‹',-473,-231,92,48,()=>this.boxes(mode,back,tier,current-1,owned),{parent:p,disabled:!current,size:28});this.ui.text(`${current+1} / ${pages} · 左右滑动查看`,0,-231,21,UI_COLORS.sand,p,740,36);this.ui.button('›',473,-231,92,48,()=>this.boxes(mode,back,tier,current+1,owned),{parent:p,disabled:current===pages-1,size:28});
  this.ui.text(mode==='endless'?'5 波首航奖励；每 10 波里程宝箱，60 波起高阶奖池；100 波后仍可继续。':mode==='raid'?'宝箱之外还会获得基础通关奖励；技能礼包在技能背包中开启。':'周日 22:00 按最终段位发放到系统邮箱。',0,-294,23,UI_COLORS.ink,p,1090,46);
 }
 mailbox(back:()=>void,page=0):void{
  this.ui.clear();const mails=[...(this.service.snapshot.mailbox?.items??[])].sort((a,b)=>Number(a.claimed)-Number(b.claimed)||b.sentAt-a.sentAt),pages=Math.max(1,Math.ceil(mails.length/5)),current=Math.max(0,Math.min(page,pages-1)),p=this.ui.sceneSheet('系统邮件',back);this.ui.panel(0,-4,1140,476,p,'#FFF9EC',246,20);
  mails.slice(current*5,current*5+5).forEach((m,i)=>{const y=176-i*85,n=this.ui.button('',0,y,1090,74,()=>this.act(()=>{this.service.readMail(this.command('readMail'),m.id);const panel=this.ui.dialog(m.title,m.body,()=>{panel.parent?.destroy();this.mailbox(back,current);},890,540);this.ui.text(m.grants.length||m.pets?.length?[...m.grants.map(rewardLabel),...(m.pets??[]).map(t=>'龟龟伙伴 · '+t.skills.length+'技能')].join('\n'):'这封邮件没有附件',0,3,24,UI_COLORS.ink,panel,780,236,true);this.ui.button(m.claimed?'已领取':'领取附件',191,-205,330,48,()=>this.act(()=>{this.service.claimMail(this.command('mailClaim'),m.id);this.ui.feedback?.('reward');panel.parent?.destroy();this.mailbox(back,current);}),{parent:panel,primary:true,disabled:m.claimed||!(m.grants.length||m.pets?.length),size:24});this.ui.button('删除邮件',-191,-205,330,48,()=>this.act(()=>{this.service.deleteMail(this.command('mailDelete'),m.id);panel.parent?.destroy();this.mailbox(back,current);}),{parent:panel,disabled:!m.claimed&&!!(m.grants.length||m.pets?.length),size:23});}),{parent:p});this.ui.text(m.read?'':'●',-511,0,21,'#EF8B63',n,25,30);this.ui.text(m.title,-138,12,25,UI_COLORS.ink,n,652,36);this.ui.text(new Date(m.sentAt).toLocaleString('zh-CN'),-175,-19,17,UI_COLORS.sand,n,576,27);this.ui.text(m.claimed?'已领取':m.grants.length||m.pets?.length?'待领取':'系统来信',423,0,23,m.claimed?UI_COLORS.sand:'#008D9E',n,180,38);});
  if(!mails.length)this.ui.text('暂时没有新邮件',0,25,30,UI_COLORS.ink,p,850,70);
  this.ui.button('上一页',-335,-285,236,54,()=>this.mailbox(back,current-1),{parent:p,disabled:current===0,size:24});this.ui.text(`${current+1} / ${pages}`,0,-285,23,UI_COLORS.ink,p,170,35);this.ui.button('下一页',335,-285,236,54,()=>this.mailbox(back,current+1),{parent:p,disabled:current===pages-1,size:24});
 }
 packs(back:()=>void):void{
  this.ui.clear();const p=this.ui.sceneSheet('技能礼包',back),s=this.service.snapshot;
  (['common','precious','active','mastery'] as BookPackGrade[]).forEach((grade,i)=>{const count=s.bookPacks?.[grade]??0,n=this.ui.panel(-420+i*280,18,258,368,p);this.ui.bookIcon(packPool(grade)[0],0,82,102,n);this.ui.text(PACK_NAMES[grade],0,-1,22,UI_COLORS.ink,n,234,40);this.ui.text(`持有 ${count} 个`,0,-46,22,UI_COLORS.sand,n,230,34);this.ui.button('查看内容',0,-91,210,42,()=>{const d=this.ui.dialog(PACK_NAMES[grade],'随机获得其中一项，每项等概率',()=>d.parent?.destroy(),930,510);this.ui.text(packPool(grade).map(x=>SKILL_BY_ID[x].name).join(' · '),0,-15,24,UI_COLORS.ink,d,836,330,true);},{parent:n,size:21});this.ui.button('开启一个',0,-144,210,45,()=>this.act(()=>{const id=this.service.openBookPack(this.command('bookPack'),grade);this.ui.feedback?.('chest');this.packs(back);this.ui.skillDetail(id);}),{parent:n,primary:true,disabled:!count,size:22});});
 }
}
