const test=require('node:test');
const assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,BACKUP_KEY,encodeSave,decodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {countDistribution,generateFusion,previewFusion,combinedCountChance}=require('../.test-build/core/fusion.js');
const {weighted}=require('../.test-build/core/random.js');
const {skillsForRole,LEVELS}=require('../.test-build/core/data.js');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const NOW=1788830000000;
function fixture(edit=()=>{}){
 const storage=new MemoryStorage(),clock={value:NOW,now(){return this.value;}};
 const initial=makeInitialSave(NOW,0x6f73412);initial.unlockedLevel=4;edit(initial);
 storage.setItem(SAVE_KEY,encodeSave(initial));
 return {storage,clock,game:new GameService(new SaveRepository(storage),clock),initial};
}
function battleFor(g){const r=g.snapshot.run;return createBattle(r.levelId,r.wave+1,living(g).filter(u=>u.slot!==null),{coreHealth:r.coreHealth});}
// Domain-only outcome fixture. Real combat and checkpoint trajectories are verified in integration.test.cjs.
function outcomeFixture(battle,victory=true){const b=structuredClone(battle);b.spawns=[];b.spawnCursor=0;b.events=[];b.status=victory?'won':'lost';b.coreHealth=victory?b.coreHealth:0;b.tick=500;b.elapsed=25;return b;}
function wave(g){const r=g.snapshot.run,w=r.wave+1,b=battleFor(g);g.beginWave(`start:${r.id}:${w}`,r.id,b);g.completeWave(`end:${r.id}:${w}`,r.id,outcomeFixture(b));}
function prepare(edit){const f=fixture(edit),ids=Object.keys(f.game.snapshot.collection);f.game.beginRun('start',1,ids);wave(f.game);f.game.recruit('recruitB',{permanentId:ids[1]});while(f.game.snapshot.run.wave<4)wave(f.game);return {...f,ids};}
function living(g){return Object.values(g.snapshot.run.units).filter(u=>!u.consumedBy);}
function reopen(f){f.game=new GameService(new SaveRepository(f.storage),f.clock);return f.game;}
test('不收录：随机结果先持久化；退出重进不重抽，永久 A/B 留在收藏',()=>{
 const f=prepare(),parents=structuredClone(f.game.snapshot.collection),[a,b]=living(f.game);
 const child=f.game.merge('merge1',a.id,b.id),rng=f.game.snapshot.rng;
 reopen(f);assert.equal(f.game.snapshot.run.phase,'reveal');assert.deepEqual(f.game.snapshot.run.units[child.id].turtle,child.turtle);
 assert.deepEqual(f.game.merge('merge1',a.id,b.id),child);assert.equal(f.game.snapshot.rng,rng);
 assert.deepEqual(f.game.snapshot.collection,parents);
 f.game.reveal('reveal');f.game.abandonRun('quit');
 f.game.beginRun('again',1,f.ids);assert.ok(f.game.snapshot.collection[f.ids[0]]);assert.ok(f.game.snapshot.collection[f.ids[1]]);
 assert.equal(Object.keys(f.game.snapshot.history).length,0);
});
test('收录：同时退役真实来源；重复确认与重启不重复生成档案',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);f.game.reveal('r');
 const sources=f.game.collectionPreview(c.id).sources.map(t=>t.id).sort();assert.deepEqual(sources,f.ids.slice(0,2).sort());
 const saved=f.game.collect('c',c.id);assert.equal(Object.keys(f.game.snapshot.collection).length,4);
 for(const id of sources){assert.ok(!f.game.snapshot.collection[id]);assert.equal(f.game.snapshot.history[id].replacementId,saved.id);}
 reopen(f);assert.deepEqual(f.game.collect('c',c.id),saved);f.game.collect('different-button-retry',c.id);
 assert.equal(Object.keys(f.game.snapshot.history).length,2);assert.equal(Object.keys(f.game.snapshot.collection).length,4);
});
test('多代未收录 C + D：最终确认准确退役 A/B/D',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m1',a.id,b.id);f.game.reveal('r1');
 f.game.recruit('recruitD',{permanentId:f.ids[2]});while(f.game.snapshot.run.wave<8)wave(f.game);
 const d=living(f.game).find(u=>u.id!==c.id),e=f.game.merge('m2',c.id,d.id);f.game.reveal('r2');
 assert.deepEqual(f.game.collectionPreview(e.id).sources.map(t=>t.id).sort(),f.ids.slice(0,3).sort());
 reopen(f);f.game.collect('collectE',e.id);assert.deepEqual(Object.keys(f.game.snapshot.history).sort(),f.ids.slice(0,3).sort());
});
test('已收录 C + D：后代确认只退役 C/D，不再次消费 A/B',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m1',a.id,b.id);f.game.reveal('r1');const savedC=f.game.collect('c1',c.id);
 f.game.recruit('D',{permanentId:f.ids[2]});while(f.game.snapshot.run.wave<8)wave(f.game);
 const d=living(f.game).find(u=>u.id!==c.id),e=f.game.merge('m2',c.id,d.id);f.game.reveal('r2');
 assert.deepEqual(f.game.collectionPreview(e.id).sources.map(t=>t.id).sort(),[savedC.id,f.ids[2]].sort());
 const savedE=f.game.collect('c2',e.id);assert.equal(f.game.snapshot.history[f.ids[0]].replacementId,savedC.id);
 assert.equal(f.game.snapshot.history[savedC.id].replacementId,savedE.id);assert.equal(Object.keys(f.game.snapshot.history).length,4);
});
test('不可再次部署已消耗的来源；不可用同一只龟自合或重复占用合成波次',()=>{
 const f=prepare(),[a,b]=living(f.game);assert.throws(()=>f.game.merge('self',a.id,a.id),/不同/);
 const c=f.game.merge('m',a.id,b.id);f.game.reveal('r');assert.throws(()=>f.game.recruit('duplicate',{permanentId:f.ids[0]}),/每局只能/);
 assert.throws(()=>f.game.merge('m2',c.id,a.id),/没有合成机会/);assert.equal(living(f.game).length,1);
});
test('永久 A + 新招募 B：只退役 A；培养值不遗传给新龟',()=>{
 const f=fixture(s=>{s.collection['t-1'].training.attack=7;s.collection['t-1'].training.growth=3;});
 f.game.beginRun('start',1,['t-1']);wave(f.game);f.game.recruit('fresh',{candidateId:f.game.snapshot.run.recruitCandidates[0].id});
 while(f.game.snapshot.run.wave<4)wave(f.game);
 const [a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);assert.deepEqual(c.turtle.training,{attack:0,health:0,defense:0,growth:0});
 f.game.reveal('r');assert.deepEqual(f.game.collectionPreview(c.id).sources.map(t=>t.id),['t-1']);f.game.collect('collect',c.id);
 assert.deepEqual(Object.keys(f.game.snapshot.history),['t-1']);
});
test('锁定来源可以试合，但在解锁前不能确认收录',()=>{
 const f=prepare();f.game.setLocked('lock',f.ids[0],true);const [a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);f.game.reveal('r');
 assert.throws(()=>f.game.collect('collect',c.id),/已锁定/);assert.ok(f.game.snapshot.collection[f.ids[0]]);
 f.game.setLocked('unlock',f.ids[0],false);f.game.collect('collect',c.id);assert.ok(!f.game.snapshot.collection[f.ids[0]]);
});
test('原子写入失败：内存与磁盘保持旧事务；恢复后可安全重试',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);f.game.reveal('r');
 const before=f.game.snapshot,realSet=f.storage.setItem.bind(f.storage);let once=true;
 f.storage.setItem=(key,value)=>{if(key===SAVE_KEY&&once){once=false;throw new Error('simulated disk full');}realSet(key,value);};
 assert.throws(()=>f.game.collect('collect',c.id),/disk full/);assert.deepEqual(f.game.snapshot,before);assert.deepEqual(decodeSave(f.storage.getItem(SAVE_KEY)),before);
 reopen(f);f.game.collect('collect',c.id);assert.equal(Object.keys(f.game.snapshot.history).length,2);
});
test('写入成功但调用方未收到确认：重启后相同指令不会再次收录',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);f.game.reveal('r');
 const realSet=f.storage.setItem.bind(f.storage);let once=true;
 f.storage.setItem=(key,value)=>{realSet(key,value);if(key===SAVE_KEY&&once){once=false;throw new Error('simulated crash after commit');}};
 assert.throws(()=>f.game.collect('collect',c.id),/after commit/);reopen(f);f.game.collect('collect',c.id);
 assert.equal(Object.keys(f.game.snapshot.history).length,2);assert.equal(f.game.snapshot.run.units[c.id].savedId,c.turtle.id);
});
test('损坏存档恢复上一完整备份；两个存档都损坏时不自动清空',()=>{
 const f=fixture();f.game.updateSettings('sound',{music:.2});f.storage.setItem(SAVE_KEY,'broken');
 const repo=new SaveRepository(f.storage),g=new GameService(repo,f.clock);assert.equal(repo.recoveredFromBackup,true);assert.equal(g.snapshot.settings.music,.65);
 g.updateSettings('sound2',{music:.3});assert.equal(decodeSave(f.storage.getItem(SAVE_KEY)).settings.music,.3);
 f.storage.setItem(SAVE_KEY,'broken');f.storage.setItem(BACKUP_KEY,'broken');assert.throws(()=>reopen(f),/不会自动清空/);
});
test('另一个页面的陈旧存档不得覆盖已提交操作',()=>{
 const f=fixture(),second=new GameService(new SaveRepository(f.storage),f.clock);f.game.updateSettings('first',{music:.2});
 assert.throws(()=>second.train('stale','t-1','attack'),/另一个页面/);assert.equal(decodeSave(f.storage.getItem(SAVE_KEY)).gold,300);
});
test('同一存储提交重入被拒绝，不覆盖重入操作或暴露部分事务',()=>{
 const f=fixture(),second=new GameService(new SaveRepository(f.storage),f.clock),realSet=f.storage.setItem.bind(f.storage);let checked=false;
 f.storage.setItem=(key,value)=>{
  if(key===BACKUP_KEY&&!checked){checked=true;assert.throws(()=>second.train('nested','t-1','attack'),/正在由另一个操作/);}
  realSet(key,value);
 };
 f.game.updateSettings('first',{music:.2});assert.equal(f.game.snapshot.gold,300);assert.equal(f.game.snapshot.settings.music,.2);assert.equal(checked,true);
});
test('教学免体力仅首次进入，不能以反复失败无限免费领取金币',()=>{
 const f=fixture();
 for(let i=0;i<3;i++){f.game.beginRun(`tutorial${i}`,0,['t-1']);wave(f.game);f.game.abandonRun(`quit${i}`);}
 assert.equal(f.game.snapshot.gold,324);assert.equal(f.game.snapshot.stamina,20);assert.equal(f.game.snapshot.tutorialStarted,true);assert.equal(f.game.snapshot.tutorialDone,false);
});
test('通关/首通/翻倍仅发一次；翻倍只包含基础金币',()=>{
 const f=fixture();const id=f.game.beginRun('run',1,['t-1']);for(let i=0;i<10;i++)wave(f.game);
 const result=f.game.snapshot.results[id];assert.equal(result.baseGold,100);assert.equal(result.firstClearGold,100);assert.equal(f.game.snapshot.gold,500);
 f.game.completeWave(`end:${id}:10`,id,{});assert.equal(f.game.snapshot.gold,500);
 assert.equal(f.game.simulateAd('double','doubleGold',id),100);reopen(f);f.game.simulateAd('double','doubleGold',id);assert.equal(f.game.snapshot.gold,600);
 assert.throws(()=>f.game.simulateAd('double2','doubleGold',id),/已翻倍/);assert.equal(f.game.snapshot.dailyAds.total,1);
});
test('失败只发已完成波次金币；收录成功不因失败回滚',()=>{
 const f=prepare(),[a,b]=living(f.game),c=f.game.merge('m',a.id,b.id);f.game.reveal('r');f.game.collect('collect',c.id);
 const r=f.game.snapshot.run,battle=battleFor(f.game);f.game.beginWave('next',r.id,battle);f.game.completeWave('lose',r.id,outcomeFixture(battle,false));
 assert.equal(f.game.snapshot.gold,332);assert.equal(Object.keys(f.game.snapshot.history).length,2);assert.ok(f.game.snapshot.collection[c.turtle.id]);
});
test('体力十分钟恢复、满体力不囤积、时间回拨不重置每日次数',()=>{
 const f=fixture();f.game.beginRun('r',1,['t-1']);assert.equal(f.game.snapshot.stamina,25);f.game.abandonRun('quit');
 f.clock.value+=20*60000;f.game.refreshClock('tick1');assert.equal(f.game.snapshot.stamina,27);
 f.game.simulateAd('energy','stamina');assert.equal(f.game.snapshot.stamina,30);
 f.clock.value-=12*3600000;f.game.refreshClock('tick2');assert.equal(f.game.snapshot.dailyAds.total,1);assert.equal(f.game.snapshot.stamina,30);
 f.clock.value=NOW+3*86400000;f.game.refreshClock('tick3');f.game.beginRun('r2',1,['t-1']);f.game.refreshClock('tick4');assert.equal(f.game.snapshot.stamina,25);assert.equal(f.game.snapshot.dailyAds.total,0);
});
test('广告模拟不能打断战斗或合成揭晓，刷新每局仅一次',()=>{
 const f=prepare();f.game.simulateAd('refresh','refresh');assert.throws(()=>f.game.simulateAd('refresh2','refresh'),/已用完/);
 const [a,b]=living(f.game);f.game.merge('m',a.id,b.id);assert.throws(()=>f.game.simulateAd('stamina','stamina'),/揭晓/);
 f.game.reveal('r');f.game.beginWave('fight',f.game.snapshot.run.id,battleFor(f.game));assert.throws(()=>f.game.simulateAd('stamina2','stamina'),/战斗/);
});
test('局内学技能不覆盖永久档案；培养重复点击只扣一次',()=>{
 const f=fixture();f.game.train('train','t-1','attack');f.game.train('train','t-1','attack');assert.equal(f.game.snapshot.gold,200);assert.equal(f.game.snapshot.collection['t-1'].training.attack,1);
 f.game.beginRun('run',0,['t-1']);wave(f.game);wave(f.game);const u=living(f.game)[0];assert.equal(u.turtle.skills.length,3);assert.equal(f.game.snapshot.collection['t-1'].skills.length,2);
 f.game.collect('saveNew',u.id);assert.equal(f.game.snapshot.history['t-1'].turtle.skills.length,2);assert.equal(f.game.snapshot.collection[u.turtle.id].skills.length,3);
});
test('五在场五替补时不能移出第六只替补，但可以直接交换',()=>{
 const f=fixture(),ids=Object.keys(f.game.snapshot.collection);f.game.beginRun('start',1,ids);
 for(let w=1;w<=9;w++){wave(f.game);f.game.recruit('recruit'+w,{candidateId:f.game.snapshot.run.recruitCandidates[0].id});}
 const units=living(f.game),field=units.find(u=>u.slot!==null),bench=units.find(u=>u.slot===null);
 assert.equal(units.length,10);assert.equal(units.filter(u=>u.slot===null).length,5);
 assert.throws(()=>f.game.moveUnit('sixth',field.id,null),/最多五只/);
 f.game.moveUnit('swap',bench.id,field.slot);assert.equal(living(f.game).filter(u=>u.slot===null).length,5);
});
test('旧局次或旧波次迟到回调不能替换当前战斗或再次发奖',()=>{
 const f=fixture();f.game.beginRun('start',1,['t-1']);const old=battleFor(f.game),runId=f.game.snapshot.run.id;wave(f.game);
 f.game.beginWave('wave2',runId,battleFor(f.game));const before=f.game.snapshot;
 assert.throws(()=>f.game.checkpointBattle('late',runId,old),/局次或波次/);
 assert.throws(()=>f.game.completeWave('lateWin',runId,outcomeFixture(old)),/局次或波次/);assert.deepEqual(f.game.snapshot,before);
 assert.throws(()=>f.game.checkpointBattle('otherRun','different-run',battleFor(f.game)),/局次或波次/);
});
test('缺损快照与倒退 tick 被拒绝，之前完整检查点仍可恢复',()=>{
 const f=fixture();f.game.beginRun('start',1,['t-1']);const b=battleFor(f.game),id=f.game.snapshot.run.id;f.game.beginWave('wave',id,b);
 stepBattle(b,1);f.game.checkpointBattle('cp1',id,b);const before=f.game.snapshot;
 assert.throws(()=>f.game.checkpointBattle('broken',id,{...b,units:undefined}),/损坏/);
 assert.throws(()=>f.game.checkpointBattle('back',id,battleFor(f.game)),/较早/);
 reopen(f);assert.deepEqual(f.game.snapshot,before);assert.doesNotThrow(()=>stepBattle(f.game.snapshot.run.battle,.05));
});
test('日常时钟刷新不会永久膨胀命令日志',()=>{
 const f=fixture();f.game.refreshClock('progression:bootstrap');const before=f.storage.getItem(SAVE_KEY).length;
 for(let i=0;i<1000;i++){f.clock.value+=1000;f.game.refreshClock('clock'+i);}
 assert.equal(Object.keys(f.game.snapshot.commands).length,0);assert.ok(f.storage.getItem(SAVE_KEY).length-before<100);
});
test('全部可发生数量分布归一；8+8 尾部与 0.05% 传说概率一致',()=>{
 for(let a=1;a<=12;a++)for(let b=1;b<=12;b++)for(let pool=Math.min(a,b);pool<=24;pool++){
  const d=countDistribution(a,b,pool);assert.ok(Math.abs(d.reduce((s,e)=>s+e.probability,0)-1)<1e-12);
  assert.ok(d.every(e=>e.value<=Math.min(pool,12)&&e.probability>=0));
 }
 const d=countDistribution(8,8,12),expected=[.0082,.0246,.082,.2132,.492,.12,.04,.0195,.0005];
 d.forEach((e,i)=>assert.ok(Math.abs(e.probability-expected[i])<1e-12));
 assert.equal(countDistribution(8,8,10).some(e=>e.value===12),false);
});
test('大量固定种子抽样：12 技能仍为稀有尾部，非截断造成的堆积',()=>{
 const distribution=countDistribution(8,8,12),rng={rng:0x712346};let legend=0;
 for(let i=0;i<1000000;i++)if(weighted(rng,distribution)===12)legend++;
 assert.ok(legend>400&&legend<600,`observed ${legend}/1000000`);
 const save=makeInitialSave(NOW,9),a=save.collection['t-1'],b=structuredClone(a);b.id='other';
 const allowed=skillsForRole('stone');a.skills=allowed.slice(0,8);b.skills=allowed.slice(4,12);
 assert.equal(combinedCountChance(previewFusion(a,b),12),.0005);
 let found=0;for(let i=0;i<10000;i++){
  const t=generateFusion(rng,a,b,'test-'+i,NOW);assert.equal(t.skills.length,new Set(t.skills).size);assert.ok(t.skills.every(s=>allowed.includes(s)));
  if(t.skills.length===12)found++;
 }
 assert.ok(found>0&&found<20,`found ${found}/10000 twelve-skill offspring`);
});
