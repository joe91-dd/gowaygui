import {SeaChart} from './SeaChart';
import {EditBox,Node,EventTouch} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {RoomClient} from './RoomClient';
import {PetDetails} from './PetDetails';
import {RewardMenus} from './RewardMenus';
import {GameService} from '../core/game';
import {RAIDS} from '../core/raids';
import {levelInfo} from '../core/development';
import {visualName} from './VisualIdentity';
import type {RoomView} from '../core/roomTypes';

export class RoomMenus {
 private selected:string[]=[];private tier=0;private epoch=0;private pending=false;
 constructor(private ui:IslandUI,private service:GameService,private client:RoomClient,private command:(kind:string)=>string,private home:()=>void,private battle:(room:RoomView)=>void,private error:(e:unknown)=>void){}
 private get rewards(){return new RewardMenus(this.ui,this.service,this.command,this.error);}
 private async act(fn:()=>Promise<unknown>,done:()=>void=()=>this.lobby()):Promise<void>{if(this.pending)return;this.pending=true;const epoch=this.epoch,page=this.ui.root.children.find(n=>n.isValid&&n.active);try{await fn();if(this.epoch===epoch&&page?.isValid)done();}catch(e){if(this.epoch===epoch&&page?.isValid)this.ui.toast(e instanceof Error?e.message:'连接失败，请重试');}finally{this.pending=false;}}
 private page(title:string,back=this.home):Node{this.epoch++;this.ui.clear();return this.ui.sceneSheet(title,back);}
 open():void{
  this.epoch++;this.ui.clear();const s=this.service.snapshot,chart=new SeaChart(this.ui,'chart-raid','海岛副本','双人同行 · 探索秘境',this.home,()=>!!this.service.snapshot.settings.reducedMotion),p=chart.root;
  this.selected=(s.homeTeam??Object.keys(s.collection).slice(0,5)).filter(id=>s.collection[id]);
  const positions=[[-441,-93],[-81,-10],[218,110],[475,32]];
  RAIDS.forEach((raid,index)=>{const [x,y]=positions[index];chart.tag(raid.name,x,y,182,index===this.tier,()=>{this.tier=index;this.open();});this.ui.panel(x,y-35,182,26,p,'#FFF9EC',232,11);this.ui.text(raid.waves+' 波 · 难度 '+(index+1),x,y-35,17,UI_COLORS.ink,p,195,28);});
  chart.boat(-232,-161,155);
  this.ui.panel(99,-180,375,43,p,'#FFF9EC',236,16);
  this.ui.text(RAIDS[this.tier].name+' · 双人小队',99,-180,24,UI_COLORS.ink,p,650,40);
  chart.button('副本宝箱',-342,-275,223,52,()=>this.rewards.boxes('raid',()=>this.open(),this.tier));
  chart.button('组队挑战',0,-275,330,59,()=>this.prepare(),true);
  chart.button('队伍 / 邀请',342,-275,223,52,()=>void this.act(()=>this.client.sync(),()=>this.client.room?this.lobby():this.invitations()));
 }
 private prepare():void{
  const p=this.page(RAIDS[this.tier].name,()=>this.open()),epoch=this.epoch;this.ui.panel(0,21,1120,422,p,'#FFF9EC',245,22);
  this.ui.text('我的备战阵容',0,178,28,UI_COLORS.ink,p,900,44);this.selected.forEach((id,i)=>{const t=this.service.snapshot.collection[id];if(!t)return;const n=this.ui.button('',(i-2)*204,58,184,174,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t),{parent:p});this.ui.pet(t,0,25,97,n);this.ui.text(visualName(t),0,-44,23,UI_COLORS.ink,n,167,36);});
  this.ui.button('调整备战伙伴',-252,-114,420,54,()=>this.picker(this.selected,ids=>{this.selected=ids;this.prepare();},()=>this.prepare()),{parent:p,size:24});this.ui.button('查看宝箱奖励',252,-114,420,54,()=>this.rewards.boxes('raid',()=>this.prepare(),this.tier),{parent:p,size:24});
  this.ui.button('创建队伍',-368,-269,326,59,()=>void this.act(()=>this.client.create(this.tier,this.selected)),{parent:p,primary:true,size:26,disabled:this.selected.length!==5});
  this.ui.button('开始匹配',0,-269,326,59,()=>this.matching(),{parent:p,primary:true,size:26,disabled:this.selected.length!==5});
  this.ui.button('输入邀请码',368,-269,326,59,()=>this.join(),{parent:p,size:25,disabled:this.selected.length!==5});
  this.ui.text('队伍由真人主动加入；队长可以手动补充 AI 队友。',0,-328,21,UI_COLORS.sand,p,1100,35);
 }
 private picker(selection:string[],done:(ids:string[])=>void,back:()=>void,page=0):void{
  const pets=Object.values(this.service.snapshot.collection),pages=Math.max(1,Math.ceil(pets.length/6)),p=this.page('选择五只备战伙伴',back);this.ui.text(`已选 ${selection.length} / 5 · 点击伙伴查看资料，再确定出战`,0,214,23,UI_COLORS.sand,p,1110,40);
  pets.slice(page*6,page*6+6).forEach((t,i)=>{const chosen=selection.includes(t.id),n=this.ui.card(t.role,visualName(t),`Lv.${levelInfo(t).level} · ${t.skills.length} 技能`,chosen?'已选择 '+(selection.indexOf(t.id)+1):'查看并选择',-383+i%3*383,90-Math.floor(i/3)*197,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:chosen?'取消出战':'确定出战',disabled:!chosen&&selection.length>=5,confirm:()=>this.picker(chosen?selection.filter(id=>id!==t.id):selection.concat(t.id),done,back,page)}),{parent:p,turtle:t,selected:chosen});});
  this.ui.button('‹',-506,-282,82,54,()=>this.picker(selection,done,back,page-1),{parent:p,disabled:page===0,size:28});this.ui.text(`${page+1}/${pages}`,-389,-282,22,UI_COLORS.ink,p,120,36);this.ui.button('›',-272,-282,82,54,()=>this.picker(selection,done,back,page+1),{parent:p,disabled:page===pages-1,size:28});this.ui.button('保存阵容',248,-282,555,54,()=>done(selection),{parent:p,primary:true,disabled:selection.length!==5,size:26});
 }
 private matching():void{
  const p=this.page('寻找同行伙伴',()=>this.prepare()),epoch=this.epoch,started=Date.now();this.ui.modernIcon(5,0,98,114,p);const text=this.ui.text('正在匹配相同副本的队伍…',0,-23,31,UI_COLORS.ink,p,1010,70);this.ui.text('匹配成功后进入准备房间，由队长开始战斗。',0,-98,22,UI_COLORS.sand,p,1030,50);
  this.ui.button('取消匹配',0,-249,460,56,()=>this.prepare(),{parent:p,size:25});
  let timer:ReturnType<typeof setTimeout>|undefined;p.once(Node.EventType.NODE_DESTROYED,()=>{if(timer)clearTimeout(timer);});
  const poll=async()=>{try{const r=await this.client.match(this.tier,this.selected);if(epoch!==this.epoch||!p.isValid)return;if(r){this.lobby();return;}const sec=Math.floor((Date.now()-started)/1000);if(sec>=20){this.noMatch();return;}text.string=`正在匹配同行队伍 · ${sec} 秒`;timer=setTimeout(poll,2300);}catch(e){if(epoch!==this.epoch||!p.isValid)return;text.string=e instanceof Error?e.message:'暂时无法连接';this.ui.button('重新匹配',0,-165,460,52,()=>this.matching(),{parent:p,primary:true,size:25});}};void poll();
 }
 private noMatch():void{const p=this.page('暂时没有合适的队伍',()=>this.prepare());this.ui.text('可以创建房间邀请朋友，或手动加入 AI 后出发。',0,47,30,UI_COLORS.ink,p,1020,110,true);this.ui.button('创建队伍',-258,-147,454,62,()=>void this.act(()=>this.client.create(this.tier,this.selected)),{parent:p,primary:true,size:26});this.ui.button('继续匹配',258,-147,454,62,()=>this.matching(),{parent:p,size:26});}
 private input(parent:Node,y:number,placeholder:string):EditBox{const n=this.ui.panel(0,y,620,64,parent),edit=n.addComponent(EditBox);edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=EditBox.InputFlag.DEFAULT;edit.maxLength=40;edit.textLabel=this.ui.text('',0,0,27,UI_COLORS.ink,n,580,54);edit.placeholderLabel=this.ui.text('',0,0,23,UI_COLORS.sand,n,580,50);edit.placeholder=placeholder;this.ui.anchorInput(edit);return edit;}
 private join():void{const p=this.ui.dialog('加入队伍','输入朋友分享的六位房间邀请码',()=>p.parent?.destroy(),790,340),input=this.input(p,-9,'邀请码');this.ui.button('加入',0,-114,408,54,()=>void this.act(()=>this.client.join(input.string.trim(),this.selected)),{parent:p,primary:true,size:25});}
 lobby():void{
  const r=this.client.room;if(!r){this.prepare();return;}this.tier=r.tier;const me=r.members.find(m=>m.clientId===r.me),host=r.host===r.me;
  const p=this.page(RAIDS[r.tier].name+' · 小队房间',()=>{if(r.raid&&!r.raid.settled){this.home();return;}void this.act(()=>this.client.action('leave'),()=>this.open());}),epoch=this.epoch;
  this.ui.text(`邀请码 ${r.code}　·　我的玩家 ID ${this.client.id}`,0,216,23,UI_COLORS.ink,p,1100,38);
  for(let i=0;i<2;i++){const m=r.members[i],n=this.ui.panel((i-.5)*460,59,420,229,p,'#FFF9EC',246,19);if(!m){this.ui.text('等待队友',0,5,25,UI_COLORS.sand,n,190,42);continue;}this.ui.text(m.name+(m.clientId===r.host?' · 队长':''),0,85,21,UI_COLORS.ink,n,198,34);this.ui.pet(m.roster[0],0,14,99,n);this.ui.text(m.ai?'AI 队友':m.clientId===r.me?'我':m.online?'真人 · 在线':'暂时离线',0,-56,19,UI_COLORS.sand,n,192,29);this.ui.text(m.ready?'✓ 已准备':'准备中',0,-90,20,m.ready?'#008F96':UI_COLORS.sand,n,192,29);if(host&&m.clientId!==r.me&&!r.raid)this.ui.button('移出',0,-149,140,41,()=>void this.act(()=>this.client.action('kick',{target:m.clientId})),{parent:n,size:20});}
  const status=this.ui.text(r.raid?'已开启副本，可以进入战场':r.matching?'正在招募队友，其他玩家可以匹配加入':'队伍等待准备，可以邀请朋友或补充 AI',0,-163,23,UI_COLORS.ink,p,1120,43);
  if(r.raid){this.ui.button(r.raid.settled?'查看结算':'进入战场',0,-253,546,61,()=>this.battle(r),{parent:p,primary:true,size:28});}
  else{
   this.ui.button('调整阵容',-446,-250,204,54,()=>this.picker(me?.roster.map(t=>t.id)??this.selected,ids=>{this.selected=ids;void this.act(()=>this.client.action('roster',{name:me?.name,roster:ids.map(id=>this.service.snapshot.collection[id])}));},()=>this.lobby()),{parent:p,size:23});
   this.ui.button('邀请玩家',-220,-250,204,54,()=>this.invitations(),{parent:p,size:23});
   this.ui.button(me?.ready?'取消准备':'我准备好了',17,-250,229,54,()=>void this.act(()=>this.client.action('ready',{enabled:!me?.ready})),{parent:p,selected:me?.ready,size:23});
   if(host)this.ui.button('全队出发',352,-250,390,54,()=>void this.act(()=>this.client.action('start'),()=>{const room=this.client.room;if(room)this.battle(room);}),{parent:p,primary:true,disabled:r.members.length!==2||r.members.some(m=>!m.ready&&!m.ai),size:27});
   if(host){this.ui.button('加入 AI',-331,-315,430,46,()=>void this.act(()=>this.client.action('ai')),{parent:p,disabled:r.members.length>=2,size:22});this.ui.button(r.matching?'停止招募':'开启匹配，让队友加入',228,-315,638,46,()=>void this.act(()=>this.client.action('matching',{enabled:!r.matching})),{parent:p,selected:r.matching,size:22});}
  }
  const signature=(room?:RoomView|null)=>room?JSON.stringify([room.members.map(m=>[m.clientId,m.ready,m.online,m.roster.map(t=>t.id)]),room.phase,room.matching,room.host]):'',before=signature(r);let timer:ReturnType<typeof setTimeout>|undefined;p.once(Node.EventType.NODE_DESTROYED,()=>{if(timer)clearTimeout(timer);});
  const sync=async()=>{try{await this.client.sync();if(epoch!==this.epoch||!p.isValid)return;if(signature(this.client.room)!==before){this.lobby();return;}}catch(e){if(p.isValid)status.string='连接暂时中断，正在重连；队伍进度仍保留。';}if(epoch===this.epoch&&p.isValid)timer=setTimeout(sync,1200);};timer=setTimeout(sync,1200);
 }
 private invitations():void{
  const p=this.page('邀请与在线玩家',()=>this.client.room?this.lobby():this.open()),r=this.client.room,all=this.client.state?.online??[];
  this.ui.text(r?`分享邀请码 ${r.code}，或点击在线玩家发出邀请`:'收到的邀请',0,217,24,UI_COLORS.ink,p,1110,42);
  if(r){all.slice(0,6).forEach((m,i)=>this.ui.button(`${m.name} · ${m.id}${m.inRoom?' · 在队伍中':''}`,-282+i%2*564,109-Math.floor(i/2)*95,536,73,()=>void this.act(()=>this.client.action('invite',{target:m.id}),()=>this.ui.toast('邀请已发送')),{parent:p,disabled:m.inRoom,size:24}));const input=this.input(p,-205,'输入玩家 ID 发送邀请');this.ui.button('邀请',0,-287,380,50,()=>void this.act(()=>this.client.action('invite',{target:input.string.trim().toUpperCase()}),()=>this.ui.toast('邀请已发送')),{parent:p,primary:true,size:25});}
  else{const invitations=this.client.state?.invitations??[];invitations.slice(0,5).forEach((v,i)=>this.ui.button(`${v.name} 邀请你挑战 ${RAIDS[v.tier].name} · ${v.code}`,0,136-i*80,1060,66,()=>void this.act(()=>this.client.join(v.code,this.selected)),{parent:p,size:24}));if(!invitations.length)this.ui.text('暂无邀请 · 朋友可使用你的玩家 ID：'+this.client.id,0,22,26,UI_COLORS.sand,p,1060,90,true);}
 }
}
