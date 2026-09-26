"""Read-only foot projection audit of the current runtime stone turtle source."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
PROMOTION=json.loads((ROOT/'game/art-source/stone-turtle/promotion-manifest.json').read_text(encoding='utf-8'))
SOURCE=ROOT/PROMOTION['current_editable_source']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
for ob in bpy.context.scene.objects:
    if ob.type=='ARMATURE':
        ob.data.pose_position='REST'
bpy.context.view_layer.update()
feet=[]
for ob in bpy.context.scene.objects:
    if ob.type!='MESH' or not (ob.name.startswith('front_') or ob.name.startswith('rear_')):continue
    if '_sculpt' not in ob.name and '_toe_' not in ob.name:continue
    points=[ob.matrix_world@v.co for v in ob.data.vertices]
    low=[p for p in points if p.z<=.065]
    if not low:continue
    feet.append({'name':ob.name,'minSourceY':min(p.z for p in points),'soleProjectionCocosAtScale065':[[p.x*.65,-p.y*.65,p.z*.65] for p in low]})
allpts=[p for f in feet for p in f['soleProjectionCocosAtScale065']]
maxp=max(allpts,key=lambda p:math.hypot(p[0],p[1]))
contact=[p for p in allpts if p[2]<=.00325]
contactmax=max(contact,key=lambda p:math.hypot(p[0],p[1]))

result={'runtimeFbxSha256':hashlib.sha256((ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx').read_bytes()).hexdigest(),
 'source':str(SOURCE),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'scale':.65,
 'method':'REST pose, sculpt/toe vertices <= .065 source units above floor, actual project editable source; all-yaw radial envelope because runtime rotates body toward enemies.',
 'feet':feet,'solePoints':len(allpts),'soleBoundsXZ':{'min':[min(p[i] for p in allpts) for i in [0,1]],'max':[max(p[i] for p in allpts) for i in [0,1]]},
 'allYawSoleRadius':math.hypot(maxp[0],maxp[1]),'maxRadiusPoint':maxp,
 'strictGroundContactSourceThreshold':.005,'strictContactPoints':len(contact),'strictContactAllYawRadius':math.hypot(contactmax[0],contactmax[1]),'strictContactMaximumPoint':contactmax}
(OUT/'stone-footprint-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='feet'},ensure_ascii=False,indent=2))
