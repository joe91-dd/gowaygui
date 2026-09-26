"""Leaf c03 shape-only prototype. No FBX/GLB export and no animation rebuild.
Blender -b -t 2 --python-exit-code 1 --python THIS [-- --sample].
The optional sample shows three authored overlapping leaves before full-shell QA.
"""
import ast,bpy,bmesh,hashlib,json,math,random,shutil,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'game/art-source/leaf-turtle/candidate-03';INPUT=HERE/'inputs';TEX=HERE/'textures'
for p in [HERE,INPUT,TEX]:p.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
C02=ROOT/'game/art-source/leaf-turtle/candidate-02'
FOUNDATION=INPUT/'authored-leaf-c02.blend'
FUNCTIONS=INPUT/'authored_leaf_c02_functions.py'
for source,target,digest in [
 (C02/'leaf-turtle.blend',FOUNDATION,'497b43e76520b70d3caec9192e1ee13e84930661d7266029bd58dc31208a694e'),
 (ROOT/'game/art-source/build_leaf_turtle_candidate02.py',FUNCTIONS,'ddd3ec6b3ae28856ce397d1f43c7f7ae0f856ef5617d2da03125d8bde8b732ae')]:
    if not target.exists():shutil.copy2(source,target)
    assert sha(target)==digest,('Frozen local input mismatch',target)
protected_paths=[]
for version in ['candidate-01','candidate-02']:
    protected_paths += [p for p in (HERE.parent/version).rglob('*') if p.is_file()]
for species in ['stone-turtle','spike-turtle','crystal-turtle']:
    protected_paths += [p for p in (ROOT/'game/assets/resources/models'/species).glob('*') if p.is_file() and not p.name.endswith('.meta')]
protected={str(p.relative_to(ROOT)):sha(p) for p in protected_paths}
bpy.ops.wm.open_mainfile(filepath=str(FOUNDATION))
scene=bpy.context.scene;scene.render.fps=30;scene.frame_set(1)
rig=next(o for o in scene.objects if o.type=='ARMATURE')
CHAR=bpy.data.collections['LEAF_TURTLE_EDITABLE_PARTS']
parts=[o for o in CHAR.objects if o.type=='MESH' and 'bone' in o]
for ob in list(parts):
    if ob.name=='Leaf_shell_core' or ob.name.startswith('Layered_leaf_'):
        parts.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
MATS=[]
for i in range(16):
    name='LeafAtlas_%02d'%i
    material=bpy.data.materials.get(name)
    if material is None:
        material=bpy.data.materials['LeafAtlas_01'].copy();material.name=name
    MATS.append(material)
for image in [i for i in bpy.data.images if i.name.startswith('LeafTurtle_')]:
    name='leaf-roughness.png' if 'Roughness' in image.name else 'leaf-colour.png'
    shutil.copy2(C02/'export'/name,TEX/name);image.filepath=str(TEX/name)
    assert image.packed_file
parsed=ast.parse(FUNCTIONS.read_text(encoding='utf-8'))
helper=next(n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='objmesh')
exec(compile(ast.Module(body=[helper],type_ignores=[]),str(FUNCTIONS),'exec'),globals())
SAMPLE='--sample' in sys.argv
non_leaf=list(parts)
if SAMPLE:
    for ob in non_leaf:ob.hide_render=True

# A lower internal support dome plus ordered, individually arched leaves.
# The exposed upper leaf tip is always radially above the next lower leaf belly.
RX,RY,Z,H=.91,1.025,.46,.43
def shell_surface(u,v,offset=0):
    r=max(.00001,math.hypot(u,v));a=min(1.075,r)*math.pi/2
    sn=math.sin(a);cs=math.cos(a)
    p=Vector((RX*u/r*sn,RY*v/r*sn,Z+H*cs))
    n=Vector((u/r*sn/RX,v/r*sn/RY,cs/H)).normalized()
    return p+n*offset,n
def core():
    vertices=[(0,0,Z+H)];faces=[];N=64;NR=15
    for ring in range(1,NR+1):
        for j in range(N):
            a=2*math.pi*j/N;vertices.append(tuple(shell_surface(ring/NR*math.cos(a),ring/NR*math.sin(a))[0]))
    for j in range(N):faces.append((0,1+j,1+(j+1)%N))
    for ring in range(NR-1):
        for j in range(N):
            a=1+ring*N+j;b=1+ring*N+(j+1)%N;faces.append((a,b,b+N,a+N))
    faces.append(tuple(1+(NR-1)*N+j for j in range(N-1,-1,-1)))
    return objmesh('Leaf_shell_core',vertices,faces,15)

