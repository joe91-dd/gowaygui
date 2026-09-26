from pathlib import Path
import shutil
R=Path(__file__).resolve().parent;old=R.parent/'boss-refine-20260916'
s=(old/'install.py').read_text('utf8')
s=s.replace("[(P['bosses'],'boss-finished-roster'","[(P['fauna'],'fauna-roster',256,8),(P['bosses'],'boss-finished-roster'")
s=s.replace("records=[*P['bosses'],*P['world']]","records=[*P['fauna'],*P['bosses'],*P['world']]").replace("==3 and manifest.get('runtimeOptimized')","==4 and manifest.get('runtimeOptimized')")
(R/'install.py').write_text(s,encoding='utf8')
shutil.copy2(old/'verify_exports.py',R/'verify_exports.py')
print('Installer ready')
