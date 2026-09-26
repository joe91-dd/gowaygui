const fs=require('node:fs');
const base='../../game/.test-build/';
const {GameService}=require(base+'core/game.js'),{SaveRepository}=require(base+'core/save.js'),{MemoryStorage}=require(base+'platform/storage.js'),{createBattle,stepBattle,getBattleEvents}=require(base+'core/battle.js'),{currentUnits}=require(base+'core/prototype.js');
const rows=[];
for(const seed of [27,731,2026]){
 const service=new GameService(new SaveRepository(new MemoryStorage()),{now:()=>1788948000000},seed);service.beginPrototypeRun('run',0,Object.keys(service.snapshot.collection));
 const waves=[];
 for(let wave=1;wave<=5;wave++){
  const run=service.snapshot.run,inputs=currentUnits(run).filter(u=>u.slot!==null),b=createBattle(0,wave,inputs,{rulesVersion:'0.6',mode:'chapter',waveLimit:5,coreHealth:run.coreHealth,seed:seed+wave});b.autoSkills=true;
  for(const u of b.units)if(run.units[u.id]?.fallen){u.alive=false;u.hp=0;}
  service.beginWave('begin'+wave,run.id,b);
  let peak=0,damage=0,aliveSamples=0;
  while(b.status==='fighting'&&b.elapsed<150){stepBattle(b,.25);peak=Math.max(peak,b.enemies.filter(e=>e.alive).length);const events=getBattleEvents(b);damage+=events.filter(e=>e.type==='damage'&&b.units.some(u=>u.id===e.targetId)).reduce((n,e)=>n+(e.amount||0),0);aliveSamples+=b.enemies.filter(e=>e.alive).length;}
  waves.push({wave,seconds:b.elapsed,status:b.status,core:b.coreHealth,kills:b.kills,peakEnemies:peak,damageTaken:Math.round(damage),survivors:b.units.filter(u=>u.alive).length});
  if(b.status==='fighting')break;
  service.completeWave('end'+wave,run.id,b);if(b.status==='lost')break;
 }
 rows.push({seed,seconds:waves.reduce((n,w)=>n+w.seconds,0)+24,waves});
}
fs.writeFileSync(__dirname+'/balance.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
