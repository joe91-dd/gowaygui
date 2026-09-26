"""Ordinary-Python exact FBX semantic comparison; no Blender or Cocos starts.

After root imports c02, --check-imported additionally requires the actual runtime FBX
and the Cocos imported triangle buffer to be corrected. It never edits the library.
"""
from pathlib import Path
import importlib.util,json,hashlib,sys,math
OUT=Path(__file__).resolve().parent;FIRST=OUT.parent/'candidate-01';ROOT=OUT.parents[4]
spec=importlib.util.spec_from_file_location('surface_audit',OUT.parent/'normal-review/inspect_surface_normals.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
child=audit.child;chunks=audit.chunks;sha=audit.sha

def semantic(path):
    tree,version=audit.reader.parse(str(path));result={}
    for ob in child(tree,b'Objects').elems:
        if ob.id!=b'Geometry':continue
        vertices=chunks(child(ob,b'Vertices').props[0],3);faces=[];face=[]
        for i in child(ob,b'PolygonVertexIndex').props[0]:
            face.append(i if i>=0 else -i-1)
            if i<0:faces.append(face);face=[]
        uv_layer=child(ob,b'LayerElementUV');uv=chunks(child(uv_layer,b'UV').props[0],2);uvi=child(uv_layer,b'UVIndex').props[0]
        nl=child(ob,b'LayerElementNormal');normals=chunks(child(nl,b'Normals').props[0],3);ni=child(nl,b'NormalsIndex').props[0]
        mapping=child(nl,b'MappingInformationType').props[0];start=0;records=[]
        for f in faces:
            pairs=[(f[j],uv[uvi[start+j]]) for j in range(len(f))]
            ns=[normals[ni[f[j] if mapping==b'ByVertice' else start+j]] for j in range(len(f))]
            u=sum(p[1][0] for p in pairs)/len(f);v=sum(p[1][1] for p in pairs)/len(f)
            records.append({'indices':f,'pairs':sorted(pairs),'normals':sorted(zip(f,ns)),'tile':int(u*8)+8*int(v*4)})
            start+=len(f)
        result[ob.props[1].decode().split('\x00')[0]]={'vertices':vertices,'faces':records}
    return result

before=semantic(FIRST/'boss-bay.fbx');after=semantic(OUT/'boss-bay.fbx');assert before.keys()==after.keys()
checks=[];reversed_count=0;unchanged_count=0;max_other_normal_delta=0
for name,old in before.items():
    new=after[name];assert old['vertices']==new['vertices'],(name,'vertex coordinates changed')
    assert len(old['faces'])==len(new['faces'])
    local_reversed=0
    for i,(a,b) in enumerate(zip(old['faces'],new['faces'])):
        assert a['pairs']==b['pairs'],(name,i,'vertex/UV pair changed')
        assert a['tile']==b['tile']
        grass=name=='Continuous_grass_island_geometry' and a['tile']==1
        if grass:
            # Cyclic start is not significant; direction must reverse, not move any edge.
            reverse=list(reversed(a['indices']))
            assert any(reverse[k:]+reverse[:k]==b['indices'] for k in range(len(reverse))),('Not exactly reversed',i)
            for (vi,an),(vj,bn) in zip(a['normals'],b['normals']):
                assert vi==vj and max(abs(x+y) for x,y in zip(an,bn))<1e-6,(i,'grass normals not negated')
            local_reversed+=1
        else:
            assert a['indices']==b['indices'],(name,i,'unrelated face order changed')
            for (vi,an),(vj,bn) in zip(a['normals'],b['normals']):
                assert vi==vj
                delta=max(abs(x-y) for x,y in zip(an,bn));max_other_normal_delta=max(max_other_normal_delta,delta)
                assert delta<1e-6,(name,i,'unrelated normal changed',delta)
            unchanged_count+=1
    reversed_count+=local_reversed
    checks.append({'mesh':name,'verticesUnchanged':len(new['vertices']),'polygons':len(new['faces']),'grassFacesReversed':local_reversed,'uvPerVertexUnchanged':True})
assert reversed_count==2304
old_a=audit.inspect_fbx(FIRST/'boss-bay.fbx');new_a=audit.inspect_fbx(OUT/'boss-bay.fbx')
assert old_a['models']==new_a['models'] and old_a['axes']==new_a['axes']
grass=next(g for g in new_a['geometry'] if g['name']=='Continuous_grass_island_geometry')['atlasTileGroups'][1]
assert grass['up']==2304 and grass['down']==0 and grass['storedNormalZMin']>.97
for name in ['island-colour.png','island-roughness.png']:assert sha(OUT/name)==sha(FIRST/name)
freeze=json.loads((OUT/'c01-full-freeze.json').read_text(encoding='utf-8'))
assert all(sha(FIRST/name)==item['sha256'] for name,item in freeze['files'].items())
report={'status':'pass','method':'Actual c01/c02 FBX binary geometry and per-face vertex/UV/normal comparison; no Blender process',
        'sourceFbxSha256':sha(FIRST/'boss-bay.fbx'),'correctedFbxSha256':sha(OUT/'boss-bay.fbx'),
        'checks':checks,'grassPolygonsReversed':reversed_count,'otherPolygonsUnchanged':unchanged_count,
        'maximumUnrelatedNormalDelta':max_other_normal_delta,'grassNormalAudit':grass,
        'transformsAxesUnchanged':True,'atlasesOriginalBytes':True,'fullFirstRoundFreezePass':True,
        'cocosImportedStatus':'pending-root-import; original imported evidence in ../normal-review/surface-normal-audit.json'}
if '--check-imported' in sys.argv:
    runtime=ROOT/'game/assets/resources/environment/boss-bay/boss-bay.fbx'
    assert sha(runtime)==sha(OUT/'boss-bay.fbx'),'runtime is still old or another source; no false imported acceptance'
    imported=audit.inspect_cocos();g=imported['groupsByImportedUvTile'][25]
    assert g['localZPositive']==4480 and g['degenerate']==128 and g['localZNegative']==0,g
    assert g['storedZPositive']==4608 and g['storedZNegative']==0,g
    report['cocosImportedStatus']='actual-imported-triangles-pass';report['cocosImportedEvidence']=imported
    target='cocos-imported-check.json'
else:target='fbx-semantic-check.json'
(OUT/target).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['cocosImportedEvidence']},ensure_ascii=False,indent=2))
