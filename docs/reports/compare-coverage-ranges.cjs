'use strict';
// Exact replay of the archived pre-adoption comparison. Current production and shared .test-build are not loaded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createComparisonRuntime,replayDirectory}=require('./historical-coverage-runtime.cjs');
const historical=createComparisonRuntime(),{data,battle}=historical;
const output=replayDirectory('ranges-baseline-v2');
const clone=v=>JSON.parse(JSON.stringify(v));
const baseline={roleRanges:Object.fromEntries(Object.entries(data.ROLES).map(([id,r])=>[id,r.range])),encourageRange:battle.BATTLE_RULES.encourageRange,shareRange:battle.BATTLE_RULES.shareRange};
assert.deepEqual(baseline,{roleRanges:{stone:1.2,spike:4.5,crystal:4,leaf:4,bubble:4},encourageRange:3,shareRange:3},'Run this comparison only against the frozen baseline compiled core.');
const variants=[{id:'baseline',...clone(baseline)},{id:'range-candidate',roleRanges:{stone:1.2,spike:4.8,crystal:4.6,leaf:4.5,bubble:4.6},encourageRange:4.5,shareRange:4.5}];
const unchangedLevels=JSON.stringify(data.LEVELS);
let waveObservations=new Map();
const actualStep=battle.stepBattle;
battle.stepBattle=function(state,dt){
  const result=actualStep(state,dt);
  if(state.status!=='fighting'){
    const units=state.units.map(u=>({role:u.role,slot:u.slot+1,level:u.level,range:u.range,alive:u.alive,hp:u.hp,maxHp:u.maxHp,hpRatio:u.hp/u.maxHp,attackCount:u.attackCount,skillActivations:{...u.skillActivations}}));
    const hp=units.reduce((s,u)=>s+u.hp,0),maxHp=units.reduce((s,u)=>s+u.maxHp,0);
    waveObservations.set(state.levelId+'/'+state.wave,{balanceVersion:state.balanceVersion,units,allyHp:hp,allyMaxHp:maxHp,allyHpRatio:hp/maxHp,downedRoles:units.filter(u=>!u.alive).map(u=>u.role),leafBasicCount:units.filter(u=>u.role==='leaf').reduce((s,u)=>s+u.attackCount,0),greatHealActivations:units.reduce((s,u)=>s+(u.skillActivations.greatHeal||0),0),encourageActivations:units.reduce((s,u)=>s+(u.skillActivations.encourage||0),0),shareActivations:units.reduce((s,u)=>s+(u.skillActivations.share||0),0)});
  }
  return result;
};
// Load only after observation wrapper; simulator still invokes the original production simulation unchanged.
const {simulateChapter}=historical.load('game/tools/simulate-chapter.cjs');
const {SEEDS}=historical.load('game/tools/simulate-boss-balance.cjs');
assert.deepEqual(SEEDS,[731,913,2027,4093,6553,9173,12037,19391]);
const beforeHashes=clone(historical.sourceSha256);
const stats=values=>values.length?{min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length}:null;
function summarize(runs){return data.LEVELS.map(level=>{
  const rows=runs.map(r=>r.levels.find(l=>l.levelId===level.id)).filter(r=>r&&!r.notAttempted);
  const waves=rows.flatMap(r=>r.waves);
  return {levelId:level.id,name:level.name,seeds:SEEDS.length,attempted:rows.length,victories:rows.filter(r=>r.victory).length,secondsWithPreparation:stats(rows.map(r=>r.withPreparationSeconds)),combatSeconds:stats(rows.map(r=>r.combatSeconds)),coreHealth:stats(rows.map(r=>r.coreHealth)),targetSeconds:level.targetSeconds,targetHits:rows.filter(r=>r.durationMeetsTarget).length,finalWaveAllyHpRatio:stats(rows.map(r=>r.waves.at(-1).observation.allyHpRatio)),allWaveEndAllyHpRatio:stats(waves.map(w=>w.observation.allyHpRatio)),wavesWithDowns:waves.filter(w=>w.observation.downedRoles.length).length,totalWaves:waves.length,leafBasicCount:stats(rows.map(r=>r.waves.reduce((s,w)=>s+w.observation.leafBasicCount,0))),greatHealActivations:rows.reduce((s,r)=>s+r.waves.reduce((a,w)=>a+w.observation.greatHealActivations,0),0),encourageActivations:rows.reduce((s,r)=>s+r.waves.reduce((a,w)=>a+w.observation.encourageActivations,0),0),shareActivations:rows.reduce((s,r)=>s+r.waves.reduce((a,w)=>a+w.observation.shareActivations,0),0)};
});}
const results=[];
try{
  for(const variant of variants){
    for(const [role,range]of Object.entries(variant.roleRanges))data.ROLES[role].range=range;
    battle.BATTLE_RULES.encourageRange=variant.encourageRange;
    battle.BATTLE_RULES.shareRange=variant.shareRange;
    const runs=[];
    for(const seed of SEEDS){
      waveObservations=new Map();
      const actual=simulateChapter(seed).report;
      const levels=actual.levels.map(level=>level.notAttempted?level:{...level,waves:level.waves.map(w=>{
        const observation=waveObservations.get(level.levelId+'/'+w.wave);
        assert(observation,'Missing completed wave observation');
        assert.equal(observation.balanceVersion,2,'Candidate must affect newly-created version 2 battles');
        return {...w,observation};
      })});
      runs.push({seed,initial:actual.initial,description:actual.description,levels,finalRevision:actual.finalSave.revision,finalGold:actual.finalSave.gold,finalStamina:actual.finalSave.stamina,unlockedLevel:actual.finalSave.unlockedLevel});
      process.stdout.write(`${variant.id} seed ${seed}: ${levels.map(l=>`${l.levelId}:${l.notAttempted?'skip':(l.victory?'win':'loss')+' '+l.withPreparationSeconds+'s core'+l.coreHealth}`).join('; ')}\n`);
    }
    results.push({variant,runs,summary:summarize(runs)});
  }
}finally{
  for(const [role,range]of Object.entries(baseline.roleRanges))data.ROLES[role].range=range;
  battle.BATTLE_RULES.encourageRange=baseline.encourageRange;
  battle.BATTLE_RULES.shareRange=baseline.shareRange;
  battle.stepBattle=actualStep;
}
assert.equal(JSON.stringify(data.LEVELS),unchangedLevels,'Never change route, slots, waves, difficulty or other level data.');
assert.deepEqual(Object.fromEntries(Object.entries(data.ROLES).map(([id,r])=>[id,r.range])),baseline.roleRanges);
assert.deepEqual(results,historical.originalReport.results,'Every historical seed, wave, HP, skill activation, reward and service result must match the archived comparison.');
const paired=data.LEVELS.map(level=>{
  const rows=SEEDS.map(seed=>{
    const a=results[0].runs.find(r=>r.seed===seed).levels.find(l=>l.levelId===level.id),b=results[1].runs.find(r=>r.seed===seed).levels.find(l=>l.levelId===level.id);
    if(!a||!b||a.notAttempted||b.notAttempted)return{seed,paired:false};
    return{seed,paired:true,baselineVictory:a.victory,candidateVictory:b.victory,secondsDelta:b.withPreparationSeconds-a.withPreparationSeconds,coreDelta:b.coreHealth-a.coreHealth,finalWaveAllyHpRatioDelta:b.waves.at(-1).observation.allyHpRatio-a.waves.at(-1).observation.allyHpRatio};
  });
  return{levelId:level.id,name:level.name,rows,meanSecondsDelta:stats(rows.filter(r=>r.paired).map(r=>r.secondsDelta)),meanCoreDelta:stats(rows.filter(r=>r.paired).map(r=>r.coreDelta))};
});
const report={schemaVersion:1,generatedAt:new Date().toISOString(),sourceSha256:beforeHashes,seeds:SEEDS,method:'Unmodified simulateChapter(seed) via real GameService, SaveRepository and MemoryStorage; new save per candidate/seed; real recruiting, advancement, skill generation and collection; every wave checkpoint/restart equality and duplicate-completion checks; no Cocos/player save writes. Observations wrap exported stepBattle, calling original exactly once per invocation. Restored and uninterrupted twin states overwrite the same observational wave key and are asserted equal by the simulator.',limitations:['Fixed non-optimized formation and recruitment order: spike1, stone2, crystal3, leaf4, bubble5. Stone2 may never block on some levels. This is not the root actual crystal-first / stone1-crystal2 playthrough or an optimal formation.','Fresh-save progression only; no mature fixture, no ad bonuses, no injected stats or skills, no fusion decisions, no human choices, no retries.','Eight deterministic seeds are paired regression scenarios, not population win-rate estimates. Later levels also inherit candidate-dependent service outcomes from preceding levels.','Duration includes scripted preparation only; excludes art loading, pauses, menus, decisions and collection interaction. Ally HP metrics are wave-end snapshots including dead units as zero, not sampled minimum throughout combat.','New waves use balanceVersion 2. This report does not test legacy combat snapshot adoption or deployment migration.'],results,paired,productionFilesUnchanged:true,allMemoryRangesRestored:true};
report.historicalRuntime=historical.provenance;
report.historicalComparison={originalFile:'docs/reports/coverage-range-comparison.json',allResultsMatched:true,matchingScope:'All results including 80 level samples / 752 wave observations and original seven recorded module hashes; timestamp is a new replay timestamp.'};
fs.writeFileSync(path.join(output,'coverage-range-comparison.json'),JSON.stringify(report,null,2)+'\n');
const fmt=(s,d=2)=>s?`${s.mean.toFixed(d)} (${s.min.toFixed(d)}–${s.max.toFixed(d)})`:'未尝试';
let md='# 五关范围候选：历史实验重放\n\n本输出是 2026-09-08 原实验的重放，全部样本与已归档 JSON 完整匹配。它不描述当前生产值；原 JSON 和 Markdown 未覆盖。本次只加载冻结模块及指定 Git commit，不访问当前生产 .test-build。\n\n';
md+='## 方法和适用范围\n\n直接调用现有 `game/tools/simulate-chapter.cjs` 的 `simulateChapter`，沿用真实 GameService、MemoryStorage、逐波检查点重启一致性、重复结算幂等断言。新建存档原始三项资质 76、成长 100、五只各两技能；首次上阵一只，每个波间招募一只，收录仅取真实服务产生的成长；没有注入养成、广告奖励或强制解锁。\n\n';
md+=`固定种子：${SEEDS.join('、')}。每组独立新存档，五关顺序推进，上一关未过则不强制尝试下一关。\n\n`;
md+='**阵型是现有模拟器固定策略：射手 1 / 石头 2 / 水晶 3 / 叶子 4 / 泡泡 5；不是最佳阵型，也不是主线程正在使用的水晶首发、石头 1 / 水晶 2 实战阵型。** 例如第四关石头位置 2 不在路边，它不承担前排阻挡，本比较不能代替先前拦截点的专门诊断。\n\n';
md+='| 参数 | baseline | range-candidate |\n|---|---:|---:|\n| 射手 | 4.5 | 4.8 |\n| 法师 / 控制 | 4 / 4 | 4.6 / 4.6 |\n| 叶子 | 4 | 4.5 |\n| 鼓劲 / 分担 | 3 / 3 | 4.5 / 4.5 |\n| 石头阻挡 | 1.2 | 1.2 |\n| 远望加成 | +.3 | +.3 |\n\n';
md+='## 五关结果\n\n时长为战斗加脚本固定准备时间，单位秒；括号为最小–最大，前值为平均。血量百分比为该关最后一波结束时全体上阵最大生命加权比，倒地计零。\n\n';
md+='| 关卡 / 参数 | 尝试 / 通关 | 总秒数平均（区间） | 核心平均（区间） | 末波友军血量平均（区间） | 落入目标时长 |\n|---|---|---|---|---|---|\n';
for(const level of data.LEVELS)for(const result of results){const s=result.summary[level.id];const hp=s.finalWaveAllyHpRatio;md+=`| ${level.id} ${level.name} / ${result.variant.id} | ${s.attempted} / ${s.victories} | ${fmt(s.secondsWithPreparation)} | ${fmt(s.coreHealth)} | ${hp?fmt({mean:hp.mean*100,min:hp.min*100,max:hp.max*100})+'%':'—'} | ${s.targetHits}/${s.attempted} (${s.targetSeconds.join('–')} 秒) |\n`;}
md+='\n## 治疗、友军技能与倒地\n\n叶子普攻是每关累计次数的 8 样本平均；大治疗 / 鼓劲 / 分担为 8 个样本该关激活总数，含服务真实学得技能。没有技能或没有目标都可能为零，不能单看零次归因于范围。倒地波数统计每个波末至少一只倒地；不是倒地个体总数。\n\n';
md+='| 关卡 / 参数 | 叶子普攻平均（区间） | 大治疗总次 | 鼓劲总次 | 分担总次 | 有倒地的波 / 总波 |\n|---|---|---:|---:|---:|---|\n';
for(const level of data.LEVELS)for(const result of results){const s=result.summary[level.id];md+=`| ${level.id} / ${result.variant.id} | ${fmt(s.leafBasicCount)} | ${s.greatHealActivations} | ${s.encourageActivations} | ${s.shareActivations} | ${s.wavesWithDowns}/${s.totalWaves} |\n`;}
md+='\n## 同种子的成对时长差\n\n负数表示候选更快。此差异包含真实服务连续五关中产生的后续影响，不是把某一波输入角色完全固定后的单变量战斗消融。\n\n| 关卡 | 候选减 baseline 秒数平均（区间） | 核心差平均（区间） |\n|---|---|---|\n';
for(const row of paired)md+=`| ${row.levelId} ${row.name} | ${fmt(row.meanSecondsDelta)} | ${fmt(row.meanCoreDelta)} |\n`;
md+='\n## 结果解释与候选取舍\n\n';
const fourth=results.map(r=>r.summary[3]),fifth=results.map(r=>r.summary[4]);
const bossCounts=results.map(r=>({kills:r.runs.filter(run=>run.levels[4]?.waves?.at(-1)?.boss?.defeated).length,leaks:r.runs.filter(run=>run.levels[4]?.waves?.at(-1)?.boss?.leaked).length}));
md+=`1. 本次共 ${results.reduce((s,r)=>s+r.summary.reduce((a,l)=>a+l.totalWaves,0),0)} 个真实服务波次；全部完成检查点重启一致性和重复结算断言。第 5 关“通关”表示核心未被摧毁，不能直接等同于击败首领：baseline 首领击败 ${bossCounts[0].kills}/8、漏过 ${bossCounts[0].leaks}/8；候选击败 ${bossCounts[1].kills}/8、漏过 ${bossCounts[1].leaks}/8。\n`;
md+=`2. 候选第四关核心平均 ${fourth[0].coreHealth.mean.toFixed(3)}→${fourth[1].coreHealth.mean.toFixed(3)}，末波友军血量仅小幅变化；第五关末波友军血量 ${(fifth[0].finalWaveAllyHpRatio.mean*100).toFixed(2)}%→${(fifth[1].finalWaveAllyHpRatio.mean*100).toFixed(2)}%。这不是可以忽略的强度变化，后续需评价后期难度与治疗职业的实际价值。不能为保留原有压力而默认接受原治疗覆盖失效。\n`;
md+=`3. 第五关有倒地波数仍是 ${fifth[0].wavesWithDowns}/${fifth[0].totalWaves}→${fifth[1].wavesWithDowns}/${fifth[1].totalWaves}，候选也并非全员安全；各个体与波次结果应连同整体血量一起看。范围扩大也不保证每个种子更快，完整配对区间已经列出；本报告没有把该差异归因于某个未经隔离证明的单一技能。\n`;
md+='4. 数值候选确实能补第四关的几何缺口：法师/泡泡 4.6 大于原最早拦截点距离 4.586844，但基础余量仅 .013156；叶子基础 4.5、鼓劲/分担 4.5 大于 2↔4、3↔4 的 4.472136。叶子初始远望会达到 4.8。位置 4 到位置 1 仍 7.211，不会变成全场普通治疗。石头 1.2 不变，远程格也未强制变近战格。\n';
md+='5. 建议把该组值保留为下一轮运行候选，结合主线程真实阵型与关键首领压力验证后再定生产值。固定模拟器并未搜索最佳摆位，不能据此宣布五职业阵型和平衡最终完成。本次未采纳或实施候选。\n';
md+='\n## 局限与复现\n\n- 8 个固定种子用于成对回归，不是玩家群体胜率。不能把固定阵型全过等同于每种开局、排位或合成决策都合理。\n- 末波友军血量不能说明整波最低血线；本次没有侵入生产 tick 统计。完整 JSON 保留每波五只龟的生命、射程、普攻次数与技能激活，便于避免只看核心血量。\n- 准备时间只包含模拟器固定值，不包含资源加载、界面、停顿、玩家思考和收录等时间。\n- 此处只比较新波次 balanceVersion 2；旧 combat 的范围保留/下一波切换由专门兼容测试承担。\n- 本次不改变胜负、奖励、命令、随机数或存档实现；所有服务存档仅在进程 MemoryStorage。\n\n';
md+='运行 `node docs/reports/compare-coverage-ranges.cjs`，不需要编译共享 .test-build。历史模块只来自冻结的 v2 编译片段和指定 Git blob，逐一校验源码/产物 SHA；结果逐项匹配原始 80 个关卡样本。每次生成新 history-replays 子目录，不能覆盖旧报告。\n\n';
md+='- [本次重放完整结果](coverage-range-comparison.json)\n- [独立比较器](../../compare-coverage-ranges.cjs)\n- [历史绑定说明](../../HISTORICAL_COVERAGE_REPLAY.md)\n';
fs.writeFileSync(path.join(output,'COVERAGE_RANGE_COMPARISON.md'),md);
console.log('HISTORICAL_REPLAY '+JSON.stringify({output,comparison:report.historicalComparison}));
