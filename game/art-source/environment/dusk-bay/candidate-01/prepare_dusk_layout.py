"""Read real level 3 layout; report exact distances without changing gameplay data."""
import json, re, math, hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
data_path=ROOT/'game/assets/scripts/core/data.ts'
data=data_path.read_text(encoding='utf-8')
def points(text):
    return [{'x':float(x),'z':float(z)} for x,z in re.findall(r'x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)',text)]
route=points(re.search(r'id:3,name:.*?route:\[(.*?)\]',data,re.S).group(1))
slots=points(re.search(r'const slots\s*=\s*\[(.*?)\]',data,re.S).group(1))
audit_path=OUT/'stone-footprint-audit.json'
audit=json.loads(audit_path.read_text(encoding='utf-8'))
runtime=ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx'
assert hashlib.sha256(runtime.read_bytes()).hexdigest()==audit['runtimeFbxSha256'],'Stone changed: remeasure before using its footprint'
radius=audit['allYawSoleRadius']
def nearest(q):
    candidates=[]
    for i,(a,b) in enumerate(zip(route,route[1:])):
        dx,dz=b['x']-a['x'],b['z']-a['z']
        t=max(0,min(1,((q['x']-a['x'])*dx+(q['z']-a['z'])*dz)/(dx*dx+dz*dz)))
        x,z=a['x']+dx*t,a['z']+dz*t
        candidates.append((math.hypot(q['x']-x,q['z']-z),i,{'x':x,'z':z}))
    return min(candidates,key=lambda p:p[0])
def intervals(q,r=1.2):
    result=[];offset=0
    for i,(a,b) in enumerate(zip(route,route[1:])):
        dx,dz=b['x']-a['x'],b['z']-a['z'];length=math.hypot(dx,dz)
        ux,uz=dx/length,dz/length;rx,rz=q['x']-a['x'],q['z']-a['z']
        along=rx*ux+rz*uz;perp2=max(0,rx*rx+rz*rz-along*along)
        if perp2<=r*r:
            half=math.sqrt(r*r-perp2);lo=max(0,along-half);hi=min(length,along+half)
            if hi>=lo:result.append({'segment':i,'startRouteDistance':offset+lo,'endRouteDistance':offset+hi,'length':hi-lo})
        offset+=length
    return result
rows=[]
for i,q in enumerate(slots):
    d,segment,p=nearest(q);covered=intervals(q)
    rows.append({'slot':i,'position':q,'routeDistance':d,'nearestSegment':segment,'nearestRoutePoint':p,
      'fullSoleToRouteCenterClearance':d-radius,'platformToRouteCenterClearance':d-.995,
      'blockingRadius':1.2,'withinStoneBlockingRadius':d<=1.2,'blockingMargin':1.2-d,
      'coveredRouteIntervals':covered,'totalCoveredRouteLength':sum(c['length'] for c in covered),
      'positionMoved':False})
assert all(r['fullSoleToRouteCenterClearance']>0 for r in rows)
assert all(r['platformToRouteCenterClearance']>0 for r in rows)
proposal={'schemaVersion':1,'status':'offline-original-layout-no-move-required-for-foot-support',
 'levelId':3,'levelName':'薄暮海湾','sourceSlots':slots,'candidateSlots':slots,'changedSlotIndices':[],
 'unchangedRoute':route,'stoneBattleScale':.65,'meleeBlockingRadius':1.2,'fullNearGroundSoleRadius':radius,
 'strictGroundContactRadius':audit['strictContactAllYawRadius'],'surfaceY':.292,'platformContinuousTopRadius':.995,'platformTopSides':48,
 'reason':'All original centers clear the full rotating stone sole and .995 platform radius. Preserve every gameplay coordinate; station indices 1 and 2 have pre-existing melee coverage limitations disclosed in layout-preflight.json.',
 'pending':['Root gameplay role/coverage review for original stations 1 and 2','Actual reimported FBX support and route checks','Cocos/mobile rendering and simulation acceptance']}
report={'status':'pass-with-existing-melee-coverage-limits','levelId':3,'dataSourceSha256':hashlib.sha256(data_path.read_bytes()).hexdigest(),
 'coordinateConvention':'Cocos x/y-up/z; route/plinth analysis in XZ','sourceStoneAudit':str(audit_path.relative_to(ROOT)),
 'sourceStoneAuditSha256':hashlib.sha256(audit_path.read_bytes()).hexdigest(),'sourceStoneFbxSha256':audit['runtimeFbxSha256'],
 'fullAllYawFootRadius':radius,'platformTopRadius':.995,'platformTopInradius':.995*math.cos(math.pi/48),
 'analyticFootSupportMargin':.995*math.cos(math.pi/48)-radius,'route':route,'slots':rows,
 'notes':['Original layout preserved. No minimum move proposal is necessary to clear route centers or support the full static all-yaw sole.',
 'Station indices 1 and 2 do not intersect stone base blocking circle1.2; this is existing gameplay coverage, not a reason to silently alter coordinates.',
 'Blocking uses base ROLES.stone.range, distinct from optional basic-attack range modifiers.',
 'Exact route center is the navigation constraint; the visual sand band may pass under raised platform edges. No full-road-width exclusion is claimed.',
 'This analytic preflight is not a substitute for actual FBX raycasts or animation/contact runtime tests.']}
for name,value in [('proposal.json',proposal),('layout-preflight.json',report)]:
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
