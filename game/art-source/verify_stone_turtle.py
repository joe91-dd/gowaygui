"""Independent FBX round-trip checks. Run in factory-startup Blender."""
import bpy
import json
import hashlib
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
FBX=ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx'
for arg in sys.argv:
    if arg.startswith('--candidate-'):
        SOURCE=SOURCE/arg[2:];FBX=SOURCE/'export/stone-turtle.fbx'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(FBX),use_anim=True)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
assert len(rig.data.bones)==10
assert mesh.data.uv_layers.active is not None
assert mesh.modifiers and any(m.type=='ARMATURE' for m in mesh.modifiers)
assert all(v.groups for v in mesh.data.vertices),'Unweighted vertices'
clips={}
for action in bpy.data.actions:
    clip=action.name.split('|')[-1]
    if clip not in {'idle','attack','skill','hit','rest','fusion'}:continue
    rig.animation_data.action=action
    rig.animation_data.use_nla=False
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    lo,hi=action.frame_range
    snapshots=[]
    for t in [lo,lo+(hi-lo)*.37,hi]:
        bpy.context.scene.frame_set(int(t))
        bpy.context.view_layer.update()
        dg=bpy.context.evaluated_depsgraph_get()
        evaluated=mesh.evaluated_get(dg)
        snapshots.append([evaluated.matrix_world @ v.co for v in evaluated.data.vertices])
    movement=max((a-b).length for a,b in zip(snapshots[0],snapshots[1]))
    seam=max((a-b).length for a,b in zip(snapshots[0],snapshots[2]))
    print('CLIP_MOTION',clip,movement,flush=True)
    assert movement>.001,f'{clip} did not deform the exported model'
    if clip in {'idle','rest'}:assert seam<.0001,f'{clip} loop has a visible seam'
    minimum_z=min(v.z for sample in snapshots for v in sample)
    clips[clip]={'first':lo,'last':hi,'seconds':(hi-lo)/30,'max_vertex_motion_m':round(movement,6),'loop_seam_m':round(seam,6),'sampled_min_z_m':round(minimum_z,6)}
assert len(clips)==6,clips
result={'fbx_round_trip':'pass','fbx_sha256':hashlib.sha256(FBX.read_bytes()).hexdigest(),'source_version':json.loads((SOURCE/'model-stats.json').read_text(encoding='utf-8'))['version'],'weighted_vertex_count':len(mesh.data.vertices),'bone_count':10,'uv_layers':len(mesh.data.uv_layers),'clips':clips}
(SOURCE/'round-trip-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
