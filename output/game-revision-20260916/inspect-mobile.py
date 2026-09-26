import bpy,json
from pathlib import Path
r=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');bpy.ops.wm.open_mainfile(filepath=str(r/'output/game-revision-20260916/mobile-cast/shange/shange.blend'),load_ui=False)
for o in bpy.data.objects:
 if o.type=='MESH':
  print('MESH',o.name,'UV',[(u.name,u.active_render,u.active) for u in o.data.uv_layers], 'mods',[(m.name,m.type) for m in o.modifiers],flush=True)
  print('WEIGHTS',len(o.vertex_groups),sum(1 for v in o.data.vertices if not v.groups),flush=True)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
scene=bpy.context.scene
# reuse QA creation tail
from mathutils import Vector
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.76,.83,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
for name,loc,power,size,col in [('Key',(-3,-4,6),600,5,(1,.93,.82)),('Fill',(4,-2,4),220,4,(.78,.9,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=3.25;scene.camera=cam;cam.location=(2,-6,2.8);cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(r/'output/game-revision-20260916/mobile-rest.png');bpy.ops.render.render(write_still=True)
print('DONE')
