"""Pure Python layout preparation; no Blender. Never approves a pending coordinate option."""
import json, math
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
options=json.loads((OUT/'layout-options.json').read_text(encoding='utf-8'))
selected=next(o for o in options['options'] if o['id']=='safe-foot-margin')
old=options['originalSlots'];candidate=[dict(p) for p in old];candidate[4]=selected['point']
decision_path=OUT/'layout-decision.json'
decision=json.loads(decision_path.read_text(encoding='utf-8')) if decision_path.exists() else {}
if decision.get('approvedForOfflineArt'):
    selected=next(o for o in options['options'] if o['point']==decision['slot5'])
    candidate[4]=selected['point']
    assert selected['platformCenterClearance']>0 and selected['blockingMargin']>0
proposal={'schemaVersion':1,'status':'approved-offline-art-layout' if decision.get('approvedForOfflineArt') else 'proposed-awaiting-root-decision',
 'levelId':4,'levelName':'巨钳来袭','approvedForOfflineArt':decision.get('approvedForOfflineArt') is True,
 'sourceSlots':old,'candidateSlots':candidate,'changedSlotIndices':[4],'unchangedRoute':options['route'],
 'stoneBattleScale':.65,'meleeBlockingRadius':1.2,'fullNearGroundSoleRadius':options['footRadius'],
 'surfaceY':.292,'platformContinuousTopRadius':.995,'platformTopSides':48,
 'reason':'Original station5 overlaps the true route center. Only its explicitly proposed center moves; retain full foot support and stone blocking. Production data/save migration belongs to root.',
 'selectedOption':selected['id'],'selectedOptionMetrics':selected,
 'pending':['Root final layout decision and separate legacy-combat coordinate compatibility','Actual exported FBX route/foot-support tests','Cocos/mobile visual acceptance']}
def nearest(p):
    result=[]
    for i,(a,b) in enumerate(zip(options['route'],options['route'][1:])):
        dx,dz=b['x']-a['x'],b['z']-a['z'];t=max(0,min(1,((p['x']-a['x'])*dx+(p['z']-a['z'])*dz)/(dx*dx+dz*dz)))
        q={'x':a['x']+t*dx,'z':a['z']+t*dz};result.append((math.hypot(p['x']-q['x'],p['z']-q['z']),i,q))
    return min(result,key=lambda q:q[0])
rows=[]
for i,p in enumerate(candidate):
    d,seg,q=nearest(p)
    rows.append({'slot':i,'position':p,'routeDistance':d,'nearestSegment':seg,'nearestRoutePoint':q,
      'fullSoleToRouteCenterClearance':d-options['footRadius'],'platformToRouteCenterClearance':d-.995,
      'withinStoneBlockingRadius':d<=1.2,'blockingMargin':1.2-d,'positionMoved':p!=old[i]})
assert all(r['fullSoleToRouteCenterClearance']>0 and r['platformToRouteCenterClearance']>0 for r in rows)
report={'status':'analytic-pass-layout-approval-pending' if not proposal['approvedForOfflineArt'] else 'analytic-pass',
 'levelId':4,'sourceStoneFbxSha256':options['currentStoneFbxSha256'],'fullAllYawFootRadius':options['footRadius'],
 'platformTopRadius':.995,'platformTopInradius':.995*math.cos(math.pi/48),
 'analyticFootSupportMargin':.995*math.cos(math.pi/48)-options['footRadius'],'route':options['route'],'slots':rows,
 'notes':['Describes an explicitly proposed candidate, never the overlapping original slot5.','Positions3/4 remain ranged/support; do not force them into 1.2 blocking.','No actual Blender export/support raycast or gameplay migration has run.']}
(OUT/'proposal.json').write_text(json.dumps(proposal,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'layout-preflight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'approved':proposal['approvedForOfflineArt'],'candidateSlot5':candidate[4],'status':report['status']},ensure_ascii=False))
