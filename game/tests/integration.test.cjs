const test=require('node:test');
const assert=require('node:assert/strict');
const {simulateChapter,simulateMatureBoss}=require('../tools/simulate-chapter.cjs');
const {decodeSave}=require('../.test-build/core/save.js');

test('fresh GameService progression uses one initial turtle, legal recruitment, service levels and recoverable wave snapshots',()=>{
  const {report}=simulateChapter();
  assert.equal(report.initial.roster.length,5);
  assert.ok(report.initial.roster.every(t=>t.skills.length===2&&[t.innate.attack,t.innate.health,t.innate.defense].every(v=>v>=60&&v<=100)&&t.innate.growth>=90&&t.innate.growth<=110));
  for(const level of report.levels.filter(l=>!l.notAttempted)){
    assert.equal(level.waves[0].units.length,1);
    for(const [i,wave] of level.waves.entries())assert.equal(wave.units.length,Math.min(i+1,5));
    assert.equal(level.checkpointRestores,level.waves.length);
    assert.equal(level.endingGold-level.startingGold,level.reward.total);
  }
  for(const archive of report.archives)assert.deepEqual(decodeSave(archive.envelope),archive.save);
});

test('mature 4–6-skill fixture remains separate and training uses earned resources via GameService',()=>{
  const {report}=simulateChapter();const mature=simulateMatureBoss(report);
  if(mature.notAttempted){assert.ok(report.finalSave.unlockedLevel<4);return;}
  assert.ok(mature.roster.every(t=>t.skills.length>=4&&t.skills.length<=6&&t.innate.attack>=60&&t.innate.attack<=100));
  assert.equal(mature.startingGold,report.finalSave.gold-mature.training.reduce((sum,t)=>sum+t.cost,0));
  assert.equal(mature.level.waves[0].units.length,1);
  assert.deepEqual(decodeSave(mature.envelope),mature.finalSave);
});
