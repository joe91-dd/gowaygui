import {CodexAura} from './CodexAura';
import {FAUNA_AURAS,faunaAuraGrade} from '../core/faunaAura';
import {WORLD_BOSSES} from '../core/worldBoss';
import {encounterModels} from '../core/faunaCatalog';
import {ENEMY_G1,enemyG1} from '../core/enemyG1Catalog';
import {ENEMIES,LEVELS} from '../core/data';
import {skillSources,bossLootText,encounterPages} from '../core/codexSources';
import {Node,Graphics,Color} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GoldFlow} from './GoldFlow';
import {GameService} from '../core/game';
import {SKILLS} from '../core/data';
import {BOSSES,TIER_NAMES} from '../core/bossCatalog';
import {ARENA_TIERS,arenaTier} from '../core/progression';
const FAUNA_THREATS:Record<string,string>={runner:'疾行型',armored:'重甲型',mist:'咒术型',snail:'远程型',elite:'精英型',ink:'集群型',boss:'首领型'};
export class AchievementMenus {
 constructor(private ui:IslandUI,private service:GameService,private command:(kind:string)=>string,private home:()=>void,private error:(e:unknown)=>void){}
 private specimen(parent:Node,key:string,x:number,y:number,w:number,h:number,accent='#76B5B5'):Node{
  const model=enemyG1(key),boss=key.startsWith('boss-')?BOSSES[Number(key.slice(5))]:undefined;
  const grade=faunaAuraGrade(model?.kind??'boss',0,boss?.tier,key.startsWith('world-boss-'));
  const aura=FAUNA_AURAS[grade];
  const stage=this.ui.panel(x,y,w,h,parent,'#F6F5E9',255,16),g=this.ui.group('海湾陈列台',0,0,stage).addComponent(Graphics);
  g.fillColor=new Color('#E0F0EC');g.ellipse(0,-h*.08,w*.43,h*.32);g.fill();
  g.fillColor=new Color('#CEE6E4');g.ellipse(0,-h*.28,w*.39,h*.11);g.fill();
  g.fillColor=new Color('#EDE5CE');g.ellipse(0,-h*.35,w*.33,h*.073);g.fill();
  g.fillColor=new Color(26,55,62,50);g.ellipse(0,-h*.35,w*.21,h*.028);g.fill();
  // A compact showcase frame makes the icon read as a finished collectible,
  // rather than a raw model thumbnail.  The same grade colour is reused by
  // the battle radiance pass, so the codex and combat presentation match.
  const badge= this.ui.group('识别徽记',-w*.34,h*.39,stage).addComponent(Graphics);
  badge.fillColor=new Color(aura.color);badge.roundRect(-28,-13,56,26,8);badge.fill();
  badge.strokeColor=new Color('#FFFFFF');badge.lineWidth=1;badge.roundRect(-28,-13,56,26,8);badge.stroke();
  const addAura=(front:boolean)=>{const n=this.ui.group(front?'灵焰前景':'灵焰后景',0,0,stage),a=n.addComponent(CodexAura);a.width=w;a.height=h;a.grade=grade;a.front=front;};
  addAura(false);
  const figure=this.ui.group('图鉴实装造型:'+key,0,2,stage,w,h);const size=Math.min(w,h)*.99;this.ui.art?.attach(figure,key as any,size,size);
  addAura(true);
  const id=model?.id??(boss?`BOSS-${boss.id}`:key.replace(/^enemy-g1-/,'').toUpperCase());
  this.ui.text(id,-w*.34,h*.39,14,'#FFFFFF',stage,90,24,true);
  this.ui.text(model?.flying?'空域':'陆地',w*.34,h*.39,14,aura.color,stage,90,24,true);
  const edge=this.ui.group('品阶边缘',0,0,stage),stroke=edge.addComponent(Graphics);stroke.strokeColor=new Color('#D7E4DA');stroke.lineWidth=1;stroke.roundRect(-w/2,-h/2,w,h,16);stroke.stroke();
  stroke.strokeColor=new Color(aura.color);stroke.lineWidth=3;stroke.moveTo(-w*.16,-h/2+2);stroke.lineTo(w*.16,-h/2+2);stroke.stroke();
  return stage;
 }
 private action(fn:()=>void):void{try{fn();}catch(e){this.error(e);}}
 open(tab:'skills'|'bosses'|'monsters'='skills',category=0,page=0):void{
  this.action(()=>this.service.refreshClock(this.command('codexClock')));this.ui.clear();const p=this.ui.sheet('海岛图鉴','发现伙伴的力量，记录每一次远征',this.home),s=this.service.snapshot,progress=s.progression!;
  (['技能图鉴','BOSS图鉴','怪物图鉴']).forEach((name,i)=>this.ui.button(name,-360+i*360,180,342,46,()=>this.open((['skills','bosses','monsters'] as const)[i]),{parent:p,primary:(tab==='skills'?0:tab==='bosses'?1:2)===i,size:24}));
  if(tab==='skills'){
   ['主动技能','职业专精','珍贵技能','通用技能'].forEach((name,i)=>this.ui.button(name,-390+i*260,118,235,40,()=>this.open(tab,i),{parent:p,primary:category===i,size:21}));
   const list=SKILLS.filter(s=>category===0?s.active:category===1?s.specialization:category===2?s.precious:!s.active&&!s.specialization&&!s.precious),pages=Math.ceil(list.length/10);page=Math.max(0,Math.min(page,pages-1));
   list.slice(page*10,page*10+10).forEach((skill,i)=>{const unlocked=progress.skills.includes(skill.id),n=this.ui.button('',-444+i%5*222,list.length<=5?-69:16-Math.floor(i/5)*162,205,list.length<=5?288:151,()=>{const d=this.ui.dialog(skill.name,skill.specialization?'职业专精':skill.active?'职业主动':skill.precious?'珍贵通用':'通用技能',()=>d.parent?.destroy(),960,546);this.ui.bookIcon(skill.id,-338,66,142,d);this.ui.text(skill.description,102,85,23,UI_COLORS.ink,d,590,124,true);this.ui.text('产出方式',-252,-23,23,'#008E94',d,320,34);this.ui.text(skillSources(skill.id),58,-96,21,UI_COLORS.sand,d,774,112,true);const claimed=progress.codexClaims.includes('skill:'+skill.id);this.ui.button(claimed?'已领取':unlocked?'领取解锁金币':'获得该技能后解锁',0,-218,320,46,()=>this.action(()=>{const n=this.service.claimCodex(this.command('codex'),'skill',skill.id);this.ui.feedback?.('reward');this.open(tab,category,page);this.ui.toast('解锁奖励 +'+n.toLocaleString()+' 金币');}),{parent:d,disabled:!unlocked||claimed,primary:unlocked&&!claimed,size:23});},{parent:p});this.ui.bookIcon(skill.id,0,list.length<=5?36:23,list.length<=5?116:82,n);this.ui.text(skill.name,0,list.length<=5?-55:-37,23,UI_COLORS.ink,n,195,32);if(list.length<=5)this.ui.text(skill.specialization?'职业专精':skill.active?'职业主动':skill.precious?'珍贵被动':'通用被动',0,-83,18,UI_COLORS.sand,n,180,26);this.ui.text(unlocked?'已发现':'未发现',0,list.length<=5?-116:-64,19,unlocked?'#009987':UI_COLORS.muted,n,190,27);});
   this.ui.button('上一页',-250,-279,205,52,()=>this.open(tab,category,page-1),{parent:p,disabled:page===0,size:23});this.ui.text(`${page+1} / ${pages}`,0,-279,23,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,52,()=>this.open(tab,category,page+1),{parent:p,disabled:page===pages-1,size:23});
  }else if(tab==='bosses'){

   [...TIER_NAMES,'世界'].forEach((name,i)=>this.ui.button(name+' '+(i===6?WORLD_BOSSES.length:BOSSES.filter(b=>b.tier===i).length),-474+i*158,117,149,38,()=>this.open(tab,i),{parent:p,primary:category===i,size:21}));
   if(category===6){this.worldBossCards(p,page);return;}
   const list=BOSSES.filter(b=>b.tier===category),pages=Math.ceil(list.length/3);page=Math.max(0,Math.min(page,pages-1));
   list.slice(page*3,page*3+3).forEach((boss,i)=>{
    const index=BOSSES.indexOf(boss),unlocked=progress.bosses.includes(boss.id),show=(encounterPage=0)=>{
     const locations=encounterPages(boss),d=this.ui.dialog(boss.name,TIER_NAMES[boss.tier]+'首领 · '+boss.skill,()=>d.parent?.destroy(),1060,578),figure=this.specimen(d,'boss-'+index,-348,25,260,295,boss.color);
     
     this.ui.text(boss.detail,150,126,22,UI_COLORS.ink,d,618,94,true);
     if(this.ui.share)this.ui.button('分享图鉴',337,-232,220,46,()=>this.ui.share?.('海岛首领 · '+boss.name,boss.detail),{parent:d,size:21});
     this.ui.text('出没地点',-52,51,22,'#008E94',d,212,32);this.ui.text(locations[encounterPage],160,-6,20,UI_COLORS.sand,d,626,98,true);
     if(locations.length>1)this.ui.button((encounterPage+1)+'/'+locations.length+' ›',-357,-153,130,37,()=>{d.parent?.destroy();show((encounterPage+1)%locations.length);},{parent:d,size:19});
     this.ui.text('重要掉落',-52,-77,22,'#008E94',d,212,32);this.ui.text(bossLootText(boss),160,-126,21,UI_COLORS.ink,d,626,73,true);
     const claimed=progress.codexClaims.includes('boss:'+boss.id);this.ui.button(claimed?'奖励已领取':unlocked?'领取首胜金币':'击败后解锁金币',0,-232,330,46,()=>this.action(()=>{this.service.claimCodex(this.command('bossCodex'),'boss',boss.id);this.ui.feedback?.('reward');this.open(tab,category,page);}),{parent:d,primary:unlocked&&!claimed,disabled:!unlocked||claimed,size:23});
    };
    const n=this.ui.button('',-386+i*386,-58,363,316,()=>show(),{parent:p});
    const icon=this.specimen(n,'boss-'+index,0,42,337,210,boss.color);
    this.ui.text(boss.name,0,-79,25,UI_COLORS.ink,n,208,35);this.ui.text(boss.skill,0,-116,20,UI_COLORS.sand,n,208,30);this.ui.text(TIER_NAMES[boss.tier]+' · '+(unlocked?'已击败':'未击败'),0,-143,16,boss.color,n,208,28);

   });
   this.ui.button('上一页',-250,-279,205,46,()=>this.open(tab,category,page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / '+pages,0,-279,22,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,46,()=>this.open(tab,category,page+1),{parent:p,disabled:page+1===pages,size:22});

  }
  else if(tab==='monsters'){
   const monsters=ENEMY_G1.filter(m=>m.kind!=='boss'),pages=Math.ceil(monsters.length/3);page=Math.max(0,Math.min(page,pages-1));
   this.ui.text('海岛生灵 · 5 种小怪与 1 种精英，精英随难度发生五档变异',0,118,21,UI_COLORS.sand,p,1000,36);
   monsters.slice(page*3,page*3+3).forEach((m,i)=>{
    const open=()=>{const d=this.ui.dialog(m.name,FAUNA_THREATS[m.kind]+' · '+(m.flying?'飞行 / 悬浮':'地面行动'),()=>d.parent?.destroy(),960,535);
     this.specimen(d,m.key,-302,27,251,284);
     const counters={runner:'移动较快。把控制和射手留在后段，避免只堆前段火力。',armored:'坚实护甲。法术伤害与破甲更有效，持续输出胜过零散攻击。',mist:'法术抗性较强。使用物理射手，分散站位躲开远程攻击。',snail:'远程敌人。会攻击防线，利用治疗、护盾与调位保护核心输出。',elite:'强力精英。留出控制和职业主动，预警出现后及时调整站位。',ink:'成群来袭。弹射、散射与范围技能可以同时处理多个目标。',boss:'首领敌人。观察施法预警并保留救场技能。'};
     this.ui.text(counters[m.kind],126,90,23,UI_COLORS.ink,d,545,138,true);
     const levels=LEVELS.filter(l=>encounterModels(l.id,m.kind).some(v=>v.key===m.key)).map(l=>l.id+1);
     this.ui.text('关卡 '+levels.slice(0,12).join('、')+(levels.length>12?' 等':''),122,-54,21,UI_COLORS.sand,d,538,100,true);
     this.ui.text('随波次提供金币与战斗经验；首领波另有解救与材料奖励。',0,-178,21,UI_COLORS.ink,d,830,60,true);
    };
    const n=this.ui.button('',-386+i*386,-58,363,316,open,{parent:p});
    this.specimen(n,m.key,0,42,337,210);
    this.ui.text(m.name,0,-79,25,UI_COLORS.ink,n,190,39);this.ui.text(FAUNA_THREATS[m.kind],0,-116,20,'#008E94',n,187,31);this.ui.text(m.flying?'空域威胁':'陆地生物',0,-143,16,UI_COLORS.sand,n,185,28);
   });
   this.ui.button('上一页',-250,-279,205,46,()=>this.open(tab,0,page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / '+pages,0,-279,22,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,46,()=>this.open(tab,0,page+1),{parent:p,disabled:page+1===pages,size:22});
  }

 }
 private worldBossCards(p:Node,page=0):void{
  page=Math.max(0,Math.min(1,page));
  WORLD_BOSSES.slice(page*3,page*3+3).forEach((boss,i)=>{const n=this.ui.button('',-386+i*386,-58,363,316,()=>{
   const d=this.ui.dialog(boss.name,'世界首领 · 90 秒极限挑战',()=>d.parent?.destroy(),1030,556),art=this.specimen(d,boss.art,-336,14,270,290,boss.color);

   this.ui.text(boss.subtitle,122,123,27,UI_COLORS.ink,d,594,44);this.ui.text(boss.counter,123,49,22,UI_COLORS.sand,d,588,101,true);
   this.ui.text('出没：世界挑战 · 四位首领每日轮换',130,-38,23,'#008E94',d,584,42);this.ui.text('每日 3 次，取最高伤害。10 档伤害奖励，22:00 排名邮件。',129,-96,21,UI_COLORS.ink,d,580,75,true);
   this.ui.text('重要掉落：金币、培养材料、职业主动 / 专精 / 珍贵技能礼包。',0,-208,21,UI_COLORS.sand,d,943,58,true);
  },{parent:p});
  const art=this.specimen(n,boss.art,0,42,337,210,boss.color);
  this.ui.text(boss.name,0,-79,25,UI_COLORS.ink,n,188,41);this.ui.text('世界级 · 霸主',0,-116,20,boss.color,n,188,30);this.ui.text('每日轮换 · 点击查看',0,-143,16,UI_COLORS.sand,n,188,28);

  });this.ui.button('上一页',-250,-279,205,46,()=>this.open('bosses',6,page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / 2',0,-279,22,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,46,()=>this.open('bosses',6,page+1),{parent:p,disabled:page===1,size:22});
 }

}
