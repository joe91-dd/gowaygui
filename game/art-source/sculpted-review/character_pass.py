"""Authored character geometry and performance, following the existing painted cast.

The face is a remeshed volume; fingers have articulated weighted phalanges.
Eyelids are a weighted surface rooted at the socket, rather than scaled discs.
"""
import bpy, math
from mathutils import Vector


def fused(api,name,spheres,mat,bone,voxel=.016):
    objects=[]
    for p,s in spheres:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=p)
        o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);objects.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object
    remesh=o.modifiers.new('Continuous sculpted volume','REMESH');remesh.mode='VOXEL';remesh.voxel_size=voxel;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=o.modifiers.new('Relax sculpt transitions','SMOOTH');smooth.factor=.8;smooth.iterations=4;bpy.ops.object.modifier_apply(modifier=smooth.name)
    reduce=o.modifiers.new('Retain silhouette','DECIMATE');reduce.ratio=.55;bpy.ops.object.modifier_apply(modifier=reduce.name)
    return api['finish'](o,name,mat,bone)


def face(api,stone):
    oval,curve,finish=api['oval'],api['curve'],api['finish']
    width=.465 if stone else .43
    fused(api,'Continuous cheek and nose sculpt',[
        ((0,-.105,1.92),(width,.345,.36)),
        ((0,-.392,1.792),(.422 if stone else .390,.231,.175)),
        ((0,-.355,1.866),(.292,.18,.149)),
        ((-.275,-.275,1.83),(.185,.18,.16)),((.275,-.275,1.83),(.185,.18,.16)),
    ],'skin','head')
    # Lower jaw shares the mouth silhouette with a recessed smile, not a separate lip ball.
    oval('Lower muzzle',(0,-.407,1.718),(.369,.185,.106),'muzzle','jaw',32)
    cx=.239 if stone else .226;cz=1.999 if stone else 1.982
    rx=.128 if stone else .137;rz=.143 if stone else .155
    for s,side in [(-1,'L'),(1,'R')]:
        x=cx*s
        oval('Inset eye socket '+side,(x,-.343,cz),(rx*1.14,.072,rz*1.14),'skin','head',32)
        oval('Round eye '+side,(x,-.398,cz),(rx,.063,rz),'white','head',32)
        oval('Iris limbal ring '+side,(x+s*.007,-.453,cz),(.102,.018,.119),'irisDark','head',32)
        oval('Iris luminous body '+side,(x+s*.007,-.469,cz-.006),(.087,.010,.103),'iris','head',32)
        oval('Deep pupil '+side,(x+s*.007,-.479,cz+.01),(.065,.011,.086),'pupil','head',32)
        oval('Eye key highlight '+side,(x-.026,-.490,cz+.061),(.026,.008,.030),'white','head',20)
        oval('Eye rim highlight '+side,(x+.034,-.489,cz-.040),(.009,.006,.013),'white','head',16)
        # Narrow outer eye corners and cheek planes create a turtle's expression.
        curve('Skin brow ridge '+side,[(s*.095,-.423,cz+.081),(s*.18,-.458,cz+.119),(s*.31,-.405,cz+.181),(s*.38,-.295,cz+.106)] if stone else [(s*.095,-.365,cz+.097),(s*.18,-.407,cz+.172),(s*.31,-.376,cz+.158),(s*.38,-.295,cz+.096)],.043 if stone else .025,'skin','brow_'+side)
        curve('Upper eye contour '+side,[(x-rx*.90,-.417,cz+.076),(x,-.461,cz+rz*.94),(x+rx*.92,-.415,cz+.07)],.009,'mouth' if stone else 'navy','head')
        eyelid(api,side,x,cz,rx,rz)
        oval('Nostril hollow '+side,(s*.110,-.605,1.854),(.013,.009,.019),'mouth','head',16)
    smile=[]
    for i in range(17):
        x=-.345+i*.043125;z=1.737+.055*(abs(x)/.345)**2+(x*.012 if stone else 0)
        y=-.392-.231*math.sqrt(max(.05,1-(x/(.422 if stone else .390))**2-((z-1.792)/.175)**2))-.005
        smile.append((x,y,z))
    curve('Sculpted smile',smile,.006,'mouth','jaw')
    if stone:
        for x,z,sz in [(0,2.23,.25),(-.235,2.205,.17),(.235,2.205,.17)]:
            api['faceted']('Forehead mineral crown',(x,-.053,z),(sz,.16,.09),'rockLight','head',normal=(x*.5,-.7,1))
        for side in [-1,1]:api['faceted']('Temple mineral rim',(side*.404,-.124,2.046),(.13,.17,.13),'rock','head',normal=(side*.9,-.4,.25))
    else:
        for side in [-1,1]:
            oval('Soft cheek accent',(side*.326,-.352,1.84),(.05,.009,.018),'cheek','head',20)


