const fs=require('fs'),p='game/assets/scripts/view/AchievementMenus.ts';let s=fs.readFileSync(p,'utf8');
s=s.replace("import {BOSSES}","import {BOSSES,TIER_NAMES}");s="import {skillSources,bossLootText,encounterPages} from '../core/codexSources';\n"+s;
s=s.replace("this.ui.sheet('海岛成就','发现伙伴的力量，记录每一次远征',this.home)","this.ui.sheet(tab==='rewards'?'远征结算':'海岛成就','发现伙伴的力量，记录每一次远征',this.home)");
s=s.replace("['技能书图鉴','BOSS图鉴','奖励宝箱'].forEach", "(tab==='rewards'?[]:['技能书图鉴','BOSS图鉴']).forEach").replace('-360+i*360,180,310,48','-270+i*540,180,510,46');
s=s.replace('750,430','960,546').replace("this.ui.bookIcon(skill.id,-237,4,126,d);this.ui.text(skill.description,86,4,23,UI_COLORS.ink,d,452,174,true);", "this.ui.bookIcon(skill.id,-338,66,142,d);this.ui.text(skill.description,102,85,23,UI_COLORS.ink,d,590,124,true);this.ui.text('产出方式',-252,-23,23,'#008E94',d,320,34);this.ui.text(skillSources(skill.id),58,-96,21,UI_COLORS.sand,d,774,112,true);").replace('0,-158,320,52','0,-218,320,46');
const a=s.indexOf("   BOSSES.forEach("),b=s.indexOf('\n  }else{',a);if(a<0||b<0)throw Error('boss UI bounds');
s=s.slice(0,a)+`
   TIER_NAMES.forEach((name,i)=>this.ui.button(name+' '+BOSSES.filter(b=>b.tier===i).length,-460+i*184,117,170,38,()=>this.open(tab,i),{parent:p,primary:category===i,size:21}));
   const list=BOSSES.filter(b=>b.tier===category),pages=Math.ceil(list.length/6);page=Math.max(0,Math.min(page,pages-1));
   list.slice(page*6,page*6+6).forEach((boss,i)=>{
    const index=BOSSES.indexOf(boss),unlocked=progress.bosses.includes(boss.id),show=(encounterPage=0)=>{
     const locations=encounterPages(boss),d=this.ui.dialog(boss.name,TIER_NAMES[boss.tier]+'首领 · '+boss.skill,()=>d.parent?.destroy(),1060,578),figure=this.ui.group('首领完整造型',-359,22,d,218,280);
     const f=this.ui.art?.battleFrame('boss-'+index),ratio=f?f.rect.width/f.rect.height:.8;this.ui.art?.attach(figure,('boss-'+index) as any,Math.min(230,274*ratio),Math.min(274,230/ratio));
     this.ui.text(boss.detail,150,126,22,UI_COLORS.ink,d,618,94,true);
     this.ui.text('出没地点',-52,51,22,'#008E94',d,212,32);this.ui.text(locations[encounterPage],160,-6,20,UI_COLORS.sand,d,626,98,true);
     if(locations.length>1)this.ui.button((encounterPage+1)+'/'+locations.length+' ›',-357,-153,130,37,()=>{d.parent?.destroy();show((encounterPage+1)%locations.length);},{parent:d,size:19});
     this.ui.text('重要掉落',-52,-77,22,'#008E94',d,212,32);this.ui.text(bossLootText(boss),160,-126,21,UI_COLORS.ink,d,626,73,true);
     const claimed=progress.codexClaims.includes('boss:'+boss.id);this.ui.button(claimed?'奖励已领取':unlocked?'领取首胜金币':'击败后解锁金币',0,-232,330,46,()=>this.action(()=>{this.service.claimCodex(this.command('bossCodex'),'boss',boss.id);this.open(tab,category,page);}),{parent:d,primary:unlocked&&!claimed,disabled:!unlocked||claimed,size:23});
    };
    const n=this.ui.button('',-386+i%3*386,11-Math.floor(i/3)*171,363,158,()=>show(),{parent:p});
    const icon=this.ui.group('首领图鉴:'+boss.id,-110,0,n,126,140),border=icon.addComponent(Graphics);border.strokeColor=new Color(boss.color);border.lineWidth=2.5;border.roundRect(-65,-71,130,142,12);border.stroke();
    const f=this.ui.art?.battleFrame('boss-'+index),ratio=f?f.rect.width/f.rect.height:.8;this.ui.art?.attach(icon,('boss-'+index) as any,Math.min(120,133*ratio),Math.min(133,120/ratio));
    this.ui.text(boss.name,63,38,22,boss.color,n,208,35);this.ui.text(boss.skill,63,-5,20,UI_COLORS.ink,n,208,30);this.ui.text(unlocked?'已击败':'等待挑战',63,-43,18,UI_COLORS.sand,n,208,28);
    if(boss.tier===5){const glow=this.ui.group('金色首领流光',0,0,icon);glow.addComponent(GoldFlow).side=133;}
   });
   this.ui.button('上一页',-250,-279,205,46,()=>this.open(tab,category,page-1),{parent:p,disabled:page===0,size:22});this.ui.text((page+1)+' / '+pages,0,-279,22,UI_COLORS.ink,p,180,36);this.ui.button('下一页',250,-279,205,46,()=>this.open(tab,category,page+1),{parent:p,disabled:page+1===pages,size:22});
`+s.slice(b);fs.writeFileSync(p,s);
