const fs=require('fs'),base='game/assets/scripts/';function edit(p,f){let s=fs.readFileSync(base+p,'utf8');fs.writeFileSync(base+p,f(s));}function rep(s,a,b){if(!s.includes(a))throw Error('missing '+a.slice(0,100));return s.replace(a,b);}
edit('view/BattlePaint.ts',s=>{
 s=s.replace('  private time=0;', '  private time=0;\n  private soulMaterials=new Set<Material>();\n  private enemyMaterials=new Map<Node,Material>();');
 s=s.replace("  boss(node:Node,index:number):void",`  soulRing(parent:Node):Node{
    const f=this.art.battleFrame('water-surface')!,m=new Material();m.initialize({effectAsset:this.art.battleEffect!});m.setProperty('mainColor',new Color('#39A873'));m.setProperty('keyParams',new Vec4(6,0,0,0));this.soulMaterials.add(m);
    const n=this.node('贴地品质魂环',parent,this.quad('soul-ring',f,1.35,true),m);n.setRotationFromEuler(-90,0,0);n.setPosition(0,.014,0);return n;
  }
  soulColor(n:Node,hex:string):void{n.getComponent(MeshRenderer)?.getSharedMaterial(0)?.setProperty('mainColor',new Color(hex));}
  animateEnemy(n:Node,moving:boolean,phase:number,pace:number):void{
    const r=n.getComponent(MeshRenderer)!;let m=this.enemyMaterials.get(n);if(!m){m=new Material();m.initialize({effectAsset:this.art.battleEffect!});m.setProperty('mainColor',Color.WHITE);this.enemyMaterials.set(n,m);}
    const source=r.getSharedMaterial(0)!;if(source!==m)m.setProperty('mainTexture',source.getProperty('mainTexture'));
    m.setProperty('keyParams',new Vec4(7,moving?1:0,phase*pace,0));r.setSharedMaterial(m,0);for(const pass of m.passes)pass.update();
  }
  private grid(x:number,y:number,w:number,h:number,u:number,v:number,du:number,dv:number):Mesh{
    const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],count=8;
    for(let row=0;row<=count;row++)for(let col=0;col<=count;col++){positions.push(x+w*col/count,y+h*row/count,0);normals.push(0,0,1);uvs.push(u+du*col/count,v+dv*(1-row/count));}
    for(let row=0;row<count;row++)for(let col=0;col<count;col++){const a=row*(count+1)+col,b=a+count+1;indices.push(a,a+1,b,b,a+1,b+1);}return utils.createMesh({positions,normals,uvs,indices});
  }
  boss(node:Node,index:number):void`);
 s=s.replace('mesh=utils.createMesh({positions:[-w/2,base,0,w/2,base,0,-w/2,base+height,0,w/2,base+height,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[u,v+dv,u+du,v+dv,u,v,u+du,v],indices:[0,1,2,2,1,3]});','mesh=this.grid(-w/2,base,w,height,u,v,du,dv);');
 s=s.replace('const mesh=utils.createMesh({positions:[x,y,0,r,y,0,x,t,0,r,t,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[sx/tw,(sy+h)/th,(sx+w)/tw,(sy+h)/th,sx/tw,sy/th,(sx+w)/tw,sy/th],indices:[0,1,2,2,1,3]});','const mesh=this.grid(x,y,r-x,t-y,sx/tw,sy/th,w/tw,h/th);');
 const a=s.indexOf('    const points:{x:number;z:number}[]=[];'),b=s.indexOf('    this.guard(parent,level);',a);
 if(a<0||b<0)throw Error('map props');s=s.slice(0,a)+`    for(const [i,p] of mapProps(level).entries()){
      const {tile,height}=p,f=this.art.battleFrame('island-props-'+tile)!;
      const n=this.node('主题景物:'+tile,parent,this.quad('prop-'+tile+'-'+height,f,height),this.material('props',f,1));n.setPosition(p.x,.025,p.z);this.face(n);
      const shade=this.node('景物落地阴影',parent,this.quad('prop-shadow',ocean,.65,true),this.material('prop-shadow',ocean,3));shade.setPosition(p.x+.08,.017,p.z+.1);shade.setRotationFromEuler(-90,0,0);
      this.ambient.push({node:n,phase:i*1.9,kind:'plant',x:p.x,z:p.z});
    }
`+s.slice(b);
 s=s.replace('    this.time+=Math.min(.1,dt);',`    this.time+=Math.min(.1,dt);
    for(const m of this.soulMaterials){m.setProperty('keyParams',new Vec4(6,0,this.time,0));for(const p of m.passes)p.update();}
    for(const [n,m] of this.enemyMaterials)if(!n.isValid){m.destroy();this.enemyMaterials.delete(n);}
`);
 s=s.replace("1+Math.sin(t*1.3)*.018,1+Math.cos(t*1.1)*.014","1+Math.sin(t*1.3)*.032,1+Math.cos(t*1.1)*.018");
 s=s.replace('destroy():void{this.clear();','destroy():void{this.clear();for(const m of this.soulMaterials)m.destroy();this.soulMaterials.clear();for(const m of this.enemyMaterials.values())m.destroy();this.enemyMaterials.clear();');
 return s;
});
edit('view/BattleWorld.ts',s=>{
 s=s.replace("this.surface('伙伴品质魂环',actor.node,'rangeRing','#39A873',0,.003,0,.90,1,.90)","this.painted.soulRing(actor.node)");
 s=s.replace('actor.qualityRing.getComponent(MeshRenderer)!.setSharedMaterial(this.material(turtleQuality(unit.turtle).color),0);','this.painted?.soulColor(actor.qualityRing,turtleQuality(unit.turtle).color);');
 s=s.replace('actor.qualityRing.getComponent(MeshRenderer)!.setSharedMaterial(this.material(QUALITY_COLORS[unit.qualityTier]??QUALITY_COLORS[0]),0);','this.painted?.soulColor(actor.qualityRing,QUALITY_COLORS[unit.qualityTier]??QUALITY_COLORS[0]);');
 s=s.replaceAll('actor.qualityRing.setRotationFromEuler(0,actor.phase*14,0)','actor.qualityRing.setRotationFromEuler(-90,0,0)').replaceAll('actor.qualityRing.setRotationFromEuler(0,actor.phase*18,0)','actor.qualityRing.setRotationFromEuler(-90,0,0)');
 s=s.replace('      if(!actor.alive&&!actor.node.active)',"      if(actor.paint)this.painted?.animateEnemy(actor.paint,actor.moving&&actor.alive&&!enemy.statuses.some(s=>s.kind==='stun'||s.kind==='sheep'),actor.phase,enemy.kind==='boss'?4.2:enemy.kind==='runner'?13:8);\n      if(!actor.alive&&!actor.node.active)");
 s=s.replace("      if(event.effect==='dashTell')",`      if(event.effect?.startsWith('bossTell-')){this.painted.storm(destination,event.effect==='bossTell-drain'?5.2:3,1.35,4);if(source)source.actionTime=1.35;}
      if(event.effect?.startsWith('boss-'))this.painted.storm(destination,event.effect==='boss-drain'?5.2:3,.75,event.effect==='boss-frost'?2:5);
      if(event.effect==='castInterrupted')this.painted.storm(destination,.8,.4,2);
      if(event.effect==='dashTell')`);
 s=s.replace("else if(event.effect==='shatter')", "else if(event.skillId==='crystalCannon'&&!continuing)this.painted.storm(destination,3,source&&'skills' in source?5:4,6);\n        else if(event.skillId==='spirit'&&event.effect==='landing')this.painted.storm(destination,3,.7,5);\n        else if(['counterStorm','reflect'].includes(event.skillId??''))this.painted.storm(destination,2.7,.7,0);\n        else if(['greatHeal','holyLight','leafMastery','rebirth'].includes(event.skillId??''))this.painted.storm(destination,2,.85,3);\n        else if(event.effect==='shatter')");
 return s;
});
let p='game/assets/resources/art-modern/battle-paint.effect',s=fs.readFileSync(p,'utf8');
s=s.replace('  out vec2 uv;','  out vec2 uv;\n  uniform PaintParams { vec4 mainColor; vec4 keyParams; };');
s=s.replace('    return cc_matProj * cc_matView * cc_matWorld * vec4(a_position, 1.0);',`    vec3 pos=a_position;
    if(keyParams.x>6.5){
      float stride=keyParams.z,side=pos.x<0.0?-1.0:1.0,step=sin(stride+side*1.5708)*keyParams.y;
      float leg=1.0-smoothstep(.05,.50,max(0.0,pos.y));
      pos.x+=step*.055*leg;pos.y+=max(0.0,step)*.075*leg;
      pos.x+=sin(stride)*.020*smoothstep(.1,1.3,pos.y)*keyParams.y;
      pos.y-=abs(sin(stride))*.018*smoothstep(.2,.65,pos.y)*keyParams.y;
    }
    return cc_matProj * cc_matView * cc_matWorld * vec4(pos, 1.0);`);
