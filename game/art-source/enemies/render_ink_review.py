"""Isolated real-mesh pose and island context views; never edits game views."""
from pathlib import Path
import bpy
import math
import sys
import json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/('game/art-source/enemies/ink-blob/candidate-01' if '--candidate-01' in sys.argv else 'game/art-source/enemies/ink-blob/candidate-02')

def aim(cam,pos,target,scale):
    cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale

def pose(rig,name,frame):
    matches=[a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]==name]
    action=next(a for a in matches if not len(a.slots) or 'InkBlob' in a.slots[0].identifier)
    rig.animation_data.use_nla=False;rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()

if '--context' not in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'ink-blob-review-scene.blend'))
    scene=bpy.context.scene;rig=bpy.data.objects['InkBlob_Rig'];mesh=bpy.data.objects['InkBlob_SkinnedMesh']
    scene.cycles.samples=20;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1600;scene.render.resolution_y=500
    aim(scene.camera,(0,-9,4.1),(0,0,.64),8.3)
    mat=bpy.data.materials.new('Review_labels');mat.diffuse_color=(.065,.055,.04,1)
    for index,(name,frame) in enumerate([('idle',16),('walk',5),('attack',10),('hit',4),('exit',13)]):
        pose(rig,name,frame);bases={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
        rr=rig.copy();rr.data=rig.data.copy();rr.animation_data_clear();scene.collection.objects.link(rr)
        rr.name='Pose_'+name;rr.location.x=(index-2)*1.6
        for b in rr.pose.bones:b.matrix_basis=bases[b.name]
        mm=mesh.copy();mm.parent=rr;scene.collection.objects.link(mm)
        for mod in mm.modifiers:
            if mod.type=='ARMATURE':mod.object=rr
        text=bpy.data.curves.new('Label_'+name,'FONT');text.body=name.upper();text.align_x='CENTER';text.size=.18
        ob=bpy.data.objects.new('Label_'+name,text);scene.collection.objects.link(ob);ob.data.materials.append(mat)
        ob.location=((index-2)*1.6,0,1.39);ob.rotation_euler=scene.camera.rotation_euler
    rig.hide_render=True;mesh.hide_render=True
    scene.render.filepath=str(SOURCE/'render-five-poses.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-blob-poses.blend'))
    if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True)
else:
    # Reuse the real existing level-1 island as scale reference, all kept in this
    # isolated art review source. No Cocos code or runtime files are touched.
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'game/art-source/environment/tidal-island-review-scene.blend'))
    scene=bpy.context.scene
    with bpy.data.libraries.load(str(SOURCE/'ink-blob-review-scene.blend'),link=False) as (src,dst):
        dst.objects=[n for n in src.objects if n in ['InkBlob_Rig','InkBlob_SkinnedMesh']]
    for ob in dst.objects:scene.collection.objects.link(ob)
    rig=next(o for o in dst.objects if o.type=='ARMATURE');mesh=next(o for o in dst.objects if o.type=='MESH')
    pose(rig,'walk',5)
    for index,(x,z,angle) in enumerate([(-6.5,0,math.pi/2),(-5.45,0,math.pi/2),(-4.4,0,math.pi/2),(-3.35,-.43,2.16)]):
        rr=rig.copy();rr.data=rig.data.copy();scene.collection.objects.link(rr);rr.name='Ink_context_'+str(index)
        rr.location=(x,-z,.064);rr.rotation_euler.z=angle;rr.scale=(.68,)*3
        mm=mesh.copy();mm.parent=rr;scene.collection.objects.link(mm)
        for mod in mm.modifiers:
            if mod.type=='ARMATURE':mod.object=rr
    rig.hide_render=True;mesh.hide_render=True
    with bpy.data.libraries.load(str(ROOT/'game/art-source/stone-turtle/stone-turtle-review-scene.blend'),link=False) as (src,dst):
        dst.objects=[n for n in src.objects if n in ['StoneTurtle_Rig','StoneTurtle_SkinnedMesh']]
    for ob in dst.objects:scene.collection.objects.link(ob)
    turtle=next(o for o in dst.objects if o.type=='ARMATURE');turtle.location=(-5,-1,.292);turtle.scale=(.65,)*3;turtle.rotation_euler.z=math.pi
    turtle.animation_data.use_nla=False
    # Sampling at frame 1 makes the appended default idle pose deterministic.
    scene.frame_set(1);scene.cycles.samples=24;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1280;scene.render.resolution_y=720
    aim(scene.camera,(6,-17,16),(-3.0,0,.35),18.5)
    scene.render.filepath=str(SOURCE/'render-island-battle-context.png')
    for img in bpy.data.images:
        if img.source=='FILE' and not img.packed_file:img.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-blob-island-context.blend'))
    if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True)
    (SOURCE/'context-manifest.json').write_text(json.dumps({'status':'Offline Blender context, not Cocos gameplay screenshot','level_id':1,
        'enemy_scale':.68,'turtle_scale':.65,'camera_ortho_scale':18.5,'render_resolution':[1280,720],
        'assets':['current frozen stone v10','tidal island v04',SOURCE.name],'only_written_under':str(SOURCE)},indent=2),encoding='utf-8')
print('INK_REVIEW_RENDER_COMPLETE',flush=True)
