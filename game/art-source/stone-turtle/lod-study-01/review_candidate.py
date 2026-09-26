"""Offline FBX/half-frame checks and matched c12b/LOD render pairs.

Only writes this LOD study. No runtime or source replacement.
"""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
SOURCE=HERE.parent/'candidate-12/c12b'
EXPECTED={'idle':72,'attack':27,'skill':42,'hit':18,'rest':72,'fusion':60}
def write(name,data):(HERE/name).write_text(json.dumps(data,indent=2),encoding='utf-8')
def verify_protected():
    protected=json.loads((HERE/'protected-inputs.json').read_text())
    for name,row in protected.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==row['sha256'],name
    return len(protected)
def action_named(name):return next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)
def pose(rig,name,frame=1):
    for track in rig.animation_data.nla_tracks:track.mute=True
    action=action_named(name);rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
def points(ob):
    e=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    result=[e.matrix_world@v.co for v in m.vertices];e.to_mesh_clear();return result
def clearance_groups(ob):
    groups={'face':[],'shell':[],'front_legs':[]}
    for p in ob.data.polygons:
        names={ob.vertex_groups[g.group].name for i in p.vertices for g in ob.data.vertices[i].groups if g.weight>.999}
        center=p.center
        if names=={'head'} and center.y<-1.20 and center.z>.40 and p.normal.y<-.15:groups['face'].append(tuple(p.vertices))
        if names=={'shell'}:groups['shell'].append(tuple(p.vertices))
        if names and names.issubset({'front_L','front_R'}):groups['front_legs'].append(tuple(p.vertices))
    return groups
verify_protected()
bpy.ops.wm.open_mainfile(filepath=str(HERE/'stone-turtle-lod.blend'))
rig=bpy.data.objects['StoneTurtle_Rig'];ob=bpy.data.objects['StoneTurtle_LOD_SkinnedMesh']
groups=clearance_groups(ob);clearance={}
for name in ('attack','hit'):
    rows=[]
    for half in range(2,EXPECTED[name]*2+1):
        pose(rig,name,half/2);verts=points(ob);face=BVHTree.FromPolygons(verts,groups['face'])
        row={'frame':half/2}
        for key in ('shell','front_legs'):row[key]=len(face.overlap(BVHTree.FromPolygons(verts,groups[key])))
        rows.append(row)
    clearance[name]={'samples':len(rows),'max_shell':max(r['shell'] for r in rows),'max_front_legs':max(r['front_legs'] for r in rows),'rows':rows}
write('animation-clearance.json',{'method':'Rest face polygons y<-1.20,z>.40,normal.y<-.15; sample face-vs-shell/front legs every half-frame. Authored rear head/neck embedding excluded.','clips':clearance})
assert all(row['max_shell']==row['max_front_legs']==0 for row in clearance.values()),clearance

bpy.ops.wm.read_factory_settings(use_empty=True)
fbx=HERE/'export/stone-turtle-lod.fbx';bpy.ops.import_scene.fbx(filepath=str(fbx))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ob=next(o for o in bpy.context.scene.objects if o.type=='MESH')
assert set(a.name.split('|')[-1] for a in bpy.data.actions)==set(EXPECTED)
assert len(rig.data.bones)==10 and len(ob.data.materials)==len(ob.data.uv_layers)==1
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-6 for v in ob.data.vertices)
assert all(math.isfinite(x) for uv in ob.data.uv_layers.active.data for x in uv.uv)
report={'fbx_sha256':hashlib.sha256(fbx.read_bytes()).hexdigest(),'vertices':len(ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons),'materials':len(ob.data.materials),'uv_layers':len(ob.data.uv_layers),'bones':len(rig.data.bones),'clips':{}}
assert report['triangles']==15465
for name,last in EXPECTED.items():
    assert list(action_named(name).frame_range)==[1,last]
    pose(rig,name,1);first=points(ob);pose(rig,name,last);end=points(ob)
    seam=max((a-b).length for a,b in zip(first,end));motion=0;ground=999;peak=-999
    for half in range(2,last*2+1):
        pose(rig,name,half/2);pts=points(ob)
        motion=max(motion,max((a-b).length for a,b in zip(first,pts)));ground=min(ground,min(p.z for p in pts));peak=max(peak,max(p.z for p in pts))
    assert seam<.0001 and motion>.0001 and ground>-.003,(name,seam,motion,ground)
    report['clips'][name]={'range':[1,last],'seconds':(last-1)/30,'samples':last*2-1,'max_motion':motion,'seam':seam,'min_z':ground,'max_z':peak}
