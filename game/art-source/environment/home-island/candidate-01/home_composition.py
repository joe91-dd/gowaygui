"""Own home-only composition; concatenated with our original geometry routines by the author step.
Not a standalone execution entry point. No combat route or gameplay rules.
"""
DISPLAY=PROPOSAL['anchors'];HOUSE=PROPOSAL['house'];CX,CZ=.05,-2.5
COURT=[(-4.4,-1.30),(-3.8,-1.55),(-1.0,-1.30),(0,-1.65),(1.7,-1.5),(3.2,-1.45),(3.6,-.6),(3.2,1.0),(2.7,3.55),(.3,3.93),(-2.2,3.65),(-4.1,3.35),(-4.45,1.4)]
def inside_polygon(x,z,poly=COURT):
    inside=False
    for (ax,az),(bx,bz) in zip(poly,poly[1:]+poly[:1]):
        if ((az>z)!=(bz>z)) and x<(bx-ax)*(z-az)/(bz-az)+ax:inside=not inside
    return inside
def boundary(th):
    c,s=math.cos(th),math.sin(th)
    f=1+.018*math.sin(5*th+.7)+.012*math.cos(9*th)
    return Vector((6.00*math.copysign(abs(c)**.72,c)*f,4.02*math.copysign(abs(s)**.72,s)*f))
def height(x,z):
    if inside_polygon(x,z):return .08
    # The display foreground is level; only the quiet back rim has small relief.
    return .08+.11*max(0,min(1,(-z-1.8)/1.7))*(.65+.35*math.sin(x*.8)**2)
def safe_decor(x,z,r):
    if any(math.hypot(x-a['x'],z-a['z'])<1.15+r for a in DISPLAY):return False
    if -.90<x<.90 and -1.65<z<.55:return False
    if -2.1<x<2.2 and z<-.90:return False
    return True
def flat_polygon(name,poly,y,tile=20,group='Ground'):
    vectors=[Vector((x,z,0)) for x,z in poly];tri=tessellate_polygon([vectors])
    # Blender 4.5 returns index triples here; retain compatibility with Vector-returning versions.
    faces=[tuple(p if isinstance(p,int) else min(range(len(vectors)),key=lambda i:(vectors[i]-p).length_squared) for p in t) for t in tri]
    return mesh(name,[(x,y,z) for x,z in poly],faces,tile,group,False,True)
def extrude_profile(name,profile,zfront,depth,tile=20,group='Landmarks_and_nature'):
    # profile in x/up plane, actual front/back faces and bevelled wall thickness.
    n=len(profile);vs=[(x,y,z) for z in [zfront,zfront-depth] for x,y in profile]
    fs=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    fs.extend((j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n))
    return mesh(name,vs,fs,tile,group,True)
def arched_profile(cx,bottom,spring,radius,n=20):
    p=[(cx-radius,bottom),(cx+radius,bottom),(cx+radius,spring)]
    p.extend((cx+radius*math.cos(j*math.pi/n),spring+radius*math.sin(j*math.pi/n)) for j in range(1,n+1))
    return p
def plank_box(name,center,size,tile=12):
    # True rectangular plank with clipped corners and bevelled top/bottom, not a diamond rock.
    x,y,z=center;w,h,d=size;cut=min(.035,w*.12,d*.1);vs=[];fs=[]
    for k,(inset,yy) in enumerate([(cut*.5,y-h/2),(0,y-h*.3),(0,y+h*.3),(cut*.5,y+h/2)]):
        a=w/2-inset;b=d/2-inset;c=cut
        outline=[(-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c)]
        vs.extend((x+px,yy,z+pz) for px,pz in outline)
    for k in range(3):
        for j in range(8):fs.append((k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j))
    fs.extend([tuple(range(7,-1,-1)),tuple(range(24,32))]);return mesh(name,vs,fs,tile,smooth=True)

# New modelled island perimeter and ground: no circular stage and no enemy road.
N,NR=96,14;vs=[];fs=[]
for k in range(NR+1):
    for j in range(N):
        q=boundary(j*2*math.pi/N)*(.972*k/NR);vs.append((q.x,height(q.x,q.y),q.y))
for k in range(NR):
    for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Home_continuous_grass',vs,fs,1,'Ground',True,True)
vs=[];fs=[]
for k,(radius,y) in enumerate([(.970,.07),(1.018,-.09),(1.018,-.31),(.94,-1.05)]):
    for j in range(N):
        q=boundary(j*2*math.pi/N)*radius;vs.append((q.x,y+.015*math.sin(j*.8),q.y))
for k in range(3):
    for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Home_warm_sand_rock_skirt',vs,fs,6,'Ground',True)
