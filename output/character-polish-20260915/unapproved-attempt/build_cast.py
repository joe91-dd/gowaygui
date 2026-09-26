"""Reference-led five-character Blender source, based on approved 2026-09-15 v2 sheets.

Outputs a separate candidate namespace. The old production cast is never overwritten.
Run Blender --background --threads 2 --python-exit-code 1 --python THIS -- stone [...].
"""
import bpy, sys, math, json, random
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

HERE=Path(__file__).resolve().parent
GAME=HERE.parents[1]
PROJECT=GAME.parent
sys.path.insert(0,str(HERE.parent/'sculpted-review'))
import build_review as B
from character_pass import fused
from finish_pass import add_leg_controls,offset_world
PI=math.pi
ROLES=['stone','spike','crystal','leaf','bubble']
NAMES={'stone':'岩盾','spike':'叶灵','crystal':'珊歌','leaf':'阳光','bubble':'潮行'}
REFERENCE={r:PROJECT/'output/character-turnarounds-20260915'/f'{i+1:02d}-{n}-turnaround-v2.png' for i,(r,n) in enumerate(zip(ROLES,['yandun','yeling','shange','yangguang','chaoxing']))}
parts=B.parts
# Meshes constructed through the data API are not selected automatically. Apply
# transforms to exactly the mesh being finished before assigning bind weights.
# This is also essential before reflecting the approved equipment handedness.
_finish_geometry=B.finish
def finish_geometry(ob,*args,**kwargs):
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    return _finish_geometry(ob,*args,**kwargs)
B.finish=finish_geometry
MATERIALS={
 'skin':('F0B136',.43,0),'muzzle':('F9CA67',.49,0),'belly':('EDCB86',.61,0),'bellyEdge':('B78648',.68,0),
 'mouth':('784C2D',.7,0),'white':('FFF9E9',.22,0),'iris':('BB7728',.25,0),'irisDark':('60311C',.28,0),'pupil':('121D2B',.13,0),
 'rock':('504843',.64,0),'rockLight':('76675E',.59,0),'edge':('39342F',.7,0),
 'aqua':('159CE4',.2,.22),'aquaLight':('73DEFA',.19,.1),'aquaDeep':('075CAB',.23,.16),'gold':('CBA04F',.3,.65),
 'leather':('86502D',.7,0),'wood':('84522F',.51,0),'woodLight':('B4824B',.55,0),
 'jade':('32735D',.6,0),'pine':('173F35',.72,0),'newLeaf':('95B68F',.61,0),'leafMid':('438C65',.56,0),
 'navy':('164984',.63,0),'robe':('F5F0DE',.79,0),'blue':('3586C5',.59,0),
 'orange':('C76439',.69,0),'orangeLight':('DF8950',.63,0),'berry':('A93722',.38,0),
 'straw':('D5A452',.8,0),'strawLight':('E6BE77',.75,0),'bronze':('8B5B29',.33,.62),
 'fire':('FFC477',.22,0),'indigo':('263456',.46,.3),'violet':('9760D9',.22,.22)
}

def mesh(name,vs,fs,mat,bone='chest',smooth=True,weights=None,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active=ob
    if bevel:
        m=ob.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=3
        bpy.ops.object.modifier_apply(modifier=m.name)
    return B.finish(ob,name,mat,bone,smooth,weights)

def oval(name,p,s,mat,bone='chest',seg=32):return B.oval(name,p,s,mat,bone,seg)
def line(name,pts,r,mat,bone='chest'):return B.curve(name,pts,r,mat,bone)
def ring(name,c,rx,ry,mat,bone='chest',r=.018,plane='xy'):
    pts=[]
    for i in range(49):
        a=i*PI/24
        off=(rx*math.cos(a),ry*math.sin(a),0) if plane=='xy' else (rx*math.cos(a),0,ry*math.sin(a))
        pts.append(tuple(c[j]+off[j] for j in range(3)))
    return line(name,pts,r,mat,bone)

def plate(name,c,rx,rz,depth,mat,bone='shell',normal=(0,-1,0),n=6):
    # Broad bevelled polygons with stable silhouette, not sharp polygon discs.
    return B.faceted(name,c,(rx,rz,depth),mat,bone,n,normal)

_crystal_geometry=B.crystal
def crystalline_geometry(name,p,s,mat='aqua',bone='shell',tilt=0):
    ob=_crystal_geometry(name,p,s,mat,bone,tilt)
    if mat=='aqua':
        ob.data.materials.append(B.mats['aquaLight']);ob.data.materials.append(B.mats['aquaDeep'])
        for polygon in ob.data.polygons:
            # Actual contrasting mineral facets, not a flat luminous cone.
            polygon.material_index=1 if polygon.normal.x<-.25 else 2 if polygon.normal.x>.4 else 0
    return ob
B.crystal=crystalline_geometry

def leaf_shape(name,base,tip,width,mat,bone='chest',normal=(0,-1,0)):
    p=Vector(base);d=Vector(tip)-p;axis=d.normalized();normal=Vector(normal).normalized();side=axis.cross(normal).normalized();normal=side.cross(axis).normalized()
    vs=[];fs=[];rows=12
    for j in range(rows+1):
        t=j/rows;w=width*(math.sin(PI*t)**.8);center=p+d*t+normal*(.045*math.sin(PI*t))
        for k in [-1,0,1]:vs.append(tuple(center+side*(w*k)+normal*(.035*math.sin(PI*t)*(1-abs(k)))))
        if j:
            for k in range(2):a=j*3+k;fs.append((a-3,a,a+1,a-2))
    ob=mesh(name,vs,fs,mat,bone)
    bpy.context.view_layer.objects.active=ob;m=ob.modifiers.new('Leaf thickness','SOLIDIFY');m.thickness=.012;bpy.ops.object.modifier_apply(modifier=m.name)
    return ob

def torso_weights(v):
    w=max(0,min(1,(v.z-.88)/.48));return {'spine':1-w,'chest':w}

def setup(role):
    bpy.ops.wm.read_factory_settings(use_empty=True);B.parts=[];B.mats={};B.bones={};random.seed(1324+ROLES.index(role))
    colors=dict(MATERIALS)
    if role=='crystal':colors.update({'skin':('60C4CB',.44,0),'muzzle':('B8E4CC',.48,0),'iris':('2F99CB',.19,0),'irisDark':('174B80',.22,0),'mouth':('346873',.6,0)})
    if role=='bubble':colors.update({'skin':('94B8E6',.44,0),'muzzle':('DAE4F0',.49,0),'iris':('8655D2',.2,0),'irisDark':('423071',.23,0),'mouth':('546582',.65,0)})
    for n,(c,r,m) in colors.items():B.material(n,c,r,m,1.8 if n=='fire' else .18 if n in ['aqua','violet'] else 0)
    # Procedural micro-surface is restrained; the geometry carries the forms.
    for n in ['skin','rock','rockLight','robe','jade','pine','orange','straw']:
        mat=B.mats[n];tree=mat.node_tree;noise=tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=44 if n=='skin' else 28
        bump=tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.10 if n=='skin' else .14;bump.inputs['Distance'].default_value=.012
        tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);tree.links.new(bump.outputs['Normal'],tree.nodes.get('Principled BSDF').inputs['Normal'])

