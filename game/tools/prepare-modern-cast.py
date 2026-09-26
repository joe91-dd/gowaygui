from pathlib import Path
root=Path(__file__).resolve().parents[1]
src=root/'art-source/art-v2/build_cast.py'
target=root/'art-source/art-modern/build_cast.py';target.parent.mkdir(parents=True,exist_ok=True)
s=src.read_text(encoding='utf8')
s=s.replace("OUT=Path(__file__).parent/'runtime-model-candidates'", "OUT=Path(__file__).resolve().parents[2]/'assets/resources/models-modern'")
s=s.replace("+'Atlas_V2'", "+'Atlas_Modern'")
s=s.replace("PALETTE=['B79962','EAC47B','FFE8A5'", "PALETTE=['EEAF48','FFD079','FFE6A4'")
s=s.replace("'78A048','41653C','95CE68'", "'A6CA51','4C8C42','BADA68'")
s=s.replace("'364A5A','647780','9DA59B'", "'55535B','79727A','A29C9B'")
s=s.replace("'A9E4D5'", "'72D7D7'")
s=s.replace("variation=1+(random.random()-.5)*.075+.02*math.sin(x*.12+y*.05)", "variation=1+(random.random()-.5)*.016")
s=s.replace("wide=1.12 if role=='stone' else 1", "wide=1.30 if role=='stone' else 1.07")
s=s.replace("for row in range(3):\n        oval('Belly plate'+str(row),(0,-.277,.80+row*.24),(.34*wide,.10,.18),2 if role!='bubble' else 14)", """for row in range(3):
        z=.79+row*.235
        vertices=[(math.sin(i*math.tau/6)*.32*wide,-.32,z+math.cos(i*math.tau/6)*.155) for i in range(6)]
        vertices.append((0,-.425,z))
        mesh=bpy.data.meshes.new('Plastron plate');mesh.from_pydata(vertices,[],[(i,(i+1)%6,6) for i in range(6)])
        ob=bpy.data.objects.new('Plastron plate',mesh);bpy.context.collection.objects.link(ob);finish(ob,'Plastron plate',2 if role!='bubble' else 14,smooth=False)""")
s=s.replace("(.145,.070,.161),10 if role=='stone' else 3", "(.125,.045,.145),0 if role=='stone' else skin")
s=s.replace("(.116,.043,.136),4", "(.092,.020,.111),4")
s=s.replace("(side*.229,-.432,1.924),(.079,.029,.100),5 if role!='spike' else 11", "(side*.237,-.414,1.924),(.082,.023,.101),11 if role in ['stone','spike','leaf'] else 5")
s=s.replace("(side*.222,-.457,1.924),(.047,.015,.075)", "(side*.23,-.437,1.924),(.059,.012,.084)")
s=s.replace("(side*.215-.024,-.472,1.96)", "(side*.23-.024,-.451,1.96)")
s=s.replace("1 if role=='stone' else 2 if role=='leaf'", "0 if role=='stone' else 1 if role=='leaf'")
s=s.replace("2,leg,segments=12)", "22 if role=='stone' else 2,leg,segments=12)")
s=s.replace("for x,z,scale in [(0,2.17,.23),(-.25,2.13,.17),(.25,2.13,.17),(0,1.82,.115)]:rock", "for x,z,scale in []:rock")
s=s.replace("rock('Forehead armor',(side*.38,-.16,2.1),(.21,.22,.16)", "rock('Forehead armor',(side*.41,-.07,2.15),(.14,.16,.10)")
s=s.replace("    # Existing runtime action vocabulary remains intact.", """    # Larger integrated face and compact silhouette, while retaining an editable rig.
    for ob in parts:
        if ob['bone']=='head':
            for vertex in ob.data.vertices:
                v=vertex.co;v.x*=1.10;v.z=1.78+(v.z-1.78)*1.10;v.y=-.12+(v.y+.12)*1.05
    # Existing runtime action vocabulary remains intact.""")
s=s.replace("'fusion':(60,.22)", "'fusion':(60,.22),'walk':(30,.38)")
s=s.replace("            if name=='fusion':", """            if name=='walk':
                rig.pose.bones['rear_L'].rotation_euler.x=phase*.35;rig.pose.bones['rear_R'].rotation_euler.x=-phase*.35
                rig.pose.bones['root'].location.z=abs(phase)*.035
            if name=='fusion':""")
s=s.replace("scene.cycles.samples=32", "scene.cycles.samples=20")
s=s.replace("scene.render.resolution_x=640;scene.render.resolution_y=640", "scene.render.resolution_x=768;scene.render.resolution_y=768")
s=s.replace("Original V2 geometry and keyframes; visual review pending", "Original standing modern cast, reuses V2 editable geometry; runtime review required")
target.write_text(s,encoding='utf8')
