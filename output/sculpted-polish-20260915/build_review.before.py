"""Editable 3D vertical slice. Real geometry, weighted skinning, authored joint animation.
Run Blender 4.5 --background --threads 2 --python this.py -- stone|crystal|crab.
Writes only sculpted-review source and models-sculpted runtime candidates.
"""
import bpy, math, random, json, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(__file__).parent
OUT=ROOT/'assets/resources/models-sculpted'
random.seed(918)
PI=math.pi
parts=[]; mats={}; bones={}

def material(name,hex,rough=.48,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    c=tuple((int(hex[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,)
    p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=c;p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=c;mats[name]=m;return m

def finish(ob,name,mat,bone='chest',smooth=True,weights=None):
    ob.name=name;bpy.context.view_layer.objects.active=ob
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    ob.data.materials.clear();ob.data.materials.append(mats[mat])
    for p in ob.data.polygons:p.use_smooth=smooth
    if weights:
        for v in ob.data.vertices:
            for b,w in weights(v.co).items():
                if w>.001:
                    g=ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b);g.add([v.index],w,'REPLACE')
    else:ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    parts.append(ob);return ob

def oval(name,p,s,mat,bone='chest',seg=24,weights=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=14,location=p);ob=bpy.context.object;ob.scale=s
    return finish(ob,name,mat,bone,weights=weights)

def curve(name,points,r,mat,bone='chest'):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=4;c.bevel_depth=r;c.bevel_resolution=2;c.use_fill_caps=True
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for v,p in zip(s.bezier_points,points):v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
    if name=='Curving pincer tooth':s.bezier_points[-1].radius=.05
    ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,bone)

def faceted(name,p,s,mat,bone='shell',segments=6,normal=None):
    # Bevelled closed stone plates have a broad face and deliberately uneven outline.
    vs=[]
    for ring,z in [(1,-.5),(1,.25),(.73,.63)]:
        for i in range(segments):a=2*PI*i/segments;vs.append((math.cos(a)*s[0]*ring,math.sin(a)*s[1]*ring,z*s[2]))
    fs=[tuple(range(segments-1,-1,-1))]
    for j in range(2):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;fs.append((a,b,b+segments,a+segments))
    fs.append(tuple(range(2*segments,3*segments)))
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.location=p
    ob.rotation_euler=(PI/2,0,random.uniform(-.13,.13));
    if normal:ob.rotation_euler=Vector(normal).to_track_quat('Z','Y').to_euler()
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new('Rounded chipped edges','BEVEL');mod.width=.025;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(ob,name,mat,bone,False)

def crystal(name,p,s,mat='aqua',bone='shell',tilt=0):
    vs=[];n=5
    for z,r in [(0,.65),(.18,1),(.65,.86)]:
        for i in range(n):a=2*PI*i/n;vs.append((math.cos(a)*s[0]*r,math.sin(a)*s[1]*r,z*s[2]))
    vs.append((s[0]*.12,0,s[2]));fs=[tuple(range(n-1,-1,-1))]
    for j in range(2):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    for i in range(n):fs.append((2*n+i,2*n+(i+1)%n,15))
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.location=p;ob.rotation_euler.y=tilt
    return finish(ob,name,mat,bone,False)

def limb(name,points,radii,mat,joints):
    # Continuous closed tube with smooth two-bone transition around an actual joint.
    vs=[];fs=[];n=16
    for j,p in enumerate(points):
        axis=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);axis.normalize();x=axis.cross(Vector((0,1,0))).normalized();y=axis.cross(x).normalized()
        for i in range(n):v=Vector(p)+(x*math.cos(i*2*PI/n)+y*math.sin(i*2*PI/n))*radii[j];vs.append(tuple(v))
    for j in range(len(points)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(range(n-1,-1,-1)),tuple(range((len(points)-1)*n,len(points)*n))])
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    finish(ob,name,mat,joints[0]);ob.vertex_groups.clear()
    for j in range(len(points)):
        t=j/(len(points)-1);mix=max(0,min(1,(t-.25)/.5))
        for bone,w in [(joints[0],1-mix),(joints[1],mix)]:
            if w>0:(ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)).add(list(range(j*n,(j+1)*n)),w,'REPLACE')
    return ob

def add_bone(name,head,tail,parent=None):bones[name]=(head,tail,parent)

