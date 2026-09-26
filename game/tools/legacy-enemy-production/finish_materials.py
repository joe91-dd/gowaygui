"""Prepare editable mutation and emissive material regions on verified runtime UVs."""
import bpy,json,sys,shutil,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parent;ID=sys.argv[sys.argv.index('--')+1];key=ID.lower();OUT=ROOT/'production'/ID
base=OUT/f'{key}.base.blend'
if not base.exists():shutil.copy2(OUT/f'{key}.blend',base)
bpy.ops.wm.open_mainfile(filepath=str(base))
body=next(o for o in bpy.data.objects if o.type=='MESH');rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
if any('Variant' in m.name for m in body.data.materials):raise RuntimeError('Materials already finished; rebuild base before repeating')
source=body.data.materials[0];image=next(n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE')
pixels=np.empty(len(image.pixels),np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(image.size[1],image.size[0],4)
uv=np.array([d.uv[:] for d in body.data.uv_layers.active.data]);starts=np.array([p.loop_start for p in body.data.polygons]);centers=np.array([p.center[:] for p in body.data.polygons])
u=(uv[starts]+uv[starts+1]+uv[starts+2])/3
rgb=pixels[(u[:,1]*image.size[1]).astype(int).clip(0,image.size[1]-1),(u[:,0]*image.size[0]).astype(int).clip(0,image.size[0]-1),:3]
r,g,b=rgb.T;x,y,z=centers.T;W=max(abs(x));D=max(abs(y))
hue={'B01':'red','B02':'green','B03':'cyan','B04':'green','B05':'purple','B06':'stone','B07':'green','B08':'cyan','B09':'cyan','B10':'purple','E01':'cyan','H01':'cyan','H02':'purple','H03':'red','H04':'cyan'}.get(ID,'none')
match={'red':(r>g*1.6)&(r>b*1.5),'green':(g>r*1.25)&(g>b*1.15),'cyan':(b>r*1.35)&(g>r*1.15),'purple':(b>g*1.35)&(r>g*1.12),'stone':(abs(r-g)<.12)&(abs(b-g)<.12),'none':np.zeros(len(r),bool)}[hue]
match&=rgb.max(1)>.13
# Preserve face, eyes, ivory trim and mouth shapes in all mutation tiers.
face=(abs(x)<W*.28)&(y<-D*.24)&(z>.55)&(z<1.62)
variant=match&~face
glow=match&(z>1.58)&~face
if ID=='H03':glow=match&(rgb.max(1)>.35)&~face
if ID.startswith('M'):variant[:]=False;glow[:]=False
advanced=ID.startswith('H')
materials={}
if not advanced and np.count_nonzero(variant)>15:
 neutral=pixels.copy();v=np.clip(pixels[:,:,:3].max(2)*.9+.08,0,1);neutral[:,:,:3]=v[:,:,None]
 atlas=bpy.data.images.new(key+'_mutation',width=image.size[0],height=image.size[1],alpha=True)
 atlas.pixels.foreach_set(neutral.ravel());atlas.filepath_raw=str(OUT/f'{key}_mutation.png');atlas.file_format='PNG';atlas.save();atlas.pack()
 m=source.copy();m.name='G1_'+key+'_Variant_Atlas'
 node=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE');node.image=atlas
 idx=len(body.data.materials);body.data.materials.append(m)
 for p,yes in zip(body.data.polygons,variant):
  if yes:p.material_index=idx
 materials['variantPolygons']=int(variant.sum())
if np.count_nonzero(glow)>8:
 m=source.copy();m.name='G1_'+key+'_Glow_Atlas';bsdf=m.node_tree.nodes.get('Principled BSDF')
 colour={'red':(1,.23,.06,1),'cyan':(.15,.7,1,1),'purple':(.55,.23,1,1),'green':(.3,.8,.3,1),'stone':(1,.7,.18,1)}.get(hue,(.2,.5,1,1))
 bsdf.inputs['Emission Color'].default_value=colour;bsdf.inputs['Emission Strength'].default_value=.22;bsdf.inputs['Roughness'].default_value=.38
 idx=len(body.data.materials);body.data.materials.append(m)
 for p,yes in zip(body.data.polygons,glow):
  if yes:p.material_index=idx
 materials['glowPolygons']=int(glow.sum())
# Native FBX material color is used as a default. Runtime applies the five approved grades.
for m in body.data.materials:
 if 'Variant' in m.name:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.30,.67,.92,1)
rig.animation_data.action=None
for name,point in [('FX_Enemy_Core',(0,0,1.6)),('FX_Enemy_Mouth',(0,-D*.8,.95))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=point
 bpy.context.view_layer.update();matrix=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone='body';bpy.context.view_layer.update();o.matrix_world=matrix
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o in bpy.data.objects:
 if o.name.startswith('FX_Enemy_'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/f'{key}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/f'{key}.fbx'),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{key}.blend'))
report=json.loads((OUT/'manifest.json').read_text());report['materialRegions']=materials
(OUT/'manifest.json').write_text(json.dumps(report,indent=2));print('MATERIALS_FINISHED',ID,materials)
