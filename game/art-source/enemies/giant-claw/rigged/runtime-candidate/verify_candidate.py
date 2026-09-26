"""Verify real FBX, approved geometry/material preservation and scoped motion clearance."""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[5]
C01=HERE.parents[1]/'candidate-01'
STATS=json.loads((HERE/'model-stats.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,obj):(HERE/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def require(value,message):
    if not value:raise RuntimeError(message)
def choose(rig,name):
    candidates=[a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]==name]
    require(len(candidates)==1,'Expected one action '+name)
    action=candidates[0];data=rig.animation_data_create();data.use_nla=False;data.action=None
    for p in rig.pose.bones:p.matrix_basis.identity()
    data.action=action
    if action.slots:data.action_slot=action.slots[0]
    return action
def set_frame(frame):
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));bpy.context.view_layer.update()
def vertices(ob):
    evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
    try:points=[evaluated.matrix_world@v.co for v in mesh.vertices]
    finally:evaluated.to_mesh_clear()
    require(all(math.isfinite(c) for p in points for c in p),'Nonfinite animated vertex')
    return points
def displacement(a,b):return max((p-q).length for p,q in zip(a,b))

def inspect_fbx_channels(path):
    from io_scene_fbx import parse_fbx
    tree,version=parse_fbx.parse(str(path))
    objects=next(c for c in tree.elems if c.id==b'Objects')
    connections=next(c for c in tree.elems if c.id==b'Connections')
    names={int(c.props[0]):c.props[1].decode('utf-8','replace').split('\x00')[0] for c in objects.elems if c.id in (b'Material',b'Texture',b'Video')}
    texture_files={int(c.props[0]):{child.id.decode():child.props[0].decode('utf-8','replace') for child in c.elems
        if child.id in (b'FileName',b'RelativeFilename') and child.props} for c in objects.elems if c.id==b'Texture'}
    materials=[c for c in objects.elems if c.id==b'Material'];require(len(materials)==1,'FBX object material count not one')
    material_id=int(materials[0].props[0]);links=[]
    for c in connections.elems:
        if len(c.props)>=4 and c.props[0]==b'OP' and int(c.props[2])==material_id:
            links.append({'property':c.props[3].decode('utf-8','replace'),'texture':names.get(int(c.props[1]),str(c.props[1])),
                'file_properties':texture_files.get(int(c.props[1]),{})})
    # Blender 4.5 names Texture nodes by socket (base_color_texture etc.), not
    # image name. Verify the actual connected filename as well as the channel.
    require(any(l['property']=='DiffuseColor' and any('giant-colour.png' in p for p in l['file_properties'].values()) for l in links),'Missing actual FBX diffuse texture channel')
    require(any('Shininess' in l['property'] and any('giant-roughness.png' in p for p in l['file_properties'].values()) for l in links),'Missing actual FBX roughness/shininess channel')
    raw=path.read_bytes();embedded={}
    for name in ('giant-colour.png','giant-roughness.png'):
        blob=(HERE/'export'/name).read_bytes();offset=raw.find(blob)
        require(offset>=0,'Exact PNG not embedded in FBX '+name)
        require(sha(HERE/'export'/name)==sha(C01/'textures'/name),'PNG changed from approved prototype')
        embedded[name]={'sha256':sha(HERE/'export'/name),'bytes':len(blob),'exact_png_byte_offset':offset}
    return {'fbx_version':version,'material_name':names[material_id],'actual_texture_properties':links,'embedded_pngs':embedded}

