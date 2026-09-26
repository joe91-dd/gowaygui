"""Original bubble-turtle c02 static art sample; no LOD, FBX, or promotion.
Scheduling: invoke Blender only after parent confirms the shared renderer slot.
Blender -b -t 2 --python-exit-code 1 --python THIS.
Self-authored c12b body/face/eyes/rig and local mesh/atlas helpers are reused;
the ivory dome, conforming spiral, curved rim and playful brows are authored here.
"""
import ast,bpy,bmesh,hashlib,json,math,shutil
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'game/art-source/bubble-turtle/candidate-02';INPUT=HERE/'inputs';TEX=HERE/'textures'
for p in [HERE,INPUT,TEX]:p.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ORIGINAL=ROOT/'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle.blend'
FOUNDATION=INPUT/'authored-c12b-foundation.blend'
HELPER_SOURCE=ROOT/'game/art-source/build_crystal_turtle_candidate02.py'
HELPERS=INPUT/'authored_mesh_atlas_helpers.py'
for source,target,digest in [
    (ORIGINAL,FOUNDATION,'53f828584edcc3d93c1b28a01883fe768db106a1fd44f27b5f95d729482a4ac3'),
    (HELPER_SOURCE,HELPERS,'9bde104fde65d743c26d796556f257eed0f253f1d9b536b2345dd680daefd21b')]:
    if not target.exists():shutil.copy2(source,target)
    assert sha(target)==digest,('Frozen local foundation mismatch',target)
protected_paths=[ORIGINAL,HELPER_SOURCE,
    ROOT/'game/art-source/spike-turtle/candidate-02/spike-turtle.blend',
    ROOT/'game/art-source/crystal-turtle/candidate-02/crystal-turtle.blend',
    ROOT/'game/art-source/leaf-turtle/source-freeze.json']
leaf_freeze=json.loads((ROOT/'game/art-source/leaf-turtle/source-freeze.json').read_text(encoding='utf-8'))
for path,record in leaf_freeze['files'].items():
    assert sha(ROOT/path)==record['sha256'],('Frozen leaf source changed',path)
    protected_paths.append(ROOT/path)
for species in ['stone-turtle','spike-turtle','crystal-turtle','leaf-turtle']:
    protected_paths += [p for p in (ROOT/'game/assets/resources/models'/species).glob('*') if p.is_file() and not p.name.endswith('.meta')]
C01=ROOT/'game/art-source/bubble-turtle/candidate-01'
protected_paths += [p for p in C01.rglob('*') if p.is_file()]
protected_paths.append(ROOT/'game/art-source/build_bubble_turtle_candidate01.py')
protected={str(p.relative_to(ROOT)):sha(p) for p in protected_paths}
bpy.ops.wm.open_mainfile(filepath=str(FOUNDATION))
scene=bpy.context.scene;scene.render.fps=30
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.name='BubbleTurtle_Rig';rig.data.name='BubbleTurtle_skeleton'
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
scene.frame_set(1);bpy.context.view_layer.update()
CHAR=bpy.data.collections['STONE_TURTLE_EDITABLE_PARTS'];CHAR.name='BUBBLE_TURTLE_EDITABLE_PARTS'
parts=[o for o in CHAR.objects if o.type=='MESH' and 'bone' in o]
for ob in list(parts):
    if ob['bone']=='shell' or ob.name.startswith(('Steady_brow','Friendly_closed_mouth','Cheek_crease')):
        parts.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
def mesh_signature(ob):
    return {'vertices':[[float(c) for c in v.co] for v in ob.data.vertices],
        'polygons':[list(p.vertices) for p in ob.data.polygons],
        'uv':[[float(c) for c in d.uv] for d in ob.data.uv_layers.active.data],
        'weights':[[[g.group,g.weight] for g in v.groups] for v in ob.data.vertices]}
shared_geometry={o.name:mesh_signature(o) for o in parts}
shared_parts=list(parts)