def hero(role):
    stone=role=='stone';wide=1.13 if stone else .92
    material('skin','E7AC48' if stone else '6DBDBC',.42);material('muzzle','F1C366' if stone else 'AFE0D2',.45)
    material('belly','F6D697' if stone else 'F2E4C6',.6);material('gold','C59E57',.33,.28);material('edge','6B5650',.65)
    material('rock','55565E',.67);material('rockLight','77777E',.62);material('navy','154866',.51);material('robe','287893',.58)
    material('aqua','25B9E3',.19,.18,.45);material('white','FFFCED',.3);material('iris','AD6920' if stone else '358D9F',.2)
    material('pupil','142532',.19);material('mouth','664534' if stone else '35625E',.66)
    for name,h,t,p in [('root',(0,0,0),(0,0,.25),None),('hips',(0,0,.45),(0,0,.82),'root'),('spine',(0,0,.82),(0,0,1.15),'hips'),('chest',(0,0,1.15),(0,0,1.52),'spine'),('shell',(0,.26,1.02),(0,.26,1.62),'chest'),('neck',(0,-.02,1.5),(0,-.04,1.72),'chest'),('head',(0,-.04,1.72),(0,-.04,2.15),'neck'),('jaw',(0,-.1,1.72),(0,-.42,1.69),'head')]:add_bone(name,h,t,p)
    for s,side in [(-1,'L'),(1,'R')]:
        shoulder=(s*.48*wide,0,1.39);elbow=(s*.66*wide,-.08,1.10);wrist=(s*.77*wide,-.25,.90)
        add_bone('clavicle_'+side,(s*.14,0,1.45),shoulder,'chest');add_bone('upper_'+side,shoulder,elbow,'clavicle_'+side);add_bone('fore_'+side,elbow,wrist,'upper_'+side);add_bone('hand_'+side,wrist,(wrist[0],-.42,.87),'fore_'+side)
        hip=(s*.29*wide,0,.61);knee=(s*.30*wide,-.04,.32);ankle=(s*.31*wide,0,.12)
        add_bone('thigh_'+side,hip,knee,'hips');add_bone('shin_'+side,knee,ankle,'thigh_'+side);add_bone('foot_'+side,ankle,(s*.31*wide,-.35,.12),'shin_'+side)
        add_bone('brow_'+side,(s*.22,-.35,2.08),(s*.34,-.40,2.08),'head')
        add_bone('lid_'+side,(s*.225,-.365,1.96),(s*.225,-.40,2.09),'head')
        limb('Anatomical arm '+side,[shoulder,tuple(Vector(shoulder).lerp(Vector(elbow),.6)),elbow,tuple(Vector(elbow).lerp(Vector(wrist),.5)),wrist],[.20*wide,.185,.153,.18,.135],'skin',['upper_'+side,'fore_'+side])
        oval('Knuckled hand '+side,(wrist[0],-.28,.88),(.22*wide,.21,.22),'skin','hand_'+side)
        for f in range(3):oval('Finger '+side+str(f),(wrist[0]+(f-1)*.09,-.419,.88),(.055,.055,.095),'muzzle','hand_'+side,16)
        limb('Leg '+side,[hip,tuple(Vector(hip).lerp(Vector(knee),.5)),knee,tuple(Vector(knee).lerp(Vector(ankle),.6)),ankle],[.235*wide,.225,.16,.15,.135],'skin',['thigh_'+side,'shin_'+side])
        oval('Planted foot '+side,(s*.31*wide,-.13,.105),(.25*wide,.34,.105),'skin','foot_'+side)
        for f in range(3):
            oval('Toe '+side+str(f),(s*.31*wide+(f-1)*.13,-.388,.105),(.068,.075,.064),'aqua' if stone else 'belly','foot_'+side,16)
        if stone:
            faceted('Shoulder plate '+side,(s*.54*wide,.005,1.46),(.30,.25,.24),'rockLight','upper_'+side)
            faceted('Gauntlet '+side,(s*.76*wide,-.16,1.00),(.23,.235,.24),'rock','fore_'+side)
            crystal('Wrist crystal '+side,(s*.79*wide,-.29,1.13),(.085,.07,.19),'aqua','fore_'+side,s*.30)
            crystal('Shoulder crystal '+side,(s*.56*wide,.095,1.53),(.14,.12,.41),'aqua','upper_'+side,s*.28)
    def torso_weight(v):
        t=max(0,min(1,(v.z-.9)/.45));return {'spine':1-t,'chest':t}
    oval('Continuous torso',(0,0,1.10),(.49*wide,.345,.61),'skin',weights=torso_weight)
    oval('Carapace rim',(0,.225,1.2),(.61*wide,.29,.72),'edge','shell')
    oval('Carapace dome',(0,.37,1.24),(.555*wide,.34,.65),'rock' if stone else 'navy','shell')
    oval('Plastron foundation',(0,-.285,1.08),(.405*wide,.125,.49),'belly',weights=torso_weight)
    if stone:
        for row,z in enumerate([.78,1.10,1.40]):
            faceted('Broad central plastron', (0,-.405 if row==1 else -.365,z),(.28*wide,.20,.095),'belly','chest' if row>1 else 'spine')
            for side in [-1,1]:faceted('Side plastron', (side*.30*wide,-.29,z),(.13,.155,.07),'muzzle','chest' if row>1 else 'spine',normal=(side*.35,-1,0))
        for row,z in enumerate([.81,1.16,1.51,1.79]):
            for col,x in enumerate([-.38,0,.38] if row<3 else [-.18,.18]):
                y=.38+.32*max(.05,1-(x/.65)**2-((z-1.24)/.77)**2)**.5
                faceted('Layered dorsal armor',(x*wide,y,z),(.26,.25,.16),'rockLight' if (row+col)%3==0 else 'rock','shell',normal=(x*.8,1,(z-1.24)*.5))
        for z,xw in [(1.07,.46),(1.37,.5),(1.65,.36)]:
            for s in [-1,1]:faceted('Shell side armor',(s*xw*wide,.29,z),(.225,.22,.28),'rockLight' if z>1.4 else 'rock','shell')
        for x,z,h in [(0,1.83,.68),(-.30,1.75,.49),(.3,1.75,.49),(-.47,1.46,.3),(.47,1.46,.3)]:crystal('Carapace crystal',(x,.40,z),(.16,.14,h),'aqua','shell',x*.65)
    oval('Neck',(0,-.03,1.59),(.25,.22,.25),'skin','neck')
    # Broad cheek planes, short muzzle and low eye sockets retain turtle character.
    oval('Sculpted cranium',(0,-.105,1.88),(.435,.345,.36),'skin','head',32)
    oval('Wide cheek muzzle',(0,-.365,1.742),(.392,.19,.186),'muzzle','jaw',32)
    for s,side in [(-1,'L'),(1,'R')]:
        oval('Eye socket '+side,(s*.23,-.350,1.96),(.138,.075,.164),'mouth' if stone else 'navy','head')
        oval('Eye '+side,(s*.23,-.395,1.965),(.119,.040,.144),'white','head')
        oval('Iris '+side,(s*.237,-.428,1.964),(.095,.017,.12),'iris','head')
        oval('Pupil '+side,(s*.237,-.442,1.968),(.065,.014,.093),'pupil','head')
        oval('Glint '+side,(s*.237-.025,-.455,2.005),(.023,.008,.029),'white','head',12)
        curve('Expressive brow '+side,[(s*.105,-.390,2.081),(s*.23,-.408,2.105),(s*.345,-.361,2.126 if stone else 2.075)],.033,'edge' if stone else 'navy','brow_'+side)
        oval('Nostril '+side,(s*.127,-.548,1.784),(.021,.012,.013),'mouth','jaw',12)
    curve('Smile crease',[(-.26,-.478,1.687),(-.13,-.536,1.659),(0,-.55,1.650),(.13,-.536,1.661),(.26,-.478,1.703)],.009,'mouth','jaw')
    if stone:
        for x in [-.24,0,.24]:faceted('Forehead scale',(x,-.14,2.17),(.105,.07,.05),'muzzle','head')
    else:
        # A closed-back, thick hood and flowing split robe; geometric volume, no alpha cutout.
        verts=[];faces=[];N=33;R=9
        for j in range(R):
            t=j/(R-1);r=1-.80*t*t
            for i in range(N):a=PI*(.01+i*.98/(N-1));verts.append((math.cos(a)*.535*r,-.37+t*.87,1.74+math.sin(a)*.64*r))
        for j in range(R-1):
            for i in range(N-1):a=j*N+i;faces.append((a,a+1,a+N+1,a+N))
        faces.append(tuple(range((R-1)*N,R*N)))
        me=bpy.data.meshes.new('Hood');me.from_pydata(verts,[],faces);ob=bpy.data.objects.new('Hood',me);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob
        mod=ob.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.045;bpy.ops.object.modifier_apply(modifier=mod.name);finish(ob,'Royal blue hood','navy','head')
        curve('Ivory hood piping',[(math.cos(PI*(.01+i*.98/32))*.535,-.385,1.74+math.sin(PI*(.01+i*.98/32))*.64) for i in range(33)],.031,'belly','head')
        for s in [-1,1]:
            oval('Robe shoulder',(s*.36,.035,1.4),(.22,.29,.16),'robe')
            curve('Golden stole',[(s*.23,-.265,1.47),(s*.29,-.325,1.1),(s*.32,-.24,.7)],.028,'gold')
        oval('Back cloak',(0,.39,1.02),(.47,.12,.56),'robe','spine')
        for side in [-1,1]:
            curve('Cloak ivory hem',[(side*.43,.43,1.37),(side*.46,.48,1.0),(side*.32,.46,.54)],.024,'belly','spine')
            curve('Cloak flowing seam',[(side*.22,.50,1.47),(side*.27,.515,1.0),(side*.15,.49,.51)],.013,'gold','spine')
        for i in range(3):
            curve('Embossed tide motif',[(math.cos(a)*(.20-i*.035),.53,1.14+math.sin(a)*(.20-i*.035)) for a in [j*PI*1.65/15 for j in range(16)]],.017,'belly','spine')
        curve('Waist sash',[(-.38,-.17,.75),(-.24,-.35,.73),(0,-.405,.73),(.24,-.35,.73),(.38,-.17,.75)],.041,'navy','spine')
        faceted('Tidal clasp',(0,-.41,1.3),(.085,.09,.05),'gold')
        add_bone('weapon',(.71,-.25,.95),(.77,-.25,1.65),'hand_R');add_bone('spell_tip',(.84,-.25,2.19),(.84,-.25,2.42),'weapon')
        curve('Ivory staff',[(.76,-.25,.19),(.77,-.25,.95),(.81,-.25,1.74),(.85,-.25,1.96)],.047,'belly','weapon')
        for z in [.29,.97,1.79]:curve('Staff gold binding',[(.78+.053*math.cos(a),-.25+.053*math.sin(a),z) for a in [i*2*PI/20 for i in range(21)]],.012,'gold','weapon')
        crystal('Staff crystal',(.85,-.25,1.92),(.12,.085,.39),'aqua','spell_tip')
        curve('Sculpted tidal crest',[(.85+math.cos(i/56*PI*3.6)*(.31-i/56*.25),-.25,2.22+math.sin(i/56*PI*3.6)*(.31-i/56*.25)) for i in range(57)],.036,'aqua','spell_tip')

