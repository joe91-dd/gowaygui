from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'game/assets/scripts/view/CommunityMenus.ts';s=p.read_text(encoding='utf-8');needle='board.footer(c.hideRankings?';a=s.index(needle);b=s.index(';',a);s=s[:a]+s[a:b].replace('()=>menu.toggle(back))','()=>menu.toggle(back),true)')+s[b:];p.write_text(s,encoding='utf-8')
p=r/'game/server/world-boss-service.cjs';s=p.read_text(encoding='utf-8')
s=s.replace("const {worldBossDay", "const {validateTurtle}=require(core+'/save.js');\n const {worldBossDay",1)
s=s.replace('id,name:p.name,damage:p.best,rank:i+1','id,name:p.name,damage:p.best,rank:i+1,own:id===client.id,showcase:copy(p.showcase??p.roster?.slice(0,1)??[]),rotate:!!p.rotate,roster:copy(p.roster??[])')
s=s.replace("if(action==='start'){", "if(action==='showcase'){check(Array.isArray(body.pets)&&body.pets.length>=1&&body.pets.length<=5,'请选择1至5只展示伙伴');check(new Set(body.pets.map(t=>t.id)).size===body.pets.length,'展示伙伴不能重复');body.pets.forEach(validateTurtle);p.showcase=copy(body.pets);p.rotate=!!body.rotate;dirty=true;}\n  else if(action==='start'){")
s=s.replace('data.fights[f.id]=f;p.attempts++;','data.fights[f.id]=f;p.roster=copy(client.roster);p.attempts++;')
p.write_text(s,encoding='utf-8')
p=r/'game/server/lobby-server.cjs';s=p.read_text(encoding='utf-8');s=s.replace("if(action==='start'&&req.headers['x-game-account'])", "if((action==='start'||action==='showcase')&&req.headers['x-game-account'])")
needle="worldIdentity.roster=client.roster.map(t=>"
where=s.index(needle);end=s.index('return worldBoss.handle(action,worldIdentity,body);',where)
s=s[:where]+s[where:end].replace("worldIdentity.roster=client.roster.map(t=>", "if(action==='showcase'){check(Array.isArray(body.pets)&&body.pets.length>=1&&body.pets.length<=5,'请选择1至5只展示伙伴');body.pets=body.pets.map(t=>{const owned=slot.save.collection?.[t.id];check(owned,'展示伙伴不属于当前账号');check(!slot.save.community?.hiddenPets?.includes(t.id),'该伙伴已设为隐藏');return clone(owned);});}else worldIdentity.roster=client.roster.map(t=>")+s[end:]
p.write_text(s,encoding='utf-8')
p=r/'game/assets/scripts/view/WorldBossMenus.ts';s=p.read_text(encoding='utf-8');s="import {HonorBoard,HonorEntry} from './HonorBoard';\nimport {ShowcaseMenu} from './ShowcaseMenu';\nimport {showcasePets} from '../core/honor';\n"+s
a=s.index(' private rankings():void{');b=s.index(' private chest(',a)
s=s[:a]+''' private rankings():void{
  this.epoch++;this.ui.clear();const data=this.client.world!,s=this.service.snapshot,board=new HonorBoard(this.ui,'世界首领 · 讨伐荣耀','每日22:00结算 · 取每日单次最高伤害',()=>this.open(false)),back=()=>this.rankings();
  const rows:HonorEntry[]=data.ranking.map(r=>({id:r.id,rank:r.rank,name:r.name,metric:number(r.damage),pets:r.own?showcasePets(s):r.showcase??r.roster?.slice(0,1)??[],rotate:r.own?(s.community?.showcase?.rotate??true):!!r.rotate,inspect:pet=>{
   if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet);
   else {const p=this.ui.dialog(r.name+' · 讨伐记录','第 '+r.rank+' 名 · 最高伤害 '+number(r.damage),()=>p.parent?.destroy(),780,430);this.ui.text('该玩家尚未设置展示伙伴',0,0,25,UI_COLORS.sand,p,690,90);}
  }}));
  board.winners(rows.slice(0,3));board.list(rows.slice(3),'今日伤害榜');
  const menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error),saved=()=>{back();void this.act(()=>this.client.worldShowcase(),back);};
  board.footer(data.rank?String(data.rank):'未上榜',number(data.best)+' 伤害',showcasePets(s)[0],()=>menu.open(saved),s.community?.showcase?.rotate??true,()=>menu.toggle(saved));
  board.button('排名奖励',505,-296,142,42,()=>this.rankRewards());
  this.ui.text('奖励结算后发至邮箱 · 共 '+data.participants+' 位岛主参与',-169,-248,16,UI_COLORS.sand,board.root,840,25);
 }

'''+s[b:];p.write_text(s,encoding='utf-8');print('World honor and synchronization wired')
