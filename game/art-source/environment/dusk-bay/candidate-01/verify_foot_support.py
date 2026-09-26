"""Offline current-stone sole projection over the actual reimported candidate platforms."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent
audit=json.loads((OUT/'stone-footprint-audit.json').read_text(encoding='utf-8'))
proposal=json.loads((OUT/'proposal.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(OUT/'dusk-bay.fbx'),use_anim=False)
nature=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name=='Landmarks_and_nature')
tree=BVHTree.FromPolygons([nature.matrix_world@v.co for v in nature.data.vertices],[list(p.vertices) for p in nature.data.polygons])
feet=[p for foot in audit['feet'] for p in foot['soleProjectionCocosAtScale065']]
route=[Vector((p['x'],p['z'])) for p in proposal['unchangedRoute']]
def nearest(q):
    candidates=[]
    for i,(a,b) in enumerate(zip(route,route[1:])):
        d=b-a;t=max(0,min(1,(q-a).dot(d)/d.length_squared));p=a+t*d
        candidates.append(((q-p).length,i,p))
    return min(candidates,key=lambda p:p[0])
results=[]
for i in range(5):
    old=Vector((proposal['sourceSlots'][i]['x'],proposal['sourceSlots'][i]['z']))
    new=Vector((proposal['candidateSlots'][i]['x'],proposal['candidateSlots'][i]['z']))
    oldd,oldseg,oldnear=nearest(old);newd,newseg,newnear=nearest(new)
    misses=[];heights=[];rays=0
    for angle in range(0,360,10):
        a=math.radians(angle);c,s=math.cos(a),math.sin(a)
        for p in feet:
            x=new.x+p[0]*c+p[1]*s;z=new.y-p[0]*s+p[1]*c
            hit=tree.ray_cast(Vector((x,-z,3)),Vector((0,0,-1)))
            rays+=1
            if hit[0] is None or abs(hit[0].z-.292)>.001:
                if len(misses)<15:misses.append({'angle':angle,'x':x,'z':z,'hitY':hit[0].z if hit[0] else None})
            else:heights.append(hit[0].z)
    results.append({'slot':i,'original':list(old),'candidate':list(new),'movement':(new-old).length,
      'originalRouteDistance':oldd,'candidateRouteDistance':newd,'nearestOriginalRoutePoint':list(oldnear),'nearestCandidateRoutePoint':list(newnear),
      'originalRouteSegment':oldseg,'candidateRouteSegment':newseg,
      'originalFullSoleClearance':oldd-audit['allYawSoleRadius'],'candidateFullSoleClearance':newd-audit['allYawSoleRadius'],
      'strictContactOriginalClearance':oldd-audit['strictContactAllYawRadius'],
      'insideMeleeBlockingRadius':newd<proposal['meleeBlockingRadius'],'blockingMargin':proposal['meleeBlockingRadius']-newd,
      'surfaceRays':rays,'unsupportedSamples':misses,'surfaceYMin':min(heights) if heights else None,'surfaceYMax':max(heights) if heights else None})
report={'status':'pass' if all(not p['unsupportedSamples'] for p in results) and all(p['insideMeleeBlockingRadius'] for p in results if p['slot'] in proposal['changedSlotIndices']) else 'needs-correction',
 'method':'Actual current runtime-source REST-pose near-ground foot vertices, scale .65, raycast at 36 yaw orientations onto actual reimported candidate FBX; no turtle or runtime geometry modified.',
 'footprintSourceAudit':'stone-footprint-audit.json','sourceModelFbxSha256':audit['runtimeFbxSha256'],
 'candidateFbxSha256':hashlib.sha256((OUT/'dusk-bay.fbx').read_bytes()).hexdigest(),
 'allYawSoleRadius':audit['allYawSoleRadius'],'continuousPlatformTopInradius':.995*math.cos(math.pi/48),
 'analyticAllYawSupportMargin':.995*math.cos(math.pi/48)-audit['allYawSoleRadius'],
 'slots':results,'notes':['All original level3 positions retained; actual c12b source feet tested against candidate FBX.',
 'Original slot indices1 and2 have route distances3.0 and1.4142, outside stone base radius1.2; preserve ranged/support uses, no core edits.',
 'Visual sand can run under plinth edges; route-center clearance and actual sole support are the constraints.',
 'Static all-yaw sole support does not prove animation movement clearance or actual enemy contact.']}
(OUT/'foot-support-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
assert report['status']=='pass'