def skeleton(role):
    stone=role=='stone';w=1.19 if stone else 1
    for n,h,t,p in [('root',(0,0,0),(0,0,.2),None),('hips',(0,0,.62),(0,0,.98),'root'),('spine',(0,0,.98),(0,0,1.27),'hips'),('chest',(0,0,1.27),(0,0,1.66),'spine'),('shell',(0,.3,1.0),(0,.3,1.8),'chest'),('neck',(0,-.02,1.64),(0,-.04,1.89),'chest'),('head',(0,-.04,1.89),(0,-.04,2.4),'neck'),('jaw',(0,-.17,1.93),(0,-.5,1.93),'head')]:B.add_bone(n,h,t,p)
    for s,side in [(-1,'L'),(1,'R')]:
        sh=(s*.54*w,.01,1.59);el=(s*.76*w,-.06,1.25);wr=(s*.79*w,-.26,1.06)
        if role in ['crystal','bubble'] and side=='R':el=(s*.79,-.06,1.37);wr=(s*.92,-.31,1.35)
        if role in ['spike','leaf'] and side=='L':el=(s*.77,-.08,1.34);wr=(s*.91,-.34,1.25)
        B.add_bone('clavicle_'+side,(s*.15,0,1.6),sh,'chest');B.add_bone('upper_'+side,sh,el,'clavicle_'+side);B.add_bone('fore_'+side,el,wr,'upper_'+side);B.add_bone('hand_'+side,wr,(wr[0],wr[1]-.18,wr[2]),'fore_'+side)
        hp=(s*.34*w,0,.66);kn=(s*.35*w,-.04,.36);an=(s*.38*w,-.08,.17)
        for n,h,t,p in [('thigh_',hp,kn,'hips'),('shin_',kn,an,'thigh_'+side),('foot_',an,(an[0],-.42,.16),'shin_'+side)]:B.add_bone(n+side,h,t,p)
        B.add_bone('brow_'+side,(s*.27,-.43,2.48),(s*.4,-.43,2.48),'head')
        B.add_bone('lid_'+side,(s*.28,-.51,2.30),(s*.28,-.52,2.45),'head')
    B.add_bone('cape',(0,.25,1.62),(0,.47,.97),'chest')
    B.add_bone('weapon_tip',(0,0,0),(0,0,.15),'root') # replaced by role-specific equipment

