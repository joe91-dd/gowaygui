"""Original editable standing cast for Art Bible V2; exports new, separately named assets.
Uses only mesh construction, authored palette and keyframes. Never imports/replaces legacy assets.
"""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(__file__).parent/'models'
OUT=Path(__file__).resolve().parents[2]/'assets/resources/models-modern'
random.seed(410)
ROLES=['stone','spike','crystal','leaf','bubble']
PALETTE=['EEAF48','FFD079','FFE6A4','28454A','FBFFFF','0089B8','111F32','A6CA51','4C8C42','BADA68','795234','C19047','D9A94E','177AB7','BEDBE8','6BD8E5','55535B','79727A','A29C9B','34445C','F4B938','E58025','48C5F2','126AAD','596078','72A5AF','72D7D7','E8AF8E','326C69','FAEBD0','247452','719CC7']
def rgba(hex):return tuple(int(hex[i:i+2],16)/255 for i in (0,2,4))+(1,)

def build(role):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source=SOURCE/role; out=OUT/f'{role}-turtle';source.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    prefix=role.title()+'Atlas_Modern'
    palette=list(PALETTE)
    if role=='stone':
        palette[16:19]=['514C53','71676C','928487'];palette[22]='00B8FA';palette[0]='F4B749';palette[1]='FFD173'
    atlas=bpy.data.images.new(prefix+'_color',512,512,alpha=True)
    pixels=[]
    for y in range(512):
        for x in range(512):
            col=rgba(palette[(y//64)*4+x//128]);variation=1+(random.random()-.5)*.016
            pixels.extend([min(1,c*variation) for c in col[:3]]+[1])
    atlas.pixels.foreach_set(pixels);atlas.filepath_raw=str(out/f'{role}-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    rough=bpy.data.images.new(prefix+'_roughness',32,32);rough.colorspace_settings.name='Non-Color';rp=[]
    for y in range(32):
        for x in range(32):
            tile=(y//4)*4+x//8;r=.21 if tile in [4,5,6,22,23] else .82 if tile in [16,17,18] else .68;rp.extend([r,r,r,1])
    rough.pixels.foreach_set(rp);rough.filepath_raw=str(out/f'{role}-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
    mat=bpy.data.materials.new(prefix);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);rt=mat.node_tree.nodes.new('ShaderNodeTexImage');rt.image=rough;mat.node_tree.links.new(rt.outputs['Color'],bs.inputs['Roughness'])
    parts=[]
    def finish(ob,name,tile,bone='body',smooth=True):
        ob.name=name;ob['bone']=bone;bpy.context.view_layer.objects.active=ob
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        if not ob.data.uv_layers:ob.data.uv_layers.new()
        for loop in ob.data.uv_layers.active.data:
            uv=loop.uv.copy();loop.uv=((tile%4+(uv.x*.85+.075))/4,(tile//4+(uv.y*.85+.075))/8)
        ob.data.materials.append(mat)
        for face in ob.data.polygons:face.use_smooth=smooth
        parts.append(ob);return ob
    def oval(name,p,scale,tile,bone='body',smooth=True,segments=24):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=14,location=p);ob=bpy.context.object;ob.scale=scale;return finish(ob,name,tile,bone,smooth)
    def rock(name,p,scale,tile,bone='shell'):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p);ob=bpy.context.object;ob.scale=scale;ob.rotation_euler=(random.random()*.3,random.random()*.3,random.random());bev=ob.modifiers.new('soft cut edges','BEVEL');bev.width=.045;bev.segments=2;bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=bev.name);return finish(ob,name,tile,bone,False)
    def tube(name,pts,r,tile,bone='body'):
        curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8;curve.bevel_depth=r;curve.bevel_resolution=3
        spline=curve.splines.new('POLY');spline.points.add(len(pts)-1)
        for point,p in zip(spline.points,pts):point.co=(*p,1)
        ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob=bpy.context.object;ob.select_set(False);return finish(ob,name,tile,bone)
    def cone(name,p,radius,depth,tile,bone='body',tilt=(0,0,0),vertices=6):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=.012,depth=depth,location=p);ob=bpy.context.object;ob.rotation_euler=tilt;return finish(ob,name,tile,bone,False)
    def leaf(name,p,size,tile,bone='body',angle=0):
        verts=[(-size*.36,0,0),(0,-size*.1,size*.15),(size*.36,0,0),(0,0,size),(-size*.2,.035,size*.45),(size*.2,.035,size*.45)]
        faces=[(0,1,4),(1,3,4),(1,2,5),(1,5,3),(0,4,3,5,2)]
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.location=p;ob.rotation_euler.y=angle;return finish(ob,name,tile,bone)
    skin=0 if role=='stone' else 9 if role=='spike' else 1 if role=='leaf' else 26
    dark=3;wide=1.30 if role=='stone' else 1.07
    oval('Body',(0,0,1.02),(.47*wide,.32,.65),skin)
    oval('Shell rim',(0,.24,1.09),(.60*wide,.29,.72),10,'shell')
    oval('Shell dome',(0,.37,1.13),(.55*wide,.29,.66),8 if role in ['spike','leaf'] else 13,'shell')
    oval('Plastron',(0,-.285,1.02),(.39*wide,.145,.51),2 if role!='bubble' else 14)
    for row in range(3):
        z=.77+row*.24
        tube('Plastron seam',[(-.29*wide,-.381,z+.027),(-.14*wide,-.424,z),(0,-.429,z-.008),(.14*wide,-.424,z),(.29*wide,-.381,z+.027)],.008,11 if role!='bubble' else 13)
    for side in [-1,1]:
        leg='rear_L' if side<0 else 'rear_R';arm='front_L' if side<0 else 'front_R'
        oval('Thigh',(side*.28,.02,.39),(.235,.25,.36),skin,leg)
        oval('Foot',(side*.31,-.18,.17),(.26,.36,.17),skin,leg)
        for toe in range(3):oval('Toe',(side*.31+(toe-1)*.13,-.44,.14),(.085,.11,.07),22 if role=='stone' else 2,leg,segments=12)
        oval('Shoulder',(side*.48,0,1.26),(.21,.21,.25),skin,arm)
        tube('Forearm',[(side*.5,-.02,1.21),(side*.63,-.13,1.02),(side*.66,-.25,1.0)],.16,skin,arm)
        oval('Hand',(side*.68,-.27,.98),(.20,.19,.19),skin,arm)
        for finger in range(3):oval('Fingers',(side*.68+(finger-1)*.095,-.407,.98),(.06,.055,.085),skin,arm,segments=12)
    oval('Neck',(0,-.04,1.52),(.24,.23,.24),skin,'head')
    oval('Head',(0,-.085,1.84),(.45,.35,.405),skin,'head')
    oval('Muzzle',(0,-.37,1.68),(.39,.235,.205),0 if role=='stone' else 1 if role=='leaf' else 26 if role!='spike' else 9,'head')
    for side in [-1,1]:
        oval('Eye socket',(side*.243,-.343,1.91),(.125,.045,.145),0 if role=='stone' else skin,'head')
        oval('Eye white',(side*.24,-.394,1.917),(.092,.020,.111),4,'head')
        oval('Iris',(side*.237,-.414,1.924),(.082,.023,.101),11 if role in ['stone','spike','leaf'] else 5,'head')
        oval('Pupil',(side*.23,-.437,1.924),(.059,.012,.084),6,'head')
        oval('Eye glint',(side*.23-.024,-.451,1.96),(.025,.009,.03),4,'head',segments=12)
        oval('Nostril',(side*.145,-.573,1.738),(.025,.014,.017),3,'head',segments=12)
        tube('Brow',[(side*.36,-.361,2.072),(side*.24,-.418,2.103),(side*.13,-.394,2.063)],.033,10 if role=='stone' else 8 if role=='spike' else 13,'head')
    tube('Smile',[(-.22,-.533,1.602),(-.1,-.571,1.575),(0,-.58,1.566),(.1,-.571,1.575),(.22,-.533,1.602)],.011,3,'head')
    tube('Belt',[(-.4,-.17,.71),(-.3,-.35,.71),(0,-.39,.71),(.3,-.35,.71),(.4,-.17,.71)],.055,10)
    rock('Belt buckle',(0,-.41,.73),(.095,.055,.09),12,'body')
    if role=='stone':
        for x,z,scale in [(-.22,2.11,.13),(0,2.16,.16),(.22,2.11,.13)]:rock('Golden face scute',(x,-.20,z),(scale,.10,scale*.70),1,'head')
        for row in range(3):
            for side in [-1,1]:rock('Carapace scute',(side*(.34+row*.055),.27,1.58-row*.25),(.24,.33,.26),16+row,'shell')
        for side in [-1,1]:
            arm='front_L' if side<0 else 'front_R'
            rock('Rock pauldron',(side*.61,0,1.37),(.38,.32,.30),17,arm)
            for j in range(3):rock('Layered pauldron',(side*(.50+j*.11),-.18,1.45-j*.13),(.20,.15,.17),16+j,arm)
            rock('Rock gauntlet',(side*.70,-.27,1),(.28,.25,.25),18,arm)
            cone('Shoulder crystal',(side*.72,.05,1.77),.17,.48,22,arm,tilt=(0,side*.33,0))
            rock('Forehead armor',(side*.36,.04,2.17),(.19,.19,.13),17,'head')
        for x,height in [(-.30,.50),(0,.68),(.3,.51)]:cone('Back crystal',(x,.37,1.93+height*.2),.19,height,22,'shell')
    elif role in ['spike','crystal']:
        cloth=8 if role=='spike' else 13;trim=11 if role=='spike' else 29
        # Continuous cloth surface around an open face; one soft silhouette.
        verts=[];faces=[];columns=33;rings=7
        for row in range(rings):
            t=row/(rings-1);radius=1-.54*t*t;y=-.36+t*.76
            for i in range(columns):
                angle=math.pi*(.005+i*.99/(columns-1))
                verts.append((math.cos(angle)*.53*radius,y,1.76+math.sin(angle)*.60*radius))
        for row in range(rings-1):
            for i in range(columns-1):
                a=row*columns+i;faces.append((a,a+1,a+1+columns,a+columns))
        faces.append(tuple(range((rings-1)*columns,rings*columns)))
        mesh=bpy.data.meshes.new('Hood');mesh.from_pydata(verts,[],faces);ob=bpy.data.objects.new('Hood',mesh);bpy.context.collection.objects.link(ob)
        bpy.context.view_layer.objects.active=ob;ob.select_set(True);solid=ob.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.035;bpy.ops.object.modifier_apply(modifier=solid.name)
        smooth=ob.modifiers.new('Soft folds','SUBSURF');smooth.levels=1;bpy.ops.object.modifier_apply(modifier=smooth.name);ob.select_set(False);finish(ob,'Continuous hood',cloth,'head')
        tube('Hood trim',[(math.cos(math.pi*(.005+i*.99/32))*.53,-.39,1.76+math.sin(math.pi*(.005+i*.99/32))*.60) for i in range(33)],.026,trim,'head')
        for side in [-1,1]:
            oval('Cape shoulder',(side*.40,.05,1.39),(.24,.29,.16),cloth)
            leaf('Cape hem',(side*.29,.37,.57),.63,cloth,angle=side*.25)
        if role=='spike':
            for i in range(7):leaf('Hood leaf',(-.39+i*.125,.10,2.10),.32,7+i%3,'head',angle=(i-3)*.26)
            for side in [-1,1]:
                for j in range(3):leaf('Layered cape',(side*(.20+j*.10),.38,1.03-j*.16),.44,7+j,angle=side*.55)
            bow=[(.89+math.sin(i/16*math.pi)*.23,-.37,.55+i/16*1.26) for i in range(17)]
            tube('Living wood bow',bow,.048,10,'front_R');tube('Bowstring',[bow[0],(.75,-.50,1.13),bow[-1]],.008,2,'front_R');tube('Arrow',[(-.42,-.55,1.10),(1.19,-.49,1.10)],.016,11,'front_L');cone('Arrowhead',(1.24,-.49,1.1),.064,.18,12,'front_L',tilt=(0,math.pi/2,0))
        else:
            for side in [-1,1]:tube('Robe gold seam',[(side*.35,-.14,.62),(side*.32,-.24,1.09),(side*.23,-.18,1.48)],.033,12)
            tube('Mage staff',[(.78,-.24,.20),(.83,-.24,1.66),(.90,-.24,2.13)],.055,10,'front_R')
            spiral=[]
            for i in range(50):a=i/49*math.pi*3.5;r=.29*(1-i/56);spiral.append((.91+math.cos(a)*r,-.26,2.24+math.sin(a)*r))
            tube('Water spiral',spiral,.042,22,'front_R')
            for i in range(5):oval('Water droplets',(-.56-i*.04,-.05,1.5+i*.10),(.035,.027,.05),22,'front_L',segments=12)
    elif role=='leaf':
        # Broad woven hat, warm lanterns and small explorer backpack.
        oval('Hat brim',(0,-.045,2.13),(.77,.58,.085),11,'head')
        cone('Straw hat crown',(0,.03,2.23),.51,.29,11,'head',vertices=32)
        for i in range(12):
            a=i*math.tau/12;tube('Hat weave',[(math.cos(a)*r,-.045+math.sin(a)*r*.75,2.185-.045*r) for r in [.18,.36,.56,.71]],.012,2,'head')
        tube('Hat band',[(-.44,-.12,2.23),(0,-.47,2.22),(.44,-.12,2.23)],.04,10,'head')
        for side in [-1,1]:
            arm='front_L' if side<0 else 'front_R';x=side*.91
            tube('Lantern handle',[(x-.10,-.27,1.11),(x-.10,-.27,1.34),(x+.1,-.27,1.34),(x+.1,-.27,1.11)],.022,10,arm)
            oval('Amber lantern',(x,-.27,.88),(.15,.14,.24),20,arm)
            for z in [.66,1.1]:oval('Lantern cap',(x,-.27,z),(.19,.17,.06),11,arm)
            for dx,dy in [(-1,-1),(-1,1),(1,-1),(1,1)]:tube('Lantern cage',[(x+dx*.12,-.27+dy*.1,.66),(x+dx*.12,-.27+dy*.1,1.1)],.018,10,arm)
        for i in range(3):leaf('Hat decoration',(-.15+i*.14,.0,2.35),.19,8,'head',angle=(i-1)*.5)
    else:
        for side in [-1,1]:
            arm='front_L' if side<0 else 'front_R';rock('Blue pauldron',(side*.53,.07,1.41),(.29,.30,.21),13,arm)
            for i in range(3):cone('Armor fin',(side*(.49+i*.12),.30,1.45+i*.18),.11,.34,13,'shell',tilt=(0,side*.65,0))
        tube('Anchor shaft',[(.86,-.20,.28),(.86,-.20,2.02)],.055,16,'front_R')
        tube('Anchor crown',[(.86+.24*math.cos(a),-.20,2.08+.24*math.sin(a)) for a in [i*math.tau/32 for i in range(33)]],.042,16,'front_R')
        tube('Anchor hook',[(.56,-.20,.67),(.62,-.20,.43),(.86,-.20,.31),(1.10,-.20,.43),(1.16,-.20,.67)],.052,16,'front_R')
        cone('Anchor tip',( .86,-.20,2.42),.085,.22,12,'front_R');rock('Chest clasp',(0,-.38,1.28),(.105,.05,.13),12)
    # Larger integrated face and compact silhouette, while retaining an editable rig.
    for ob in parts:
        if ob['bone']=='head':
            for vertex in ob.data.vertices:
                v=vertex.co;v.x*=1.10;v.z=1.78+(v.z-1.78)*1.10;v.y=-.12+(v.y+.12)*1.05
    # Existing runtime action vocabulary remains intact.
    arm_data=bpy.data.armatures.new(role.title()+'Turtle_Skeleton');rig=bpy.data.objects.new(role.title()+'Turtle_Rig',arm_data);bpy.context.collection.objects.link(rig);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    bones={'root':((0,0,0),(0,0,.25),None),'body':((0,0,.5),(0,0,1.15),'root'),'shell':((0,.25,1),(0,.25,1.5),'body'),'head':((0,0,1.5),(0,0,2.05),'body'),'front_L':((-.4,0,1.35),(-.67,-.2,.96),'body'),'front_R':((.4,0,1.35),(.67,-.2,.96),'body'),'rear_L':((-.27,0,.52),(-.3,0,.15),'root'),'rear_R':((.27,0,.52),(.3,0,.15),'root')}
    for name,(head,tail,parent) in bones.items():
        bone=arm_data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    for ob in parts:
        group=ob.vertex_groups.new(name=ob['bone']);group.add(list(range(len(ob.data.vertices))),1,'REPLACE');mod=ob.modifiers.new('Skin','ARMATURE');mod.object=rig;ob.parent=rig
    for pb in rig.pose.bones:pb.rotation_mode='XYZ'
    clips={'idle':(72,.025),'attack':(27,.30),'skill':(42,.55),'hit':(18,-.13),'rest':(72,-.12),'fusion':(60,.22),'walk':(30,.38)}
    rig.animation_data_create();scene=bpy.context.scene;scene.render.fps=30
    for name,(last,strength) in clips.items():
        act=bpy.data.actions.new(name);rig.animation_data.action=act
        for frame,phase in [(1,0),(last//3,1),(last*2//3,-.3),(last,0)]:
            for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0)
            rig.pose.bones['head'].rotation_euler.x=strength*phase*.22;rig.pose.bones['body'].rotation_euler.z=strength*phase*.08
            rig.pose.bones['front_R'].rotation_euler.x=-strength*phase;rig.pose.bones['front_L'].rotation_euler.x=strength*phase*.5
            if name=='walk':
                rig.pose.bones['rear_L'].rotation_euler.x=phase*.35;rig.pose.bones['rear_R'].rotation_euler.x=-phase*.35
                rig.pose.bones['root'].location.z=abs(phase)*.035
            if name=='fusion':rig.pose.bones['root'].location=Vector((0,0,max(0,phase)*.14))
            for pb in rig.pose.bones:
                pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_euler',frame=frame);pb.keyframe_insert('scale',frame=frame)
        act.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,act);track.mute=True
    rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(source/f'{role}-turtle.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=role.title()+'Turtle_V2_Mesh'
    mesh.data.materials.clear();mesh.data.materials.append(mat)
    for p in mesh.data.polygons:p.material_index=0
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.fbx(filepath=str(out/f'{role}-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
    (source/'model-stats.json').write_text(json.dumps({'role':role,'vertices':len(mesh.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':list(bones),'clips':list(clips),'source':'Original standing modern cast, reuses V2 editable geometry; runtime review required'},indent=2),encoding='utf-8')
    # Review actual geometry, not the image-generated UI portrait.
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.view_settings.look='AgX - Medium High Contrast'
    world=bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.46,.54,1)
    for name,loc,energy,size in [('Key',(-3,-4,6),450,4),('Rim',(3,2,5),600,3)]:
        light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;ob=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1.2))-ob.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new('Review');ob=bpy.data.objects.new('Review',camera);bpy.context.collection.objects.link(ob);ob.location=(3.4,-6.5,3.2);ob.rotation_euler=(Vector((0,0,1.22))-ob.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=2.95;scene.camera=ob;scene.render.filepath=str(source/'review.png');bpy.ops.render.render(write_still=True)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ROLES
for role in args:build(role)
