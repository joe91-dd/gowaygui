"""Rebuild closed anatomical surfaces, bake original appearance, transfer skinning.
Blender performs all geometry and texture work; the AHOLO originals remain intact.
"""
import bpy,bmesh,math,numpy as np,json
from pathlib import Path
from mathutils import Vector,kdtree
from datetime import datetime,timezone
root=Path(__file__).resolve().parent;out=root/'polished-yandun';clean=out/'cleaned';clean.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(out/'yandun-polished.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Yandun_Rig'];body=bpy.data.objects['Yandun_Surface'];body.name='Surface_before_reconstruction'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
for t in rig.animation_data.nla_tracks:t.mute=True
for m in body.modifiers:m.show_viewport=False;m.show_render=False
tags=[v.value for v in body.data.attributes['anatomical_part'].data]
group_names=[g.name for g in body.vertex_groups]
old_weights=[{group_names[g.group]:g.weight for g in v.groups} for v in body.data.vertices]
old_coords=[v.co.copy() for v in body.data.vertices]
source_materials=list(body.data.materials)
# Emission-only source materials bake base color without light, highlights, metallic darkening or AO.
for idx,ma in enumerate(source_materials):
    ma=ma.copy();body.data.materials[idx]=ma
    p=ma.node_tree.nodes.get('Principled BSDF');o=ma.node_tree.nodes.get('Material Output')
    em=ma.node_tree.nodes.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1
    if p.inputs['Base Color'].is_linked:ma.node_tree.links.new(p.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
    else:em.inputs['Color'].default_value=p.inputs['Base Color'].default_value
    ma.node_tree.links.new(em.outputs[0],o.inputs['Surface'])
new_parts=[]
for part in [0,1,2]:
    bm=bmesh.new();bm.from_mesh(body.data);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if tags[f.verts[0].index]!=part],context='FACES')
    me=bpy.data.meshes.new('Part_source_'+str(part));bm.to_mesh(me);bm.free()
    src=bpy.data.objects.new('Bake_source_'+str(part),me);bpy.context.collection.objects.link(src)
    for ma in body.data.materials:me.materials.append(ma)
    ob=src.copy();ob.data=src.data.copy();ob.name='Reconstructed_'+str(part);bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    rem=ob.modifiers.new('Closed_surface_reconstruction','REMESH');rem.mode='VOXEL';rem.voxel_size=.010 if part==0 else .011;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    # Remeshing disconnects the sub-voxel threads supporting floating generation slivers.
    bm=bmesh.new();bm.from_mesh(ob.data);remaining=set(bm.verts);components=[]
    while remaining:
        v=remaining.pop();stack=[v];com=[v]
        while stack:
            cv=stack.pop()
            for edge in cv.link_edges:
                n=edge.other_vert(cv)
                if n in remaining:remaining.remove(n);stack.append(n);com.append(n)
        components.append(com)
    components.sort(key=len,reverse=True)
    discard=[v for i,com in enumerate(components) if i>0 and len(com)<(1000 if part==0 else 10**9) for v in com]
    if discard:bmesh.ops.delete(bm,geom=discard,context='VERTS')
    bm.to_mesh(ob.data);bm.free()
    sm=ob.modifiers.new('Relax_reconstruction','SMOOTH');sm.factor=.85;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=ob.modifiers.new('Runtime_density','DECIMATE');dec.ratio=.32;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(72),island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new('Yandun_rebuilt_basecolor_'+str(part),width=2048,height=2048,alpha=False)
    ma=bpy.data.materials.new('Rebuilt_bake_target_'+str(part));ma.use_nodes=True;p=ma.node_tree.nodes.get('Principled BSDF')
    tex=ma.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;ma.node_tree.nodes.active=tex
    ma.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.48
    ob.data.materials.clear();ob.data.materials.append(ma)
    scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.075;scene.render.bake.max_ray_distance=.20;scene.render.bake.margin=12
    # Only the matching source part participates in selected-to-active baking.
    bpy.ops.object.select_all(action='DESELECT');src.select_set(True);ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.bake(type='EMIT')
    image.filepath_raw=str(clean/('basecolor-'+str(part)+'.png'));image.file_format='PNG';image.save();image.pack()
    # Material zones share the newly baked UV texture, while their physical response stays distinct.
    mats=[]
    for name,rough,metal in [('Honey_skin',.44,0),('Charcoal_rock',.66,.03),('Warm_plates',.49,0),('Sapphire_crystals',.20,.25)]:
        mm=ma.copy();mm.name=str(part)+'_'+name;pp=mm.node_tree.nodes.get('Principled BSDF');pp.inputs['Roughness'].default_value=rough;pp.inputs['Metallic'].default_value=metal
        if 'Sapphire' in name:pp.inputs['Coat Weight'].default_value=.6;pp.inputs['Coat Roughness'].default_value=.10;pp.inputs['Emission Color'].default_value=(.002,.07,.23,1);pp.inputs['Emission Strength'].default_value=.23
        mats.append(mm)
    ob.data.materials.clear()
    for mm in mats:ob.data.materials.append(mm)
    pix=np.array(image.pixels[:]).reshape(2048,2048,4);uv=ob.data.uv_layers.active.data
    for f in ob.data.polygons:
        t=np.mean([uv[i].uv[:] for i in f.loop_indices],axis=0);r,g,b=pix[min(2047,int(t[1]*2047)),min(2047,int(t[0]*2047)),:3]
        x,y,z=f.center
        blue=b>r*1.20 and g>r*1.13 and b>g*.95 and b>.25
        rock=r<b*1.42 and r<g*1.42 and r<.78
        ivory=abs(x)<.5 and y<-.32 and .56<z<1.58 and r>.42 and g>r*.72 and b>r*.50
        f.material_index=3 if blue else 2 if ivory else 1 if rock else 0;f.use_smooth=True
    # Interpolate four nearby weights within the same anatomical part only.
    candidates=[i for i,t in enumerate(tags) if t==part];kd=kdtree.KDTree(len(candidates))
    for i in candidates:kd.insert(old_coords[i],i)
    kd.balance();groups={n:ob.vertex_groups.new(name=n) for n in group_names}
    for v in ob.data.vertices:
        nearest=kd.find_n(v.co,4);weights={}
        for co,i,d in nearest:
            fac=1/max(d,.001)**2
            for name,w in old_weights[i].items():weights[name]=weights.get(name,0)+w*fac
        weights=dict(sorted(weights.items(),key=lambda kv:kv[1],reverse=True)[:4]);s=sum(weights.values())
        for name,w in weights.items():groups[name].add([v.index],w/s,'REPLACE')
    ob.parent=rig;mod=ob.modifiers.new('Skeleton_deformation','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
    for f in ob.data.polygons:f.use_smooth=True
    bpy.data.objects.remove(src,do_unlink=True);new_parts.append(ob)
    print('PART_RECONSTRUCTED',part,len(ob.data.vertices),len(ob.data.polygons),flush=True)

# Preserve the previous geometry in a hidden archive collection, separate from exports.
archive=bpy.data.collections.new('SOURCE_before_surface_rebuild');scene.collection.children.link(archive)
for c in list(body.users_collection):c.objects.unlink(body)
archive.objects.link(body);archive.hide_render=True;archive.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in new_parts:ob.select_set(True)
bpy.context.view_layer.objects.active=new_parts[0];bpy.ops.object.join();rebuilt=new_parts[0];rebuilt.name='Yandun_Surface'
for t in rig.animation_data.nla_tracks:t.mute=False
rig.animation_data.action=None
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob==rig or ob==rebuilt or ob.parent==rig and ob!=body:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(clean/'yandun-polished.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True,export_morph=True,export_extras=True,export_apply=False)
for t in rig.animation_data.nla_tracks:t.mute=True
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(clean/'yandun-polished.blend'))
scene.cycles.samples=16;scene.render.resolution_x=640;scene.render.resolution_y=740
cam=scene.camera;cam.location=(3,-6,2.6);cam.rotation_euler=(Vector((0,0,1.20))-cam.location).to_track_quat('-Z','Y').to_euler()
for name,clip,frame in [('quarter','Idle',0),('attack-contact','Attack_Combo',14),('storm-release','Rock_Storm',38)]:
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame);scene.render.filepath=str(clean/(name+'.png'));bpy.ops.render.render(write_still=True)
report={'time':datetime.now(timezone.utc).isoformat(),'sourceTaskId':3513206,'process':'local-voxel-surface-rebuild-and-selected-to-active-basecolor-bake','triangles':sum(len(f.vertices)-2 for f in rebuilt.data.polygons),'vertices':len(rebuilt.data.vertices),'bones':len(rig.data.bones),'animations':['Idle','Attack_Combo','Rock_Storm','Hit','Greeting'],'license':'internal-evaluation-pending-confirmation'}
(clean/'build-report.json').write_text(json.dumps(report,indent=2));print('SURFACE_REBUILD_COMPLETE '+json.dumps(report))
