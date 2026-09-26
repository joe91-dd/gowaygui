import bpy,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent;key=sys.argv[sys.argv.index('--')+1];out=root/'production'/key
bpy.ops.wm.open_mainfile(filepath=str(out/(key+'.blend')),load_ui=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH'];bpy.context.view_layer.update();corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)]);height=hi.z-lo.z
scene=bpy.context.scene;world=bpy.data.worlds.new('Review_world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,lo.z-.005));floor=bpy.context.object;m=bpy.data.materials.new('Review_floor');m.diffuse_color=(.58,.66,.62,1);floor.data.materials.append(m)
for loc,energy in [((-3,-4,6),650),((4,2,4),250)]:
 d=bpy.data.lights.new('Area','AREA');d.energy=energy;d.size=4;o=bpy.data.objects.new('Area',d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,height*.5))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',d);bpy.context.collection.objects.link(cam);cam.location=(3,-6,height+1);cam.rotation_euler=(Vector((0,0,height*.47))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=max(height*1.4,(hi.x-lo.x)*1.3,(hi.y-lo.y)*1.3);scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)
print('FREE_PREVIEW_READY',key,list(lo),list(hi))
