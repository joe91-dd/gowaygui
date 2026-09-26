import {EditBox,Node} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {AccountClient} from '../platform/AccountClient';
import type {GameService} from '../core/game';
import type {AdKind} from '../core/types';
import {AD_MILESTONES,INVITE_MILESTONES,LOGIN_GIFTS,DAILY_ACTIVITY,WEEKLY_ACTIVITY,ACTIVITY_TASKS,activityPoints} from '../core/taskPolicy';
import {rewardLabel} from './RewardMenus';
type Tab='login'|'invite'|'ads'|'daily'|'weekly'|'pending';
export class TaskMenus {
 private busy=false;
 constructor(private ui:IslandUI,private service:GameService,private client:AccountClient,private home:()=>void,private error:(e:unknown)=>void){}
 private async act(action:()=>Promise<void>,after?:()=>void){if(this.busy)return;this.busy=true;const page=this.ui.root.children.find(n=>n.active&&n.isValid);try{await action();if(page&&this.ui.isInteractive(page))after?.();}catch(e){if(page&&this.ui.isInteractive(page))this.error(e);}finally{this.busy=false;}}
 private input(parent:Node,label:string,y:number,password=false,value=''):EditBox{this.ui.text(label,-295,y,23,UI_COLORS.ink,parent,190,40);const surface=this.ui.panel(106,y,490,48,parent,'#F0F6F3'),n=this.ui.group('输入:'+label,0,0,surface,490,48);n.active=false;const edit=n.addComponent(EditBox);edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=password?EditBox.InputFlag.PASSWORD:EditBox.InputFlag.DEFAULT;const old=[edit.textLabel?.node,edit.placeholderLabel?.node];edit.maxLength=password?128:120;edit.textLabel=this.ui.text('',0,0,22,UI_COLORS.ink,n,455,39);edit.placeholderLabel=this.ui.text(password?'至少10个字符':'点击输入',0,0,21,UI_COLORS.sand,n,455,39);old.forEach(n=>n?.destroy());edit.string=value;this.ui.anchorInput(edit);n.active=true;return edit;}
 open(tab:Tab='login',page=0,refresh=true):void{
  this.ui.clear();const p=this.ui.sceneSheet('任务与好礼',this.home),a=this.client.view,s=this.service.snapshot;
  if(refresh&&this.client.session)void this.act(async()=>{await this.client.sync();},()=>{if(this.ui.isInteractive(p))this.open(tab,page,false);});
  const tabs:[Tab,string][]=[['login','七日登录'],['invite','邀请好友'],['ads','广告好礼'],['daily','每日活跃'],['weekly','每周活跃'],['pending','待领取 '+(a?.pending.length??0)]];
  const sidebar=this.ui.panel(-459,-12,234,456,p,'#E9F3F0',238,22);
  tabs.forEach(([key,title],i)=>this.ui.button(title,0,179-i*69,206,51,()=>this.open(key,0),{parent:sidebar,selected:tab===key,size:24}));
  this.ui.panel(133,-12,902,456,p,'#FFF9EC',246,22);
  const subtitle=tab==='login'?'累计登录七天，第七天获得 8 技能伙伴':tab==='invite'?'好友通过邀请码注册并登录后计入有效邀请':tab==='ads'?'自愿观看，完成验证后记账；无需观看也能正常游玩':tab==='daily'?'每天 00:00 刷新，100 活跃度即可领满':tab==='weekly'?'周一 00:00 刷新，六天完成每日活跃即可领满':'背包满或网络中断时，已生成的奖励保存在这里';
  this.ui.text(subtitle,133,200,22,UI_COLORS.ink,p,852,40);
  if(!this.client.session)this.ui.button('登录账号 · 保存奖励进度',133,149,792,43,()=>this.account(true),{parent:p,primary:true,size:22});
  else this.ui.text(tab==='invite'?`有效邀请 ${a?.invites??0} 人 · 我的邀请码 ${a?.code??'读取中'}`:tab==='ads'?`已完成 ${a?.ads??0} 次 · 每日最多 6 次`:tab==='daily'?`今日活跃 ${a?.dailyPoints??activityPoints(s.taskJournal?.counts??{})} / 100`:tab==='weekly'?`本周活跃 ${a?.weeklyPoints??0} / 600`:`累计登录 ${a?.days??0} 天 · 每档奖励账号限领一次`,133,149,23,UI_COLORS.sand,p,850,38);
  const rows:{key:string;title:string;desc:string;eligible:boolean;claimed:boolean;claim:()=>Promise<void>}[]=[];
  const add=(key:string,title:string,desc:string,eligible:boolean)=>rows.push({key,title,desc,eligible,claimed:!!a?.claims.includes(key),claim:()=>this.client.claim(key)});
  if(tab==='login')LOGIN_GIFTS.forEach((g,i)=>add('login:'+(i+1),'第 '+(i+1)+' 天',g.skills?`${g.skills} 技能随机伙伴 ×1`:`金币 ${g.gold.toLocaleString()} · 四种食材各 ${g.material} 份`,(a?.days??0)>i));
  if(tab==='invite'||tab==='ads')(tab==='invite'?INVITE_MILESTONES:AD_MILESTONES).forEach(g=>add((tab==='invite'?'invite:':'ads:')+g.at,`累计 ${g.at} ${tab==='invite'?'名好友':'次广告'}`,`${g.skills} 技能随机伙伴 ×${g.count}`,(tab==='invite'?a?.invites??0:a?.ads??0)>=g.at));
  if(tab==='daily'||tab==='weekly')(tab==='daily'?DAILY_ACTIVITY:WEEKLY_ACTIVITY).forEach(g=>add(tab+':'+(tab==='daily'?a?.serverDay:a?.serverWeek)+':'+g.at,g.at+' 活跃度',`金币 ${g.gold.toLocaleString()} · 四种食材各 ${g.materials}`+('pack' in g?' · 技能礼包':''),(tab==='daily'?a?.dailyPoints??0:a?.weeklyPoints??0)>=g.at));
  if(tab==='pending')for(const parcel of a?.pending??[])rows.push({key:parcel.id,title:parcel.title,desc:parcel.pets.map(t=>t.skills.length+' 技能伙伴').concat(parcel.grants.map(rewardLabel)).join(' · '),eligible:true,claimed:false,claim:()=>this.client.receive(parcel)});
  if(tab==='login'){
   rows.forEach((row,i)=>{
    const last=i===6,n=this.ui.panel(last?444:-204+i%3*206,last?-40:37-Math.floor(i/3)*166,last?228:194,last?313:151,p,last?'#DDF8F0':'#FFF9EC',248,18);
    this.ui.text(row.title,0,last?124:55,last?27:22,UI_COLORS.ink,n,last?200:178,34);
    if(last){this.ui.portrait('stone',0,22,146,n,true);this.ui.text('8 技能随机伙伴 ×1',0,-76,21,UI_COLORS.gold,n,210,32);}
    else {this.ui.art?.attach(this.ui.group('七日奖励',-51,4,n,47,49),'chest-1',47,49);const gift=LOGIN_GIFTS[i];this.ui.text('金币 '+gift.gold.toLocaleString(),30,14,17,UI_COLORS.ink,n,116,25);this.ui.text('食材各 '+gift.material+' 份',30,-11,17,UI_COLORS.sand,n,116,25);}
    this.ui.button(row.claimed?'已领取':row.eligible?'领取奖励':'未达成',0,last?-123:-50,last?188:158,35,()=>void this.act(row.claim,()=>{this.ui.feedback?.('reward');this.open('login',0,false);}),{parent:n,disabled:row.claimed||!row.eligible||!this.client.session,primary:row.eligible&&!row.claimed,size:19});
   });
  }else{
  const pages=Math.max(1,Math.ceil(rows.length/3)),current=Math.max(0,Math.min(page,pages-1));
  rows.slice(current*3,current*3+3).forEach((row,i)=>{const y=68-i*91,n=this.ui.panel(132,y,852,79,p,'#F1F4EC',255,15);this.ui.art?.attach(this.ui.group('任务奖励',-377,0,n,52,55),'chest-1',52,55);this.ui.text(row.title,-149,17,24,UI_COLORS.ink,n,343,34);this.ui.text(row.desc,-48,-20,19,UI_COLORS.sand,n,555,29);this.ui.button(row.claimed?'已领取':row.eligible?'领取':'未达成',329,0,152,46,()=>void this.act(row.claim,()=>{this.ui.feedback?.('reward');this.open(tab,current,false);}),{parent:n,disabled:row.claimed||!row.eligible||!this.client.session,primary:row.eligible&&!row.claimed,size:22});});
  if(!rows.length)this.ui.text('当前没有待领取奖励',132,5,26,UI_COLORS.sand,p,790,90);
  this.ui.button('‹',-213,-198,72,40,()=>this.open(tab,current-1,false),{parent:p,disabled:current===0,size:27});this.ui.text(`${current+1} / ${pages}`,132,-198,21,UI_COLORS.sand,p,180,33);this.ui.button('›',479,-198,72,40,()=>this.open(tab,current+1,false),{parent:p,disabled:current===pages-1,size:27});
  }
  this.ui.button('分享给好友',-445,-292,240,47,()=>this.share(),{parent:p,size:22});
  if(tab==='ads')this.ui.button('自愿看广告 · 领取补给',164,-292,543,47,()=>this.ad('supplies'),{parent:p,primary:true,size:24});
  else if(tab==='daily'||tab==='weekly')this.ui.button('查看每日任务',164,-292,543,47,()=>this.activity(),{parent:p,size:24});
  else this.ui.text('累计礼不重置；奖励是技能数量保证，造型和天赋随机。',163,-289,19,UI_COLORS.sand,p,799,43);
 }
 private activity():void{const p=this.ui.dialog('每日活跃任务','活跃度上限100；每周累计计算，广告和分享不占必做任务',()=>p.parent?.destroy(),820,615),counts=this.service.snapshot.taskJournal?.counts??{};ACTIVITY_TASKS.forEach((t,i)=>{const y=155-i*63;this.ui.text(t.name,-138,y,23,UI_COLORS.ink,p,418,43);this.ui.text(`${Math.min(counts[t.id]??0,t.target)}/${t.target}    +${t.points}`,250,y,22,UI_COLORS.sand,p,230,43);});}
 share(title?:string,text?:string):void{void this.act(async()=>{const result=await this.client.share(title,text);this.ui.toast(result==='cancelled'?'已取消分享':result==='shared'?'分享已交给系统':['127.0.0.1','localhost'].includes(location.hostname)?'内容已复制；当前为本机链接，外部好友需要正式服务器地址':'邀请内容已复制，可发送给好友');});}
 ad(kind:AdKind|'supplies',context?:string,done?:()=>void):void{
  const p=this.ui.dialog('自愿观看广告','不观看也能正常游玩；中途关闭或验证失败不计次数',()=>p.parent?.destroy(),790,370),notice=this.ui.text('正在读取广告服务…',0,12,23,UI_COLORS.ink,p,700,90,true);
  void this.act(async()=>{const config=await this.client.request<{adAvailable:boolean}>('config');if(!this.ui.isInteractive(p))return;notice.string=config.adAvailable?'完整观看后领取奖励，是否继续？':'广告平台尚未接入，暂时没有可播放的真实广告。\n任务次数不会因点击按钮而增加。';if(config.adAvailable)this.ui.button('开始观看',0,-103,380,47,()=>void this.act(async()=>{const win=window.open('about:blank','gowaygui-rewarded');if(!win)throw Error('请允许打开广告窗口，再点击观看');try{await this.client.ad(kind,context,url=>win.location.href=url,message=>{if(this.ui.isInteractive(p))notice.string=message;});if(this.ui.isInteractive(p)){notice.string='奖励已到账';this.ui.feedback?.('reward');done?.();}}catch(e){win.close();throw e;}}),{parent:p,primary:true,size:24});});
 }
 account(login=false,register=false):void{
  this.ui.clear();const p=this.ui.sceneSheet('账号与服务',this.home),a=this.client.session;
  if(a&&!login&&!this.client.view)void this.act(()=>this.client.sync(),()=>{if(this.ui.isInteractive(p))this.account();});
  if(login||!a){this.ui.panel(0,4,1000,438,p,'#FFF9EC',246,22);this.ui.text(register?'注册账号 · 保存当前游客进度':'登录账号 · 读取云端进度',0,177,29,UI_COLORS.ink,p,900,44);
   const name=this.input(p,'账号',98),password=this.input(p,'密码',23,true),invite=register?this.input(p,'邀请码（选填）',-52,false,new URL(location.href).searchParams.get('invite')??''):undefined;
   this.ui.text('账号4～24位字母/数字/下划线；密码至少10个字符。',0,-118,21,UI_COLORS.sand,p,900,42);
   this.ui.button(register?'注册并登录':'登录',0,-183,460,52,()=>void this.act(()=>this.client.login(name.string,password.string,register,invite?.string)),{parent:p,primary:true,size:25});
   this.ui.button(register?'已有账号，去登录':'没有账号，去注册',0,-285,420,47,()=>this.account(true,!register),{parent:p,size:23});return;
  }
  this.ui.text(a.username+' · '+(this.client.view?.regions.find(r=>r.id===a.region)?.name??'读取区服中'),0,194,31,UI_COLORS.ink,p,950,48);
  const entries:[string,string,()=>void][]=[['切换账号','先保存当前进度，再登录其他账号',()=>this.account(true)],['切换区服','各区进度独立，累计好礼全账号限领',()=>this.regions()],['修改密码','修改后其他设备需要重新登录',()=>this.password()],['问题反馈','提交问题并获取客服工单编号',()=>this.feedback()],['退出账号','保存云端进度，返回本机游客账号',()=>{const d=this.ui.dialog('退出当前账号','当前进度保存成功后才会退出。',()=>d.parent?.destroy(),650,285);this.ui.button('保存并退出',0,-58,390,50,()=>void this.act(()=>this.client.logout()),{parent:d,primary:true,size:24});}]];
  entries.forEach(([title,desc,action],i)=>{const y=105-i*77,n=this.ui.button('',0,y,1060,65,action,{parent:p});this.ui.text(title,-360,0,25,UI_COLORS.ink,n,267,43);this.ui.text(desc,98,0,21,UI_COLORS.sand,n,625,42);this.ui.text('›',491,0,28,UI_COLORS.ink,n,40,44);});
 }
 private regions(){void this.act(async()=>{await this.client.sync();const p=this.ui.dialog('选择区服','已领取的账号累计好礼不会因为换区重置',()=>p.parent?.destroy(),730,390);this.client.view!.regions.forEach((r,i)=>this.ui.button(`${r.name} · ${r.status}`,0,44-i*73,580,52,()=>void this.act(()=>this.client.region(r.id)),{parent:p,selected:r.id===this.client.session?.region,size:24}));});}
 private password(){const p=this.ui.dialog('修改密码','密码仅提交到当前配套服务，不在界面显示',()=>p.parent?.destroy(),900,430),old=this.input(p,'原密码',39,true),next=this.input(p,'新密码',-38,true);this.ui.button('保存新密码',0,-141,430,49,()=>void this.act(()=>this.client.password(old.string,next.string),()=>{p.parent?.destroy();this.ui.toast('密码已修改');}),{parent:p,primary:true,size:24});}
 private feedback(){if(!this.client.session){this.account(true);return;}const p=this.ui.dialog('问题反馈','提交后返回工单编号；不会自动发送给其他玩家',()=>p.parent?.destroy(),920,455),text=this.input(p,'问题描述',52),contact=this.input(p,'联系信息（选填）',-24);text.maxLength=2000;this.ui.button('提交反馈',0,-150,430,50,()=>void this.act(async()=>{const r=await this.client.request<{ticket:string}>('feedback',{text:text.string,contact:contact.string});p.parent?.destroy();this.ui.toast('反馈已保存，工单 '+r.ticket);}),{parent:p,primary:true,size:24});}
}
