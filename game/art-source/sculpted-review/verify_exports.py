"""Independent FBX import and evaluated-geometry validation; does not trust source counts."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
reports=[]
for role in ['stone','crystal','crab']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(ROOT/'assets/resources/models-sculpted'/role/(role+'.fbx')))
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH']
    assert len(meshes)==1,(role,len(meshes));mesh=meshes[0]
    assert all(v.groups and abs(sum(g.weight for g in v.groups)-1)<.001 for v in mesh.data.vertices),role+' invalid weight sum'
    assert max(len(v.groups) for v in mesh.data.vertices)<=4
    if role!='crab':
        for side in ['L','R']:
            assert rig.data.bones['fore_'+side].parent.name=='upper_'+side
            assert rig.data.bones['hand_'+side].parent.name=='fore_'+side
            assert rig.data.bones['foot_'+side].parent.name=='shin_'+side
    if role=='crystal':assert rig.data.bones['spell_tip'].parent.name=='weapon'
    def vertices():
        bpy.context.view_layer.update();o=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());m=o.to_mesh();vs=[o.matrix_world@v.co for v in m.vertices];o.to_mesh_clear();return vs
    colors=mesh.data.color_attributes.get('Color')
    assert colors and len(colors.data)>0,(role,'contact shading missing in FBX')
    colors_range=[min(c.color[0] for c in colors.data),max(c.color[0] for c in colors.data)]
    assert colors_range[1]-colors_range[0]>.15,(role,'flat contact shading')
    motions={};foot_contacts={};loop_seams={};finger_motion={}
    names=['idle','walk','attack','skill','hit','death','turn_left','turn_right','arrive']
    if role!='crab':
        names+=['attack_alt','attack_heavy','skill_start','skill_loop','skill_end']
        for side in ['L','R']:
            assert rig.data.bones['thumb_'+side].parent.name=='hand_'+side
            for i in range(3):assert rig.data.bones['finger_'+side+str(i)+'_tip'].parent.name=='finger_'+side+str(i)
    for name in names:
        act=next(a for a in bpy.data.actions if a.name.split('|')[-1]==name);rig.animation_data.action=act
        if act.slots:rig.animation_data.action_slot=act.slots[0]
        first,last=act.frame_range;bpy.context.scene.frame_set(int(first));start=vertices();max_motion=0
        reference={s:rig.matrix_world@rig.pose.bones['foot_'+s].head for s in ['L','R']} if role!='crab' else {}
        foot_drift=0
        for t in [.2,.45,.7,1]:
            bpy.context.scene.frame_set(int(first+(last-first)*t));end=vertices();max_motion=max(max_motion,max((a-b).length for a,b in zip(start,end)))
            if role!='crab' and name in ['idle','attack','skill','hit','arrive']:
                foot_drift=max(foot_drift,max(((rig.matrix_world@rig.pose.bones['foot_'+s].head)-reference[s]).length for s in reference))
        assert max_motion>.005,(role,name,'no mesh animation')
        motions[name]=round(max_motion,5)
        if name in ['idle','walk','skill_loop']:
            bpy.context.scene.frame_set(int(last));end=vertices();seam=max((a-b).length for a,b in zip(start,end));loop_seams[name]=round(seam,5)
            assert seam<.003,(role,name,'loop snap',seam)
        if role!='crab' and name.startswith('attack'):
            finger_indices=[v.index for v in mesh.data.vertices if any(mesh.vertex_groups[g.group].name.startswith(('finger_','thumb_')) for g in v.groups)]
            bpy.context.scene.frame_set(int(first+(last-first)*.45));mid=vertices();finger_motion[name]=max((mid[i]-start[i]).length for i in finger_indices)
            assert finger_motion[name]>.03,(role,name,'hands do not perform')
        if role!='crab' and name in ['idle','attack','skill','hit','arrive']:
            foot_contacts[name]=round(foot_drift,5)
            assert foot_drift<.025,(role,name,'planted foot drifts',foot_drift)
    bpy.context.scene.frame_set(1);vs=vertices();extent=[max(v[i] for v in vs)-min(v[i] for v in vs) for i in range(3)];assert min(extent)>.4
    reports.append({'role':role,'vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'maxInfluences':max(len(v.groups) for v in mesh.data.vertices),'dimensions':extent,'evaluatedMotion':motions,'plantedFootDriftMeters':foot_contacts,'loopSeamMeters':loop_seams,'attackHandMotionMeters':finger_motion,'contactColorRange':colors_range,'passed':True})
out=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else ROOT.parent/'output/sculpted-review-20260915/FBX独立回导验证.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(reports,indent=2),encoding='utf8');print('SKINNING_VERIFIED',json.dumps(reports))
