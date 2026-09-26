"""Geometry finishing and vertex ambient occlusion for the editable review models."""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def bake_contact_colors(mesh):
    """Short-range contact AO, not painted light direction; survives camera turns."""
    data=mesh.data
    bpy.context.view_layer.update()
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
    tree=BVHTree.FromPolygons([v.co for v in posed.vertices],[tuple(p.vertices) for p in posed.polygons])
    samples=[]
    for i in range(12):
        u=(i+.5)/12;a=i*2.3999632297
        samples.append((math.sqrt(u)*math.cos(a),math.sqrt(u)*math.sin(a),math.sqrt(1-u)))
    shades=[]
    for v in posed.vertices:
        n=v.normal.normalized();axis=Vector((0,0,1)) if abs(n.z)<.8 else Vector((0,1,0))
        tangent=n.cross(axis).normalized();bitangent=n.cross(tangent).normalized();blocked=0
        for x,y,z in samples:
            hit=tree.ray_cast(v.co+n*.006,tangent*x+bitangent*y+n*z,.28)
            if hit[0] is not None:blocked+=1
        shade=1-.36*blocked/len(samples)
        shades.append(shade)
    color=data.color_attributes.get('Color') or data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    data.color_attributes.active_color=color
    for loop in data.loops:
        shade=shades[loop.vertex_index];color.data[loop.index].color=(shade,shade,shade,1)
    evaluated.to_mesh_clear()
    return {'method':'12 hemisphere rays, .28m local contact radius','minimum':min(shades),'maximum':max(shades)}


def add_leg_controls(rig):
    """Two-bone IK and ground-aligned foot targets; exporter bakes solved joints."""
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for side in ['L','R']:
        foot=rig.data.edit_bones['foot_'+side]
        target=rig.data.edit_bones.new('foot_ik_'+side);target.head=foot.head;target.tail=foot.tail;target.parent=rig.data.edit_bones['root'];target.use_deform=False
        pole=rig.data.edit_bones.new('knee_pole_'+side);pole.head=(foot.head.x,-1.1,.45);pole.tail=(foot.head.x,-1.1,.65);pole.parent=rig.data.edit_bones['root'];pole.use_deform=False
    bpy.ops.object.mode_set(mode='OBJECT')
    for side in ['L','R']:
        ik=rig.pose.bones['shin_'+side].constraints.new('IK');ik.name='Planted leg solve';ik.target=rig;ik.subtarget='foot_ik_'+side;ik.pole_target=rig;ik.pole_subtarget='knee_pole_'+side;ik.chain_count=2;ik.use_stretch=False
        copy=rig.pose.bones['foot_'+side].constraints.new('COPY_ROTATION');copy.name='Keep sole aligned';copy.target=rig;copy.subtarget='foot_ik_'+side;copy.owner_space='WORLD';copy.target_space='WORLD'


def offset_world(rig,name,xyz):
    p=rig.pose.bones[name]
    p.location=p.bone.matrix_local.to_3x3().inverted()@Vector(xyz)


def animate_grounded(rig,role,clip,t,hump):
    if role=='crab':return
    def ease(t):return t*t*(3-2*t)
    breath=math.sin(t*math.pi*2)
    crouch=0
    if clip=='idle':crouch=.014*(.5+.5*breath)
    if clip=='attack':
        wind=hump(t,0,.23,.53);hit=hump(t,.24,.48,1)
        crouch=.045*wind+.017*hit;offset_world(rig,'hips',(.034*hit,-.036*hit,-crouch))
    elif clip in ['skill','arrive','hit']:
        crouch=.05*hump(t,0,.25,.97);offset_world(rig,'hips',(0,0,-crouch))
    elif clip=='idle':offset_world(rig,'hips',(0,0,-crouch))
    for side,phase in [('L',0),('R',math.pi)]:
        target='foot_ik_'+side
        if clip in ['walk','turn_left','turn_right']:
            a=t*math.pi*2+phase;lift=max(0,math.sin(a))
            stride=.20 if clip=='walk' else .09
            offset_world(rig,target,(0,stride*math.cos(a),.09*lift))
        elif clip=='death':
            offset_world(rig,target,(0,.10*ease(t),0))
        else:offset_world(rig,target,(0,0,0))
        # The lid is actual skin geometry in front of the eye, not a black mask.
        blink=hump(t,.73,.77,.84) if clip=='idle' else 0
        expression=(.17 if role=='stone' else .08)*hump(t,0,.26,.9) if clip in ['attack','skill'] else 0
        amount=max(blink,expression)
        lid=rig.pose.bones['lid_'+side];lid.scale.y=.035+.965*amount
        offset_world(rig,'lid_'+side,(0,0,.147*(1-amount)))


def add_tunic(api):
    finish,curve,oval=api
    vertices=[];faces=[];rings=[(.56,.38,.30),(.72,.43,.35),(1.03,.43,.38),(1.30,.40,.34),(1.46,.32,.24)];n=40
    for row,(z,rx,ry) in enumerate(rings):
        for i in range(n):
            a=i*2*math.pi/n;pleat=1+.018*math.cos(a*8)*(1-row/5)
            vertices.append((math.cos(a)*rx*pleat,math.sin(a)*ry*pleat,z+.035*math.sin(a*4)*(1-row/5)))
    for j in range(len(rings)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))])
    data=bpy.data.meshes.new('Tailored coat');data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new('Tailored ivory coat',data);bpy.context.collection.objects.link(o)
    def weights(v):
        t=max(0,min(1,(v.z-.85)/.4));return {'spine':1-t,'chest':t}
    finish(o,'Tailored ivory coat','belly',weights=weights)
    for side in [-1,1]:
        curve('Broad blue lapel',[(side*.16,-.265,1.43),(side*.21,-.34,1.22),(side*.09,-.40,.92)],.057,'navy')
        curve('Lapel gold edge',[(side*.19,-.30,1.43),(side*.24,-.365,1.20),(side*.13,-.43,.92)],.012,'gold')
    for z in [.88,.77]:oval('Coat clasp',(0,-.385,z),(.038,.023,.038),'gold','spine',12)
