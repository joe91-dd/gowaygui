const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave,decodeSave,validateSave}=require('../.test-build/core/save.js');
const {enablePrototype}=require('../.test-build/core/prototype.js');
const {enableLiving}=require('../.test-build/core/living.js');
const {enablePatrol,accruePatrol,claimPatrol,patrolGoldPerMinute}=require('../.test-build/core/patrol.js');
const {bookGrade}=require('../.test-build/core/bookPolicy.js');
const minute=60000,start=Date.parse('2026-09-17T00:00:00+08:00');
function fixture(seed=71){
  let now=start,fail=false;const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('disk full');data.set(key,value);},removeItem:key=>data.delete(key)};
  const clock={now:()=>now},repository=new SaveRepository(storage),service=new GameService(repository,clock,seed);
  service.enablePrototype('enable-v06');service.enableLiving('living');service.enablePatrol('patrol');
  return {service,data,storage,clock,setNow:value=>now=value,fail:value=>fail=value,reload:()=>new GameService(new SaveRepository(storage),clock)};
}
test('巡海旧档从启用时开始，不追发上线前奖励，最新币制20金币每分钟',()=>{
  const save=makeInitialSave(start,11);enablePrototype(save);enableLiving(save);save.clockHighWater=start+30*86400000;
  enablePatrol(save,save.clockHighWater);accruePatrol(save,save.clockHighWater);assert.equal(save.patrol.gold,0);assert.equal(patrolGoldPerMinute(save),20);validateSave(save);
});
test('一分钟边界、12小时上限、长离线不补滚多个周期',()=>{
  const setup=fixture();setup.setNow(start+minute-1);setup.service.refreshClock('clock1');assert.equal(setup.service.snapshot.patrol.gold,0);
  setup.setNow(start+minute);setup.service.refreshClock('clock2');assert.equal(setup.service.snapshot.patrol.gold,20);
  setup.setNow(start+40*86400000);setup.service.refreshClock('clock3');const capped=setup.service.snapshot.patrol;assert.equal(capped.gold,14400);assert.equal(capped.creditedMinutes,720);
  setup.setNow(start+41*86400000);setup.service.refreshClock('clock4');assert.deepEqual({...setup.service.snapshot.patrol,lastAt:0},{...capped,lastAt:0});
  setup.service.claimPatrol('claim');setup.setNow(start+41*86400000+minute);setup.service.refreshClock('clock5');assert.equal(setup.service.snapshot.patrol.gold,20);
});
test('在线分段累计和一次离线累计得到相同固定奖励，不改变战斗随机流',()=>{
  const online=fixture(82),offline=fixture(82),rng=online.service.snapshot.rng;
  for(let index=1;index<=1440;index++){online.setNow(start+index*30000);online.service.refreshClock('step-'+index);}
  offline.setNow(start+720*minute);offline.service.refreshClock('all');assert.deepEqual(online.service.snapshot.patrol,offline.service.snapshot.patrol);assert.equal(online.service.snapshot.rng,rng);
});
test('领取保留零头和30分钟奇遇进度，频繁领取不丢失随机机会',()=>{
  const setup=fixture();setup.setNow(start+29.5*minute);setup.service.refreshClock('clock');setup.service.claimPatrol('claim');
  let state=setup.service.snapshot.patrol;assert.equal(state.bankMs,30000);assert.equal(state.encounterMinutes,29);const before=state.rng;
  setup.setNow(start+30*minute);setup.service.refreshClock('clock2');state=setup.service.snapshot.patrol;assert.equal(state.gold,20);assert.equal(state.encounterMinutes,0);assert.notEqual(state.rng,before);
});
test('刷新重载不重抽，重复领取幂等，第二个不同操作不能重复领取',()=>{
  const setup=fixture();setup.setNow(start+720*minute);setup.service.refreshClock('clock');const pending=setup.service.snapshot.patrol;
  const restored=setup.reload();assert.deepEqual(restored.snapshot.patrol,pending);const receipt=restored.claimPatrol('claim'),after=restored.snapshot.gold;
  assert.deepEqual(restored.claimPatrol('claim'),receipt);assert.equal(restored.snapshot.gold,after);assert.throws(()=>restored.claimPatrol('claim-again'),/一分钟/);
  assert.equal(decodeSave(setup.data.get(SAVE_KEY)).patrol.gold,0);
});
test('时钟回拨不倒扣、不重复产出，恢复后继续正常累计',()=>{
  const setup=fixture();setup.setNow(start+10*minute);setup.service.refreshClock('clock1');setup.service.claimPatrol('claim');
  setup.setNow(start);setup.service.refreshClock('clock2');assert.equal(setup.service.snapshot.patrol.gold,0);
  setup.setNow(start+11*minute);setup.service.refreshClock('clock3');assert.equal(setup.service.snapshot.patrol.gold,20);
});
test('写盘失败不发奖不消耗待领结果，重试仅领取一次',()=>{
  const setup=fixture();setup.setNow(start+60*minute);setup.service.refreshClock('clock');const before=setup.service.snapshot;
  setup.fail(true);assert.throws(()=>setup.service.claimPatrol('claim'));assert.deepEqual(setup.service.snapshot,before);setup.fail(false);
  const reward=setup.service.claimPatrol('claim');assert.equal(setup.service.snapshot.gold,before.gold+reward.gold);setup.reload().claimPatrol('claim');assert.equal(setup.reload().snapshot.gold,before.gold+reward.gold);
});
test('普通技能书池不含主动、专精或珍贵；伙伴1到5技能；掉落频率符合配置',()=>{
  const save=makeInitialSave(start,44);enablePrototype(save);enableLiving(save);enablePatrol(save,start);let materials=0,books=0,pets=0;
  for(let period=1;period<=400;period++){
    save.clockHighWater=start+period*720*minute;accruePatrol(save,save.clockHighWater);
    const rewards=claimPatrol(save);materials+=Object.values(rewards.materials).reduce((sum,value)=>sum+value,0);books+=Object.values(rewards.books).reduce((sum,value)=>sum+value,0);pets+=rewards.pets.length;
    for(const id of Object.keys(rewards.books))assert.equal(bookGrade(id),'common');
    for(const pet of rewards.pets){assert.ok(pet.skills.length>=1&&pet.skills.length<=5);delete save.collection[pet.id];}
    validateSave(save);
  }
  assert.ok(materials>2500&&materials<3300);assert.ok(books>190&&books<390);assert.ok(pets>50&&pets<150);
});
test('满背包保留全部巡海收获，腾出空间后完整领取',()=>{
  const save=makeInitialSave(start,73);enablePrototype(save);enableLiving(save);enablePatrol(save,start);
  let day=0;while(!save.patrol.pets.length&&day<100){save.clockHighWater=start+(++day)*720*minute;accruePatrol(save,save.clockHighWater);if(!save.patrol.pets.length)claimPatrol(save);}
  assert.ok(save.patrol.pets.length);save.capacity=Object.keys(save.collection).length;
  const before=JSON.stringify(save);assert.throws(()=>claimPatrol(save),/空间不足/);assert.equal(JSON.stringify(save),before);
  save.capacity=50;const rewards=claimPatrol(save);for(const pet of rewards.pets)assert.ok(save.collection[pet.id]);validateSave(save);
});
test('损坏的巡海状态被拒绝，老存档缺少巡海状态仍可读取',()=>{
  const setup=fixture();const save=setup.service.snapshot;delete save.patrol;assert.doesNotThrow(()=>decodeSave(encodeSave(save)));
  for(const mutate of [state=>state.bankMs=-1,state=>state.encounterMinutes=30,state=>state.books={hold:1},state=>state.materials={growth:99},state=>state.pets=[{}]]){
    const broken=setup.service.snapshot;mutate(broken.patrol);assert.throws(()=>decodeSave(encodeSave(broken)));
  }
});
