import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
asset=sys.argv[sys.argv.index('--')+1];folder=ROOT/'characters'/asset
bpy.ops.wm.open_mainfile(filepath=str(folder/(asset+'.blend')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.76,.83,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));ground=bpy.context.object
m=bpy.data.materials.new('QA_Ground');m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.55,.62,.59,1);p.inputs['Roughness'].default_value=.9;ground.data.materials.append(m)
for name,loc,power,size,col in [('Key',(-3,-4,6),600,5,(1,.93,.82)),('Fill',(4,-2,4),220,4,(.78,.9,1)),('Rim',(1,3,5),350,3,(.77,.96,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=3.3;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
if '--still' in sys.argv:scene.cycles.samples=8;scene.render.resolution_x=540;scene.render.resolution_y=540
for name,action,frame,loc in [('idle','idle',0,(3,-6,2.8)),('attack','attack',13,(3,-6,2.8)),('skill','skill',26,(3,-6,2.8)),('back','idle',0,(3,6,2.8))]:
 if '--still' in sys.argv and name!='idle':continue
 rig.animation_data.action=bpy.data.actions[action];scene.frame_set(frame);cam.location=loc;cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
print('POSE_REVIEW_COMPLETE '+asset)
