"""User-requested G1 revision; preserves Turbo originals and shared allowance."""
import argparse, hashlib, json, sys
from pathlib import Path
import pro_tasks as base

ORIGINAL_ROOT=base.ROOT
ORIGINAL_PRIVATE=base.PRIVATE
base.ROOT=ORIGINAL_ROOT/'g1'
base.PRIVATE=ORIGINAL_PRIVATE/'g1'
base.ROOT.mkdir(exist_ok=True)
base.PRIVATE.mkdir(exist_ok=True)

def plan(assets):
    items={};mapping={};public={}
    cached=base.read(ORIGINAL_PRIVATE/'model-input-uploads.json')
    for index,asset in enumerate(assets,1):
        paths=sorted((ORIGINAL_ROOT/'inputs'/asset).glob('*.png'),key=lambda p:({'front':0,'side':1,'back':2}.get(p.stem,3),p.name))
        if not paths:raise RuntimeError('INPUTS_MISSING')
        urls=[];proof=[]
        for path in paths:
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            entry=cached.get(asset+'/'+path.name)
            if not entry or entry['sha256']!=digest:raise RuntimeError('INPUT_CACHE_CHANGED')
            urls.append(entry['url']);proof.append({'file':str(path),'sha256':digest})
        seq=str(index)
        body={'imgs':urls,'version':'G1','faceCount':200000 if asset in list(base.ASSETS)[:5] else 60000,'outputFormat':['glb']}
        items[seq]={'endpoint':{'method':'POST','path':'/lux3d/v1/generate/img-to-3d/task/create'},'parameters':{'body':body}}
        mapping[seq]=asset;public[asset]={'label':base.ASSETS[asset][1],'version':'G1','faceCount':body['faceCount'],'inputs':proof}
    base.write(base.PRIVATE/'models-items.json',items)
    base.write(base.ROOT/'model-plan.json',{'sequenceMap':mapping,'assets':public,'authorization':'2026-09-16 user explicitly requested G1 for all characters and weapons; retain gifted-credit allowance; no AHOLO images.'})
    print(json.dumps({'ready':len(items),'itemsFile':str(base.PRIVATE/'models-items.json')}))

if __name__=='__main__':
    try:
        a=argparse.ArgumentParser();a.add_argument('action',choices=['plan','submit','query','download']);a.add_argument('--assets',nargs='+');a.add_argument('--asset');a.add_argument('--quote');args=a.parse_args()
        if args.action=='plan':plan(args.assets or list(base.ASSETS))
        elif args.action=='submit':base.submit('models',args.asset,args.quote)
        else:base.query('models',args.asset,args.action=='download')
    except Exception as exc:
        print(json.dumps({'errorType':type(exc).__name__,'message':'G1 action did not complete. Preserve original IDs; inspect stage before resubmission.'}));sys.exit(1)
