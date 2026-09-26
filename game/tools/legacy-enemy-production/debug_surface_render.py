import bpy,sys,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;ID='M03';key='m03';manifest={'dimensions':[2.63,2.31,2]}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'inspection/M03/surface-test.blend'))
s=(ROOT/'review_runtime.py').read_text();s=s[s.index('scene=bpy.context.scene;'):s.index('def vertices():')];exec(s)
scene.render.filepath=str(ROOT/'inspection/M03/surface-test.png');bpy.ops.render.render(write_still=True)