def build_body(role):
    stone=role=='stone';w=1.19 if stone else 1
    ob=oval('Continuous torso',(0,0,1.21),(.56*w,.405,.70),'skin');ob.vertex_groups.clear()
    for v in ob.data.vertices:
        for bn,weight in torso_weights(v.co).items():
            if weight>0:(ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn)).add([v.index],weight,'REPLACE')
    oval('Flexible turtle neck',(0,-.015,1.74),(.3,.26,.29),'skin','neck')
    oval('Continuous pelvis',(0,.0,.72),(.58*w,.35,.29),'skin','hips')
    # Complete shell volume and separately articulated border.
    oval('Carapace dark rim',(0,.30,1.26),(.65*w,.34,.76),'edge' if stone else 'gold' if role in ['crystal','bubble'] else 'leather','shell')
    oval('Continuous carapace',(0,.43,1.31),(.61*w,.36,.71),'rock' if stone else 'pine' if role=='spike' else 'navy' if role=='crystal' else 'woodLight' if role=='leaf' else 'indigo','shell')
    for row,z in enumerate([.83,1.20,1.59,1.84]):
        xs=[-.39,0,.39] if row<3 else [-.22,.22]
        for k,x in enumerate(xs):
            y=.43+.36*math.sqrt(max(.06,1-(x/.68)**2-((z-1.30)/.82)**2));normal=(x*.9,1,(z-1.3)*.7)
            mat=('rockLight' if (row+k)%3==0 else 'rock') if stone else 'pine' if role=='spike' else 'navy' if role=='crystal' else 'woodLight' if role=='leaf' else 'indigo'
            if role=='bubble':plate('Gold-bordered shell scute',(x*w,y-.016,z),.265,.267,.086,'gold',normal=normal)
            plate('Carapace scute',(x*w,y,z),.25 if stone else .244,.26 if stone else .245,.17 if stone else .084,mat,normal=normal)
    for s,side in [(-1,'L'),(1,'R')]:
        sh,el,_=B.bones['upper_'+side];wr=B.bones['hand_'+side][0]
        oval('Rounded shoulder joint '+side,sh,(.27*w,.25,.28),'skin','upper_'+side)
        B.limb('Continuous arm '+side,[sh,tuple(Vector(sh).lerp(Vector(el),.55)),el,tuple(Vector(el).lerp(Vector(wr),.55)),wr],[.25*w,.237*w,.18,.21*w,.15],'skin',['upper_'+side,'fore_'+side])
        hand(role,side,wr)
        hp,kn,_=B.bones['thigh_'+side];an=B.bones['foot_'+side][0]
        B.limb('Continuous leg '+side,[hp,tuple(Vector(hp).lerp(Vector(kn),.6)),kn,an],[.27*w,.25*w,.20,.17],'skin',['thigh_'+side,'shin_'+side])
        oval('Sole planted foot '+side,(an[0],-.24,.15),(.29*w,.38,.15),'skin','foot_'+side)
        for i in range(3):
            x=an[0]+(i-1)*.15*w
            oval('Rounded toe '+side+str(i),(x,-.49,.115),(.092*w,.115,.115),'skin','foot_'+side,24)
            if stone:B.crystal('Blue toe crystal '+side+str(i),(x,-.535,.018),(.081,.13,.195),'aqua','foot_'+side,(i-1)*.15)
        if stone:
            oval('Solid shoulder rock volume '+side,(sh[0],.015,1.66),(.35,.22,.30),'rock','upper_'+side)
            plate('Shoulder mass '+side,(sh[0],-.225,1.67),.34,.28,.24,'rockLight','upper_'+side,normal=(s*.23,-1,.5))
            plate('Wrist stone bracer '+side,(wr[0],-.34,1.25),.245,.165,.20,'rock','fore_'+side)
            B.crystal('Wrist crystal '+side,(wr[0]+s*.12,-.415,1.10),(.1,.10,.29),'aqua','fore_'+side,s*.4)
            for k in [-1,1]:plate('Ankle rock guard '+side,(an[0]+k*.13,-.19,.35),.17,.17,.17,'rockLight','shin_'+side,normal=(k*.3,-1,.3))
    if stone or role in ['spike','leaf']:
        oval('Plastron underlayer',(0,-.331,1.10),(.465*w,.122,.555),'bellyEdge','spine')
        # Curved paired scutes fit the belly surface with a narrow seam. The
        # previous flat plates were intersected by their convex underlayer.
        for j,(lo,hi,lower,upper) in enumerate([(.56,.77,.22,.38),(.785,1.035,.39,.47),(1.05,1.325,.47,.465),(1.34,1.64,.46,.32)]):
            for s in [-1,1]:
                outline=[(.012,lo),(lower*w*.86,lo+.015),(lower*w,lo+.060),(upper*w,hi-.065),(upper*w*.88,hi-.015),(.035,hi),(.012,hi-.04)]
                def surface(x,z):return -.31-.205*math.sqrt(max(.12,1-(x/(.67*w))**2-((z-1.1)/.87)**2))
                front=[(s*x,surface(x,z)-.018,z) for x,z in outline]
                back=[(x,y+.065,z) for x,y,z in front];vv=front+back;nn=len(front)
                ff=[tuple(range(nn)),tuple(range(2*nn-1,nn-1,-1))]+[(k,k+nn,(k+1)%nn+nn,(k+1)%nn) for k in range(nn)]
                ob=mesh('Paired abdominal scute',vv,ff,'belly','chest' if j>1 else 'spine',False,bevel=.018)
                # Recompute outward normals after the left/right outline reflection.
                bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    if stone:
        for x,z,h in [(0,2.10,.75),(-.33,2.00,.53),(.33,2.00,.53),(-.61,1.77,.39),(.61,1.77,.39),(0,1.91,.37)]:B.crystal('Back blue crystal',(x,.45 if x else .60,z),(.18 if x==0 else .14,.16,h),'aqua','shell',x*.42)
        for s in [-1,1]:
            plate('Temple armor',(s*.52,-.08,2.23),.16,.20,.16,'rock','head',normal=(s*.7,-.7,.2))
        for x in [-.3,0,.3]:plate('Forehead crown',(x,-.11,2.57),.21,.15,.13,'rockLight','head',normal=(x*.4,-.8,.5))

def hand(role,side,wr):
    grip=(side=='R' and role in ['crystal','bubble']) or (side=='L' and role in ['spike','leaf']);s=-1 if side=='L' else 1;x,y,z=wr
    palm=(x,y-.07,z-.055)
    fused(B.__dict__,'Sculpted palm '+side,[(palm,(.17,.125,.18)),((x-s*.11,y-.06,z-.065),(.08,.09,.12))],'skin','hand_'+side,.014)
    for i in range(3):
        if grip:
            zz=z-.15+i*.098;pts=[(x+s*.10,y-.055,zz),(x+s*.11,y-.17,zz+.008),(x-s*.02,y-.225,zz+.005),(x-s*.06,y-.16,zz-.008)]
        else:
            xx=x+(i-1)*.105;pts=[(xx,y-.09,z+.025),(xx,y-.19,z-.025),(xx,y-.20,z-.14),(xx,y-.1,z-.18)]
        bn='finger_'+side+str(i);B.add_bone(bn,pts[0],pts[1],'hand_'+side);B.add_bone(bn+'_tip',pts[1],pts[-1],bn)
        B.limb('Curled articulated finger '+side+str(i),pts,[.06,.065,.058,.038],'skin',[bn,bn+'_tip'])
        oval('Soft fingertip '+side+str(i),pts[-1],(.039,.044,.045),'skin',bn+'_tip',20)
    pts=[(x-s*.10,y-.035,z+.025),(x-s*.18,y-.13,z-.045),(x-s*.095,y-.205,z-.10)]
    bn='thumb_'+side;B.add_bone(bn,pts[0],pts[1],'hand_'+side);B.add_bone(bn+'_tip',pts[1],pts[2],bn)
    B.limb('Opposing thumb '+side,pts,[.075,.068,.044],'skin',[bn,bn+'_tip']);oval('Thumb tip '+side,pts[-1],(.046,.05,.05),'skin',bn+'_tip',20)