for i in range(48):
    a=i*2*math.pi/48;q=boundary(a)
    rock('Home_coast_block_%02d'%i,(q.x,-.28,q.y),(.58+RNG.random()*.35,.47+RNG.random()*.22,.48+RNG.random()*.22),[4,5,6][i%3],a)
for i in range(12):
    a=i*2*math.pi/12+.12;q=boundary(a)*1.028
    rock('Home_wet_foot_rock_%02d'%i,(q.x,-.73,q.y),(.60,.28,.43),4,a)
flat_polygon('Continuous_level_display_court',COURT,.16,20)
# Quiet irregular paving on a continuous flat support surface. Seams never remove the supporting floor.
for i in range(12):
    for j in range(9):
        x=-4.15+i*.64+(j%2)*.12;z=-1.15+j*.58
        poly=[(x-.28,z-.23),(x+.27,z-.25),(x+.32,z+.13),(x+.16,z+.25),(x-.26,z+.22)]
        if not all(inside_polygon(a,b) for a,b in poly):continue
        flat_polygon('Courtyard_paver_%02d_%02d'%(i,j),poly,.16025,[20,6,27][(i+j)%3])
for a in DISPLAY:
    # Flat continuous court provides all-yaw foot support; no avatar is exported with the island.
    for j in range(72):
        angle=j*math.pi/36;assert inside_polygon(a['x']+1.02*math.cos(angle),a['z']+1.02*math.sin(angle)),a['name']
    anchor(a['name'],a['x'],a['y'],a['z'])

# Low cream stone foundation supports an actual hollow-front masonry volume.
base=[(CX+2.02*math.sin(i*2*math.pi/32),CZ+1.27*math.cos(i*2*math.pi/32)) for i in range(32)]
flat_polygon('House_cream_foundation',base,.23,6,'Landmarks_and_nature')
for row in range(3):
    for j in range(18):
        a=j*2*math.pi/18+(row%2)*.10
        if min(a%(2*math.pi),2*math.pi-a%(2*math.pi))<.47:continue
        x=CX+1.55*math.sin(a);z=CZ+1.02*math.cos(a)
        rock('House_wall_masonry_%d_%02d'%(row,j),(x,.47+row*.48,z),(.66,.51,.61),20 if (row+j)%3 else 6,a,sides=7)
# Facade side shoulders and curved upper cornice close the silhouette above the doorway.
for x in [-1.18,1.28]:
    for k in range(3):rock('House_front_shoulder_%s_%d'%(x,k),(x,.49+k*.45,-1.39),(.57,.49,.54),20,sides=7)
for j in range(15):
    a=-1.36+j*2.72/14
    rock('House_rounded_cornice_%02d'%j,(CX+1.61*math.sin(a),1.75+.20*math.cos(a),CZ+1.05*math.cos(a)),(.50,.43,.53),6,a,sides=8)
# Teal double door: separate left/right leaf, recessed, curved boundary and simple round portholes.
door=arched_profile(CX,.24,1.22,.60)
extrude_profile('Door_recess_dark',arched_profile(CX,.22,1.24,.69),-1.271,.10,24)
extrude_profile('Door_teal_leaf_pair',door,-1.255,.065,14)
tube('Door_center_seam',[(CX,.25,-1.235),(CX,1.77,-1.235)],.013,24,sides=5)
for side in [-1,1]:
    for y in [.53,.98]:tube('Door_panel_seam_%s_%s'%(side,y),[(CX+side*.03,y,-1.228),(CX+side*.51,y,-1.228)],.008,13,sides=4)
    oval('Door_round_window_%s'%side,(CX+side*.24,1.36,-1.209),(.135,.135,.025),24,n=16,rings=8)
    oval('Door_round_knob_%s'%side,(CX+side*.10,.88,-1.192),(.049,.049,.031),23,n=12,rings=8)
for j in range(11):
    a=j*math.pi/10;x=CX+.77*math.cos(a);y=1.21+.77*math.sin(a)
    rock('Door_arch_ivory_block_%02d'%j,(x,y,-1.20),(.31,.30,.29),6 if j%3==0 else 20,-a,sides=7)
for side in [-1,1]:
    for k in range(3):rock('Door_jamb_%s_%s'%(side,k),(CX+side*.77,.43+k*.28,-1.20),(.29,.31,.30),20,sides=7)
anchor('House_door',CX,.24,-1.18)
# Two independent arched teal windows, low ledges and a tiny eave, all modelled in depth.
for side in [-1,1]:
    # Keep the facade window/ledge inside the house shoulder: the first wide ledge crossed
    # the actual full-sole envelope of the reserved right display position.
    x=CX+side*1.05
    extrude_profile('Window_stone_frame_%s'%side,arched_profile(x,.96,1.29,.20),-1.12,.15,6)
    extrude_profile('Window_teal_inset_%s'%side,arched_profile(x,1.01,1.29,.125),-1.101,.035,14)
    oval('Window_shadow_%s'%side,(x,1.28,-1.075),(.045,.074,.015),24,n=12,rings=8)
    rock('Window_ledge_%s'%side,(x,.95,-1.22),(.48,.14,.23),20,sides=8)