s=s.replace('    if(keyParams.x>4.5){',`    if(keyParams.x>5.5&&keyParams.x<6.5){
      vec2 p=(uv-.5)*2.0;float r=length(p),a=atan(p.y,p.x),t=keyParams.z;
      float outer=exp(-pow((r-.80)/.024,2.0)),inner=exp(-pow((r-.62)/.013,2.0));
      float runes=pow(.5+.5*cos(a*12.0-t*.7),18.0)*exp(-pow((r-.71)/.062,2.0));
      float stream=pow(.5+.5*cos(a*2.0-t*1.7),9.0)*exp(-pow((r-.80)/.06,2.0));
      float light=(outer*.46+inner*.28+runes*.56+stream*.60)*(.82+.18*sin(t*2.0));
      float alpha=clamp(light,0.0,.86);if(alpha<.02)discard;
      return vec4(mix(mainColor.rgb,vec3(1.0,.98,.80),stream*.65),alpha);
    }
    if(keyParams.x>4.5&&keyParams.x<5.5){`);
s=s.replace('      if(style<.5){',`      if(style>5.5){
        float curl=pow(.5+.5*cos(a*3.0+r*10.0-t*5.0),25.0)*exp(-pow((r-.55)/.35,2.0));
        rgb=vec3(.20,.68,.92)*curl;alpha=curl*.6;
        for(int i=0;i<20;i++){float f=float(i),v=fract(t*.7+f*.051);vec2 center=vec2(sin(f*2.39),cos(f*3.17))*.72;vec2 q=p-center-vec2(-.08,-.36)*(1.0-v);float crystal=(1.0-smoothstep(.018,.032,abs(q.x)+abs(q.y)*.45))*sin(v*3.14159);rgb+=vec3(.77,.96,1.0)*crystal;alpha=max(alpha,crystal);}
      }else if(style>4.5){float wave=exp(-pow((r-keyParams.w*.95)/.055,2.0));float spokes=pow(.5+.5*cos(a*8.0+r*4.0),24.0)*(1.0-smoothstep(.1,.8,r));rgb=vec3(.97,.67,.33)*(wave+spokes*.7);alpha=max(wave*.7,spokes*.7);
      }else if(style>3.5){float edge=exp(-pow((r-.94)/.018,2.0)),sweep=step(r,keyParams.w*.92)*.12,marks=pow(.5+.5*cos(a*12.0),8.0)*exp(-pow((r-.86)/.04,2.0));rgb=vec3(1.0,.36,.18);alpha=max(edge*.8,marks*.5)+sweep;fade=1.0;
      }else if(style<.5){`);