def verify_fbx():
    path=HERE/'export/giant-claw.fbx';require(sha(path)==STATS['fbx_sha256'],'FBX differs from build record')
    channels=inspect_fbx_channels(path)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(rigs)==len(meshes)==1,'Expected one rig and mesh')
    rig,mesh=rigs[0],meshes[0]
    require(set(b.name for b in rig.data.bones)==set(STATS['bones']) and len(rig.data.bones)==16,'Skeleton contract mismatch')
    require(len(mesh.data.materials)==len(mesh.data.uv_layers)==1,'Expected one UV/material')
    require(sum(len(p.vertices)-2 for p in mesh.data.polygons)==21208,'Approved triangle count changed')
    groups={g.index:g.name for g in mesh.vertex_groups}
    for v in mesh.data.vertices:
        weights=[g.weight for g in v.groups if groups[g.group] in STATS['bones']]
        require(weights and abs(sum(weights)-1)<.0001 and max(weights)<=1,'Invalid vertex weights')
    report={'status':'pass','fbx_sha256':sha(path),'triangles':21208,'vertices':len(mesh.data.vertices),
        'bones':[b.name for b in rig.data.bones],'materials':[m.name for m in mesh.data.materials],
        'channels':channels,'clips':{},'method':'Actual FBX import; explicit Blender action slot; every half-frame evaluated after skinning.'}
    require(len(bpy.data.actions)==5,'Expected exactly five FBX actions')
    for name,expected in STATS['clips'].items():
        action=choose(rig,name);first,last=map(float,action.frame_range)
        require(abs(first-expected['first'])<.001 and abs(last-expected['last'])<.001,'Clip frame range mismatch')
        set_frame(first);start=vertices(mesh);motion=0;low=10;high=-10
        for i in range(int((last-first)*2)+1):
            set_frame(first+i*.5);points=vertices(mesh)
            motion=max(motion,displacement(start,points));low=min(low,min(p.z for p in points));high=max(high,max(p.z for p in points))
        set_frame(last);finish=vertices(mesh);seam=displacement(start,finish)
        require(motion>.001,'Empty motion '+name);require(low>-.002,'Floor penetration beyond 2mm '+name)
        if name!='exit':require(seam<.0001,'Clip does not return to start '+name)
        else:require(max(p.z for p in finish)<.08,'Exit did not shrink away')
        report['clips'][name]={'imported_action_name':action.name,'first':first,'last':last,'seconds':(last-first)/30,
            'samples':int((last-first)*2)+1,'maximum_vertex_motion_m':motion,'minimum_z_m':low,'maximum_z_m':high,
            'first_last_seam_m':seam,'loop':name in STATS['loops']}
    choose(rig,'idle');set_frame(1);points=vertices(mesh)
    report['rest_bounds']={'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
    for key in ('min','max'):
        require(max(abs(a-b) for a,b in zip(report['rest_bounds'][key],STATS['bounds_blender_xyz'][key]))<.0001,'Imported rest bounds changed')
    require(sum(c['samples'] for c in report['clips'].values())==377,'Wrong half-frame total')
    write('round-trip-check.json',report);print('GIANT_CLAW_FBX_QA_PASS',flush=True)

def snapshot_geometry(path,rigged):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    parent=bpy.data.objects['GiantClaw_Rig' if rigged else 'GiantClaw_Prototype']
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent]
    meshes={o.name:{'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(p.vertices) for p in o.data.polygons],
        'uvs':[[list(l.uv) for l in uv.data] for uv in o.data.uv_layers],'planned_joint':o['planned_joint'],
        'matrix':[list(row) for row in o.matrix_world],'materials':[m.name for m in o.data.materials]} for o in parts}
    material=bpy.data.materials['GiantClaw_Toy_Atlas'];nodes=[]
    for n in material.node_tree.nodes:
        inputs=[]
        for socket in n.inputs:
            if not hasattr(socket,'default_value'):continue
            value=socket.default_value
            if not isinstance(value,(str,bool,float,int)):value=list(value) if hasattr(value,'__iter__') else str(value)
            inputs.append([socket.name,value])
        nodes.append({'name':n.name,'type':n.bl_idname,'inputs':inputs,
            'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None,
            'colorspace':n.image.colorspace_settings.name if n.type=='TEX_IMAGE' and n.image else None})
    links=[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in material.node_tree.links]
    images={im.name:hashlib.sha256(im.packed_file.data).hexdigest() for im in bpy.data.images if im.name.startswith('GiantClaw_') and im.packed_file}
    return {'meshes':meshes,'material_nodes':nodes,'material_links':links,'images':images}

