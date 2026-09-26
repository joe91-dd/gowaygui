"""Authored form/material pass for the approved five-character cast.

All details are model surfaces, attached to the existing deforming skeleton.
The generated studio images are renders of these same exported meshes.
"""
import bpy, bmesh, math, random
from mathutils import Vector
PI=math.pi

def install(C):
    B=C.B
    original_body=C.build_body
    original_setup=C.setup
    original_equipment=C.equipment
    original_face=C.face
    original_armor=C.armor
    original_hat=C.hat

    def setup(role):
        original_setup(role)
        for name,color,rough,metal in [('rockCool','625E65',.72,0),('rockWarm','8B7766',.7,0),('skinShade','D99426',.54,0),('leafVein','709680',.55,0),('linen','D5D9D5',.82,0),('blueDeep','14558B',.57,0),('goldLight','E8BE71',.3,.65),('amber','E69A35',.3,0)]:
            B.material(name,color,rough,metal)
        # Fine relief is subordinate to shape. These nodes are baked into UV
        # textures before export; Cocos never has to interpret Blender nodes.
        for name,m in B.mats.items():
            n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
            if name in ['white','iris','irisDark','pupil','mouth','fire']:continue
            for link in list(p.inputs['Normal'].links):l.remove(link)
            coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise')
            l.new(coord.outputs['Generated'],noise.inputs['Vector']);noise.inputs['Scale'].default_value=7;noise.inputs['Detail'].default_value=3
            base=p.inputs['Base Color'].default_value[:]
            ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[1].position=.83
            strength=.19 if name.startswith('rock') else .10 if name in ['jade','pine','leafMid','orange','straw','wood','leather'] else .045
            ramp.color_ramp.elements[0].color=tuple(c*(1-strength) for c in base[:3])+(1,)
            ramp.color_ramp.elements[1].color=tuple(min(1,c*(1+strength)) for c in base[:3])+(1,)
            l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
            vor=n.new('ShaderNodeTexVoronoi');vor.feature='DISTANCE_TO_EDGE';vor.inputs['Scale'].default_value=19 if name.startswith('rock') else 38 if name in ['skin','muzzle'] else 110
            l.new(coord.outputs['Generated'],vor.inputs['Vector'])
            bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.26 if name.startswith('rock') else .13
            bump.inputs['Distance'].default_value=.017 if name.startswith('rock') else .007 if name in ['skin','muzzle'] else .003
            l.new(vor.outputs['Distance'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
            if name.startswith('rock'):
                crack=n.new('ShaderNodeValToRGB');crack.color_ramp.elements[0].position=.015;crack.color_ramp.elements[0].color=(.52,.46,.40,1);crack.color_ramp.elements[1].position=.07
                l.new(vor.outputs['Distance'],crack.inputs[0]);mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.37;l.new(ramp.outputs[0],mix.inputs[1]);l.new(crack.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
            if name in ['aqua','aquaLight','aquaDeep','violet']:
                p.inputs['Roughness'].default_value=.22;p.inputs['Coat Weight'].default_value=.5;p.inputs['Coat Roughness'].default_value=.12
        # More material separation without turning skin into glossy plastic.
        B.mats['skin'].node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.045
    C.setup=setup

    def stone_chunk(name,center,scale,bone='shell',normal=(0,-1,0),mat='rock'):
        """Irregular convex mineral mass, with broken planes and a domed face."""
        verts=[];rx,rz,depth=scale;n=8
        seed=random.Random(sum(ord(c)*(i+1) for i,c in enumerate(name))+int(center[0]*315+center[2]*821))
        outline=[seed.uniform(.86,1.12) for _ in range(n)]
        for k,(r,z) in enumerate([(1,-.45),(1,.12),(.77,.63),(.34,.78)]):
            for i in range(n):
                a=(i+.06*(k%2))*2*PI/n;verts.append((math.cos(a)*rx*r*outline[i],math.sin(a)*rz*r*outline[i],depth*(z+seed.uniform(-.11,.11))))
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[]);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.convex_hull(bm,input=list(bm.verts));bm.to_mesh(me);bm.free()
        ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.location=center;ob.rotation_euler=Vector(normal).to_track_quat('Z','Y').to_euler()
        ob=B.finish(ob,name,mat,bone,False)
        for nm in ['rockLight','rockCool','rockWarm']:ob.data.materials.append(B.mats[nm])
        for poly in ob.data.polygons:poly.material_index=seed.choices([0,1,2,3],[.55,.18,.22,.05])[0]
        bpy.context.view_layer.objects.active=ob;bevel=ob.modifiers.new('Worn mineral arris','BEVEL');bevel.width=.009;bevel.segments=2;bevel.affect='EDGES';bpy.ops.object.modifier_apply(modifier=bevel.name)
        return ob

    def discard(prefixes):
        doomed=[o for o in B.parts if o.name.startswith(prefixes)]
        B.parts=[o for o in B.parts if o not in doomed]
        for o in doomed:bpy.data.objects.remove(o,do_unlink=True)

    def body(role):
        original_body(role)
        if role!='stone':return
        discard(('Carapace scute','Shoulder mass','Solid shoulder rock','Wrist stone bracer','Ankle rock guard','Temple armor','Forehead crown','Back blue crystal'))
        # Shell armor wraps the flank instead of being a regular tiled plate.
        for row,(z,rad) in enumerate([(.73,.52),(1.05,.65),(1.40,.65),(1.72,.54),(1.94,.34)]):
            count=5 if row in [1,2] else 4
            for i in range(count):
                a=.14+i*(PI-.28)/(count-1);x=math.cos(a)*rad*1.19;y=.36+math.sin(a)*(.40 if row<4 else .30)
                stone_chunk('Dorsal interlocking mineral %d %d'%(row,i),(x,y,z),(.24 if row<4 else .20,.23,.22),'shell',(math.cos(a),math.sin(a),.35*(z-1.2)))
        for s,side in [(-1,'L'),(1,'R')]:
            sh,el,_=B.bones['upper_'+side];wr=B.bones['hand_'+side][0];an=B.bones['foot_'+side][0]
            stone_chunk('Great shoulder mineral '+side,(sh[0]+s*.025,-.19,1.65),(.375,.295,.28),'upper_'+side,(s*.35,-1,.6),'rockLight')
            for k in range(3):
                stone_chunk('Shoulder overlapping skirt '+side+str(k),(sh[0]+s*(.12+.09*k),.03,1.59-k*.065),(.18,.15,.20),'upper_'+side,(s*.8,-.5,.45))
            for i in range(5):
                a=2*PI*i/5;p=(wr[0]+math.cos(a)*.19,wr[1]+math.sin(a)*.18,wr[2]+.16)
                stone_chunk('Enclosing stone gauntlet '+side+str(i),p,(.155,.175,.15),'fore_'+side,(math.cos(a),math.sin(a),.15))
            for i in range(4):
                a=PI+.18+i*(PI-.36)/3
                stone_chunk('Articulated ankle mineral '+side+str(i),(an[0]+math.cos(a)*.22,an[1]+math.sin(a)*.22,.34),(.16,.14,.12),'shin_'+side,(math.cos(a),math.sin(a),.4))
            stone_chunk('Face temple stone '+side,(s*.51,-.06,2.31),(.13,.21,.16),'head',(s*.6,-.5,.4))
            for j in range(3):
                stone_chunk('Neck collar stone '+side+str(j),(s*(.36+j*.12),-.20,1.96-j*.115),(.145,.14,.14),'shell',(s*.3,-1,.25))
        for x,z,h in [(0,2.30,.72),(-.35,2.14,.58),(.35,2.14,.58),(-.67,1.91,.42),(.67,1.91,.42),(0,1.60,.51)]:
            B.crystal('Dorsal fractured azure mineral',(x,.57 if x else .70,z),(.19 if x==0 else .15,.17,h),'aqua','shell',x*.47)
        for x in [-.29,0,.29]:stone_chunk('Fitted forehead mineral',(x,-.15,2.57),(.195,.12,.145),'head',(x*.4,-.75,.55))
        # Narrow the space between shell and sternum and round the plastron.
        for o in B.parts:
            if o.name.startswith('Paired abdominal'):
                for v in o.data.vertices:
                    if v.co.y<-.4:v.co.y-=.02*max(0,1-(v.co.x/.60)**2)
    C.build_body=body

    def face(role):
        original_face(role)
        # Reposition eye parts as coherent socket assemblies. Smaller warrior
        # eyes, almond ranger eyes, relaxed mage lids and a short healer muzzle.
        eye_prefix=('Eye globe','Iris ','Pupil','Eye catchlight','Eye secondary','Upper sculpted','Lower sculpted','Expression upper','Blink skin')
        for ob in B.parts:
            if ob.name.startswith(eye_prefix):
                s=-1 if ob.name.endswith('L') else 1
                sx=.91 if role=='stone' else 1.03 if role=='spike' else .98
                sz=.84 if role=='stone' else .89 if role=='spike' else .94 if role=='crystal' else 1.02 if role=='leaf' else .92
                for v in ob.data.vertices:
                    v.co.x=s*.27+(v.co.x-s*.275)*sx
                    v.co.z=2.315+(v.co.z-2.316)*sz
                    v.co.y+=.030
            if ob.name.startswith(('Iris dark','Iris colored','Pupil','Eye catch','Eye secondary')):
                s=-1 if ob.name.endswith('L') else 1
                for v in ob.data.vertices:v.co.x=s*.27+(v.co.x-s*.27)*.91
            if ob.name.startswith('Anatomical brow'):
                for v in ob.data.vertices:
                    if role=='stone':v.co.z-=.045;v.co.y-=.007
                    elif role=='leaf':v.co.z-=.012
            if ob.name.startswith(('Continuous facial','Lower muzzle','Recessed closed mouth','Nostril')):
                for v in ob.data.vertices:
                    if role=='stone':v.co.x*=.98
                    elif role=='spike':v.co.x*=.95
                    elif role=='leaf':v.co.x*=.95;v.co.z=2.12+(v.co.z-2.12)*.96
        # The socket rims sink into the head; no disconnected lash discs.
        for s,side in [(-1,'L'),(1,'R')]:
            if role in ['crystal','bubble']:
                for i in range(3):
                    C.oval('Cheek freckles '+side+str(i),(s*(.31+i*.047),-.435+i*.020,2.16+i*.016),(.025,.006,.018),'muzzle','head',16)
        if role=='stone':
            # Smaller skull relative to massive armor, anchored at the neck.
            names=['head','jaw','brow_L','brow_R','lid_L','lid_R']
            for ob in B.parts:
                if ob.vertex_groups and all(g.name in names for g in ob.vertex_groups):
                    for v in ob.data.vertices:v.co.x*=.94;v.co.z=1.86+(v.co.z-1.86)*.93
            for name in names:
                h,t,p=B.bones[name];B.bones[name]=((h[0]*.94,h[1],1.86+(h[2]-1.86)*.93),(t[0]*.94,t[1],1.86+(t[2]-1.86)*.93),p)
    C.face=face

    def leaf_shape(name,base,tip,width,mat,bone='chest',normal=(0,-1,0)):
        p=Vector(base);d=Vector(tip)-p;axis=d.normalized();nor=Vector(normal).normalized();side=axis.cross(nor).normalized();nor=side.cross(axis).normalized();rows=14;cols=6;vs=[];fs=[]
        def pos(t,u):
            w=width*(math.sin(PI*t)**.73);return p+d*t+side*w*u+nor*(.065*math.sin(PI*t)*(1-u*u)-.023*u*u*math.sin(PI*t))
        for j in range(rows+1):
            for k in range(cols+1):vs.append(tuple(pos(j/rows,-1+2*k/cols)))
            if j:
                for k in range(cols):a=j*(cols+1)+k;fs.append((a-cols-1,a,a+1,a-cols))
        ob=C.mesh(name,vs,fs,mat,bone);bpy.context.view_layer.objects.active=ob;m=ob.modifiers.new('Supple leaf edge','SOLIDIFY');m.thickness=.016;bpy.ops.object.modifier_apply(modifier=m.name)
        if width>.09:
            vein='leafVein' if mat in ['jade','pine','leafMid','newLeaf'] else 'orangeLight'
            C.line('Raised botanical midrib',[tuple(pos(t,0)+nor*.009) for t in [.04,.22,.43,.66,.87,.96]],.0045,vein,bone)
            for t in [.28,.45,.61,.75]:
                for s in [-1,1]:C.line('Soft secondary leaf vein',[tuple(pos(t,0)+nor*.007),tuple(pos(t+.035,s*.42)+nor*.008),tuple(pos(t+.09,s*.82)+nor*.008)],.0022,vein,bone)
        return ob
    C.leaf_shape=leaf_shape

    def hood(role):
        n=64;rows=20;vs=[];fs=[];mat='pine' if role=='spike' else 'robe'
        # A pointed hood opening with cheek room and a deep fitted lining.
        for j in range(rows+1):
            t=j/rows;f=math.cos(t*PI/2)*.985+.015
            for i in range(n):
                a=i*2*PI/n;co=math.cos(a);si=math.sin(a)
                x=si*(.60+.07*max(0,-co))*f
                z=2.24+(.62*co+.10*max(0,co)**10-.11*max(0,-co)**3)*f
                y=-.45+t*.98+.035*math.cos(3*a)*math.sin(PI*t)
                vs.append((x,y,z))
                if j:k=j*n+i;b=j*n+(i+1)%n;fs.append((k-n,k,b,b-n))
        ob=C.mesh('Tailored hood shell',vs,fs,mat,'head');bpy.context.view_layer.objects.active=ob
        ob.data.materials.append(B.mats['pine' if role=='spike' else 'blueDeep']);solid=ob.modifiers.new('Substantial lined hood','SOLIDIFY');solid.thickness=.048;solid.material_offset=1;bpy.ops.object.modifier_apply(modifier=solid.name)
        C.line('Hood bound opening',[vs[i] for i in range(n)]+[vs[0]],.018,'newLeaf' if role=='spike' else 'gold','head')
        C.line('Tailored hood central seam',[(0,-.44,2.96),(0,-.10,2.92),(0,.29,2.78),(0,.48,2.49)],.005,'jade' if role=='spike' else 'linen','head')
        if role=='spike':
            for row in range(3):
                for i in range(7):
                    a=(i-3)*.37;b=(math.sin(a)*.24,-.08+row*.22,2.91-row*.12)
                    tip=(math.sin(a)*.63,-.41+row*.36,2.63-abs(a)*.18-row*.20)
                    leaf_shape('Overlapping jade hood foliage',b,tip,.15+row*.025,['jade','leafMid','pine'][(i+row)%3],'head',normal=(math.sin(a)*.4,-.8 if row==0 else .4,.5))
            for s in [-1,1]:leaf_shape('Hood side draped leaf',(s*.40,.13,2.60),(s*.63,.24,2.16),.18,'jade','head',(s,0,.3))
        else:
            for s in [-1,1]:
                C.line('Cobalt hood applique',[(s*.15,-.47,2.84),(s*.28,-.46,2.68),(s*.44,-.46,2.44)],.040,'blue','head')
                C.line('Applique gold edge',[(s*.115,-.483,2.84),(s*.25,-.48,2.68),(s*.40,-.48,2.44)],.009,'gold','head')
    C.hood=hood

    def cloak(role):
        mat='jade' if role=='spike' else 'orange';alt='pine' if role=='spike' else 'orangeLight'
        # Broad mantle across shoulders, layered over an actual garment torso.
        for row,(z,rad) in enumerate([(1.80,.55),(1.60,.65),(1.37,.69),(1.11,.62)]):
            for i in range(11):
                a=-.18+i*(PI+.36)/10;normal=(math.cos(a),math.sin(a),.10)
                leaf_shape('Overlapping mantle plumage',(math.cos(a)*rad*.72,.10+math.sin(a)*.35,z+.09),(math.cos(a)*rad*1.10,.13+math.sin(a)*.54,z-.26),.205,alt if (i+row)%4==0 else mat,'cape',normal)
        for s in [-1,1]:
            for j in range(3):leaf_shape('Front shoulder mantle',(s*.12,-.36,1.77-j*.025),(s*(.46+j*.15),-.36,1.50-j*.115),.16,mat if j%2 else alt,'chest')
            leaf_shape('Overlapping chest leaf',(s*.32,-.555,1.67),(-s*.21,-.58,1.27),.15,mat,'chest')
            if role=='spike':
                for j in range(2):leaf_shape('Crossed lower tunic leaf',(s*.42,-.40,1.12),(-s*.18,-.54,.93-j*.15),.13,'jade','spine')
                # Bracer and boots are part of the silhouette, not painted bands.
                wr=B.bones['hand_'+('L' if s<0 else 'R')][0];bn='fore_'+('L' if s<0 else 'R');an=B.bones['foot_'+('L' if s<0 else 'R')][0]
                C.ring('Leather ranger bracer',(wr[0],wr[1],wr[2]+.11),.18,.17,'leather',bn,.043)
                leaf_shape('Bracer leaf', (wr[0]-.10,wr[1]-.17,wr[2]+.23),(wr[0]+.12,wr[1]-.20,wr[2]+.03),.075,'jade',bn)
                C.ring('Ranger boot cuff',(an[0],-.11,.32),.25,.25,'leather','shin_'+('L' if s<0 else 'R'),.047)
                leaf_shape('Boot pointed leaf',(an[0]-.18,-.28,.32),(an[0]+.16,-.34,.19),.09,'jade','foot_'+('L' if s<0 else 'R'))
        C.oval('Mantle round gold clasp',(0,-.605,1.66),(.086,.037,.086),'gold','chest')
        C.oval('Mantle clasp inset',(0,-.641,1.66),(.063,.010,.063),'goldLight','chest')
        C.line('Broad diagonal leather baldric',[(-.36,-.41,1.53),(-.14,-.57,1.30),(.22,-.50,1.10),(.43,-.37,.95)],.042,'leather','chest')
        for t in [.30,.54,.78]:
            C.oval('Baldric brass rivet',(-.34+.75*t,-.57+.16*t,1.53-.57*t),(.015,.010,.015),'gold','chest',16)
    C.cloak=cloak

    def cloth_panel(name,outline,mat,bone='chest',bulge=.03):
        # Subdivided curved, thick cloth with a central seam and bounded hem.
        a,b,c,d=[Vector(p) for p in outline];vs=[];fs=[];n=10
        for j in range(n+1):
            t=j/n
            for i in range(n+1):
                u=i/n;p=a.lerp(b,u).lerp(d.lerp(c,u),t);p.y-=bulge*math.sin(PI*u)*math.sin(PI*t);vs.append(tuple(p))
                if j and i:k=j*(n+1)+i;fs.append((k-n-2,k-n-1,k,k-1))
        ob=C.mesh(name,vs,fs,mat,bone);bpy.context.view_layer.objects.active=ob;sol=ob.modifiers.new('Tailored cloth thickness','SOLIDIFY');sol.thickness=.025;bpy.ops.object.modifier_apply(modifier=sol.name)
        return ob

    def robe(role):
        # Underdress, distinct coat tails, lapels and bell sleeves. The shell
        # remains exposed at the back, as in the approved turnaround.
        for s in [-1,1]:
            cloth_panel('Ivory fitted chest panel',[(s*.03,-.46,1.72),(s*.39,-.37,1.67),(s*.48,-.38,.95),(s*.02,-.53,.96)],'robe')
            cloth_panel('Cobalt lower underrobe',[(s*.0,-.44,1.02),(s*.46,-.37,1.01),(s*.41,-.35,.44),(s*.01,-.46,.45)],'blue','spine')
            cloth_panel('Separate ivory coat tail',[(s*.10,-.54,1.02),(s*.49,-.37,1.01),(s*.61,-.40,.44),(s*.19,-.56,.48)],'robe','spine',.035)
            C.line('Coat tail gilded hem',[(s*.13,-.56,1.02),(s*.19,-.59,.49),(s*.40,-.53,.46),(s*.61,-.43,.46)],.012,'gold','spine')
            cloth_panel('Blue inset coat applique',[(s*.27,-.563,.94),(s*.45,-.44,.93),(s*.53,-.465,.55),(s*.31,-.59,.58)],'blue','spine',.006)
            C.line('Ivory turned lapel gold rim',[(s*.25,-.35,1.79),(s*.30,-.46,1.59),(s*.05,-.585,1.29)],.017,'gold','chest')
            C.line('Cobalt crossed woven sash',[(s*.31,-.42,1.63),(0,-.576,1.38),(-s*.32,-.49,1.19)],.047,'blue','chest')
            # Shoulder capelets have a broad curved surface, not just spheres.
            cloth_panel('Ivory shoulder capelet',[(s*.21,-.29,1.85),(s*.55,-.15,1.79),(s*.76,-.16,1.57),(s*.38,-.39,1.62)],'robe','upper_'+('L' if s<0 else 'R'))
            C.line('Capelet gold edge',[(s*.22,-.31,1.86),(s*.42,-.36,1.72),(s*.77,-.18,1.57)],.012,'gold','upper_'+('L' if s<0 else 'R'))
        for side in ['L','R']:
            sh,el,_=B.bones['upper_'+side];wr=B.bones['hand_'+side][0]
            pts=[sh,tuple(Vector(sh).lerp(Vector(el),.55)),el,tuple(Vector(el).lerp(Vector(wr),.72))]
            sleeve=B.limb('Continuous ivory bell sleeve '+side,pts,[.29,.28,.255,.25],'robe',['upper_'+side,'fore_'+side])
            p=Vector(pts[-1]);axis=(p-Vector(el)).normalized();rx=axis.cross(Vector((0,1,0))).normalized();ry=axis.cross(rx).normalized()
            for radius,offset,mat in [(.25,0,'gold'),(.227,.005,'blueDeep')]:C.line('Sleeve turned cuff '+side,[tuple(p+rx*math.cos(i*PI/24)*radius+ry*math.sin(i*PI/24)*radius+axis*offset) for i in range(49)],.014,mat,'fore_'+side)
        for s in [-1,1]:B.crystal('Azure capelet crystal',(s*.54,.12,1.73),(.115,.1,.34),'aqua','shell',s*.4)
    C.robe=robe

    def armor():
        original_armor()
        discard(('Helmet central gold ridge','Helmet swept fin','Gold chest rim','Indigo breastplate','Layered pauldron','Articulated forearm armor','Indigo greave'))
        # A fitted broad breastplate, with breast/abdomen articulation instead
        # of a stack of unrelated floating diamonds.
        for s in [-1,1]:
            cloth_panel('Indigo sculpted breastplate',[(s*.04,-.39,1.78),(s*.41,-.36,1.68),(s*.47,-.51,1.19),(s*.02,-.565,1.11)],'indigo',bulge=.045)
            C.line('Breastplate shaped gold border',[(s*.03,-.42,1.78),(s*.40,-.39,1.68),(s*.47,-.54,1.21),(s*.07,-.59,1.12)],.017,'gold','chest')
            cloth_panel('Indigo hip armor skirt',[(s*.06,-.51,1.02),(s*.42,-.38,1.00),(s*.45,-.37,.70),(s*.18,-.55,.61)],'indigo','spine')
            C.line('Hip armor gold border',[(s*.42,-.41,1.00),(s*.45,-.40,.70),(s*.18,-.58,.61),(s*.06,-.54,1.02)],.014,'gold','spine')
        # Helmet ridgeline lies on the dome, avoiding the previous floating fin.
        C.line('Fitted helmet center crest',[(0,-.46,2.77),(0,-.18,2.85),(0,.12,2.83),(0,.37,2.68)],.04,'gold','head')
        for s,side in [(-1,'L'),(1,'R')]:
            sh,el,_=B.bones['upper_'+side];wr=B.bones['hand_'+side][0];an=B.bones['foot_'+side][0]
            for j in range(2):
                C.line('Curved pauldron gold welt '+side+str(j),[(sh[0]-s*.21,-.18,sh[2]+.20-j*.12),(sh[0],-.30,sh[2]+.24-j*.12),(sh[0]+s*.29,-.20,sh[2]+.06-j*.10)],.018,'gold','upper_'+side)
            for j in range(3):
                p=Vector(el).lerp(Vector(wr),.18+j*.27);C.oval('Curved forearm indigo vambrace '+side+str(j),p,(.228,.20,.14),'indigo','fore_'+side)
                C.ring('Vambrace gold binding '+side+str(j),p,.230,.201,'gold','fore_'+side,.012)
            C.oval('Indigo rounded greave '+side,(an[0],-.12,.30),(.27,.27,.22),'indigo','shin_'+side)
            C.ring('Greave gold upper binding '+side,(an[0],-.12,.40),.25,.25,'gold','shin_'+side,.015)
            C.line('Sabatons gold edge '+side,[(an[0]-.27,-.21,.17),(an[0]-.22,-.39,.16),(an[0],-.46,.16),(an[0]+.22,-.39,.16),(an[0]+.27,-.21,.17)],.014,'gold','foot_'+side)
    C.armor=armor

    def hat():
        original_hat()
        # Real woven strips: different offsets prevent a flat grid appearance.
        for j in range(5,15):
            r=.30+(j-5)*.071;z=2.71-.24*(r/.98)**1.1
            C.ring('Rolled straw weave ring',(0,0,z+.015),r,r*.80,'strawLight' if j%2 else 'straw','head',.012)
        C.ring('Bound broad hat brim',(0,0,2.473),.984,.791,'woodLight','head',.027)
        for i in range(20):
            a=i*PI/10;x=math.cos(a)*.978;y=math.sin(a)*.782
            C.line('Hat edge leather lacing',[(x*.96,y*.96,2.50),(x,y,2.49),(x*1.012,y*1.012,2.47),(x*.98,y*.98,2.445)],.012,'leather','head')
    C.hat=hat

    def equipment(role):
        original_equipment(role)
        if role=='stone':return
        side='R' if role in ['crystal','bubble'] else 'L';x,y,z=B.bones['hand_'+side][0];y-=.14
        if role=='spike':
            for zz in [.53,2.06]:C.oval('Carved walnut bow nock',(x+.05,y,zz),(.081,.071,.095),'wood','weapon',24)
            # Small leaf terminals and carved tendons follow the actual bow.
            for base,tip in [((x-.13,y-.045,1.70),(x-.23,y-.04,1.97)),((x-.16,y-.045,.79),(x-.15,y-.04,.58))]:leaf_shape('Bow jade inlay leaf',base,tip,.060,'jade','weapon')
        elif role=='crystal':
            for phase in [0,PI]:
                pts=[]
                for i in range(35):t=i/34;a=t*PI*2.2+phase;pts.append((x+math.cos(a)*.075,y+math.sin(a)*.075,1.88+t*.50))
                C.line('Intertwined staff root carving',pts,.025,'gold' if phase else 'woodLight','weapon')
            # Flattened water petals join the crest rather than detached cones.
            for j in range(4):
                a=j*.61+.14;p=(x+math.cos(a)*.29,y,2.54+math.sin(a)*.29)
                leaf_shape('Azure wave droplet crest',p,(p[0]-.085,y-.014,p[2]+.15),.035,'aqua','weapon')
        elif role=='leaf':
            cz=z-.52
            for i in range(4):
                a=i*PI/2;xx=x+math.cos(a)*.15;yy=y+math.sin(a)*.125
                C.line('Lantern diamond glazing',[(xx,yy,cz-.22),(x+math.cos(a+.7)*.16,y+math.sin(a+.7)*.13,cz),(xx,yy,cz+.22)],.006,'gold','lantern')
            C.ring('Bronze lamp foot',(x,y,cz-.31),.197,.16,'gold','lantern',.016)
        else:
            for zz in [.29,.42,1.45,2.20]:C.ring('Raised focus staff gold collar',(x,y,zz),.070,.070,'goldLight','weapon',.012)
            C.plate('Focus crown cap',(x,y,2.88),.08,.105,.085,'navy','weapon',n=4)
    C.equipment=equipment

