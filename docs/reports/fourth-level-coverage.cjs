'use strict';
// Historical original-range audit. Frozen v1 fixture only; current production ranges are deliberately irrelevant.
// Every rerun writes a fresh history-replays directory and verifies the old recorded observations.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const {createV1Runtime,replayDirectory}=require('./historical-coverage-runtime.cjs');
const historical=createV1Runtime(),{data,battle}=historical;
const originalReport=JSON.parse(fs.readFileSync(path.join(__dirname,'fourth-level-coverage.json'),'utf8'));
const output=replayDirectory('fourth-baseline-v1');
const level = data.LEVELS.find(l => l.id === 3);
assert.deepEqual(level.slots.map(p => [p.x,p.z]), [[-5,1],[-1,1],[3,1],[1,-3],[6,-1]], 'This diagnostic documents the frozen original fourth-level layout.');
const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const sum = xs => xs.reduce((a,b) => a+b,0);
let cumulative = 0;
const segments = level.route.slice(1).map((b,i) => {
  const a = level.route[i], length = dist(a,b), start = cumulative; cumulative += length;
  return { a,b,length,start,end:cumulative,dx:(b.x-a.x)/length,dz:(b.z-a.z)/length };
});
function position(s) {
  const q = segments.find(g => s <= g.end + 1e-10) || segments.at(-1);
  return {x:q.a.x+q.dx*(s-q.start),z:q.a.z+q.dz*(s-q.start)};
}
function covered(p,radius) {
  const intervals = [];
  for (const q of segments) {
    const ax=q.a.x-p.x, az=q.a.z-p.z, center=-(ax*q.dx+az*q.dz);
    const discriminant=radius*radius-(ax*ax+az*az-center*center);
    if (discriminant < -1e-10) continue;
    const h=Math.sqrt(Math.max(0,discriminant)), lo=Math.max(0,center-h), hi=Math.min(q.length,center+h);
    if (lo<=hi+1e-10) {
      const current=[q.start+lo,q.start+hi], previous=intervals.at(-1);
      if (previous && current[0]<=previous[1]+1e-9) previous[1]=Math.max(previous[1],current[1]);
      else intervals.push(current);
    }
  }
  return {radius,intervals,length:sum(intervals.map(a=>a[1]-a[0]))};
}
function nearest(p) {
  return segments.map(q=>{
    const t=Math.max(0,Math.min(q.length,(p.x-q.a.x)*q.dx+(p.z-q.a.z)*q.dz));
    const point={x:q.a.x+q.dx*t,z:q.a.z+q.dz*t};
    return {distance:dist(p,point),point,s:q.start+t};
  }).sort((a,b)=>a.distance-b.distance)[0];
}
const graph = radius => level.slots.map((p,i)=>({slot:i+1,otherSlots:level.slots.flatMap((q,j)=>i!==j&&dist(p,q)<=radius+1e-10?[j+1]:[])}));
const footSource=JSON.parse(fs.readFileSync(path.join(root,'game/art-source/environment/dusk-bay/candidate-01/proposal.json'),'utf8'));
const footRadius=footSource.fullNearGroundSoleRadius, platformRadius=footSource.platformContinuousTopRadius;
const slots=level.slots.map((p,i)=>({slot:i+1,position:p,nearestRoute:nearest(p),stone:covered(p,data.ROLES.stone.range),crystal:covered(p,data.ROLES.crystal.range),crystalReach:covered(p,data.ROLES.crystal.range+.3),spike:covered(p,data.ROLES.spike.range),spikeReach:covered(p,data.ROLES.spike.range+.3)}));
const originalFirstBlock=position(slots[0].stone.intervals[0][0]);
const proposals=[
  {id:'front-margin',slot:1,to:{x:-3.8,z:.6}},
  {id:'front-smaller',slot:1,to:{x:-3.85,z:.6}},
  {id:'backline-smaller',slot:2,to:{x:-1.6,z:.85}},
  {id:'lower-heal-link',slot:4,to:{x:-1,z:-3}},
].map(p=>{
  const replacement=level.slots.map((q,i)=>i===p.slot-1?p.to:q);
  const near=nearest(p.to), stone=covered(p.to,1.2);
  const first=stone.intervals.length?position(stone.intervals[0][0]):null;
  return {...p,from:level.slots[p.slot-1],displacement:dist(p.to,level.slots[p.slot-1]),nearestRoute:near,footCenterlineGap:near.distance-footRadius,platformCenterlineGap:near.distance-platformRadius,stone,firstStoneContact:first,firstStoneContactToSlot2:first?dist(first,replacement[1]):null,originalFirstBlockToNewSlot:dist(originalFirstBlock,p.to),pairDistances:replacement.map(q=>dist(q,p.to)),healingReachableFromEach:replacement.map((q,i)=>({slot:i+1,otherSlots:replacement.flatMap((r,j)=>i!==j&&dist(q,r)<=4.3?[j+1]:[])}))};
});
function input(role,slot,skills=data.ROLES[role].starters) {
  const id=role+'-'+(slot+1);
  return {id,slot,level:1,turtle:{id:'t-'+id,role,skills:[...skills],innate:{attack:80,health:80,defense:80,growth:100},training:{attack:0,health:0,defense:0,growth:0}}};
}
const initialInputs=[input('stone',0),input('crystal',1)];
const simulation=battle.createBattle(3,2,initialInputs,{seed:20260908});
let firstBlocked=null,firstCrystalAttack=null,firstOutsideRangeSecondary=null;
while(simulation.status==='fighting' && simulation.tick<2400) {
  battle.stepBattle(simulation,.05);
  const blocker=simulation.units.find(u=>u.role==='stone'), caster=simulation.units.find(u=>u.role==='crystal');
  if (!firstBlocked) {
    const enemy=simulation.enemies.find(e=>e.alive&&e.blockedBy===blocker.id);
    if(enemy)firstBlocked={tick:simulation.tick,time:simulation.elapsed,enemyId:enemy.id,kind:enemy.kind,x:enemy.x,z:enemy.z,s:enemy.distance,stoneDistance:dist(enemy,blocker),crystalDistance:dist(enemy,caster),crystalRange:caster.range,crystalAttackCount:caster.attackCount};
  }
  for(const event of battle.getBattleEvents(simulation)) {
    if(event.sourceId!==caster.id)continue;
    if(!firstCrystalAttack && event.type==='attack')firstCrystalAttack={...event};
    if(!firstOutsideRangeSecondary && event.type==='damage'&&event.secondary){
      const target=simulation.enemies.find(e=>e.id===event.targetId);
      if(target && dist(caster,target)>caster.range)firstOutsideRangeSecondary={...event,targetDistance:dist(caster,target),targetBlockedBy:target.blockedBy||null};
    }
  }
}
assert.equal(firstBlocked.tick,47);
assert.equal(firstBlocked.crystalAttackCount,0);
assert(firstBlocked.crystalDistance>4.5 && firstBlocked.crystalDistance<4.8);
function healingCase(name,leafSlot,skills,injuredSlots,ratio,deadSlot=null) {
  const roles=['stone','crystal','spike','bubble'].values();
  const inputs=level.slots.map((_,i)=>i===leafSlot?input('leaf',i,skills):input(roles.next().value,i));
  const s=battle.createBattle(3,1,inputs,{seed:20260908});
  // Controlled one-tick friendly-only stimulus, not an actual wave or persisted checkpoint.
  for(const spawn of s.spawns)spawn.time+=1000;
  for(const unit of s.units)if(injuredSlots.includes(unit.slot+1))unit.hp=unit.maxHp*ratio;
  if(deadSlot!==null){const unit=s.units[deadSlot-1];unit.hp=0;unit.alive=false;}
  const before=s.units.map(u=>({slot:u.slot+1,hp:u.hp,maxHp:u.maxHp,alive:u.alive}));
  battle.stepBattle(s,.05);
  const events=battle.getBattleEvents(s), leaf=s.units[leafSlot];
  return {name,leafSlot:leafSlot+1,skills,stimulus:{injuredSlots,ratio,deadSlot,spawnDelaySeconds:1000,ticks:1},before,after:s.units.map(u=>({slot:u.slot+1,hp:u.hp,maxHp:u.maxHp,alive:u.alive})),healEvents:events.filter(e=>e.type==='heal'),skillActivations:leaf.skillActivations,cooldowns:leaf.cooldowns};
}
const healCases=[
  healingCase('leaf4_starter_cannot_heal_other_slots',3,['reach','doubleHeal'],[1,2,3,5],.5),
  healingCase('leaf2_starter_heals_slot1_and_slot3',1,['reach','doubleHeal'],[1,3],.5),
  healingCase('leaf4_greatHeal_global_below60',3,['reach','doubleHeal','greatHeal'],[1,2,3,5],.5),
  healingCase('leaf4_greatHeal_not_at_exact60',3,['reach','doubleHeal','greatHeal'],[1,2,3,5],.6),
  healingCase('leaf4_greatHeal_does_not_revive',3,['reach','doubleHeal','greatHeal'],[1,2,3,5],.5,1),
];
assert.equal(healCases[0].healEvents.length,0);
assert.equal(healCases[1].healEvents.length,2);
assert.equal(healCases[2].healEvents.length,4);
assert.equal(healCases[2].skillActivations.greatHeal,1);
assert.equal(healCases[2].cooldowns.greatHeal,561);
assert.equal(healCases[3].skillActivations.greatHeal,undefined);
assert.equal(healCases[4].after[0].alive,false);
assert.equal(healCases[4].after[0].hp,0);
const footFile='game/art-source/environment/dusk-bay/candidate-01/proposal.json';
const footSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,footFile))).digest('hex');
assert.equal(footSha256,originalReport.sourceSha256[footFile],'Historical foot proposal changed');
const report={schemaVersion:2,scope:'Historical original-range levelId 3 replay from frozen balance-v1 fixtures; not current production rules or runtime acceptance.',historicalRuntime:historical.provenance,sourceSha256:{...historical.sourceSha256,[footFile]:footSha256},originalAuditSourceSha256:originalReport.sourceSha256,levelId:3,route:level.route,routeLength:cumulative,segments,slots,pairDistances:level.slots.map(p=>level.slots.map(q=>dist(p,q))),healGraph4:graph(4),healGraph43:graph(4.3),healGraph45:graph(4.5),auraGraph3:graph(3),stoneFootRadius:footRadius,platformRadius,originalFirstBlock,originalFirstBlockDistances:level.slots.map(p=>dist(p,originalFirstBlock)),proposals,coreReproduction:{inputs:initialInputs,seed:20260908,levelId:3,wave:2,dt:.05,firstBlocked,firstCrystalAttack,firstOutsideRangeSecondary,observedSingleSample:{tick:simulation.tick,status:simulation.status,coreHealth:simulation.coreHealth,kills:simulation.kills,leaked:simulation.leaked,units:simulation.units.map(u=>({id:u.id,alive:u.alive,hp:u.hp,attackCount:u.attackCount}))}},healingDiagnostics:healCases};
const comparedFields=['levelId','route','routeLength','segments','slots','pairDistances','healGraph4','healGraph43','healGraph45','auraGraph3','stoneFootRadius','platformRadius','originalFirstBlock','originalFirstBlockDistances','proposals','coreReproduction','healingDiagnostics'];
for(const field of comparedFields)assert.deepEqual(report[field],originalReport[field],`Historical ${field} no longer reproduces`);
report.historicalComparison={originalFile:'docs/reports/fourth-level-coverage.json',allMatched:true,comparedFields,note:'Original audit used the pre-adoption v2-marker build; frozen v1 has identical old range behavior for these measured observations. Runtime provenance is explicitly different, not claimed byte-identical.'};
fs.writeFileSync(path.join(output,'fourth-level-coverage.json'),JSON.stringify(report,null,2)+'\n');

