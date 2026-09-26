const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const data=require('../.test-build/core/data.js');
const {simulateChapter,simulateMatureBoss}=require('./simulate-chapter.cjs');

const SEEDS=[731,913,2027,4093,6553,9173,12037,19391];
const CANDIDATES=[
  {id:'A12x22',waves:12,spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8,10],bossHpScale:1.6,bossAttackScale:1.4},
  {id:'B12x20',waves:12,spawnDuration:20,preparationSeconds:6,mergeWaves:[4,8,10],bossHpScale:1.6,bossAttackScale:1.4},
  {id:'C14x20',waves:14,spawnDuration:20,preparationSeconds:5,mergeWaves:[4,8,12],bossHpScale:1.6,bossAttackScale:1.4},
];
const REFINED_CANDIDATES=[
  {id:'D12x20-H1',waves:12,spawnDuration:20,preparationSeconds:6,mergeWaves:[4,8,10],bossHpScale:1,bossAttackScale:1.4},
  {id:'E12x20-H08',waves:12,spawnDuration:20,preparationSeconds:6,mergeWaves:[4,8,10],bossHpScale:.8,bossAttackScale:1.4},
  {id:'F12x22-H08',waves:12,spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8,10],bossHpScale:.8,bossAttackScale:1.4},
];
const PRESSURE_CANDIDATES=[
  {id:'G12x20-D1-A12',waves:12,spawnDuration:20,preparationSeconds:6,mergeWaves:[4,8,10],difficulty:1,bossHpScale:1.2,bossAttackScale:1.2},
  {id:'H12x22-D1-A1',waves:12,spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8,10],difficulty:1,bossHpScale:1.2,bossAttackScale:1},
  {id:'I12x20-D1-A1',waves:12,spawnDuration:20,preparationSeconds:6,mergeWaves:[4,8,10],difficulty:1,bossHpScale:1.2,bossAttackScale:1},
];
const PACED_CANDIDATES=[
  {id:'J12x18-H08',waves:12,spawnDuration:18,preparationSeconds:6,mergeWaves:[4,8,10],difficulty:1.18,bossHpScale:.8,bossAttackScale:1.4},
  {id:'K12x18-D112-H1-A12',waves:12,spawnDuration:18,preparationSeconds:6,mergeWaves:[4,8,10],difficulty:1.12,bossHpScale:1,bossAttackScale:1.2},
];
const SELECTED_CANDIDATES=[
  {id:'L12x18-D112-H1-A12-P5',waves:12,spawnDuration:18,preparationSeconds:5,mergeWaves:[4,8,10],difficulty:1.12,bossHpScale:1,bossAttackScale:1.2},
];
const clone=value=>JSON.parse(JSON.stringify(value));

function extract(level){
  if(!level||level.notAttempted)return {attempted:false,reason:level?.notAttempted||'earlier level failed'};
  const last=level.waves.at(-1);
  return {attempted:true,victory:level.victory,completedWaves:level.completedWaves,failureWave:level.failureWave,
    seconds:level.withPreparationSeconds,combatSeconds:level.combatSeconds,coreHealth:level.coreHealth,
    boss:last?.boss||{defeated:false,leaked:false,notSpawned:true},reward:level.reward,
    finalWaveSeconds:last?.seconds,stageSeconds:level.waves.map(w=>w.seconds)};
}
function summarize(runs,kind){
  const attempted=runs.map(run=>run[kind]).filter(run=>run.attempted);
  const seconds=attempted.map(r=>r.seconds);
  const hp=attempted.map(r=>r.coreHealth);
  return {sampleCount:runs.length,attempted:attempted.length,victories:attempted.filter(r=>r.victory).length,
    bossKills:attempted.filter(r=>r.boss.defeated).length,bossLeaks:attempted.filter(r=>r.boss.leaked).length,
    minSeconds:Math.min(...seconds),maxSeconds:Math.max(...seconds),meanSeconds:Math.round(seconds.reduce((a,b)=>a+b,0)/seconds.length*100)/100,
    within360to480:attempted.filter(r=>r.seconds>=360&&r.seconds<=480).length,
    within360to450:attempted.filter(r=>r.seconds>=360&&r.seconds<=450).length,
    minCore:Math.min(...hp),maxCore:Math.max(...hp)};
}

function compareCandidates(candidates=CANDIDATES,seeds=SEEDS,label='initial'){
  const baseLevel=clone(data.LEVELS[4]);
  const baseSpawns=data.spawnsForWave;
  const ordinaryBefore=JSON.stringify(data.LEVELS.slice(0,4));
  const results=[];
  try{
    for(const candidate of candidates){
      Object.assign(data.LEVELS[4],baseLevel,{waves:candidate.waves,spawnDuration:candidate.spawnDuration,preparationSeconds:candidate.preparationSeconds,mergeWaves:[...candidate.mergeWaves],difficulty:candidate.difficulty??1.18});
      data.spawnsForWave=(levelId,wave)=>baseSpawns(levelId,wave).map(spawn=>levelId===4&&spawn.kind==='boss'?{...spawn,hpScale:candidate.bossHpScale,attackScale:candidate.bossAttackScale}:spawn);
      const runs=[];
      for(const seed of seeds){
        const fresh=simulateChapter(seed).report;
        const mature=simulateMatureBoss(fresh,seed+100000);
        const result={seed,fresh:extract(fresh.levels.find(level=>level.levelId===4)),mature:extract(mature.level),
          matureTraining:mature.training||[],freshEarlierLevels:fresh.levels.filter(l=>l.levelId<4).map(l=>({levelId:l.levelId,victory:l.victory,seconds:l.withPreparationSeconds,coreHealth:l.coreHealth}))};
        runs.push(result);
        process.stdout.write(`${candidate.id} seed ${seed}: fresh ${result.fresh.seconds}s kill=${result.fresh.boss?.defeated}; mature ${result.mature.seconds}s kill=${result.mature.boss?.defeated}\n`);
      }
      const result={candidate,runs,fresh:summarize(runs,'fresh'),mature:summarize(runs,'mature')};results.push(result);
      process.stdout.write(`SUMMARY ${JSON.stringify({id:candidate.id,fresh:result.fresh,mature:result.mature})}\n`);
    }
  }finally{Object.assign(data.LEVELS[4],baseLevel);data.spawnsForWave=baseSpawns;}
  assert.equal(JSON.stringify(data.LEVELS.slice(0,4)),ordinaryBefore,'ordinary stages must remain unchanged');
  const report={generatedAt:new Date().toISOString(),label,seeds,method:'Real GameService from a fresh 2-skill/76-aptitude save. One initial turtle, one recruit per wave interval, real local skill growth and collection, per-wave checkpoint/restart. Mature 4–6-skill fixture isolated and training paid from actual income. Candidate changes are in-memory only; no data.ts modifications.',results};
  const output=path.resolve(__dirname,'../../docs/reports/boss-balance');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,`${label}.json`),JSON.stringify(report,null,2));
  return report;
}
module.exports={SEEDS,CANDIDATES,REFINED_CANDIDATES,PRESSURE_CANDIDATES,PACED_CANDIDATES,SELECTED_CANDIDATES,compareCandidates};
if(require.main===module)compareCandidates(process.argv[2]==='selected'?SELECTED_CANDIDATES:process.argv[2]==='paced'?PACED_CANDIDATES:process.argv[2]==='pressure'?PRESSURE_CANDIDATES:process.argv[2]==='refined'?REFINED_CANDIDATES:CANDIDATES,SEEDS,process.argv[2]||'initial');
