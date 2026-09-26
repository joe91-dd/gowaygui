from pathlib import Path
p=Path('game/assets/scripts/view/BattlePaint.ts');s=p.read_text(encoding='utf-8');s=s.replace("private time=0;", "private time=0;\n  private equipment:{node:Node;role:string;phase:number;x:number;y:number;size:number}[]=[];")
pos=s.index('  shadow(parent:Node')
s=s[:pos]+'''  equipmentGlow(parent:Node,role:Role):void{
    const locations:Record<Role,number[][]>={stone:[[-.26,1.30],[.30,1.29],[-.52,1.02]],spike:[[.60,.85]],crystal:[[-.52,1.26]],leaf:[[.54,.62]],bubble:[[-.45,1.34]]};
    const index=role==='stone'?5:role==='spike'?0:role==='crystal'?3:role==='leaf'?2:3,f=this.art.battleFrame('battle-vfx-'+index)!;
    locations[role].forEach(([x,y],i)=>{const n=this.node('装备流光:'+role,parent,this.quad('equipment-'+role,f,1,true),this.material('equipment-'+role,f,2));n.setPosition(x,y,.025);this.equipment.push({node:n,role,phase:i*1.9,x,y,size:role==='stone'?.20:role==='spike'?.37:.46});});
  }
  boss(node:Node,index:number):void{const f=this.art.battleFrame('boss-'+index);if(!f)return;const r=node.getComponent(MeshRenderer)!;r.mesh=this.quad('boss-'+index,f,1.85);r.setSharedMaterial(this.material('boss-atlas',f,1),0);node.setPosition(0,-.115,0);}
  guard(parent:Node,level:LevelDefinition):void{const p=level.id===55?{x:0,z:0}:level.route[level.route.length-1],f=this.art.battleFrame('enemy-prop-3')??this.art.battleFrame('island-props-7')!;const n=this.node('海心灯塔 · 守护目标',parent,this.quad('guard-lighthouse',f,1.65),this.material('guard',f,1));n.setPosition(p.x,.025,p.z);this.face(n);const glow=this.art.battleFrame('battle-vfx-3')!,light=this.node('守护灯塔潮光',n,this.quad('guard-glow',glow,.40,true),this.material('guard-light',glow,2));light.setPosition(0,1.20,.025);this.equipment.push({node:light,role:'crystal',phase:0,x:0,y:1.2,size:.40});}
''' +s[pos:]
s=s.replace('n.setPosition(x,.006,z)','n.setPosition(x,.001,z)')
s=s.replace("const plate=[0,1,0,0,1,2,3,3,1,2,2,3,2,3,0][chapter]", "const plate=[0,1,0,0,1,2,3,3,1,2,2,3,2,3,0,3][chapter]")
a=s.index('    const end=level.route[level.route.length-1],f=');b=s.index('\n  }',a);s=s[:a]+"    this.guard(parent,level);"+s[b:]
s=s.replace('    this.time+=Math.min(.1,dt);', '''    this.time+=Math.min(.1,dt);
    this.equipment=this.equipment.filter(e=>e.node.isValid);for(const e of this.equipment){const t=this.time+e.phase,pulse=.65+.35*Math.sin(t*(e.role==='leaf'?1.5:2.3)),burst=e.role==='bubble'?1+Math.pow(Math.max(0,Math.sin(t*1.8)),8)*.9:1;const size=e.size*pulse*burst;e.node.setScale(size,size,1);e.node.setRotationFromEuler(0,0,e.role==='crystal'?t*75:e.role==='bubble'?-t*38:e.role==='spike'?Math.sin(t*2)*18:0);e.node.setPosition(e.x+(e.role==='spike'?Math.sin(t*2)*.09:0),e.y,.026);}
''')
s=s.replace("Math.sin(t*1.3)*.006","Math.sin(t*1.3)*.018").replace("Math.cos(t*1.1)*.008","Math.cos(t*1.1)*.014")
p.write_text(s,encoding='utf-8')
p=Path('game/assets/scripts/view/BattleWorld.ts');s=p.read_text(encoding='utf-8');s="import {BOSSES} from '../core/bossCatalog';\nimport {turtleQuality} from '../core/prototypeConfig';\n"+s;s=s.replace('  paint?:Node;','  paint?:Node;qualityRing?:Node;arrivalTime?:number;station?:number;')
s=s.replace('actor.floor=.075','actor.floor=.021')
s=s.replace('    this.painted.shadow(actor.node,actor.friendly);',"    this.painted.shadow(actor.node,actor.friendly);if(actor.friendly&&ROLES[kind as Role]){this.painted.equipmentGlow(actor.paint,kind as Role);actor.arrivalTime=1.65;actor.qualityRing=this.surface('伙伴品质魂环',actor.node,'rangeRing','#39A873',0,.003,0,.90,1,.90);}")
s=s.replace('      actor.alive = true; actor.deathTime', "      if(actor.qualityRing){actor.qualityRing.getComponent(MeshRenderer)!.setSharedMaterial(this.material(turtleQuality(unit.turtle).color),0);}\n      if(actor.station!==unit.slot){actor.station=unit.slot;actor.arrivalTime=1.65;}\n      actor.alive = true; actor.deathTime")
s=s.replace("this.painted?.pose(actor.paint,actor.kind,0);actor.body.setPosition(0,Math.sin(actor.phase*2.3)*.013,0);", "actor.arrivalTime=Math.max(0,(actor.arrivalTime??0)-elapsed);const f=actor.arrivalTime>1.30?1:actor.arrivalTime>.35?2:actor.arrivalTime>0?3:0;this.painted?.pose(actor.paint,actor.kind,f);actor.body.setPosition(0,0,0);actor.body.setScale(1-Math.sin(actor.phase*1.7)*.005,1+Math.sin(actor.phase*1.7)*.016,1);if(actor.qualityRing)actor.qualityRing.setRotationFromEuler(0,actor.phase*14,0);")
s=s.replace("      if(enemy.kind==='boss'&&battle.mode==='chapter'){const size=battle.wave===5?1.32:.88;actor.node.setScale(size,size,size);}", "      if(enemy.bossId&&actor.paint){const index=BOSSES.findIndex(b=>b.id===enemy.bossId);if(index>=0){this.painted?.boss(actor.paint,index);const size=BOSSES[index].size*(battle.mode==='chapter'&&battle.wave!==5?.88:1);actor.node.setScale(size,size,size);}}")
s=s.replace("      this.painted?.pose(actor.paint,poseKind,frame);", "      actor.arrivalTime=Math.max(0,(actor.arrivalTime??0)-dt);if('slot' in state&&actor.station!==state.slot){actor.station=state.slot;actor.arrivalTime=1.65;}\n      this.painted?.pose(actor.paint,poseKind,actor.friendly&&actor.alive&&actor.actionTime<=0&&(actor.arrivalTime??0)>0?(actor.arrivalTime!>1.3?1:actor.arrivalTime!>.35?2:3):frame);if(actor.qualityRing){actor.qualityRing.active=actor.alive;actor.qualityRing.setRotationFromEuler(0,actor.phase*18,0);}")
s=s.replace("*.006:0;", "*.016:0;")
a=s.index('        if(this.levelId===0){\n          const end=');b=s.index('        return;',a);s=s[:a]+"        if(this.levelId===0)this.painted.guard(base,this.mapDefinition);\n"+s[b:]
p.write_text(s,encoding='utf-8')
