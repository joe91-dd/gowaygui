"""Record completed manual image review and freeze this independent candidate."""
from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,data):(HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert not (HERE/'source-freeze.json').exists(),'Already frozen; do not overwrite candidate records'
render=json.loads((HERE/'render-report.json').read_text(encoding='utf-8'))
checks=json.loads((HERE/'png-check.json').read_text(encoding='utf-8'))
assert len(checks['files'])==10
for name,digest in render['protected_sha256'].items():assert sha(ROOT/name)==digest,name
for item in checks['files']:assert sha(HERE/item['file'])==item['sha256'],item['file']
review={'status':'author-opened-all-10-PNGs-candidate-ready-for-parent-review',
 'images_opened':[{'file':i['file'],'sha256':i['sha256']} for i in checks['files']],
 'method':'view_image opened each 384px portrait and each original-size 64px render individually after Blender exited 0.',
 'observations':['Five characters remain visibly distinct by stone plates, orange spikes, blue crystals, green leaves and cream-blue bubble spiral.',
 'Eyes and mouth are visible in 384px portraits; eyes and shell family cues remain identifiable in true 64px images.',
 'One camera, one framing and one lighting setup preserve the shared head placement; shorter shells have more transparent space above, not independently enlarged.',
 'No visible head, shell tip or foot is clipped; all four canvas corners are transparent. The same model feet/face geometry is intentionally retained from frozen runtime assets.',
 'No flattening onto a coloured background, per-character retouch, geometry change or resource promotion was performed.'],
 'limitations':['48px/96px light/dark review.html has been authored but not operated in a browser during this task.',
 'Blender lighting is a controlled portrait setup, not a claim of exact Cocos lighting equivalence.',
 'Parent review and actual UI placement/phone readability are still pending; this is not final user art approval.'],
 'blender_exit_code':0,'frozen_character_files_unchanged':35,'runtime_assets_written':False}
write('visual-review.json',review)
files=[]
for p in sorted(HERE.rglob('*')):
 if p.is_file() and p.name!='source-freeze.json':files.append({'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
write('source-freeze.json',{'status':'candidate-frozen-awaiting-parent-review','scope':'This independent portrait directory only; role source/runtime hashes are separately recorded in render-report.json.','files':files,'runtime_assets_written':False})
print(json.dumps({'portrait_images':10,'files_frozen':len(files),'role_source_runtime_files_unchanged':35,'blender_running':False}))
