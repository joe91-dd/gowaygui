from pathlib import Path
import shutil,json
R=Path(__file__).resolve().parent;ROOT=R.parents[1]
def edit(rel,fn):
 p=ROOT/rel;s=p.read_text('utf8');b=R/'before'/rel;b.parent.mkdir(parents=True,exist_ok=True)
 if not b.exists():shutil.copy2(p,b)
 p.write_text(fn(s),encoding='utf8')
def battle(s):
 s="import {FaunaAura} from './FaunaAura';\nimport {faunaAuraGrade} from '../core/faunaAura';\n"+s
 s=s.replace('private readonly faunaRadiance=new FaunaRadiance();','private readonly faunaRadiance=new FaunaRadiance();\n  private readonly faunaAura=new FaunaAura();')
 old="this.faunaRadiance.apply(actor.model,world?6:boss?.tier??Math.floor(battle.levelId/10),world?.color??boss?.color??['#67BBA9','#58AFC9','#ABA5D5','#E3B773'][Math.floor(battle.levelId/5)%4],enemy.kind==='boss');"
 s=s.replace(old,old+"this.faunaAura.apply(actor.node,actor.height,faunaAuraGrade(enemy.kind,battle.levelId,boss?.tier,!!world),enemy.kind==='boss',enemy.alive);")
 s=s.replace('this.faunaRadiance.update(frame);','this.faunaRadiance.update(frame);this.faunaAura.update(frame);')
 s=s.replace('this.faunaRadiance.destroy();','this.faunaAura.destroy();this.faunaRadiance.destroy();')
 s=s.replace("!key.startsWith('fauna-')&&resources.getInfoWithPath",'resources.getInfoWithPath')
 return s