def crab():
    material('shell','A34C39',.41);material('armor','613E40',.48);material('edge','D49064',.5);material('eye','FFE1A4',.2);material('pupil','202433',.26)
    add_bone('root',(0,0,0),(0,0,.2));add_bone('body',(0,0,.35),(0,0,.65),'root');add_bone('head',(0,-.3,.65),(0,-.45,.8),'body')
    oval('Heavy crab carapace',(0,0,.60),(.63,.48,.32),'shell','body',32)
    faceted('Carapace armored crest',(0,.04,.89),(.46,.33,.20),'armor','body')
    for s,side in [(-1,'L'),(1,'R')]:
        for i in range(3):
            h=(s*.43,.24-i*.25,.54);k=(s*(.83+abs(i-1)*.08),.36-i*.33,.30);e=(s*(1.01+abs(i-1)*.10),.42-i*.38,.025)
            b='leg_'+side+str(i);add_bone(b,h,k,'body');add_bone(b+'_tip',k,e,b)
            limb('Crab articulated leg '+b,[h,tuple(Vector(h).lerp(Vector(k),.7)),k,tuple(Vector(k).lerp(Vector(e),.6)),e],[.095,.09,.075,.045,.008],'shell',[b,b+'_tip'])
        h=(s*.48,-.24,.61);k=(s*.78,-.48,.65);e=(s*.84,-.73,.60);add_bone('claw_'+side,h,k,'body');add_bone('pincer_'+side,k,e,'claw_'+side)
        limb('Armored foreclaw '+side,[h,k,e],[.16,.14,.20],'armor',['claw_'+side,'pincer_'+side])
        oval('Pincer palm '+side,(s*.85,-.77,.64),(.25,.28,.22),'shell','pincer_'+side)
        for j in [-1,1]:
            b='finger_'+side+str(j);add_bone(b,(s*.85+j*.11,-.87,.67),(s*.85+j*.11,-1.2,.65),'pincer_'+side)
            curve('Curving pincer tooth',[(s*.85+j*.15,-.86,.66),(s*.85+j*.17,-1.06,.63),(s*.85+j*.035,-1.24,.61)],.07,'edge',b)
        curve('Eye stalk '+side,[(s*.20,-.31,.76),(s*.20,-.40,.9)],.045,'armor','head')
        oval('Crab eye '+side,(s*.20,-.43,.91),(.077,.06,.062),'eye','head',16);oval('Slit pupil '+side,(s*.20,-.480,.91),(.025,.015,.04),'pupil','head',12)
        curve('Menacing brow '+side,[(s*.12,-.46,.935),(s*.21,-.471,.98),(s*.29,-.41,.98)],.035,'armor','head')
    curve('Fierce mouth',[(-.2,-.449,.57),(0,-.51,.55),(.2,-.449,.57)],.018,'armor','head')

