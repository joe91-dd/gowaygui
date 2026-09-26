"""Render two actual rigged models together, never a bitmap paint-over."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
CANDIDATE=SOURCE/'candidate-10'
PREVIOUS=SOURCE/'versions/v09'
bpy.ops.wm.open_mainfile(filepath=str(CANDIDATE/'stone-turtle-review-scene.blend'))
scene=bpy.context.scene
new_rig=bpy.data.objects['StoneTurtle_Rig']
with bpy.data.libraries.load(str(PREVIOUS/'stone-turtle-review-scene.blend'),link=False) as (src,dst):
    dst.objects=['StoneTurtle_Rig','StoneTurtle_SkinnedMesh']
old_rig=None
for ob in dst.objects:
    scene.collection.objects.link(ob)
    if ob.type=='ARMATURE':old_rig=ob
assert old_rig
for rig in [new_rig,old_rig]:
    rig.animation_data.use_nla=False
    # Appended actions receive a suffix; the source's active idle action remains
    # associated with its own rig and its own Action Slot.
    if not rig.animation_data.action or not rig.animation_data.action.name.startswith('idle'):
        action=next(a for a in bpy.data.actions if a.name=='idle')
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
scene.frame_set(1)
for img in bpy.data.images:
    if img.source=='FILE':assert img.packed_file or Path(bpy.path.abspath(img.filepath)).is_file(),img.filepath

scene.cycles.samples=24;scene.render.threads_mode='FIXED';scene.render.threads=3
scene.render.resolution_x=1600;scene.render.resolution_y=780
camera=scene.camera;camera.data.ortho_scale=7.2
label_mat=bpy.data.materials.new('Review_label_ink');label_mat.diffuse_color=(.10,.11,.075,1)
labels=[]
for label in ['v09','v10']:
    font=bpy.data.curves.new('Label_'+label,'FONT');font.body=label;font.align_x='CENTER';font.size=.23; font.extrude=0
    ob=bpy.data.objects.new('Label_'+label,font);scene.collection.objects.link(ob);ob.data.materials.append(label_mat);labels.append(ob)

for name,loc,target in [('three-quarter',(3.6,-5.4,3.0),(0,-.12,.80)),('front',(0,-6,2.0),(0,-.12,.77)),('side',(6,-.6,2.3),(0,0,.80))]:
    camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    rot=camera.rotation_euler.to_quaternion();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
    for rig,label,offset in [(old_rig,labels[0],-1.70),(new_rig,labels[1],1.70)]:
        rig.location=right*offset
        label.location=Vector(target)+right*offset+up*1.32
        label.rotation_euler=camera.rotation_euler
    scene.render.filepath=str(CANDIDATE/('compare-v09-v10-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(CANDIDATE/'comparison-review-scene.blend'))
(CANDIDATE/'comparison-info.json').write_text(json.dumps({'left':'current v09','right':'isolated candidate v10','method':'Both real rigged meshes rendered in one Blender scene with one orthographic camera and shared studio lighting. No raster painting or compositing.','same_model_scale':True,'runtime_assets_modified':False},indent=2),encoding='utf-8')
print('STONE_COMPARISON_COMPLETE')
