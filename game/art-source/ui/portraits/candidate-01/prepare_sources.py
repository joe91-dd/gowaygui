"""Read-only source binding; writes only portrait planning metadata, no Blender."""
from pathlib import Path
import json,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,obj):(HERE/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
specs=[
 {'role':'stone','title':'石头龟','directory':'game/art-source/stone-turtle/candidate-12/c12b','blend':'stone-turtle-review-scene.blend','blend_sha256':'526bb397ef710d4d7bd25c131bfcd7a15756425864ad98628866ec8122159811','fbx':'stone-turtle.fbx','fbx_sha256':'fd2dee9cf539ac5e9b73cfb21cdcac1fede7f25ff60934f68e078d288357ac3c','texture_prefix':'stone','rig':'StoneTurtle_Rig','triangles':28572},
 {'role':'spike','title':'刺刺龟','directory':'game/art-source/spike-turtle/candidate-02','blend':'spike-turtle-review-scene.blend','blend_sha256':'7dc1af162cfab7e7dafa2102bec31d4a6e75189c37c13f7d0fc57a4d87d1ffa5','fbx':'spike-turtle.fbx','fbx_sha256':'5bc7d55d4a69ad8bb89af6637be30ff77024c30f51637490f684bd39abc3f26e','texture_prefix':'spike','rig':'SpikeTurtle_Rig','triangles':28900},
 {'role':'crystal','title':'水晶龟','directory':'game/art-source/crystal-turtle/candidate-02','blend':'crystal-turtle-review-scene.blend','blend_sha256':'34f5c40e57bd5fbbba4d25c1cc61200c3727a7d2812b7cd677b5652b62e7fc08','fbx':'crystal-turtle.fbx','fbx_sha256':'b35d20a6ffbc737231631e505c8ae5b9d5eefea3a83b1b46fd58b838a5bd0364','texture_prefix':'crystal','rig':'CrystalTurtle_Rig','triangles':28899},
 {'role':'leaf','title':'叶子龟','directory':'game/art-source/leaf-turtle/candidate-04/runtime-candidate','blend':'leaf-turtle-runtime.blend','blend_sha256':'61741063560a54ceda7ec90c13fede445f200191616d79c7b23094d36197bbce','fbx':'leaf-turtle.fbx','fbx_sha256':'c6abed3f0de639a37b80fdd0780c5474525f5b33f579a231bd3d0e6d4a44b74e','texture_prefix':'leaf','rig':'LeafTurtle_Rig','triangles':29560},
]
# The fifth input is deliberately absent until turtle_art freezes its runtime
# LOD; do not substitute the already approved but high-poly static prototype.
bubble=HERE/'bubble-input.json'
if bubble.exists():
    candidate=json.loads(bubble.read_text(encoding='utf-8'))
    assert candidate['role']=='bubble' and candidate['runtime_candidate_frozen'] is True
    specs.append(candidate)
protected={};records=[]
for spec in specs:
    source=ROOT/spec['directory'];blend=source/spec['blend'];fbx=source/'export'/spec['fbx']
    assert sha(blend)==spec['blend_sha256'],str(blend)+' differs from frozen source'
    assert sha(fbx)==spec['fbx_sha256'],str(fbx)+' differs from promoted FBX'
    runtime=ROOT/'game/assets/resources/models'/(spec['role']+'-turtle')
    assert sha(runtime/spec['fbx'])==spec['fbx_sha256'],'Runtime does not match approved candidate'
    images=[]
    for suffix in ('colour','roughness'):
        name=spec['texture_prefix']+'-'+suffix+'.png';source_image=source/'export'/name;live=runtime/name
        assert sha(source_image)==sha(live),'Runtime atlas differs from source '+name
        images.append({'path':source_image.relative_to(ROOT).as_posix(),'sha256':sha(source_image),'role':suffix})
        protected[source_image.relative_to(ROOT).as_posix()]=sha(source_image)
        protected[live.relative_to(ROOT).as_posix()]=sha(live)
    for p in (blend,fbx,runtime/spec['fbx']):protected[p.relative_to(ROOT).as_posix()]=sha(p)
    records.append({**spec,'source_blend':blend.relative_to(ROOT).as_posix(),'source_fbx':fbx.relative_to(ROOT).as_posix(),'images':images})
settings={'transparent':True,'size':384,'small_preview_size':64,'samples':24,'threads':2,'frame':1,'action':'idle',
 'camera':{'projection':'ORTHO','azimuth_degrees':12,'elevation_degrees':18,'distance':7,'target':[0,-.38,.96],
   'framing':'One shared orthographic scale fitted to the union of all five head/shell/neck weighted vertices, with 6% margin. No per-role zoom or head reshaping.',
   'minimum_scale':2.40,'maximum_scale_without_review':3.20},
 'colour_management':{'view_transform':'AgX','exposure':0,'gamma':1},
 'world':{'colour':[.58,.67,.75,1],'strength':.38},
 'lights':[{'name':'Key','location':[-3,-4,6],'energy':500,'size':4.5,'colour':[1,.94,.84]},
           {'name':'Fill','location':[4,-2,3],'energy':270,'size':4,'colour':[.82,.92,1]},
           {'name':'Rim','location':[0,3,4],'energy':460,'size':3,'colour':[.92,.98,1]}]}
write('portrait-plan.json',{'status':'all-five-bound-awaiting-render-slot' if len(records)==5 else 'four-frozen-sources-bound-awaiting-bubble-runtime-and-render-slot',
 'sources':records,'protected_sha256':protected,'render_settings':settings,'source_changes':False,'render_started':False})
print(json.dumps({'sources_verified':len(records),'protected_files':len(protected),'blender_started':False,'awaiting_bubble':len(records)<5}))
