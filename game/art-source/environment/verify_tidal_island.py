"""Read the actual exported FBX in a clean Blender scene and check placement."""
import bpy
import json
import math
import hashlib
import re
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/environment'
FBX=ROOT/'game/assets/resources/environment/tidal-island/tidal-island.fbx'
manifest=json.loads((SOURCE/'environment-manifest.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(FBX),use_anim=False)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)==3,[o.name for o in meshes]
assert not any('OCEAN' in o.name for o in bpy.context.scene.objects)
assert not list(FBX.parent.glob('*.glb')),'Duplicate runtime GLB'
assert all(o.data.uv_layers.active for o in meshes),'UV missing'
assert len({m.name for o in meshes for m in o.data.materials})==2
assert all(len(o.data.materials)==1 for o in meshes)
assert all(math.isfinite(v) for o in meshes for p in o.data.vertices for v in p.co)

def cocos(p):return [round(p.x,6),round(p.z,6),round(-p.y,6)]
anchors={o.name:cocos(o.matrix_world.translation) for o in bpy.context.scene.objects if o.type=='EMPTY'}
for i,p in enumerate(manifest['slots']):
    expected=Vector((p['x'],p['y'],p['z']))
    actual=Vector(anchors['Slot_'+str(i)])
    assert (expected-actual).length<.0001,(i,expected,actual)

data=(ROOT/'game/assets/scripts/core/data.ts').read_text(encoding='utf-8')
def points(s):return [{'x':float(x),'z':float(z)} for x,z in re.findall(r'x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)',s)]
route=points(re.search(r'id:1,name:.*?route:\[(.*?)\]',data,re.S).group(1))
slots=points(re.search(r'const slots\s*=\s*\[(.*?)\]',data,re.S).group(1))
assert route==manifest['route'],'Current navigation differs from art manifest'
assert slots==[{'x':p['x'],'z':p['z']} for p in manifest['slots']]

def tree_for(ob):
    vertices=[ob.matrix_world @ v.co for v in ob.data.vertices]
    return BVHTree.FromPolygons(vertices,[list(p.vertices) for p in ob.data.polygons])
ground=tree_for(next(o for o in meshes if o.name=='Ground'))
nature=tree_for(next(o for o in meshes if o.name=='Landmarks_and_nature'))
road_samples=[];road_problems=[];obstacles=[]
for a,b in zip(route,route[1:]):
    a=Vector((a['x'],a['z']));b=Vector((b['x'],b['z']))
    count=math.ceil((b-a).length/.30)
    for i in range(count+1):
        q=a+(b-a)*i/count
        hit=ground.ray_cast(Vector((q.x,-q.y,10)),Vector((0,0,-1)))
        assert hit[0] is not None,('Missing ground',q)
        y=hit[0].z
        road_samples.append(y)
        if not .045<=y<=.080:road_problems.append({'x':q.x,'z':q.y,'y':y})
        decor=nature.ray_cast(Vector((q.x,-q.y,5)),Vector((0,0,-1)))
        if decor[0] and decor[0].z>.16 and -8.9<q.x<7.7:
            obstacles.append({'x':q.x,'z':q.y,'topY':decor[0].z})

stats=[]
for ob in meshes:
    pts=[ob.matrix_world @ v.co for v in ob.data.vertices]
    stats.append({'name':ob.name,'vertices':len(pts),'triangles':sum(len(f.vertices)-2 for f in ob.data.polygons),'uv_layers':len(ob.data.uv_layers),'material':ob.data.materials[0].name})
result={'fbx_round_trip':'pass' if not road_problems and not obstacles else 'needs_correction',
 'version':manifest['version'],'fbx_sha256':hashlib.sha256(FBX.read_bytes()).hexdigest(),
 'runtime_meshes':stats,'total_triangles':sum(s['triangles'] for s in stats),
 'anchors_cocos_xyz':anchors,'route_samples':len(road_samples),
 'route_min_y':min(road_samples),'route_max_y':max(road_samples),
 'route_height_problems':road_problems,'route_center_obstacles':obstacles,
 'notes':['Raycasts inspect the actual reimported geometry. They do not replace Cocos rendering, collision or mobile performance tests.',
          'Foliage has thin open surfaces; actual Cocos material culling must be checked.']}
(SOURCE/'environment-round-trip.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert not road_problems,road_problems
assert not obstacles,obstacles
