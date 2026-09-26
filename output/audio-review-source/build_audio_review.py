"""Build a local audio review and portable ZIP from unchanged game assets."""
from pathlib import Path
import json,hashlib,zipfile,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=ROOT/'output'
sys.path.insert(0,str(ROOT/'tmp/tools/audio/python-libs'))
import soundfile as sf
ASSETS=ROOT/'game/assets/resources/audio'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
home=json.loads((ROOT/'game/audio-source/exports/audio_analysis.json').read_text(encoding='utf-8'))
battle=json.loads((ROOT/'game/audio-source/exports/battle_audio_analysis.json').read_text(encoding='utf-8'))
expected={**home['asset_sha256'],**battle['asset_sha256']}
music=[('bgm_home','主界面 · 贝壳湾的早晨','亲切、轻快，陪伴收藏与培养。',96),('bgm_battle','普通战斗 · 守住潮汐小径','节奏更有推动力，听一整局是否耐听。',112),('bgm_boss','首领战 · 巨钳前的勇气','紧张又保留玩具岛的轻快感。',128)]
effects=[
('sfx_ui_confirm','按钮确认','点击操作','交互与收录'),('sfx_bubble_pop','泡泡破裂','普通泡泡破开','交互与收录'),('sfx_bubble_rub','擦泡泡','擦拭过程','交互与收录'),('sfx_collect','确认收录','新龟进入收藏','交互与收录'),('sfx_rare_reveal','稀有揭晓','稀有结果出现','交互与收录'),
('sfx_attack_melee','近战普攻','石头龟与近战敌人','普攻与战况'),('sfx_attack_projectile','远程普攻','刺刺龟发射','普攻与战况'),('sfx_attack_magic','法术普攻','水晶龟与吐墨螺','普攻与战况'),('sfx_hit_soft','轻受击','我方受到伤害','普攻与战况'),('sfx_heal','普通治疗','有效治疗反馈','普攻与战况'),('sfx_core_hit','珍珠受损','敌人漏过防线','普攻与战况'),
('sfx_skill_stone','石头龟 · 守住','主动防御','五只龟的主动技能'),('sfx_skill_spike','刺刺龟 · 穿甲弹','主动穿甲攻击','五只龟的主动技能'),('sfx_skill_crystal','水晶龟 · 水晶炮','主动法术攻击','五只龟的主动技能'),('sfx_skill_leaf','叶子龟 · 大治疗','群体治疗','五只龟的主动技能'),('sfx_skill_bubble','泡泡龟 · 泡泡圈','控制敌人','五只龟的主动技能'),
('sfx_victory','整局胜利','通关结果','胜利与失败'),('sfx_defeat','整局失败','失败结果','胜利与失败')]
catalog=[];manifest=[]
for row in music+effects:
    is_music=row[0].startswith('bgm_');file=row[0]+('.ogg' if is_music else '.wav');path=ASSETS/file
    info=sf.info(str(path));digest=sha(path);assert digest==expected[file],file+' differs from audio validation report'
    meta=json.loads((ASSETS/(file+'.meta')).read_text(encoding='utf-8'));assert meta['importer']=='audio-clip'
    assert info.samplerate==44100 and info.channels==2
    item={'id':row[0],'file':file,'kind':'music' if is_music else 'effects','title':row[1],'description':row[2],'duration':info.duration}
    item['bpm' if is_music else 'group']=row[3];catalog.append(item)
    manifest.append({'file':file,'sha256':digest,'bytes':path.stat().st_size,'frames':info.frames,'sample_rate':info.samplerate,'channels':info.channels,'duration':info.duration,'format':info.format,'subtype':info.subtype,'cocos_meta_importer':meta['importer'],'cocos_uuid':meta['uuid']})
assert len(catalog)==len(expected)==21
assert {p.name for p in ASSETS.iterdir() if p.suffix in ('.wav','.ogg')}==set(expected)
template=(HERE/'audio-review.template.html').read_text(encoding='utf-8')
render=lambda base:template.replace('__CATALOG__',json.dumps(catalog,ensure_ascii=False)).replace('__AUDIO_BASE__',base)
(OUT/'audio-review.html').write_text(render('../game/assets/resources/audio/'),encoding='utf-8')
report={'status':'21 unchanged audio assets and metadata checked','files':manifest,'original_audio_modified':False,'browser_interaction_validation':'record separately','subjective_listening':'pending user review'}
(OUT/'audio-review-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
readme='哥喂龟声音试听包\n\n解压整个文件夹后，用浏览器打开 audio-review.html。保留旁边的 audio 文件夹；无需服务器或账号。\n页面不自动播放。音乐只播一首，短音效逐个听；切到后台会全部停止。音乐与音效可各调音量。\n\n请反馈：项目名 / 手机外放或耳机 / 页面音量 / 时间点 / 是否刺耳、太轻、重复疲劳或循环有断点。\n技术检查已完成；主观听感待你确认。本页面不是实际 Cocos 战斗混音验收。\n'
with zipfile.ZipFile(OUT/'audio-review-pack.zip','w',zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('audio-review.html',render('audio/'))
    archive.writestr('试听说明.txt',readme)
    archive.writestr('audio-review-assets.json',json.dumps(report,ensure_ascii=False,indent=2))
    for file in expected:archive.write(ASSETS/file,'audio/'+file)
with zipfile.ZipFile(OUT/'audio-review-pack.zip') as archive:
    assert len(archive.namelist())==24 and archive.testzip() is None
    for file,digest in expected.items():assert hashlib.sha256(archive.read('audio/'+file)).hexdigest()==digest
for file,digest in expected.items():assert sha(ASSETS/file)==digest
print(json.dumps({'status':'pass','music':3,'effects':18,'bytes':sum(x['bytes'] for x in manifest),'zip_bytes':(OUT/'audio-review-pack.zip').stat().st_size,'original_assets_unchanged':21}))