def rig_and_animate(role):
    data=bpy.data.armatures.new('SculptedSkeleton');rig=bpy.data.objects.new(role.title()+'ReviewRig',data);bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for name,(h,t,parent) in bones.items():
        b=data.edit_bones.new(name);b.head=h;b.tail=t
        if parent:b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in parts:mod=ob.modifiers.new('Weighted skeleton','ARMATURE');mod.object=rig;ob.parent=rig
    rig.animation_data_create()
    for p in rig.pose.bones:p.rotation_mode='XYZ'
    def rotate(name,axis,v):
        if name in rig.pose.bones:rig.pose.bones[name].rotation_euler[axis]=v
    def ease(t):return t*t*(3-2*t)
    def hump(t,a,b,c):return 0 if t<a or t>c else ease((t-a)/(b-a)) if t<b else 1-ease((t-b)/(c-b))
    clips={'idle':90,'walk':30,'attack':30 if role!='crab' else 36,'skill':60,'hit':21,'death':45,'turn_left':30,'turn_right':30,'arrive':48}
    for name,last in clips.items():
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame in range(1,last+1):
            t=(frame-1)/(last-1);wave=math.sin(t*PI*2)
            for p in rig.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
            if role=='crab':
                rotate('body',0,.025*wave)
                if name in ['walk','turn_left','turn_right']:
                    for s,side in [(-1,'L'),(1,'R')]:
                        for i in range(3):ph=math.sin(t*2*PI+(i%2)*PI+s*PI/2);rotate('leg_'+side+str(i),1,.24*ph);rotate('leg_'+side+str(i)+'_tip',0,.24*max(0,ph))
                if name in ['attack','skill']:
                    h=hump(t,0,.3,.9);p=hump(t,.28,.52,.94);rotate('claw_R',0,-.55*h+.8*p);rotate('pincer_R',2,-.42*h);rotate('finger_R-1',2,.6*h);rotate('finger_R1',2,-.6*h)
                if name=='hit':rotate('body',0,-.18*math.sin(PI*t))
                if name=='death':rig.pose.bones['body'].location.z=-.27*ease(t);rotate('body',1,1.65*ease(t))
            else:
                rotate('chest',0,.018*wave);rotate('neck',0,-.018*wave);rotate('head',1,.025*wave)
                if name in ['walk','turn_left','turn_right']:
                    for s,side in [(-1,'L'),(1,'R')]:
                        ph=wave*s;rotate('thigh_'+side,0,.34*ph);rotate('shin_'+side,0,-.47*max(0,-ph));rotate('foot_'+side,0,-.20*ph+.47*max(0,-ph));rotate('upper_'+side,0,-.19*ph);rotate('fore_'+side,0,-.10)
                    rotate('hips',2,.035*wave);rotate('chest',2,-.06*wave)
                if name=='idle':
                    for s,side in [(-1,'L'),(1,'R')]:rotate('fore_'+side,0,-.06+.025*wave);rotate('brow_'+side,1,.018*wave*s)
                if name=='attack':
                    wind=hump(t,0,.25,.5);hit=hump(t,.24,.46,.96)
                    rotate('spine',2,-.20*wind+.28*hit);rotate('chest',2,-.12*wind+.24*hit);rotate('neck',2,.12*wind-.2*hit)
                    rotate('upper_R',0,.36*wind-1.25*hit);rotate('fore_R',0,-.95*wind-.16*hit);rotate('upper_R',2,-.20*hit);rotate('hand_R',1,-.2*hit)
                    rotate('upper_L',0,-.28*hit);rotate('fore_L',0,-.58*hit);rotate('thigh_L',0,.12*wind);rotate('shin_L',0,-.17*wind)
                    if role=='crystal':rotate('upper_R',0,-.55*hit);rotate('fore_R',0,-.32*hit);rotate('upper_L',0,-.9*hit);rotate('fore_L',0,-.4*hit)
                if name=='skill':
                    wind=hump(t,0,.16,.34);power=hump(t,.12,.36,.90)
                    if role=='stone':
                        rotate('chest',0,.12*wind);rotate('upper_L',2,-.90*power);rotate('upper_R',2,.90*power);rotate('fore_L',0,-.3*power);rotate('fore_R',0,-.3*power)
                        rotate('hips',2,.065*math.sin(t*PI*12)*power)
                        for side,s in [('L',-1),('R',1)]:rotate('thigh_'+side,0,s*.16*math.sin(t*PI*12)*power);rotate('shin_'+side,0,-.20*abs(math.sin(t*PI*12))*power)
                    else:
                        rotate('upper_R',0,-1.0*power);rotate('fore_R',0,-.58*power);rotate('hand_R',1,-.15*power);rotate('upper_L',0,-.95*power);rotate('upper_L',2,-.3*power);rotate('fore_L',0,-.65*power);rotate('head',0,-.12*power)
                if name=='hit':
                    h=math.sin(PI*t);rotate('chest',0,-.23*h);rotate('neck',0,.12*h);rotate('upper_L',0,.22*h);rotate('upper_R',0,.22*h)
                if name=='death':
                    q=ease(t);rotate('thigh_L',0,-.6*q);rotate('thigh_R',0,-.6*q);rotate('shin_L',0,-.95*q);rotate('shin_R',0,-.95*q);rotate('chest',0,.52*q);rotate('head',0,.35*q);rig.pose.bones['hips'].location.z=-.25*q
                if name=='arrive':
                    h=hump(t,0,.30,1);rotate('chest',2,.16*h);rotate('head',1,-.18*h);rotate('fore_L',0,-.6*h);rotate('fore_R',0,-.8*h)
            for pb in rig.pose.bones:pb.keyframe_insert('rotation_euler',frame=frame);pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('scale',frame=frame)
        action.use_fake_user=True
        track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
    rig.animation_data.action=bpy.data.actions['idle'];bpy.context.scene.frame_set(1)
    return rig,clips