// Original vector diagram authored from these numeric outputs, not raster editing.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const scale=47;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1240" viewBox="0 0 1400 1240"><style>text{font-family:Microsoft YaHei,Segoe UI,sans-serif;fill:#253a45}.note{font-size:20px}.tiny{font-size:17px}.label{font-size:23px;font-weight:600}</style><rect width="1400" height="1240" fill="#f6f0e6"/><text x="42" y="48" font-size="30" font-weight="700">薄暮海湾 · 原站位覆盖与未实施候选</text><text x="42" y="80" class="note">levelId 3；站位按界面 1–5 编号。仅诊断；未修改关卡、场景或存档。</text>';
function panel(y,title) {
  const xy=p=>[700+p.x*scale,y+(y>600?222:240)+p.z*scale];
  svg+=`<rect x="28" y="${y}" width="1344" height="470" rx="16" fill="#fffdf7" stroke="#d9cfbf"/><text x="48" y="${y+36}" class="label">${title}</text>`;
  for(let x=-11;x<=11;x++)svg+=`<path d="M ${700+x*scale} ${y+70} V ${y+446}" stroke="#eee8dc"/>`;
  for(let z=-3;z<=3;z++)svg+=`<path d="M 100 ${y+240+z*scale} H 1300" stroke="#eee8dc"/>`;
  const points=level.route.map(p=>xy(p).join(',')).join(' ');
  svg+=`<polyline points="${points}" fill="none" stroke="#eddbb8" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="#846e53" stroke-width="3"/>`;
  level.route.forEach((p,i)=>{const q=xy(p);svg+=`<text x="${q[0]-9}" y="${q[1]+29}" class="tiny">${'ABCDEFG'[i]}</text>`;});
  return xy;
}
function station(xy,p,i,color='#4a7c73',dashed=false){const c=xy(p);svg+=`<circle cx="${c[0]}" cy="${c[1]}" r="${.7*scale}" fill="#f7f3e6" stroke="${color}" stroke-width="3" ${dashed?'stroke-dasharray="5 4"':''}/><text x="${c[0]}" y="${c[1]+8}" text-anchor="middle" class="label">${esc(i)}</text>`;}
let xy=panel(102,'1  普攻治疗：4.0 和初始远望 4.3 的友军连接完全相同');
for(const row of graph(4.3))for(const j of row.otherSlots)if(j>row.slot){const a=xy(level.slots[row.slot-1]),b=xy(level.slots[j-1]);svg+=`<path d="M ${a.join(' ')} L ${b.join(' ')}" stroke="#548574" stroke-width="5"/><text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-12}" text-anchor="middle" class="note">${dist(level.slots[row.slot-1],level.slots[j-1]).toFixed(3)}</text>`;}
for(const j of [1,2]){const a=xy(level.slots[3]),b=xy(level.slots[j]);svg+=`<path d="M ${a.join(' ')} L ${b.join(' ')}" stroke="#bf675b" stroke-width="2" stroke-dasharray="7 6"/><text x="${(a[0]+b[0])/2+(j===1?-38:45)}" y="${(a[1]+b[1])/2}" text-anchor="middle" class="tiny">4.472</text>`;}
level.slots.forEach((p,i)=>station(xy,p,i+1,i===3?'#bc615b':'#4a7c73'));
svg+='<text x="50" y="594" class="note">绿线 = 可直接治疗；红虚线 = 超过 4.3。图连通不代表治疗可接力。3 格鼓劲 / 分担无任何友军连接。</text>';
xy=panel(622,'2  前排拦截：位置 2 的法师圆形射程，以及位置 1 移动候选');
const caster=xy(level.slots[1]);
svg+=`<circle cx="${caster[0]}" cy="${caster[1]}" r="${4*scale}" fill="#75aeca" fill-opacity=".07" stroke="#448fb2" stroke-width="3" stroke-dasharray="7 5"/>`;
level.slots.forEach((p,i)=>station(xy,p,i+1));
const old=xy(originalFirstBlock),cur=xy(level.slots[0]),next=xy(proposals[0].to),contact=xy(proposals[0].firstStoneContact);
svg+=`<circle cx="${cur[0]}" cy="${cur[1]}" r="${1.2*scale}" fill="none" stroke="#bf675b" stroke-width="2"/><circle cx="${next[0]}" cy="${next[1]}" r="${1.2*scale}" fill="none" stroke="#52845c" stroke-width="2"/><path d="M ${cur.join(' ')} L ${next.join(' ')}" stroke="#52845c" stroke-width="3" stroke-dasharray="4 4"/><path d="M ${old.join(' ')} L ${caster.join(' ')}" stroke="#bf675b" stroke-width="2"/><path d="M ${contact.join(' ')} L ${caster.join(' ')}" stroke="#52845c" stroke-width="2"/><circle cx="${old[0]}" cy="${old[1]}" r="7" fill="#bf675b"/><circle cx="${contact[0]}" cy="${contact[1]}" r="7" fill="#52845c"/>`;
station(xy,proposals[0].to,'1′','#52845c',true);
svg+='<text x="46" y="1105" class="note">红点：原最早拦截点 → 法师 4.586844（超过 4；也超过远望 4.3）。</text><text x="46" y="1138" class="note">绿点：未实施候选 1′ (-3.8, 0.6) → 法师 3.879297；路线净距 1.164870，仍在石龟 1.2 阻挡内。</text><text x="46" y="1171" class="note">蓝虚线：法师 4 格；细圆：石龟 1.2 格。候选需要另做场景平台、存档兼容与全波平衡验证。</text><text x="46" y="1204" class="tiny">道路仅示意中心及次序，无沙路真实宽度；绿候选未经过最终地形回导。原脚底包络用于解析净距审查。</text></svg>';
fs.writeFileSync(path.join(output,'fourth-level-coverage.svg'),svg);
const sharp=require(require.resolve('sharp',{paths:[process.env.SHARP_ROOT || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',__dirname]}));
sharp(Buffer.from(svg)).png().toFile(path.join(output,'fourth-level-coverage.png')).then(()=>console.log(JSON.stringify({output,historicalComparison:report.historicalComparison,firstBlocked,firstCrystalAttack,firstOutsideRangeSecondary},null,2))).catch(e=>{console.error(e);process.exitCode=1;});
