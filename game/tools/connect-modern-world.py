from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'assets/scripts/view/BattleWorld.ts';s=p.read_text(encoding='utf8')
s=s.replace("import {ENEMIES, BATTLE_MAPS, ROLES}","import {ENEMIES, BATTLE_MAPS, LEGACY_BATTLE_MAPS, ROLES}")
s=s.replace("import {TurtleMaterialAdapter}","import {modernIslandMesh} from './ModernIsland';\nimport {HERO_LOOK} from './VisualIdentity';\nimport {TurtleMaterialAdapter}")
s=s.replace("| 'rangeRing';", "| 'rangeRing' | 'terrain';")
s=s.replace("  private legacyModeLayout=false;", "  private legacyModeLayout=false;\n  private legacyGeometry=false;\n  private get mapDefinition(){return (this.legacyGeometry?LEGACY_BATTLE_MAPS:BATTLE_MAPS)[this.levelId];}")
s=s.replace('    this.legacyModeLayout=false;', '    this.legacyModeLayout=false;this.legacyGeometry=false;')
s=s.replace('const point = BATTLE_MAPS[this.levelId].slots[slot];','const point = this.mapDefinition.slots[slot];')
s=s.replace('undefined:BATTLE_MAPS[this.levelId].slots[slot];','undefined:this.mapDefinition.slots[slot];')
s=s.replace('const level = BATTLE_MAPS[this.levelId];','const level = this.mapDefinition;')
marker='    this.retireNode(this.environment);\n    const base = this.node('
idx=s.index(marker,s.index('  private buildTemporaryEnvironment'))
s=s[:idx]+'''    if(!this.legacyGeometry){
      this.retireNode(this.environment);
      const base=this.node('现代海岛 · 清爽战场',this.root);this.environment=base;
      const mesh=modernIslandMesh(this.mapDefinition),old=this.meshes.get('terrain');this.meshes.set('terrain',mesh);old?.destroy();
      const terrain=this.node('海岸与路线合批',base),renderer=terrain.addComponent(MeshRenderer);renderer.mesh=mesh;
      let material=this.materials.get('modern-terrain');if(!material){material=new Material();material.copy(this.pipelineMaterial);material.recompileShaders({USE_VERTEX_COLOR:true});material.setProperty('mainColor',Color.WHITE);material.setProperty('roughness',.85);this.materials.set('modern-terrain',material);}renderer.setSharedMaterial(material,0);
      this.surface('远海',base,'box','#30B5D3',0,-1,0,80,.12,65);
      this.surface('浅海',base,'sphere','#65D6DC',0,-1.01,0,37,.4,26);
      const route=this.mapDefinition.route,p=route[route.length-1];
      this.surface('珍珠台',base,'cylinder','#F0DEC0',p.x,.18,p.z,1.3,.3,1.3);
      this.surface('守护珍珠',base,'sphere','#FFF2CD',p.x,.72,p.z,.78,.78,.78);
      return;
    }
''' +s[idx:]
# A historical snapshot renders on its historical island until that wave finishes.
idx=s.index('    const oldLayout=',s.index('  update(')) if '    const oldLayout=' in s[s.index('  update('):] else -1
if idx>=0:s=s[:idx]+"    const oldGeometry=state.layoutVersion!==2;if(this.legacyGeometry!==oldGeometry){this.legacyGeometry=oldGeometry;this.buildTemporaryEnvironment();}\n"+s[idx:]
s=s.replace("if (!actor.friendly && actor.moving && actor.actionTime <= 0)","if (actor.moving && actor.actionTime <= 0)")
s=s.replace("const restingAction:Action=!actor.friendly&&actor.moving&&!controlled?'walk':'idle';", "const restingAction:Action=actor.moving&&!controlled?'walk':'idle';")
s=s.replace("const color = source?.friendly ? ROLES[source.kind as Role].color", "const color = source?.friendly ? HERO_LOOK[source.kind as Role].accent")
p.write_text(s,encoding='utf8')
p=root/'assets/scripts/view/GameEntry.ts';s=p.read_text(encoding='utf8').replace('LEVELS, MATERIAL_NAMES','BATTLE_MAPS, LEVELS, MATERIAL_NAMES')
s=s.replace('this.mainCamera.node.setPosition(0,15,18);','this.mainCamera.node.setPosition(0,24,14);')
s=s.replace('const island=islands[levelId];',"const snapshot=this.service.snapshot.run?.battle;const island=snapshot&&!snapshot.layoutVersion?islands[levelId]:undefined;")
p.write_text(s,encoding='utf8')
p=root/'assets/scripts/view/IslandUI.ts';s=p.read_text(encoding='utf8').replace('label.isBold=size>=32','label.isBold=size>=22');p.write_text(s,encoding='utf8')