def face(role):
    stone=role=='stone';width=.60 if stone else .54 if role=='leaf' else .52
    fused(B.__dict__,'Continuous facial sculpt',[
        ((0,-.09,2.20),(width,.405,.44)),
        ((0,-.40,2.035),(.52 if stone else .46,.295,.215)),
        ((0,-.34,2.14),(.36,.21,.22)),
        ((-.33,-.23,2.11),(.23,.23,.23 if role=='leaf' else .20)),((.33,-.23,2.11),(.23,.23,.23 if role=='leaf' else .20))
    ],'skin','head',.012)
    # A broad lower muzzle with a continuous mouth line; no detached lip sphere.
    oval('Lower muzzle',(0,-.427,1.975),(.452 if stone else .41,.245,.115),'muzzle','jaw',40)
    rx=.147 if stone else .157 if role!='leaf' else .154;rz=.15 if stone else .169;cx=.275;cz=2.316
    for s,side in [(-1,'L'),(1,'R')]:
        x=s*cx;upper=.86 if role=='stone' else .91 if role=='spike' else .64 if role=='crystal' else .87 if role=='leaf' else .97 if s<0 else .62
        # White globe is inset; lids follow its oval perimeter.
        oval('Eye globe '+side,(x,-.423,cz),(rx,.148,rz),'white','head',40)
        irisx=x-s*.006
        oval('Iris dark limbal edge '+side,(irisx,-.564,cz-.008),(.108,.027,.128),'irisDark','head',40)
        oval('Iris colored surface '+side,(irisx,-.585,cz-.011),(.091,.012,.111),'iris','head',40)
        oval('Pupil '+side,(irisx,-.596,cz+.005),(.064,.011,.092),'pupil','head',32)
        oval('Eye catchlight '+side,(irisx-.028,-.607,cz+.070),(.029,.007,.032),'white','head',20)
        oval('Eye secondary catchlight '+side,(irisx+.035,-.607,cz-.045),(.01,.005,.014),'white','head',16)
        top=[];bottom=[]
        for i in range(25):
            u=-1+2*i/24;edge=math.sqrt(max(0,1-u*u));top.append((x+rx*u,-.425-.222*edge,cz+rz*edge*upper));bottom.append((x+rx*u,-.426-.15*edge,cz-rz*edge*(.74 if role=='leaf' else .94)))
        line('Upper sculpted eyelid '+side,top,.024,'skin','head');line('Lower sculpted eyelid '+side,bottom,.012,'skin','head')
        # Skin canopy fills everything above the chosen eye opening.
        vs=[];fs=[]
        for j in range(9):
            t=j/8
            for i in range(25):
                u=-1+2*i/24;e=math.sqrt(max(0,1-u*u));angle=math.asin(max(-1,min(1,upper*e)))
                z0=cz+rz*e*upper;z1=cz+rz*e*1.15
                vs.append((x+rx*1.03*u,(-.425-.23*e)*(1-t)+(-.36)*t,z0*(1-t)+z1*t))
                if j and i:a=j*25+i;fs.append((a-26,a-25,a,a-1))
        mesh('Expression upper eyelid skin '+side,vs,fs,'skin','head')
        browZ=.21 if role=='stone' else .24 if role=='bubble' and s<0 else .19
        brow=[(x-s*.145,-.475,cz+(.145 if stone else .18)),(x,-.50,cz+browZ),(x+s*.145,-.38,cz+.22 if role=='stone' else cz+.145)]
        line('Anatomical brow '+side,brow,.046 if stone else .026,'skin','brow_'+side)
        # Separate closed eyelid surface collapses into upper socket at rest.
        vs=[];fs=[]
        for j in range(13):
            v=1-2*j/12
            for i in range(25):
                u=-1+2*i/24;e=math.sqrt(max(0,1-u*u));vs.append((x+rx*u,-.43-.225*e*math.sqrt(max(0,1-v*v)),cz+rz*e*v))
                if j and i:a=j*25+i;fs.append((a-26,a-25,a,a-1))
        def weights(v,x=x):
            e=math.sqrt(max(0,1-((v.x-x)/rx)**2));amount=max(0,min(1,(rz*e-(v.z-cz))/(2*rz)));return {'head':1-amount,'lid_'+side:amount}
        mesh('Blink skin '+side,vs,fs,'skin',weights=weights)
        oval('Nostril '+side,(s*.105,-.679,2.153),(.014,.010,.02),'mouth','head',16)
    pts=[];r=.442 if stone else .395
    for i in range(33):
        x=-r+2*r*i/32;q=x/r;z=1.978+.060*abs(q)**3
        if role=='leaf':z+=.025*abs(q)**2
        if role in ['spike','bubble']:z+=q*.012
        y=-.415-.283*math.sqrt(max(.08,1-(x/(.53 if stone else .48))**2))
        pts.append((x,y,z))
    line('Recessed closed mouth',pts,.0065,'mouth','jaw')

def hood(role):
    mat='pine' if role=='spike' else 'robe';bone='head';n=64;rows=14;vs=[];fs=[]
    for j in range(rows+1):
        t=j/rows;factor=math.cos(t*PI/2)*.99+.01;y=-.39+t*.98
        for i in range(n):
            a=i*2*PI/n;x=math.sin(a)*.62*factor;z=2.22+math.cos(a)*(.67 if math.cos(a)>0 else .47)*factor
            if math.cos(a)>.5:z+=.065*math.cos(a)**4*factor
            vs.append((x,y,z))
            if j:
                k=j*n+i;kn=j*n+(i+1)%n;fs.append((k-n,k,kn,kn-n))
    ob=mesh('Tailored hood shell',vs,fs,mat,bone);bpy.context.view_layer.objects.active=ob
    ob.data.materials.append(B.mats['pine' if role=='spike' else 'navy']);m=ob.modifiers.new('Hood lined thickness','SOLIDIFY');m.thickness=.032;m.material_offset=1;bpy.ops.object.modifier_apply(modifier=m.name)
    outline=[vs[i] for i in range(n)]+[vs[0]]
    line('Hood edge piping',outline,.022,'newLeaf' if role=='spike' else 'gold',bone)
    if role=='spike':
        for i in range(7):
            a=(i-3)*.43;leaf_shape('Hood overlapping leaf',(math.sin(a)*.35,-.21,2.96-abs(a)*.06),(math.sin(a)*.66,-.49,2.66-abs(a)*.16),.16,'jade' if i%2 else 'leafMid',bone)
        for i in range(5):
            a=(i-2)*.48;leaf_shape('Rear hood leaf',(math.sin(a)*.34,.45,2.71),(math.sin(a)*.55,.58,2.34-abs(a)*.07),.18,'jade',bone,normal=(0,1,0))
    else:
        line('Blue hood side trim',[(-.69,-.32,2.14),(-.58,-.29,2.52),(-.28,-.17,2.78)],.035,'blue','head')

def cloak(role):
    mat='jade' if role=='spike' else 'orange';alt='pine' if role=='spike' else 'orangeLight'
    for row,(z,rad) in enumerate([(1.67,.61),(1.47,.66),(1.25,.65),(.99,.58)]):
        for i in range(10):
            a=-PI*.1+i*PI*1.2/9;x=math.cos(a)*rad;y=math.sin(a)*.48+.12
            # Rear/side leaves expose the front belly and actual shell underneath.
            leaf_shape('Layered leaf cape',(x*.81,y*.8,z+.14),(x*1.08,y*1.10,z-.25),.19,mat if (i+row)%3 else alt,'cape',normal=(math.cos(a),math.sin(a),.15))
    for s in [-1,1]:
        leaf_shape('Front shoulder leaf',(s*.18,-.35,1.77),(s*.56,-.30,1.42),.17,mat,'chest')
        leaf_shape('Front crossed leaf',(s*.32,-.555,1.59),(-s*.12,-.59,1.26),.12,alt,'chest')
    oval('Mantle clasp',(0,-.54,1.61),(.076,.035,.076),'gold','chest')