def eyelid(api,side,cx,cz,rx,rz):
    vertices=[];faces=[];cols=24;rows=10
    for j in range(rows+1):
        t=j/rows;v=1-2*t
        for i in range(cols+1):
            u=-1+2*i/cols;edge=math.sqrt(max(0,1-u*u))
            vertices.append((cx+rx*1.045*u,-.419-.113*edge*math.sqrt(max(0,1-v*v)),cz+rz*1.045*edge*v))
    for j in range(rows):
        for i in range(cols):a=j*(cols+1)+i;faces.append((a,a+cols+1,a+cols+2,a+1))
    mesh=bpy.data.meshes.new('Socket rooted eyelid');mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new('Socket rooted eyelid '+side,mesh);bpy.context.collection.objects.link(o)
    def weights(v):
        u=(v.x-cx)/(rx*1.045);edge=math.sqrt(max(0,1-u*u));amount=max(0,min(1,(rz*1.045*edge-(v.z-cz))/(2*rz*1.045)))
        return {'head':1-amount,'lid_'+side:amount}
    api['finish'](o,'Socket rooted eyelid '+side,'skin',weights=weights)
    # Thin lower closure seam deforms with the same continuous lid surface.
    pts=[]
    for i in range(13):
        u=-.86+i*.14333;edge=math.sqrt(max(0,1-u*u));pts.append((cx+rx*1.045*u,-.427,cz-rz*1.045*edge))
    line=api['curve']('Lid closure seam '+side,pts,.004,'mouth','head')
    line.vertex_groups.clear()
    for v in line.data.vertices:
        for name,w in weights(v.co).items():
            if w>.001:(line.vertex_groups.get(name) or line.vertex_groups.new(name=name)).add([v.index],w,'REPLACE')


def hand(api,stone,side,s,wrist):
    oval,limb,bone=api['oval'],api['limb'],api['add_bone']
    first=len(api['parts']);prior=set(api['bones'])
    grip=not stone and side=='R';x=wrist[0]+(.03 if grip else 0)
    palm=(x-.025,-.23,.892) if grip else (x,-.292,.882)
    fused(api,'Anatomical palm '+side,[(palm,(.118,.078,.15) if grip else (.159,.130,.17)),((x-s*.09,-.266 if grip else -.296,.872),(.082,.085,.103))],'skin','hand_'+side,.013)
    for i in range(3):
        if grip:
            z=.818+i*.074;points=[(x-.06,-.29,z),(x+.015,-.429,z+.015),(x+.10,-.36,z+.012),(x+.10,-.235,z)]
        elif stone:
            xx=x+(i-1)*.09;points=[(xx,-.355,.925),(xx,-.435,.909),(xx,-.47,.845),(xx,-.402,.796)]
        else:
            xx=x+(i-1)*.092;points=[(xx,-.359,.90),(xx+(i-1)*.021,-.417,.945),(xx+(i-1)*.032,-.447,1.002),(xx+(i-1)*.03,-.42,1.024)]
        base='finger_'+side+str(i);tip=base+'_tip';bone(base,points[0],points[1],'hand_'+side);bone(tip,points[1],points[-1],base)
        limb('Articulated finger '+side+str(i),points,[.049,.054,.050,.022] if stone else [.040,.044,.038,.020],'skin',[base,tip])
        oval('Finger tip '+side+str(i),points[-1],(.024,.027,.032),'skin',tip,16)
        if stone:oval('Knuckle plane '+side+str(i),(points[1][0],points[1][1]-.003,points[1][2]+.029),(.040,.029,.023),'muzzle',base,16)
    points=[(x-s*.10,-.30,.91),(x-s*.155,-.37,.868),(x-s*.10,-.429,.829)]
    base='thumb_'+side;tip=base+'_tip';bone(base,points[0],points[1],'hand_'+side);bone(tip,points[1],points[2],base)
    limb('Opposable thumb '+side,points,[.068,.061,.034] if stone else [.048,.045,.027],'skin',[base,tip]);oval('Thumb tip '+side,points[-1],(.035,.04,.038),'skin',tip,16)
    if stone:
        pivot=Vector(wrist)
        for o in api['parts'][first:]:
            for v in o.data.vertices:v.co=pivot+(v.co-pivot)*1.16
        for name in set(api['bones'])-prior:
            h,t,parent=api['bones'][name];api['bones'][name]=(tuple(pivot+(Vector(h)-pivot)*1.16),tuple(pivot+(Vector(t)-pivot)*1.16),parent)