# Original shell roof: fluted, solid scallop fan rising behind a wide pearl cradle.
vs=[];fs=[];RADIAL,RAYS=12,32
for k in range(RADIAL+1):
    t=k/RADIAL;r=.055+2.00*t
    for j in range(RAYS+1):
        a=-1.15+j*2.30/RAYS;flute=.062*math.cos(a*13)*t
        vs.append((CX+math.sin(a)*r,2.23+math.cos(a)*r,CZ-.20-.40*math.sin(t*math.pi/2)+flute))
for k in range(RADIAL):
    for j in range(RAYS):fs.append((k*(RAYS+1)+j,k*(RAYS+1)+j+1,(k+1)*(RAYS+1)+j+1,(k+1)*(RAYS+1)+j))
fan=mesh('House_solid_fluted_shell_roof',vs,fs,20,smooth=True)
bpy.context.view_layer.objects.active=fan;fan.select_set(True)
solid=fan.modifiers.new('Authored_shell_thickness','SOLIDIFY');solid.thickness=.085;bpy.ops.object.modifier_apply(modifier=solid.name);fan.select_set(False)
for j in range(13):
    a=-1.13+j*2.26/12;pts=[]
    for k in range(13):
        t=.04+.96*k/12;r=.055+2*t;pts.append((CX+math.sin(a)*r,2.23+math.cos(a)*r,CZ-.12-.4*math.sin(t*math.pi/2)))
    tube('Roof_ivory_flute_%02d'%j,pts,.028,6,sides=6)
# Raised scalloped bowl around the pearl; openings and flutes are geometry, not texture decals.
for j in range(18):
    a=j*math.pi/9
    rock('Pearl_cradle_masonry_%02d'%j,(CX+1.36*math.sin(a),2.34,CZ+.70*math.cos(a)),(.42,.47,.39),20,a,sides=7)
oval('Home_warm_pearl',(CX,3.11,CZ+.13),(.57,.57,.57),21,'Pearl_and_lamps',n=28,rings=18)
anchor('Home_pearl',CX,3.11,CZ+.13)

# Left short wood pier with individual thick planks, stringers, peg heads and sparse rope rails.
for j in range(14):
    x=-7.26+j*.205
    plank_box('Dock_plank_%02d'%j,(x,-.025,1.35),(.200,.16,1.24),12 if j%3 else 11)
    for z in [.89,1.81]:oval('Dock_peg_%02d_%s'%(j,z),(x,.056,z),(.026,.015,.026),7,n=8,rings=4)
for z in [.90,1.80]:plank_box('Dock_underbeam_%s'%z,(-5.98,-.18,z),(3.05,.25,.16),11)
for i,(x,z) in enumerate([(-7.28,.76),(-7.28,1.94),(-5.03,.76),(-5.03,1.94)]):
    tube('Dock_post_%d'%i,[(x,-.92,z),(x,.41,z)],[.13,.105],11,sides=8)
    for y in [.18,.25]:
        ring=[(x+.113*math.cos(j*math.pi/6),y,z+.113*math.sin(j*math.pi/6)) for j in range(13)]
        tube('Dock_rope_wrap_%d_%s'%(i,y),ring,.022,22,sides=5)
for z in [.76,1.94]:tube('Dock_short_rope_%s'%z,[(-7.28,.34,z),(-6.16,.20,z),(-5.03,.34,z)],.031,22,sides=6)
anchor('Dock_landing',-4.76,.06,1.35)

# Few ropes and palms live on the rear shoulders, away from door/display silhouettes.
for side in [-1,1]:
    x=side*4.90;zs=[-2.8,-1.6,-.40]
    for i,z in enumerate(zs):
        tube('Side_fence_post_%s_%s'%(side,i),[(x,height(x,z),z),(x,height(x,z)+.62,z)],.075,11,sides=7)
        oval('Side_fence_cap_%s_%s'%(side,i),(x,height(x,z)+.65,z),(.115,.08,.115),12,n=12,rings=6)
    for i in range(2):tube('Side_fence_rope_%s_%s'%(side,i),[(x,.57,zs[i]),(x,.43,(zs[i]+zs[i+1])*.5),(x,.57,zs[i+1])],.028,22,sides=6)
for args in [(0,-4.35,-2.25,2.4,.22),(1,3.85,-2.65,2.65,-.18)]:palm(*args)
for i,(x,z) in enumerate([(-4.7,2.65),(-4.8,-.8),(-3.8,-3.25),(3.45,2.25),(4.75,.90),(4.5,-2.90)]):
    if safe_decor(x,z,.34):bush(i,x,z,.34)