s=s.replace('if (keyParams.x > 3.5) return','if (keyParams.x > 3.5&&keyParams.x<4.5) return').replace('if (keyParams.x > 2.5) {','if (keyParams.x > 2.5&&keyParams.x<3.5) {').replace('if (keyParams.x > 1.5) {','if (keyParams.x > 1.5&&keyParams.x<2.5) {');fs.writeFileSync(p,s);
p='game/tools/companion-rig.glsl';s=fs.readFileSync(p,'utf8');s=s.replace('growth=.5-.5*cos(t*1.12)','growth=.68-.32*cos(t*1.12)').replace('sin(u*25.0)*.011','sin(u*25.0-t*.38)*.014').replace('smoothstep(.002,.0048,distanceToStem)','smoothstep(.003,.0065,distanceToStem)').replace('vec3(.12,.39,.12),vine*.9','vec3(.07,.37,.18),vine').replace('distanceToStem/.0055','distanceToStem/.0075').replace('(.26+breath*.20)','(.38+breath*.48)').replace('for(int i=0;i<6;i++){','for(int i=0;i<8;i++){').replace('float v=.1+float(i)*.155','float v=.07+float(i)*.12').replace('sin(v*25.0)*.011','sin(v*25.0-t*.38)*.014').replace('dot(d,leafAxis)/.029','dot(d,leafAxis)/(.050+.009*sin(t+v*9.0))').replace('leafAxis.x))/.011','leafAxis.x))/.017').replace('vec3(.26,.61,.14),blade','vec3(.18,.64,.27)*(1.0+along*.22),blade').replace('blade*(.18+breath*.28)','blade*(.28+breath*.50)');
s=s.replace('          pigment(c,vec3(.18',`          float vein=exp(-crosswise*crosswise*130.0)*blade;
          light(emission,glowAlpha,vec3(.82,1.0,.37),vein*(.35+breath*.42));
          vec2 tip=anchor+leafAxis*.050;
          float sparkle=softPoint(at,tip,vec2(.0035,.006))*pow(.5+.5*sin(t*2.1+v*13.0),5.0)*smoothstep(v,v+.1,growth);
          light(emission,glowAlpha,vec3(.82,1.0,.51),sparkle*.9);
          pigment(c,vec3(.18`);fs.writeFileSync(p,s);
