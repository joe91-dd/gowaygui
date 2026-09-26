"""Render own home candidate with four approved source references, never export characters with it."""
import bpy,json,math,hashlib,time
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
proposal=json.loads((OUT/'layout-proposal.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(OUT/'home-island-review-scene.blend'))
scene=bpy.context.scene;camera=scene.camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
def world(p):return Vector((p[0],-p[2],p[1]))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files={
 'stone':('game/assets/resources/models/stone-turtle/stone-turtle.fbx','fd2dee9cf539ac5e9b73cfb21cdcac1fede7f25ff60934f68e078d288357ac3c'),
 'spike':('game/assets/resources/models/spike-turtle/spike-turtle.fbx',None),
 'crystal':('game/assets/resources/models/crystal-turtle/crystal-turtle.fbx','b35d20a6ffbc737231631e505c8ae5b9d5eefea3a83b1b46fd58b838a5bd0364'),
 'leaf':('game/assets/resources/models/leaf-turtle/leaf-turtle.fbx','c6abed3f0de639a37b80fdd0780c5474525f5b33f579a231bd3d0e6d4a44b74e'),
}
spikePromotion=json.loads((ROOT/'game/art-source/spike-turtle/candidate-02/promotion-manifest.json').read_text(encoding='utf-8'))
def find_fbx_hash(value):
    if isinstance(value,dict):
        for key in ['runtime_fbx_sha256','fbx_sha256']:
            if isinstance(value.get(key),str):return value[key]
        for item in value.values():
            found=find_fbx_hash(item)
            if found:return found
    if isinstance(value,list):
        for item in value:
            if isinstance(item,dict) and str(item.get('name',item.get('source',''))).endswith('.fbx') and item.get('sha256'):return item['sha256']
            found=find_fbx_hash(item)
            if found:return found
files['spike']=(files['spike'][0],find_fbx_hash(spikePromotion))
assert files['spike'][1],'Require the approved spike source hash before importing the reference'
refs=[]
for a in proposal['anchors']:
    if a['role'] not in files:continue
    relative,expected=files[a['role']];path=ROOT/relative;assert sha(path)==expected,(a['role'],'Reference changed')
    before=set(scene.objects);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=False)
    imported=[o for o in scene.objects if o not in before]
    parent=bpy.data.objects.new('PREVIEW_ONLY_'+a['role']+'_reference',None);scene.collection.objects.link(parent)
    for ob in imported:
        if ob.parent not in imported:ob.parent=parent
        ob.name='PREVIEW_ONLY_'+a['role']+'_'+ob.name
    parent.location=world([a['x'],a['y'],a['z']]);parent.scale=(.65,.65,.65);parent.rotation_euler.z=math.radians(a['yawDegrees'])
    refs.append({'role':a['role'],'path':relative,'sha256':expected,'scale':.65,'anchor':[a['x'],a['y'],a['z']],'scope':'Preview only; environment FBX already exported without these objects'})
scene.camera=camera;scene.render.image_settings.file_format='PNG'
cam=proposal['cameraCandidate'];vfov=2*math.atan(math.tan(math.radians(cam['baseVerticalFovDegrees'])/2)*max(1,(1280/720)/(1000/700)))
camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32;camera.data.lens=32/(2*math.tan(vfov/2))
report={'status':'actual-offline-views-not-runtime-acceptance','threads':2,'samples':32,'resolution':[1000,700],'environmentFbxSha256':sha(OUT/'home-island.fbx'),'previewReferences':refs,'bubble':'Empty reserved anchor; no fifth unapproved character substituted','views':[]}
for name,position,target,orthographic in [
 ('home-overview',cam['position'],cam['target'],None),
 ('house-detail',[5.3,5.0,5.3],[.05,1.9,-1.75],7.1),
]:
    camera.data.type='PERSP' if orthographic is None else 'ORTHO'
    if orthographic is not None:camera.data.ortho_scale=orthographic
    camera.location=world(position);camera.rotation_euler=(world(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    path=OUT/('render-'+name+'.png');scene.render.filepath=str(path);started=time.perf_counter();bpy.ops.render.render(write_still=True)
    report['views'].append({'name':name,'positionCocos':position,'targetCocos':target,'orthographicScale':orthographic,'seconds':time.perf_counter()-started,'sha256':sha(path)})
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'home-island-scale-review.blend'))
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('HOME_VIEWS_COMPLETE '+json.dumps(report,ensure_ascii=False))
