import bpy,sys,json,math,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;ID=sys.argv[sys.argv.index('--')+1];key=ID.lower();OUT=ROOT/'inspection'/ID
manifest=json.loads((ROOT/'production'/ID/'manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(ROOT/'production'/ID/f'{key}.fbx'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for tr in rig.animation_data.nla_tracks:tr.mute=True
actions={n:next((a for a in bpy.data.actions if (a.name.split('|')[-1]==n or a.name.endswith(n)) and any(fc.data_path.startswith('pose.bones') for fc in a.fcurves)),None) for n in manifest['clips']}
if any(a is None for a in actions.values()):raise RuntimeError('Missing FBX clip')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
gradePath=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui')/'game/assets/resources/enemy-g1/variants'/key/'blue.png'
gradeImage=bpy.data.images.load(str(gradePath)) if gradePath.exists() else None
for m in bpy.data.materials:
 if gradeImage and m.use_nodes and 'Atlas' in m.name:
  for node in m.node_tree.nodes:
   if node.type=='TEX_IMAGE':node.image=gradeImage
 elif 'Variant_Atlas' in m.name and m.use_nodes:
  p=m.node_tree.nodes.get('Principled BSDF')
  if p and p.inputs['Base Color'].is_linked:
   link=p.inputs['Base Color'].links[0];out=link.from_socket;m.node_tree.links.remove(link)
   mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.30,.67,.92,1)
   m.node_tree.links.new(out,mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
world=bpy.data.worlds.new('World');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.75,.85,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6;scene.world=world
for loc,energy,size in [((-3,-4,6),600,5),((4,-1,3),300,4),((0,4,5),400,3)]:
 d=bpy.data.lights.new('Area','AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new('Area',d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
m=bpy.data.materials.new('Floor');m.diffuse_color=(.6,.65,.66,1);bpy.context.object.data.materials.append(m)
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=max(2.7,max(manifest['dimensions'])*1.35)
cam.location=(3,-6,4);cam.rotation_euler=(Vector((0,0,.92))-cam.location).to_track_quat('-Z','Y').to_euler()
def vertices():
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 return np.concatenate([np.array([o.matrix_world@v.co for v in o.evaluated_get(dg).data.vertices]) for o in meshes])
evidence={}
for name,a in actions.items():
 rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];start,end=a.frame_range;scene.frame_set(round(start));base=vertices();deform=0;minimum=1e9
 for t in [.2,.4,.7,1]:
  scene.frame_set(round(start+(end-start)*t));p=vertices();deform=max(deform,float(np.linalg.norm(p-base,axis=1).max()));minimum=min(minimum,float(p[:,2].min()))
 evidence[name]={'vertices':len(base),'maxDisplacement':deform,'minZ':minimum,'seconds':float((end-start)/30)}
 if deform<.001:raise RuntimeError('FBX mesh does not deform: '+name)
 if name in (['idle'] if '--idle-only' in sys.argv else ['idle','walk','attack','skill','exit']) and '--verify-only' not in sys.argv:
  scene.frame_set(round(start+(end-start)*(.4 if name!='exit' else 1)));scene.render.filepath=str(OUT/f'runtime-{name}.png');bpy.ops.render.render(write_still=True)
(OUT/'fbx-verification.json').write_text(json.dumps({'id':ID,'fbxSha256':hashlib.sha256((ROOT/'production'/ID/f'{key}.fbx').read_bytes()).hexdigest(),'bones':len(rig.data.bones),'clips':evidence,'allClipsDeform':True},indent=2))
print('FBX_VERIFIED',ID,flush=True)
