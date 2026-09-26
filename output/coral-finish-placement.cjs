const fs=require('fs');const base='game/assets/scripts/';
function edit(p,f){let s=fs.readFileSync(base+p,'utf8');fs.writeFileSync(base+p,f(s));}
function rep(s,a,b){if(!s.includes(a))throw Error('missing '+a.slice(0,90));return s.replace(a,b);}
edit('core/bossCatalog.ts',s=>s.replaceAll('spellMystery','arcane'));
edit('view/BattleScreen.ts',s=>{
 const before=fs.readFileSync('output/coral-expansion-20260914/BattleScreen.before.ts','utf8');
 const bad=s.indexOf('      const landing=this.groundPoint(point);');if(bad<0)throw Error('tail');
 const tail=before.slice(before.indexOf('  private runStatus('));
 s=s.slice(0,bad)+`      }
    });
    const finish=(event:EventTouch)=>{
      if(!current()||!start){clear();return;}
      if(!dragged){clear();this.selected=id;this.ui.click();if(worldTarget){this.render();this.ui.toast('点陆地空处摆放 · 拖动也可以');}else this.unitDetails(id,()=>this.render());return;}
      const point=event.getLocation();let slot:number|undefined;
      for(const [index,target] of this.benchTargets)if(target.getComponent(UITransform)?.hitTest(point)){
        clear();const source=this.units.find(u=>u.id===id),other=this.units.find(u=>u.benchSlot===index);
        if(!source)return;
        if(source.slot!==null)this.act(()=>{this.service.moveUnit(this.command('bench'),id,null,this.battle,index);this.battle=this.run.battle;this.selected=id;});
        else if(other&&other.id!==id&&this.run.mode==='chapter')this.confirmBenchFusion(id,other.id);
        return;
      }
      for(const [index,target] of this.dropTargets)if(target.getComponent(UITransform)?.hitTest(point)){slot=index;break;}
      const source=this.units.find(u=>u.id===id);
      if(slot===undefined&&source?.slot===null)for(const [otherId,target] of this.worldHits)if(otherId!==id&&target.getComponent(UITransform)?.hitTest(point)){slot=this.units.find(u=>u.id===otherId)?.slot??undefined;break;}
      const at=this.groundPoint(point);clear();
      if(slot!==undefined)this.act(()=>{this.service.moveUnit(this.command('move'),id,slot!,this.battle);this.battle=this.run.battle;this.selected=id;});
      else if(at)this.act(()=>{this.service.placeUnit(this.command('place'),id,at,this.battle);this.battle=this.run.battle;this.selected=id;});
      else this.ui.toast('请放到陆地空处或备战槽');
    };
    node.on(Node.EventType.TOUCH_END,finish);
    node.on(Node.EventType.TOUCH_CANCEL,(event:EventTouch)=>{if(event.getEventCode()===Node.EventType.TOUCH_END&&dragged)finish(event);else clear();});
    node.once(Node.EventType.NODE_DESTROYED,clear);
  }
`+tail;
 s=s.replace('  private battle?:BattleState;','  private battle?:BattleState;\n  private worldHits=new Map<string,Node>();');
 s=s.replace('this.pageEpoch++;this.rewardFrame','this.worldHits.clear();this.pageEpoch++;this.rewardFrame');
 s=s.replace('this.attachBenchDrag(n,u.id,true);','this.attachBenchDrag(n,u.id,true);this.worldHits.set(u.id,n);');
 s=s.replace('  update(dt:number):void{',`  update(dt:number):void{
    for(const [id,n] of this.worldHits){const u=this.units.find(u=>u.id===id);if(!u||u.slot===null)continue;const at=this.battle?.units.find(a=>a.id===id)??u.placement??BATTLE_MAPS[this.run.levelId].slots[u.slot],p=this.screenPoint(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));if(p)n.setPosition(p.x,p.y,0);}
`);
 s=s.replace("surface.on(Node.EventType.TOUCH_START", "const ink=surface.addComponent(Graphics);ink.fillColor=color('#FFFFFF',1);ink.rect(-640,-360,1280,720);ink.fill();\n    surface.on(Node.EventType.TOUCH_START");
 s=s.replace("u.range,false);","u.range,false,u);");
 s=s.replace('`场上位置 ${(u.slot??0)+1}`',"'正在战场驻守'");
 const form=s.indexOf('  private formation(');if(form>=0){const body=s.indexOf('{',form);s=s.slice(0,body+1)+"\n    if(this.run.rulesVersion==='0.6'){this.render();this.ui.toast('点选伙伴后点陆地，或直接拖动伙伴调整');return;}"+s.slice(body+1);}
 return s;
});
edit('core/placement.ts',s=>s.replace('if(!Number.isFinite(p.x)','if(!p||!Number.isFinite(p.x)'));
edit('core/battle.ts',s=>{
 s=s.replace('  const coreHealth = options.coreHealth',`  for(const input of inputs)if(input.placement!==undefined){const issue=placementIssue(definition,input.placement,inputs.filter(o=>o!==input).map(o=>o.placement??definition.slots[o.slot]).filter(Boolean));if(issue)throw Error(issue);}
  const coreHealth = options.coreHealth`);
 s=s.replace('  const fresh=cached?',`  const target=input.placement??occupied?.placement;if(target){const issue=placementIssue(battleMap(state),target,state.units.filter(u=>u!==occupied).map(u=>u.placement??u));if(issue)throw Error(issue);}
  const fresh=cached?`);
 return s;
});
edit('core/game.ts',s=>s.replace("const source=r.units[unit.id];","const source=r.units[unit.id];\n    requireRule(JSON.stringify(source?.placement)===JSON.stringify(unit.placement),'战斗自由落点与布阵不一致');").replace("requireRule(battle.status==='won'||battle.status==='lost','这一波战斗尚未结束');","requireRule(battle.status==='won'||battle.status==='lost','这一波战斗尚未结束');discoverBattle(s,battle);"));
edit('core/save.ts',s=>s.replace('if(u.placement)requireRule','if(u.placement!==undefined)requireRule'));