def costume(api,stone):
    curve,oval,faceted=api['curve'],api['oval'],api['faceted']
    if stone:
        for s,side in [(-1,'L'),(1,'R')]:
            for j in [-1,1]:faceted('Segmented ankle guard',(s*.35+j*.105,-.05,.26),(.14,.15,.13),'rockLight' if j==1 else 'rock','shin_'+side,normal=(j*.4,-1,.5))
    else:
        for s,side in [(-1,'L'),(1,'R')]:
            oval('Layered ivory sleeve',(s*.47,-.06,1.27),(.23,.225,.205),'belly','upper_'+side)
            curve('Cuff blue piping',[(s*.58,-.19,1.18),(s*.62,-.11,1.15),(s*.55,.07,1.20)],.022,'navy','upper_'+side)
        cloth_strip(api,'Crossed azure sash A',[(-.275,-.29,1.44),(0,-.416,1.19),(.30,-.34,1.06)],.105,'robe')
        cloth_strip(api,'Crossed azure sash B',[(.26,-.29,1.43),(0,-.44,1.18),(-.30,-.34,1.03)],.102,'navy')
        for s in [-1,1]:
            curve('Cross sash gold stitch',[(s*.26,-.34,1.40),(s*.03,-.465,1.16),(-s*.25,-.39,1.035)],.010,'gold')
        curve('Leather waist belt',[(-.41,-.12,.82),(-.30,-.33,.8),(0,-.449,.8),(.30,-.33,.8),(.41,-.12,.82)],.046,'leather','spine')
        faceted('Belt azure clasp',(0,-.47,.82),(.071,.075,.035),'aqua','spine')
        oval('Belt satchel',(.30,-.36,.68),(.104,.063,.136),'leather','spine',20)
        oval('Satchel flap',(.30,-.419,.748),(.10,.02,.056),'gold','spine',20)


def cloth_strip(api,name,points,width,mat):
    p=[Vector(v) for v in points];vs=[];faces=[];count=20
    for j in range(count+1):
        t=j/count;v=(1-t)**2*p[0]+2*t*(1-t)*p[1]+t*t*p[2];d=2*(1-t)*(p[1]-p[0])+2*t*(p[2]-p[1]);side=Vector((-d.z,0,d.x)).normalized()
        for i in range(3):vs.append(tuple(v+side*((i-1)*width)+Vector((0,-.008 if i==1 else 0,0))))
        if j:
            for i in range(2):k=j*3+i;faces.append((k-3,k,k+1,k-2))
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o
    solid=o.modifiers.new('Tailored seam thickness','SOLIDIFY');solid.thickness=.012;bpy.ops.object.modifier_apply(modifier=solid.name)
    return api['finish'](o,name,mat,'chest')


def animate_hands(rig,role,name,t,hump):
    if role=='crab':return
    attack=name in ['attack','attack_alt','attack_heavy'];gesture=hump(t,0,.43,.94) if attack or name=='skill' else 0
    for side in ['L','R']:
        for i in range(3):
            for suffix in ['', '_tip']:
                p=rig.pose.bones.get('finger_'+side+str(i)+suffix)
                if p:p.rotation_euler.x=(.09 if role=='stone' else -.12 if side=='L' else .015)*gesture
        p=rig.pose.bones.get('thumb_'+side)
        if p:p.rotation_euler.z=(.07 if side=='R' else -.07)*gesture
    if attack or name=='skill':
        rig.pose.bones['jaw'].rotation_euler.x=.035*gesture
        for side,s in [('L',-1),('R',1)]:rig.pose.bones['brow_'+side].rotation_euler.y=s*(.06 if role=='stone' else .025)*gesture
