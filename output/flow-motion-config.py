from pathlib import Path
import json
p=Path('game/assets/scripts/view/CompanionRig.ts');s=p.read_text('utf8').replace('if(this.playing&&this.gestureTime<this.duration*.75)return;','if(this.playing)return;');p.write_text(s,'utf8')
p=Path('game/assets/scripts/view/CompanionRigData.ts');s=p.read_text('utf8').replace('-.12*Math.sin(p/.16*Math.PI)','-.12*Math.pow(Math.sin(p/.16*Math.PI),2)');p.write_text(s,'utf8')
p=Path('game/build-config.flow-motion.json');c=json.loads(Path('game/build-config.tide-evolution.json').read_text('utf8-sig'));print(c)
