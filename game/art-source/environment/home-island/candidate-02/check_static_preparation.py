"""Plain Python only: immutable first layout, all-yaw support outline and script syntax."""
from pathlib import Path
import json,hashlib,ast,math
OUT=Path(__file__).resolve().parent;FIRST=OUT.parent/'candidate-01'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
freeze=json.loads((OUT.parent/'first-round-freeze.json').read_text(encoding='utf-8'))
assert all(sha(FIRST/name)==item['sha256'] for name,item in freeze['files'].items())
for name in ['layout-proposal.json','layout-proposal.svg','layout-proposal.png']:assert sha(OUT/name)==sha(FIRST/name)
scripts=list(OUT.glob('*.py'))
for p in scripts:ast.parse(p.read_text(encoding='utf-8'))
layout=json.loads((OUT/'layout-proposal.json').read_text(encoding='utf-8'))
tree=ast.parse((OUT/'home_composition.py').read_text(encoding='utf-8'))
court=ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='COURT' for t in n.targets)))
edge=[]
for i,((ax,az),(bx,bz)) in enumerate(zip(court,court[1:]+court[:1])):
    dx,dz=bx-ax,bz-az;length=math.hypot(dx,dz);nx,nz=dz/length,-dx/length;steps=max(2,math.ceil(length/.42))
    for j in range(steps):
        t=j/steps;bulge=(.075+.043*math.sin((i*7+j)*1.73))*math.sin(math.pi*t)**.35
        edge.append((ax+dx*t+nx*bulge,az+dz*t+nz*bulge))
def inside(x,z,polygon):
    yes=False
    for (ax,az),(bx,bz) in zip(polygon,polygon[1:]+polygon[:1]):
        if (az>z)!=(bz>z) and x<(bx-ax)*(z-az)/(bz-az)+ax:yes=not yes
    return yes
for anchor in layout['anchors']:
    for j in range(360):
        x=anchor['x']+1.02*math.cos(math.radians(j));z=anchor['z']+1.02*math.sin(math.radians(j))
        assert inside(x,z,edge),(anchor['name'],j,'outline cuts support')
report={'status':'static-preparation-pass-blender-not-started','firstRoundFilesIntact':len(freeze['files']),
        'layoutProposalBytesUnchanged':True,'cameraAndFiveAnchorsUnchanged':True,
        'outlineChecks':{'anchors':5,'yawDirectionsPerAnchor':360,'protectedRadius':1.02,'total':1800,'pass':True},
        'newPerimeterVertices':len(edge),'astValidScripts':len(scripts),
        'budgetTargetTriangles':45000,'actualFootAndRenderChecks':'pending authorized one-round Blender generation',
        'characters':'Five approved runtime FBX references in preview only; no characters exported with island'}
(OUT/'static-preparation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
