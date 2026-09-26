from pathlib import Path
p=Path('game/assets/scripts/view/CommunityMenus.ts');s=p.read_text(encoding='utf-8');s="import {ARENA_TIERS,arenaTier,arenaLocked} from '../core/progression';\nimport {AchievementMenus} from './AchievementMenus';\n"+s
a=s.index('  private arenaV2():void{');b=s.index('  private defensePreview()',a)
s=s[:a]+'''  private arenaV2():void{
    this.service.refreshClock(this.command('arenaClock'));const c=this.c,s=this.service.snapshot,a=s.progression!.arena,tier=arenaTier(a.rating),locked=arenaLocked(s.clockHighWater);this.ui.clear();const p=this.ui.sceneSheet('竞技场 · 潮汐赛季',this.home,'arena-background');
    const left=this.ui.panel(-367,14,382,430,p,'#FFF4DD');this.ui.modernIcon(6,0,108,104,left);this.ui.text(ARENA_TIERS[tier].name,0,20,40,UI_COLORS.ink,left,342,60);this.ui.text(`${a.rating} 积分 · 第 ${c.arenaOrder.indexOf(LOCAL_PLAYER)+1} 名`,0,-43,25,UI_COLORS.ink,left,342,40);this.ui.text('胜利 +48 · 失败 −18 · 平局 +8',0,-96,21,UI_COLORS.sand,left,350,34);this.ui.text(locked?'赛季已结算 · 周一重新启程':'匹配附近排名 · 本地 AI 对手',0,-159,22,UI_COLORS.sand,left,350,58,true);
    ARENA_TIERS.forEach((row,i)=>{const n=this.ui.panel(18+i%3*214,145-Math.floor(i/3)*186,198,167,p);this.ui.modernIcon(6,0,34,64,n);this.ui.text(row.name,0,-14,25,UI_COLORS.ink,n,178,36);this.ui.text(row.min+' 积分',0,-46,20,UI_COLORS.sand,n,178,29);const claimed=a.tierClaims.includes(i);this.ui.button(claimed?'已领取':'段位宝箱',0,-99,188,43,()=>{this.service.claimArenaTier(this.command('tierChest'),i);this.arena();},{parent:n,disabled:claimed||a.games===0||a.best<row.min,primary:!claimed&&a.games>0&&a.best>=row.min,size:21});});
    this.ui.text('每日 22:00 排名奖励 · 周日 22:00 赛季结算\u3000离线后下次进入补结算',185,-226,20,UI_COLORS.sand,p,728,38);
    this.ui.button('调整阵容',-429,-284,250,58,()=>this.pick('竞技进攻阵容',c.arenaAttack.length===5?[...c.arenaAttack]:Object.keys(s.collection).slice(0,5),5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});this.arena();},()=>this.arena(),0,true),{parent:p,size:24});
    this.ui.button('防守',-217,-284,135,58,()=>this.pick('防守阵容',c.arenaDefense.length===5?[...c.arenaDefense]:Object.keys(s.collection).slice(0,5),5,false,ids=>{this.dispatch({kind:'arenaDefense',ids});this.arena();},()=>this.arena(),0,true),{parent:p,size:24});
    this.ui.button('结算宝箱',-17,-284,237,58,()=>new AchievementMenus(this.ui,this.service,this.command,this.home,this.error).open('rewards'),{parent:p,size:24});
    this.ui.button(c.arena&&!c.arena.settled?'继续对战':locked?'周一开启匹配':'开始匹配',338,-284,417,58,()=>{if(c.arena&&!c.arena.settled){this.challenge('arena');return;}const ids=c.arenaAttack.length===5?c.arenaAttack:Object.keys(s.collection).slice(0,5);this.service.matchArena(this.command('arenaMatch'),ids);this.challenge('arena');},{parent:p,primary:true,disabled:locked&&!(c.arena&&!c.arena.settled),size:27});
  }
''' +s[b:]
s=s.replace("this.open('三大副本','五人队 · 十六个共享站位 · 每人备战五只、上阵一只 · 当前匹配四位AI')", "this.open('海岛副本','五人队 · 共享站位 · 每人备战五只，上阵一只 · 当前队友为本地 AI')")
s=s.replace("-384+i*384,44,360,p", "-286+i%2*572,93-Math.floor(i/2)*211,550,p").replace('false,false,330);','false,false,194);')
s=s.replace("0,36,n,172,172", "-182,0,n,142,142").replace('172,172);','142,142);').replace('[4,5,6][i]','[4,5,6,8][i]')
s=s.replace('r.name,0,128,30','r.name,80,62,28').replace('`${r.waves} 波 · 难度 ${i+1}`,0,-60,23','`${i===3?"限时180秒":r.waves+" 波"} · 难度 ${Math.min(3,i+1)}`,80,16,22').replace('金币\n食材各${r.food} · 技能书${r.books}`,0,-120,23','金币\n食材各${r.food} · 技能书${r.books}`,80,-45,21')
s=s.replace("'多入口同时进攻，需要分路防守；未通关只获得少量进度金币。',0,-190", "'通关额外奖励星级宝箱；双环潮狱剩余 ≤15只通关，≤5只完美。',0,-239")
p.write_text(s,encoding='utf-8')
