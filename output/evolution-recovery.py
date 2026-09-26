from pathlib import Path
r=Path('game/assets/scripts')
p=r/'view/GoldFlow.ts';s=p.read_text(encoding='utf-8').replace('this.addComponent(Graphics),s=', 'this.node.addComponent(Graphics),s=');p.write_text(s,encoding='utf-8')
p=r/'core/battleValidation.ts';s=p.read_text(encoding='utf-8').replace('enemies.filter(e=>e.alive).length','enemies.length-deadEnemies').replace("status === 'lost' ? coreHealth === 0", "status === 'lost' ? (s.levelId===55?s.tick===3600:coreHealth===0)");p.write_text(s,encoding='utf-8')
p=r/'core/battle.ts';s=p.read_text(encoding='utf-8').replace("levelId>0&&levelId<54","levelId>=0&&levelId!==54");p.write_text(s,encoding='utf-8')
p=r/'view/IslandUI.ts';s=p.read_text(encoding='utf-8').replace('export class IslandUI {','export class IslandUI {\n  onActionError?:(error:unknown)=>void;');s=s.replace('this.click();action();','this.click();try{action();}catch(error){if(this.onActionError)this.onActionError(error);else throw error;}');pos=s.index('  battleFigure(');s=s[:pos]+'''  fusionCard(t:Turtle,parent:Node):void{
    const card=this.panel(0,0,312,202,parent,'#FFF9EC',255,15);card.name='泡泡内完整伙伴卡';
    this.portrait(t.role,-95,-9,124,card,true);this.text(t.name||ROLES[t.role].name,57,74,18,UI_COLORS.ink,card,176,29);
    this.text(`攻击 ${t.innate.attack+t.training.attack} · 生命 ${t.innate.health+t.training.health}`,58,42,14,UI_COLORS.ink,card,178,23);
    this.text(`防御 ${t.innate.defense+t.training.defense} · 成长 ${((t.innate.growth+t.training.growth)/100).toFixed(2)}`,58,17,14,UI_COLORS.sand,card,178,23);
    t.skills.forEach((id,i)=>this.bookIcon(id,-10+i%6*27,-17-Math.floor(i/6)*29,23,card));
    this.text(turtleQuality(t).name+' · '+t.skills.length+'技能',53,-80,16,turtleQuality(t).color,card,181,26);
  }
''' +s[pos:];s=s.replace("import {SKILL_BY_ID}","import {ROLES,SKILL_BY_ID}");p.write_text(s,encoding='utf-8')
p=r/'view/GameEntry.ts';s=p.read_text(encoding='utf-8');import re
line=next(x for x in s.splitlines() if 'this.ui=new IslandUI' in x or 'this.ui = new IslandUI' in x);s=s.replace(line,line+"\n    this.ui.onActionError=error=>this.error(error);");p.write_text(s,encoding='utf-8')
p=r/'view/PrototypeMenus.ts';s=p.read_text(encoding='utf-8').replace('this.ui.portrait(e.candidate.role,0,0,320,p);','this.ui.fusionCard(e.candidate,p);').replace('this.ui.portrait(e.candidate.role,0,0,260,p,true);','this.ui.fusionCard(e.candidate,p);').replace('this.sound(\'reveal\');this.revealedShape();','this.sound(\'reveal\');this.chooseSurvivor();').replace('if(e.revealed){this.revealedShape();','if(e.revealed){this.chooseSurvivor();');p.write_text(s,encoding='utf-8')
p=r/'view/BattleScreen.ts';s=p.read_text(encoding='utf-8').replace('this.ui.portrait(t.role,0,0,260,p,true);','this.ui.fusionCard(t,p);');a=s.index("this.battle=this.run.battle;this.audio.effect(q.tier===4?");b=s.index('return true;',a);s=s[:a]+'''this.battle=this.run.battle;this.audio.effect(q.tier===4?'sfx_rare_reveal':'sfx_collect');this.prototypeDetails(result.id,()=>{this.setPauseState(false,false);this.render();});''' +s[b:];p.write_text(s,encoding='utf-8')
p=r/'view/BubbleReveal.ts';s=p.read_text(encoding='utf-8').replace('if(ratio>.82)','if(ratio>.96)');p.write_text(s,encoding='utf-8')