# Dense samples around the top midrib form a shallow rounded relief without
# white outlines, sharp incisions, or a spike. Root and tip have distinct profiles.
ACROSS=[-1,-.93,-.74,-.48,-.22,-.075,0,.075,.22,.48,.74,.93,1]
BELOW=[.86,.52,0,-.52,-.86]
STEPS=[.008,.026,.058,.10,.16,.24,.34,.45,.56,.67,.77,.85,.91,.952,.978,.991,.997]
def leaf(name,u,v,yaw,length,width,offset,tile,phase):
    sweep=Vector((math.cos(yaw),math.sin(yaw)));across=Vector((-sweep.y,sweep.x))
    vertices=[];faces=[];uvs=[];ring_size=len(ACROSS)+len(BELOW)
    for s in STEPS:
        wave=math.sin(math.pi*s)
        leaf_width=width*wave**.55*(1.13-.30*s)
        root_fade=min(1,s/.26);root_fade=root_fade*root_fade*(3-2*root_fade)
        center_lift=max(0,offset-.105)+min(.105,offset)*root_fade
        center_lift += .023*wave+.034*s**5
        bow=.024*wave*math.sin(phase)
        for t,top in [(t,True) for t in ACROSS]+[(t,False) for t in BELOW]:
            q=Vector((u,v))+sweep*(length*(s-.45))+across*(leaf_width*t+bow)
            profile=max(0,1-t*t)**.58
            cross=(.045 if top else -.021)*wave**.6*profile
            midrib=.0125*math.exp(-(t/.085)**2)*wave**.75 if top else 0
            # Shallow cupping and a slight asymmetry keep the soft lamina organic.
            cupping=.008*t*t*wave*(.8+.2*math.sin(phase))
            point,normal=shell_surface(q.x,q.y,center_lift+cross+midrib+cupping)
            vertices.append(tuple(point));uvs.append((.5+.465*t,.04+.92*s))
    for ring in range(len(STEPS)-1):
        for j in range(ring_size):
            faces.append((ring*ring_size+j,ring*ring_size+(j+1)%ring_size,(ring+1)*ring_size+(j+1)%ring_size,(ring+1)*ring_size+j))
    faces.extend([tuple(range(ring_size-1,-1,-1)),tuple((len(STEPS)-1)*ring_size+j for j in range(ring_size))])
    ob=objmesh(name,vertices,faces,tile,smooth=True)
    for polygon in ob.data.polygons:
        for li in polygon.loop_indices:
            tu,tv=uvs[ob.data.loops[li].vertex_index]
            ob.data.uv_layers.active.data[li].uv=((tile%4+.04+tu*.92)/4,(tile//4+.04+tv*.92)/4)
    ob['leaf_direction']='root at s=0, outward rounded short tip at s=1'
    ob['authored_leaf_parameters']={'u':u,'v':v,'yaw':yaw,'length':length,'width':width,'offset':offset,'phase':phase}
    return ob
LEAVES=[];rng=random.Random(81207)
if SAMPLE:
    LEAVES=[(-.19,-.77,-math.pi/2-.16,.42,.215,.025,2,.3),
            (.19,-.77,-math.pi/2+.16,.42,.215,.025,1,1.1),
            (0,-.53,-math.pi/2+.06,.47,.235,.165,3,.7)]
else:
    core()
    for row,(r,count,length,width,offset) in enumerate([
        (.84,15,.38,.190,.025),(.64,13,.43,.212,.165),
        (.415,10,.43,.222,.305),(.20,6,.40,.219,.445)]):
        for j in range(count):
            a=2*math.pi*(j+.47*(row%2))/count+.11*row
            rr=r+rng.uniform(-.024,.024)
            yaw=a+rng.uniform(-.28,.28)+(0.13 if j%2 else -.13)
            LEAVES.append((rr*math.cos(a),rr*math.sin(a),yaw,length*rng.uniform(.94,1.07),width*rng.uniform(.96,1.06),offset+rng.uniform(-.006,.006),2 if row==0 and j%4 else [0,1,3,1,2][(j+row)%5],j*.77+row))
    for j in range(3):
        a=2*math.pi*j/3+.26
        LEAVES.append((.025*math.cos(a),.025*math.sin(a),a,.33,.181,.585,[1,2,1][j],j+.7))
for i,parameters in enumerate(LEAVES):leaf('Layered_leaf_%02d'%i,*parameters)
new_shell=[o for o in parts if o not in non_leaf]
if not SAMPLE:
    xmin=min(v.co.x for o in new_shell for v in o.data.vertices);xmax=max(v.co.x for o in new_shell for v in o.data.vertices)
    for ob in new_shell:
        for vertex in ob.data.vertices:vertex.co.x=(vertex.co.x-(xmin+xmax)/2)*(2.03/(xmax-xmin))
        ob.data.update()
for ob in parts:assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in ob.data.vertices),ob.name
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/('leaf-stack-sample.blend' if SAMPLE else 'leaf-turtle.blend')))
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=800;scene.render.resolution_y=680;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.64,.70,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='Studio_floor'
mat=bpy.data.materials.new('Warm_ivory_floor');mat.use_nodes=True
bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Base Color'].default_value=(.72,.68,.57,1);bsdf.inputs['Roughness'].default_value=.6
floor.data.materials.append(mat)
for name,location,power,size,colour in [('Key',(-3,-4,6),650,4,(1,.91,.74)),('Fill',(4,-1,3),400,3,(.78,.90,1)),('Rim',(1,4,5),800,3,(1,.96,.84))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colour
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=location
    light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('ArtReviewCamera');camera=bpy.data.objects.new('ArtReviewCamera',data)
scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.8

camera.location=(3.6,-5.4,3);camera.rotation_euler=(Vector((0,-.12,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
data.ortho_scale=3.8
# Sample geometry is displayed at 1.8x only for close form inspection; the final
# full-shell view and all non-leaf data use the unchanged c02 camera/coordinates.
if SAMPLE:
    for ob in new_shell:
        for vertex in ob.data.vertices:vertex.co=Vector((vertex.co.x*1.8,(vertex.co.y+.55)*1.8-.20,(vertex.co.z-.50)*1.8+.30))
        ob.data.update()
scene.render.filepath=str(HERE/('leaf-stack-preview.png' if SAMPLE else 'render-three-quarter.png'))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/('leaf-stack-review-scene.blend' if SAMPLE else 'leaf-turtle-review-scene.blend')))
assert protected=={str(p.relative_to(ROOT)):sha(p) for p in protected_paths},'Protected c01/c02/runtime bytes changed'
manifest={'status':'sample form review' if SAMPLE else 'full shell c03 form candidate pending parent review',
    'sample':SAMPLE,'foundation_sha256':sha(FOUNDATION),'frozen_authored_functions_sha256':sha(FUNCTIONS),
    'protected_inputs':protected,'leaf_count':len(LEAVES),'non_leaf_meshes_unchanged':len(non_leaf),
    'triangles_source':sum(len(p.vertices)-2 for ob in parts for p in ob.data.polygons),
    'bones':len(rig.data.bones),'source_actions':[a.name for a in bpy.data.actions],
    'atlas_png_sha256':{p.name:sha(p) for p in TEX.glob('*.png')},'atlas_pixels_edited':False,
    'source_file':str((HERE/('leaf-stack-sample.blend' if SAMPLE else 'leaf-turtle.blend')).relative_to(ROOT)),
    'source_sha256':sha(HERE/('leaf-stack-sample.blend' if SAMPLE else 'leaf-turtle.blend')),
    'threads':2,'samples':32,'resolution':[800,680],'runtime_export_performed':False,'cocos_started':False,
    'shape_parameters':{'core_H':H,'layer_offsets':[.025,.165,.305,.445,.585],'top_cross_section':.045,'midrib_height':.0125,'short_tip_lift':.034},
    'notes':['No FBX or full six-action re-export. Only leaf geometry rebuilt.','Leaf-specific root-to-tip UV and shallow actual midrib geometry; existing original c02 atlases unchanged.','Same full-review camera and lights as c02; three-leaf sample display enlargement is isolated.']}
write(HERE/('sample-manifest.json' if SAMPLE else 'candidate-manifest.json'),manifest)
print('LEAF_C03_PREVIEW_COMPLETE '+json.dumps({'sample':SAMPLE,'leaves':len(LEAVES)}))
