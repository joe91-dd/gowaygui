'use strict';
// Pure in-memory slot5 comparison through the existing real service simulator. No production/shared-build writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..');
const data=require(path.join(root,'game/.test-build/core/data.js'));
const battle=require(path.join(root,'game/.test-build/core/battle.js'));
const clone=x=>JSON.parse(JSON.stringify(x));
const ranges=Object.fromEntries(Object.entries(data.ROLES).map(([id,r])=>[id,r.range]));
assert.deepEqual(ranges,{stone:1.2,spike:4.8,crystal:4.6,leaf:4.5,bubble:4.6});
assert.equal(battle.BATTLE_RULES.encourageRange,4.5);assert.equal(battle.BATTLE_RULES.shareRange,4.5);
const originalReference=data.LEVELS[4].slots,original=clone(originalReference);
assert.deepEqual(original,[{x:-5,z:1},{x:-1,z:1},{x:3,z:1},{x:1,z:-3},{x:6,z:-1}]);
const levelsBefore=clone(data.LEVELS),rulesBefore=clone(battle.BATTLE_RULES),rolesBefore=clone(data.ROLES);
const variants=[{id:'original',slot5:{x:6,z:-1}},{id:'offline-art-candidate',slot5:{x:6.62,z:-1.31}}];
const compiledFiles=['core/data.js','core/battle.js','core/game.js','core/save.js','core/battleValidation.js','core/random.js','core/fusion.js','platform/storage.js'];
const hashes=()=>Object.fromEntries(compiledFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'game/.test-build',f))).digest('hex')]));
const sourceSha256=hashes();
let observed=new Map();
const actualStep=battle.stepBattle;
battle.stepBattle=(state,dt)=>{
  const result=actualStep(state,dt);
  if(state.status!=='fighting'){
    const units=state.units.map(u=>({role:u.role,slot:u.slot+1,x:u.x,z:u.z,range:u.range,alive:u.alive,hp:u.hp,maxHp:u.maxHp,attackCount:u.attackCount,skillActivations:{...u.skillActivations}}));
    const totalHp=units.reduce((s,u)=>s+u.hp,0),totalMaxHp=units.reduce((s,u)=>s+u.maxHp,0);
    observed.set(state.levelId+'/'+state.wave,{balanceVersion:state.balanceVersion,units,allyHpRatio:totalHp/totalMaxHp,downedRoles:units.filter(u=>!u.alive).map(u=>u.role)});
  }
  return result;
};
const {simulateChapter}=require(path.join(root,'game/tools/simulate-chapter.cjs'));
const {SEEDS}=require(path.join(root,'game/tools/simulate-boss-balance.cjs'));
assert.deepEqual(SEEDS,[731,913,2027,4093,6553,9173,12037,19391]);
const results=[];
try{
  for(const variant of variants){
    data.LEVELS[4].slots=original.map((p,i)=>i===4?{...variant.slot5}:{...p});
    assert.deepEqual(data.LEVELS.slice(0,4),levelsBefore.slice(0,4),'Never mutate the shared original slot array used by other levels.');
    const runs=[];
    for(const seed of SEEDS){
      observed=new Map();
      const report=simulateChapter(seed).report;
      const level=report.levels.find(l=>l.levelId===4);
      assert.ok(level&&!level.notAttempted,'Do not inject an unlock if preceding progression fails');
      const waves=level.waves.map(w=>({...w,observation:observed.get('4/'+w.wave)}));
      assert.ok(waves.every(w=>w.observation.balanceVersion===2));
      const activations={},attacks={};
      for(const wave of waves)for(const unit of wave.observation.units){
        attacks[unit.role]=(attacks[unit.role]||0)+unit.attackCount;
        for(const [skill,count]of Object.entries(unit.skillActivations))activations[skill]=(activations[skill]||0)+count;
      }
      runs.push({seed,earlierLevels:report.levels.filter(l=>l.levelId<4),level:{...level,waves},activations,attacks,
        finalWaveAllyHpRatio:waves.at(-1).observation.allyHpRatio,downedWaves:waves.filter(w=>w.observation.downedRoles.length).length,
        boss:waves.at(-1).boss,finalRevision:report.finalSave.revision,finalGold:report.finalSave.gold});
      console.log(`${variant.id} seed${seed}: ${level.withPreparationSeconds}s core${level.coreHealth} bossKilled=${waves.at(-1).boss?.defeated} hp=${(waves.at(-1).observation.allyHpRatio*100).toFixed(2)}%`);
    }
    results.push({variant,runs});
  }
}finally{data.LEVELS[4].slots=originalReference;battle.stepBattle=actualStep;}
assert.strictEqual(data.LEVELS[4].slots,originalReference);
assert.deepEqual(data.LEVELS,levelsBefore);assert.deepEqual(data.ROLES,rolesBefore);assert.deepEqual(battle.BATTLE_RULES,rulesBefore);
assert.deepEqual(hashes(),sourceSha256,'Shared compiled files changed during the experiment; reject mixed provenance');
const stat=xs=>({min:Math.min(...xs),max:Math.max(...xs),mean:xs.reduce((a,b)=>a+b,0)/xs.length});
const summary=results.map(r=>({variant:r.variant.id,seeds:r.runs.length,victories:r.runs.filter(v=>v.level.victory).length,bossKills:r.runs.filter(v=>v.boss?.defeated).length,bossLeaks:r.runs.filter(v=>v.boss?.leaked).length,seconds:stat(r.runs.map(v=>v.level.withPreparationSeconds)),coreHealth:stat(r.runs.map(v=>v.level.coreHealth)),finalWaveAllyHpRatio:stat(r.runs.map(v=>v.finalWaveAllyHpRatio)),downedWaves:r.runs.reduce((s,v)=>s+v.downedWaves,0),attackMean:Object.fromEntries(Object.keys(data.ROLES).map(role=>[role,stat(r.runs.map(v=>v.attacks[role]||0)).mean])),skills:Object.fromEntries(['encourage','share','greatHeal','bubbleRing','root','shredArmor','weaken'].map(skill=>[skill,r.runs.reduce((s,v)=>s+(v.activations[skill]||0),0)]))}));
const paired=SEEDS.map(seed=>{
  const a=results[0].runs.find(r=>r.seed===seed),b=results[1].runs.find(r=>r.seed===seed);
  assert.deepEqual(a.earlierLevels,b.earlierLevels,'Only level5 geometry is allowed to differ');
  return{seed,secondsBefore:a.level.withPreparationSeconds,secondsAfter:b.level.withPreparationSeconds,secondsDelta:b.level.withPreparationSeconds-a.level.withPreparationSeconds,coreBefore:a.level.coreHealth,coreAfter:b.level.coreHealth,bossBefore:a.boss.defeated,bossAfter:b.boss.defeated,hpBefore:a.finalWaveAllyHpRatio,hpAfter:b.finalWaveAllyHpRatio,hpDelta:b.finalWaveAllyHpRatio-a.finalWaveAllyHpRatio};
});
const output=fs.mkdtempSync(path.join(__dirname,'slot5-comparison-'));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),scope:'Only levelId4 slot5 old versus offline art candidate; real current v2 service, fresh progression, all earlier levels exactly equal. Not a population win-rate estimate or an optimal strategy.',sourceSha256,ranges,rules:rulesBefore,seeds:SEEDS,originalSlots:original,route:levelsBefore[4].route,summary,paired,results,limits:['Fixed original simulateChapter formation: spike1 stone2 crystal3 leaf4 bubble5; not optimal and not the root live roster.','Fresh real service progression, no injected stats/unlocks, ads, retries or fusion decisions.','HP is wave-end weighted remaining health including downed units as zero; not minimum throughout combat.','The coordinate move changes range/nearest-ally relationships; this is not a legacy save migration test.'],sharedCompiledFilesUnchanged:true,originalSlotReferenceRestored:true};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const f=(v,n=2)=>v.toFixed(n),s=stats=>`${f(stats.mean)} (${f(stats.min)}–${f(stats.max)})`;
let md='# 第五关位置 5 离线候选：v2 八种子比较\n\n仅在进程内将 levelId4 的位置 5 从 (6,-1) 改为 (6.62,-1.31)，使用当前 v2 范围；路线、其他站位、强度、技能、服务完全不改。复用原 simulateChapter，前四关逐种子完整结果相等；每波恢复一致性、重复结算断言通过。生产/运行资源/共享编译未写入。\n\n';
md+='| 方案 | 通关 | 首领击败 / 漏过 | 含准备秒数平均（区间） | 核心平均（区间） | 末波友军血量平均（区间） | 有倒地波数 / 96 |\n|---|---|---|---|---|---|---|\n';
for(const row of summary)md+=`| ${row.variant} | ${row.victories}/8 | ${row.bossKills}/8 / ${row.bossLeaks}/8 | ${s(row.seconds)} | ${s(row.coreHealth)} | ${s(Object.fromEntries(Object.entries(row.finalWaveAllyHpRatio).map(([k,v])=>[k,v*100])))}% | ${row.downedWaves}/96 |\n`;
md+='\n| 种子 | 秒数 原→候选 | 核心 原→候选 | 首领击败 原→候选 | 末波血量 原→候选 |\n|---|---|---|---|---|\n';
for(const p of paired)md+=`| ${p.seed} | ${p.secondsBefore}→${p.secondsAfter} | ${p.coreBefore}→${p.coreAfter} | ${p.bossBefore}→${p.bossAfter} | ${f(p.hpBefore*100)}%→${f(p.hpAfter*100)}% |\n`;
md+='\n## 角色与技能\n\n普攻是每关八种子平均；技能是八次关卡累计激活数。\n\n| 方案 | 各角色普攻平均 | 技能激活总数 |\n|---|---|---|\n';
for(const row of summary)md+=`| ${row.variant} | ${Object.entries(row.attackMean).map(([k,v])=>k+':'+f(v)).join('；')} | ${Object.entries(row.skills).map(([k,v])=>k+':'+v).join('；')} |\n`;
md+='\n## 适用边界\n\n固定模拟器阵型为刺刺1/石头2/水晶3/叶子4/泡泡5，不能冒充最优阵型或主线程实战阵容。完整 JSON 保留各波个体 HP、坐标、射程、普攻和全部技能次数。采用新点仍需真实 FBX 支撑/道路检查、Cocos 接触与视线审查，旧 combat 坐标迁移必须单独处理。全章实际服务存档只在 MemoryStorage，未写玩家存档。\n\n重跑 `node game/art-source/environment/boss-bay/candidate-01/compare_slot5.cjs`，只读取根代理已编译的当前 v2 core，每次写新目录，不覆盖历史报告。\n';
fs.writeFileSync(path.join(output,'README.md'),md);console.log(JSON.stringify({output,summary,paired},null,2));
