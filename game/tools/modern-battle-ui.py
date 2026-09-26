from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'assets/scripts/view/IslandUI.ts';s=p.read_text(encoding='utf8');s=s.replace('  skillPill(name:string', '''  toast(message:string):void{
    const n=this.panel(0,156,Math.min(620,Math.max(240,message.length*22)),52,this.root,'#07536C',244,24);n.name='简短操作提示';
    this.text(message,0,0,22,'#FFFFFF',n,580,38);tween(n).delay(1.8).call(()=>n.destroy()).start();
  }
  skillPill(name:string''');p.write_text(s,encoding='utf8')
p=root/'assets/scripts/view/BattleScreen.ts';s=p.read_text(encoding='utf8')
s=s.replace('this.battle.autoSkills=this.service.snapshot.settings.autoSkills??false;', 'this.battle.autoSkills=this.service.snapshot.settings.autoSkills??false;this.battle.manualSkillTurtles=[...(this.service.snapshot.settings.manualSkillTurtles??[])];')
s=s.replace('next.autoSkills=this.service.snapshot.settings.autoSkills??false;', 'next.autoSkills=this.service.snapshot.settings.autoSkills??false;next.manualSkillTurtles=[...(this.service.snapshot.settings.manualSkillTurtles??[])];')
s=s.replace("      const u=units.find(u=>u.slot===slot),n=this.button('',-512+180*slot", "      const u=units.filter(u=>u.slot!==null).sort((a,b)=>a.slot!-b.slot!)[slot],n=this.button('',-512+180*slot")
s=s.replace("n.name='新版站位:'+slot;this.dropTargets.set(slot,n);", "n.name='出战伙伴:'+slot;if(u)this.dropTargets.set(u.slot!,n);")
s=s.replace('this.ui.text(String(slot+1),-63,34', 'this.ui.text(u?String(u.slot!+1):String(slot+1),-63,34')
s=s.replace("this.ui.panel(266,-285,700,132,this.ui.root,UI_COLORS.dark,245,16);", "this.ui.panel(266,-267,700,166,this.ui.root,UI_COLORS.dark,245,20);")
s=s.replace('const u=b.units.find(u=>u.slot===slot),skill=', 'const u=[...b.units].sort((a,b)=>a.slot-b.slot)[slot],skill=')
s=s.replace("      if(u)this.skillButtons.push({unitId:u.id,skill,label,mask});", """      if(u){
        this.skillButtons.push({unitId:u.id,skill,label,mask});
        const held=this.service.snapshot.settings.manualSkillTurtles?.includes(u.turtleId)??false;
        this.button(held?'手动保留':'跟随自动',x,-205,104,30,()=>{
          const ids=new Set(this.service.snapshot.settings.manualSkillTurtles??[]);if(ids.has(u.turtleId))ids.delete(u.turtleId);else ids.add(u.turtleId);
          const value=[...ids];this.service.updateSettings(this.command('holdSkill'),{manualSkillTurtles:value});b.manualSkillTurtles=value;this.render();
        },{selected:held,size:16,disabled:!skill});
      }""")
