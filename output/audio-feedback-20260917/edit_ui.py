from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def edit(name, pairs):
    path=ROOT/'game/assets/scripts/view'/name
    text=path.read_text(encoding='utf8')
    for old,new in pairs:
        assert old in text,(name,old)
        text=text.replace(old,new)
    path.write_text(text,encoding='utf8')

edit('GameEntry.ts',[
 ("()=>{this.audio?.unlock();this.audio?.effect('sfx_ui_confirm');}","kind=>{this.audio?.unlock();this.audio?.effect(kind==='back'?'sfx_ui_back':'sfx_ui_confirm');}"),
 ('this.ui.onActionError=error=>this.error(error);','this.bindUiAudio();'),
 ('this.ui=new IslandUI(this.ui.root,this.ui.click,this.icons,this.panels,this.portraits,this.art);','this.ui=new IslandUI(this.ui.root,this.ui.click,this.icons,this.panels,this.portraits,this.art);this.bindUiAudio();'),
 ('  private act(action:()=>void):void',"  private bindUiAudio():void{\n    this.ui.onActionError=error=>this.error(error);\n    this.ui.feedback=kind=>this.audio?.effect({reward:'sfx_collect',purchase:'sfx_purchase',upgrade:'sfx_upgrade',equip:'sfx_equip',chest:'sfx_chest',learnComplete:'sfx_learn_complete',error:'sfx_ui_error'}[kind]);\n  }\n  private act(action:()=>void):void"),
 ("purchase:'sfx_purchase',learn:'sfx_learn'","purchase:'sfx_purchase',learn:'sfx_learn',learnComplete:'sfx_learn_complete'"),
 ("if(!hero)return;new PetDetails", "if(!hero||!this.ui.isInteractive(info))return;this.ui.click();new PetDetails"),
 ("this.service!.setHomeTeam(this.command('homeTeam'),this.teamSelection);", "this.service!.setHomeTeam(this.command('homeTeam'),this.teamSelection);this.ui.feedback?.('equip');"),
 ("this.service!.swapCollectionOrder(this.command('petOrder'),t.id,id);", "this.service!.swapCollectionOrder(this.command('petOrder'),t.id,id);this.ui.feedback?.('equip');"),
 ("()=>this.act(()=>this.service!.train(this.command('train'),t.id,key))", "()=>this.act(()=>{this.service!.train(this.command('train'),t.id,key);this.ui.feedback?.('upgrade');})"),
 ('  private error(error:unknown,startNewBattle?:()=>void):void{',"  private error(error:unknown,startNewBattle?:()=>void):void{\n    this.audio?.effect('sfx_ui_error');"),
])
edit('PrototypeMenus.ts',[
 ("|'purchase'|'learn')=>void", "|'purchase'|'learn'|'learnComplete')=>void"),
 ("this.lastBook=pending.receipt;this.sound('learn');", "this.lastBook=pending.receipt;this.sound('learnComplete');"),
 ("this.parentSlot=this.parents[other]?slot:other;this.chooseParents(current);", "this.parentSlot=this.parents[other]?slot:other;this.ui.feedback?.('equip');this.chooseParents(current);"),
 ("this.service.swapCollectionOrder(this.command('petOrder'),t.id,id);", "this.service.swapCollectionOrder(this.command('petOrder'),t.id,id);this.ui.feedback?.('equip');"),
 ("this.service.setLocked(this.command('lock'),id,!t.locked);", "this.service.setLocked(this.command('lock'),id,!t.locked);this.ui.feedback?.('equip');"),
])
edit('PetDetails.ts',[
 ("this.service.resetPetPoints(this.command('reset'),t.id);", "this.service.resetPetPoints(this.command('reset'),t.id);this.ui.feedback?.('equip');"),
 ("this.service.allocatePetPoints(this.command('allocate'),t.id,this.draft);", "this.service.allocatePetPoints(this.command('allocate'),t.id,this.draft);this.ui.feedback?.('upgrade');"),
 ("act(()=>this.service.train(this.command('train'),t.id,key))", "act(()=>{this.service.train(this.command('train'),t.id,key);this.ui.feedback?.('upgrade');})"),
])
edit('RewardMenus.ts',[
 ("this.service.claimChest(this.command('chest'),c.id);", "this.service.claimChest(this.command('chest'),c.id);this.ui.feedback?.('chest');"),
 ("this.service.claimMail(this.command('mailClaim'),m.id);", "this.service.claimMail(this.command('mailClaim'),m.id);this.ui.feedback?.('reward');"),
 ("const id=this.service.openBookPack(this.command('bookPack'),grade);", "const id=this.service.openBookPack(this.command('bookPack'),grade);this.ui.feedback?.('chest');"),
])
edit('AchievementMenus.ts',[
 ("this.service.claimCodex(this.command('codex'),'skill',skill.id);", "this.service.claimCodex(this.command('codex'),'skill',skill.id);this.ui.feedback?.('reward');"),
 ("this.service.claimCodex(this.command('bossCodex'),'boss',boss.id);", "this.service.claimCodex(this.command('bossCodex'),'boss',boss.id);this.ui.feedback?.('reward');"),
])
edit('CommunityMenus.ts',[
 ("this.service.claimArenaTier(this.command('tierChest'),tier);", "this.service.claimArenaTier(this.command('tierChest'),tier);this.ui.feedback?.('chest');"),
])
edit('TaskMenus.ts',[
 ('this.act(row.claim,()=>this.open(tab,current,false))',"this.act(row.claim,()=>{this.ui.feedback?.('reward');this.open(tab,current,false);})"),
 ("notice.string='奖励已到账';done?.();", "notice.string='奖励已到账';this.ui.feedback?.('reward');done?.();"),
 ('if(page?.isValid)', 'if(page&&this.ui.isInteractive(page))'),
])
edit('WorldBossMenus.ts',[
 ("this.ui.toast('奖励已发到系统邮箱，请领取附件');", "this.ui.feedback?.('reward');this.ui.toast('奖励已发到系统邮箱，请领取附件');"),
])
print('Wired UI, growth, rewards, skill reveal and drag feedback.')