def run(role):
    global parts,mats,bones
    parts=[];mats={};bones={};bpy.ops.wm.read_factory_settings(use_empty=True)
    if role=='crab':crab()
    else:hero(role)
    rig,clips=rig_and_animate(role);src=SOURCE/role;out=OUT/role;src.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    bpy.context.scene.render.fps=30;bpy.ops.wm.save_as_mainfile(filepath=str(src/(role+'.blend')))
    # Join geometry while retaining material slots and every normalized skin weight.
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=role.title()+'SculptedMesh';rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.fbx(filepath=str(out/(role+'.fbx')),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=str(src/(role+'.glb')),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
    stats={'role':role,'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'vertices':len(mesh.data.vertices),'bones':list(bones),'clips':clips,'weightedVertices':sum(bool(v.groups) for v in mesh.data.vertices),'materials':list(mats),'source':'New editable geometry and authored weighted rig. No billboard body.'}
    (src/'model-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf8')
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.film_transparent=False
    world=bpy.data.worlds.new('Coastal ambient');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.55,.62,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for name,loc,power,size in [('Key',(-3,-4,6),600,4),('Fill',(4,-2,4),260,4),('Rim',(2,4,5),720,3)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
    material('floor','E6DDCA',.8);bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.data.materials.append(mats['floor'])
    cam=bpy.data.cameras.new('Review camera');ob=bpy.data.objects.new('Review camera',cam);bpy.context.collection.objects.link(ob);ob.location=(3.4,-6.5,3.2 if role!='crab' else 3.8);target=Vector((0,0,1.2 if role!='crab' else .45));ob.rotation_euler=(target-ob.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=3.3 if role!='crab' else 3.0;scene.camera=ob
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(src/'review.png');bpy.ops.render.render(write_still=True)
    print('SCULPTED_REVIEW_DONE',json.dumps(stats))

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['stone','crystal','crab']
    for role in args:run(role)