s=s.replace("const b=this.battle,u=b?.units.find(x=>x.id===unitId);if(!b||!u||!canCommandBattle(b,{type:'cast',unitId,skillId}))return;", "const b=this.battle,u=b?.units.find(x=>x.id===unitId);if(!b||!u)return;if(!canCommandBattle(b,{type:'cast',unitId,skillId})){this.ui.toast(!u.alive?'伙伴已倒下':(u.cooldowns[skillId]??0)>b.tick?'技能正在冷却':'当前没有合法目标');return;}")
a=s.index('  private worldDragTargets():void{');b=s.index('  private attachBenchDrag(',a)
s=s[:a]+'''  private worldDragTargets():void{
    const selected=this.units.find(u=>u.id===this.selected),slots=BATTLE_MAPS[this.run.levelId].slots;
    slots.forEach((slot,index)=>{
      const p=this.screenPoint(this.camera.worldToScreen(new Vec3(slot.x,.2,slot.z)));if(!p)return;
      const occupied=this.units.find(u=>u.slot===index);
      const hint=this.ui.group('地图候选站位:'+index,p.x,p.y,this.ui.root,58,42),g=hint.addComponent(Graphics);
      g.strokeColor=color(occupied?'#FAF5DA':'#35CFE0',occupied?90:180);g.fillColor=color('#FFF9EC',occupied?15:85);g.lineWidth=2;g.ellipse(0,0,26,14);g.fill();g.stroke();
      if(!occupied)this.ui.text(String(index+1),0,0,17,'#07536C',hint,40,30);
      hint.on(Node.EventType.TOUCH_END,()=>{if(!selected){this.ui.toast('先点选一只伙伴');return;}this.act(()=>{this.service.moveUnit(this.command('station'),selected.id,index,this.battle);this.battle=this.run.battle;});});
    });
    for(const u of this.units.filter(u=>u.slot!==null)){
      const slot=slots[u.slot!],actor=this.battle?.units.find(a=>a.id===u.id),p=this.screenPoint(this.camera.worldToScreen(new Vec3(actor?.x??slot.x,1,actor?.z??slot.z)));if(!p)continue;
      const n=this.ui.group('战场拖动:'+u.id,p.x,p.y,this.ui.root,90,90);this.attachBenchDrag(n,u.id,true);
    }
  }
''' +s[b:]
s=s.replace("if(p){start={x:p.x,y:p.y};dragged=false;}", """if(p){start={x:p.x,y:p.y};dragged=false;this.selected=id;const u=this.units.find(u=>u.id===id);if(u?.slot!==null&&u)this.world.showRange(u.slot,this.battle?.units.find(a=>a.id===id)?.range??ROLES[u.turtle.role].range,u.turtle.role==='leaf');}""")
s=s.replace('>14)dragged=true;', '>8)dragged=true;')
s=s.replace("if(worldTarget&&this.run.phase==='combat')this.render();else this.unitDetails(id,()=>this.render());", "if(worldTarget){this.render();this.ui.toast('点选站位调动 · 拖动也可以');}else this.unitDetails(id,()=>this.render());")
s=s.replace("clear();if(slot!==undefined)this.act(()=>{this.service.moveUnit(this.command('move'),id,slot!,this.battle);this.battle=this.run.battle;this.selected=id;});", "clear();if(slot!==undefined)this.act(()=>{this.service.moveUnit(this.command('move'),id,slot!,this.battle);this.battle=this.run.battle;this.selected=id;this.audio.effect('sfx_collect',100);});else this.ui.toast('请放到地图站位或备战槽');")
a=s.index('    for(let slot=0;slot<5;slot++){',s.index('  private formation():void{'));b=s.index("    this.button('选择其他伙伴'",a)
s=s[:a]+'''    const slots=modern?BATTLE_MAPS[r.levelId].slots.length:5;
    for(let slot=0;slot<slots;slot++){
      const occupant=units.find(u=>u.slot===slot),n=this.button('',-350+(slot%3)*350,122-Math.floor(slot/3)*126,322,114,()=>this.act(()=>{
        if(incoming){this.service.deployBench(this.command('deploy'),selected.id,slot,this.battle);this.battle=this.run.battle;}
        else this.service.moveUnit(this.command('move'),selected.id,slot);
      }),{parent:p,selected:selected.slot===slot,disabled:incoming&&!occupant&&units.filter(u=>u.slot!==null).length>=5});
      n.name='布阵站位:'+slot;this.ui.text(`位置 ${slot+1}`,-77,26,25,UI_COLORS.sand,n,156,36);
      if(occupant)this.ui.portrait(occupant.turtle.role,83,5,88,n);
      this.ui.text(occupant?this.shortName(this.petName(occupant.turtle),6):'可调动至此',-77,-24,24,UI_COLORS.cream,n,166,36);
    }
    this.ui.text('场上最多5只 · 波间自由调位 · 备战槽独立保留',0,-214,23,UI_COLORS.sand,p,1100,34);
''' +s[b:]
p.write_text(s,encoding='utf8')
p=root/'assets/scripts/view/ActiveSkillControls.ts';s=p.read_text(encoding='utf8')
s=s.replace('this.ui.panel(266,-285,700,132', 'this.ui.panel(266,-267,700,166')
s=s.replace("      if(u)this.items.push({id:u.id,skill,label,mask});", """      if(u){this.items.push({id:u.id,skill,label,mask});
        const held=this.service.snapshot.settings.manualSkillTurtles?.includes(u.turtleId)??false;
        this.ui.button(held?'手动保留':'跟随自动',10+i*112,-205,104,30,()=>{
          if(!this.available())return;const ids=new Set(this.service.snapshot.settings.manualSkillTurtles??[]);if(ids.has(u.turtleId))ids.delete(u.turtleId);else ids.add(u.turtleId);
          const value=[...ids];this.service.updateSettings(this.command('holdSkill'),{manualSkillTurtles:value});this.context(b=>{b.manualSkillTurtles=value;});this.repaint();
        },{selected:held,size:16,disabled:!skill});
      }""")
s=s.replace('    this.context(b=>{\n      for(const item', '    this.context(b=>{\n      b.manualSkillTurtles=[...(this.service.snapshot.settings.manualSkillTurtles??[])];\n      for(const item')
s=s.replace("const u=b.units.find(x=>x.id===unitId);if(!u||!canCommandBattle(b,{type:'cast',unitId,skillId}))return;", "const u=b.units.find(x=>x.id===unitId);if(!u)return;if(!canCommandBattle(b,{type:'cast',unitId,skillId})){this.ui.toast(!u.alive?'伙伴已倒下':(u.cooldowns[skillId]??0)>b.tick?'技能正在冷却':'当前没有合法目标');return;}")
p.write_text(s,encoding='utf8')
