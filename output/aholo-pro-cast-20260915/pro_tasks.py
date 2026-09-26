"""PRO regeneration, with original records and the shared conversation allowance."""
import argparse, datetime as dt, hashlib, json, os, sys
from pathlib import Path
SKILL=Path('C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
sys.path.insert(0,str(SKILL/'core/runtime'))
import lux3d_client as client
import asset_uploader
ROOT=Path(__file__).resolve().parent
PRIVATE=Path(os.environ['TEMP'])/'codex-aholo-pro-20260915'
PRIVATE.mkdir(parents=True,exist_ok=True)
LEDGER=ROOT.parent/'aholo-cast-20260915/budget.json'
REFERENCES=ROOT.parent/'character-turnarounds-20260915'
ASSETS={
 'yandun':('01-yandun-turnaround-v2.png','岩盾','Massive rock guardian, broad confident smiling muzzle, amber eyes with thick shaped brows, golden skin, ivory belly plates, charcoal rocky shell with a crown of cyan crystals, crystal bracers and toes.'),
 'yeling':('02-yeling-turnaround-v2.png','叶灵','Alert amber eyes and youthful narrow face, deep forest jade leaf hood with muted sage edges, brown leather quiver on shell, golden skin. Remove handheld bow.'),
 'shange':('03-shange-turnaround-v2.png','珊歌','Wise serene blue almond eyes, soft mint muzzle, cyan skin, white cloth hood and robe with blue lining and restrained gold trim, blue shell. Remove handheld staff and all water magic effects.'),
 'yangguang':('04-yangguang-turnaround-v2.png','阳光','Warm rounded smiling face and honey eyes, golden skin, woven straw hat with red berries, terracotta orange leaf cape, warm wood shell and leather belt. Remove handheld lantern.'),
 'chaoxing':('05-chaoxing-turnaround-v2.png','潮行','Distinct impish asymmetric eyebrow and crooked smile, violet eyes, pale periwinkle skin, ink indigo helmet and armor with brass edges and violet gemstone, faceted dark shell. Remove handheld staff.'),
 'leaf-bow':('02-yeling-turnaround-v2.png','叶灵·长弓','Only the recurved dark warm wood bow from this character, sage jade leaf ornament and brown leather central grip. Complete uninterrupted curved bow frame, no arrow, omit the thin string for later assembly.'),
 'wave-staff':('03-shange-turnaround-v2.png','珊歌·海浪法杖','Only the bronze and wood staff held by the mage. Solid translucent cyan crystal carved as a curled ocean wave seated on the wooden spiral mount, gold ferrules, straight narrow shaft. The wave is solid carved gemstone, no floating droplets or magical effects.'),
 'sun-lantern':('04-yangguang-turnaround-v2.png','阳光·提灯','Only the warm bronze hexagonal lantern held by this turtle, raised articulated circular top handle, amber glass panels, visible central candle inside. Preserve full open handle hole, solid elegant frame, no glow bloom or particles.'),
 'tide-staff':('05-chaoxing-turnaround-v2.png','潮行·召唤法杖','Only the slender dark bronze staff held by this turtle, indigo angular prongs enclosing a violet diamond gemstone, gold collar rings, simple straight shaft. Gem fully seated in its mount, no floating particles or light beams.')
}
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def write(p,data):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def now():return dt.datetime.now(dt.timezone.utc).isoformat()
def view_prompt(asset):
 desc=ASSETS[asset][2]
 if asset in ['yandun','yeling','shange','yangguang','chaoxing']:
  return ('Create four CONSISTENT views of ONE same approved cartoon turtle from this design sheet, with matching costume and shell landmarks in every view. Change only the pose into a clean rigging A-pose: both arms held outward at 50 degrees from the vertical body, elbows nearly straight, palms forward, hands relaxed with distinct rounded fingers and visible thumb gap. Both hands and forearms completely outside the torso and leg silhouette. Large empty gaps between arms and body, between hands and hips. Feet shoulder width apart, distinct legs. Thick shoulder armor follows upper arms and leaves armpits visible. No handheld weapon, no display base, no effects, no text. Preserve original facial shape, integrated almond-shaped eyes with eyelids, proportions and colors exactly. '+desc+' Neutral matte studio materials, diffuse white lighting, white backdrop. No ball-shaped added eyes, no pose variation between views, no arms down, no clenched fists touching thighs. Show full body in all four outputs.')
 return ('Create four consistent views of ONE isolated game equipment asset from the reference. EXCLUDE ALL characters, hands, clothing, ground, text, labels and other equipment. '+desc+' Faithful premium stylized game material rendering, simple white background, even diffuse illumination, full object visible with a margin, consistent shape in all views.')
def plan_views():
 uploads=read(PRIVATE/'uploads.json') if (PRIVATE/'uploads.json').exists() else {}
 for file,_,_ in ASSETS.values():
  if file not in uploads:
   uploads[file]=asset_uploader.upload_file(REFERENCES/file,region='cn');write(PRIVATE/'uploads.json',uploads)
 items={};mapping={}
 for i,(asset,(file,label,_)) in enumerate(ASSETS.items(),1):
  seq=str(i);items[seq]={'endpoint':{'method':'POST','path':'/lux3d/v1/generate/image-to-four-view/task/create'},'parameters':{'body':{'img':uploads[file]['url'],'prompt':view_prompt(asset)}}};mapping[seq]=asset
 write(PRIVATE/'views-items.json',items);write(ROOT/'view-plan.json',{'sequenceMap':mapping,'assets':{a:{'label':v[1],'reference':v[0],'prompt':view_prompt(a)} for a,v in ASSETS.items()}})
 print(json.dumps({'ready':len(items),'itemsFile':str(PRIVATE/'views-items.json'),'uploadedReferences':len(uploads)}))
def submit(stage,asset,quote_path):
 if stage!='models':raise RuntimeError('USER_PROHIBITS_AHOLO_FLAT_IMAGE_GENERATION')
 record_path=ROOT/'attempts'/f'{asset}-{stage}.json'
 if record_path.exists():raise RuntimeError('ATTEMPT_EXISTS_QUERY_INSTEAD')
 plan=read(ROOT/f'{stage[:-1] if stage=="views" else stage}-plan.json') if stage=='views' else read(ROOT/'model-plan.json')
 seq=next(k for k,v in plan['sequenceMap'].items() if v==asset)
 quote=read(quote_path);item=read(PRIVATE/f'{stage}-items.json')[seq];body=item['parameters']['body'];cost=quote['quote']['details'][seq]
 if dt.datetime.now(dt.timezone.utc)>=dt.datetime.fromisoformat(quote['quote']['expiresAt']):raise RuntimeError('QUOTE_EXPIRED')
 if not quote['account'].get('member'):raise RuntimeError('MEMBERSHIP_NOT_ACTIVE')
 ledger=read(LEDGER)
 if ledger['committedEstimate']+cost>ledger['authorizedGiftCreditLimit']:raise RuntimeError('ALLOWANCE_EXCEEDED')
 record={'asset':asset,'stage':stage,'region':'cn','accountRef':quote['account']['accountRef'],'memberAtSubmission':quote['account']['member'],'memberTypeAtSubmission':quote['account'].get('memberType'),'createdAt':now(),'quoteId':quote['quote']['quoteId'],'estimatedCredits':cost,'approval':'User upgraded PRO and explicitly authorized regenerating all five characters and their equipment; prior gifted-credit allowance retained.','state':'started','taskId':None,'request':{k:v for k,v in body.items() if k not in ['img','imgs']}}
 ledger['committedEstimate']+=cost;entry={'asset':('pro-g1-' if body.get('version')=='G1' else 'pro-')+asset+'-'+stage,'estimate':cost,'state':'started'};ledger['entries'].append(entry);write(LEDGER,ledger);write(record_path,record)
 try:
  task_id=(client.create_image_to_four_view_task if stage=='views' else client.create_image_to_3d_task)(region='cn',**body)
  record.update(taskId=task_id,state='submitted',submittedAt=now());entry.update(taskId=task_id,state='submitted');write(record_path,record);write(LEDGER,ledger)
 except Exception as exc:
  record.update(state='submission_unknown',errorType=type(exc).__name__);write(record_path,record);raise
 print(json.dumps({'asset':asset,'stage':stage,'taskId':task_id,'estimatedCredits':cost}))
def query(stage,asset,download=False):
 p=ROOT/'attempts'/f'{asset}-{stage}.json';r=read(p);task=client.get_task(r['taskId'],region='cn');write(PRIVATE/f'{asset}-{stage}-task.json',task)
 r.update(providerStatus=task.get('status'),updatedAt=now());write(p,r)
 if task.get('status')==3 and download and not r.get('files'):
  urls=client.parse_task_outputs(task);files=[]
  if stage=='views':
   if len(urls)!=4:raise RuntimeError('FOUR_VIEW_OUTPUT_COUNT_MISMATCH')
   import requests
   d=ROOT/'views'/asset;d.mkdir(parents=True,exist_ok=True)
   for i,url in enumerate(urls):
    response=requests.get(url,timeout=120);response.raise_for_status();f=d/f'{i+1}.png';f.write_bytes(response.content);files.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
   write(PRIVATE/f'{asset}-view-urls.json',urls)
  else:
   formats=client.generation_result_formats(r['request']['version'],r['request']['outputFormat']);(ROOT/'models').mkdir(exist_ok=True)
   for f,size in client.download_requested_models(urls,str(ROOT/'models'/asset),formats):files.append({'path':str(f),'bytes':size,'sha256':hashlib.sha256(Path(f).read_bytes()).hexdigest()})
  r.update(files=files,downloadedAt=now());write(p,r)
 print(json.dumps({'asset':asset,'stage':stage,'taskId':r['taskId'],'status':task.get('status'),'files':r.get('files',[])}))
def plan_models(assets):
 items={};mapping={}
 for i,asset in enumerate(assets,1):
  paths=sorted((ROOT/'inputs'/asset).glob('*.png'),key=lambda p:({'front':0,'side':1,'back':2}.get(p.stem,3),p.name))
  if not paths:raise RuntimeError('LOCAL_INPUTS_MISSING')
  cached=read(PRIVATE/'model-input-uploads.json') if (PRIVATE/'model-input-uploads.json').exists() else {}
  urls=[]
  for p in paths:
   fingerprint=hashlib.sha256(p.read_bytes()).hexdigest();key=asset+'/'+p.name
   if key not in cached or cached[key].get('sha256')!=fingerprint:
    result=asset_uploader.upload_file(p,region='cn');cached[key]={'sha256':fingerprint,'url':result['url']};write(PRIVATE/'model-input-uploads.json',cached)
   urls.append(cached[key]['url'])
  seq=str(i)
  items[seq]={'endpoint':{'method':'POST','path':'/lux3d/v1/generate/img-to-3d/task/create'},'parameters':{'body':{'imgs':urls,'version':'G1-Turbo','faceCount':200000 if asset in list(ASSETS)[:5] else 60000,'enablePbr':True,'outputFormat':['glb','zip']}}};mapping[seq]=asset
 write(PRIVATE/'models-items.json',items);write(ROOT/'model-plan.json',{'sequenceMap':mapping});print(json.dumps({'ready':len(items),'itemsFile':str(PRIVATE/'models-items.json')}))
if __name__=='__main__':
 try:
  a=argparse.ArgumentParser();a.add_argument('action');a.add_argument('--stage',choices=['views','models']);a.add_argument('--asset');a.add_argument('--quote');a.add_argument('--assets',nargs='+');args=a.parse_args()
  if args.action=='plan-views':raise RuntimeError('USER_PROHIBITS_AHOLO_FLAT_IMAGE_GENERATION')
  elif args.action=='plan-models':plan_models(args.assets)
  elif args.action=='submit':submit(args.stage,args.asset,args.quote)
  elif args.action in ['query','download']:query(args.stage,args.asset,args.action=='download')
  else:raise RuntimeError('UNKNOWN_ACTION')
 except Exception as e:print(json.dumps({'errorType':type(e).__name__,'message':'Action did not complete; retain original task IDs and inspect the current stage.'}));sys.exit(1)
