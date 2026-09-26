"""Render authored action keyframes after actual source/FBX checks. Single process."""
from pathlib import Path
import bpy,math,json,hashlib,sys
from mathutils import Vector
HERE=Path(__file__).resolve().parent
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
check=read('round-trip-check.json');source=read('source-check.json');collision=read('collision-check.json')
assert check['status']==source['status']==collision['status']=='pass'
assert sha(HERE/'export/giant-claw.fbx')==check['fbx_sha256']
path=HERE/'giant-claw-review-scene.blend';digest=sha(path)
bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
rig=bpy.data.objects['GiantClaw_Rig'];scene=bpy.context.scene
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=760;scene.render.resolution_percentage=100
shots=[
    ('idle','idle',22,(3.35,-5.5,3.2),(.06,0,.60),3.14),
    ('walk','walk',10,(3.35,-5.5,3.2),(.06,0,.60),3.14),
    ('attack','attack',6,(3.35,-5.5,3.2),(.06,0,.60),3.14),
    ('hit','hit',4,(3.35,-5.5,3.2),(.06,0,.60),3.14),
    ('exit','exit',16,(3.35,-5.5,3.2),(.06,0,.50),3.14),
    ('attack-front','attack',6,(.06,-6.4,1.65),(.06,0,.64),3.15),
    ('hit-side','hit',4,(5.5,-.35,2.05),(0,-.05,.62),2.70),
]
selected=None
if '--frames' in sys.argv:selected=set(sys.argv[sys.argv.index('--frames')+1].split(','))
frames=[]
for filename,name,frame,location,target,scale in shots:
    if selected is not None and filename not in selected:continue
    action=next(a for a in bpy.data.actions if a.name==name)
    rig.animation_data.use_nla=False;rig.animation_data.action=None
    for pb in rig.pose.bones:pb.matrix_basis.identity()
    rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    scene.frame_set(frame);bpy.context.view_layer.update()
    camera=scene.camera;camera.location=location
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
    scene.render.filepath=str(HERE/('render-'+filename+'.png'))
    bpy.ops.render.render(write_still=True)
    frames.append({'file':'render-'+filename+'.png','action':name,'frame':frame,'action_seconds':(frame-1)/30,
        'camera':list(location),'target':list(target),'orthographic_scale':scale,
        'note':'Actual evaluated skeleton/skin, rendered from saved merged review scene; not a Cocos screenshot.'})
assert sha(path)==digest,'Review scene unexpectedly modified'
record={'review_scene_sha256':digest,'fbx_sha256':check['fbx_sha256'],'threads':2,'samples':24,'frames':frames,
    'animations_present':['idle','walk','attack','hit','exit'],'human_visual_review':'pending actual image opening'}
(HERE/'review-frames.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('GIANT_CLAW_KEYFRAMES_RENDERED '+json.dumps({'count':len(frames),'threads':2,'samples':24}),flush=True)
