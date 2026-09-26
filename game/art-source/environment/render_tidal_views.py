"""Render stored environment review scene without rewriting runtime assets."""
import bpy
import sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/environment'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'tidal-island-review-scene.blend'))
scene=bpy.context.scene;camera=scene.camera
scene.cycles.samples=32;scene.render.threads_mode='FIXED';scene.render.threads=3
scene.render.resolution_x=1400;scene.render.resolution_y=920
def world(p):return Vector((p[0],-p[2],p[1]))
for name,loc,target,scale in [('battle-overview',(14,20,27),(0,0,0),28.5),('top-down',(0,28,4),(0,0,0),26.0),('sanctuary-detail',(16,7,9),(8.5,.7,0),8.0),('gateway-detail',(-5.5,4,5),(-9.5,.75,0),6.0)]:
    if '--details-only' in sys.argv and name=='battle-overview':continue
    camera.location=world(loc);camera.rotation_euler=(world(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
    scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('ENVIRONMENT_REVIEW_VIEWS_COMPLETE')