def verify_source():
    before=snapshot_geometry(C01/'giant-claw-prototype.blend',False)
    after=snapshot_geometry(HERE/'giant-claw.blend',True)
    require(before==after,'Approved mesh/UV/material or transform changed during rigging')
    report={'status':'pass','approved_prototype_exact_geometry_uv_material':True,'editable_parts':36,'files':{}}
    for filename in ('giant-claw.blend','giant-claw-review-scene.blend'):
        path=HERE/filename;digest=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['GiantClaw_Rig'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
        require(len(meshes)==(36 if filename=='giant-claw.blend' else 1),'Wrong editable/merged mesh count')
        images={}
        for name,image_name in [('giant-colour.png','GiantClaw_Colour_512'),('giant-roughness.png','GiantClaw_Roughness_512')]:
            im=bpy.data.images[image_name];require(im.packed_file and tuple(im.size)==(512,512),'Packed atlas missing')
            require(hashlib.sha256(im.packed_file.data).hexdigest()==sha(HERE/'export'/name),'Packed image mismatch')
            images[name]=sha(HERE/'export'/name)
        for ob in meshes:
            groups={g.index:g.name for g in ob.vertex_groups}
            for v in ob.data.vertices:require(abs(sum(g.weight for g in v.groups if groups[g.group] in STATS['bones'])-1)<.0001,'Source weight sum wrong')
            bm=bmesh.new();bm.from_mesh(ob.data)
            try:require(all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True)>0,'Nonclosed/nonpositive source mesh')
            finally:bm.free()
        require(sha(path)==digest,'Source modified by verification')
        report['files'][filename]={'sha256':digest,'skinned_meshes':len(meshes),'packed_pngs':images,'bones':len(rig.data.bones),'actions':len(bpy.data.actions)}
    write('source-check.json',report);print('GIANT_CLAW_SOURCE_QA_PASS',flush=True)

