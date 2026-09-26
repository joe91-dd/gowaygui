from pathlib import Path
import json,uuid,re
root=Path('game/assets/resources/art-modern');shared=Path('game/tools/companion-rig.glsl').read_text('utf8')
props=['rigRect','rigShape','rigParams','rigBody','rigAngles','rigHead','rigArmA','rigArmB','rigPivots','rigGear','rigGear2','rigGear3','rigEyes','rigEyeSize']
old=(root/'chroma-sprite.effect').read_text('utf8');vertex=old.split('CCProgram sprite-vs %{')[1].split('}%')[0]
worldVertex='''
 precision highp float;
 #include <builtin/uniforms/cc-global>
 #include <builtin/uniforms/cc-local>
 in vec3 a_position; in vec2 a_texCoord; out vec2 uv0;
 vec4 vert(){uv0=a_texCoord;return cc_matProj*cc_matView*cc_matWorld*vec4(a_position,1.0);}
'''
for world,name in [(False,'companion-surface'),(True,'companion-world')]:
 header='''CCEffect %{
 techniques:
 - passes:
   - vert: NAME-vs:vert
     frag: NAME-fs:frag
     rasterizerState: { cullMode: none }
     depthStencilState: { depthTest: DEPTH, depthWrite: false }
     blendState:
       targets:
       - blend: true
         blendSrc: src_alpha
         blendDst: one_minus_src_alpha
         blendDstAlpha: one_minus_src_alpha
     properties:
'''.replace('NAME',name).replace('DEPTH','true' if world else 'false')
 if world:header+='       mainTexture: { value: white }\n'
 for p in props:header+='       '+p+': { value: [0, 0, 0, 0] }\n'
 header+='}%\nCCProgram '+name+'-vs %{'+(worldVertex if world else vertex)+'}%\nCCProgram '+name+'-fs %{\nprecision highp float;\nin vec2 uv0;\n'
 if world:header+='uniform sampler2D mainTexture;\n#define SOURCE(p) texture(mainTexture,p)\n'
 else:header+='''#include <builtin/internal/embedded-alpha>
#pragma builtin(local)
layout(set = 2, binding = 12) uniform sampler2D cc_spriteTexture;
in vec4 color;
#define SOURCE(p) CCSampleWithAlphaSeparated(cc_spriteTexture,p)
'''
 tail='\nvec4 frag(){vec4 c=paintCompanion(uv0);'+('' if world else 'c*=color;')+'if(c.a<.008)discard;return c;}\n}%\n'
 (root/(name+'.effect')).write_text(header+shared+tail,'utf8')
 meta=json.loads((root/'chroma-sprite.effect.meta').read_text('utf8'));meta['uuid']=str(uuid.uuid4());(root/(name+'.effect.meta')).write_text(json.dumps(meta,indent=2),'utf8')
for name in ['CompanionRig','CompanionRigData']:
 p=Path('game/assets/scripts/view')/(name+'.ts.meta');m=json.loads(Path('game/assets/scripts/view/CompanionMotion.ts.meta').read_text('utf8'));m['uuid']=str(uuid.uuid4());p.write_text(json.dumps(m,indent=2),'utf8')
p=Path('game/assets/scripts/view/ArtV2Assets.ts');s=p.read_text('utf8');s=s.replace('  battleEffect?:EffectAsset;', '''  battleEffect?:EffectAsset;
  private companionEffect?:EffectAsset;private companionWorldEffect?:EffectAsset;
  companionMaterial(world=false):Material{const m=new Material();m.initialize({effectAsset:(world?this.companionWorldEffect:this.companionEffect)!,defines:world?{}:{USE_TEXTURE:true}});return m;}''')
s=s.replace("    });}catch(reason){this.error=String(reason);this.state='failed';}}", """    });}catch(reason){this.error=String(reason);this.state='failed';}}
    for(const [key,world] of [['companion-surface',false],['companion-world',true]] as const)resources.load('art-modern/'+key,EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'伙伴动态材质未载入';this.state='failed';return;}
      effect.addRef();if(world)this.companionWorldEffect=effect;else this.companionEffect=effect;this.finishLoading();
    });""")
s=s.replace('this.keyMaterial&&this.battleEffect&&this.state', 'this.keyMaterial&&this.battleEffect&&this.companionEffect&&this.companionWorldEffect&&this.state')
s=s.replace('    this.battleEffect?.decRef();', '    this.companionEffect?.decRef();this.companionWorldEffect?.decRef();this.companionEffect=undefined;this.companionWorldEffect=undefined;\n    this.battleEffect?.decRef();')
p.write_text(s,'utf8')
p=Path('game/assets/scripts/view/BattlePaint.ts');s=p.read_text('utf8');s="import {CompanionRig} from './CompanionRig';\n"+s
s=s.replace('  private time=0;','  private time=0;\n  private rigs=new Map<Node,{rig:CompanionRig;mesh:Mesh;role:Role}>();')
start=s.index('  equipmentGlow(');end=s.index('  boss(',start)
s=s[:start]+'''  equipmentGlow(parent:Node,role:Role):void{
    const row=poseRow(role)!,frame=this.art.battleFrame(`pose-${row.atlas}-${row.row}-0`)!,material=this.art.companionMaterial(true);
    material.setProperty('mainTexture',frame.texture);const mesh=this.poseMesh(role,0),rig=new CompanionRig(material,role,frame,true);
    const renderer=parent.getComponent(MeshRenderer)!;renderer.mesh=mesh;renderer.setSharedMaterial(material,0);this.rigs.set(parent,{rig,mesh,role});
  }
'''+s[end:]
s=s.replace("  pose(node:Node,kind:string,index:number):void{", """  pose(node:Node,kind:string,index:number):void{const entry=this.rigs.get(node);if(entry&&kind===entry.role){const r=node.getComponent(MeshRenderer)!;r.mesh=entry.mesh;r.setSharedMaterial(entry.rig.material,0);entry.rig.pose(index);return;}""")
s=s.replace('    this.time+=Math.min(.1,dt);', "    this.time+=Math.min(.1,dt);\n    for(const [node,entry] of this.rigs){if(!node.isValid){entry.rig.destroy();this.rigs.delete(node);}else entry.rig.update(dt);}")
s=s.replace('  destroy():void{this.clear();', '  destroy():void{this.clear();for(const entry of this.rigs.values())entry.rig.destroy();this.rigs.clear();')
p.write_text(s,'utf8')
