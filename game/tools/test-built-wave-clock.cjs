const assert=require('node:assert/strict'),path=require('node:path');
const loader=require('./test-built-core.cjs').loadBuiltCore(path.resolve(process.argv[2])),C=n=>loader.load(n);
const {GameService}=C('game'),{SaveRepository,validateSave}=C('save'),{MemoryStorage}=C('storage'),B=C('battle');
const storage=new MemoryStorage(),clock={now:()=>1790240000000};let g=new GameService(new SaveRepository(storage),clock,41);
g.enablePrototype('enable');g.beginPrototypeRun('begin',0,Object.keys(g.snapshot.collection));
g.expeditionCommand('r1','recruit');g.expeditionCommand('r2','recruit');g.beginWave('start',g.snapshot.run.id,g.snapshot.run.battle);
const b=g.snapshot.run.battle;b.autoSkills=false;const deadline=b.expedition.nextWaveTick;
for(let n=0;n<deadline+20;n++){
 for(const u of b.units)u.nextAttackTick=999999;
 for(const e of b.enemies){e.speed=0;e.attack=0;e.nextAttackTick=999999;e.abilityReadyTick=999999;e.traitReadyTick=999999;e.actionUntilTick=999999;}
 B.stepBattle(b,.05);
}
assert.equal(b.wave,2);assert.equal(b.expedition.completed,0);assert.ok(b.enemies.some(e=>e.alive&&e.originWave===1));
g.checkpointBattle('checkpoint',g.snapshot.run.id,b);validateSave(g.snapshot);
g=new GameService(new SaveRepository(storage),clock);assert.equal(g.snapshot.run.battle.wave,2);assert.equal(g.snapshot.run.battle.expedition.nextWaveTick,b.expedition.nextWaveTick);assert.equal(g.snapshot.run.wave,0);
assert.ok(g.snapshot.run.battle.units.every(u=>u.range===(u.role==='stone'?1.2:2.4)+(u.skills.includes('reach')?.3:0)));
console.log('PASS actual built GameService recruitment, overlapping waves, checkpoint, save/reload, role ranges.');
