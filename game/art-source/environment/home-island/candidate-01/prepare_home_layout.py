"""Pure Python layout/projection proposal. Does not import bpy or start Blender."""
from pathlib import Path
import math,json,hashlib,itertools
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
OUT.mkdir(parents=True,exist_ok=True)
anchors=[
 {'name':'Display_stone','role':'stone','x':-.80,'y':.16,'z':2.70,'yawDegrees':8},
 {'name':'Display_spike','role':'spike','x':-2.40,'y':.16,'z':-.25,'yawDegrees':12},
 {'name':'Display_crystal','role':'crystal','x':-3.15,'y':.16,'z':2.15,'yawDegrees':15},
 {'name':'Display_leaf','role':'leaf','x':1.55,'y':.16,'z':2.30,'yawDegrees':-8},
 {'name':'Display_bubble','role':'bubble','x':2.05,'y':.16,'z':-.30,'yawDegrees':-12},
]
camera={'position':[1.8,8.2,12.8],'target':[-.45,.9,0],'baseVerticalFovDegrees':38}
oldCamera={'position':[5.5,6.3,9],'target':[0,.6,0],'baseVerticalFovDegrees':38}
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):return [n/math.sqrt(dot(v,v)) for n in v]
def project(p,cam,width=1280,height=720):
 f=unit(sub(cam['target'],cam['position']));r=unit(cross(f,[0,1,0]));u=cross(r,f);v=sub(p,cam['position']);d=dot(v,f)
 vfov=2*math.atan(math.tan(math.radians(cam['baseVerticalFovDegrees'])/2)*max(1,(1280/720)/(width/height)))
 scale=height/(2*math.tan(vfov/2));return [width/2+dot(v,r)*scale/d,height/2-dot(v,u)*scale/d]
def bounds(points,cam):
 p=[project(x,cam) for x in points];return [min(x[0] for x in p),min(x[1] for x in p),max(x[0] for x in p),max(x[1] for x in p)]
def box(x0,y0,z0,x1,y1,z1):return list(itertools.product([x0,x1],[y0,y1],[z0,z1]))
def overlap(a,b):return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
cta=[907,530,1227,610];doorPoints=box(-.57,.25,-1.31,.67,1.95,-1.29)
def cameraChecks(cam):
 door=bounds(doorPoints,cam);display=[]
 for a in anchors:
  # Conservative planning envelope, not an unperformed Blender mesh measurement.
  b=bounds(box(a['x']-.82,a['y'],a['z']-1.08,a['x']+.82,a['y']+1.45,a['z']+1.08),cam)
  display.append({'name':a['name'],'boundsPixels':b,'ctaOverlapPx2':overlap(b,cta),'doorOverlapPx2':overlap(b,door)})
 return {'camera':cam,'doorBoundsPixels':door,'display':display,'totalDoorOverlapPx2':sum(p['doorOverlapPx2'] for p in display),'totalCtaOverlapPx2':sum(p['ctaOverlapPx2'] for p in display)}
