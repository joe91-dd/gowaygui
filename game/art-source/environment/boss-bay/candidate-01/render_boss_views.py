"""Render the candidate's own stored preview scene only. No runtime writes."""
import bpy
import math
import json
import hashlib
import time
from pathlib import Path
from mathutils import Vector

SOURCE=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'boss-bay-review-scene.blend'))
scene=bpy.context.scene;camera=scene.camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
vfov=2*math.atan(math.tan(math.radians(42)/2)*max(1,(1280/720)/(1000/700)))
camera.data.lens=32/(2*math.tan(vfov/2))
report={'engine':'CYCLES','device':'CPU','threads':2,'samples':32,'width':1000,'height':700,'views':[]}
def world(p):return Vector((p[0],-p[2],p[1]))
for name,loc,target,scale in [
    ('battle-overview',(0,15,18),(0,.2,0),None),
    ('top-down',(0,28,0),(0,0,0),26.0),
]:
    camera.data.type='PERSP' if scale is None else 'ORTHO'
    if scale is not None:camera.data.ortho_scale=scale
    camera.location=world(loc);camera.rotation_euler=(world(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    target_path=SOURCE/('render-'+name+'.png');scene.render.filepath=str(target_path);start=time.perf_counter();bpy.ops.render.render(write_still=True)
    report['views'].append({'name':name,'positionCocos':loc,'targetCocos':target,'projection':camera.data.type,'verticalFovDegrees':math.degrees(vfov) if scale is None else None,'orthoScale':scale,'seconds':time.perf_counter()-start,'sha256':hashlib.sha256(target_path.read_bytes()).hexdigest()})
(SOURCE/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('BOSS_REVIEW_VIEWS_COMPLETE 1000x700 CPU threads=2 samples=32')
