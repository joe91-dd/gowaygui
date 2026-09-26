"""Render existing review geometry without rewriting assets during Cocos import."""
import bpy
import sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
for arg in sys.argv:
    if arg.startswith('--candidate-'):SOURCE=SOURCE/arg[2:]
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
for img in bpy.data.images:
    if img.source=='FILE':assert img.packed_file or Path(bpy.path.abspath(img.filepath)).is_file(),f'Missing image: {img.filepath}'
scene=bpy.context.scene;rig=bpy.data.objects['StoneTurtle_Rig'];cam=scene.camera
scene.render.resolution_x=1000;scene.render.resolution_y=850
scene.cycles.samples=24;scene.render.threads_mode='FIXED';scene.render.threads=3
rig.animation_data.use_nla=False
action=bpy.data.actions['idle'];rig.animation_data.action=action
if len(action.slots):rig.animation_data.action_slot=action.slots[0]
scene.frame_set(1)
cam.data.ortho_scale=3.4
for name,loc,target in [('three-quarter',(3.6,-5.4,3.0),(0,-.12,.80)),('front',(0,-6,2.0),(0,-.12,.77)),('side',(6,-.6,2.3),(0,0,.80)),('battle',(3.8,-5.2,5.3),(0,-.1,.80))]:
    if '--only-side' in sys.argv and name!='side':continue
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('FOUR_VIEWS_COMPLETE')
