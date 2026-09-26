from pathlib import Path
p=Path('game/assets/scripts/view/SkeletalReviewScreen.ts');s=p.read_text(encoding='utf8')
s=s.replace("import {IslandUI}","import {SculptedEnergy} from './SculptedEnergy';\nimport {IslandUI}")
s=s.replace("alive:boolean;hp:Node","alive:boolean;attackIndex:number;hp:Node")
s=s.replace("'rock'|'snow'|'ripple'","'rock'|'snow'|'ripple'|'slash'")
s=s.replace("private tide:Node[]=[];","private tide:Node[]=[];private energy?:SculptedEnergy;private energyAsset?:EffectAsset;private combo=false;private comboClock=0;")
s=s.replace("this.oceanEffect.addRef();this.environment();", "this.oceanEffect.addRef();this.energyAsset=await new Promise<EffectAsset>((resolve,reject)=>resources.load('models-sculpted/review-energy',EffectAsset,(err,e)=>err?reject(err):resolve(e!)));this.energyAsset.addRef();this.energy=new SculptedEnergy(this.energyAsset);this.environment();")
s=s.replace("clip.name.endsWith('|walk')?", "clip.name.endsWith('|walk')||clip.name.endsWith('|skill_loop')?")
s=s.replace("remaining:0,alive:true,hp,bar", "remaining:0,alive:true,attackIndex:0,hp,bar")
s=s.replace("const wave=this.node('骨骼挂点潮浪',joint);this.ribbon(wave,'#6BCEDA',.35);wave.setWorldScale(.45,.45,.45);", "const wave=this.energy!.arc(joint,'#43B6DE','weapon');wave.setWorldScale(1,1,1);")
s=s.replace("private reset(mode:'pose'|'combat'):void{for", "private reset(mode:'pose'|'combat'):void{this.combo=false;this.comboClock=0;this.weaponWaves.forEach(n=>this.energy?.release(n));for")
s=s.replace("this.effects.forEach(e=>e.nodes.forEach(n=>n.destroy()))", "this.effects.forEach(e=>e.nodes.forEach(n=>this.energy!.release(n)))")
s=s.replace("['普攻',()=>this.demoAttack()]", "[this.combo?'停止连招':'连招展示',()=>{if(this.mode==='combat'){this.hint!.string='战斗中的连招随普攻自动演出';return;}this.combo=!this.combo;this.comboClock=0;this.render();},this.combo]")
s=s.replace("private turn(degrees:number):void{const", "private turn(degrees:number):void{this.combo=false;const")
start=s.index(' private demoAttack():void{');end=s.index(' private cast(',start)
s=s[:start]+''' private strike(a:Actor):void{const name=a.kind==='crab'?'attack':['attack','attack_alt','attack_heavy'][a.attackIndex++%3];this.play(a,name,.62);}
 private demoAttack():void{const a=this.actors.get(this.selected);if(!a)return;if(this.mode==='combat')return;this.strike(a);const p=a.root.position,r=a.yaw*Math.PI/180,target=new Vec3(p.x+Math.sin(r)*1.1,.65,p.z+Math.cos(r)*1.1);if(a.kind==='crystal'){this.fx('bolt',a.tip?.worldPosition??new Vec3(p.x,1.4,p.z),.30,a.id,target);}else this.fx('slash',new Vec3(p.x,.65,p.z),.38,a.kind,target);this.effects.push({nodes:[],kind:'burst',age:-.30,life:.7,point:target,owner:a.kind});}
'''+s[end:]
s=s.replace("this.selected=id;if(this.mode==='pose')", "this.selected=id;this.combo=false;if(this.mode==='pose')")
start=s.index(" private fx(kind:");end=s.index(' private events(',start)
s=s[:start]+''' private fx(kind:FX['kind'],point:Vec3,life:number,owner?:string,target?:Vec3):void{
  const f:FX={nodes:[],kind,point:point.clone(),age:0,life,owner,target:target?.clone()};
  const count=kind==='rock'?14:kind==='snow'?36:kind==='burst'?9:kind==='slash'?0:kind==='bolt'?4:3;
  for(let i=0;i<count;i++){const n=this.shape('三维技能 '+kind,this.root,kind==='rock'?'rock':kind==='snow'||kind==='burst'?'cone':'sphere',kind==='rock'?(i%4?'#64717C':'#399ABF'):kind==='burst'?(owner==='stone'?'#D3B681':'#B9E9F3'):(i%3?'#7ACCE9':'#E3F8FB'),[point.x,point.y,point.z],[.1,.1,.1],kind==='rock'?(i%4?0:.25):.55,kind==='rock'?255:175);f.nodes.push(n);}
  if(kind==='rock'||kind==='snow'||kind==='slash'){
   const arcs=kind==='slash'?1:kind==='rock'?4:3;
   for(let j=0;j<arcs;j++){const n=this.energy!.arc(this.root,kind==='rock'?'#329EC6':kind==='slash'?'#C9DDE4':'#74C5EB',kind==='snow'?'frost':'wind');n.name='stream-'+j;f.nodes.push(n);}
   if(kind!=='slash')for(let j=0;j<2;j++){const n=this.energy!.arc(this.root,kind==='rock'?'#CFB991':'#91D9F1','ground');n.name='ground-flash-'+j;f.nodes.push(n);}
  }
  this.effects.push(f);
 }
'''+s[end:]
s=s.replace("if(e.effect==='windup'||a.kind==='crab')this.play(a,'attack',.62);", "if((e.effect==='windup'||a.kind==='crab')&&!this.effects.some(f=>f.kind==='rock'&&f.owner===a.id))this.strike(a);if(e.effect==='stone'&&target)this.fx('slash',new Vec3(a.root.position.x,.65,a.root.position.z),.28,'stone',target.root.position);")
start=s.index("  if(e.type==='damage'&&target)");end=s.index("  if(e.type==='skill'&&a)",start)
s=s[:start]+"  if(e.type==='damage'&&target){this.fx('burst',new Vec3(target.root.position.x,.52,target.root.position.z),.26,a?.kind);if(target.kind==='crab'&&target.remaining<.1)this.play(target,'hit',.23);}\n"+s[end:]
s=s.replace("this.time+=dt;", "this.time+=dt;if(this.mode==='pose'&&this.combo){this.comboClock-=dt;if(this.comboClock<=0){this.demoAttack();this.comboClock=1.0;}}")
s=s.replace("   else if(a.remaining===0)this.play(a,'idle');", "   else if(a.remaining===0&&!this.effects.some(f=>f.kind==='rock'&&f.owner===a.id))this.play(a,'idle');")
start=s.index("   const storm=this.effects.find");end=s.index("   a.bar.setWorldRotation",start)
s=s[:start]+'''   const storm=this.effects.find(f=>f.kind==='rock'&&f.owner===a.id);
   if(storm){const action=storm.age<.32?'skill_start':storm.age>storm.life-.42?'skill_end':'skill_loop';if(a.action!==action)this.play(a,action,action==='skill_start'?.32:action==='skill_end'?.42:0);}
   const phase=storm?Math.max(0,Math.min(1,(storm.age-.30)/(storm.life-.65))):0;const spin=storm?1080*(phase-Math.sin(phase*2*Math.PI)/(2*Math.PI)):0;a.body.setRotationFromEuler(0,a.yaw+spin,0);
'''+s[end:]
s=s.replace("f.nodes.forEach(n=>n.destroy());", "f.nodes.forEach(n=>this.energy!.release(n));")
start=s.index("if(n.name.startsWith('wind-volume'))");end=s.index("   if(f.kind==='rock'){",start)
s=s[:start]+'''if(n.name.startsWith('stream-')){const j=Number(n.name.slice(-1)),rock=f.kind==='rock',slash=f.kind==='slash';const radius=slash?1.05:rock?1.12+j*.21:1.45+j*.16;
     n.setPosition(f.point.x,f.point.y+(slash?.07:rock?.17+j*.22:.3+j*.44),f.point.z);
     const direction=slash&&f.target?Math.atan2(f.target.x-f.point.x,f.target.z-f.point.z)*180/Math.PI-135:0;
     n.setRotationFromEuler(slash?-15:j*5-8,direction+f.age*(slash?360:rock?430:95)+j*133,slash?18:j*7-6);n.setScale(radius,radius,radius);
     this.energy!.animate(n,f.age,fade*(slash?.8:rock?.55:.42));return;
    }
    if(n.name.startsWith('ground-flash')){const j=Number(n.name.slice(-1)),rock=f.kind==='rock',pulse=rock?Math.max(0,1-f.age/ .65):fade*.24;const size=rock?.4+Math.min(f.age/.65,1)*1.6:1.6+j*.10;n.setPosition(f.point.x,.145+j*.005,f.point.z);n.setScale(size,1,size);n.setRotationFromEuler(0,120*j+f.age*16,0);this.energy!.animate(n,f.age,pulse*.7);return;}
'''+s[end:]
s=s.replace("const r=1.05+(i%3)*.38;", "const r=1.03+(i%3)*.30+Math.sin(f.age*3+i)*.10;")
s=s.replace("const r=f.age*2.2,s=(1-t)*.095;n.setPosition(f.point.x+Math.cos(a)*r,f.point.y+Math.sin(i*2.6)*r+.15,f.point.z+Math.sin(a)*r);n.setScale(s,s,s);", "const r=f.age*3.6,s=(1-t)*.045;n.setPosition(f.point.x+Math.cos(a)*r,f.point.y+Math.sin(i*2.6)*r+.15,f.point.z+Math.sin(a)*r);n.setScale(s,(1-t)*.21,s);n.setRotationFromEuler(i*43,a*29,i*63);")
s=s.replace("this.weaponWaves.forEach((n,i)=>{n.setRotationFromEuler(15,this.time*95,15);const s=.4+.16*(.5+.5*Math.sin(this.time*1.5));n.setWorldScale(s,s,s);});", "this.weaponWaves.forEach((n,i)=>{n.setRotationFromEuler(75,this.time*65,15);const pulse=.5+.5*Math.sin(this.time*2.4),s=.8+pulse*.45;n.setWorldScale(s,s,s);this.energy!.animate(n,this.time,.35+pulse*.4);});")
s=s.replace("this.oceanEffect?.decRef();", "this.oceanEffect?.decRef();this.energy?.destroy();this.energyAsset?.decRef();")
p.write_text(s,encoding='utf8')
