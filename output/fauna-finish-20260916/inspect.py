import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]/'g1-polish-20260916/production'
report={}
for key in ['fauna-01','fauna-06','fauna-13','fauna-30','fauna-33','fauna-55']:
 bpy.ops.wm.open_mainfile(filepath=str(R/key/(key+'.blend')))
 report[key]={'objects':[{'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else '', 'bone':o.parent_bone,'scale':list(o.scale),'loc':list(o.location),'bounds':[list(v) for v in o.bound_box] if o.type=='MESH' else [],'mats':[{'name':m.name,'color':list(m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value) if m and m.use_nodes and m.node_tree.nodes.get('Principled BSDF') else None} for m in o.data.materials] if o.type=='MESH' else [],'groups':[v.name for v in o.vertex_groups] if o.type=='MESH' else [],'bones':[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local)} for b in o.data.bones] if o.type=='ARMATURE' else []} for o in bpy.context.scene.objects],'actions':[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions]}
Path(__file__).with_name('inspect.json').write_text(json.dumps(report,indent=2))
