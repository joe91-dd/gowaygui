from pathlib import Path
p=Path('game/assets/scripts/view/IslandUI.ts');s=p.read_text(encoding='utf-8');s=s.replace("    if(this.art?.ready){const scenery=this.group('页面海岛背景',0,0,this.root,1280,720);this.art.attach(scenery,'home-background',1280,720);}\n    const veil=this.group('页面遮罩',0,0,this.root,1280,720),graphics=veil.addComponent(Graphics);", "    const veil=this.group('页面遮罩',0,0,this.root,1280,720),graphics=veil.addComponent(Graphics);\n    if(this.art?.ready){const scenery=this.group('页面海岛背景',0,0,veil,1280,720);this.art.attach(scenery,'home-background',1280,720);}");p.write_text(s,encoding='utf-8')
p=Path('game/assets/scripts/view/GameEntry.ts');s=p.read_text(encoding='utf-8');a=s.index('  private error(error:unknown):void{');b=s.index('  private onHide()',a);s=s[:a]+'''  private error(error:unknown):void{
    console.error('[GOWAYGUI]',error);if(this.disposed||!this.ui||this.errorPanel?.isValid)return;
    const close=()=>{const panel=this.errorPanel;this.errorPanel=undefined;panel?.parent?.destroy();};
    const p=this.ui.dialog('暂时无法操作','',close,740,330);this.errorPanel=p;
    this.ui.text(error instanceof Error?error.message:String(error),0,20,25,UI_COLORS.ink,p,670,108,true);
    this.ui.button('返回当前页面',-170,-110,280,56,close,{parent:p,size:25});
    const s=this.service?.snapshot,mode=s?.community?.raid&&!s.community.raid.settled?'raid':s?.community?.arena&&!s.community.arena.settled?'arena':undefined;
    const pending=mode||s?.run&&s.run.phase!=='result';
    this.ui.button(pending?'继续未完成的战斗':'返回海岛',160,-110,290,56,()=>{close();if(pending)this.openBattle(mode);else this.go('home');},{parent:p,primary:true,size:25});
  }
''' +s[b:];p.write_text(s,encoding='utf-8')
