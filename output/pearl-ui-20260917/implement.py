from pathlib import Path
import json
root=Path('game/assets/scripts/view')
def edit(name,fn):
 p=root/name;s=p.read_text(encoding='utf-8');p.write_text(fn(s),encoding='utf-8')
def rep(s,a,b):
 assert a in s,a[:140]
 return s.replace(a,b,1)
def prototype(s):
 s="import {WishSequence} from './MenuMotion';\n"+s
 s=rep(s,"const display=this.ui.group('祈愿展示',-261,-27,p,460,364);","this.ui.atmosphere(p,'wish',-261,-27,540,350);const display=this.ui.group('祈愿展示',-261,-27,p,460,364);")
 a="this.ui.portrait(role,0,0,i===1?218:172,n,true);tween(n).delay(i*.23).repeatForever(tween().by(1.6,{position:new Vec3(0,8,0)},{easing:'sineInOut'}).by(1.6,{position:new Vec3(0,-8,0)},{easing:'sineInOut'})).start();"
 s=rep(s,a,"this.ui.portrait(role,0,0,i===1?254:230,n,true);")
 s=rep(s,"this.ui.bookIcon(id,0,0,i===0?104:88,n);tween(n)","this.ui.bookIcon(id,0,0,i===0?104:88,n);if(!this.ui.reducedMotion())tween(n)")
 a="()=>this.action(()=>{this.service.purchaseShop(this.command('shop'),pool,n);this.sound('purchase');this.shop(pool);})"
 b="()=>this.action(()=>{this.service.purchaseShop(this.command('shop'),pool,n);this.sound('purchase');WishSequence.play(this.ui,this.ui.root,pool,()=>this.shop(pool));})"
 s=rep(s,a,b)
 s=rep(s,"65-Math.floor(i/5)*159,200,144","57-Math.floor(i/5)*183,200,166")
 s=rep(s,"this.ui.bookIcon(skill.id,-45,21,70,n);this.ui.text('×'+s.skillBooks![skill.id],49,22,24,UI_COLORS.ink,n,85,37);this.ui.text(skill.name,0,-39,22,UI_COLORS.ink,n,190,33);this.ui.text(skillCategory(skill),0,-64,16,UI_COLORS.sand,n,185,23);","this.ui.bookIcon(skill.id,-24,23,86,n);this.ui.text('×'+s.skillBooks![skill.id],64,26,22,UI_COLORS.ink,n,57,37);this.ui.text(skill.name,0,-40,23,UI_COLORS.ink,n,190,33);this.ui.text(skillCategory(skill),0,-66,17,UI_COLORS.sand,n,185,25);")
 s=rep(s,"this.ui.panel(0,1,1130,450,p,'#FFF9EC',247,24);","this.ui.atmosphere(p,'fusion',0,0,560,390);this.ui.panel(-378,1,332,450,p,'#FFF9EC',240,24);this.ui.panel(378,1,332,450,p,'#FFF9EC',240,24);this.ui.panel(0,-26,360,204,p,'#FFF9EC',235,22);")
 s=rep(s,"this.ui.portrait(t.role,0,27,216,n,true)","this.ui.portrait(t.role,0,27,238,n,true)")
 s=rep(s,"this.ui.pet(t,0,25,98,n)","this.ui.pet(t,0,24,106,n)")
 s=rep(s,"this.ui.text(names[i],0,83,23,UI_COLORS.ink,n,252,34);const picture=this.ui.group('礼包物品图',-60,-1,n,138,138);if(i===2||i===3)this.ui.bookIcon(i===2?'strong':'combo',0,0,116,picture);else this.ui.art!.attach(picture,`shop-${i}` as ArtV2Slice,138,138);", "this.ui.text(names[i],0,84,23,UI_COLORS.ink,n,252,34);const picture=this.ui.group('礼包物品图',-65,5,n,124,124);if(i===2||i===3)this.ui.bookIcon(i===2?'strong':'combo',0,0,106,picture);else this.ui.art!.attach(picture,`shop-${i}` as ArtV2Slice,124,124);")
 s=rep(s,"this.ui.panel(-61,-80,110,32,n,UI_COLORS.green);this.ui.text('查看',-61,-80,20,'#FFFFFF',n,100,26);","this.ui.panel(0,-81,240,37,n,UI_COLORS.green,255,16);this.ui.text('查看礼包',0,-81,20,'#FFFFFF',n,224,28);")
 return s
edit('PrototypeMenus.ts',prototype)
def entry(s):
 s=rep(s,"this.ui.pet(t,0,29,99,n)","this.ui.pet(t,0,29,112,n)")
 s=rep(s,"this.ui.portrait(t.role,388,-5,180,p,true)","this.ui.portrait(t.role,388,-5,212,p,true)")
 s=rep(s,"this.ui.modernIcon(icon,-103,9,72,n);this.ui.text(title,40,23,28,UI_COLORS.ink,n,215,42);this.ui.text(caption,39,-25,19,UI_COLORS.sand,n,223,45,true);", "this.ui.modernIcon(icon,0,39,78,n);this.ui.text(title,0,-18,28,UI_COLORS.ink,n,315,42);this.ui.text(caption,0,-57,20,UI_COLORS.sand,n,310,34);")
 return s