def strap(name,pts,width,mat,bone='chest'):
    # Raised leather strip built as a smooth solid curve with a shallow rectangular profile.
    return line(name,pts,width,mat,bone)

def belt_and_pouches(role):
    ring('Leather waist belt',(0,0,.93),.55,.445,'leather','spine',.049)
    plate('Gold belt buckle',(0,-.463,.93),.077,.073,.03,'gold','spine')
    if role in ['crystal','bubble']:plate('Belt gem',(0,-.497,.93),.055,.051,.028,'aqua' if role=='crystal' else 'violet','spine')
    for s in [-1,1]:
        oval('Leather hip pouch',(s*.39,-.32,.82),(.13,.08,.17),'leather','spine')
        plate('Pouch flap',(s*.39,-.405,.875),.13,.075,.018,'wood','spine',n=4)
        oval('Pouch button',(s*.39,-.426,.842),(.02,.008,.02),'gold','spine',16)

def robe(role):
    n=48;vs=[];fs=[];rings=[(.49,.63,.44),(.83,.58,.45),(1.19,.60,.46),(1.50,.55,.43),(1.72,.34,.30)]
    for j,(z,rx,ry) in enumerate(rings):
        for i in range(n):
            a=i*2*PI/n;vs.append((rx*math.cos(a),ry*math.sin(a),z+.02*math.cos(6*a)*(1-j/5)))
            if j:
                k=j*n+i;b=j*n+(i+1)%n;fs.append((k-n,k,b,b-n))
    ob=mesh('Tailored ivory coat',vs,fs,'robe',weights=torso_weights);bpy.context.view_layer.objects.active=ob;m=ob.modifiers.new('Coat hem thickness','SOLIDIFY');m.thickness=.025;bpy.ops.object.modifier_apply(modifier=m.name)
    ring('Coat hem gold piping',(0,0,.49),.551,.392,'gold','spine',.015)
    for s,side in [(-1,'L'),(1,'R')]:
        sh,el,_=B.bones['upper_'+side]
        B.limb('Tailored sleeve '+side,[sh,tuple(Vector(sh).lerp(Vector(el),.6)),el],[.305,.28,.238],'robe',['upper_'+side,'fore_'+side])
        oval('Tailored rounded shoulder '+side,sh,(.302,.275,.303),'robe','upper_'+side)
        line('Blue crossed chest sash',[(s*.31,-.385,1.64),(0,-.496,1.37),(-s*.37,-.425,1.15)],.045,'blue','chest')
        line('Robe front gold seam',[(s*.18,-.35,1.7),(s*.17,-.474,1.2),(s*.23,-.43,.52)],.014,'gold','chest')
    for s in [-1,1]:B.crystal('Shell azure accent',(s*.46,.40,1.75),(.11,.10,.30),'aqua','shell',s*.4)

def hat():
    # Broad woven conical straw brim, shallow enough to expose the eyes.
    n=64;vs=[];fs=[]
    for j in range(12):
        r=j/11*.98;z=2.71-.24*(r/.98)**1.1
        for i in range(n):a=i*2*PI/n;vs.append((math.cos(a)*r,math.sin(a)*r*.80,z+.018*math.sin(a)*r));
        if j:
            for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a-n,a,b,b-n))
    ob=mesh('Woven straw brim',vs,fs,'straw','head');bpy.context.view_layer.objects.active=ob;m=ob.modifiers.new('Straw brim thickness','SOLIDIFY');m.thickness=.028;bpy.ops.object.modifier_apply(modifier=m.name)
    for j in range(3,12):
        r=j/11*.98;ring('Woven concentric straw',(0,0,2.714-.24*(r/.98)**1.1),r,r*.8,'strawLight','head',.007)
    for i in range(28):
        a=i*2*PI/28;pts=[]
        for j in range(3,12):r=j/11*.98;pts.append((math.cos(a)*r,math.sin(a)*r*.8,2.72-.24*(r/.98)**1.1))
        line('Radial straw binding',pts,.008,'woodLight','head')
    oval('Straw hat crown',(0,.04,2.72),(.49,.40,.20),'straw','head')
    for x,y,z in [(.16,.03,2.92),(.28,.07,2.95),(.21,.18,2.98)]:oval('Red berry',(x,y,z),(.08,.08,.085),'berry','head',24)
    for s in [-1,1]:leaf_shape('Hat leaf',(.18,.1,2.92),(.18+s*.33,.16,2.90),.095,'jade','head',normal=(0,0,1))

