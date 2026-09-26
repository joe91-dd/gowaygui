"""Render open/closed lids from re-imported runtime FBX, not a pose illustration."""
import bpy,sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else ROOT.parent/'output/sculpted-polish-20260915'
OUT=OUT.resolve()
OUT.mkdir(parents=True,exist_ok=True)
for role in ['stone','crystal']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(ROOT/'assets/resources/models-sculpted'/role/(role+'.fbx')))
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    action=next(a for a in bpy.data.actions if a.name.split('|')[-1]=='idle')
    rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
    scene.render.resolution_x=360;scene.render.resolution_y=360;scene.render.resolution_percentage=100
    world=bpy.data.worlds.new('Soft ambient');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.62,.67,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.4
    for name,loc,power in [('Key',(-3,-4,6),450),('Fill',(4,-2,4),230)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4
        o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,1.9))-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.cameras.new('Eyelid QA');o=bpy.data.objects.new('Eyelid QA',cam)
    bpy.context.collection.objects.link(o);o.location=(.2,-6,2.10)
    o.rotation_euler=(Vector((0,-.1,1.95))-o.location).to_track_quat('-Z','Y').to_euler()
    cam.type='ORTHO';cam.ortho_scale=.96;scene.camera=o
    for name,frame in [('open',1),('closed',70)]:
        scene.frame_set(frame);scene.render.filepath=str(OUT/(role+'-lid-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
