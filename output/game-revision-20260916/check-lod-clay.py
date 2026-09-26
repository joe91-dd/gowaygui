import bpy
from pathlib import Path
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui')
out=ROOT/'output/game-revision-20260916/battle-lod/shange'
bpy.ops.wm.open_mainfile(filepath=str(out/'shange.blend'),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.data.pose_position='REST'
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for o in bpy.data.objects:
 if o.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 for p in o.data.polygons:p.use_smooth=True
mat=bpy.data.materials.new('Clay');mat.diffuse_color=(.7,.7,.7,1)
for o in bpy.data.objects:
 if o.type=='MESH':o.data.materials.clear();o.data.materials.append(mat)
scene=bpy.context.scene;scene.cycles.samples=8;scene.render.resolution_percentage=100
from mathutils import Vector
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.76,.83,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
for name,loc,power,size,col in [('Key',(-3,-4,6),600,5,(1,.93,.82)),('Fill',(4,-2,4),220,4,(.78,.9,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=3.25;scene.camera=cam;cam.location=(2,-6,2.8);cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'clay.png');bpy.ops.render.render(write_still=True)
print('NORMAL_REVIEW_DONE',flush=True)
