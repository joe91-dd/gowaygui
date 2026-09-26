"""Offline actual-mesh island scale check; never a Cocos gameplay claim."""
import bpy, hashlib, json, math
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
ENV=ROOT/'game/art-source/environment/tidal-island-review-scene.blend'
ENEMY=ROOT/'game/art-source/enemies/ink-blob/candidate-02/ink-blob-review-scene.blend'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
before={str(path.relative_to(ROOT)):sha(path) for path in [ENV,ENEMY,HERE/'spike-turtle-review-scene.blend']}
bpy.ops.wm.open_mainfile(filepath=str(ENV),load_ui=False,use_scripts=False)
scene=bpy.context.scene
with bpy.data.libraries.load(str(HERE/'spike-turtle-review-scene.blend'),link=False) as (src,dst):
    dst.objects=[name for name in src.objects if name in ('SpikeTurtle_Rig','SpikeTurtle_SkinnedMesh')]
for ob in dst.objects:scene.collection.objects.link(ob)
rig=next(ob for ob in dst.objects if ob.type=='ARMATURE')
rig.location=(-5,-1,.292);rig.scale=(.65,)*3;rig.rotation_euler.z=math.pi
for track in rig.animation_data.nla_tracks:track.mute=True
action=next(a for a in bpy.data.actions if a.name=='attack');rig.animation_data.action=action
if len(action.slots):rig.animation_data.action_slot=action.slots[0]
scene.frame_set(7);bpy.context.view_layer.update()
# The existing self-authored ink enemy supplies scale context only.
with bpy.data.libraries.load(str(ENEMY),link=False) as (src,dst):
    dst.objects=[name for name in src.objects if name in ('InkBlob_Rig','InkBlob_SkinnedMesh')]
for ob in dst.objects:scene.collection.objects.link(ob)
enemy_rig=next(ob for ob in dst.objects if ob.type=='ARMATURE')
enemy_mesh=next(ob for ob in dst.objects if ob.type=='MESH')
for track in enemy_rig.animation_data.nla_tracks:track.mute=True
enemy_action=next(a for a in bpy.data.actions if a.name=='walk');enemy_rig.animation_data.action=enemy_action
if len(enemy_action.slots):enemy_rig.animation_data.action_slot=enemy_action.slots[0]
scene.frame_set(7);bpy.context.view_layer.update()
for index,x in enumerate([-7.0,-5.8,-4.6]):
    frozen=bpy.data.meshes.new_from_object(enemy_mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    ob=bpy.data.objects.new('REVIEW_ONLY_ink_'+str(index),frozen);scene.collection.objects.link(ob)
    ob.location=(x,0,.064);ob.scale=(.75,)*3;ob.rotation_euler.z=math.pi/2
enemy_rig.hide_render=True;enemy_mesh.hide_render=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=32
scene.render.resolution_x=800;scene.render.resolution_y=680;scene.render.resolution_percentage=100
scene.camera.location=(3.2,-11.4,11);target=Vector((-4.9,-.05,.25))
scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=8.3
scene.render.filepath=str(HERE/'render-island-battle-context.png')
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'spike-turtle-island-context.blend'))
bpy.ops.render.render(write_still=True)
assert before=={str(path.relative_to(ROOT)):sha(path) for path in [ENV,ENEMY,HERE/'spike-turtle-review-scene.blend']}
(HERE/'context-manifest.json').write_text(json.dumps({'status':'Offline Blender composition of actual authored meshes; not Cocos gameplay screenshot',
    'source_hashes':before,'levelId':1,'slot_cocos':{'x':-5,'y':.292,'z':1},'spike_scale':.65,'spike_pose':'attack 7',
    'enemy_scale':.75,'route_surface_y':.064,'threads':2,'samples':32,'render_size':[800,680]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('SPIKE_ISLAND_CONTEXT_COMPLETE')