def armor():
    # Indigo helmet is an open, fitted shell surrounding the face.
    n=64;rows=14;vs=[];fs=[]
    for j in range(rows+1):
        t=j/rows;f=math.cos(t*PI/2)*.99+.01
        for i in range(n):
            a=i*2*PI/n;x=math.sin(a)*.65*f;co=math.cos(a);z=2.20+(co*(.64 if co>0 else .41))*f
            if co>.65:z-=.08*(1-abs(math.sin(a)))*f
            vs.append((x,-.39+t*.93,z))
            if j:k=j*n+i;kn=j*n+(i+1)%n;fs.append((k-n,k,kn,kn-n))
    mesh('Indigo fitted helmet',vs,fs,'indigo','head');line('Helmet gold opening',[vs[i] for i in range(n)]+[vs[0]],.025,'gold','head')
    shell=oval('Fitted continuous indigo cuirass',(0,-.135,1.25),(.60,.385,.58),'indigo','chest')
    for s,side in [(-1,'L'),(1,'R')]:
        sh,el,_=B.bones['upper_'+side];wr=B.bones['hand_'+side][0]
        oval('Full curved indigo pauldron '+side,(sh[0],sh[1],sh[2]+.06),(.32,.29,.29),'indigo','upper_'+side)
        plate('Layered pauldron gold',(sh[0],-.26,sh[2]+.09),.31,.235,.15,'gold','upper_'+side,normal=(s*.3,-.9,.3))
        plate('Layered indigo pauldron',(sh[0],-.289,sh[2]+.095),.281,.208,.15,'indigo','upper_'+side,normal=(s*.3,-.9,.3))
        for j in range(3):
            t=.18+j*.28;p=Vector(el).lerp(Vector(wr),t)
            plate('Articulated forearm armor',(p.x,p.y-.185,p.z),.216,.11,.105,'indigo','fore_'+side)
        for z in [.26,.39]:plate('Indigo greave',(s*.38,-.27,z),.24,.13,.115,'indigo','shin_'+side)
        plate('Helmet side golden inset',(s*.58,-.20,2.34),.115,.15,.048,'gold','head',normal=(s*.7,-.7,0))
        B.crystal('Helmet swept fin',(s*.40,.10,2.60),(.08,.10,.23),'gold','head',s*.40)
    line('Helmet central gold ridge',[(0,-.39,2.76),(0,-.13,2.87),(0,.34,2.83),(0,.50,2.62)],.037,'gold','head')
    for z,rx in [(1.45,.43),(1.22,.44),(1.01,.37),(.78,.29)]:
        plate('Gold chest rim',(0,-.51,z),rx,.15,.072,'gold','chest');plate('Indigo breastplate',(0,-.551,z),rx*.93,.134,.073,'indigo','chest')
    oval('Chest gem gold mount',(0,-.597,1.48),(.16,.04,.16),'gold','chest')
    plate('Purple chest gemstone',(0,-.64,1.48),.117,.132,.078,'violet','chest')
    for s in [-1,1]:B.crystal('Indigo shell fin',(s*.57,.46,1.80),(.14,.13,.37),'navy','shell',s*.5)

