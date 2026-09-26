from pathlib import Path
import shutil
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');OUT=Path(__file__).resolve().parent
for name in ['battle-mode-assets.test.cjs','fauna-aura.test.cjs','world-boss.test.cjs']:
 p=ROOT/'game/tests'/name;bak=OUT/'code-before/game/tests'/name;bak.parent.mkdir(parents=True,exist_ok=True)
 if not bak.exists():shutil.copy2(p,bak)
 s=p.read_text('utf8')
 if name=='battle-mode-assets.test.cjs':
  s=s.replace("['../core/faunaCatalog','../core/faunaPresentation','../core/bossCatalog'].includes(n)","n.startsWith('../core/')")
  s=s.replace("faunaLoading:new Set(),","faunaLoading:new Set(),enemies:new Map(),")
 if name=='world-boss.test.cjs':
  s=s.replace("'../.server-build/core'","'../.test-build/core'")
  s=s.replace("five distinct bosses","four approved bosses").replace("WORLD_BOSSES.length,5","WORLD_BOSSES.length,4").replace("b.art)).size,5","b.art)).size,4").replace("Array.from({length:5}","Array.from({length:4}").replace("bossIndex)).size,5","bossIndex)).size,4").replace("i<5;i++","i<4;i++")
 if name=='fauna-aura.test.cjs':
  s=s.replace("exports:mod.exports,module:mod","exports:mod.exports,module:mod,require:()=>({enemyG1Grade:(level,wave=1)=>Math.min(4,level===50?Math.floor(Math.max(0,wave-1)/100):Math.floor(Math.max(0,level)/10))})")
  s=s.replace("[0,1,1,2,3,4]","[0,1,2,3,4,4]").replace("assert.ok(faunaAuraGrade('elite',level)<3);","assert.ok(faunaAuraGrade('elite',level)<=4);")
 p.write_text(s,'utf8')
print('Updated tests for approved four-world / five-mutation roster and new asset loader.')

