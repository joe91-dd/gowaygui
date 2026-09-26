"""Future offline actual FBX/source QA. Run only after root allocates Blender and generation finishes."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
proposal=json.loads((OUT/'layout-proposal.json').read_text(encoding='utf-8'))
manifest=json.loads((OUT/'environment-manifest.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(OUT/'home-island.fbx'),use_anim=False)
objects=list(bpy.context.scene.objects);meshes=[o for o in objects if o.type=='MESH']
assert len(meshes)==3 and not any(o.type=='ARMATURE' for o in objects)
assert not any(o.name.startswith('PREVIEW_ONLY') for o in objects)
assert all(o.data.uv_layers.active for o in meshes)
assert len({m.name for ob in meshes for m in ob.data.materials})==2
assert all(len(ob.data.materials)==1 for ob in meshes)
triangles=sum(len(p.vertices)-2 for ob in meshes for p in ob.data.polygons)
assert triangles==manifest['totalTriangles']<=80000
anchors={o.name:[o.location.x,o.location.z,-o.location.y] for o in objects if o.type=='EMPTY'}
for a in proposal['anchors']:
    assert a['name'] in anchors
    assert max(abs(v-e) for v,e in zip(anchors[a['name']],[a['x'],a['y'],a['z']]))<.0001
vs=[];faces=[]
for ob in meshes:
    start=len(vs);vs.extend(ob.matrix_world@v.co for v in ob.data.vertices)
    faces.extend([start+i for i in p.vertices] for p in ob.data.polygons)
tree=BVHTree.FromPolygons(vs,faces)
audit=json.loads((ROOT/'game/art-source/environment/dusk-bay/candidate-01/stone-footprint-audit.json').read_text(encoding='utf-8'))
assert sha(ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx')==audit['runtimeFbxSha256']
feet=[p for foot in audit['feet'] for p in foot['soleProjectionCocosAtScale065']]
checks=[]
for a in proposal['anchors']:
    misses=[];rays=0;heights=[]
    for angle in range(0,360,10):
        c=math.cos(math.radians(angle));s=math.sin(math.radians(angle))
        for p in feet:
            x=a['x']+p[0]*c+p[1]*s;z=a['z']-p[0]*s+p[1]*c
            hit=tree.ray_cast(Vector((x,-z,6)),Vector((0,0,-1)))[0];rays+=1
            if hit is None or abs(hit.z-.16)>.001:
                if len(misses)<20:misses.append({'angle':angle,'x':x,'z':z,'hitY':hit.z if hit else None})
            else:heights.append(hit.z)
    checks.append({'anchor':a['name'],'surfaceRays':rays,'badSamples':misses,'minY':min(heights) if heights else None,'maxY':max(heights) if heights else None})
bounds={'min':[min(p.x for p in vs),min(p.z for p in vs),min(-p.y for p in vs)],'max':[max(p.x for p in vs),max(p.z for p in vs),max(-p.y for p in vs)]}
bpy.ops.wm.open_mainfile(filepath=str(OUT/'home-island.blend'))
editable=[o for o in bpy.context.scene.objects if o.type=='MESH'];images=[i for i in bpy.data.images if i.size[0]>0]
assert len(editable)>300 and len(images)==2 and all(i.packed_file for i in images)
assert not any(o.type in ['ARMATURE','CAMERA','LIGHT'] for o in bpy.context.scene.objects)
assert bpy.context.scene.render.threads==2 and bpy.context.scene.cycles.samples<=32
report={'status':'pass' if all(not q['badSamples'] for q in checks) else 'needs-correction','fbxSha256':sha(OUT/'home-island.fbx'),'sourceSha256':sha(OUT/'home-island.blend'),'meshes':3,'materials':2,'triangles':triangles,'editableMeshes':len(editable),'packedAtlasSizes':[list(i.size) for i in images],'geometryBoundsCocos':bounds,'actualAnchors':anchors,'footSupport':checks,'charactersInFbx':False,'method':'Actual reimported environment FBX all meshes BVH; current c12b scale .65 full sole points at 36 yaw orientations; actual editable source reopened.','pending':['Actual referenced character all-body and camera silhouette review','Cocos home UI, culling, loading/lifecycle/performance acceptance']}
(OUT/'round-trip-and-support.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2));assert report['status']=='pass'
