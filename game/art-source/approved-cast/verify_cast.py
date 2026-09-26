"""Round-trip actual exported FBX payloads, including action slots and skin weights."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
GAME=HERE.parents[1]
REPORT=GAME.parent/'output/character-turnarounds-20260915/rig-validation.json'
required={'idle','walk','attack','attack_alt','attack_heavy','skill','skill_start','skill_loop','skill_end','hit','death','arrive','turn_left','turn_right'}
results=[]
for role in ['stone','spike','crystal','leaf','bubble']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    file=GAME/'assets/resources/models-approved'/role/(role+'.fbx')
    bpy.ops.import_scene.fbx(filepath=str(file),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(rigs)==1 and meshes,(role,'Missing skinned model')
    rig=rigs[0];assert len(rig.data.bones)>=40
    invalid=[]
    for ob in meshes:
        for v in ob.data.vertices:
            total=sum(g.weight for g in v.groups)
            if not math.isfinite(total) or abs(total-1)>.025:invalid.append(v.index)
    assert not invalid,(role,'Unnormalized or unweighted vertices',len(invalid))
    names={a.name.split('|')[-1] for a in bpy.data.actions}
    assert required<=names,(role,'Missing actions',required-names)
    assert ('weapon_tip' in rig.data.bones) and (role=='stone' or 'weapon' in rig.data.bones)
    clips=[]
    for action in bpy.data.actions:
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
        start,end=action.frame_range
        frames=sorted(set(round(start+(end-start)*t) for t in [0,.13,.25,.37,.5,.63,.75,.87,1]))
        points=[]
        for fr in frames:
            bpy.context.scene.frame_set(fr);bpy.context.view_layer.update()
            points.append([tuple(rig.pose.bones[n].matrix.translation) for n in ['head','hand_L','hand_R','foot_L','foot_R']])
        motion=max((Vector(p)-Vector(q)).length for sample in points[1:] for p,q in zip(points[0],sample))
        # At least one real transform must change; an exported name alone isn't animation.
        if motion<.00001:
            bpy.context.scene.frame_set(frames[0]);a=rig.pose.bones['chest'].matrix.copy()
            bpy.context.scene.frame_set(frames[1]);b=rig.pose.bones['chest'].matrix.copy()
            motion=sum(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))
        assert motion>.00001,(role,'Static animation clip',action.name)
        clips.append({'name':action.name.split('|')[-1],'frames':frames,'jointDisplacement':round(motion,6)})
    results.append({'role':role,'path':str(file),'bones':len(rig.data.bones),'weightedVertices':sum(len(o.data.vertices) for o in meshes),'actions':clips,'passed':True})
REPORT.write_text(json.dumps({'status':'passed','scope':'Actual FBX import, normalized skin, 14 clips, weapon sockets; visual fidelity is a separate review.','models':results},ensure_ascii=False,indent=2),encoding='utf8')
print('CAST_FBX_VALIDATION_PASSED',len(results))
