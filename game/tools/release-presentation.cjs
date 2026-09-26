const fs=require('node:fs'),root='game/assets/scripts/';
function edit(f,fn){const p=root+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
edit('view/IslandUI.ts',s=>rep(s,'  hover(n:Node):void{',`  compactFrom(index:number,scale:number,x=0,y=0):void{
    const nodes=this.root.children.slice(index),group=this.group('紧凑功能栏',x,y);
    nodes.forEach(n=>n.setParent(group));group.setScale(scale,scale,1);
  }
  hover(n:Node):void{`));
edit('view/BattleScreen.ts',s=>{
 s=rep(s,'    this.worldDragTargets();','    this.enableMapPan();this.worldDragTargets();\n    const hudStart=this.ui.root.children.length;');
 s=rep(s,"    if(endless&&active)this.ui.text(frontNotice", "    this.ui.compactFrom(hudStart,.78,140,79);\n    if(endless&&active)this.ui.text(frontNotice");
 s=rep(s,'this.ui.panel(0,212,1050,50', 'this.ui.panel(0,254,960,36');
 s=rep(s,'`${lane} · ${threat.name}　${threat.tip}`,0,212,25', '`${lane} · ${threat.name}　${threat.tip}`,0,254,21');
 s=rep(s,'    this.ui.panel(0,-157,1232,102','    const rosterStart=this.ui.root.children.length;\n    this.ui.panel(0,-157,1232,102');
 s=rep(s,'if(endless&&!units.some(u=>u.benchSlot!==undefined))return;', 'if(endless&&!units.some(u=>u.benchSlot!==undefined)){this.ui.compactFrom(rosterStart,.78,0,-79);return;}');
 s=rep(s,'  private skillBar():void{','  private skillBar():void{');
 s=rep(s,'    this.updateSkillBar();\n  }\n  private autoSkillToggle', '    this.ui.compactFrom(skillStart,.72,179,-101);\n    this.updateSkillBar();\n  }\n  private autoSkillToggle');
 s=rep(s,'    this.ui.panel(266,-267,700,166','    const skillStart=this.ui.root.children.length;\n    this.ui.panel(266,-267,700,166');
 const end=s.indexOf('  private skillBar():void{');let before=s.slice(0,end),rest=s.slice(end);const closing=before.lastIndexOf('  }');before=before.slice(0,closing)+'    this.ui.compactFrom(rosterStart,.78,0,-79);\n'+before.slice(closing);s=before+rest;
 s=rep(s,'  private skillBar():void{',`  private panBase?:Vec3;
  private enableMapPan():void{
    if(this.run.phase==='combat')return;
    this.panBase??=this.camera.node.position.clone();
    const input=this.ui.group('按住空白拖动地图',0,0,this.ui.root,1280,720);
    let previous:{x:number;y:number}|undefined,moved=false;
    input.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{const p=e.getLocation();previous={x:p.x,y:p.y};moved=false;});
    input.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!previous)return;e.propagationStopped=true;const p=e.getLocation(),pos=this.camera.node.position;
      const x=Math.max(this.panBase!.x-3,Math.min(this.panBase!.x+3,pos.x-(p.x-previous.x)*.018));
      const z=Math.max(this.panBase!.z-2.5,Math.min(this.panBase!.z+2.5,pos.z+(p.y-previous.y)*.025));
      moved||=Math.hypot(p.x-previous.x,p.y-previous.y)>2;this.camera.node.setPosition(x,pos.y,z);previous={x:p.x,y:p.y};
    });
    input.on(Node.EventType.TOUCH_END,()=>{previous=undefined;if(moved)this.render();});input.on(Node.EventType.TOUCH_CANCEL,()=>{previous=undefined;});
  }
  private skillBar():void{`);
 return s;
});
edit('view/ActiveSkillControls.ts',s=>{
 s=rep(s,'    this.items=[];','    const start=this.ui.root.children.length;this.items=[];');
 s=rep(s,"toggle.name='一键释放开关';this.update();","toggle.name='一键释放开关';this.ui.compactFrom(start,.72,179,-101);this.update();");return s;
});
edit('view/BattleWorld.ts',s=>{
 s=rep(s,'    for (const [id, actor] of this.units) if (!present.has(id))',`    for(const pet of battle.summons??[]){
      if(!pet.alive)continue;let actor=this.units.get(pet.id);
      if(!actor){
        if(pet.kind==='golem'){
          actor=this.createActor(pet.id,'stone',true);for(const child of [...actor.body.children])child.destroy();
          const rock=(name:string,x:number,y:number,z:number,w:number,h:number,d:number)=>this.surface(name,actor!.body,'box','#71858A',x,y,z,w,h,d);
          rock('石人胸甲',0,.85,0,.85,.9,.55);rock('石人头',0,1.55,.02,.55,.52,.46);
          for(const sign of [-1,1]){rock('肩部',sign*.55,1.05,0,.42,.45,.44);rock('拳臂',sign*.65,.6,.08,.35,.65,.35);rock('石腿',sign*.25,.26,0,.37,.55,.4);this.surface('青光眼',actor.body,'sphere','#8AEFE4',sign*.14,1.61,.26,.085,.07,.045);}
          this.surface('通灵之心',actor.body,'sphere','#72E3DF',0,1.02,.3,.24,.27,.08);actor.height=2;actor.bar.setPosition(0,2,0);this.units.set(pet.id,actor);
        }else actor=this.unitActor(pet.id,'bubble');
      }
      present.add(pet.id);this.syncActor(actor,{...pet,statuses:[]} as unknown as BattleUnit,frame,tickChanged,elapsed);
      const scale=pet.kind==='golem'?.72:.43;actor.node.setScale(scale,scale,scale);
      const fall=pet.kind==='golem'?Math.max(0,1-(battle.tick-pet.bornTick)/10)*4:0;actor.node.setPosition(pet.x,actor.floor+fall,pet.z);
      this.health(actor,pet.hp/pet.maxHp,pet.kind==='golem'?1:0);
    }
    for (const [id, actor] of this.units) if (!present.has(id))`);
 s=s.replace("['extraTarget','combo','bounce','reflect']","['extraTarget','scatter','combo','bounce','reflect']");
 s=rep(s,"if (event.skillId === 'piercingShot' || event.skillId === 'crystalCannon') {",`if(event.skillId==='crystalCannon'){
        this.effect('ring',destination,destination,'#ABDDEB',.65,3.6,3);
        for(let i=0;i<8;i++){const a=i*Math.PI/4,at=new Vec3(destination.x+Math.cos(a)*1.3,.12,destination.z+Math.sin(a)*1.3);this.effect('bolt',new Vec3(at.x,2.8,at.z),at,'#E6F9FF',.4,.11,2);}
      } else if(event.skillId==='counterStorm'||event.skillId==='spirit'||event.skillId==='holyLight'){
        this.effect('ring',destination,destination,event.skillId==='holyLight'?'#F5D58A':event.skillId==='spirit'?'#E5AA74':'#A8CFD0',.55,event.skillId==='holyLight'?1.3:3,2);
      } else if (event.skillId === 'piercingShot') {`);
 s=rep(s,"event.skillId === 'piercingShot' ? '#FFE077' : '#B5F2FF'","'#FFE077'");
 s=rep(s,"this.syncActor(actor, enemy, frame, tickChanged, elapsed);","this.syncActor(actor, enemy, frame, tickChanged, elapsed);\n      if(enemy.kind==='boss'&&battle.mode==='chapter'){const size=battle.wave===5?1.32:.88;actor.node.setScale(size,size,size);}");
 return s;
});
console.log('Compact HUD, map panning, summon actors and spell effects applied');
