"""Build a portable offline A/B audition page with all six full tracks embedded."""
from pathlib import Path
import base64, html, json
HERE=Path(__file__).resolve().parent
tracks=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
cards=[]
for t in tracks:
    duration=f"{int(t['duration'])//60}:{int(t['duration'])%60:02d}"
    src='data:audio/ogg;base64,'+base64.b64encode((HERE/t['listening']).read_bytes()).decode()
    cards.append(f'''<article class="card {t['group'].lower()}"><div class="eyebrow">{t['group']} · {t['role']}</div>
<h2>{html.escape(t['title'])}</h2><p class="description">{t['description']}</p>
<audio id="{t['id']}" controls preload="none" aria-label="{t['group']} {t['role']} {html.escape(t['title'])}" src="{src}"></audio>
<div class="actions"><button data-track="{t['id']}" data-start="0">从头播放</button><button data-track="{t['id']}" data-start="30">从 30 秒试听</button><span>{duration} · 完整曲目</span></div>
<div class="credit">{html.escape(t['author'])}<br><a href="{t['source']}" target="_blank" rel="noopener">作品来源与 CC0 授权 ↗</a></div></article>''')
template='''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>哥喂龟 · 第二轮音乐试听</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f2ed;color:#252c29;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1120px;margin:auto;padding:48px 28px 64px}.kicker{font-size:12px;letter-spacing:2px;color:#65716b}h1{font-size:clamp(30px,5vw,46px);letter-spacing:-1px;line-height:1.2;margin:16px 0}header p{color:#626a64;max-width:780px}.controlbar{position:sticky;top:0;z-index:2;background:#f3f2edf5;border-top:1px solid #d4d9d2;border-bottom:1px solid #d4d9d2;padding:16px 0;display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:28px 0 24px;backdrop-filter:blur(12px)}button{font:inherit;font-size:14px;cursor:pointer;border:1px solid #c6d1c9;border-radius:8px;padding:9px 13px;background:white;color:#244e3e}button:hover{background:#e6eee8}button:focus-visible,a:focus-visible{outline:3px solid #267858;outline-offset:3px}.controlbar label{font-size:14px;display:flex;gap:10px;align-items:center}input{accent-color:#28684d;width:120px}#status{font-size:13px;color:#526459;flex:1;min-width:240px}.columns,.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.columns{margin-bottom:20px}.set{padding:20px 24px;border-radius:14px;background:#dde8df}.set:last-child{background:#e2e5f1}.set b{font-size:23px;display:block}.set span{font-size:14px;color:#57645e}.card{background:#fff;border:1px solid #d8dfd8;border-top:4px solid #54856c;border-radius:16px;padding:25px;min-width:0}.card.b{border-top-color:#767cbd}.eyebrow{font-size:13px;font-weight:650;color:#466c56}.b .eyebrow{color:#62649c}h2{font-size:24px;line-height:1.3;margin:10px 0 12px}.description{font-size:14px;color:#66706a;min-height:46px;margin-bottom:18px}audio{width:100%;height:44px}.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 20px}.actions span{font-size:12px;color:#757d77;margin-left:auto}.credit{padding-top:16px;border-top:1px solid #edf0ea;font-size:12px;color:#727c74}a{color:#336c58;text-decoration-thickness:1px;text-underline-offset:3px}footer{margin-top:36px;padding-top:24px;border-top:1px solid #d4d9d2;color:#69736a;font-size:13px}footer b{color:#334c3f}footer p{margin:8px 0}article.playing{box-shadow:0 0 0 3px #83a592}.b.playing{box-shadow:0 0 0 3px #a1a5d3}@media(max-width:650px){main{padding:28px 16px}.grid{grid-template-columns:1fr}.columns{gap:10px}.set{padding:15px}.set b{font-size:19px}.set span{font-size:12px}.card{padding:20px}.description{min-height:0}.controlbar{gap:12px}.actions span{margin-left:0}h2{font-size:23px}}
</style></head><body><main><header><div class="kicker">哥喂龟 / MUSIC SELECTION / ROUND 02</div><h1>两种风格，先听再选。</h1><p>每套依次覆盖战斗外、普通战斗和首领战。可以选整套，也可以按场景混搭；游戏当前音乐尚未替换。</p></header>
<div class="controlbar"><button id="stop">全部停止</button><label>试听音量 <input id="volume" aria-label="试听音量" type="range" min="0" max="1" step=".01" value=".75"></label><span id="status" role="status" aria-live="polite">点击播放器开始；切歌会自动停下上一首。</span></div>
<div class="columns"><div class="set"><b>A · 奇幻管弦</b><span>城镇木管 → 弦乐战斗 → 史诗首领</span></div><div class="set"><b>B · 现代电子</b><span>悠闲 lo-fi → Trance 律动 → 紧迫决战</span></div></div>
<section class="grid" aria-label="按场景比较两套音乐">__CARDS__</section>
<footer><b>六首均为 CC0 1.0 · 免费商用候选</b><p>已核对各作品页的 CC0 标注，保留作者与原始来源。可用于商业游戏并修改。<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">查看 CC0 许可 ↗</a></p><p>本页内嵌完整曲目，可离线试听。仅统一试听响度并转为 OGG，原始下载文件完整保留。正式接入时再处理循环点与场景切换。</p><p>试听后告诉我：选 A、选 B，或例如「战斗外 B / 普通战斗 A / 首领 A」。</p></footer></main>
<script>
const players=[...document.querySelectorAll('audio')],status=document.getElementById('status'),volume=document.getElementById('volume');let requested=0;
function stopAll(){requested++;for(const a of players){a.pause();a.closest('article').classList.remove('playing')}status.textContent='已停止播放。'}
document.getElementById('stop').onclick=stopAll;
for(const audio of players){audio.volume=Number(volume.value);audio.addEventListener('play',()=>{for(const other of players)if(other!==audio)other.pause();audio.closest('article').classList.add('playing');status.textContent='正在试听：'+audio.getAttribute('aria-label')});audio.addEventListener('pause',()=>{audio.closest('article').classList.remove('playing');if(players.every(a=>a.paused))status.textContent='已暂停。'});audio.addEventListener('ended',()=>{audio.closest('article').classList.remove('playing');status.textContent='播放结束，可选择另一首比较。'});audio.addEventListener('error',()=>{status.textContent='音频读取失败，请使用新版 Chrome、Edge 或 Firefox 打开此页。'});}
volume.oninput=()=>players.forEach(a=>a.volume=Number(volume.value));
document.querySelectorAll('[data-track]').forEach(button=>button.onclick=async()=>{const token=++requested;const a=document.getElementById(button.dataset.track);for(const other of players)if(other!==a)other.pause();try{if(a.readyState<1){a.load();await new Promise((resolve,reject)=>{a.addEventListener('loadedmetadata',resolve,{once:true});a.addEventListener('error',reject,{once:true});})}if(token!==requested)return;a.currentTime=Math.min(Number(button.dataset.start),Math.max(0,a.duration-1));await a.play();}catch{status.textContent='无法播放，请尝试播放器上的播放按钮。'}});
</script></body></html>'''
(HERE/'试听.html').write_text(template.replace('__CARDS__','\n'.join(cards)),encoding='utf8')
lines=['# 第二轮音乐候选：仅试听，未替换游戏音乐','','核对日期：2026-09-16。六首作品的原始页面均标注 CC0 1.0。',
'许可原文：https://creativecommons.org/publicdomain/zero/1.0/','','原始文件位于 originals；仅调整音量、转 OGG 的完整试听副本位于 listening。',
'source.html 是对应来源页快照，manifest.json 记录下载链接、作者、原始文件 SHA-256、响度与峰值。','']
for t in tracks:
    lines.extend([f"## {t['group']} · {t['role']} · {t['title']}",f"- 作者：{t['author']}",f"- 来源：{t['source']}",f"- 授权：{t['license']}",f"- 完整时长：{t['duration']} 秒；试听响度：{t['listening_lufs']} LUFS",''])
lines.extend(['The Rush 原始 MP3 完整保留（包括原有 ID3）；Chill 保留作者 Alex McCulloch 署名。','选定后再接入场景切换、淡入淡出并验证循环点。'])
(HERE/'来源与授权.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print('Built',HERE/'试听.html')
