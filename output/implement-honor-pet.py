from pathlib import Path
import json,uuid
r=Path(__file__).resolve().parents[1]/'game/assets'
p=r/'scripts/view/ArtV2Assets.ts';s=p.read_text(encoding='utf-8').replace("export type ArtV2Image=","export type ArtV2Image='honor-pet-terrace'|").replace("const IMAGES:ArtV2Image[]=[","const IMAGES:ArtV2Image[]=['honor-pet-terrace',").replace("const modern:Partial<Record<ArtV2Image,string>>={","const modern:Partial<Record<ArtV2Image,string>>={'honor-pet-terrace':'honor-pet-terrace',");p.write_text(s,encoding='utf-8')
p=r/'scripts/view/CommunityMenus.ts';s=p.read_text(encoding='utf-8').replace("new HonorBoard(this.ui,'海岛荣耀榜','',this.home)","new HonorBoard(this.ui,'海岛荣耀榜','',this.home,kind==='pet')").replace("505,-296,143,42","505,kind==='pet'?-310:-296,143,42").replace("this.ui.text(kind==='pet'?'宠物按真实评分排序 · 展示伙伴不影响成绩 · 含本地 AI':kind==='chapter'?","if(kind!=='pet')this.ui.text(kind==='chapter'?");p.write_text(s,encoding='utf-8')
m=r/'resources/art-modern/honor-terrace.png.meta';d=json.loads(m.read_text(encoding='utf-8'));(m.parent/'honor-pet-terrace.png.meta').write_text(json.dumps(d).replace(d['uuid'],str(uuid.uuid4())),encoding='utf-8')
print('Full-width pet podium registered')
