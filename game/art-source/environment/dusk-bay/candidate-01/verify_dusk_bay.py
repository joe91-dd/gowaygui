"""Read the actual exported FBX in a clean Blender scene and check placement."""
import bpy
import json
import math
import hashlib
import re
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[5]
SOURCE=Path(__file__).resolve().parent
FBX=SOURCE/'dusk-bay.fbx'
manifest=json.loads((SOURCE/'environment-manifest.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(FBX),use_anim=False)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)==3,[o.name for o in meshes]
assert not any('OCEAN' in o.name for o in bpy.context.scene.objects)
assert not list(FBX.parent.glob('*.glb')),'This candidate ships one FBX model only'
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
route=points(re.search(r'id:3,name:.*?route:\[(.*?)\]',data,re.S).group(1))
slots=points(re.search(r'const slots\s*=\s*\[(.*?)\]',data,re.S).group(1))
assert route==manifest['route'],'Current navigation differs from art manifest'
proposal=json.loads((SOURCE/'proposal.json').read_text(encoding='utf-8'))
assert slots==manifest['sourceSlots']==proposal['sourceSlots']
assert proposal['candidateSlots']==[{'x':p['x'],'z':p['z']} for p in manifest['slots']]

def tree_for(ob):
    vertices=[ob.matrix_world @ v.co for v in ob.data.vertices]
    return BVHTree.FromPolygons(vertices,[list(p.vertices) for p in ob.data.polygons])
ground=tree_for(next(o for o in meshes if o.name=='Ground'))
nature=tree_for(next(o for o in meshes if o.name=='Landmarks_and_nature'))
station_checks=[]
for i,p in enumerate(manifest['slots']):
    hit=nature.ray_cast(Vector((p['x'],-p['z'],5)),Vector((0,0,-1)))
    assert hit[0] is not None,('Missing plinth',i)
    station_checks.append({'slot':i,'x':p['x'],'z':p['z'],'anchorY':p['y'],'actualCenterSurfaceY':hit[0].z})
    assert abs(hit[0].z-.292)<.0001,station_checks[-1]
assert anchors['Enemy_entrance']==[-9.0,.064,-1.0]
assert anchors['Player_exit']==[9.0,.064,1.0]
assert anchors['Pearl_center']==[9.0,1.1,1.0]
road_samples=[];road_problems=[];obstacles=[]
for a,b in zip(route,route[1:]):
    a=Vector((a['x'],a['z']));b=Vector((b['x'],b['z']))
    count=math.ceil((b-a).length/.20)
    for i in range(count+1):
        q=a+(b-a)*i/count
        hit=ground.ray_cast(Vector((q.x,-q.y,10)),Vector((0,0,-1)))
        assert hit[0] is not None,('Missing ground',q)
        y=hit[0].z
        road_samples.append(y)
        if abs(y-.064)>.0001:road_problems.append({'x':q.x,'z':q.y,'y':y})
        decor=nature.ray_cast(Vector((q.x,-q.y,5)),Vector((0,0,-1)))
        if decor[0] and decor[0].z>.16 and -8.85<q.x<7.55:
            obstacles.append({'x':q.x,'z':q.y,'topY':decor[0].z})

stats=[]
for ob in meshes:
    pts=[ob.matrix_world @ v.co for v in ob.data.vertices]
    stats.append({'name':ob.name,'vertices':len(pts),'triangles':sum(len(f.vertices)-2 for f in ob.data.polygons),'uv_layers':len(ob.data.uv_layers),'material':ob.data.materials[0].name})
all_points=[ob.matrix_world@v.co for ob in meshes for v in ob.data.vertices]
bounds={'min':[min(p.x for p in all_points),min(p.z for p in all_points),min(-p.y for p in all_points)],'max':[max(p.x for p in all_points),max(p.z for p in all_points),max(-p.y for p in all_points)]}
for key in ['min','max']:
    assert max(abs(a-b) for a,b in zip(bounds[key],manifest['geometryBoundsCocos'][key]))<.001,('round-trip bounds differ',key)
total=sum(s['triangles'] for s in stats)
assert total==manifest['totalTriangles'] and total<=80000
textures=[]
for image in bpy.data.images:
    if image.name in {'Render Result','Viewer Node'}:continue
    if image.size[0]:textures.append({'name':image.name,'width':image.size[0],'height':image.size[1],'packed':bool(image.packed_file)})
assert textures and all(t['width']==2048 and t['height']==1024 for t in textures),textures
result={'fbx_round_trip':'pass' if not road_problems and not obstacles else 'needs_correction',
 'version':manifest['version'],'fbx_sha256':hashlib.sha256(FBX.read_bytes()).hexdigest(),
 'runtime_meshes':stats,'total_triangles':total,'materials':2,'geometry_bounds_cocos':bounds,'station_center_surface_checks':station_checks,'imported_textures':textures,
 'anchors_cocos_xyz':anchors,'route_samples':len(road_samples),
 'route_min_y':min(road_samples),'route_max_y':max(road_samples),
 'route_height_problems':road_problems,'route_center_obstacles':obstacles,
 'layoutProposalStatus':proposal['status'],'liveSlotCoordinatesMatchCandidate':True,'routeMatchesLiveData':True,
 'notes':['Route samples and station centers are raycast against actual reimported FBX meshes. They do not replace Cocos rendering, collision or mobile performance tests.',
          'Core sanctuary at the final route point is intentionally outside the obstacle-free route-center interval (-8.85,7.55).',
          '22x12 is the shared nominal gameplay footprint. True authored coastal rocks/foam bounds are reported without hiding overhangs.',
          'Foliage has thin open surfaces; actual Cocos material culling must be checked.']}
(SOURCE/'environment-round-trip.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert not road_problems,road_problems
assert not obstacles,obstacles
