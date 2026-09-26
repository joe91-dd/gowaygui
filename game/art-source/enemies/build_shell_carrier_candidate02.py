"""Bounded shell-carrier c02: only replace the carried shell mesh with a soft rim.
Read frozen c01 blend; preserve body/face/limbs, rig, animation, original atlases.
No runtime writes. Blender --background --factory-startup -t 2 --python-exit-code 1.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/shell-carrier/candidate-02'
C01=SOURCE.parent/'candidate-01';OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
REFERENCES=[p for p in C01.rglob('*') if p.is_file()]+[ROOT/'game/art-source/enemies/build_shell_carrier.py']
REFERENCE_HASHES={p.relative_to(ROOT).as_posix():sha(p) for p in REFERENCES}
prior=json.loads((C01/'model-stats.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(C01/'shell-carrier.blend'),load_ui=False,use_scripts=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;rig=bpy.data.objects['ShellCarrier_Rig']
fan=bpy.data.objects['Large_carried_fan_shell'];MAT=bpy.data.materials['ShellCarrier_Toy_Atlas']
old_bounds={'min':[min(v.co[i] for v in fan.data.vertices) for i in range(3)],
            'max':[max(v.co[i] for v in fan.data.vertices) for i in range(3)]}
old_triangles=sum(len(p.vertices)-2 for p in fan.data.polygons)
# Reuse the exact original PNG bytes; retain original image names/colorspaces.
for name,image_name in [('carrier-colour.png','ShellCarrier_Colour_512'),('carrier-roughness.png','ShellCarrier_Roughness_512')]:
    (OUT/name).write_bytes((C01/'export'/name).read_bytes())
    bpy.data.images[image_name].filepath_raw=str(OUT/name)
    bpy.data.images[image_name].pack()

def fan_position(u,v,inset):
    # Keep the original scalloped footprint. Inset front/back faces make room
    # for a genuine elliptical round-over; no edge darkening or light changes.
    r=.07+.93*v
    a=-1.10+2.20*u
    if inset:
        r=.107+.856*v
        a=-1.061+2.122*u
    phase=math.tau*7*u
    scallop=1+.017*math.cos(phase)*r**5
    x=.535*r*math.sin(a)/math.sin(1.10)*scallop
    z=.478+.690*r*math.cos(a)*scallop
    s=max(0,math.sin(math.pi*r))
    # A broad cosine pleat replaces c01's narrow cosine-cubed ridge.
    # Relief is geometrically shallower and continuously differentiable.
    ridge=.5+.5*math.cos(phase)
    front=.135+.102*r-.145*s-.0115*ridge*s
    thickness=.075+.016*s
    return Vector((x,front+thickness*.5,z)),thickness*.5

angular=56;radial=10;rim_steps=6
verts=[];faces=[];uvs=[]
def vertex(p):verts.append(tuple(p));return len(verts)-1
def uv_value(u,v,tile):return ((tile%4+.025+.95*u)/4,(tile//4+.025+.95*v)/4)
def quad(indices,coords):faces.append(indices);uvs.append(coords)
def tile_for(u):return 7 if math.cos(math.tau*7*u)>.5 else 3
for layer in (0,1):
    for ri in range(radial+1):
        for ai in range(angular+1):
            p,half=fan_position(ai/angular,ri/radial,True)
            p.y+=(-1 if layer==0 else 1)*half
            vertex(p)
count=(angular+1)*(radial+1)
for layer in (0,1):
    for ri in range(radial):
        for ai in range(angular):
            coords=[(ai/angular,ri/radial),((ai+1)/angular,ri/radial),
                    ((ai+1)/angular,(ri+1)/radial),(ai/angular,(ri+1)/radial)]
            ids=(layer*count+ri*(angular+1)+ai,layer*count+ri*(angular+1)+ai+1,
                 layer*count+(ri+1)*(angular+1)+ai+1,layer*count+(ri+1)*(angular+1)+ai)
            tile=tile_for((ai+.5)/angular) if layer==0 else 3
            tex=[uv_value(u,v,tile) for u,v in coords]
            quad(ids if layer==0 else tuple(reversed(ids)),tex if layer==0 else list(reversed(tex)))
# Ordered border of the grid, including hinge and side edges. Each end shares
# the front/back face vertices; intermediate rings form a closed smooth rim.
boundary=list(range(angular+1))+[ri*(angular+1)+angular for ri in range(1,radial+1)]
boundary += [radial*(angular+1)+ai for ai in range(angular-1,-1,-1)]+[ri*(angular+1) for ri in range(radial-1,0,-1)]
rings=[boundary]
for step in range(1,rim_steps):
    t=math.pi*step/rim_steps;ring=[]
    for index in boundary:
        ri,ai=divmod(index,angular+1);u=ai/angular;v=ri/radial
        inside,half=fan_position(u,v,True);outside,_=fan_position(u,v,False)
        # Half-ellipse tangent matches broad front/back faces and turns through
        # the true exterior, with no flat wall or knife-like perimeter edge.
        p=inside.copy()
        p.x=outside.x+(inside.x-outside.x)*(1-math.sin(t))
        p.z=outside.z+(inside.z-outside.z)*(1-math.sin(t))
        p.y=inside.y-half*math.cos(t)
        ring.append(vertex(p))
    rings.append(ring)
rings.append([i+count for i in boundary])
for step in range(rim_steps):
    for j in range(len(boundary)):
        k=(j+1)%len(boundary)
        # Reuse c01's cream rim palette, unchanged texture/material values.
        quad((rings[step][j],rings[step][k],rings[step+1][k],rings[step+1][j]),[uv_value(.5,.5,1)]*4)
# Preserve the exact c01 shell bounding box (and therefore total character
# width/height/depth) while softening only its local surface transitions.
raw_min=[min(p[i] for p in verts) for i in range(3)]
raw_max=[max(p[i] for p in verts) for i in range(3)]
verts=[tuple(old_bounds['min'][i]+(p[i]-raw_min[i])/(raw_max[i]-raw_min[i])*(old_bounds['max'][i]-old_bounds['min'][i]) for i in range(3)) for p in verts]
mesh=bpy.data.meshes.new('Large_carried_fan_shell_rounded_c02_mesh')
mesh.from_pydata(verts,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
# Preserve UV correspondence through bmesh normal recalculation using original
# polygon vertex IDs, rather than relying on potentially reversed loop order.
bm.to_mesh(mesh);bm.free();mesh.update()
uv=mesh.uv_layers.new(name='ToyAtlasUV')
for pi,poly in enumerate(mesh.polygons):
    mapping={idx:coord for idx,coord in zip(faces[pi],uvs[pi])}
    for li in poly.loop_indices:uv.data[li].uv=mapping[mesh.loops[li].vertex_index]
for p in mesh.polygons:p.use_smooth=True
mesh.materials.append(MAT)
old_mesh=fan.data;fan.data=mesh
fan.vertex_groups.clear();fan.vertex_groups.new(name='carried_shell').add(list(range(len(mesh.vertices))),1,'REPLACE')
if old_mesh.users==0:bpy.data.meshes.remove(old_mesh)
PARTS=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=bpy.data.actions['idle'].slots[0];scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shell-carrier.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['Rounded_carrier_body'];bpy.ops.object.join()
merged=bpy.context.object;merged.name='ShellCarrier_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
assert triangles<=16000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'shell-carrier.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'shell-carrier.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dimensions=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats=dict(prior);stats.update({'version':'shell-carrier-candidate-02','vertices':len(merged.data.vertices),'triangles':triangles,
    'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dimensions,'dimensions_at_recommended_scale':dimensions,
    'fbx_sha256':sha(OUT/'shell-carrier.fbx'),'protected_reference_hashes':REFERENCE_HASHES,
    'source':'Bounded project-original revision from frozen c01: only carried fan shell mesh/UV transition replaced; all other editable parts, rig/actions and PNG bytes retained. No external asset.',
    'change':{'mesh':'Large_carried_fan_shell','old_mesh_triangles':old_triangles,'new_mesh_triangles':2*angular*radial*2+len(boundary)*rim_steps*2,
              'rim_cross_section':'six-segment half ellipse shared with front/back surfaces','rib_profile':'broad smooth cosine, 0.0115 relief before bounds fit',
              'old_shell_bounds':old_bounds,'shell_bounds_preserved':True,'material_and_light_changes':False},
    'status':'Isolated single c02 shell-rounding review candidate; not runtime promoted or final art.'})
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# Match the ink sample's actual studio, exposure, soft key/fill/rim and AgX.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=920;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
fm=bpy.data.materials.new('REVIEW_ONLY_warm_sand');fm.use_nodes=True
fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
floor=bpy.context.object;floor.name='REVIEW_ONLY_floor';floor.data.materials.append(fm)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    ld=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    ob=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Runner_review_camera');cam=bpy.data.objects.new(cd.name,cd)
scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
def aim(loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale
aim((2.6,-4.8,2.55),(0,.03,.55),1.97)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shell-carrier-review-scene.blend'))
for name,loc,target,scale in ([] if '--no-render' in sys.argv else [
    ('three-quarter',(2.6,-4.8,2.55),(0,.03,.55),1.97),
    ('battle-angle',(2.8,-4.9,5.20),(0,0,.56),2.04)]):
    aim(loc,target,scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
for path,digest in REFERENCE_HASHES.items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,'Protected source changed: '+path
print('SHELL_CARRIER_C02_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)

