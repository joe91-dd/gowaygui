const fs=require('fs');function edit(file,fn){let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const r=(a,b)=>{if(!s.includes(a))throw Error(file+' missing '+a.slice(0,90));s=s.replace(a,b);};fn(r,()=>s,v=>s=v);fs.writeFileSync(file,s);}
edit('game/assets/scripts/view/CommunityMenus.ts',(r,g,s)=>{
 s("import {matchArena as findArenaOpponent} from '../core/arena';\nimport {arenaSettlementAt,arenaWeeklyGrants} from '../core/progression';\n"+g());
 r("import {EditBox,Node}","import {EditBox,Node,Mask,Graphics,EventTouch,EventMouse}");
 r('private error:(e:unknown)=>void){}','private error:(e:unknown)=>void,private watch?:(id:string)=>void){}');
 const a=g().indexOf('  private arenaV2():void{'),b=g().indexOf('  private defensePreview():void{',a);
 s(g().slice(0,a)+`  private arenaV2(tierPage?:number):void{
    this.service.refreshClock(this.command('arenaClock'));const c=this.c,s=this.service.snapshot,a=s.progression!.arena,current=arenaTier(a.rating),tier=tierPage??current,locked=arenaLocked(s.clockHighWater);this.ui.clear();const p=this.ui.sceneSheet('竞技场 · 潮汐赛季',this.home,'arena-background'),rewards=new RewardMenus(this.ui,this.service,this.command,this.error);
    const left=this.ui.panel(-361,-4,397,442,p,'#FFF9EC',246,22);this.ui.text('我的段位 · '+ARENA_TIERS[current].name,0,186,23,UI_COLORS.ink,left,354,38);this.ui.modernIcon(6,0,101,105,left);this.ui.text(ARENA_TIERS[tier].name,0,15,35,UI_COLORS.ink,left,340,52);this.ui.text(tier===current?a.rating+' 积分':ARENA_TIERS[tier].min+' 积分解锁',0,-30,23,UI_COLORS.sand,left,337,35);
    this.ui.button('‹',-148,31,47,58,()=>this.arenaV2(Math.max(0,tier-1)),{parent:left,disabled:tier===0,size:30});this.ui.button('›',148,31,47,58,()=>this.arenaV2(Math.min(5,tier+1)),{parent:left,disabled:tier===5,size:30});
    let start=0;left.on(Node.EventType.TOUCH_START,(e:EventTouch)=>start=e.getLocation().x);left.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{const d=e.getLocation().x-start;if(Math.abs(d)>60)this.arenaV2(Math.max(0,Math.min(5,tier+(d<0?1:-1))));});
    const claimed=a.tierClaims.includes(tier),eligible=a.games>0&&a.best>=ARENA_TIERS[tier].min&&!claimed,grants=[{kind:'gold' as const,amount:goldAmount(s,80+tier*90)},{kind:'material' as const,material:'attack' as const,amount:1+tier}];
    this.ui.button(claimed?'段位宝箱 · 已领取':eligible?'领取段位宝箱':'查看段位宝箱',0,-96,324,49,()=>rewards.detail(ARENA_TIERS[tier].name+' 段位宝箱',grants,eligible?()=>{this.service.claimArenaTier(this.command('tierChest'),tier);this.arenaV2(tier);}:undefined,claimed?'本赛季已经领取':'本赛季首次达到该段位即可领取'),{parent:left,primary:eligible,size:23});
    this.ui.text((tier+1)+' / 6 · 左右滑动查看',0,-151,18,UI_COLORS.sand,left,350,30);this.ui.text('胜 +48　负 −18　平 +8',0,-187,18,UI_COLORS.sand,left,350,29);
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
`+g().slice(b));
 const c=g().indexOf('  private arenaOpponent('),d=g().indexOf('  private pick(',c);
 s(g().slice(0,c)+`  private arenaOpponent(id:string,matched=false):void{
    const a=this.c.aiPlayers[id];if(!a)return;const p=this.open((matched?'匹配成功 · ':'')+a.name,'对手防守阵容 · 点击伙伴查看资料',()=>this.arena());
    Object.values(a.pets).slice(0,5).forEach((t,i)=>{const n=this.ui.button('',-444+i*222,69,204,247,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t),{parent:p});this.ui.pet(t,0,38,114,n);this.ui.text(this.petName(t),0,-52,25,UI_COLORS.ink,n,188,39);this.ui.text(t.skills.length+' 技能 · '+turtleQuality(t).name,0,-95,20,UI_COLORS.sand,n,192,34);});
    this.ui.text('进攻伙伴依次进入防线，至少三只通过即可获胜。',0,-130,24,UI_COLORS.sand,p,1080,45);
    const selection=this.c.arenaAttack.length===5?[...this.c.arenaAttack]:Object.keys(this.service.snapshot.collection).slice(0,5);
    this.ui.button('观看防线演练',-359,-264,338,58,()=>this.watch?.(id),{parent:p,disabled:!this.watch,size:24});this.ui.button('调整进攻阵容',0,-264,338,58,()=>this.pick('我的进攻阵容',selection,5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});this.arenaOpponent(id,matched);},()=>this.arenaOpponent(id,matched),0,true),{parent:p,size:24});
    const rank=this.c.arenaOrder.indexOf(LOCAL_PLAYER),eligible=Math.abs(this.c.arenaOrder.indexOf(id)-rank)<=3;
    this.ui.button('开始对战',359,-264,338,58,()=>{try{this.service.beginArena(this.command('arena'),id,selection);this.challenge('arena');}catch(e){this.error(e);}},{parent:p,primary:true,disabled:!eligible||arenaLocked(this.service.snapshot.clockHighWater),size:25});
  }
`+g().slice(d));
});
edit('game/assets/scripts/view/GameEntry.ts',(r,g,s)=>{
 s("import {ArenaWatchScreen} from './ArenaWatchScreen';\n"+g());s(g().replaceAll('BattleScreen|ChallengeScreen|LiveRaidScreen','BattleScreen|ChallengeScreen|LiveRaidScreen|ArenaWatchScreen').replaceAll("challengeMode?:'raid'|'arena'|'online'","challengeMode?:'raid'|'arena'|'online'|'watch'"));
 r('private roomClient?:RoomClient;',"private watchOpponent='';private roomClient?:RoomClient;");
 r("mode=>this.openBattle(mode),e=>this.error(e));", "mode=>this.openBattle(mode),e=>this.error(e),id=>{this.watchOpponent=id;this.openBattle('watch');});");
 r("const id=this.challengeMode==='online'?","const id=this.challengeMode==='watch'?54:this.challengeMode==='online'?");r("const levelId=challengeMode==='online'?","const levelId=challengeMode==='watch'?54:challengeMode==='online'?");
 r("controller=this.challengeMode==='online'?", "controller=this.challengeMode==='watch'?new ArenaWatchScreen(this.service!,this.watchOpponent,this.ui,arrival.world,()=>{home();this.communityEntry('arena');}):this.challengeMode==='online'?");
});
