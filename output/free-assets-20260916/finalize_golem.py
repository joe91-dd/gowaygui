"""Make the adapted stone palette portable to both FBX and glTF exports."""
import bpy, json, struct
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent
out=root/'production'/'golem'
manifest=json.loads((out/'manifest.json').read_text('utf8'))
raw=Path(manifest['path']).read_bytes()
original=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
palette=sorted(original['materials'],key=lambda m:m['name'])
bpy.ops.wm.open_mainfile(filepath=str(out/'golem.blend'),load_ui=False)
converted={}
for mat in bpy.data.materials:
 if not mat.use_nodes: continue
 tree=mat.node_tree
 for bsdf in [n for n in tree.nodes if n.type=='BSDF_PRINCIPLED']:
  tex=next((n for n in tree.nodes if n.type=='TEX_IMAGE' and n.image),None)
  if tex:
   source=tex.image
   if source.name not in converted:
    target=source.copy();target.name='Golem_stone_palette'
    rgba=np.array(source.pixels[:],dtype=np.float32).reshape((-1,4))
    luminance=rgba[:,:3]@np.array([.2126,.7152,.0722],dtype=np.float32)
    # Preserve palette shading and dark facial details; replace green skin hues.
    rgba[:,:3]=np.clip(luminance[:,None]*np.array([.70,.87,.95])[None,:],0,1)
    target.pixels.foreach_set(rgba.reshape(-1));target.update()
    target.filepath_raw=str(out/'golem_stone_palette.png');target.file_format='PNG';target.save();target.pack()
    converted[source.name]=target
   tex.image=converted[source.name]
   tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
  else:
   for link in list(bsdf.inputs['Base Color'].links):tree.links.remove(link)
   source=palette[int(mat.name.rsplit('_',1)[1])]['pbrMetallicRoughness']['baseColorFactor']
   lum=source[0]*.2126+source[1]*.7152+source[2]*.0722
   bsdf.inputs['Base Color'].default_value=(lum*.70,lum*.87,lum*.95,1)
  bsdf.inputs['Metallic'].default_value=0
  bsdf.inputs['Roughness'].default_value=.88
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
for rig in rigs:
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=False
bpy.context.scene.frame_set(0);bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out/'golem.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_animations=True)
bpy.ops.export_scene.fbx(filepath=str(out/'golem.fbx'),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0)
for rig in rigs:
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.animation_data.action=bpy.data.actions.get('idle')
bpy.context.scene.frame_set(0);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'golem.blend'))
m=json.loads((out/'manifest.json').read_text('utf8'))
m['changes']=[c for c in m['changes'] if not c.startswith('Stone palette baked')]
m['changes'].append('Portable blue-grey stone palette preserves each source material light/dark value')
(out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
print('GOLEM_PORTABLE_PALETTE',len(converted),flush=True)
