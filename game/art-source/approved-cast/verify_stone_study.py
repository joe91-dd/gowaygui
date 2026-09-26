"""Check the separate sculpt source, not the runtime model or animation clips."""
import bpy,bmesh,json,math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/stone-blender-r02'
FILE=OUT/'stone-sculpt-r02.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE))
assert bpy.app.version[:2]==(4,5),bpy.app.version_string
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
head=bpy.data.objects['Stone continuous facial sculpt']
body=bpy.data.objects['Continuous anatomical body sculpt']
assert rig.data.pose_position=='REST'
assert bpy.context.scene.camera.data.ortho_scale>3
removed=0
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    assert all(math.isfinite(c) for v in ob.data.vertices for c in v.co),ob.name
    if ob.name.startswith(('Faceted carapace crystal','Wrist crystalline inlay','Crystalline toe')):
        bm=bmesh.new();bm.from_mesh(ob.data);loose=[v for v in bm.verts if not v.link_faces]
        removed+=len(loose)
        if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS');bm.to_mesh(ob.data)
        bm.free()
    if ob in [head,body]:
        for v in ob.data.vertices:assert abs(sum(g.weight for g in v.groups)-1)<.001,(ob.name,v.index)
        assert any(m.type=='ARMATURE' and m.object==rig for m in ob.modifiers)
checks={
    'blenderVersion':bpy.app.version_string,
    'file':str(FILE),
    'finiteMeshCoordinates':True,
    'headAndBodyWeightsNormalized':True,
    'restPoseInspectionCamera':True,
    'unreferencedCrystalVerticesRemoved':removed,
    'headVertices':len(head.data.vertices),
    'bodyVertices':len(body.data.vertices),
    'bones':len(rig.data.bones),
    'packedReferenceImages':[im.name for im in bpy.data.images if im.packed_file],
    'visualStatus':'work in progress, not approved',
    'animationValidation':'not performed on the new sculpt',
    'runtimeAssetsModified':False,
}
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(OUT/'source-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(checks,ensure_ascii=False,indent=2),flush=True)