def equipment(role):
    if role=='stone':return
    side='R' if role in ['crystal','bubble'] else 'L';x,y,z=B.bones['hand_'+side][0];y-=.14
    B.add_bone('weapon',(x,y,z),(x,y,z+.4),'hand_'+side)
    top=2.58 if role in ['crystal','bubble'] else 1.9
    B.bones['weapon_tip']=((x,y,top),(x,y,top+.18),'weapon')
    if role=='spike':
        pts=[(x+.1,y,.53),(x-.20,y,.71),(x-.24,y,1.03),(x,y,1.24),(x-.18,y,1.59),(x-.12,y,1.95),(x+.02,y,2.06)]
        line('Solid curved walnut bow',pts,.052,'wood','weapon');line('Taut bow string',[pts[0],(x+.20,y,1.27),pts[-1]],.006,'strawLight','weapon')
        for zz in [1.17,1.22,1.27,1.32]:ring('Bow leather grip',(x-.01,y,zz),.057,.057,'leather','weapon',.012)
        B.bones['weapon_tip']=((x,y,1.80),(x,y,2.03),'weapon')
        # Quiver attaches to the shell, all arrows are actual geometry.
        line('Back diagonal leather strap',[(-.45,.56,1.98),(.08,.83,1.38),(.46,.60,.91)],.063,'leather','shell')
        line('Leather quiver',[(-.45,.57,1.31),(-.46,.59,2.09)],.14,'leather','shell')
        for j in range(5):
            xx=-.46+(j%3-1)*.066;yy=.61+(j//3)*.06;zz=2.35+(j%3)*.05
            line('Quivered arrow shaft',[(xx,yy,1.91),(xx,yy,zz)],.012,'woodLight','shell')
            for s in [-1,1]:leaf_shape('Arrow fletching',(xx,yy,zz-.14),(xx+s*.046,yy,zz+.05),.025,'newLeaf','shell',normal=(0,1,0))
        for s,si in [(-1,'L'),(1,'R')]:
            ring('Leaf ankle strap',(s*.38,-.10,.34),.205,.20,'leather','shin_'+si,.022)
    elif role=='crystal':
        line('Walnut wave staff',[(x,y,.20),(x,y,1.4),(x+.04,y,2.12),(x-.04,y,2.34)],.041,'wood','weapon')
        for zz in [.28,.44,1.48,2.10]:ring('Staff gold binding',(x,y,zz),.054,.054,'gold','weapon',.015)
        pts=[]
        for i in range(65):
            t=i/64;a=-PI*.55+t*PI*3.2;r=.34*(1-t)+.035
            pts.append((x+math.cos(a)*r,y,2.54+math.sin(a)*r))
        line('Sculpted azure spiral crest',pts,.064,'aqua','weapon')
        for j in range(3):B.crystal('Wave crystalline facet',(x-.18+j*.15,y,2.39+j*.11),(.053,.05,.18),'aqua','weapon',-.3+j*.3)
        B.bones['weapon_tip']=((x,y,2.56),(x,y,2.77),'weapon')
    elif role=='leaf':
        # Hanging lantern is a rigid child of a dedicated handle bone.
        B.add_bone('lantern',(x,y,z-.04),(x,y,z-.42),'weapon');B.bones['weapon_tip']=((x,y,z-.50),(x,y,z-.31),'lantern')
        ring('Lantern carry ring',(x,y,z-.11),.10,.13,'bronze','lantern',.022,'xz')
        cz=z-.52
        for zz in [cz-.29,cz+.29]:
            oval('Bronze lantern cap',(x,y,zz),(.225,.17,.065),'bronze','lantern')
        for i in range(6):a=i*PI/3;line('Lantern cage strut',[(x+math.cos(a)*.18,y+math.sin(a)*.14,cz-.28),(x+math.cos(a)*.18,y+math.sin(a)*.14,cz+.28)],.018,'bronze','lantern')
        oval('Amber lantern glass',(x,y,cz),(.157,.12,.245),'fire','lantern')
        B.crystal('Flame core',(x,y-.12,cz-.17),(.067,.055,.36),'fire','lantern',.15)
    else:
        line('Summoner staff shaft',[(x,y,.20),(x,y,2.34)],.041,'wood','weapon')
        for zz in [.24,.46,1.40,2.18]:ring('Staff gold band',(x,y,zz),.056,.056,'gold','weapon',.022)
        for s in [-1,1]:line('Angular indigo gem cage',[(x,y,2.22),(x+s*.26,y,2.42),(x+s*.24,y,2.65),(x,y,2.89)],.047,'indigo','weapon')
        B.crystal('Purple focus gem',(x,y,2.38),(.14,.105,.37),'violet','weapon')
        B.bones['weapon_tip']=((x,y,2.56),(x,y,2.76),'weapon')

def make(role):
    skeleton(role);build_body(role);face(role)
    if role in ['spike','crystal']:hood(role)
    if role in ['spike','leaf']:cloak(role)
    if role=='crystal':robe(role)
    if role=='leaf':hat()
    if role=='bubble':armor()
    if role!='stone':belt_and_pouches(role)
    equipment(role)
    unify_skin()
    # The front reference carries bow/lantern on image-right and staves on
    # image-left. Mirror mesh + rest skeleton together, never just the prop.
    if role!='stone':
        for ob in B.parts:
            keep_quiver=role=='spike' and ob.name.startswith(('Back diagonal','Leather quiver','Quivered arrow','Arrow fletching'))
            if not keep_quiver:
                for v in ob.data.vertices:v.co.x=-v.co.x
                ob.data.flip_normals()
        B.bones={n:((-h[0],h[1],h[2]),(-t[0],t[1],t[2]),parent) for n,(h,t,parent) in B.bones.items()}

def unify_skin():
    """Weld anatomical volumes before skinning; transfer the authored joint weights.
    This removes visible primitive end caps at elbows, hips, fingers and ankles.
    """
    prefixes=('Continuous torso','Continuous pelvis','Continuous arm','Continuous leg','Rounded shoulder joint','Sole planted foot','Rounded toe','Sculpted palm','Curled articulated finger','Soft fingertip','Opposing thumb','Thumb tip')
    objects=[o for o in B.parts if o.name.startswith(prefixes)]
    source=[]
    for ob in objects:
        names={g.index:g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:source.append((v.co.copy(),{names[g.group]:g.weight for g in v.groups}))
    tree=KDTree(len(source))
    for i,(co,w) in enumerate(source):tree.insert(co,i)
    tree.balance();bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();body=bpy.context.object
    remesh=body.modifiers.new('Continuous anatomical skin','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.017;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=body.modifiers.new('Sculpt transition relaxation','SMOOTH');smooth.factor=.6;smooth.iterations=4;bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec=body.modifiers.new('Skin topology budget','DECIMATE');dec.ratio=.48;bpy.ops.object.modifier_apply(modifier=dec.name)
    body.vertex_groups.clear();groups={}
    for v in body.data.vertices:
        accum={}
        for co,i,d in tree.find_n(v.co,4):
            for name,w in source[i][1].items():accum[name]=accum.get(name,0)+w/(d*d+.00001)
        chosen=sorted(accum.items(),key=lambda p:p[1],reverse=True)[:4];total=sum(w for n,w in chosen)
        for name,w in chosen:
            if name not in groups:groups[name]=body.vertex_groups.new(name=name)
            groups[name].add([v.index],w/total,'REPLACE')
    body.name='Unified deforming skin';body.data.materials.clear();body.data.materials.append(B.mats['skin'])
    for p in body.data.polygons:p.use_smooth=True
    B.parts=[o for o in B.parts if o not in objects]+[body]

def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def hump(t,a,b,c):return 0 if t<=a or t>=c else ease((t-a)/(b-a)) if t<b else 1-ease((t-b)/(c-b))

def rig_animate(role):
    data=bpy.data.armatures.new('ApprovedCastSkeleton');rig=bpy.data.objects.new(role.title()+'ApprovedRig',data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,(h,t,p) in B.bones.items():b=data.edit_bones.new(name);b.head=h;b.tail=t
    for name,(h,t,p) in B.bones.items():
        if p:data.edit_bones[name].parent=data.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in B.parts:
        mod=ob.modifiers.new('Deforming skeleton','ARMATURE');mod.object=rig;ob.parent=rig
    add_leg_controls(rig)
    for side in ['L','R']:rig.pose.bones['shin_'+side].constraints['Planted leg solve'].pole_angle=-PI/2
    rig.animation_data_create()
    for p in rig.pose.bones:p.rotation_mode='XYZ'
    clips={'idle':121,'walk':33,'attack':31,'attack_alt':35,'attack_heavy':43,'skill':91,'skill_start':19,'skill_loop':49,'skill_end':25,'hit':22,'death':49,'arrive':61,'turn_left':37,'turn_right':37}
    events={}
    for name,last in clips.items():
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for fr in range(1,last+1):
            t=(fr-1)/(last-1);wave=math.sin(t*2*PI)
            for p in rig.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
            def rot(n,axis,v):
                if n in rig.pose.bones:rig.pose.bones[n].rotation_euler[axis]=v
            rot('chest',0,.012*wave);rot('head',1,.018*wave);rot('cape',0,.024*math.sin(t*2*PI-.6))
            blink=hump(t,.64,.665,.71) if name=='idle' else hump(t,.14,.17,.20) if name=='arrive' else 0
            for side in ['L','R']:offset_world(rig,'lid_'+side,(0,.04*(1-blink),(.30 if role=='stone' else .338)*(1-blink)))
            crouch=.012*(.5+.5*wave) if name=='idle' else 0
            if name in ['walk','turn_left','turn_right']:
                for side,phase,s in [('L',0,-1),('R',PI,1)]:
                    a=t*2*PI+phase;offset_world(rig,'foot_ik_'+side,(0,(.19 if name=='walk' else .075)*math.cos(a),.075*max(0,math.sin(a))))
                    rot('upper_'+side,0,.12*wave*s);rot('fore_'+side,0,-.045*wave*s)
                rot('hips',2,.035*wave);rot('chest',2,-.05*wave)
            if name.startswith('attack'):
                wind=hump(t,0,.24,.47);hit=hump(t,.22,.44,.98);crouch=.035*wind
                sign=-1 if name=='attack_alt' else 1
                rot('spine',2,sign*(-.20*wind+.25*hit));rot('chest',2,sign*(-.12*wind+.14*hit));rot('head',2,sign*(.15*wind-.15*hit))
                if role=='stone':
                    arm='L' if name=='attack_alt' else 'R';rot('upper_'+arm,0,.30*wind-1.25*hit);rot('fore_'+arm,0,-.90*wind-.2*hit);rot('upper_'+arm,2,-.20*hit*sign)
                    if name=='attack_heavy':
                        for side in ['L','R']:rot('upper_'+side,0,-.95*wind-.9*hit);rot('fore_'+side,0,-.7*wind)
                        rot('chest',0,-.13*wind+.23*hit)
                elif role=='spike':
                    rot('upper_L',0,-.50*hit);rot('fore_L',0,-.20*hit);rot('upper_R',0,-.65*wind-.23*hit);rot('fore_R',0,-1.2*wind-.45*hit);rot('upper_R',2,-.30*wind)
                else:
                    side='L' if role=='leaf' else 'R';free='R' if side=='L' else 'L'
                    rot('upper_'+side,0,-.35*hit);rot('fore_'+side,0,-.27*hit);rot('upper_'+free,0,-.85*hit);rot('fore_'+free,0,-.42*hit)
                events[name]=[{'frame':round(last*.43),'type':'release','socket':'weapon_tip' if role!='stone' else 'hand_R'}]
            if name.startswith('skill'):
                power=ease(t) if name=='skill_start' else 1-ease(t) if name=='skill_end' else .97+.03*wave if name=='skill_loop' else hump(t,0,.30,.97)
                crouch=.04*power
                if role=='stone':
                    rot('upper_L',2,-.95*power);rot('upper_R',2,.95*power);rot('fore_L',0,-.24*power);rot('fore_R',0,-.24*power)
                elif role=='spike':
                    rot('upper_L',0,-1.06*power);rot('fore_L',0,-.32*power);rot('upper_R',0,-1.03*power);rot('fore_R',0,-.95*power);rot('head',0,-.12*power)
                elif role=='leaf':
                    rot('upper_L',0,-.76*power);rot('fore_L',0,-.68*power);rot('upper_R',0,-.67*power);rot('fore_R',0,-.25*power)
                else:
                    rot('upper_R',0,-.90*power);rot('fore_R',0,-.40*power);rot('upper_L',0,-1.04*power);rot('fore_L',0,-.38*power)
                rot('head',0,-.055*power);rot('cape',0,-.11*power)
                events[name]=[{'frame':round(last*.32),'type':'cast','socket':'weapon_tip'}]
            if name=='arrive':
                g=hump(t,0,.42,.99);rot('chest',2,.07*g);rot('head',2,-.13*g)
                if role=='stone':rot('fore_R',0,-.65*g);rot('head',0,.075*g)
                elif role=='spike':rot('head',1,-.14*g);rot('fore_R',0,-.82*g)
                elif role=='crystal':rot('upper_L',0,-.65*g);rot('fore_L',0,-.55*g)
                elif role=='leaf':rot('fore_L',0,-.36*g);rot('head',1,.09*g)
                else:rot('fore_L',0,-.8*g);rot('brow_L',0,-.04*g)
            if role=='leaf' and 'lantern' in rig.pose.bones:rot('lantern',0,.045*math.sin(t*2*PI-.4))
            if name=='hit':rot('chest',0,-.16*hump(t,0,.2,.99));rot('head',0,.08*hump(t,.05,.3,.99))
            if name=='death':crouch=.24*ease(t);rot('chest',0,.36*ease(t));rot('head',0,.33*ease(t))
            if name not in ['walk','turn_left','turn_right']:offset_world(rig,'hips',(0,0,-crouch))
            for p in rig.pose.bones:p.keyframe_insert('rotation_euler',frame=fr);p.keyframe_insert('location',frame=fr);p.keyframe_insert('scale',frame=fr)
        action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
    rig.animation_data.action=bpy.data.actions['idle'];bpy.context.scene.frame_set(1)
    return rig,clips,events

def scene_review(role,rig,out):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    world=bpy.data.worlds.new('Ivory studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.70,.72,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,loc,power,size in [('Large soft key',(-3,-4,6),650,4),('Soft fill',(4,-2,3),300,4),('Shoulder rim',(2,4,5),700,3)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
    m=B.material('studioFloor','EFE6D5',.8);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(m)
    cam=bpy.data.cameras.new('Reference comparison camera');o=bpy.data.objects.new('Reference comparison camera',cam);bpy.context.collection.objects.link(o);cam.type='ORTHO';cam.ortho_scale=3.65;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    views=[('front',(0,-8,2.1)),('three-quarter',(4,-7,3.0)),('back',(0,8,2.1))]
    if '--quick' in sys.argv:views=views[:1];scene.cycles.samples=12;scene.render.resolution_x=640;scene.render.resolution_y=720
    for label,loc in views:
        o.location=loc;o.rotation_euler=(Vector((0,0,1.46))-o.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(role+'-studio.blend')))

def run(role):
    setup(role);make(role);rig,clips,events=rig_animate(role)
    out=HERE/role;out.mkdir(parents=True,exist_ok=True);runtime=GAME/'assets/resources/models-approved'/role;runtime.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene;scene.render.fps=30;scene.frame_end=121
    # Embed the exact approved sheet as a disabled modelling reference, never as body geometry.
    ref=bpy.data.objects.new('APPROVED_V2_REFERENCE_NOT_RENDERED',None);bpy.context.collection.objects.link(ref);ref.empty_display_type='IMAGE';ref.data=bpy.data.images.load(str(REFERENCE[role]));ref.data.pack();ref.hide_render=True;ref.hide_viewport=True;ref['reference_path']=str(REFERENCE[role])
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(role+'.blend')))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in B.parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=B.parts[0];bpy.ops.object.join();body=bpy.context.object;body.name=role.title()+'ApprovedSkin';rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.context.view_layer.objects.active=body
    lod=body.modifiers.new('Runtime triangle budget','DECIMATE');lod.ratio=.46;lod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=lod.name)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.fbx(filepath=str(runtime/(role+'.fbx')),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(role+'.glb')),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
    stats={'role':role,'name':NAMES[role],'reference':str(REFERENCE[role]),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'vertices':len(body.data.vertices),'weightedVertices':sum(bool(v.groups) for v in body.data.vertices),'bones':[b.name for b in rig.data.bones],'materials':list(B.mats),'clips':clips,'events':events,'status':'actual 3D candidate; requires visual comparison, not a commercial-final claim'}
    (out/'manifest.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
    scene_review(role,rig,out);print('APPROVED_CAST_DONE',role,stats['triangles'],flush=True)

sys.path.insert(0,str(HERE))
from fidelity_pass import install as install_fidelity_pass
install_fidelity_pass(sys.modules[__name__])

if __name__=='__main__':
    args=[a for a in sys.argv[sys.argv.index('--')+1:] if a in ROLES] if '--' in sys.argv else ['stone']
    for role in args:run(role)