write('round-trip-check.json',report);print('ROUND_TRIP_OK',json.dumps({k:v for k,v in report.items() if k!='clips'}),flush=True)

# Restore exactly the approved studio; append only the candidate and attach its
# unchanged bone names to that same rig/material. Both render pairs share state.
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['StoneTurtle_Rig'];original=bpy.data.objects['StoneTurtle_SkinnedMesh']
with bpy.data.libraries.load(str(HERE/'stone-turtle-lod.blend'),link=False) as (available,loaded):loaded.objects=['StoneTurtle_LOD_SkinnedMesh']
candidate=loaded.objects[0];scene.collection.objects.link(candidate)
candidate.parent=rig;candidate.matrix_parent_inverse=original.matrix_parent_inverse.copy();candidate.matrix_basis=original.matrix_basis.copy()
for modifier in candidate.modifiers:
    if modifier.type=='ARMATURE':modifier.object=rig
candidate.data.materials.clear();candidate.data.materials.append(original.data.materials[0])
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.samples=32
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.render.use_border=False
camera=scene.camera
def camera_at(location,target,ortho=3.6):
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=ortho
def render(name,use_candidate):
    original.hide_render=use_candidate;candidate.hide_render=not use_candidate
    scene.render.filepath=str(HERE/name);bpy.ops.render.render(write_still=True)
pose(rig,'idle');camera_at((3.6,-5.4,3),(0,-.12,.91))
scene.render.resolution_x=800;scene.render.resolution_y=680
render('compare-original-close.png',False);render('compare-lod-close.png',True)

# Approximate the actual HomeWorld stone display at 693x390 CSS pixels, using
# the same 38-degree vertical FOV, stone placement/scale/yaw and camera. Render
# a native-density crop, not an enlarged/downsampled bitmap.
inverse_rotation=Matrix.Rotation(math.radians(-8),4,'Z')
stone_position=Vector((-.8,-2.7,.16));scale=.65
home_camera=inverse_rotation@((Vector((1.8,-12.8,8.2))-stone_position)/scale)
home_target=inverse_rotation@((Vector((-.45,0,.9))-stone_position)/scale)
camera_at(home_camera,home_target);camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
camera.data.lens=16/math.tan(math.radians(38/2))
scene.render.resolution_x=693;scene.render.resolution_y=390
bpy.context.view_layer.update()
projected=[world_to_camera_view(scene,camera,p) for p in points(original)]
xmin=min(p.x for p in projected);xmax=max(p.x for p in projected);ymin=min(p.y for p in projected);ymax=max(p.y for p in projected)
cx=(xmin+xmax)/2;cy=(ymin+ymax)/2
scene.render.use_border=True;scene.render.use_crop_to_border=True
scene.render.border_min_x=max(0,cx-96/693);scene.render.border_max_x=min(1,cx+96/693)
scene.render.border_min_y=max(0,cy-80/390);scene.render.border_max_y=min(1,cy+80/390)
write('comparison-cameras.json',{'close':{'resolution':[800,680],'location':[3.6,-5.4,3],'target':[0,-.12,.91],'orthographic_scale':3.6},
 'home':{'virtual_viewport':[693,390],'crop':[192,160],'source':'Current HomeWorld HOME_CAMERA and stone display, transformed to Blender local coordinates; studio material/light remains fixed','vertical_fov_degrees':38,'camera_local':list(home_camera),'target_local':list(home_target),'projected_character_px':[(xmax-xmin)*693,(ymax-ymin)*390]},
 'threads':4,'cycles_samples':32,'warning':'Offline geometry comparison only; not a Cocos screenshot or FPS measurement.'})
render('compare-original-home-size.png',False);render('compare-lod-home-size.png',True)
scene.render.use_border=False;scene.render.use_crop_to_border=False
scene.render.resolution_x=800;scene.render.resolution_y=680;camera_at((3.6,-5.4,3),(0,-.12,.91))
for name,frame in [('attack',11),('hit',4)]:
    pose(rig,name,frame);render('lod-%s-%02d.png'%(name,frame),True)
pose(rig,'idle');original.hide_render=True;candidate.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'stone-turtle-lod-review.blend'))
write('review-complete.json',{'protected_files_unchanged':verify_protected(),'clips':6,'round_trip':True,'clearance_samples':sum(r['samples'] for r in clearance.values()),'rendered_images':6,'threads':4,'samples':32,'status':'Independent candidate only; manual image review pending; no runtime promotion/FPS assertion.'})
print('LOD_REVIEW_FINISHED',flush=True)
