const test=require('node:test'),assert=require('node:assert/strict');
const {createVisualTrial,reviewPlacement,REVIEW_ROUTE,REVIEW_OBSTACLES}=require('../.test-build/core/visualTrial.js');
const {stepBattle,commandBattle,getBattleEvents}=require('../.test-build/core/battle.js');

test('三维验收场景可以独立重置，初始站位合法且不改写共享状态',()=>{
  const a=createVisualTrial(),b=createVisualTrial();
  assert.deepEqual(a,b);assert.equal(a.units.length,2);
  a.units.forEach(u=>assert.equal(reviewPlacement(u,a.units.filter(v=>v!==u)),undefined));
  a.units[0].hp=1;a.route[0].x=999;
  assert.notEqual(b.units[0].hp,1);assert.equal(b.route[0].x,REVIEW_ROUTE[0].x);
});
test('实际地图道路、岸外、终点和重叠站位拒绝，草地可摆放',()=>{
  for(let i=1;i<REVIEW_ROUTE.length;i++){
    const a=REVIEW_ROUTE[i-1],b=REVIEW_ROUTE[i];assert.match(reviewPlacement({x:(a.x+b.x)/2,z:(a.z+b.z)/2},[]),/道路/);
  }
  assert.match(reviewPlacement({x:9,z:0},[]),/岛内/);
  assert.match(reviewPlacement({x:6.5,z:1},[]),/灯塔/);
  assert.match(reviewPlacement({x:0,z:1},[{x:.5,z:1}]),/重叠/);
  assert.equal(reviewPlacement({x:0,z:1},[]),undefined);
  for(const obstacle of REVIEW_OBSTACLES)assert.ok(reviewPlacement(obstacle,[]),'decorative obstacles must not accept a unit');
  for(let i=1;i<REVIEW_ROUTE.length;i++)assert.ok(Math.hypot(REVIEW_ROUTE[i].x-REVIEW_ROUTE[i-1].x,REVIEW_ROUTE[i].z-REVIEW_ROUTE[i-1].z)>.001,'zero length path segments break projection');
});
test('真实战斗核心产生近战、法术、阵亡；主动与专精只在合法目标上触发',()=>{
  const b=createVisualTrial(),ids=new Set(),skills=new Set();let casts=0,enemyAttacks=0;
  assert.equal(commandBattle(b,{type:'cast',unitId:b.units[1].id,skillId:'crystalCannon',point:{x:0,z:0}}),false);
  for(let i=0;i<2400&&b.status==='fighting';i++){
    for(const u of b.units){const e=b.enemies.find(e=>e.alive&&Math.hypot(e.x-u.x,e.z-u.z)<u.range);if(e&&commandBattle(b,{type:'cast',unitId:u.id,skillId:u.role==='stone'?'hold':'crystalCannon',...(u.role==='crystal'?{point:{x:e.x,z:e.z}}:{})}))casts++;}
    stepBattle(b,.05);
    for(const e of getBattleEvents(b)){ids.add(e.type);if(e.skillId)skills.add(e.skillId);if(e.type==='attack'&&e.sourceId&&b.enemies.some(enemy=>enemy.id===e.sourceId))enemyAttacks++;}
  }
  assert.ok(casts>=2);assert.ok(b.kills>5);assert.notEqual(b.status,'fighting');
  for(const skill of ['hold','stoneMastery','crystalCannon','crystalMastery'])assert.ok(skills.has(skill),skill);
  assert.ok(ids.has('attack')&&ids.has('damage')&&ids.has('defeat'));assert.ok(enemyAttacks>0);
});
