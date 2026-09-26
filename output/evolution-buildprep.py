from pathlib import Path
p=Path('game/tests/domain.test.cjs');s=p.read_text(encoding='utf-8').replace(' const f=fixture(),before=f.storage.getItem(SAVE_KEY).length;'," const f=fixture();f.game.refreshClock('progression:bootstrap');const before=f.storage.getItem(SAVE_KEY).length;");p.write_text(s,encoding='utf-8')
p=Path('game/tests/increment-campaign.test.cjs');s=p.read_text(encoding='utf-8').replace('JSON.stringify(l.route))).size,5);','JSON.stringify(l.route))).size,6);');p.write_text(s,encoding='utf-8')
p=Path('game/tests/doc4-polish.test.cjs');s=p.read_text(encoding='utf-8').replace('for(const m of BATTLE_MAPS){','for(const m of BATTLE_MAPS.filter(m=>m.id<55)){');p.write_text(s,encoding='utf-8')
p=Path('game/assets/scripts/core/data.ts');s=p.read_text(encoding='utf-8');a=s.index(".concat({id:55");s=s[:a]+s[a:].replace('x:-1,z:','x:-1.5,z:').replace('x:1,z:','x:1.5,z:').replace('x:-2.5,z:0','x:-2.9,z:0').replace('x:2.5,z:0','x:2.9,z:0');p.write_text(s,encoding='utf-8')
# In game development the source atlas contains whole poses; keep fine breathing from the foot pivot.
p=Path('game/build-config.living-island.json');import json
c=json.loads(p.read_text(encoding='utf-8-sig'));c['name']='哥喂龟 潮汐远征试玩';c['outputName']='tide-evolution';Path('game/build-config.tide-evolution.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),encoding='utf-8')
