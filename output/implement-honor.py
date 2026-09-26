from pathlib import Path
import json,uuid
root=Path(__file__).resolve().parents[1]
v=root/'game/assets/scripts/view'
p=v/'ArtV2Assets.ts'
s=p.read_text(encoding='utf-8').replace("export type ArtV2Image=","export type ArtV2Image='honor-terrace'|")
s=s.replace("const IMAGES:ArtV2Image[]=[","const IMAGES:ArtV2Image[]=['honor-terrace',")
s=s.replace("const modern:Partial<Record<ArtV2Image,string>>={","const modern:Partial<Record<ArtV2Image,string>>={'honor-terrace':'honor-terrace',")
p.write_text(s,encoding='utf-8')
p=v/'CommunityMenus.ts';s=p.read_text(encoding='utf-8');s="import {HonorBoard,HonorEntry} from './HonorBoard';\nimport {ShowcaseMenu} from './ShowcaseMenu';\nimport {showcasePets} from '../core/honor';\n"+s
a=s.index("  private rankings(kind:");b=s.index('  private rankPet(',a)
s=s[:a]+'''  private rankings(kind:'pet'|'chapter'|'endless'|'arena'='pet',page=0):void{
    if(kind==='arena'){this.arena();return;}
    this.dispatch({kind:'refresh'});this.ui.clear();const s=this.service.snapshot,c=this.c,back=()=>this.rankings(kind);
    const board=new HonorBoard(this.ui,'海岛荣耀榜','',this.home);
    board.tabs(({pet:'宠物',chapter:'关卡',endless:'无尽'} as const)[kind],label=>this.rankings(({宠物:'pet',关卡:'chapter',无尽:'endless',竞技场:'arena'} as const)[label]??'pet'));
    const rows:HonorEntry[]=kind==='pet'?petRanking(s).map((r,i)=>({id:r.ownerId,rank:i+1,name:r.ownerName,metric:'评分 '+r.score.toFixed(1),pets:r.ownerId===LOCAL_PLAYER?showcasePets(s,r.turtle):[r.turtle],rotate:r.ownerId===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:pet=>new PetDetails(this.ui,this.service,this.command,this.error).show(pet??r.turtle)})):
      progressRanking(s,kind).map((r,i)=>{const pets=r.id===LOCAL_PLAYER?showcasePets(s):Object.values(c.aiPlayers[r.id]?.pets??{}).slice(0,1);return {id:r.id,rank:i+1,name:r.name,metric:kind==='chapter'?'第 '+(r.progress+1)+' 关':r.progress+' 波',detail:r.seconds.toFixed(1)+' 秒',pets,rotate:r.id===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:(pet?:Turtle)=>{if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet);else this.ui.toast('该岛主暂未公开展示伙伴');}};});
    board.winners(rows.slice(0,3));board.list(rows.slice(3),kind==='pet'?'伙伴评分榜':kind==='chapter'?'关卡远征榜':'无尽远征榜');
    const ours=rows.find(r=>r.id===LOCAL_PLAYER),menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error);
    board.footer(ours?String(ours.rank):'未上榜',ours?.metric??'完成挑战，争取登台',showcasePets(s)[0],()=>menu.open(back),c.showcase?.rotate??true,()=>menu.toggle(back));
    board.button(c.hideRankings?'公开上榜':'隐藏资料',505,-296,143,42,()=>{this.dispatch({kind:'rankVisibility',hidden:!c.hideRankings});back();});
    this.ui.text(kind==='pet'?'宠物按真实评分排序 · 展示伙伴不影响成绩 · 含本地 AI':kind==='chapter'?'同关卡按用时排序 · 含本地 AI':'同波次按用时排序 · 含本地 AI',-177,-248,15,UI_COLORS.sand,board.root,850,24);
  }
'''+s[b:]
a=s.index('  private arenaV2(');b=s.index('  private arenaDetails(',a)
s=s[:a]+'''  private arenaV2(tierPage?:number):void{
    if(tierPage!==undefined){this.arenaDetails(tierPage);return;}
    this.service.refreshClock(this.command('arenaClock'));this.ui.clear();const s=this.service.snapshot,c=this.c,a=s.progression!.arena,locked=arenaLocked(s.clockHighWater),back=()=>this.arenaV2();
    const board=new HonorBoard(this.ui,'竞技场 · 王者之巅','本地 AI 排位 · 每周日22:00结算',this.home);
    const rows:HonorEntry[]=c.arenaOrder.filter(id=>id!==LOCAL_PLAYER||!c.hideRankings).map((id,i)=>({id,rank:i+1,name:playerName(s,id),metric:id===LOCAL_PLAYER?arenaRankLabel(a.rating):'本地 AI · 第 '+(i+1)+' 名',pets:id===LOCAL_PLAYER?showcasePets(s):Object.values(c.aiPlayers[id]?.pets??{}).slice(i%5,i%5+1),rotate:id===LOCAL_PLAYER&&(c.showcase?.rotate??true),inspect:pet=>this.arenaRankDetail(id,pet)}));
    board.winners(rows.slice(0,3));board.list(rows.slice(3),'本周排名');
    const menu=new ShowcaseMenu(this.ui,this.service,this.command,this.error);
    board.footer(c.hideRankings?'未公开':String(c.arenaOrder.indexOf(LOCAL_PLAYER)+1),arenaRankLabel(a.rating),showcasePets(s)[0],()=>menu.open(back),c.showcase?.rotate??true,()=>menu.toggle(back));
    const own=c.arenaAttack.length===5?[...c.arenaAttack]:Object.keys(s.collection).slice(0,5);
    board.button('进攻阵容',-454,-335,205,36,()=>this.pick('进攻阵容',own,5,false,ids=>{this.dispatch({kind:'arenaAttack',ids});back();},back,0,true));
    board.button('防守阵容',-231,-335,205,36,()=>this.pick('防守阵容',c.arenaDefense.length===5?[...c.arenaDefense]:own,5,false,ids=>{this.dispatch({kind:'arenaDefense',ids});back();},back,0,true));
    board.button(c.arena&&!c.arena.settled?'继续对战':locked?'周一开启':'开始匹配',52,-335,322,36,()=>{if(c.arena&&!c.arena.settled)this.challenge('arena');else this.arenaMatching();},true,board.root,locked&&!(c.arena&&!c.arena.settled));
    board.button('段位 / 结算奖励',393,-335,310,36,()=>this.arenaDetails());
    const countdown=this.ui.text('',-177,-249,16,UI_COLORS.ink,board.root,880,26),tick=()=>{const remain=Math.max(0,arenaSettlementAt(Date.now())-Date.now()),h=Math.floor(remain/3600000);countdown.string=locked?'本周已结算 · 奖励投递邮箱':'本周结算倒计时 '+Math.floor(h/24)+'天 '+h%24+'时 '+Math.floor(remain/60000)%60+'分';};board.root.addComponent(MenuTicker).step=tick;tick();
  }
  private arenaRankDetail(id:string,pet?:Turtle):void{
    const s=this.service.snapshot,c=this.c,own=id===LOCAL_PLAYER,p=this.ui.dialog(playerName(s,id)+' · 荣誉阵容','点击伙伴查看天赋、加点与技能',()=>p.parent?.destroy(),1060,560);
    const pets=own?c.arenaDefense.map(id=>s.collection[id]).filter(Boolean):Object.values(c.aiPlayers[id]?.pets??{}).slice(0,5);
    pets.forEach((t,i)=>{const n=this.ui.button('',-410+i*205,20,187,223,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t),{parent:p});this.ui.portrait(t.role,0,20,155,n,true);this.ui.text(this.petName(t),0,-74,21,UI_COLORS.ink,n,176,32);});
    if(pet)this.ui.text('当前展示：'+this.petName(pet),0,185,23,UI_COLORS.gold,p,830,40);
    this.ui.button('查看展示伙伴',-226,-205,380,46,()=>{if(pet)new PetDetails(this.ui,this.service,this.command,this.error).show(pet);},{parent:p,disabled:!pet,size:23});
    this.ui.button(own?'我的防守':'查看对方战斗',226,-205,380,46,()=>{p.parent?.destroy();if(own)this.defensePreview();else this.arenaOpponent(id);},{parent:p,primary:true,size:23});
  }
'''+s[b:];p.write_text(s,encoding='utf-8')
# image metadata copies keep importer structure with fresh identities
asset=root/'game/assets/resources/art-modern'
for name in ['honor-terrace','sailing-honor']:
 target=asset/(name+'.png.meta')
 if not target.exists():
  m=json.loads((asset/'sailing-arrival.png.meta').read_text(encoding='utf-8-sig'));old=m['uuid'];new=str(uuid.uuid4());raw=json.dumps(m,ensure_ascii=False,indent=2).replace(old,new);target.write_text(raw,encoding='utf-8')
for name in ['HonorBoard','ShowcaseMenu']:
 target=v/(name+'.ts.meta')
 if not target.exists():target.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2),encoding='utf-8')
print('Honor screens wired')
