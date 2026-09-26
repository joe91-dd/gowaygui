const test=require('node:test');
const assert=require('node:assert/strict');
const {simulateChapter,simulateMatureBoss}=require('../tools/simulate-chapter.cjs');
const {SEEDS}=require('../tools/simulate-boss-balance.cjs');

test('eight real-service seeds keep boss challenge within timing budget and reward ordinary 4–6-skill growth',()=>{
  let freshKills=0,matureKills=0,freshSeconds=0,matureSeconds=0;
  for(const seed of SEEDS){
    const fresh=simulateChapter(seed).report;
    const level=fresh.levels.find(l=>l.levelId===4);
    assert.ok(level&&!level.notAttempted,`seed ${seed}: fresh progression must unlock the boss stage`);
    assert.ok(level.victory,`seed ${seed}: core must survive the challenge`);
    assert.ok(level.withPreparationSeconds>=300&&level.withPreparationSeconds<=450,`seed ${seed}: random fresh build stays within the legacy boss time ceiling`);
    const boss=level.waves.at(-1).boss;
    assert.ok(boss,'the boss must actually spawn');
    assert.notEqual(boss.defeated,boss.leaked,'technical stage victory is distinct from killing the boss');
    freshKills+=Number(boss.defeated);freshSeconds+=level.withPreparationSeconds;
    const mature=simulateMatureBoss(fresh,seed+100000);
    assert.ok(mature.level.victory,`seed ${seed}: trained archive must keep the core alive`);
    const trainedBoss=mature.level.waves.at(-1).boss;
    assert.ok(trainedBoss.defeated&&!trainedBoss.leaked,`seed ${seed}: grown archive must really defeat the boss`);
    assert.ok(trainedBoss.attackCount>=9&&trainedBoss.allyHpDamage>500,'boss retains multiple shock attacks and real damage pressure');
    assert.ok(mature.level.withPreparationSeconds>=360&&mature.level.withPreparationSeconds<=450);
    matureKills+=Number(trainedBoss.defeated);matureSeconds+=mature.level.withPreparationSeconds;
  }
  assert.ok(freshKills>=6,'most fresh builds should have a viable first-clear opportunity');
  assert.equal(matureKills,SEEDS.length);
  assert.ok(matureSeconds<freshSeconds,'ordinary growth must provide a measurable completion-time benefit');
});
