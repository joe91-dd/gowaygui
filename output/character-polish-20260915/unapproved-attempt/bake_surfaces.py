"""Bake actual character surfaces into portable UV maps for the game renderer.

Run after build_cast: Blender --background --python THIS -- stone ...
Uses the current studio mesh, retains its armature, weights and animation clips.
"""
import bpy,sys,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
GAME=HERE.parents[1]
ROLES=['stone','spike','crystal','leaf','bubble']

def bake(role):
    out=HERE/role;runtime=GAME/'assets/resources/models-approved'/role
    bpy.ops.wm.open_mainfile(filepath=str(out/(role+'-studio.blend')))
    body=bpy.data.objects.get(role.title()+'ApprovedSkin')
    rig=body.parent
    if not body or not rig:raise RuntimeError('Missing approved cast mesh/armature')
    scene=bpy.context.scene;scene.frame_set(1)
    # Maps are authored in bind pose; transforms in a walking pose must never
    # be baked into the tangents or contact shading.
    rig.data.pose_position='REST'
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=1.16,island_margin=.004,area_weight=.8,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.bake_type='EMIT';scene.render.bake.margin=8;scene.render.bake.use_clear=True
    maps={};saved=[]
    for label in ['albedo','normal']:
        im=bpy.data.images.new(role+'-'+label,width=2048,height=2048,alpha=False,float_buffer=False)
        if label=='normal':im.colorspace_settings.name='Non-Color'
        im.filepath_raw=str(runtime/(role+'-'+label+'.png'));im.file_format='PNG'
        targets=[]
        for mat in body.data.materials:
            if mat is None:continue
            tree=mat.node_tree;n=tree.nodes;l=tree.links;outnode=next(o for o in n if o.type=='OUTPUT_MATERIAL');p=n.get('Principled BSDF')
            tex=n.new('ShaderNodeTexImage');tex.image=im;tex.name='BAKE_'+label;n.active=tex;targets.append((mat,tex))
            if label=='albedo':
                original=list(outnode.inputs['Surface'].links);original_from=original[0].from_socket if original else p.outputs[0]
                emit=n.new('ShaderNodeEmission');mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.50
                source=p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].is_linked else None
                if source:l.new(source,mix.inputs[1])
                else:mix.inputs[1].default_value=p.inputs['Base Color'].default_value
                ao=n.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.15;ao.samples=8
                l.new(ao.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],emit.inputs[0]);l.new(emit.outputs[0],outnode.inputs[0]);saved.append((mat,outnode,original_from,[emit,mix,ao]))
        print('BAKE_BEGIN',role,label,flush=True)
        bpy.ops.object.bake(type='EMIT' if label=='albedo' else 'NORMAL',normal_space='TANGENT')
        im.save();maps[label]=im
        for mat,tex in targets:mat.node_tree.nodes.remove(tex)
        if label=='albedo':
            for mat,outnode,socket,nodes in saved:
                mat.node_tree.links.new(socket,outnode.inputs[0])
                for node in nodes:mat.node_tree.nodes.remove(node)
        print('BAKE_DONE',role,label,flush=True)
    # Replace the procedural inputs with their portable equivalent. All
    # material partitions share UVs but retain their distinct metal/roughness.
    for mat in body.data.materials:
        if mat is None:continue
        tree=mat.node_tree;p=tree.nodes.get('Principled BSDF')
        for label in ['albedo','normal']:
            tex=tree.nodes.new('ShaderNodeTexImage');tex.image=maps[label];tex.name='CAST_PORTABLE_'+label
            if label=='albedo':tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
            else:
                normal=tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.72;tree.links.new(tex.outputs['Color'],normal.inputs['Color']);tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
    rig.data.pose_position='POSE';scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.fbx(filepath=str(runtime/(role+'.fbx')),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(role+'.glb')),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(role+'-textured.blend')))
    # Preserve the newest inspection file for the existing render helper.
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(role+'-studio.blend')))
    manifest=json.loads((out/'manifest.json').read_text(encoding='utf8'));manifest['surfaceMaps']={name:str(im.filepath_raw) for name,im in maps.items()};manifest['surfaceResolution']=2048;manifest['surfaceUV']='Unique nonoverlapping smart-projected UV islands';(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    scene.cycles.samples=20;scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.filepath=str(out/'front.png');bpy.ops.render.render(write_still=True)
    print('PORTABLE_CAST_DONE',role,flush=True)

if __name__=='__main__':
    roles=[a for a in sys.argv[sys.argv.index('--')+1:] if a in ROLES] if '--' in sys.argv else ROLES
    for role in roles:bake(role)
