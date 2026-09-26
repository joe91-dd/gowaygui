"""Independent c04 LOD/FBX QA and review renders; never alters approved high source.
Blender -b -t 2 --python-exit-code 1 --python THIS -- --qa-only
Blender -b -t 2 --python-exit-code 1 --python THIS -- --render-only [--views front,battle]
"""
import ast,bpy,bmesh,hashlib,json,struct,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OUT=HERE/'runtime-candidate'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=json.loads((OUT/'lod-manifest.json').read_text(encoding='utf-8'))
def protected():
    for path,digest in manifest['protected_inputs'].items():assert sha(ROOT/path)==digest,('Protected input changed',path)
protected()
EXPECTED={'idle':72,'attack':27,'skill':42,'hit':18,'rest':72,'fusion':60}
def select_action(name,frame=1):
    action=next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()

if '--render-only' not in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'leaf-turtle-lod-parts.blend'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'bone' in o]
    assert len(parts)==116 and len(rig.data.bones)==10
    images=[i for i in bpy.data.images if i.name.startswith('LeafTurtle_') and i.users]
    assert len(images)==2 and all(i.packed_file for i in images),'Packed textures missing'
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for ob in parts for v in ob.data.vertices),'Unnormalized source LOD weights'
    head=bpy.data.objects['Head_sculpt']
    closed=[]
    for ob in [head]+[o for o in parts if o.name.startswith('Layered_leaf_')]:
        bm=bmesh.new();bm.from_mesh(ob.data)
        assert all(e.is_manifold for e in bm.edges),('Non-manifold head/leaf',ob.name)
        bm.free();closed.append(ob.name)
    for name,last in EXPECTED.items():assert list(bpy.data.actions[name].frame_range)==[1,last]
    # Whole-atlas independent reconstruction in a verification directory.
    source=OUT/'inputs/authored_leaf_atlas_source.py';tree=ast.parse(source.read_text(encoding='utf-8'))
    chosen=[n for n in tree.body if (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('PALETTE','ATLAS_PARAMETERS') for t in n.targets)) or (isinstance(n,ast.FunctionDef) and n.name=='build_atlas')]
    assert len(chosen)==3
    namespace={'bpy':bpy,'np':np,'Path':Path};exec(compile(ast.Module(body=chosen,type_ignores=[]),str(source),'exec'),namespace)
    namespace['build_atlas'](OUT/'verification/atlas-rebuild')
    for name in ['leaf-colour.png','leaf-roughness.png']:
        assert (OUT/'verification/atlas-rebuild'/name).read_bytes()==(OUT/'export'/name).read_bytes(),('Atlas differs',name)
    front_polygons=set()
    for p in head.data.polygons:
        center=sum((head.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        if center.y<-1.20 and center.z>.40 and p.normal.y<-.15:front_polygons.add(p.index)
    assert len(front_polygons)>50
    def bvh(objects,front=False):
        vertices=[];polygons=[];graph=bpy.context.evaluated_depsgraph_get()
        for ob in objects:
            evaluated=ob.evaluated_get(graph);mesh=evaluated.to_mesh();offset=len(vertices)
            vertices.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
            for polygon in mesh.polygons:
                if front and polygon.index not in front_polygons:continue
                polygons.append(tuple(offset+i for i in polygon.vertices))
            evaluated.to_mesh_clear()
        return BVHTree.FromPolygons(vertices,polygons,all_triangles=False,epsilon=0)
    shell=[o for o in parts if o['bone']=='shell'];legs=[o for o in parts if o['bone'].startswith('front_')]
    clearance={'method':'Every half-frame of attack/skill/hit. Forward rest head polygons y<-1.20, z>.40, normal.y<-.15. Natural back-head/neck embedding excluded; not continuous-time proof.',
        'source':'separate runtime LOD parts, armature evaluated','forward_face_polygons':len(front_polygons),'clips':{}}
    for name,last in [('attack',27),('skill',42),('hit',18)]:
        rows=[]
        for half in range(2,last*2+1):
            select_action(name,half/2);face=bvh([head],True)
            rows.append({'frame':half/2,'shell':len(face.overlap(bvh(shell))),'front_legs':len(face.overlap(bvh(legs)))})
        clearance['clips'][name]={'samples':rows,'max_shell':max(r['shell'] for r in rows),'max_front_legs':max(r['front_legs'] for r in rows)}
    write(OUT/'animation-clearance.json',clearance)
    assert all(v['max_shell']==v['max_front_legs']==0 for v in clearance['clips'].values()),'Forward face intersection requires correction'

    raw=(OUT/'leaf-turtle.glb').read_bytes();assert raw[:4]==b'glTF'
    length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
    gltf=json.loads(raw[20:20+length]);assert len(gltf['materials'])==1
    assert all(m.get('alphaMode','OPAQUE')=='OPAQUE' and 'KHR_materials_transmission' not in m.get('extensions',{}) for m in gltf['materials'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbx=OUT/'export/leaf-turtle.fbx';bpy.ops.import_scene.fbx(filepath=str(fbx))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
    mesh=meshes[0]
    assert set(a.name.split('|')[-1] for a in bpy.data.actions)==set(EXPECTED)
    assert len(rig.data.bones)==10 and len(mesh.data.materials)==len(mesh.data.uv_layers)==1
    assert rig.data.bones['head'].head_local.y<rig.data.bones['body'].head_local.y
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in mesh.data.vertices)
    def vertices():
        ob=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ob.to_mesh()
        points=np.array([ob.matrix_world@v.co for v in data.vertices]);ob.to_mesh_clear();return points
    select_action('idle',1);rest=vertices();low=rest.min(axis=0).tolist();high=rest.max(axis=0).tolist()
    clow=[low[0],low[2],-high[1]];chigh=[high[0],high[2],-low[1]]
    report={'fbx_sha256':sha(fbx),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'vertices':len(mesh.data.vertices),
        'bones':[b.name for b in rig.data.bones],'materials':[m.name for m in mesh.data.materials],
        'uv_layers':len(mesh.data.uv_layers),'weights_normalized':True,'closed_manifold_head_and_47_leaves':True,
        'packed_source_textures':2,'atlas_rebuild_byte_identical':True,'opaque_single_material_glb':True,
        'rest_bounds_blender_xyz':{'min':low,'max':high,'dimensions':[high[a]-low[a] for a in range(3)]},
        'expected_rest_bounds_cocos_xyz_unscaled':{'min':clow,'max':chigh,'dimensions':[chigh[a]-clow[a] for a in range(3)]},
        'expected_rest_bounds_cocos_xyz_scale_065':{'min':[a*.65 for a in clow],'max':[a*.65 for a in chigh],'dimensions':[(chigh[a]-clow[a])*.65 for a in range(3)]},
        'clips':{}}
    assert 28000<=report['triangles']<=30000
    for name,last in EXPECTED.items():
        action=next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)
        assert list(action.frame_range)==[1,last]
        select_action(name,1);start=vertices();select_action(name,last);end=vertices()
        seam=float(np.linalg.norm(start-end,axis=1).max());motion=0;ground=999
        for half in range(2,last*2+1):
            select_action(name,half/2);points=vertices();motion=max(motion,float(np.linalg.norm(points-start,axis=1).max()));ground=min(ground,float(points[:,2].min()))
        assert seam<.0001 and motion>.0001,(name,'seam or no motion',seam,motion)
        report['clips'][name]={'fbx_name':action.name,'first':1,'last':last,'seconds':(last-1)/30,
            'loop_recommended':name in ('idle','rest'),'max_vertex_motion_m':motion,'loop_seam_m':seam,'minimum_z_m':ground}
    write(OUT/'round-trip-check.json',report)
    assert min(v['minimum_z_m'] for v in report['clips'].values())>-.003,'Foot penetration requires correction'
    write(OUT/'technical-complete.json',{'six_clips_reimported':True,'half_frame_face_samples':sum(len(v['samples']) for v in clearance['clips'].values()),
        'atlas_independent_rebuild':True,'protected_high_preview_and_sources_unchanged':True,'runtime_promoted':False,'cocos_started':False})
    print('LEAF_RUNTIME_TECHNICAL_PASS '+json.dumps({'triangles':report['triangles'],'clips':6,'face_half_frames':sum(len(v['samples']) for v in clearance['clips'].values())}))

if '--qa-only' not in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'leaf-turtle-runtime.blend'))
    scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
    # Load the approved photography rig verbatim, without its high-poly character.
    studio=['Studio_floor','Key','Fill','Rim','ArtReviewCamera']
    with bpy.data.libraries.load(str(HERE/'leaf-turtle-review-scene.blend'),link=False) as (available,loaded):
        loaded.objects=studio;loaded.worlds=available.worlds
    for ob in loaded.objects:scene.collection.objects.link(ob)
    scene.world=loaded.worlds[0];scene.camera=next(o for o in loaded.objects if o.type=='CAMERA')
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=800;scene.render.resolution_y=680;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    views={'front':((0,-6,2.2),(0,-.12,.92),3.8),'three-quarter':((3.6,-5.4,3),(0,-.12,.95),3.8),
        'side':((6,-.6,2.5),(0,0,.95),3.8),'battle':((4.8,-7.4,8.8),(0,-.05,.75),4.8)}
    jobs=[('idle',1,'front','render-front'),('idle',1,'three-quarter','render-three-quarter'),('idle',1,'side','render-side'),('idle',1,'battle','render-battle'),
        ('attack',8,'side','animation-attack-08-side'),('attack',13,'three-quarter','animation-attack-13-three-quarter'),
        ('skill',20,'three-quarter','animation-skill-20-three-quarter'),('rest',36,'three-quarter','animation-rest-36-three-quarter'),
        ('hit',4,'three-quarter','animation-hit-04-three-quarter'),('fusion',23,'three-quarter','animation-fusion-23-three-quarter')]
    if '--views' in sys.argv:
        requested=set(sys.argv[sys.argv.index('--views')+1].split(','));jobs=[j for j in jobs if j[3] in requested or j[3].removeprefix('render-') in requested]
    assert jobs
    for action,frame,view,name in jobs:
        select_action(action,frame);location,target,scale=views[view]
        scene.camera.location=location;scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.camera.data.ortho_scale=scale;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leaf-turtle-lod-review-scene.blend'))
    write(OUT/'render-latest-job.json',{'rendered':[j[3]+'.png' for j in jobs],'threads':2,'samples':32,'width':800,'height':680,'actual_image_review_pending':True})
    print('LEAF_RUNTIME_RENDER_COMPLETE '+json.dumps([j[3] for j in jobs]))
protected()
