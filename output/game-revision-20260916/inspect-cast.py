import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');OUT=ROOT/'output/game-revision-20260916/rig-review';OUT.mkdir(exist_ok=True)
report=[]
for key in ['yandun','yeling','shange','yangguang','chaoxing']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/g1-polish-20260916/characters'/key/(key+'.blend')),load_ui=False)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 for pb in rig.pose.bones:pb.matrix_basis.identity()
 rig.data.pose_position='REST';bpy.context.view_layer.update()
 body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
 g=body.vertex_groups['head'].index;points=[v.co for v in body.data.vertices if any(w.group==g and w.weight>.6 for w in v.groups)]
 lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)));center=(lo+hi)*.5
 scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.64,.72,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
 for name,loc,power,size,col in [('Key',(-3,-4,6),450,4,(1,.94,.85)),('Fill',(4,-3,4),300,4,(.8,.92,1))]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=max(hi.x-lo.x,hi.z-lo.z)*1.45;scene.camera=cam
 scene.render.engine='CYCLES';scene.cycles.samples=5;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
 for name,pos in [('front',Vector((0,-6,center.z))),('side',Vector((6,-.5,center.z)))]:
  cam.location=pos;cam.rotation_euler=(center-pos).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(key+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
 report.append({'key':key,'headMin':list(lo),'headMax':list(hi),'center':list(center),'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones if 'hand' in b.name or 'digit' in b.name},'meshes':[{ 'name':o.name,'verts':len(o.data.vertices),'materials':[m.name for m in o.data.materials if m]} for o in bpy.data.objects if o.type=='MESH']})
 (OUT/'inspection.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 print('HEAD_REVIEW',key,flush=True)