# Reuse the established numeric atlas and mesh functions, with explicit local
# pigment/roughness parameters. No source scene setup or image-editing is run.
PALETTE=[(.840,.790,.665),(.210,.530,.700),(.900,.855,.745),(.095,.340,.455),
    (.300,.420,.285),(.460,.565,.375),(.790,.710,.405),(.470,.580,.405),
    (.032,.068,.046),(.955,.969,.883),(.130,.285,.188),(.018,.038,.027),
    (.685,.765,.560),(.130,.260,.175),(.933,.975,.909),(.540,.548,.438)]
ATLAS_PARAMETERS={'size':1024,'tile_grid':[4,4],'noise_seed':81209,'palette':PALETTE,
    'iris_colour':[.135,.290,.190],'iris_uv_center':[.5,.49],'iris_uv_radii':[.415,.411],
    'pupil_uv_radii':[.302,.314],'roughness_by_tile':[.30,.28,.31,.29,.44,.44,.44,.44,.44,.18,.18,.18,.44,.44,.18,.40],
    'raster_inputs':[],'provenance':'Self-authored full-atlas function from frozen crystal c02; local palette/seed/roughness override and analytic eye UVs. No rendered raster input.'}
tree=ast.parse(HELPERS.read_text(encoding='utf-8'))
selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('build_atlas','objmesh','tube')]
assert len(selected)==3
class LocalAtlasParameters(ast.NodeTransformer):
    def visit_Constant(self,node):
        if isinstance(node.value,str):
            node.value=node.value.replace('CrystalTurtle_','BubbleTurtle_').replace('crystal-colour.png','bubble-colour.png').replace('crystal-roughness.png','bubble-roughness.png')
        return node
    def visit_Assign(self,node):
        if any(isinstance(t,ast.Name) and t.id=='roughness' for t in node.targets):
            return ast.copy_location(ast.parse("roughness=ATLAS_PARAMETERS['roughness_by_tile'][index]").body[0],node)
        return self.generic_visit(node)
module=LocalAtlasParameters().visit(ast.Module(body=selected,type_ignores=[]));ast.fix_missing_locations(module)
exec(compile(module,str(HELPERS),'exec'),globals())
atlas,rough=build_atlas(TEX);write(HERE/'atlas-parameters.json',ATLAS_PARAMETERS)
MATS=[]
for index in range(16):
    mat=bpy.data.materials.new('BubbleAtlas_%02d'%index);mat.use_nodes=True
    bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Specular IOR Level'].default_value=.32
    bsdf.inputs['Alpha'].default_value=1;bsdf.inputs['Transmission Weight'].default_value=0;bsdf.inputs['Metallic'].default_value=0
    for image,socket in [(atlas,'Base Color'),(rough,'Roughness')]:
        texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image;mat.node_tree.links.new(texture.outputs['Color'],bsdf.inputs[socket])
    MATS.append(mat)
for ob in shared_parts:
    ob.data.materials.clear();ob.data.materials.append(MATS[int(ob['atlas_tile'])])
    for polygon in ob.data.polygons:polygon.material_index=0
for mat in list(bpy.data.materials):
    if mat.name.startswith('StoneAtlas_'):bpy.data.materials.remove(mat)
for image in list(bpy.data.images):
    if image.name.startswith('StoneTurtle_'):bpy.data.images.remove(image)

# Keep the approved eye surfaces/opening, short muzzle and two nostrils exactly.
# Personality is supplied by a raised brow and a gently asymmetric corner smile.
head=bpy.data.objects['Head_sculpt']
def face_z(z):return .75+(z-.75)*1.15-.20
def face_surface(x,z,lift=0):
    hit,point,normal,_=head.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    assert hit,('Brow/mouth outside approved head',x,z)
    return point+Vector((0,-lift,0))
