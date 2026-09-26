'use strict';
// New editable geometry diagram from numeric model vertices; no raster inputs.
const fs=require('node:fs'), path=require('node:path');
const sharp=require(require.resolve('sharp',{paths:['C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',__dirname]}));
const base=__dirname;
const audit=JSON.parse(fs.readFileSync(path.join(base,'stone-footprint-audit.json'),'utf8'));
const proposal=JSON.parse(fs.readFileSync(path.join(base,'proposal.json'),'utf8'));
const support=JSON.parse(fs.readFileSync(path.join(base,'foot-support-check.json'),'utf8'));
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(points){const p=points.map(p=>p.slice(0,2)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const l=[],u=[];for(const q of p){while(l.length>1&&cross(l.at(-2),l.at(-1),q)<=0)l.pop();l.push(q);}for(const q of p.reverse()){while(u.length>1&&cross(u.at(-2),u.at(-1),q)<=0)u.pop();u.push(q);}l.pop();u.pop();return l.concat(u);}
let s='<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="950" viewBox="0 0 1120 950"><defs><style>text{font-family:Segoe UI,Microsoft YaHei,sans-serif;fill:#263f40} .small{font-size:15px}.caption{font-size:18px}</style></defs><rect width="1120" height="950" fill="#f6f1e4"/><text x="38" y="42" font-size="26" font-weight="600">珊瑚转角 · 石龟脚底与路线的离线布局对照</text><text x="38" y="72" class="small">真实 c11 石龟 / 战斗缩放 0.65 / 全朝向外包 + 最不利朝向脚底投影 / 不修改游戏数据</text>';
for(const [row,idx] of [2,4].entries()){
 const stat=support.slots.find(x=>x.slot===idx);
 for(let col=0;col<2;col++){
  const ox=30+col*550,oy=99+row*358,w=530,h=338;
  const center=col?stat.candidate:stat.original, near=col?stat.nearestCandidateRoutePoint:stat.nearestOriginalRoutePoint;
  const scale=79,cx=ox+265,cy=oy+180;
  const xy=p=>[cx+(p[0]-center[0])*scale,cy+(p[1]-center[1])*scale];
  const distance=col?stat.candidateRouteDistance:stat.originalRouteDistance;
  const clearance=distance-audit.allYawSoleRadius;
  s+=`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="14" fill="#fffaf0" stroke="#d9d0bc"/><clipPath id="clip${idx}${col}"><rect x="${ox+5}" y="${oy+46}" width="${w-10}" height="230"/></clipPath><text x="${ox+18}" y="${oy+29}" class="caption" font-weight="600">第 ${idx+1} 站位 · ${col?'建议位置':'当前数据位置'} (${center[0].toFixed(3)}, ${center[1].toFixed(3)})</text><g clip-path="url(#clip${idx}${col})">`;
  for(let a=-4;a<=4;a++)s+=`<path d="M ${cx+a*scale} ${oy+46} V ${oy+278} M ${ox} ${cy+a*scale} H ${ox+w}" stroke="#eae3d3" stroke-width="1"/>`;
  const rp=proposal.unchangedRoute.map(p=>xy([p.x,p.z]).join(',')).join(' ');
  s+=`<polyline points="${rp}" fill="none" stroke="#e7c9a0" stroke-width="${1.38*scale}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${rp}" fill="none" stroke="#b34433" stroke-width="2.5"/>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${.995*scale}" fill="#90aea580" stroke="#395e5a" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${.9746471943161487*scale}" fill="none" stroke="#264b47" stroke-dasharray="4 4"/><circle cx="${cx}" cy="${cy}" r="${.8874670245539223*scale}" fill="none" stroke="#5b928c" stroke-width="1.5"/>`;
  const desired=Math.atan2(near[1]-center[1],near[0]-center[0]);
  const turn=desired-Math.atan2(audit.maxRadiusPoint[1],audit.maxRadiusPoint[0]);
  const co=Math.cos(turn),si=Math.sin(turn);
  for(const foot of audit.feet){
   const p=hull(foot.soleProjectionCocosAtScale065).map(p=>xy([center[0]+p[0]*co-p[1]*si,center[1]+p[0]*si+p[1]*co]).join(',')).join(' ');
   s+=`<polygon points="${p}" fill="${col?'#387c6e':'#b45c43'}" fill-opacity=".74" stroke="${col?'#24594d':'#804030'}" stroke-width=".7"/>`;
  }
  const pn=xy(near);
  s+=`<path d="M ${cx} ${cy} L ${pn[0]} ${pn[1]}" stroke="#212f38" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${cx}" cy="${cy}" r="4" fill="#212f38"/><circle cx="${pn[0]}" cy="${pn[1]}" r="4" fill="#b34433"/></g>`;
  s+=`<text x="${ox+18}" y="${oy+298}" class="small">距路线中心 ${distance.toFixed(4)} · 完整脚底${clearance<0?'侵入':'净空'} ${Math.abs(clearance).toFixed(4)}</text><text x="${ox+18}" y="${oy+323}" class="small">${col?'石台支撑：36 朝向 × 2068 点全部命中；近战半径 1.2 内':'按原点放置完整支撑台会切入路线中心，不能靠削台掩盖。'}</text>`;
 }
}
s+='<text x="38" y="846" class="small">红线：真实敌人路线中心；沙色宽带：视觉道路；虚线圆：完整脚底全朝向包络；实色小块：实际脚底投影。</text><text x="38" y="873" class="small">候选第三站位外移 0.4072，第五站位外移 0.3029；新位置距路线中心约 1.135，完整脚底净空约 0.160。</text><text x="38" y="900" class="small">全五台实际 FBX 支撑射线通过。原第四站位距路线 2.236，保留原坐标，需主代理评估远程/辅助用途。</text><text x="38" y="927" class="small">本图不是运行验收。角色动画、敌我接触、攻击覆盖及存档恢复需在同步布局数据后另验。</text></svg>';
fs.writeFileSync(path.join(base,'layout-comparison.svg'),s);
sharp(Buffer.from(s)).png().toFile(path.join(base,'layout-comparison.png')).then(()=>console.log('Generated editable comparison SVG + PNG from model coordinates.')).catch(e=>{console.error(e);process.exitCode=1;});
