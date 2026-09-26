# ARCHIVED: one-time scaffold, superseded by the edited ApprovedCastReviewScreen.ts.
raise SystemExit("Historical scaffold; do not overwrite the current review implementation.")
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'game/assets/scripts/view/SkeletalReviewScreen.ts'
s=source.read_text(encoding='utf-8')
s=s.replace('SkeletalReviewScreen','ApprovedCastReviewScreen')
s=s.replace('screen,SkeletalAnimation','screen,Sprite,SpriteFrame,SkeletalAnimation')
s=s.replace("type Kind='stone'|'crystal'|'crab';", "type Kind='stone'|'spike'|'crystal'|'leaf'|'bubble'|'crab';\nconst CAST_NAMES:Record<Kind,string>={stone:'岩盾',spike:'叶灵',crystal:'珊歌',leaf:'阳光',bubble:'潮行',crab:'礁甲蟹'};\nconst CAST_ROLES:Kind[]=['stone','spike','crystal','leaf','bubble'];")
s=s.replace("import type {Point} from '../core/types';", "import type {Point,Role,SkillId} from '../core/types';\nimport {makeInitialSave} from '../core/game';\nimport {enablePrototype} from '../core/prototype';\nimport {enableLiving} from '../core/living';\nimport {createBattle} from '../core/battle';\nfunction createCastTrial():BattleState{\n const save=makeInitialSave(1789444800000,731);enablePrototype(save);enableLiving(save);\n const active:Record<string,SkillId>={stone:'hold',spike:'pierce',crystal:'crystalCannon',leaf:'leafHeal',bubble:'bubblePrison'};\n const pets=(['stone','spike','crystal','leaf','bubble'] as Role[]).map(role=>{const p=Object.values(save.collection).find(p=>p.role===role)!;return {...p,skills:[active[role],'strong','swift'] as SkillId[]};});\n const b=createBattle(0,1,pets.map((turtle,slot)=>({id:turtle.id,turtle,slot,level:1})),{rulesVersion:'0.6',seed:918});const route=createVisualTrial();b.route=route.route;b.routeLength=route.routeLength;b.routes=undefined;b.routeLengths=undefined;b.spawns=route.spawns;\n b.units.forEach((u,i)=>{u.x=-3.7+i*1.9;u.z=1.0;u.placement={x:u.x,z:u.z};u.hp=u.maxHp*=4;u.attack*=1.4;});b.autoSkills=false;return b;\n}")
s=s.replace('createVisualTrial();private destroyed','createCastTrial();private destroyed').replace('this.b=createVisualTrial();','this.b=createCastTrial();')
s=s.replace("private close=false;","private close=true;private referenceOpen=false;private referenceFrames=new Map<string,SpriteFrame>();private ornamentNodes=new Map<string,Node[]>();private studio?:Node;")
s=s.replace("(['stone','crystal','crab'] as Kind[])","([...CAST_ROLES,'crab'] as Kind[])")
s=s.replace('`models-sculpted/${kind}/${kind}/${kind}`',"`${kind==='crab'?'models-sculpted':'models-approved'}/${kind}/${kind}/${kind}`")
s=s.replace("this.environment();this.reset('pose');", "this.environment();this.studio=this.shape('造型对照摄影地面',this.root,'box','#EEE6D5',[0,-.02,0],[80,.12,80]);this.reset('pose');")
s=s.replace('USE_VERTEX_COLOR:true','USE_VERTEX_COLOR:false')
s=s.replace("source.name.includes('aqua')", "/aqua|violet|fire/.test(source.name)")
s=s.replace("source.name.includes('aquaEdge')?'#B8E9FA':'#209FC8'", "source.name.includes('violet')?'#9972DC':source.name.includes('fire')?'#FFC27B':'#209FC8'")
s=s.replace("const find=(n:Node):Node|undefined=>n.name==='spell_tip'?n:n.children.map(find).find(Boolean);", "const find=(n:Node):Node|undefined=>n.name==='weapon_tip'?n:n.children.map(find).find(Boolean);")
old="if(kind==='crystal'){const find="
s=s.replace(old,"if(kind!=='crab'&&kind!=='stone'){const find=")
s=s.replace("const wave=this.energy!.arc(joint,'#43B6DE','weapon');wave.setWorldScale(1,1,1);wave.setPosition(0,0,0);this.weaponWaves.push(wave);", "const colors:Record<string,string>={spike:'#9BC99A',crystal:'#69CFEF',leaf:'#FFD296',bubble:'#B49AE8'};const waves:Node[]=[];for(let i=0;i<3;i++){const wave=this.energy!.arc(joint,colors[kind]??'#79CAE3','weapon');wave.setPosition(0,0,0);waves.push(wave);this.weaponWaves.push(wave);}this.ornamentNodes.set(id,waves);")
s=s.replace("this.mode=mode;this.b=createCastTrial();", "this.mode=mode;this.env.active=mode==='combat';if(this.studio)this.studio.active=mode==='pose';this.b=createCastTrial();")
s=s.replace("if(mode==='pose')this.createActor('pose-crab','crab',{x:3,z:-.25});",'')
start=s.index(' resize():void{');end=s.index(' private render():void{',start)
s=s[:start]+''' resize():void{const size=screen.windowSize,aspect=size.width/Math.max(1,size.height);this.camera.projection=Camera.ProjectionType.ORTHO;
  if(this.mode==='pose'){const focus=this.close?(this.actors.get(this.selected)?.root.position??new Vec3()):new Vec3(0,0,1);const a=this.angle*Math.PI/180;this.camera.orthoHeight=this.close?Math.max(1.75,2.8/aspect):Math.max(3.6,6.3/aspect);this.camera.node.setPosition(focus.x+Math.sin(a)*10,2.6,focus.z+Math.cos(a)*10);this.camera.node.lookAt(new Vec3(focus.x,1.11,focus.z));this.camera.clearColor=new Color('#E8E2D8');}
  else{this.camera.orthoHeight=Math.max(5.4,9.5/aspect);this.camera.node.setPosition(0,15,17);this.camera.node.lookAt(new Vec3(0,.25,0));this.camera.clearColor=new Color('#4FABB7');}
 }
 private showReference():void{const a=this.actors.get(this.selected);if(!a||a.kind==='crab')return;this.referenceOpen=true;this.running=false;for(const ac of this.actors.values())ac.anim.forEach(v=>v.pause());this.ui.clear();this.ui.panel(0,0,1240,680,this.ui.root,'#F9F5EC',255,20);this.ui.label('已确认三视图 · '+CAST_NAMES[a.kind],0,308,25);this.ui.button('回到实际模型',505,308,190,42,()=>{this.referenceOpen=false;this.running=true;this.actors.forEach(v=>v.anim.forEach(n=>n.resume()));this.render();},{surface:'paper',size:20});
  const holder=this.ui.group('已确认原画参考',0,-15,this.ui.root,1040,590);const show=(sf:SpriteFrame)=>{if(!holder.isValid)return;const sp=holder.addComponent(Sprite);sp.spriteFrame=sf;sp.sizeMode=Sprite.SizeMode.CUSTOM;};const sf=this.referenceFrames.get(a.kind);if(sf)show(sf);else resources.load('models-approved/references/'+a.kind+'/spriteFrame',SpriteFrame,(err,res)=>{if(err||!res){if(holder.isValid)this.ui.label('原画暂未载入',0,0);return;}res.addRef();this.referenceFrames.set(a.kind,res);show(res);});
 }
''' +s[end:]
start=s.index(' private render():void{');end=s.index(' private hit(a:Actor)',start)
s=s[:start]+''' private render():void{
  this.ui.clear();this.hitNodes.clear();this.buttons=[];const root=this.ui.root;const ground=this.ui.group('三维角色交互',0,0,root,3000,1500);this.input=ground;
  ground.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{if(this.dragId){this.drop(this.dragId,this.ground(e));this.dragId='';}});
  this.ui.panel(-100,324,1000,48,root,'#FFF9EE',245,14);this.status=this.ui.label('五龟三维制作 · 已确认三视图 v2',-110,324,23,'#173F51',root,970,43);
  this.ui.button('返回游戏',520,324,160,48,()=>{if(typeof location!=='undefined')location.href='http://127.0.0.1:7473/';},{size:22,surface:'paper'});
  CAST_ROLES.forEach((kind,i)=>this.ui.button(CAST_NAMES[kind],-400+i*200,267,180,42,()=>{const a=Array.from(this.actors.values()).find(a=>a.kind===kind);if(a){this.selected=a.id;this.close=true;this.resize();this.render();}},{size:22,surface:'paper',selected:this.actors.get(this.selected)?.kind===kind}));
  this.ui.panel(0,-316,1220,68,root,'#FFF9EE',245,16);
  const items:[string,()=>void][]=[['原画对照',()=>this.showReference()],[this.close?'五龟全景':'单只近看',()=>{this.close=!this.close;this.resize();this.render();}],['转身 90°',()=>this.turn(90)],['转身 180°',()=>this.turn(180)],[this.combo?'停止连招':'连续普攻',()=>{this.combo=!this.combo;this.comboClock=0;this.render();}],['主动技能',()=>{const a=this.actors.get(this.selected);if(a)this.cast(a.id,{x:a.root.position.x,z:a.root.position.z+.9});}],['专精演示',()=>this.mastery()]];
  items.forEach(([label,fn],i)=>this.ui.button(label,-519+i*173,-316,161,44,fn,{size:21,surface:'paper'}));
  this.ui.button('镜头 ↶',-540,204,125,40,()=>{this.angle-=30;this.resize();},{size:20,surface:'paper'});this.ui.button('镜头 ↷',-403,204,125,40,()=>{this.angle+=30;this.resize();},{size:20,surface:'paper'});
  this.ui.button(this.slow?'恢复原速':'¼ 速慢放',398,204,135,40,()=>{this.slow=!this.slow;for(const a of this.actors.values())for(const anim of a.anim){const clip=anim.clips.find(c=>c?.name.endsWith('|'+a.action));if(clip){const state=anim.getState(clip.name);if(state)state.speed*=this.slow?.25:4;}}this.render();},{size:20,surface:'paper'});
  this.ui.button(this.running?'暂停':'继续',540,204,125,40,()=>{this.running=!this.running;this.actors.forEach(a=>a.anim.forEach(v=>this.running?v.resume():v.pause()));this.render();},{size:20,surface:'paper'});
  this.hint=this.ui.label('实际骨骼模型 · 造型 / 转身 / 普攻 / 施法分开核对',0,-259,20,'#426270',root,1100,32);
  this.ui.button(this.mode==='pose'?'进入战场':'回摄影棚',-525,-248,165,35,()=>{this.close=false;this.reset(this.mode==='pose'?'combat':'pose');this.resize();this.render();},{size:18,surface:'paper'});
  for(const a of this.actors.values())if(a.kind!=='crab')this.hit(a);this.resize();
 }
 private mastery():void{const a=this.actors.get(this.selected);if(!a)return;this.cast(a.id,{x:a.root.position.x,z:a.root.position.z+.8});const p=a.root.position;if(a.kind==='stone'){for(const s of [-1,1])this.fx('rock',new Vec3(p.x+s*1.35,.13,p.z),2.4,a.id);}else if(a.kind==='crystal'){this.fx('snow',new Vec3(p.x,.13,p.z+.8),6,a.id);}else if(a.kind==='spike'){this.fx('arrows',new Vec3(p.x,.13,p.z+.8),3,a.id);}else if(a.kind==='leaf'){this.fx('heal',new Vec3(p.x,.13,p.z),4,a.id);}else this.fx('summon',new Vec3(p.x,.13,p.z+.8),5,a.id);}
''' +s[end:]
s=s.replace("(a.kind==='stone'?'岩盾':a.kind==='crystal'?'珊歌':'礁甲蟹')","CAST_NAMES[a.kind]")
s=s.replace("kind:'burst'|'bolt'|'rock'|'snow'|'ripple'|'slash'", "kind:'burst'|'bolt'|'rock'|'snow'|'ripple'|'slash'|'arrows'|'heal'|'summon'")
s=s.replace("if(this.mode==='pose'){this.play(a,'skill',2);this.fx(a.kind==='stone'?'rock':'snow',new Vec3(p.x,.15,p.z),a.kind==='stone'?4:5,id);return;}", "if(this.mode==='pose'){this.play(a,'skill',3);const kind=a.kind==='stone'?'rock':a.kind==='crystal'?'snow':a.kind==='spike'?'arrows':a.kind==='leaf'?'heal':'summon';this.effects.push({nodes:[],kind,age:-.75,life:4,point:new Vec3(a.kind==='stone'?a.root.position.x:p.x,.13,a.kind==='stone'?a.root.position.z:p.z),owner:a.id});return;}")
s=s.replace("if(a.kind==='crystal'){this.fx('bolt'", "if(a.kind!=='stone'&&a.kind!=='crab'){this.fx('bolt'")
s=s.replace("if(!f.nodes.length){this.fx('burst',f.point,.35,f.owner);f.age=f.life;}", "if(!f.nodes.length){this.fx(f.kind==='burst'?'burst':f.kind,f.point,f.kind==='burst'?.35:4,f.owner);f.age=f.life;}")
s=s.replace("const count=kind==='rock'?14:","const count=kind==='arrows'?15:kind==='heal'?18:kind==='summon'?2:kind==='rock'?14:")
s=s.replace("kind==='rock'?'rock':kind==='snow'", "kind==='summon'?'rock':kind==='arrows'?'cone':kind==='rock'?'rock':kind==='snow'")
s=s.replace("kind==='rock'?(i%4?'#64717C':'#399ABF')", "kind==='heal'?'#FFD992':kind==='arrows'?'#95C7A1':kind==='summon'?'#6C6681':kind==='rock'?(i%4?'#64717C':'#399ABF')")
s=s.replace("if(kind==='rock'||kind==='snow'||kind==='slash')", "if(kind==='rock'||kind==='snow'||kind==='slash'||kind==='heal'||kind==='summon')")
s=s.replace("kind==='rock'?'#329EC6':kind==='slash'?'#C9DDE4':'#74C5EB'", "kind==='heal'?'#FFDCA1':kind==='summon'?'#C4AAF2':kind==='rock'?'#329EC6':kind==='slash'?'#C9DDE4':'#74C5EB'")
s=s.replace("n.setPosition(f.point.x,f.point.y+(slash?", "n.setPosition(f.point.x,f.point.y+(slash?")
s=s.replace("if(f.kind==='snow'){", "if(f.kind==='arrows'){const r=Math.sqrt((i+.5)/15)*1.6,a=i*2.399,fall=(f.age*2+i*.11)%1;n.setPosition(f.point.x+Math.cos(a)*r,.15+(1-fall)*3.1,f.point.z+Math.sin(a)*r);n.setScale(.025,.65,.025);n.setRotationFromEuler(0,0,8);}\n   if(f.kind==='heal'){const r=.35+(i%5)*.19,a=f.age*.75+i*2.399;n.setPosition(f.point.x+Math.cos(a)*r,.15+((f.age*.8+i*.17)%2.4),f.point.z+Math.sin(a)*r);const q=.065*fade;n.setScale(q,q*1.5,q);}\n   if(f.kind==='summon'){const down=Math.max(0,1-f.age/.35),h=.72+down*down*4;n.setPosition(f.point.x+(i?1:-1)*.8,h,f.point.z);n.setScale(.66*fade,1.4*fade,.60*fade);n.setRotationFromEuler(0,i*80,0);}\n   if(f.kind==='snow'){")
s=s.replace("for(const a of this.actors.values()){\n   a.remaining", "for(const a of this.actors.values()){\n   if(this.mode==='pose')a.root.active=!this.close||a.id===this.selected;\n   a.remaining")
s=s.replace("this.weaponWaves.forEach((n,i)=>{n.setRotationFromEuler(75,this.time*65,15);const pulse=.5+.5*Math.sin(this.time*2.4),s=.8+pulse*.45;n.setWorldScale(s,s,s);this.energy!.animate(n,this.time,.35+pulse*.4);});", "this.ornamentNodes.forEach((nodes,id)=>{const a=this.actors.get(id);if(!a)return;nodes.forEach((n,i)=>{const pulse=.5+.5*Math.sin(this.time*(a.kind==='leaf'?1.6:2.2)-i*1.3);n.setRotationFromEuler(a.kind==='crystal'?90:35,this.time*(a.kind==='crystal'?75:25)+i*120,15);const s=a.kind==='leaf'?.9+pulse*.65:a.kind==='bubble'?.5+Math.pow(pulse,4)*1.3:.7+pulse*.65;n.setWorldScale(s,s,s);this.energy!.animate(n,this.time,.15+pulse*(a.kind==='bubble'?.7:.4));});});")
s=s.replace("this.mode==='pose'?'三维动作样板 · 岩盾 / 珊歌 / 礁甲蟹'", "this.mode==='pose'?'三维制作候选 · '+CAST_NAMES[this.actors.get(this.selected)?.kind??'stone']+' · 三视图 v2'")
s=s.replace("this.energyAsset?.decRef();}","this.energyAsset?.decRef();this.referenceFrames.forEach(f=>f.decRef());}")
out=root/'game/assets/scripts/view/ApprovedCastReviewScreen.ts';out.write_text(s,encoding='utf-8')
entry=root/'game/assets/scripts/view/GameEntry.ts';e=entry.read_text(encoding='utf-8');e=e.replace("import {SkeletalReviewScreen} from './SkeletalReviewScreen';","import {SkeletalReviewScreen} from './SkeletalReviewScreen';\nimport {ApprovedCastReviewScreen} from './ApprovedCastReviewScreen';")
e=e.replace('private skeletalReview?:SkeletalReviewScreen;','private skeletalReview?:SkeletalReviewScreen|ApprovedCastReviewScreen;')
e=e.replace('this.skeletalReview=new SkeletalReviewScreen(this.node,this.ui,this.mainCamera,this.pipelineMaterial);',"this.skeletalReview=new (new URLSearchParams(location.search).get('cast')==='v2'?ApprovedCastReviewScreen:SkeletalReviewScreen)(this.node,this.ui,this.mainCamera,this.pipelineMaterial);")
entry.write_text(e,encoding='utf-8')
config=root/'game/build-config.approved-cast.json';config.write_text((root/'game/build-config.sculpted-review.json').read_text(encoding='utf-8').replace('sculpted-review','approved-cast').replace('哥喂龟 三维动作验收','哥喂龟 五龟造型与动作'),encoding='utf-8')
print('Created approved-cast review without replacing old model or game entry behavior.')

