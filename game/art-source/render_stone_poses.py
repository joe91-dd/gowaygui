"""Render independent peak poses from the exported model's review scene."""
import bpy
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
for arg in sys.argv:
    if arg.startswith('--candidate-'):SOURCE=SOURCE/arg[2:]
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
for img in bpy.data.images:
    if img.source=='FILE':assert img.packed_file or Path(bpy.path.abspath(img.filepath)).is_file(),f'Missing image: {img.filepath}'
scene=bpy.context.scene;rig=bpy.data.objects['StoneTurtle_Rig']
scene.render.resolution_x=700;scene.render.resolution_y=600
scene.cycles.samples=20;scene.render.threads_mode='FIXED';scene.render.threads=3
rig.animation_data.use_nla=False
for name,frame in [('idle',24),('attack',11),('skill',16),('hit',4),('rest',36),('fusion',23)]:
    action=bpy.data.actions[name];rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    scene.frame_set(frame)
    scene.render.filepath=str(SOURCE/('pose-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
print('PEAK_POSE_RENDERS_COMPLETE')