for sign,label in [(-1,'L'),(1,'R')]:
    points=[]
    for j in range(19):
        t=j/18
        # Visible right brow sits higher; both ends curve into the forehead.
        z=(.944+.034*math.sin(math.pi*t)-.008*t) if sign>0 else (.899+.030*math.sin(math.pi*t)+.020*t)
        points.append(face_surface(sign*(.177+.224*t),z,.011))
    tube('Playful_asymmetric_brow_'+label,points,.034,13,sides=12)
mouth=[face_surface(t*.315,face_z(.654+.042*t*t+.020*t),.0025) for t in [-1+2*j/30 for j in range(31)]]
tube('Playful_half_smile',mouth,.0063,8,sides=10)

# A closed continuous carapace supplies all silhouette and depth. The spiral is
# a shallow rounded inlay following this same curved surface, not a flat shield.
RX,RY,Z,H=1.00,1.07,.44,1.13
def shell_point(unit,lift=0):
    unit=Vector(unit).normalized();point=Vector((RX*unit.x,RY*unit.y,Z+H*unit.z))
    normal=Vector((unit.x/RX,unit.y/RY,unit.z/H)).normalized()
    return point+normal*lift,normal
vertices=[(0,0,Z+H)];faces=[];N=72;NR=30
for ring in range(1,NR+1):
    phi=ring/NR*math.pi/2
    for j in range(N):
        theta=2*math.pi*j/N
        vertices.append(tuple(shell_point((math.sin(phi)*math.cos(theta),math.sin(phi)*math.sin(theta),math.cos(phi)))[0]))
for j in range(N):faces.append((0,1+j,1+(j+1)%N))
for ring in range(NR-1):
    for j in range(N):
        a=1+ring*N+j;b=1+ring*N+(j+1)%N;faces.append((a,b,b+N,a+N))
faces.append(tuple(1+(NR-1)*N+j for j in range(N-1,-1,-1)))
objmesh('Ivory_continuous_carapace',vertices,faces,0)

# Cap axis faces forward/right and upward so the same spiral remains visible
# from the original A three-quarter view and the A4 front. Its bottom stays above
# the shell opening; the dome continues behind it, including all unseen surfaces.
orientation=math.radians(26);elevation=math.radians(48)
CAP_N=Vector((math.sin(orientation)*math.cos(elevation),-math.cos(orientation)*math.cos(elevation),math.sin(elevation)))
CAP_U=Vector((math.cos(orientation),math.sin(orientation),0));CAP_V=CAP_N.cross(CAP_U).normalized()
def cap_point(u,v,lift=0):
    radius=math.hypot(u,v)
    unit=CAP_N if radius<1e-9 else CAP_N*math.cos(radius)+(CAP_U*u+CAP_V*v)*(math.sin(radius)/radius)
    assert unit.z>-.002,('Spiral would cross shell opening',u,v,unit.z)
    return shell_point(unit,lift)
TURNS=2.1;R0=.080;R1=.740;SEGMENTS=184
SPIRAL_TOP=[-1,-.94,-.74,-.42,0,.42,.74,.94,1]
SPIRAL_BOTTOM=[.8,.4,0,-.4,-.8]
vertices=[];faces=[];semantic=[];ring_size=len(SPIRAL_TOP)+len(SPIRAL_BOTTOM)
def spiral_center(t):
    r=R0+(R1-R0)*t;theta=2*math.pi*TURNS*(t-1)-math.pi/2
    center=Vector((r*math.cos(theta),r*math.sin(theta)))
    tangent=Vector(((R1-R0)*math.cos(theta)-r*math.sin(theta)*2*math.pi*TURNS,
        (R1-R0)*math.sin(theta)+r*math.cos(theta)*2*math.pi*TURNS)).normalized()
    return center,tangent,Vector((-tangent.y,tangent.x))
