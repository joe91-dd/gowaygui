import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent;report=[]
for key in ['shark','captain','mako','skeleton','armored','golem','demon','wraith','spitter','squid']:
 bpy.ops.wm.open_mainfile(filepath=str(root/'production'/key/(key+'.blend')),load_ui=False)
 bpy.context.scene.frame_set(0);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();z=[]
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH':continue
  ev=ob.evaluated_get(dg);me=ev.to_mesh();used={i for f in me.polygons for i in f.vertices}
  z.extend((ev.matrix_world@me.vertices[i].co).z for i in used);ev.to_mesh_clear()
 expected=json.loads((root/'production'/key/'manifest.json').read_text('utf8'))['height']
 report.append(dict(key=key,lowestVisibleVertex=min(z),highestVisibleVertex=max(z),expectedHeight=expected,passed=abs(min(z))<.025 and abs(max(z)-min(z)-expected)<.025))
(root/'grounding-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('GROUNDING_CHECK',json.dumps(report),flush=True)
assert all(r['passed'] for r in report),'Visible mesh ground bounds must match runtime origin'