sourcePaths={
 'stone':'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle.blend',
 'spike':'game/art-source/spike-turtle/candidate-02/spike-turtle.blend',
 'crystal':'game/art-source/crystal-turtle/candidate-02/crystal-turtle.blend',
 'leaf':'game/art-source/leaf-turtle/candidate-04/runtime-candidate/leaf-turtle-runtime.blend',
}
references={role:{'path':path,'sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),'use':'Offline scale reference only; never append to exported environment collection'} for role,path in sourcePaths.items()}
pairs=[{'a':a['name'],'b':b['name'],'centerDistance':math.hypot(a['x']-b['x'],a['z']-b['z']),'fullSoleCircleGap':math.hypot(a['x']-b['x'],a['z']-b['z'])-2*.9746471943161487} for i,a in enumerate(anchors) for b in anchors[i+1:]]
proposal={'status':'script-and-layout-proposal-only-blender-not-started','reference':'output/art/A-潮汐玩具岛.png lower home scene, actually viewed','nominalIslandXZ':[12,8],'waterY':-.72,'displaySurfaceY':.16,'modelScale':.65,'anchors':anchors,'house':{'center':[.05,.10,-2.50],'facadeZ':-1.30,'width':3.75,'depth':2.25,'highestPearlY':3.68,'roofPeakApproxY':4.30,'doorClearAreaXZ':[-.72,.72,-1.40,.40]},'dock':{'center':[-6.0,-.03,1.35],'widthAlongX':2.70,'depthAlongZ':1.20,'note':'Left short wood pier; external extent beyond nominal island is reported honestly'},'cameraCandidate':camera,'previousHomeCamera':oldCamera,'uiReserved1280x720':{'startButton':cta,'topLeftLogo':[35,35,400,160],'topRightResources':[860,31,1260,83],'bottomNavigation':[65,625,860,690]},'cameraChecks':{'existing':cameraChecks(oldCamera),'candidate':cameraChecks(camera)},'planningEnvelope':{'width':1.64,'depth':2.16,'height':1.45,'note':'Conservative static planning box at scale .65, based on own c12b sole and existing model report dimensions; verify actual offline instances after Blender slot is allocated.'},'soleEnvelopeRadius':.9746471943161487,'anchorPairs':pairs,'characterSourceReferences':references,'bubble':'Reserved anchor only; no unapproved model or lookalike substituted.','exportRules':['Only Ground/Landmarks_and_nature/Pearl_and_lamps meshes plus environmental/display empty anchors','Characters/cameras/lights/ocean excluded from environment FBX','No enemy path, no combat route/slots import, no new gameplay','No source/resources/views/core modifications outside this independent candidate'],'pending':['Root approves/adjusts layout and assigns Blender slot','Generate editable source and original atlases','Actual foot support, full-body clearances and source-reference instances','Battle-free home view, top view, house detail and UI overlay review']}
(OUT/'layout-proposal.json').write_text(json.dumps(proposal,ensure_ascii=False,indent=2),encoding='utf-8')
# Editable top-down plan and perspective camera envelope diagram.
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1010" viewBox="0 0 1280 1010">','<rect width="1280" height="1010" fill="#f1ebdc"/>','<style>text{font-family:Arial,"Microsoft YaHei";fill:#234840;font-size:17px}.small{font-size:13px}</style>','<text x="30" y="32">首页海岛 c01 · 静态布局提案（不是建模/运行验收）</text>']
def coord(x,z):return (330+x*37,265+z*37)
svg.append('<ellipse cx="330" cy="265" rx="222" ry="148" fill="#98b385" stroke="#657963" stroke-width="12"/>')
hx,hz=coord(.05,-2.5);svg.append(f'<rect x="{hx-70}" y="{hz-42}" width="140" height="84" rx="30" fill="#dacaab" stroke="#7c6e51" stroke-width="3"/>')
svg.append(f'<text x="{hx-57}" y="{hz+5}">贝壳屋 / 珍珠</text>')
dx,dz=coord(-6,1.35);svg.append(f'<rect x="{dx-50}" y="{dz-22}" width="100" height="44" rx="8" fill="#ae8656"/>')
for a in anchors:
 x,z=coord(a['x'],a['z']);svg.append(f'<ellipse cx="{x}" cy="{z}" rx="{.82*37}" ry="{1.08*37}" fill="#fff6da" stroke="#467b77" stroke-width="2"/><text class="small" x="{x-23}" y="{z+5}">{a["role"]}</text>')
svg+=['<text x="650" y="92">五个真实空地锚点，地面连续；不做五个摄影棚圆盘。</text>','<text x="650" y="128">左木栈桥 / 后贝壳屋 / 前方五龟，右侧留主按钮。</text>','<text x="650" y="164">规划包络 1.64×2.16×1.45；实际角色实例审查待执行。</text>',f'<text x="650" y="200">最小足底圈间距 {min(p["fullSoleCircleGap"] for p in pairs):.3f} 格</text>']
checks=proposal['cameraChecks']['candidate'];offset=465;svg.append(f'<rect y="{offset}" width="1280" height="540" fill="#669da1"/>')
svg.append(f'<text x="28" y="{offset+25}">候选镜头投影（1280×720 按 .72 缩放；橙=门，金=主按钮，白=龟尺度包络）</text>')
def plotrect(b,col,label):
 x,y,x1,y1=b;s=.72;svg.append(f'<rect x="{180+x*s}" y="{offset+30+y*s}" width="{(x1-x)*s}" height="{(y1-y)*s}" fill="{col}" fill-opacity=".6" stroke="#254b49"/><text class="small" x="{182+x*s}" y="{offset+43+y*s}">{label}</text>')
plotrect(cta,'#ffcc68','开始冒险');plotrect(checks['doorBoundsPixels'],'#efac70','门')
for a in checks['display']:plotrect(a['boundsPixels'],'#fff9e4',a['name'].replace('Display_',''))
svg.append('</svg>');(OUT/'layout-proposal.svg').write_text('\n'.join(svg),encoding='utf-8')
print(json.dumps({'candidateCamera':camera,'minimumSoleCircleGap':min(p['fullSoleCircleGap'] for p in pairs),'cameraOverlap':{k:{'door':v['totalDoorOverlapPx2'],'CTA':v['totalCtaOverlapPx2']} for k,v in proposal['cameraChecks'].items()}},ensure_ascii=False))
