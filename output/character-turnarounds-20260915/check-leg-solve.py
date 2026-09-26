import bpy,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'game/art-source/approved-cast/crystal/crystal-studio.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
scene=bpy.context.scene;scene.cycles.samples=8;scene.render.resolution_x=400;scene.render.resolution_y=520
scene.camera.location=(0,-8,2.1);scene.camera.rotation_euler=(Vector((0,0,1.4))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
for name,angle in [('plus90',math.pi/2),('minus90',-math.pi/2),('noIK',None)]:
    for side in ['L','R']:
        c=rig.pose.bones['shin_'+side].constraints.get('Planted leg solve')
        c.influence=0 if angle is None else 1
        if angle is not None:c.pole_angle=angle
    scene.frame_set(1);scene.render.filepath=str(root/'output/character-turnarounds-20260915'/('leg-'+name+'.png'));bpy.ops.render.render(write_still=True)