for i in range(25):
    a=i*2*math.pi/25;q=boundary(a)*.88
    if not safe_decor(q.x,q.y,.28):continue
    rock('Quiet_home_grass_rock_%02d'%i,(q.x,height(q.x,q.y)+.11,q.y),(.42,.24,.32),5,a)
for i in range(20):
    a=i*math.pi/10;q=boundary(a)*1.04
    tube('Home_foam_%02d'%i,[(q.x-.18,-.70,q.y),(q.x,-.685,q.y+.02),(q.x+.18,-.70,q.y)],.016,30,sides=5,group='Ground')
anchor('Home_origin',0,0,0)

scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
for image in [colour,roughness]:image.pack()
manifest={'version':'home-island-candidate-01','status':'offline-model-generated-runtime-not-promoted','coordinateConvention':'Cocos x/y-up/z; Blender x/-z/y','nominalFootprintXZ':[12,8],'displayAnchors':DISPLAY,'displaySurfaceY':.16,'waterY':-.72,'houseDoor':[CX,.24,-1.18],'pearl':[CX,3.11,CZ+.13],'editableMeshes':len(OBJECTS),'cameraCandidate':PROPOSAL['cameraCandidate'],'characterReferences':PROPOSAL['characterSourceReferences'],'charactersExported':False,'noGameplayRoute':True,'authorship':'New home-only geometry, original own-project modules/UV/pigment atlas; no imported stock/game assets'}
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'home-island.blend'))
stats=[];exported=[]
for group,objects in GROUPS.items():
    if not objects:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=group
    ob.data.materials.clear();ob.data.materials.append(GLOW if group=='Pearl_and_lamps' else MAT)
    for p in ob.data.polygons:p.material_index=0
    stats.append({'name':group,'vertices':len(ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons)});exported.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in exported+ANCHORS:ob.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.fbx(filepath=str(SOURCE/'home-island.fbx'),use_selection=True,object_types={'MESH','EMPTY'},axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=False,path_mode='COPY',embed_textures=True)
points=[ob.matrix_world@v.co for ob in exported for v in ob.data.vertices]
manifest.update(runtimeMeshes=stats,totalTriangles=sum(p['triangles'] for p in stats),materials=2,fbxSha256=hashlib.sha256((SOURCE/'home-island.fbx').read_bytes()).hexdigest(),geometryBoundsCocos={'min':[min(p.x for p in points),min(p.z for p in points),min(-p.y for p in points)],'max':[max(p.x for p in points),max(p.z for p in points),max(-p.y for p in points)]})
assert manifest['totalTriangles']<=80000,manifest['totalTriangles']
(SOURCE/'environment-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# Separate review-only ocean/camera/light scene. It is saved only after environment export.
sea=bpy.data.materials.new('PREVIEW_ONLY_home_ocean');sea.use_nodes=True
bs=sea.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.045,.29,.33,1);bs.inputs['Roughness'].default_value=.28
bpy.ops.mesh.primitive_plane_add(size=160,location=(0,0,-.72));water=bpy.context.object;water.name='PREVIEW_ONLY_OCEAN';water.data.materials.append(sea)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.72,.75,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.75
for name,typ,loc,power,col,size in [('Home_warm_sun','SUN',(-8,12,6),2.7,(1,.93,.78),10),('Home_soft_fill','AREA',(4,8,-7),1100,(.69,.85,1),10)]:
    lightdata=bpy.data.lights.new(name,typ);lightdata.energy=power;lightdata.color=col
    if typ=='AREA':lightdata.shape='DISK';lightdata.size=size
    if typ=='SUN':lightdata.angle=.17
    lightob=bpy.data.objects.new(name,lightdata);scene.collection.objects.link(lightob);lightob.location=world(*loc);lightob.rotation_euler=(-lightob.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Home_review_camera',bpy.data.cameras.new('Home_review_camera'));scene.collection.objects.link(camera);scene.camera=camera
cam=PROPOSAL['cameraCandidate'];camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
vfov=2*math.atan(math.tan(math.radians(cam['baseVerticalFovDegrees'])/2)*max(1,(1280/720)/(1000/700)));camera.data.lens=32/(2*math.tan(vfov/2))
camera.location=world(*cam['position']);camera.rotation_euler=(vworld(cam['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'home-island-review-scene.blend'))
if not EXPORT_ONLY:
    scene.render.filepath=str(SOURCE/'render-home-overview.png');bpy.ops.render.render(write_still=True)
print('HOME_ISLAND_EXPORT_COMPLETE '+json.dumps(manifest,ensure_ascii=False))
