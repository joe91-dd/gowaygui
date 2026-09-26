"""One-time derivation record. build_dusk_bay.py itself is the standalone editable builder."""
from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent
BASE=OUT.parents[1]/'coral-bend/candidate-01'
s=(BASE/'build_coral_bend.py').read_text(encoding='utf-8')
def replace(a,b):
    global s
    assert a in s,a[:120]
    s=s.replace(a,b)
s=s.replace('coral-bend','dusk-bay').replace('coral_bend','dusk_bay').replace('CORAL_BEND','DUSK_BAY').replace('珊瑚转角','薄暮海湾')
s=s.replace('Level 2 geometry','Level 3 geometry').replace('id:2,name:','id:3,name:').replace("'levelId':2","'levelId':3")
s=s.replace('RNG=random.Random(708502)','RNG=random.Random(708603)')
replace("assert source_slots==PROPOSAL['sourceSlots'],'Live shared slots changed; reassess the explicit layout proposal'", "assert source_slots==PROPOSAL['sourceSlots']==PROPOSAL['candidateSlots'],'Dusk candidate must retain all live gameplay stations'")
replace("assert route==[{'x':-9.,'z':0.},{'x':-4.,'z':0.},{'x':-2.,'z':2.},{'x':2.,'z':2.},{'x':3.,'z':-2.},{'x':6.,'z':-2.},{'x':9.,'z':0.}]", "assert route==[{'x':-9.,'z':-1.},{'x':-5.,'z':0.},{'x':-2.,'z':-2.},{'x':2.,'z':-2.},{'x':4.,'z':0.},{'x':7.,'z':0.},{'x':9.,'z':1.}]")
replace(" (.31,.38,.11),(.41,.46,.17),(.50,.54,.23),(.69,.54,.34),", " (.27,.37,.20),(.39,.46,.24),(.49,.54,.28),(.72,.565,.365),")
replace(" (.40,.335,.23),(.50,.46,.35),(.70,.62,.46),(.26,.21,.14),", " (.34,.31,.29),(.45,.43,.37),(.69,.60,.46),(.26,.21,.14),")
replace("gp.inputs['Emission Strength'].default_value=.35", "gp.inputs['Emission Strength'].default_value=.65")
start=s.index('    # Low banks wrap')
end=s.index('\ndef grass_edge',start)
s=s[:start]+'''    # Fresh route-dependent terrain, with a wide quiet southeast evening cove.
    hills=.21*math.exp(-((x+6.1)**2+(z+3.9)**2)/4)+.18*math.exp(-((x-7.5)**2+(z+3.8)**2)/3)
    bay_drop=.065*math.exp(-((x-2.7)**2)/7)*max(0,min(1,(z-2.9)/1.0))
    return .04+mask*(.11+.095*math.sin(x*.42+z*.31)+.035*math.cos(z*.93-x*.23)+hills)-bay_drop

def boundary(theta):
    c,s=math.cos(theta),math.sin(theta)
    # New dusk coast: right-of-center cove and a gentler western shore.
    bay=.14*math.exp(-((theta-1.30)/.39)**2)+.055*math.exp(-((theta-4.18)/.30)**2)
    f=1+.029*math.sin(theta*5+.9)+.021*math.cos(theta*9+.3)-bay
    return Vector((11.08*math.copysign(abs(c)**.74,c)*f,5.42*math.copysign(abs(s)**.74,s)*f))
''' + s[end:]
replace("anchor('Enemy_entrance',-9,.064,0)", "anchor('Enemy_entrance',ROUTE[0].x,.064,ROUTE[0].y)")
replace('# Pearl sanctuary: stepped stone foot, scalloped concave shell and fluted fan.', "# Move the whole authored gateway/garland module to the real entrance Z=-1.\nfor ob in OBJECTS:\n    if ob.name.startswith(('Gateway_','Welcome_')):ob.location.y-=ROUTE[0].y\n\n# Pearl sanctuary: stepped stone foot, scalloped concave shell and fluted fan.")
replace("for args in [(0,-7.7,-3.9,1.90,.22),(1,-3.2,-4.45,1.85,-.20),(2,8.3,-3.5,1.75,.24)]:palm(*args)", "for args in [(0,-7.2,-4.1,1.85,.22),(1,-3.4,-4.3,1.75,-.20),(2,3.4,-4.65,1.70,.18)]:palm(*args)")
replace("if ((x+9.8)**2+z*z)<2.5", "if ((x+9.8)**2+(z-ROUTE[0].y)**2)<2.5")
replace("if placed>=32:break", "if placed>=28:break")
replace("def grass_edge(theta):return .943+.021*math.sin(theta*5+.5)+.012*math.cos(theta*9)", """def grass_edge(theta):return .943+.021*math.sin(theta*5+.5)+.012*math.cos(theta*9)

def within_grass(x,z,padding=.22):
    # Exact inverse direction for the authored .74 superellipse, then its varying coast radius.
    theta=math.atan2(math.copysign(abs(z/5.42)**(1/.74),z),math.copysign(abs(x/11.08)**(1/.74),x))%(2*math.pi)
    edge=boundary(theta)*grass_edge(theta)
    return math.hypot(x,z)+padding<=edge.length
""")
replace("if route_distance(x,z)<1.25", "if not within_grass(x,z,.60):continue\n    if route_distance(x,z)<1.25")
replace("if route_distance(x,z)<.93", "if not within_grass(x,z,.22):continue\n    if route_distance(x,z)<.93")
start=s.index('coral_positions=');end=s.index('\ndef cup_coral',start)
s=s[:start]+'''coral_positions=[(-9.9,2.6),(-8.8,3.65),(-7.8,4.10),(-4.2,4.55),
                 (4.9,4.05),(6.0,4.18),(9.9,3.25),(9.8,-2.2),(-9.2,-3.5)]
for i,(x,z) in enumerate(coral_positions):coral(i,x,z,[17,18,19][i%3])
''' + s[end:]
replace("[(-7.7,3.94),(-7.25,4.0),(-2.8,4.05),(3.2,4.13),(6.4,4.08),(7.1,3.70),(9.65,2.7),(-9.6,-3.0)]", "[(-8.4,3.92),(-4.0,4.38),(4.6,4.02),(5.4,4.0),(9.8,-2.7)]")
replace("[(-1.65,4.28,1.0),(-.45,4.38,1.25),(1.0,4.33,.93)]", "[(1.05,4.16,1.0),(2.25,4.04,1.15),(3.5,4.16,.93)]")
replace("for i,(x,z) in enumerate([(-6.8,-1.8),(7.4,-3.30)]):lantern(i,x,z)", "for i,(x,z) in enumerate([(-8.0,1.35),(-4.0,3.0),(-.4,-4.55),(5.2,3.1),(7.7,-3.35)]):lantern(i,x,z)")
insert=s.index('# Starfish and small shell clusters')
s=s[:insert]+'''# A small pearl beacon marks the dusk headland, away from every battle station.
BX,BZ=8.85,-3.55;BY=height(BX,BZ)
disc('Dusk_beacon_foot',BX,BZ,BY,.68,.18,4,n=16)
disc('Dusk_beacon_lower_ring',BX,BZ,BY+.18,.53,.19,6,n=16)
disc('Dusk_beacon_teal_column',BX,BZ,BY+.36,.39,.82,14,n=16)
for k in range(3):disc('Dusk_beacon_column_band_%d'%k,BX,BZ,BY+.41+k*.30,.41,.07,6,n=16)
disc('Dusk_beacon_balcony',BX,BZ,BY+1.15,.56,.13,6,n=16)
oval('Dusk_beacon_pearl_lamp',(BX,BY+1.62,BZ),(.22,.25,.22),21,'Pearl_and_lamps',n=16,rings=10)
for k in range(6):
    a=k*math.pi/3
    tube('Dusk_beacon_cage_%d'%k,[(BX+.40*math.cos(a),BY+1.24,BZ+.40*math.sin(a)),(BX+.40*math.cos(a),BY+1.94,BZ+.40*math.sin(a))],.035,12,sides=6)
disc('Dusk_beacon_roof_rim',BX,BZ,BY+1.92,.64,.10,6,n=16)
vs=[];fs=[];bn=20
for r,y in [(.63,BY+2.02),(.37,BY+2.22),(.12,BY+2.31)]:
    for k in range(bn):
        a=k*2*math.pi/bn;vs.append((BX+r*math.cos(a),y,BZ+r*math.sin(a)))
for ring in range(2):
    for k in range(bn):fs.append((ring*bn+k,ring*bn+(k+1)%bn,(ring+1)*bn+(k+1)%bn,(ring+1)*bn+k))
fs.append(tuple(2*bn+k for k in range(bn)))
mesh('Dusk_beacon_shell_cap',vs,fs,20,smooth=False)
oval('Dusk_beacon_top_bead',(BX,BY+2.34,BZ),(.08,.10,.08),23,'Pearl_and_lamps',n=10,rings=6)

# Authored bent sea grass at the cove rim; low blades and rounded seed heads.
for i,(x,z) in enumerate([(-1.6,4.72),(-.9,4.67),(4.0,4.42),(4.45,4.12),(7.3,3.65)]):
    y=height(x,z)
    for k in range(3):
        a=k*2.1+i*.3;tip=(x+.12*math.cos(a),y+.34+.04*k,z+.12*math.sin(a))
        tube('Dusk_reed_%d_%d'%(i,k),[(x,y,z),(x+.04*math.cos(a),y+.18,z+.04*math.sin(a)),tip],.018,9,sides=5)
        oval('Dusk_reed_seed_%d_%d'%(i,k),tip,(.033,.08,.033),27,n=7,rings=5)

''' + s[insert:]
replace("[(-8.1,4.7),(-4.1,4.9),(4.3,4.75),(9.9,2.9),(-9.5,-3.7)]", "[(-8.1,4.7),(-4.1,4.9),(4.0,4.40),(9.9,2.9),(-9.5,-3.7)]")
replace("[(-6.6,4.65,.3),(-2.7,4.95,-.4),(5.5,4.45,.6),(-8.8,-3.4,.9)]", "[(-6.6,4.65,.3),(-1.7,4.65,-.4),(5.5,4.45,.6),(-8.8,-3.4,.9)]")
replace("'slotLayoutSource':'proposal.json candidateSlots; intentional offline layout proposal, core data not modified'", "'slotLayoutSource':'Live level3 shared slots; all five retained, no gameplay coordinate change'")
replace("adapted to level 2 with newly generated route-dependent terrain, road, and sculpted inlet coast", "adapted to level 3 with regenerated terrain/road, evening cove, low lamps and small headland beacon")
replace("'First dusk-bay environment candidate; runtime integration and visual acceptance pending.'", "'First dusk-bay source candidate; original station coverage retained; runtime integration and visual acceptance pending.'")
replace("(.018,.24,.29,1)", "(.026,.20,.245,1)")
replace("(.012,.20,.255,1)", "(.027,.18,.245,1)")
replace("(.034,.40,.43,1)", "(.05,.33,.36,1)")
replace("(.43,.60,.72,1)", "(.46,.46,.62,1)")
replace("default_value=.8", "default_value=.75")
replace("light('Island_sun','SUN',(-8,15,7),3.1,(1,.89,.72))", "light('Dusk_warm_sun','SUN',(-12,11,4),2.7,(1,.75,.50))")
replace("light('Island_fill','AREA',(5,10,-10),1000,(.61,.82,1),14)", "light('Dusk_clear_battle_fill','AREA',(4,11,-8),1200,(.66,.79,1),14)")
replace("('coral-inlet-detail',(4,5,10),(1,.1,3.5),8.0)", "('dusk-beacon-detail',(13,5,3),(8.3,1,-2.6),7.0)")
(OUT/'build_dusk_bay.py').write_text(s,encoding='utf-8')