def add_spiral_ring(center,across,half_width,t,axial=0):
    for s,top in [(v,True) for v in SPIRAL_TOP]+[(v,False) for v in SPIRAL_BOTTOM]:
        uv=center+across*(half_width*s)
        radial=math.sqrt(axial*axial+(1-axial*axial)*s*s)
        bevel=max(0,(radial-.65)/.35)
        profile=max(0,math.cos(min(1,bevel)*math.pi/2))**.65
        lift=(.001+.011*profile) if top else (-.008*math.sqrt(max(0,1-radial*radial)))
        point,_=cap_point(uv.x,uv.y,lift);vertices.append(tuple(point));semantic.append((.06+.88*t,.5+.44*s))
# A same-mesh semicircular cap broadens the inner terminal. It is neither a
# pointed hook nor a separate decorative nub; the cap bevel meets the main band.
first,tangent,across=spiral_center(0)
for degrees in [88,80,65,45,20]:
    angle=math.radians(degrees)
    add_spiral_ring(first-tangent*(.048*math.sin(angle)),across,.048*math.cos(angle),0,math.sin(angle))
for i in range(SEGMENTS+1):
    t=i/SEGMENTS;center,tangent,across=spiral_center(t)
    opening=min(1,t/.10);opening=opening*opening*(3-2*opening)
    ending=min(1,(1-t)/.035);ending=ending*ending*(3-2*ending)
    half_width=.048+.0555*opening*(.56+.44*ending)
    add_spiral_ring(center,across,half_width,t)
ring_count=len(vertices)//ring_size
for i in range(ring_count-1):
    for j in range(ring_size):faces.append((i*ring_size+j,i*ring_size+(j+1)%ring_size,(i+1)*ring_size+(j+1)%ring_size,(i+1)*ring_size+j))
faces.extend([tuple(range(ring_size-1,-1,-1)),tuple((ring_count-1)*ring_size+j for j in range(ring_size))])
spiral=objmesh('Continuous_blue_spiral_inlay',vertices,faces,1)
for loop in spiral.data.loops:
    u,v=semantic[loop.vertex_index];spiral.data.uv_layers.active.data[loop.index].uv=((1+.04+u*.92)/4,(.04+v*.92)/4)

# Fourteen soft blue/ivory collar segments curve around the actual dome. They
# meet the same surface with buried undersides; front collar arches over the neck.
for index in range(14):
    center=2*math.pi*index/14;arc=2*math.pi/14*.992;vertices=[];faces=[];cross=[-1,-.92,-.65,-.3,0,.3,.65,.92,1,.72,0,-.72]
    for row in range(17):
        s=row/16;theta=center+(s-.5)*arc
        band_z=.555+.395*max(0,-math.sin(theta))**5
        latitude=math.asin((band_z-Z)/H)
        end=math.sin(math.pi*s)**.5
        for j,a in enumerate(cross):
            lat=latitude+a*(.094+.005*end)
            unit=(math.cos(lat)*math.cos(theta),math.cos(lat)*math.sin(theta),math.sin(lat))
            top=j<9;lift=(.006+.036*max(0,1-a*a)**.40*(.65+.35*end)) if top else -.012
            vertices.append(tuple(shell_point(unit,lift)[0]))
    count=len(cross)
    for row in range(16):
        for j in range(count):faces.append((row*count+j,row*count+(j+1)%count,(row+1)*count+(j+1)%count,(row+1)*count+j))
    faces.extend([tuple(range(count-1,-1,-1)),tuple(16*count+j for j in range(count))])
    objmesh('Rounded_ivory_blue_collar_%02d'%index,vertices,faces,1 if index%3==0 else 2)

shell=[o for o in parts if o['bone']=='shell']
xmin=min(v.co.x for o in shell for v in o.data.vertices);xmax=max(v.co.x for o in shell for v in o.data.vertices)
for ob in shell:
    for v in ob.data.vertices:v.co.x=(v.co.x-(xmin+xmax)/2)*(2.03/(xmax-xmin))
    ob.data.update()
