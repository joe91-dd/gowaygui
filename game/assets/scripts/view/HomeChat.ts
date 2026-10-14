import {EditBox,Label,Node} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import type {GameService} from '../core/game';
import {LOCAL_PLAYER} from '../core/community';

export interface HomeChatState {expanded:boolean;channel:'world'|'private'|'system';recipient:string;draft:string}
/** A compact view over the existing local chat transactions; no second message store. */
export function homeChat(ui:IslandUI,service:GameService,state:HomeChatState,redraw:()=>void,command:(kind:string)=>string,error:(e:unknown)=>void):void{
  const save=service.snapshot,c=save.community;
  const open=()=>{try{if(!service.snapshot.community)service.communityAction(command('communityInit'),{kind:'init'});state.expanded=!state.expanded;redraw();}catch(e){error(e);}};
  const friendIds=c?.friends.filter(id=>!c.blocked.includes(id))??[];
  if(!friendIds.includes(state.recipient))state.recipient=friendIds[0]??'';
  const name=(id:string)=>id===LOCAL_PLAYER?'我':`${(c?.aiPlayers[id]?.name??'岛友').replace(/·AI$/,'')}·AI`;
  const systemLines=['本地测试：聊天对象为AI，尚未联网。',...Object.values(save.results).sort((a,b)=>a.at-b.at).slice(-2).map(r=>`${r.victory?'挑战完成':'挑战结束'} · ${r.waves}波 · 金币 +${r.baseGold*(r.doubled?2:1)+r.firstClearGold}`)];
  const messages=c?.messages.filter(m=>state.channel==='world'?m.to==='world':m.to!=='world'&&(m.from===state.recipient&&m.to===LOCAL_PLAYER||m.from===LOCAL_PLAYER&&m.to===state.recipient)).map(m=>`${name(m.from)}：${m.text}`)??[];
  const lines=state.channel==='system'?systemLines:messages;
  const title=state.channel==='world'?'世界':state.channel==='private'?'私聊':'系统';
  if(!state.expanded){
    const text=`[${title}] ${lines[lines.length-1]??'点击展开聊天'}`;
    const p=ui.button('',438,258,346,42,open,{size:17});p.name='主页聊天:折叠';
    const label=ui.text(text, -15,0,17,UI_COLORS.ink,p,294,30);label.overflow=Label.Overflow.CLAMP;
    ui.text('＋',150,0,22,UI_COLORS.gold,p,30,30);return;
  }
  const p=ui.panel(438,168,346,222,ui.root,'#FFF9EC',250,20);p.name='主页聊天:展开';
  const tabs=[['私聊','private'],['世界','world'],['系统','system']] as const;
  tabs.forEach(([text,channel],i)=>ui.button(text,-112+i*86,90,80,34,()=>{state.channel=channel;redraw();},{parent:p,selected:state.channel===channel,size:18}));
  ui.button('−',147,90,34,34,open,{parent:p,size:23});
  if(state.channel==='system'){
    systemLines.slice(-3).forEach((line,i)=>ui.text(line,0,40-i*48,17,UI_COLORS.ink,p,316,44,true));return;
  }
  if(state.channel==='private')ui.button(state.recipient?`与 ${name(state.recipient)} · 切换`:'暂无可私聊好友',0,51,316,30,()=>{if(friendIds.length){state.recipient=friendIds[(friendIds.indexOf(state.recipient)+1)%friendIds.length];redraw();}},{parent:p,disabled:!friendIds.length,size:16});
  else ui.text('本地AI频道',0,51,16,UI_COLORS.sand,p,314,27);
  const visible=lines.length?lines.slice(-2):['聊聊阵容、合宠或下一关吧。'];
  visible.forEach((line,i)=>{const label=ui.text(line,0,11-i*45,16,UI_COLORS.ink,p,316,40,true);label.overflow=Label.Overflow.CLAMP;});
  const surface=ui.panel(-40,-84,230,36,p,'#EAF1ED'),input=ui.group('聊天输入',0,0,surface,230,36);input.active=false;
  const edit=input.addComponent(EditBox),old=[edit.textLabel?.node,edit.placeholderLabel?.node];
  edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.inputFlag=EditBox.InputFlag.DEFAULT;edit.maxLength=120;
  edit.textLabel=ui.text('',0,0,17,UI_COLORS.ink,input,214,30);edit.placeholderLabel=ui.text('',0,0,16,UI_COLORS.muted,input,214,30);
  for(const label of old)if(label){label.removeFromParent();label.destroy();}
  edit.placeholder='输入消息…';edit.string=state.draft;ui.anchorInput(edit);input.on(EditBox.EventType.TEXT_CHANGED,()=>state.draft=edit.string);input.active=true;
  ui.button('发送',122,-84,76,36,()=>{try{
    service.communityAction(command('homeChat'),{kind:'chat',to:state.channel==='world'?'world':state.recipient,text:edit.string});state.draft='';redraw();
  }catch(e){error(e);}},{parent:p,primary:true,disabled:state.channel==='private'&&!state.recipient,size:18});
}
