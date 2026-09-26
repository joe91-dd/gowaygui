"""Render current exported mesh studios at additional inspection angles."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
roles=[r for r in sys.argv[sys.argv.index('--')+1:] if r in ['stone','spike','crystal','leaf','bubble']] if '--' in sys.argv else ['stone','spike','crystal','leaf','bubble']
for role in roles:
    out=HERE/role
    bpy.ops.wm.open_mainfile(filepath=str(out/(role+'-studio.blend')))
    scene=bpy.context.scene;scene.cycles.samples=12;scene.render.resolution_x=640;scene.render.resolution_y=720
    for name,pos in [('three-quarter',(4,-7,3.0)),('side',(8,0,2.1)),('back',(0,8,2.1))]:
        scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,1.46))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('CURRENT_VIEWS_DONE',role,flush=True)
