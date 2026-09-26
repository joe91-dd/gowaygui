import bpy, sys, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent;out=root/'polished-yandun'
bpy.ops.wm.open_mainfile(filepath=str(out/'yandun-polished.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Yandun_Rig'];cam=scene.camera
scene.cycles.samples=16;scene.render.resolution_x=640;scene.render.resolution_y=740
cam.location=(3,-6,2.6);cam.rotation_euler=(Vector((0,0,1.20))-cam.location).to_track_quat('-Z','Y').to_euler()
for track in rig.animation_data.nla_tracks:track.mute=True
for name,clip,frame in [('attack-contact','Attack_Combo',14),('attack-recovery','Attack_Combo',28),('storm-release','Rock_Storm',38),('closed-eyes','Idle',0)]:
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame)
    for ob in bpy.data.objects:
        if ob.name.startswith('Eyelid_'):ob.data.shape_keys.key_blocks['Blink'].value=1 if name=='closed-eyes' else 0
    scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('POSE_CHECK_RENDERED')
