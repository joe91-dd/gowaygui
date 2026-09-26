from pathlib import Path
import shutil
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');OUT=Path(__file__).resolve().parent
p=ROOT/'game/assets/scripts/view/G1BattleEffects.ts';bak=OUT/'code-before/view/G1BattleEffects.ts'
if not bak.exists():shutil.copy2(p,bak)
s=p.read_text('utf8')
s="import {enemyG1} from '../core/enemyG1Catalog';\n"+s
s=s.replace(" private readonly compact=softwareRendering();",""" private readonly compact=softwareRendering();
 private enemyLights:{model:Node;node:Node;material:Material;advanced:boolean;phase:number}[]=[];
 private enemyColour(key?:string):string{
  const id=enemyG1(key??'')?.id;
  return id==='H03'?'#FFAA54':id==='H02'||id==='B05'||id==='B10'?'#C79CEB':id==='B04'||id==='B02'?'#AADD8F':id==='H04'||id==='M04'?'#A9E9FF':'#7DDAE8';
 }
 attachEnemy(model:Node,key:string):void{
  if(this.enemyLights.some(e=>e.model===model))return;
  const asset=enemyG1(key);if(!asset||asset.kind!=='boss'&&asset.id!=='M04')return;
  if(asset.id==='M04'&&this.enemyLights.filter(e=>!e.advanced).length>12)return;
  const core=find(model,'FX_Enemy_Core');if(!core)return;
  const glow=this.sprite(core,asset.id==='H03'?'flame_01':'light_02',this.enemyColour(key));
  this.enemyLights.push({model,...glow,advanced:asset.id.startsWith('H'),phase:this.enemyLights.length*1.63});
 }
""")
s=s.replace("enemyAttack(from:Vec3,to:Vec3,ranged:boolean,boss:boolean):void{","enemyAttack(from:Vec3,to:Vec3,ranged:boolean,boss:boolean,key?:string,model?:Node):void{\n  const mouth=model?find(model,'FX_Enemy_Mouth'):undefined;if(mouth?.isValid)from=mouth.worldPosition.clone();")
s=s.replace("this.mote(from,to,'#CEB2EF'","this.mote(from,to,this.enemyColour(key)")
s=s.replace("bossCast(kind:string,at:Vec3,source:Vec3):void{","""bossCast(kind:string,at:Vec3,source:Vec3,key?:string):void{
  if(enemyG1(key??'')?.id==='H03'){
   for(let i=0;i<(this.compact?5:8);i++){const a=i*2.399,p=new Vec3(at.x+Math.cos(a)*1.4,.1,at.z+Math.sin(a)*1.4);this.mote(at,p,'#FFA461',.26,.48,'flame_01',false,i*.018,.5);}
  }
""")
s=s.replace("  this.time+=dt;","""  this.time+=dt;
  for(let i=this.enemyLights.length-1;i>=0;i--){
   const e=this.enemyLights[i];
   if(!e.model.isValid||!e.node.isValid){e.material.destroy();this.enemyLights.splice(i,1);continue;}
   if(!e.model.activeInHierarchy)continue;
   const pulse=.5+.5*Math.sin(this.time*1.8+e.phase),size=(e.advanced?.26:.14)*(1+pulse*.22);
   e.node.setWorldScale(size,size,size);e.node.setWorldRotation(this.camera.node.worldRotation);
   e.material.setProperty('motion',new Vec4(this.time,(e.advanced?.24:.12)+pulse*.09,0,0));
  }
""")
s=s.replace(" destroy():void{"," destroy():void{\n  for(const e of this.enemyLights){if(e.node.isValid)e.node.destroy();e.material.destroy();}this.enemyLights=[];")
p.write_text(s,'utf8')
p=ROOT/'game/assets/scripts/view/BattleWorld.ts';s=p.read_text('utf8')
s=s.replace("      for(const actor of this.units.values())if(actor.model)this.g1Effects.attach(actor.model,actor.kind as Role);","      for(const actor of this.units.values())if(actor.model)this.g1Effects.attach(actor.model,actor.kind as Role);\n      for(const actor of this.enemies.values())if(actor.model&&actor.variant)this.g1Effects.attachEnemy(actor.model,actor.variant);")
s=s.replace("    actor.model=model;actor.animations=prepareBattleRig(model);","    actor.model=model;actor.animations=prepareBattleRig(model);\n    if(actor.variant)this.g1Effects?.attachEnemy(model,actor.variant);")
s=s.replace("['snail','mist'].includes(source.kind),source.kind==='boss');","['snail','mist'].includes(source.kind)||['B05','B09','B10','H02'].includes(enemyG1(source.variant??'')?.id??''),source.kind==='boss',source.variant,source.model);")
s=s.replace("source?this.point(source,1.1):destination);","source?this.point(source,1.1):destination,source?.variant);")
p.write_text(s,'utf8');print('Enemy emissive regions, socket lights and identity attacks integrated.')

