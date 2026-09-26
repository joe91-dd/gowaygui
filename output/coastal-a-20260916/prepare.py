from pathlib import Path
import shutil,json
R=Path(__file__).resolve().parent;OLD=R.parent/'boss-refine-20260916'
R.mkdir(parents=True,exist_ok=True)
shutil.copy2(OLD/'plan.json',R/'plan.json')
s=(OLD/'finish.py').read_text('utf8')
s=s.replace("scene=bpy.context.scene;scene.render.fps=30","scene=bpy.context.scene;scene.render.fps=30;scene.render.threads_mode='FIXED';scene.render.threads=4")
s=s.replace("'#305773','#233D52','#58BCD9'","'#3889AA','#173D58','#6DDAED'")
s=s.replace("'#246D80','#233A62','#33BED6'","'#398F9F','#214961','#71D8DD'")
s=s.replace("'#57417E','#28394E','#AD81ED'","'#546FAA','#203D62','#B2C9FA'")
s=s.replace("s=min(.74,s*.85);v=min(.74,v*1.32+.035)","s=min(.72,s*.90);v=min(.79,v*1.42+.045)")
s=s.replace("if boss and ('main' in n or 'hair' in n):","if False:")
s=s.replace("default_value=.62","default_value=.59")
s=s.replace("default_value=.32;tree.links.new(mul","default_value=.23;tree.links.new(mul")
s=s.replace("*1.9","*1.32").replace("radius=size.x*s*.57","radius=size.x*s*.49")
s=s.replace("(radius,.022*s,radius*.95)","(radius,.012*s,radius*.95)").replace("-.018*s","-.011*s").replace("-.033*s","-.020*s")
s=s.replace("accent=material('Coastal_Enamel',(WORLD_TONES[key][1] if world else PALETTES[tier]) if boss else ['#397B80','#426F89','#6C688D'][idx%3],.48)","accent=material('Coastal_Enamel',WORLD_TONES[key][1] if world else ['#244B60','#27475D','#34585D'][idx%3],.42)")
s=s.replace("'#D4B477',.42,.38","'#D7AF68',.38,.52")
s=s.replace("if world and idx not in [30,33]:","if world and idx not in [30,33,55,16]:")
s=s.replace("if idx!=58:","if idx not in [58,55,16]:")
s=s.replace("if boss:spike('Reef shoulder crest'","if boss and idx not in [55,16]:spike('Reef shoulder crest'")
s=s.replace("height*(.22+(j==1)*.05)","height*(.14+(j==1)*.035)")
s=s.replace(" add_fine_details(record,rig,locals())"," if boss or idx>=36:add_fine_details(record,rig,locals())")
anchor=" # Fresh non-overlapping UVs"
budget=""" # Mobile delivery geometry is budgeted before UV baking, so maps match the shipped mesh.
 master_triangles=sum(len(p.vertices)-2 for o in meshes() for p in o.data.polygons)
 target=36000 if world else 24500 if boss else 14000
 current=sum(len(p.vertices)-2 for p in body.data.polygons)
 if current>target:
  mod=body.modifiers.new('Coastal A runtime budget','DECIMATE');mod.ratio=target/current
  while list(body.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
  bpy.ops.object.modifier_apply(modifier=mod.name)
 for o in meshes():
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Stable tangent triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.objects.active=body
"""
s=s.replace(anchor,budget+anchor)
s=s.replace("resolution=1024 if world or tier>=3 else 768","resolution=1024 if world else 768 if boss else 512")
s=s.replace("scene.cycles.samples=8","scene.cycles.samples=4").replace("scene.cycles.samples=32","scene.cycles.samples=12")
s=s.replace("export_format='GLB',use_selection=True","export_format='GLB',export_tangents=True,use_selection=True")
s=s.replace("use_selection=True,object_types=","use_selection=True,use_tspace=True,object_types=")
s=s.replace("'artVersion':3","'artVersion':4,'style':'A — 海雾灵焰','runtimeOptimized':True,'tangentsExported':True,'masterTriangles':master_triangles")
s=s.replace("records=[*PLAN['bosses'],*PLAN['world']]","records=[*PLAN['world'],*PLAN['bosses'],*PLAN['fauna']]")
s=s.replace(" try:run(record)"," if (R/'production'/record['key']/'manifest.json').exists():continue\n try:run(record)")
(R/'finish.py').write_text(s,encoding='utf8')
d=(OLD/'detail_pass.py').read_text('utf8').replace("default_value=.009;tree.links","default_value=.003;tree.links").replace("default_value=.23;bump","default_value=.16;bump")
(R/'detail_pass.py').write_text(d,encoding='utf8')
print('Prepared coastal A asset pipeline')
