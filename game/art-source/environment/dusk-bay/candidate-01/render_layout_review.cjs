'use strict';
// Original editable diagram generated only from authored route and actual model coordinates.
const fs=require('node:fs'),path=require('node:path');
const sharp=require(require.resolve('sharp',{paths:['C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',__dirname]}));
const report=JSON.parse(fs.readFileSync(path.join(__dirname,'layout-preflight.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'stone-footprint-audit.json'),'utf8'));
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(points){const p=points.map(p=>p.slice(0,2)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const l=[],u=[];for(const q of p){while(l.length>1&&cross(l.at(-2),l.at(-1),q)<=0)l.pop();l.push(q);}for(const q of p.reverse()){while(u.length>1&&cross(u.at(-2),u.at(-1),q)<=0)u.pop();u.push(q);}l.pop();u.pop();return l.concat(u);}
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000"><style>text{font-family:Segoe UI,Microsoft YaHei,sans-serif;fill:#2d3c47}.small{font-size:16px}.cell{font-size:18px}</style><rect width="1200" height="1000" fill="#f6eee4"/><text x="38" y="46" font-size="28" font-weight="600">薄暮海湾 · 原始五站位 / 当前石龟脚底 / 近战覆盖</text><text x="38" y="78" class="small">全部保持 core 的 level 3 原坐标 · 当前 c12b 石龟，战斗缩放 0.65 · 仅离线几何审查</text><rect x="30" y="100" width="1140" height="425" rx="16" fill="#fffbf3" stroke="#d9cdbb"/>';
const scale=48,xy=p=>[600+p[0]*scale,327+p[1]*scale];
for(let x=-11;x<=11;x++)svg+=`<path d="M ${600+x*scale} 112 V 513" stroke="#ece4d7"/>`;
for(let z=-4;z<=4;z++)svg+=`<path d="M 42 ${327+z*scale} H 1158" stroke="#ece4d7"/>`;
const rp=report.route.map(p=>xy([p.x,p.z]).join(',')).join(' ');
svg+=`<polyline points="${rp}" fill="none" stroke="#e7c99a" stroke-width="${1.38*scale}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${rp}" fill="none" stroke="#a74c45" stroke-width="3"/>`;
for(const row of report.slots){
 const center=[row.position.x,row.position.z],nearest=[row.nearestRoutePoint.x,row.nearestRoutePoint.z],c=xy(center),n=xy(nearest);
 const col=row.withinStoneBlockingRadius?'#3c887f':'#bd7a40';
 svg+=`<circle cx="${c[0]}" cy="${c[1]}" r="${1.2*scale}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="6 4"/><circle cx="${c[0]}" cy="${c[1]}" r="${.995*scale}" fill="#bbc8b5" stroke="#67776a" stroke-width="2"/><circle cx="${c[0]}" cy="${c[1]}" r="${audit.allYawSoleRadius*scale}" fill="none" stroke="#3f5954" stroke-width="1"/>`;
 const desired=Math.atan2(nearest[1]-center[1],nearest[0]-center[0]);
 const turn=desired-Math.atan2(audit.maxRadiusPoint[1],audit.maxRadiusPoint[0]),co=Math.cos(turn),si=Math.sin(turn);
 for(const foot of audit.feet){const ps=hull(foot.soleProjectionCocosAtScale065).map(p=>xy([center[0]+p[0]*co-p[1]*si,center[1]+p[0]*si+p[1]*co]).join(',')).join(' ');svg+=`<polygon points="${ps}" fill="#537d72" fill-opacity=".74"/>`;}
 svg+=`<path d="M ${c.join(' ')} L ${n.join(' ')}" stroke="${col}" stroke-width="1.5" stroke-dasharray="3 4"/><circle cx="${n[0]}" cy="${n[1]}" r="3" fill="#a74c45"/><text x="${c[0]}" y="${c[1]+7}" text-anchor="middle" font-size="22" font-weight="700">${row.slot+1}</text><text x="${c[0]}" y="${c[1]+77}" text-anchor="middle" class="small">(${center[0]}, ${center[1]})</text>`;
}
svg+='<text x="58" y="141" class="small">左侧入口 (-9,-1)</text><text x="928" y="490" class="small">贝壳终点 (9,1)</text><text x="38" y="559" class="small">红线 = 真实路线中心；沙色带 = 视觉道路；虚线圆 = 石龟基础阻挡半径 1.2；小块 = 最不利朝向实际脚底。</text>';
const xs=[50,153,350,545,740,955];
const headers=['站位','当前 X/Z','距路线中心','完整脚底净空','1.2 阻挡覆盖','覆盖路线长度'];
svg+='<rect x="30" y="583" width="1140" height="42" fill="#dddccf"/>';
headers.forEach((t,i)=>svg+=`<text x="${xs[i]}" y="610" class="cell" font-weight="600">${t}</text>`);
report.slots.forEach((r,i)=>{const y=625+i*43;svg+=`<rect x="30" y="${y}" width="1140" height="43" fill="${i%2?'#eee8de':'#fffbf3'}"/>`;const values=[String(r.slot+1),`(${r.position.x}, ${r.position.z})`,r.routeDistance.toFixed(6),r.fullSoleToRouteCenterClearance.toFixed(6),r.withinStoneBlockingRadius?'有':'无（原布局）',r.totalCoveredRouteLength.toFixed(6)];values.forEach((t,j)=>svg+=`<text x="${xs[j]}" y="${y+28}" class="cell">${t}</text>`);});
svg+='<text x="38" y="882" class="small">无路线中心/脚底冲突，无需移动提案。第 2、3 站位保留远程/辅助用途；未为全格近战可用而改路线。</text>';
svg+=`<text x="38" y="912" class="small">完整脚底全朝向半径 ${audit.allYawSoleRadius.toFixed(6)}；48 边石台内切半径 ${report.platformTopInradius.toFixed(6)}；承托余量 ${report.analyticFootSupportMargin.toFixed(6)}。</text>`;
const supportPath=path.join(__dirname,'foot-support-check.json');
if(fs.existsSync(supportPath)){const support=JSON.parse(fs.readFileSync(supportPath,'utf8'));svg+=`<text x="38" y="942" class="small">真实 FBX：${support.slots.reduce((a,r)=>a+r.surfaceRays,0).toLocaleString('en-US')} 条全朝向脚底支撑射线；未命中样本 ${support.slots.reduce((a,r)=>a+r.unsupportedSamples.length,0)}。动作和实际战斗仍待运行验收。</text>`;}
else svg+='<text x="38" y="942" class="small">此图是数值预检；最终仍需实际回导 FBX 支撑射线，以及角色动画/敌我接触和运行验收。</text>';
svg+='</svg>';
fs.writeFileSync(path.join(__dirname,'layout-review.svg'),svg);
sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'layout-review.png')).then(()=>console.log('Wrote original editable layout SVG and PNG.')).catch(e=>{console.error(e);process.exitCode=1;});
