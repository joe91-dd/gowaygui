"""Plain Python authors a standalone Blender generator from our own frozen geometry routines.
This step does not import bpy, execute Blender, modify the source island, or create runtime assets.
"""
from pathlib import Path
import ast,hashlib,json
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
BASE=ROOT/'game/art-source/environment/boss-bay/candidate-01/build_boss_bay.py'
source=BASE.read_text(encoding='utf-8')
common=source[source.index("COL=bpy.data.collections.new"):source.index('def route_distance')]
foliage=source[source.index('def leaf('):source.index('# Two distant palms')]
bush=source[source.index('def bush('):source.index('placed=0')]
header='''"""Original A-style home island. Source candidate only; never touches game resources/core/views.
Run only after root allocates the Blender slot. --export-only writes source/export/review scene.
Characters are not part of the exported collection; references are recorded separately.
"""
import bpy,bmesh,math,random,json,hashlib,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
SOURCE=Path(__file__).resolve().parent;OUT=SOURCE;ROOT=SOURCE.parents[4]
PROPOSAL=json.loads((SOURCE/'layout-proposal.json').read_text(encoding='utf-8'))
RNG=random.Random(7086019)
EXPORT_ONLY='--export-only' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.users==0:bpy.data.collections.remove(c)
'''
body=(OUT/'home_composition.py').read_text(encoding='utf-8')
# These routines resolve height at call time, so composition can define its own terrain contract.
result=header+common+foliage+bush+body
ast.parse(result)
(OUT/'build_home_island.py').write_text(result,encoding='utf-8')
(OUT/'module-authorship.json').write_text(json.dumps({'status':'generator-authored-not-executed','frozenProjectModule':BASE.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'copiedOriginalRoutines':['authored atlas/material/UV','mesh/tube/rock/oval/disc/anchor','leaf/palm/bush'],'newGeometry':'Home-only coastline, flat paved forecourt, cream masonry shell house with teal arched doors/windows, rooftop shell/pearl, left plank pier and sparse ropes. No route/slot gameplay code copied.','compositionSha256':hashlib.sha256((OUT/'home_composition.py').read_bytes()).hexdigest(),'generatedScriptSha256':hashlib.sha256((OUT/'build_home_island.py').read_bytes()).hexdigest(),'blenderStarted':False,'externalAssetsUsed':False},ensure_ascii=False,indent=2),encoding='utf-8')
print('HOME_GENERATOR_AUTHORED: AST valid; no Blender started.')
