"""Project-original giant-claw boss c01 shape prototype only.
No armature/actions/FBX/GLB/runtime export. Two review renders, editable parts.
Run Blender background with 2 CPU threads and 24 samples.
"""
from pathlib import Path
import bpy, bmesh, math, json, hashlib, sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/giant-claw/candidate-01'
OUT=SOURCE/'textures';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
REFERENCES=[ROOT/p for p in ['game/art-source/enemies/build_shell_carrier.py','game/art-source/enemies/build_armored_crab.py','game/art-source/enemies/armored-crab/candidate-01/armored-crab.blend','game/art-source/enemies/runner-crab/candidate-01/runner-crab.blend','game/art-source/enemies/shell-carrier/candidate-02/shell-carrier.blend','game/art-source/enemies/shell-carrier/candidate-02/export/carrier-colour.png','game/art-source/enemies/shell-carrier/candidate-02/export/carrier-roughness.png']]
REFERENCE_HASHES={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in REFERENCES}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('GIANT_CLAW_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS=[];FEET={};SPECS={}

# Original painted palette. Every visible part uses this one UV colour/roughness
# material. The single eye surface contains iris, pupil and small painted glint.
SIZE=512;TILE=128
PALETTE=[(.56,.205,.185),(.92,.80,.58),(.21,.095,.073),(.74,.315,.225),
         (.96,.90,.75),(.040,.032,.030),(.40,.14,.15),(.94,.82,.58),
         (.31,.12,.135),(.67,.26,.20),(.77,.47,.28),(.58,.28,.20),
         (.80,.39,.27),(.43,.20,.17),(.89,.64,.35),(.93,.86,.69)]
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32);rp=np.ones_like(pixels)
yy,xx=np.mgrid[0:TILE,0:TILE].astype(np.float32)
u=(xx+.5)/TILE;v=(yy+.5)/TILE
for index,col in enumerate(PALETTE):
    row,column=index//4,index%4
    shade=1+.055*np.cos((u-.5)*math.pi)*np.sin(v*math.pi)
    pixels[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=np.array(col)*shade[:,:,None]
    rp[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=.38 if index in (0,3,4,6,9,12) else .45
# Broad, restrained value shading, no copied scratches or metal photographs.
# Original continuous shell, soft raised contour lines and rounded claw fingers.
# Eye UV: one smooth closed ellipsoid; no separate pupil cap/card.
ex=u*2-1;ez=v*2-1
eye=np.ones((TILE,TILE,3),dtype=np.float32);eye[:]=(.94,.88,.72)
for rx,rz,col in [(.72,.78,(.30,.20,.11)),(.60,.68,(.027,.025,.022))]:
    d=np.sqrt(((ex-.025)/rx)**2+((ez+.015)/rz)**2);a=np.clip((1-d)/.035+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.19,.24,.135,.16),(.27,-.31,.047,.061)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.09+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.98,.89))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('GiantClaw_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'giant-colour.png')
atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('GiantClaw_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel())
rough.filepath_raw=str(OUT/'giant-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('GiantClaw_Toy_Atlas');MAT.use_nodes=True
bsdf=MAT.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Specular IOR Level'].default_value=.5
bsdf.inputs['Metallic'].default_value=0
for image,input_name in [(atlas,'Base Color'),(rough,'Roughness')]:
    node=MAT.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    MAT.node_tree.links.new(node.outputs['Color'],bsdf.inputs[input_name])


def meshpart(name,vertices,faces,tile,bone='body',uv_axes=(0,2)):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free();me.update()
    ob=bpy.data.objects.new(name,me);CHAR.objects.link(ob);me.materials.append(MAT)
    ob['planned_joint']=bone;ob['atlas_tile']=tile
    for face in me.polygons:face.use_smooth=True
    uv=me.uv_layers.new(name='ToyAtlasUV')
    mins=[min(p.co[i] for p in me.vertices) for i in uv_axes]
    spans=[max(p.co[i] for p in me.vertices)-mins[j] for j,i in enumerate(uv_axes)]
    for loop in me.loops:
        p=me.vertices[loop.vertex_index].co
        a=(p[uv_axes[0]]-mins[0])/max(spans[0],1e-8)
        b=(p[uv_axes[1]]-mins[1])/max(spans[1],1e-8)
        uv.data[loop.index].uv=((tile%4+.025+.95*a)/4,(tile//4+.025+.95*b)/4)
    PARTS.append(ob);return ob


def loft(name,rings,tile,bone='body',segments=32,uv_axes=(0,2)):
    vertices=[];faces=[]
    for z,rx,ry,cx,cy in rings:
        for j in range(segments):
            a=math.tau*j/segments
            vertices.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    for k in range(len(rings)-1):
        for j in range(segments):
            faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return meshpart(name,vertices,faces,tile,bone,uv_axes)


def ellipsoid(name,center,radii,tile,bone='body',segments=24,rings=12):
    c=Vector(center);vertices=[c+Vector((0,0,radii[2]))];faces=[]
    for k in range(1,rings):
        a=math.pi*k/rings
        for j in range(segments):
            b=math.tau*j/segments
            vertices.append(c+Vector((radii[0]*math.sin(a)*math.cos(b),radii[1]*math.sin(a)*math.sin(b),radii[2]*math.cos(a))))
    vertices.append(c-Vector((0,0,radii[2])));bottom=len(vertices)-1
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for k in range(rings-2):
        for j in range(segments):faces.append((1+k*segments+j,1+(k+1)*segments+j,1+(k+1)*segments+(j+1)%segments,1+k*segments+(j+1)%segments))
    for j in range(segments):faces.append((bottom,1+(rings-2)*segments+(j+1)%segments,1+(rings-2)*segments+j))
    return meshpart(name,[tuple(p) for p in vertices],faces,tile,bone)


def tube(name,points,radii,tile,bone='body',sides=12):
    # Continuous transported frames avoid the directional flips found while
    # reviewing the snail shell. This is an independent original crab source.
    points=[Vector(p) for p in points];vertices=[];faces=[]
    if isinstance(radii,(float,int)):radii=[radii]*len(points)
    tangents=[(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized() for i in range(len(points))]
    axes=[Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))]
    reference=min(axes,key=lambda axis:abs(axis.dot(tangents[0])))
    normals=[tangents[0].cross(reference).normalized()]
    for i in range(1,len(points)):
        n=tangents[i-1].rotation_difference(tangents[i])@normals[-1]
        n-=tangents[i]*n.dot(tangents[i]);n.normalize();normals.append(n)
    for i,p in enumerate(points):
        a=normals[i];b=tangents[i].cross(a).normalized()
        for j in range(sides):vertices.append(tuple(p+radii[i]*(a*math.cos(math.tau*j/sides)+b*math.sin(math.tau*j/sides))))
    for k in range(len(points)-1):
        for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
    return meshpart(name,vertices,faces,tile,bone)


def soft_tube(name,points,radii,tile,bone):
    """Round a pincer finger's authored bend without increasing the whole mesh."""
    points=[Vector(p) for p in points];smooth=[];widths=[]
    for i in range(len(points)-1):
        p0,p1,p2,p3=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for sub in range(3):
            t=sub/3
            smooth.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
            widths.append(radii[i]*(1-t)+radii[i+1]*t)
    smooth.append(points[-1]);widths.append(radii[-1])
    return tube(name,smooth,widths,tile,bone,sides=12)



# Each component is individually editable, with articulation tags only.
# A rig and five actions are explicitly deferred until shape approval.
root=bpy.data.objects.new('GiantClaw_Prototype',None);CHAR.objects.link(root)
root['stage']='shape prototype only; no armature or animations'
root['enemy_kind']='boss';root['display_name']='巨钳蟹'
body=loft('Wide_sturdy_boss_body',[
    (.185,.36,.235,0,.04),(.224,.49,.31,0,.035),(.31,.62,.39,0,.03),
    (.435,.675,.425,0,.045),(.57,.648,.423,0,.054),(.685,.565,.38,0,.06),
    (.755,.40,.28,0,.06),(.788,.18,.12,0,.06),(.79,.015,.012,0,.06)],6,segments=48,uv_axes=(0,1))
belly=ellipsoid('Broad_cream_belly',(0,-.005,.215),(.548,.353,.094),1,segments=36,rings=12)
shell=ellipsoid('Solid_wide_upper_shell',(0,.060,.65),(.716,.458,.380),0,segments=48,rings=20)

# A real thick rolled lower shell edge: closed elliptical torus, no pinched tips.
def elliptical_rim(name,rx,ry,cy,z,radius,tile):
    seg=64;sides=10;verts=[];faces=[]
    for j in range(seg):
        a=math.tau*j/seg;center=Vector((rx*math.cos(a),cy+ry*math.sin(a),z))
        outward=Vector((math.cos(a)/rx,math.sin(a)/ry,0)).normalized()
        for k in range(sides):
            t=math.tau*k/sides;verts.append(tuple(center+outward*radius*math.cos(t)+Vector((0,0,radius*math.sin(t)))))
    for j in range(seg):
        for k in range(sides):faces.append((j*sides+k,j*sides+(k+1)%sides,((j+1)%seg)*sides+(k+1)%sides,((j+1)%seg)*sides+k))
    return meshpart(name,verts,faces,tile,uv_axes=(0,1))
elliptical_rim('Soft_continuous_shell_bumper',.650,.421,.059,.493,.035,3)

# Low, broad keystone and two real contour grooves suggest an especially solid
# shell without recreating the armored crab's six thin wedge plates or spikes.
ellipsoid('Broad_low_shell_keystone',(0,.116,1.006),(.295,.232,.050),3,segments=32,rings=10)
def shell_top(x,y,offset=.006):
    value=max(.002,1-(x/.716)**2-((y-.06)/.458)**2)
    return (x,y,.65+.380*math.sqrt(value)+offset)
for side,label in [(-1,'L'),(1,'R')]:
    points=[]
    for k in range(17):
        t=k/16;y=-.220+.565*t
        x=side*(.277+.163*math.sin(math.pi*t))
        points.append(shell_top(x,y))
    tube('Shallow_rounded_shell_contour_'+label,points,[.004]+[.011]*15+[.004],1,sides=8)

# Eight original wider-set weight-bearing legs; smoothly bent, blunt tips.
for side,label in [(-1,'L'),(1,'R')]:
    for i,(hy,ky,ty,kx,tx) in enumerate([(-.21,-.35,-.52,.78,.815),(-.076,-.13,-.21,.91,.947),
                                       (.086,.17,.255,.943,.978),(.25,.41,.525,.815,.86)]):
        joint=f'leg_{label}{i+1}'
        points=[(side*.527,hy,.36),(side*.655,hy+(ky-hy)*.3,.352),
                (side*kx,ky,.270),(side*(kx+.018),ky+(ty-ky)*.45,.16),
                (side*tx,ty,.064),(side*(tx-.007),ty+.003,.026)]
        leg=soft_tube(joint+'_weight_bearing_leg',points,[.071,.091,.103,.098,.073,.015],6,joint)
        FEET[joint]=leg

# Asymmetry is geometry, not a mirrored claw scaled by a common actor transform.
# The dominant palm is roughly twice the minor palm dimensions.
def rounded_boss_finger(name,controls,radii,tile,joint):
    """Smooth radius derivatives and actual hemispherical ends on a large claw.
    Only the two dominant fingers use this refinement; other parts stay fixed.
    """
    controls=[Vector(p) for p in controls];points=[];widths=[]
    def cubic(a,b,c,d,t):return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
    for i in range(len(controls)-1):
        for sub in range(5):
            t=sub/5
            points.append(cubic(controls[max(0,i-1)],controls[i],controls[i+1],controls[min(len(controls)-1,i+2)],t))
            widths.append(max(.006,cubic(radii[max(0,i-1)],radii[i],radii[i+1],radii[min(len(radii)-1,i+2)],t)))
    points.append(controls[-1]);widths.append(radii[-1])
    tangents=[(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized() for i in range(len(points))]
    axes=[Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))]
    axis=min(axes,key=lambda a:abs(a.dot(tangents[0])))
    normals=[tangents[0].cross(axis).normalized()]
    for i in range(1,len(points)):
        n=tangents[i-1].rotation_difference(tangents[i])@normals[-1]
        n-=tangents[i]*n.dot(tangents[i]);n.normalize();normals.append(n)
    rings=[]
    for angle in (math.pi/6,math.pi/3):
        rings.append((points[0]-tangents[0]*widths[0]*math.cos(angle),widths[0]*math.sin(angle),tangents[0],normals[0]))
    rings.extend((p,r,t,n) for p,r,t,n in zip(points,widths,tangents,normals))
    for angle in (math.pi/3,math.pi/6):
        rings.append((points[-1]+tangents[-1]*widths[-1]*math.cos(angle),widths[-1]*math.sin(angle),tangents[-1],normals[-1]))
    sides=20;verts=[];faces=[]
    for p,r,t,n in rings:
        b=t.cross(n).normalized()
        for j in range(sides):verts.append(tuple(p+r*(n*math.cos(math.tau*j/sides)+b*math.sin(math.tau*j/sides))))
    for k in range(len(rings)-1):
        for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    start=len(verts);verts.append(tuple(points[0]-tangents[0]*widths[0]))
    end=len(verts);verts.append(tuple(points[-1]+tangents[-1]*widths[-1]))
    for j in range(sides):
        faces.append((start,(j+1)%sides,j))
        faces.append((end,(len(rings)-1)*sides+j,(len(rings)-1)*sides+(j+1)%sides))
    return meshpart(name,verts,faces,tile,joint)

palm=Vector((.912,-.505,.664))
soft_tube('Dominant_short_power_arm',[(.49,-.125,.46),(.68,-.30,.49),tuple(palm)],[.125,.142,.155],3,'claw_R')
big=ellipsoid('Dominant_giant_palm',palm,(.322,.257,.300),3,'claw_R',segments=36,rings=18)
outer=[palm+Vector((x,y,z)) for x,y,z in [(.214,-.014,.080),(.336,-.013,.257),(.286,-.025,.445),(.165,-.033,.554),(.025,-.035,.566)]]
inner=[palm+Vector((x,y,z)) for x,y,z in [(-.224,-.03,.067),(-.287,-.043,.251),(-.186,-.047,.394),(-.040,-.047,.401)]]
rounded_boss_finger('Dominant_fixed_round_finger',outer,[.120,.121,.104,.078,.022],1,'claw_R')
rounded_boss_finger('Dominant_moving_round_finger',inner,[.113,.112,.081,.021],1,'jaw_R')
# Single broad smooth palm ridge gives the large pincer a manufactured toy curve.
arc=[]
for k in range(15):
    x=palm.x-.186+.365*k/14;z=palm.z+.010+.030*math.sin(math.pi*k/14)
    hit,p,normal,_=big.ray_cast(Vector((x,-2,z)),Vector((0,1,0)));assert hit
    arc.append(tuple(p+Vector((0,-.003,0))))
tube('Dominant_palm_soft_crease',arc,[.002]+[.006]*13+[.002],9,'claw_R',sides=8)

small_palm=Vector((-.865,-.385,.473))
soft_tube('Minor_short_power_arm',[(-.49,-.12,.39),(-.685,-.275,.42),tuple(small_palm)],[.098,.101,.102],3,'claw_L')
small=ellipsoid('Minor_round_palm',small_palm,(.164,.137,.156),0,'claw_L',segments=28,rings=14)
outer=[small_palm+Vector((-x,-.013,z)) for x,z in [(.104,.051),(.145,.145),(.111,.231),(.056,.268),(.008,.269)]]
inner=[small_palm+Vector((-x,-.018,z)) for x,z in [(-.092,.06),(-.114,.146),(-.075,.224),(-.014,.231)]]
soft_tube('Minor_fixed_round_finger',outer,[.058,.065,.053,.041,.012],1,'claw_L')
soft_tube('Minor_moving_round_finger',inner,[.056,.058,.046,.012],1,'jaw_L')

# The boss has a broader cheek/jaw, inset eye roots, and a confident uneven brow.
# Eyes retain closed painted UV ellipsoids rather than separate sticker discs.
muzzle=ellipsoid('Wide_soft_boss_muzzle',(0,-.374,.502),(.426,.128,.193),1,segments=40,rings=16)
for side,label in [(-1,'L'),(1,'R')]:
    centre=Vector((side*.244,-.381,.797+(.017 if side==1 else 0)))
    socket=ellipsoid('Integrated_eye_socket_'+label,centre+Vector((0,.026,.004)),(.173,.120,.194),0,'eye_'+label,segments=28,rings=16)
    eye=ellipsoid('Spherical_boss_eye_'+label,centre+Vector((0,-.040,0)),(.140,.093,.151),4,'eye_'+label,segments=36,rings=18)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co-(centre+Vector((0,-.04,0)))
        a=max(.007,min(.993,.5+.5*p.x/.140));b=max(.007,min(.993,.5+.5*p.z/.151))
        eye.data.uv_layers.active.data[loop.index].uv=(a/4,(1+b)/4)
    brow=[]
    for k in range(15):
        t=k/14;x=side*(.112+.253*t)
        z=.902+.024*t+.015*math.sin(math.pi*t)+(.017 if side==1 else 0)
        hit,p,normal,_=socket.ray_cast(Vector((x,-2,z)),Vector((0,1,0)));assert hit,(label,x,z)
        y=p.y-.007
        brow.append((x,y,z))
    tube('Broad_confident_brow_'+label,brow,[.007,.022]+[.036]*11+[.022,.007],1,'eye_'+label,sides=12)
    # Cheek pads are soft geometry, large enough to survive smaller display.
    hit,p,normal,_=muzzle.ray_cast(Vector((side*.350,-2,.573)),Vector((0,1,0)));assert hit
    ellipsoid('Warm_cheek_'+label,p+Vector((0,-.004,0)),(.061,.015,.033),9,segments=18,rings=10)
def muzzle_front(x,z):
    hit,p,normal,_=muzzle.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    assert hit,(x,z)
    return p+Vector((0,-.004,0))
mouth=[tuple(muzzle_front(-.168+.336*k/20,.463+.035*(2*k/20-1)**2+.009*(k/20))) for k in range(21)]
tube('Confident_offcentre_smile',mouth,[.003]+[.010]*19+[.003],5,sides=10)
# Small rounded mouth corner dimples; no fangs, spikes, labels, or crown.
for side in (-1,1):
    p=muzzle_front(side*.175,.505+(.007 if side==1 else 0))
    ellipsoid('Mouth_corner_'+('R' if side==1 else 'L'),p,(.012,.006,.017),9,segments=12,rings=8)

ground=min(v.co.z for ob in PARTS for v in ob.data.vertices)
for ob in PARTS:
    for v in ob.data.vertices:v.co.z-=ground
    ob.parent=root
scene=bpy.context.scene;scene.frame_set(1)
# Source-level topology checks only; animation and FBX validation are not part
# of this shape prototype, and are deliberately not reported as completed.
parts={}
for ob in PARTS:
    bm=bmesh.new();bm.from_mesh(ob.data)
    try:
        assert all(e.is_manifold for e in bm.edges),ob.name+' nonmanifold'
        volume=bm.calc_volume(signed=True);assert volume>0,ob.name+' nonpositive volume'
    finally:bm.free()
    assert len(ob.data.materials)==len(ob.data.uv_layers)==1
    parts[ob.name]={'vertices':len(ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons),
        'planned_joint':ob.get('planned_joint'),'closed_positive_volume':True}
triangles=sum(p['triangles'] for p in parts.values())
assert triangles<=24000,triangles
bounds={'min':[min(v.co[i] for ob in PARTS for v in ob.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for ob in PARTS for v in ob.data.vertices) for i in range(3)]}
dims=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
assert abs(bounds['min'][2])<1e-6
stats={'version':'giant-claw-shape-candidate-01','enemy_kind':'boss','display_name':'巨钳蟹',
    'stage':'Editable shape prototype only; no rig/actions/FBX/runtime export',
    'triangles':triangles,'vertices':sum(p['vertices'] for p in parts.values()),'editable_mesh_count':len(PARTS),
    'material_count':1,'material':'GiantClaw_Toy_Atlas','bone_count':0,'action_count':0,
    'walking_legs':len(FEET),'parts':parts,'bounds_blender_xyz':bounds,'dimensions_blender_width_depth_height':dims,
    'provisional_model_scale':1.0,'expected_width_height_depth_at_scale1':[dims[0],dims[2],dims[1]],
    'source_forward':'Blender -Y; Blender Z up; foot origin Z=0',
    'future_axis_contract':'Follow existing enemies: FBX forward=-Z/up=Y, expected Cocos +Z; no export performed',
    'proportions':{'dominant_palm_radii':[.322,.257,.300],'minor_palm_radii':[.164,.137,.156],
        'palm_width_ratio':.322/.164,'shell_width':1.432,'shell_height':.76,
        'carrier_c02_width_at_scale1':1.3589516878128052,'prototype_width_to_carrier_ratio':dims[0]/1.3589516878128052},
    'mechanism_reference':'core boss unchanged: hp2400 armor20 resist20 speed.45 attack60 interval1.8 range3 leak10. Prototype does not add abilities or change damage timing.',
    'atlas':{'size':[512,512],'colour':'sRGB','roughness':'Non-Color RGB grayscale .38-.45','alpha':1,'nonmetal_F0':.04},
    'source':'Project-original new body/face/claw silhouette and dimensions, reusing internal crab-family mesh/UV construction helpers from build_shell_carrier.py. Only internal A4/environment/runner/armored/carrier references; no external games or stock assets.',
    'protected_reference_hashes':REFERENCE_HASHES,'status':'Awaiting parent shape review; not final art or runtime asset'}
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'giant-claw-prototype.blend'))
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Same family studio light/exposure; geometry, not lighting, supplies boss cues.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=840;scene.render.resolution_percentage=100
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
cd=bpy.data.cameras.new('Giant_claw_review_camera');cam=bpy.data.objects.new(cd.name,cd)
scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
def aim(loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale
aim((3.35,-5.5,3.2),(.06,0,.60),3.14)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'giant-claw-review-scene.blend'))
for name,loc,target,scale in ([] if '--no-render' in sys.argv else [
    ('three-quarter',(3.35,-5.5,3.2),(.06,0,.60),3.14),
    ('front',(.06,-6.4,1.65),(.06,0,.64),3.15)]):
    aim(loc,target,scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
for path,digest in REFERENCE_HASHES.items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,'Protected source changed: '+path
print('GIANT_CLAW_SHAPE_COMPLETE '+json.dumps({'triangles':triangles,'parts':len(PARTS),'bounds':bounds,'dimensions':dims,'bones':0,'actions':0,'fbx_exported':False}),flush=True)
