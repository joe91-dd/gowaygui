const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../assets/scripts/view');
function edit(file,fn){const p=path.join(root,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
function sub(s,a,b){if(!s.includes(a))throw new Error('Missing '+a.slice(0,90));return s.replace(a,b);}
edit('ArtV2Assets.ts',s=>{
  s=sub(s,"export type ArtV2Image=","export type ArtV2Image='battle-island-painted'|'battle-enemies-painted'|'battle-vfx-painted'|");
  s=sub(s,"const IMAGES:ArtV2Image[]=[","const IMAGES:ArtV2Image[]=['battle-island-painted','battle-enemies-painted','battle-vfx-painted',");
  s=sub(s,'  private keyMaterial?:Material;','  battleEffect?:EffectAsset;\n  battleFrame(key:string):SpriteFrame|undefined{return this.frames.get(key as ArtV2Slice)??this.images.get(key as ArtV2Image)?.frame;}\n  private keyMaterial?:Material;');
  s=sub(s,"    resources.load('art-modern/chroma-sprite'",`    resources.load('art-modern/battle-paint',EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'战斗绘制材质载入失败';this.state='failed';return;}
      effect.addRef();this.battleEffect=effect;this.finishLoading();
    });
    resources.load('art-modern/chroma-sprite'`);
  s=sub(s,"const modern:Partial<Record<ArtV2Image,string>>={","const modern:Partial<Record<ArtV2Image,string>>={'battle-island-painted':'battle-island-painted','battle-enemies-painted':'battle-enemies-painted','battle-vfx-painted':'battle-vfx-painted',");
  s=sub(s,"this.images.size===IMAGES.length&&this.keyMaterial&&","this.images.size===IMAGES.length&&this.keyMaterial&&this.battleEffect&&");
  s=sub(s,"      this.frames.set(`hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));","      this.frames.set(`hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));\n      this.frames.set(`battle-hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));");
  s=sub(s,"    const tank=this.images.get('home-stone-keyed')!;",`    const enemy=this.images.get('battle-enemies-painted')!;
    const enemyCrops=[[42,120,355,294],[470,95,361,320],[903,79,411,338],[1384,54,348,375],[40,503,353,334],[447,514,377,331],[826,457,522,389],[1370,488,391,354]];
    enemyCrops.forEach(([x,y,w,h],i)=>this.frames.set(('battle-enemy-'+i) as ArtV2Slice,frame(enemy.texture!,x,y,w,h)));
    const vfx=this.images.get('battle-vfx-painted')!;
    for(let i=0;i<6;i++){const w=vfx.image.width/3,h=vfx.image.height/2;this.frames.set(('battle-vfx-'+i) as ArtV2Slice,frame(vfx.texture!,i%3*w,Math.floor(i/3)*h,w,h));}
    const tank=this.images.get('home-stone-keyed')!;`);
  s=sub(s,'    this.keyMaterial?.destroy();','    this.battleEffect?.decRef();this.battleEffect=undefined;\n    this.keyMaterial?.destroy();');
  return s;
});
edit('BattleWorld.ts',s=>{
  s=sub(s,"import {modernIslandMesh} from './ModernIsland';","import {modernIslandMesh} from './ModernIsland';\nimport {BattlePaint} from './BattlePaint';\nimport type {ArtV2Assets} from './ArtV2Assets';");
  s=sub(s,'  animations: SkeletalAnimation[];','  paint?:Node;\n  animations: SkeletalAnimation[];');
  s=sub(s,'  private terrainTexture?:Texture2D;',`  private painted?:BattlePaint;
  setBattleArt(art?:ArtV2Assets):void{
    if(!art?.ready||!art.battleEffect||this.painted||this.disposed)return;
    this.painted=new BattlePaint(this.effectRoot,this.camera,art);
    for(const actor of this.units.values())this.attachPaint(actor);
    for(const actor of this.enemies.values())this.attachPaint(actor);
    this.buildTemporaryEnvironment();
  }
  private attachPaint(actor:Actor,kind:Role|EnemyKind|'golem'=actor.kind):void{
    if(!this.painted||actor.paint||!actor.node.isValid)return;
    for(const child of [...actor.body.children])this.retireNode(child);
    const result=this.painted.actor(actor.body,kind,actor.friendly);actor.paint=result.node;
    actor.animations=[];actor.realModel=false;actor.height=result.height*.68+.2;
    actor.bar.setPosition(0,actor.height,0);actor.bar.setScale(.66,.8,1);actor.control.setPosition(0,actor.height,0);
    this.surface('脚下接触阴影',actor.node,'cylinder','#688985',0,.012,0,actor.friendly?.65:.45,.012,.34);
  }
  private terrainTexture?:Texture2D;`);
  s=sub(s,'    this.advanceRetiring(elapsed);\n    this.tickEffects(Math.min(.1, elapsed));','    this.advanceRetiring(elapsed);\n    for(const actor of this.units.values()){if(actor.paint){actor.phase+=elapsed;actor.body.setPosition(0,Math.sin(actor.phase*2.3)*.013,0);this.painted?.face(actor.paint);}}\n    this.tickEffects(Math.min(.1, elapsed));\n    this.painted?.update(Math.min(.1,elapsed));\n    this.billboardBars();');
  s=sub(s,'    this.turtleMaterials.destroy();','    this.painted?.destroy();this.painted=undefined;\n    this.turtleMaterials.destroy();');
  s=sub(s,'    const textured=this.levelId===0&&!!this.terrainTexture;',`    if(this.painted&&this.levelId===0&&!this.legacyStations){
        this.painted.ground(base);
        this.oceanNode=this.surface('宁静远海',base,'box','#52BDD0',0,-.2,0,80,.08,65);
        const sea=new Material();sea.initialize({effectName:'builtin-unlit'});sea.setProperty('mainColor',new Color('#52BDD0'));this.oceanNode.getComponent(MeshRenderer)!.setSharedMaterial(sea,0);
        this.materials.get('painted-sea')?.destroy();this.materials.set('painted-sea',sea);
        for(const p of this.mapDefinition.slots){
          this.surface('象牙石站位',base,'cylinder','#F3E7CE',p.x,.02,p.z,.86,.10,.86);
          this.surface('青玉站位刻线',base,'rangeRing','#82B9B2',p.x,.08,p.z,.74,1,.74);
        }
        const end=this.mapDefinition.route.at(-1)!;
        this.surface('守护之心底座',base,'cylinder','#EFE4C9',end.x,.03,end.z,.8,.12,.8);
        this.surface('守护之心',base,'sphere','#CBF1E9',end.x,.30,end.z,.4,.44,.4);
        return;
      }
      const textured=this.levelId===0&&!!this.terrainTexture;`);
  s=sub(s,'  private attachTurtle(actor: Actor): void {','  private attachTurtle(actor: Actor): void {\n    if(this.painted){this.attachPaint(actor);return;}');
  s=sub(s,'  private attachEnemy(actor:Actor):void{','  private attachEnemy(actor:Actor):void{\n    if(this.painted){this.attachPaint(actor);return;}');
  s=sub(s,"this.units.set(pet.id,actor);\n        }else actor", "this.units.set(pet.id,actor);this.attachPaint(actor,'golem');\n        }else actor");
  s=sub(s,"    this.tickEffects(frame);\n    this.billboardBars();","    this.tickEffects(frame);\n    this.painted?.update(frame);\n    this.billboardBars();");
  s=sub(s,'    const rotation = this.camera.node.worldRotation;',`    const rotation = this.camera.node.worldRotation;
    if(this.painted)for(const actors of [this.units,this.enemies,this.retiringEnemies])for(const actor of actors.values())if(actor.paint)this.painted.face(actor.paint);`);
  s=sub(s,'    const scale = !actor.alive', '    const scale = !actor.alive');
  s=sub(s,'    actor.body.setScale(scale, scale, scale);',`    const pulse=actor.paint&&actor.actionTime>0?Math.sin(Math.min(1,actor.actionTime/.35)*Math.PI)*.055:0;
    actor.body.setScale(scale*(1-pulse),scale*(1+pulse),scale);
    if(actor.paint)actor.paint.setScale(actor.friendly?(Math.sin(actor.yaw*Math.PI/180)>0?1:-1):(Math.sin(actor.yaw*Math.PI/180)>0?-1:1),1,1);`);
  // VFX are timed by the same simulation events as damage. Windup never emits an impact.
  s=sub(s,"    if (event.type === 'attack' && source) {",`    if(this.painted){
      if(event.type==='attack'&&source&&event.effect!=='windup'){
        const from=this.point(source,.48),index=event.effect==='heal'?2:source.kind==='spike'?0:source.kind==='crystal'?1:source.kind==='bubble'?3:5;
        this.painted.flash(index,from,source.kind==='spike'?.72:.45,.22,destination);
      }else if(event.type==='damage'&&target&&(event.amount??0)>0)this.painted.flash(5,destination,event.critical?.62:.30,.19);
      else if(event.type==='heal')this.painted.flash(2,destination,.78,.48);
      else if(event.type==='shield')this.painted.flash(4,destination,.9,.48);
      else if(event.type==='skill'){
        const id=event.skillId,index=id==='crystalCannon'?1:id==='greatHeal'||id==='holyLight'?2:id==='bubbleRing'||id==='spirit'?3:id==='hold'?4:id==='piercingShot'?0:5;
        this.painted.flash(index,destination,index===1||index===3?2.1:1.45,.65,undefined,index===1||index===3);
      }
    }
    if (event.type === 'attack' && source) {`);
  s=sub(s,"      this.effect(melee ? 'beam' : 'bolt'", "      if(!this.painted)this.effect(melee ? 'beam' : 'bolt'");
  return s;
});
edit('GameEntry.ts',s=>sub(s,'world.setTerrainTexture?.(this.art?.battleTerrainTexture);','world.setTerrainTexture?.(this.art?.battleTerrainTexture);world.setBattleArt?.(this.art);'));
edit('BattleScreen.ts',s=>{
  s=sub(s,"    if(endless&&active)this.ui.text(frontNotice(r.levelId,r.wave+1),0,222,27,UI_COLORS.gold,this.ui.root,1100,42);",'');
  s=sub(s,"      this.ui.panel(0,254,960,36,this.ui.root,'#FFF9EC',244,22);\n      this.ui.text(endless?`${frontNotice(r.levelId,r.wave+1)} · 守住中心珍珠`:`${lane} · ${threat.name}　${threat.tip}`,0,254,21,UI_COLORS.ink,this.ui.root,1020,38);",'');
  s=sub(s,"    if(!endless)this.button('合成备战龟',-496,-40,216,64,()=>this.fusion(),{disabled:units.filter(u=>u.benchSlot!==undefined).length<2,size:24});",`    if(!endless)this.button('合成',-660,-294,130,64,()=>this.fusion(),{disabled:units.filter(u=>u.benchSlot!==undefined).length<2,size:24});
    if(!active){const threat=waveTactic(r.levelId,r.wave+1);this.button('下波情报',-660,-157,130,72,()=>{const p=this.ui.sheet('下一波 · '+threat.name,threat.tip,()=>p.parent?.destroy());this.ui.text('根据敌人的速度和抗性，选择站位与出战伙伴。',0,30,25,UI_COLORS.ink,p,800,90,true);},{size:22});}`);
  return s;
});