assert all(mesh_signature(o)==shared_geometry[o.name] for o in shared_parts),'Approved head/eyes/limbs geometry changed'
assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for o in parts for v in o.data.vertices)
for ob in shell:
    bm=bmesh.new();bm.from_mesh(ob.data);assert all(e.is_manifold for e in bm.edges),('Open shell component',ob.name);bm.free()
assert len(rig.data.bones)==10
atlas.pack();rough.pack();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bubble-turtle.blend'))

# Reuse the exact approved family studio; no new art lighting direction.
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
data=bpy.data.cameras.new('ArtReviewCamera');camera=bpy.data.objects.new('ArtReviewCamera',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=3.8
for name,location,target in [('front',(0,-6,2.2),(0,-.12,.92)),('three-quarter',(3.6,-5.4,3),(0,-.12,.95))]:
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(HERE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bubble-turtle-review-scene.blend'))
for path,digest in protected.items():assert sha(ROOT/path)==digest,('Frozen approved payload or original bubble c01 changed',path)
write(INPUT/'provenance.json',{'foundation':str(ORIGINAL.relative_to(ROOT)),'foundation_sha256':sha(FOUNDATION),
    'helpers':str(HELPER_SOURCE.relative_to(ROOT)),'helpers_sha256':sha(HELPERS),
    'helper_functions_reused':['build_atlas','objmesh','tube'],
    'local_changes':'c02 lowers shell height 11.71875%; widens spiral band 50%, lowers relief 50%, rounds inner terminal, broadens collar, slightly strengthens asymmetric brows/smile. Head/eyes/limbs and atlas parameters unchanged from c01.',
    'previous_candidate':str(C01.relative_to(ROOT)),'previous_builder_sha256':sha(ROOT/'game/art-source/build_bubble_turtle_candidate01.py'),
    'reference_images':['output/art/A-潮汐玩具岛.png','output/art/A4-五龟三男两女角色参考.png'],
    'raster_image_inputs':[],'rights':'Project-authored mesh/functions; no external model extraction.'})
write(HERE/'candidate-manifest.json',{'status':'Static shape sample pending actual parent review; no runtime export/promotion.',
    'candidate':'02','species':'bubble','display_name':'泡泡龟','gender':'male','gameplay_role':'control, unchanged',
    'source_sha256':sha(HERE/'bubble-turtle.blend'),'builder_sha256':sha(Path(__file__)),
    'shared_geometry_exactly_retained':list(shared_geometry),'shared_head_and_eye_ratio_unchanged':True,
    'triangles_source':sum(len(p.vertices)-2 for o in parts for p in o.data.polygons),'source_parts':len(parts),
    'bones':len(rig.data.bones),'original_foundation_six_actions_retained_for_editing_only':[a.name for a in bpy.data.actions],
    'bubble_specific_six_animation_qa_complete':False,'runtime_lod_or_fbx_exported':False,'runtime_promoted':False,
    'shell_parameters':{'radius_x':RX,'radius_y':RY,'base_z':Z,'height':H,'normalized_shell_width':2.03,'spiral_turns':TURNS,
        'cap_orientation_degrees':26,'cap_elevation_degrees':48,'spiral_max_angular_radius':R1,'spiral_max_relief':.012,'spiral_max_half_width':.1035,'spiral_inner_radius':R0,'spiral_inner_terminal_radius':.048,
        'collar_segments':14,'collar_arc_coverage':.992,'collar_angular_half_width_range':[.094,.099],
        'previous_shell_height':1.28,'shell_height_reduction_percent':11.71875},
    'atlas':ATLAS_PARAMETERS,'textures_packed':True,'texture_sha256':{p.name:sha(p) for p in TEX.glob('*.png')},
    'opaque_materials':True,'protected_inputs':protected,'render_threads':2,'samples':32,'render_size':[800,680],
    'cocos_started':False})
print('BUBBLE_C02_STATIC_COMPLETE '+json.dumps({'source_triangles':sum(len(p.vertices)-2 for o in parts for p in o.data.polygons),'runtime_exported':False}))

