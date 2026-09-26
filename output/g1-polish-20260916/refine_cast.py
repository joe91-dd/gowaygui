"""Non-destructive palm alignment and editable secondary deformation controls.
Generated surface/UVs are retained. Never reruns the old mesh-curl operation.
"""
import bpy,sys,json,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parent
key=sys.argv[sys.argv.index('--')+1]
src=ROOT.parent/'aholo-pro-cast-20260915/g1/runtime-v2'/key
out=ROOT/'characters'/key;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src/(key+'.blend')),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis.identity()
bpy.context.view_layer.update()
report={'asset':key,'source':str(src),'surfacePreserved':True,'controls':[]}
# Shaft sockets previously marked the wrist, rather than the palm volume.
if key!='yandun':
 hand=rig.data.bones['hand.L'];inv=hand.matrix_local.inverted();gi=body.vertex_groups['hand.L'].index
 points=[v.co.copy() for v in body.data.vertices if any(g.group==gi and g.weight>.70 for g in v.groups) and .10<(inv@v.co).y<.24]
 palm=Vector(np.median(np.array([p[:] for p in points]),axis=0))
 grip=bpy.data.objects['FX_Weapon_Grip'];delta=palm-grip.matrix_world.translation
 targets=[o for o in bpy.data.objects if o.parent==rig and o.parent_type=='BONE' and o.parent_bone=='hand.L']
 original={o:o.matrix_world.copy() for o in targets}
 for o,m in original.items():o.matrix_world=Matrix.Translation(delta)@m
 bpy.context.view_layer.update()
 report['gripTranslation']=list(delta);report['palm']=list(palm)
defs=[];handzones=[]
# The four visible turtle digits each have two individually weighted controls.
for side in ['L','R']:
 bone=rig.data.bones['hand.'+side];mat=bone.matrix_local.copy();inv=mat.inverted();gi=body.vertex_groups[bone.name].index
 verts=[v for v in body.data.vertices if any(g.group==gi and g.weight>.65 for g in v.groups)]
 local=np.array([(inv@v.co)[:] for v in verts]);low,high=np.quantile(local[:,0],[.08,.92]);tip=float(np.quantile(local[:,1],.9));base=min(.13,tip*.45)
 for f in range(4):
  x=low+(high-low)*(f+.5)/4;sel=local[np.abs(local[:,0]-x)<max(.02,(high-low)/4)]
  z=float(np.median(sel[:,2])) if len(sel) else 0
  a=Vector((x,base,z));b=Vector((x,(base+tip)*.5,z));c=Vector((x,tip,z));name='digit_'+str(f+1)+'.'+side
  defs.extend([(name,mat@a,mat@b,bone.name),(name+'_tip',mat@b,mat@c,name)])
  handzones.append((side,name,x,z,base,tip,max(.026,(high-low)/3.4),mat))
# Conservative facial regions: jaw, separate brows, cheeks and lip corners.
# Eyelid controllers are delivered for authoring; full eyelid topology is not invented.
head=rig.data.bones['head'];headgroup=body.vertex_groups['head'].index
pts=np.array([v.co[:] for v in body.data.vertices if any(g.group==headgroup and g.weight>.7 for g in v.groups) and abs(v.co.x)<.36 and v.co.y<-.18])
front=float(np.quantile(pts[:,1],.12));zlo,zhi=np.quantile(pts[:,2],[.12,.78]);eye=zlo+(zhi-zlo)*.70
face=[]
for side,sign in [('L',1),('R',-1)]:
 for label,x,z,radius in [('brow',.20,eye+.065,(.15,.10,.065)),('cheek',.28,eye-.14,(.15,.13,.11)),('lip',.17,zlo+.10,(.14,.10,.07))]:
  name=label+'.'+side;point=Vector((sign*x,front+.025,z));defs.append((name,point,point+Vector((0,0,.07)),'head'));face.append((name,point,radius))
 jaw=Vector((0,front+.025,zlo+.025))
defs.append(('jaw',jaw,jaw+Vector((0,0,.09)),'head'));face.append(('jaw',jaw,(.24,.11,.10)))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name,a,b,parent in defs:
 eb=rig.data.edit_bones.new(name);eb.head=a;eb.tail=b;eb.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for name,*_ in defs:body.vertex_groups.new(name=name);rig.pose.bones[name].rotation_mode='XYZ'
for v in body.data.vertices:
 old={body.vertex_groups[g.group].name:g.weight for g in v.groups};added={}
 for side in ['L','R']:
  weight=old.get('hand.'+side,0)
  if weight<.15:continue
  zones=[z for z in handzones if z[0]==side];local=zones[0][-1].inverted()@v.co
  if local.y<zones[0][4]:continue
  zone=min(zones,key=lambda z:((local.x-z[2])/z[6])**2+((local.z-z[3])/.18)**2)
  _,name,x,z,base,tip,width,mat=zone
  t=max(0,min(1,(local.y-base)/max(.01,tip-base)));transfer=weight*min(.88,t*2)
  distal=max(0,min(1,(t-.35)/.4));added[name]=transfer*(1-distal);added[name+'_tip']=transfer*distal;old['hand.'+side]-=transfer
 hw=old.get('head',0)
 if hw>.15:
  choices=[]
  for name,point,radius in face:
   d=sum(((v.co[i]-point[i])/radius[i])**2 for i in range(3))
   if d<4:choices.append((name,math.exp(-d*1.6)*hw*.75))
  if choices:
   name,w=max(choices,key=lambda q:q[1]);added[name]=w;old['head']-=w
 weights=sorted([(n,w) for n,w in {**old,**added}.items() if w>.0001],key=lambda q:-q[1])[:4];total=sum(w for _,w in weights)
 for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
 for n,w in weights:body.vertex_groups[n].add([v.index],w/total,'REPLACE')
for name,*_ in defs:
 g=body.vertex_groups[name].index;count=sum(any(w.group==g and w.weight>.01 for w in v.groups) for v in body.data.vertices)
 report['controls'].append({'bone':name,'weightedVertices':count})
# Subtle release/settle layered onto existing authored body timing. No image swaps.
for action in list(bpy.data.actions):
 if action.name not in ['idle','walk','attack','attack2','skill','greeting','hit','rest','exit']:continue
 rig.animation_data.action=action;end=int(action.frame_range[1]);peak=max(1,int(end*.4))
 for frame,strength in [(0,0),(peak,1),(end,0)]:
  bpy.context.scene.frame_set(frame)
  for name,*_ in defs:
   pb=rig.pose.bones[name];pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
   if name.startswith('digit'):
    held=key!='yandun' and '.L' in name
    bend=0 if held else (.055 if action.name in ['attack','attack2'] else .025)
    pb.rotation_euler.x=bend*strength
   elif name.startswith('brow'):
    pb.location.y=(.012 if action.name=='greeting' else -.007 if action.name in ['attack','skill'] else .002)*strength
   elif name.startswith('lip') and action.name=='greeting':pb.location.y=.009*strength
   elif name=='jaw' and action.name in ['skill','greeting']:pb.rotation_euler.x=.035*strength
   pb.keyframe_insert('rotation_euler',frame=frame);pb.keyframe_insert('location',frame=frame)
 for fc in action.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/(key+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(out/(key+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(key+'.blend')))
report['bones']=len(rig.data.bones);report['triangles']=sum(len(p.vertices)-2 for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
report['limits']=['Facial surface is the generated one-piece atlas mesh. Complete eyelid/eyeball articulation still requires separate eyelid topology.','Digit regions need visual validation before claiming a final production rig.']
(out/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('CAST_REFINED',key,report['bones'])