edit('GameEntry.ts',entry)
def codex(s):
 s=rep(s,"26-Math.floor(i/5)*145,205,133", "list.length<=5?-69:16-Math.floor(i/5)*162,205,list.length<=5?288:151")
 s=rep(s,"this.ui.bookIcon(skill.id,0,22,69,n);this.ui.text(skill.name,0,-30,21,UI_COLORS.ink,n,195,29);this.ui.text(unlocked?'已发现':'未发现',0,-54,17,unlocked?'#009987':UI_COLORS.muted,n,190,24);", "this.ui.bookIcon(skill.id,0,list.length<=5?36:23,list.length<=5?116:82,n);this.ui.text(skill.name,0,list.length<=5?-55:-37,23,UI_COLORS.ink,n,195,32);this.ui.text(unlocked?'已发现':'未发现',0,list.length<=5?-101:-64,19,unlocked?'#009987':UI_COLORS.muted,n,190,27);")
 return s
edit('AchievementMenus.ts',codex)
def community(s):
 s=rep(s,"this.ui.portrait(Object.values(a.pets)[0].role,-112,0,88,n);this.ui.text(a.name,58,43,32,UI_COLORS.cream,n,210,46);this.ui.text(c.blocked.includes(a.id)?'已屏蔽':c.friends.includes(a.id)?'我的好友':'点击添加好友',58,-14,26,UI_COLORS.sand,n,214,40);this.ui.text(`援助 ${a.assists.length} 只`,58,-60,26,UI_COLORS.gold,n,208,34);", "this.ui.portrait(Object.values(a.pets)[0].role,-109,20,94,n);this.ui.text(a.name,55,40,28,UI_COLORS.cream,n,202,42);this.ui.text(c.blocked.includes(a.id)?'已屏蔽':c.friends.includes(a.id)?'我的好友':'添加好友',55,-3,22,UI_COLORS.sand,n,202,34);this.ui.line(-150,-38,150,-38,n);this.ui.text(`援助伙伴 ${a.assists.length} 只   ›`,0,-62,22,UI_COLORS.gold,n,310,32);")
 a="rows.slice(current*4,current*4+4).forEach((r,i)=>{const n=this.button('',0,57-i*76,1096,p,()=>this.rankPet(r.turtle,r.ownerId),false,false,66);this.ui.portrait(r.turtle.role,-476,0,54,n);this.ui.text(`${current*4+i+1}  ${this.petName(r.turtle)} · ${r.score.toFixed(1)}分 · 持有人 ${r.ownerName}`,24,0,27,UI_COLORS.cream,n,960,54);});"
 b="[['排名',-485],['伙伴',-273],['持有人',102],['评分',428]].forEach(([label,x])=>this.ui.text(String(label),Number(x),97,20,UI_COLORS.sand,p,240,32));rows.slice(current*4,current*4+4).forEach((r,i)=>{const n=this.button('',0,37-i*77,1096,p,()=>this.rankPet(r.turtle,r.ownerId),false,false,68);this.ui.text(String(current*4+i+1),-485,0,28,current*4+i<3?'#AB853E':UI_COLORS.sand,n,66,42);this.ui.pet(r.turtle,-396,0,53,n);this.ui.text(this.petName(r.turtle),-256,0,26,UI_COLORS.ink,n,210,42);this.ui.text(r.ownerName,102,0,23,UI_COLORS.sand,n,355,42);this.ui.text(r.score.toFixed(1),428,0,28,UI_COLORS.gold,n,148,42);});"
 s=rep(s,a,b);return s
edit('CommunityMenus.ts',community)
def tasks(s):
 start=s.index('  const pages=Math.max(1,Math.ceil(rows.length/3))')
 end=s.index("  this.ui.button('分享给好友'",start)
 old=s[start:end]
 special="""  if(tab==='login'){
   rows.forEach((row,i)=>{
    const last=i===6,n=this.ui.panel(last?444:-204+i%3*206,last?-40:37-Math.floor(i/3)*166,last?228:194,last?313:151,p,last?'#DDF8F0':'#FFF9EC',248,18);
    this.ui.text(row.title,0,last?124:55,last?27:22,UI_COLORS.ink,n,last?200:178,34);
    if(last){this.ui.portrait('stone',0,22,146,n,true);this.ui.text('8 技能随机伙伴 ×1',0,-76,21,UI_COLORS.gold,n,210,32);}
    else {this.ui.art?.attach(this.ui.group('七日奖励',-51,4,n,47,49),'chest-1',47,49);const gift=LOGIN_GIFTS[i];this.ui.text('金币 '+gift.gold.toLocaleString(),30,14,17,UI_COLORS.ink,n,116,25);this.ui.text('食材各 '+gift.material+' 份',30,-11,17,UI_COLORS.sand,n,116,25);}
    this.ui.button(row.claimed?'已领取':row.eligible?'领取奖励':'未达成',0,last?-123:-50,last?188:158,35,()=>void this.act(row.claim,()=>{this.ui.feedback?.('reward');this.open('login',0,false);}),{parent:n,disabled:row.claimed||!row.eligible||!this.client.session,primary:row.eligible&&!row.claimed,size:19});
   });
  }else{
"""
 s=s[:start]+special+old+'  }\n'+s[end:];return s
edit('TaskMenus.ts',tasks)
config=json.loads(Path('game/build-config.ui-fusion.json').read_text(encoding='utf-8-sig'));config['name']='哥喂龟 · 海岛珠光界面';config['outputName']='pearl-ui-20260917';Path('game/build-config.pearl-ui.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
print('Page layouts and committed wish animation integrated.')
