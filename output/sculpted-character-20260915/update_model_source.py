from pathlib import Path
p=Path('game/art-source/sculpted-review/build_review.py')
s=p.read_text(encoding='utf8')
s=s.replace('from finish_pass import add_leg_controls,animate_grounded,add_tunic,bake_contact_colors','from finish_pass import add_leg_controls,animate_grounded,add_tunic,bake_contact_colors\nfrom character_pass import face,hand,costume,animate_hands')
s=s.replace('    vs=[]\n    for ring,z in [(1,-.5),(1,.25),(.73,.63)]:','    vs=[];outline=[random.uniform(.88,1.10) for _ in range(segments)]\n    for ring,z in [(1,-.5),(1,.25),(.80,.57)]:')
s=s.replace('math.cos(a)*s[0]*ring,math.sin(a)*s[1]*ring,z*s[2]','math.cos(a)*s[0]*ring*outline[i],math.sin(a)*s[1]*ring*outline[i],z*s[2]')
s=s.replace("material('navy','154866',.51);material('robe','287893',.58)","material('navy','194C86',.76);material('robe','277EC2',.8)")
s=s.replace("material('aqua','25B9E3'","material('aqua','19BDF2'")
s=s.replace("    for name,h,t,p in [('root'", "    material('irisDark','683511' if stone else '124B72',.22);material('cheek','9CCAC8',.7);material('leather','926843',.72)\n    for name,h,t,p in [('root'")
start=s.index("        oval('Knuckled hand '")
end=s.index("        limb('Leg '",start)
s=s[:start]+"        hand(globals(),stone,side,s,wrist)\n"+s[end:]
s=s.replace("for f in range(3):\n            oval('Toe '+side+str(f),(s*.31*wide+(f-1)*.13,-.388,.105),(.068,.075,.064),'aqua' if stone else 'belly','foot_'+side,16)","for f in range(3):\n            if stone:crystal('Crystal claw '+side+str(f),(s*.31*wide+(f-1)*.13,-.40,.025),(.071,.103,.142),'aqua','foot_'+side)\n            else:oval('Rounded toe '+side+str(f),(s*.31*wide+(f-1)*.115,-.396,.09),(.067,.09,.084),'skin','foot_'+side,20)")
start=s.index("    oval('Neck'")
end=s.index('        add_tunic((finish,curve,oval))',start)
s=s[:start]+"    oval('Neck',(0,-.03,1.59),(.25,.22,.25),'skin','neck')\n    face(globals(),stone)\n    if not stone:\n"+s[end:]
end=s.index('\n\ndef crab():')
s=s[:end]+"\n    costume(globals(),stone)"+s[end:]
s=s.replace("    for name,last in clips.items():","    if role!='crab':clips.update({'attack_alt':30,'attack_heavy':30})\n    for name,last in clips.items():")
s=s.replace("                if name=='attack':","                if name in ['attack','attack_alt','attack_heavy']:")
anchor="                if name=='skill':\n                    wind=hump"
new="""                if name=='attack_alt':
                    power=hump(t,.13,.47,.97);wind=hump(t,0,.21,.51)
                    rotate('spine',2,.20*wind-.30*power);rotate('chest',2,-.16*power);rotate('neck',2,.24*power)
                    if role=='stone':
                        rotate('upper_L',0,.24*wind-1.12*power);rotate('upper_L',2,.32*power);rotate('fore_L',0,-.72*wind-.32*power)
                        rotate('upper_R',0,-.19*power);rotate('fore_R',0,-.58*power)
                    else:
                        rotate('upper_L',0,-1.04*power);rotate('upper_L',2,.44*power);rotate('fore_L',0,-.17*power)
                        rotate('upper_R',0,-.23*power);rotate('fore_R',0,-.38*power)
                if name=='attack_heavy':
                    wind=hump(t,0,.24,.48);power=hump(t,.25,.49,.98)
                    rotate('chest',0,-.19*wind+.23*power);rotate('spine',2,.09*wind);rotate('neck',0,.12*wind-.12*power)
                    for side,sign in [('L',-1),('R',1)]:
                        rotate('upper_'+side,0,-.85*wind-.74*power);rotate('fore_'+side,0,-.76*wind-.12*power)
                        rotate('upper_'+side,2,sign*.26*power)
                    if role=='crystal':rotate('upper_R',0,-.31*wind-.51*power);rotate('fore_R',0,-.47*wind)
                if name=='skill':
                    wind=hump"""
assert anchor in s;s=s.replace(anchor,new)
s=s.replace('            animate_grounded(rig,role,name,t,hump)','            animate_grounded(rig,role,\'attack\' if name.startswith(\'attack\') else name,t,hump)\n            animate_hands(rig,role,name,t,hump)')
s=s.replace("scene.cycles.samples=24","scene.cycles.samples=32")
p.write_text(s,encoding='utf8')
p=Path('game/art-source/sculpted-review/finish_pass.py');s=p.read_text(encoding='utf8')
s=s.replace("lid=rig.pose.bones['lid_'+side];lid.scale.y=.035+.965*amount\n        offset_world(rig,'lid_'+side,(0,0,.147*(1-amount)))", "lid=rig.pose.bones['lid_'+side];lid.scale=(1,1,1)\n        offset_world(rig,'lid_'+side,(0,0,(.299 if role=='stone' else .324)*(1-amount)))")
p.write_text(s,encoding='utf8')