def collision_audit():
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'giant-claw.blend'),load_ui=False,use_scripts=False)
    rig=bpy.data.objects['GiantClaw_Rig']
    hard_pairs=[('Dominant_fixed_round_finger','Dominant_moving_round_finger'),
        ('Dominant_giant_palm','Wide_soft_boss_muzzle'),('Dominant_giant_palm','Spherical_boss_eye_R'),
        ('Dominant_moving_round_finger','Spherical_boss_eye_R'),('Dominant_moving_round_finger','Wide_soft_boss_muzzle'),
        ('Minor_round_palm','Wide_soft_boss_muzzle')]
    leg_pairs=[(f'leg_{side}{i}_weight_bearing_leg',f'leg_{side}{i+1}_weight_bearing_leg') for side in ('L','R') for i in (1,2,3)]
    pairs=hard_pairs+leg_pairs;names=set(n for pair in pairs for n in pair)
    objects={n:bpy.data.objects[n] for n in names}
    cover_objects={n:bpy.data.objects[n] for n in ('Wide_sturdy_boss_body','Solid_wide_upper_shell','Broad_cream_belly')}
    triangles={}
    for n,ob in {**objects,**cover_objects}.items():
        ob.data.calc_loop_triangles();triangles[n]=[tuple(t.vertices) for t in ob.data.loop_triangles]
    def tree_for(n,ob):
        points=vertices(ob)
        return points,BVHTree.FromPolygons(points,triangles[n],all_triangles=True,epsilon=.000001)
    def triangle_crossings(a,b):
        points=[]
        for first,second in ((a,b),(b,a)):
            for i in range(3):
                origin=first[i];direction=first[(i+1)%3]-origin
                if direction.length_squared<1e-15:continue
                hit=intersect_ray_tri(second[0],second[1],second[2],direction,origin,True)
                if hit is not None:
                    t=(hit-origin).dot(direction)/direction.length_squared
                    if -.00001<=t<=1.00001 and all((hit-p).length>.00001 for p in points):points.append(hit)
        return points
    def overlaps():
        trees={n:tree_for(n,ob) for n,ob in objects.items()}
        covers=[tree_for(n,ob)[1] for n,ob in cover_objects.items()]
        counts={};visible={};unknown={};points_outside={}
        def enclosed(point):
            for cover in covers:
                near,normal,index,dist=cover.find_nearest(point)
                if near is not None and (point-near).dot(normal)<-.001:return True
            return False
        for a,b in pairs:
            key=a+' / '+b;matches=trees[a][1].overlap(trees[b][1]);counts[key]=len(matches)
            visible[key]=0;unknown[key]=0
            if (a,b) not in leg_pairs:continue
            for ia,ib in matches:
                av=[trees[a][0][i] for i in triangles[a][ia]];bv=[trees[b][0][i] for i in triangles[b][ib]]
                cross=triangle_crossings(av,bv)
                if not cross:
                    # Coplanar/touching pairs need conservative location checks.
                    probes=[sum(av,Vector())/3,sum(bv,Vector())/3]
                    if not all(enclosed(p) for p in probes):unknown[key]+=1
                elif not all(enclosed(p) for p in cross):
                    visible[key]+=1
                    if key not in points_outside:points_outside[key]=list(next(p for p in cross if not enclosed(p)))
        return counts,visible,unknown,points_outside
    choose(rig,'idle');set_frame(1);baseline,base_visible,base_unknown,_=overlaps()
    report={'status':'pass','method':'Evaluated skinned source, BVH triangle surface overlap on six claw/face safety pairs and six neighboring leg pairs, every half-frame. Joined parts intentionally overlap at palm/shoulder/body roots and are excluded. This is not an exhaustive physics or containment solver.',
        'baseline_surface_pairs':baseline,'baseline_visible_leg_crossings':base_visible,'baseline_unclassified_leg_contacts':base_unknown,
        'leg_location_method':'Actual triangle edge/triangle intersection points must lie at least 1mm inside one of body, upper shell, or belly closed surfaces (nearest oriented normal). Coplanar contacts use both triangle centroids and are conservative; any unclassified contact is separately reported.',
        'clips':{},'warnings':[]}
    hard_keys={a+' / '+b for a,b in hard_pairs}
    for name,expected in STATS['clips'].items():
        choose(rig,name);maximum=dict(baseline);first_new={};max_visible=dict(base_visible);max_unknown=dict(base_unknown);outside_examples={}
        for i in range((expected['last']-1)*2+1):
            frame=1+i*.5;set_frame(frame);current,visible,unknown,outside=overlaps()
            for pair,count in current.items():
                maximum[pair]=max(maximum[pair],count)
                if count>baseline[pair] and pair not in first_new:first_new[pair]=frame
                max_visible[pair]=max(max_visible[pair],visible[pair]);max_unknown[pair]=max(max_unknown[pair],unknown[pair])
                if pair in outside and pair not in outside_examples:outside_examples[pair]={'frame':frame,'position':outside[pair]}
        for pair in hard_keys:require(maximum[pair]<=baseline[pair],'New claw/face surface intersection '+name+' '+pair)
        novel_legs={p:max_visible[p] for p in maximum if p not in hard_keys and max_visible[p]>base_visible[p]}
        ambiguous={p:max_unknown[p] for p in maximum if p not in hard_keys and max_unknown[p]>base_unknown[p]}
        if novel_legs or ambiguous:report['warnings'].append({'clip':name,'visible_neighbor_leg_crossings_above_rest':novel_legs,'unclassified_neighbor_contacts_above_rest':ambiguous,'outside_examples':outside_examples})
        report['clips'][name]={'maximum_overlapping_triangle_pairs':maximum,'first_increased_frame':first_new,
            'maximum_visible_leg_crossings':max_visible,'maximum_unclassified_leg_contacts':max_unknown,'outside_examples':outside_examples}
    write('collision-check.json',report);print('GIANT_CLAW_COLLISION_AUDIT '+json.dumps({'warnings':report['warnings']}),flush=True)

if '--collision-only' not in sys.argv:verify_fbx();verify_source()
collision_audit()
for name,digest in STATS['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Approved prototype bytes changed')
write('prototype-preservation.json',{'status':'pass','files':STATS['protected_reference_hashes'],'writes_to_original_prototype':False})
print('GIANT_CLAW_ALL_QA_COMPLETE',flush=True)
