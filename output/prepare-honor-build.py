from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
p=r/'game/build-config.ui-complete.json';d=json.loads(p.read_text(encoding='utf-8-sig'));d['outputName']='honor-release-20260917';d['name']='哥喂龟 · 海岛荣耀';(p.parent/'build-config.honor-release.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
p=r/'game/assets/scripts/view/CommunityMenus.ts';s=p.read_text(encoding='utf-8').replace('Object.values(c.aiPlayers[r.id]?.pets??{}).slice(0,1)','Object.values(c.aiPlayers[r.id]?.pets??{}).slice(i%5,i%5+1)');p.write_text(s,encoding='utf-8')
print('Dedicated honor build configured')