edit('game/assets/scripts/view/BattleWorld.ts',battle)
def codex(s):
 s="import {CodexAura} from './CodexAura';\nimport {FAUNA_AURAS,faunaAuraGrade} from '../core/faunaAura';\n"+s
 start=s.index('  const stage=this.ui.panel');end=s.index('  return stage;',start)
 s=s[:start]+'''  const model=FAUNA_MODELS.find(m=>m.key===key),boss=key.startsWith('boss-')?BOSSES[Number(key.slice(5))]:undefined;
  const grade=faunaAuraGrade(model?.kind??'boss',0,boss?.tier,key.startsWith('world-boss-'));
  const aura=FAUNA_AURAS[grade];
  const stage=this.ui.panel(x,y,w,h,parent,'#F6F5E9',255,16),g=this.ui.group('海湾陈列台',0,0,stage).addComponent(Graphics);
  g.fillColor=new Color('#E0F0EC');g.ellipse(0,-h*.08,w*.43,h*.32);g.fill();
  g.fillColor=new Color('#CEE6E4');g.ellipse(0,-h*.28,w*.39,h*.11);g.fill();
  g.fillColor=new Color('#EDE5CE');g.ellipse(0,-h*.35,w*.33,h*.073);g.fill();
  g.fillColor=new Color(26,55,62,50);g.ellipse(0,-h*.35,w*.21,h*.028);g.fill();
  const addAura=(front:boolean)=>{const n=this.ui.group(front?'灵焰前景':'灵焰后景',0,0,stage),a=n.addComponent(CodexAura);a.width=w;a.height=h;a.grade=grade;a.front=front;};
  addAura(false);
  const figure=this.ui.group('图鉴实装造型:'+key,0,2,stage,w,h);const size=Math.min(w,h)*.99;this.ui.art?.attach(figure,key as any,size,size);
  addAura(true);
  const edge=this.ui.group('品阶边缘',0,0,stage),stroke=edge.addComponent(Graphics);stroke.strokeColor=new Color('#D7E4DA');stroke.lineWidth=1;stroke.roundRect(-w/2,-h/2,w,h,16);stroke.stroke();
  stroke.strokeColor=new Color(aura.color);stroke.lineWidth=3;stroke.moveTo(-w*.16,-h/2+2);stroke.lineTo(w*.16,-h/2+2);stroke.stroke();
''' + s[end:]
 s=s.replace('this.worldBossCards(p);','this.worldBossCards(p,page);')
 s=s.replace('Math.ceil(list.length/6)','Math.ceil(list.length/3)').replace('list.slice(page*6,page*6+6)','list.slice(page*3,page*3+3)')
 s=s.replace("-386+i%3*386,11-Math.floor(i/3)*171,363,158","-386+i*386,-58,363,316")
 s=s.replace("-108,0,139,144,boss.color","0,42,337,210,boss.color")
 s=s.replace("boss.name,66,38,22","boss.name,0,-79,25").replace("boss.skill,66,-3,19","boss.skill,0,-116,20").replace("(unlocked?'已击败':'未击败'),66,-42,17","(unlocked?'已击败':'未击败'),0,-143,16")
 # Wide illustration frame already carries animated gold; remove the old square overlay.
 a="    if(boss.tier===5){const glow=this.ui.group('金色首领流光',0,0,icon);glow.addComponent(GoldFlow).side=133;}"
 s=s.replace(a,'')
 s=s.replace('Math.ceil(FAUNA_MODELS.length/6)','Math.ceil(FAUNA_MODELS.length/3)').replace('FAUNA_MODELS.slice(page*6,page*6+6)','FAUNA_MODELS.slice(page*3,page*3+3)')
 s=s.replace('-386+i%3*386,15-Math.floor(i/3)*179,363,166','-386+i*386,-58,363,316')
 s=s.replace('m.key,-106,0,142,151','m.key,0,42,337,210')
 s=s.replace('m.name,77,38,23','m.name,0,-79,25').replace('FAUNA_THREATS[m.kind],77,-3,20','FAUNA_THREATS[m.kind],0,-116,20').replace("'陆地生物',77,-40,18","'陆地生物',0,-143,16")
 s=s.replace('private worldBossCards(p:Node):void{','private worldBossCards(p:Node,page=0):void{\n  page=Math.max(0,Math.min(1,page));')
 s=s.replace('WORLD_BOSSES.forEach((boss,i)=>','WORLD_BOSSES.slice(page*3,page*3+3).forEach((boss,i)=>')
 s=s.replace('-386+i%3*386,9-Math.floor(i/3)*174,363,159','-386+i*386,-58,363,316')
 s=s.replace('boss.art,-107,0,142,150,boss.color','boss.art,0,42,337,210,boss.color')
 s=s.replace('boss.name,77,35,25','boss.name,0,-79,25').replace("'世界级 · 霸主',77,-7,19","'世界级 · 霸主',0,-116,20").replace("'每日轮换 · 点击查看',77,-43,17","'每日轮换 · 点击查看',0,-143,16")
 s=s.replace("  this.ui.group('世界首领金光',0,0,art).addComponent(GoldFlow).side=148;",'')
 s=s.replace("});this.ui.text('以最高伤害留下你的名字',0,-278,24,UI_COLORS.ink,p,990,40);","});this.ui.button('上一页',-250,-279,205,46,()=>this.open('bosses',6,page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / 2',0,-279,22,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,46,()=>this.open('bosses',6,page+1),{parent:p,disabled:page===1,size:22});")
 return s
edit('game/assets/scripts/view/AchievementMenus.ts',codex)
edit('game/tests/fauna-finish.test.cjs',lambda s:s.replace("v.key.startsWith('fauna-')?2:3","4").replace("(v.key.startsWith('fauna-')?['.fbx','_albedo.png']:['.fbx','_albedo.png','_normal.png','_surface.png'])","['.fbx','_albedo.png','_normal.png','_surface.png']"))
c=json.loads((ROOT/'game/build-config.boss-refine.json').read_text('utf8'));c['outputName']='coastal-a-20260916';c['name']='哥喂龟 · 海雾灵焰 A'
(ROOT/'game/build-config.coastal-a.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),encoding='utf8')
print('Style A runtime and codex integrated')
