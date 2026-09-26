from pathlib import Path
from urllib.request import urlopen
import hashlib,json
p=Path('output/honor-release-20260917')
url='http://127.0.0.1:7493/'
with urlopen(url,timeout=15) as r: print('Preview HTTP',r.status,'bytes',len(r.read()))
bundle=Path('game/build/honor-final-20260917/assets/main/index.js')
local=bundle.read_bytes()
with urlopen(url+'assets/main/index.js',timeout=20) as r:served=r.read()
assert hashlib.sha256(local).digest()==hashlib.sha256(served).digest(),'Preview bundle mismatch'
print('Served final bundle matches:',hashlib.sha256(local).hexdigest())
qa=p/'design-qa.md'
s=qa.read_text(encoding='utf-8-sig')+'\n最终构建：game/temp/build-logs/20260917-163723.creator.log；BUILD_SUCCESS，构建内核心回归通过。7493服务的主包SHA256与本地最终包一致。\n'
qa.write_text(s,encoding='utf-8')
root=Path('design-qa.md');old=root.read_text(encoding='utf-8-sig');root.write_text(s+'\n---\n\n'+old,encoding='utf-8')