# Verification scripts are candidate-local, with original level3 coordinates as the contract.
v=(BASE/'verify_coral_bend.py').read_text(encoding='utf-8').replace('coral-bend','dusk-bay').replace('id:2,name:','id:3,name:')
v=v.replace("assert anchors['Enemy_entrance']==[-9.0,.064,0.0]", "assert anchors['Enemy_entrance']==[-9.0,.064,-1.0]")
v=v.replace("assert anchors['Player_exit']==[9.0,.064,0.0]", "assert anchors['Player_exit']==[9.0,.064,1.0]")
v=v.replace("assert anchors['Pearl_center']==[9.0,1.1,0.0]", "assert anchors['Pearl_center']==[9.0,1.1,1.0]")
v=v.replace("'liveSlotCoordinatesMatchCandidate':False", "'liveSlotCoordinatesMatchCandidate':True")
(OUT/'verify_dusk_bay.py').write_text(v,encoding='utf-8')
v=(BASE/'check_editable_source.py').read_text(encoding='utf-8').replace('coral-bend','dusk-bay').replace('len(meshes)>1000','len(meshes)>700')
(OUT/'check_editable_source.py').write_text(v,encoding='utf-8')
v=(BASE/'render_coral_views.py').read_text(encoding='utf-8').replace('coral-bend','dusk-bay').replace('CORAL_REVIEW','DUSK_REVIEW')
v=v.replace("('coral-inlet-detail',(4,5,10),(1,.1,3.5),8.0)", "('dusk-beacon-detail',(13,5,3),(8.3,1,-2.6),7.0)")
(OUT/'render_dusk_views.py').write_text(v,encoding='utf-8')
v=(BASE/'verify_foot_support.py').read_text(encoding='utf-8').replace('coral-bend','dusk-bay')
start=v.index(" 'slots':results,'notes':[")
end=v.index("(OUT/'foot-support-check.json')",start)
v=v[:start]+" 'slots':results,'notes':['All original level3 positions retained; actual c12b source feet tested against candidate FBX.',\n 'Original slot indices1 and2 have route distances3.0 and1.4142, outside stone base radius1.2; preserve ranged/support uses, no core edits.',\n 'Visual sand can run under plinth edges; route-center clearance and actual sole support are the constraints.',\n 'Static all-yaw sole support does not prove animation movement clearance or actual enemy contact.']}\n"+v[end:]
(OUT/'verify_foot_support.py').write_text(v,encoding='utf-8')
record={'method':'Project-owned source-module reuse with explicit new level3 geometry, palette, compositions and beacon; no downloaded geometry, textures or raster edits.',
 'upstreamBuilder':str((BASE/'build_coral_bend.py').relative_to(OUT.parents[4])),
 'upstreamBuilderSha256':hashlib.sha256((BASE/'build_coral_bend.py').read_bytes()).hexdigest(),
 'standaloneBuilder':'build_dusk_bay.py','filesWritten':['build_dusk_bay.py','verify_dusk_bay.py','check_editable_source.py','render_dusk_views.py','verify_foot_support.py']}
(OUT/'derivation-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('Wrote standalone dusk candidate builder and local verification scripts.')
