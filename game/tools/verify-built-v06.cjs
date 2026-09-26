const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadBuiltCore}=require('./test-built-core.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
function verify(){
  const loader=loadBuiltCore(),{GameService}=loader.load('game'),{MemoryStorage}=loader.load('storage'),{SaveRepository}=loader.load('save');
  const {currentUnits,pendingTakeaways}=loader.load('prototype'),{createBattle,stepBattle,getBattleEvents,commandBattle}=loader.load('battle');
  const {stageRewards,BOOK_WEIGHTS}=loader.load('prototypeConfig'),{skillsForRole}=loader.load('data');
  const storage=new MemoryStorage(),clock={now:()=>1788900000000};let service=new GameService(new SaveRepository(storage),clock,9137);
  const restart=()=>service=new GameService(new SaveRepository(storage),clock,9137),checks=[];
  service.enablePrototype('built:v06');const original=plain(service.snapshot.collection);
  const wave=()=>{
    const r=service.snapshot.run,b=createBattle(r.levelId,r.wave+1,currentUnits(r).filter(u=>u.slot!==null),{coreHealth:r.coreHealth,rulesVersion:'0.6',mode:r.mode});
    service.beginWave(`start:${r.id}:${b.wave}`,r.id,b);
    for(let i=0;i<1000&&b.status==='fighting';i++){b.units.forEach(u=>u.skills.forEach(id=>commandBattle(b,{type:'cast',unitId:u.id,skillId:id})));stepBattle(b,1);getBattleEvents(b);}
    assert.notEqual(b.status,'fighting');service.completeWave(`finish:${r.id}:${b.wave}`,r.id,b);return b;
  };
  service.beginPrototypeRun('built:chapter',0,Object.keys(original));
  const bench=()=>currentUnits(service.snapshot.run).filter(u=>u.benchSlot!==undefined);
  const [a,b]=bench();service.merge('built:fuse',a.id,b.id);const fixed=plain(service.snapshot.run),rng=service.snapshot.rng;restart();
  assert.deepEqual(plain(service.snapshot.run),fixed);service.reveal('built:reveal');assert.equal(service.snapshot.rng,rng);assert.equal(bench().length,4);
  const field=currentUnits(service.snapshot.run).find(u=>u.slot===0),incoming=bench()[1];
  service.deployBench('built:swap-out',incoming.id,0);assert.equal(service.snapshot.run.units[field.id].benchSlot,incoming.benchSlot);
  restart();service.moveUnit('built:swap-back',field.id,0);assert.equal(service.snapshot.run.units[field.id].slot,0);
  checks.push('actual built field-to-bench swap and return retain the permanent original');
  const locked=bench().find(u=>u.benchLocked).id;wave();assert.ok(bench().some(u=>u.id===locked));
  while(service.snapshot.run.phase!=='result')assert.equal(wave().status,'won');
  const carried=service.snapshot.results[service.snapshot.run.id].broughtIds;assert.ok(carried.length>1);assert.equal(pendingTakeaways(service.snapshot).length,0);
  for(const id of Object.keys(original))assert.deepEqual(plain(service.snapshot.collection[id]),original[id]);
  checks.push('actual built tutorial: five field + five bench, consumed parents, fixed reveal, locked refresh and only final survivors carried');
  const event=service.startOutsideFusion('built:outside',carried[0],carried[1]);restart();assert.deepEqual(plain(service.snapshot.outsideFusion),plain(event));
  service.revealOutsideFusion('built:outsideReveal');service.keepOutsideFusion('built:keep','A');assert.ok(service.snapshot.collection[carried[0]]);assert.equal(service.snapshot.collection[carried[1]],undefined);restart();
  checks.push('actual built outside fusion: restart keeps fixed C, keeping A consumes B and C');
  service.beginPrototypeRun('built:chapter1',1,Object.keys(original));while(service.snapshot.run.phase!=='result')assert.equal(wave().status,'won');
  assert.ok(service.snapshot.cleared.includes(1));
  service.beginPrototypeRun('built:endless',4,Object.keys(original),'endless');service.setBattleSpeed('built:speed',2);restart();assert.equal(service.snapshot.run.speed,2);
  while(service.snapshot.run.phase!=='result'){
    wave();const node=service.snapshot.run.rewardNodes.find(n=>n.chosen===undefined);
    if(node){const fixed=plain(node);restart();assert.deepEqual(plain(service.snapshot.run.rewardNodes.find(n=>n.wave===node.wave)),fixed);const grant=service.chooseEndlessReward(`reward:${node.wave}`,node.wave,(node.randomIndex+1)%5);assert.deepEqual(plain(grant),plain(node.choices[node.randomIndex]));}
    assert.ok(service.snapshot.run.wave<100,'bounded genuine run must settle');
  }
  const result=plain(service.snapshot.results[service.snapshot.run.id]);assert.equal(result.victory,false);assert.ok(result.waves>=20);assert.ok(result.stages.some(n=>n.grants.some(g=>g.pack==='ordinary')));
  const inventory=plain(service.snapshot.skillBooks);restart();assert.deepEqual(plain(service.snapshot.skillBooks),inventory);
  const book=Object.keys(inventory).find(id=>inventory[id]>0&&Object.values(service.snapshot.collection).some(t=>skillsForRole(t.role).includes(id)&&!t.skills.includes(id)));
  assert.ok(book);const turtle=Object.values(service.snapshot.collection).find(t=>skillsForRole(t.role).includes(book)&&!t.skills.includes(book));
  service.learnSkillBook('built:earnedBook',turtle.id,book);const reveal=plain(service.snapshot.bookReveal);restart();assert.deepEqual(plain(service.snapshot.bookReveal),reveal);service.finishBookReveal('built:bookReveal');
  const material=['attack','health','defense'].find(key=>result.materials[key]>0);assert.ok(material);service.train('built:earnedTraining',turtle.id,material);
  service.beginPrototypeRun('built:endlessAgain',4,Object.keys(original),'endless');
  checks.push('actual built chapter unlock and endless death: earned weighted books and materials persist, learning/training and second run work without injected resources');
  const fine=stageRewards({rng:9137},30);assert.ok(fine.some(g=>g.pack==='fine'));assert.ok(new Set(Object.values(BOOK_WEIGHTS).map(w=>w.normal)).size>3);
  checks.push('stage-30 fine pack uses its distinct weighted pool (configuration check; starter run is not claimed to reach wave 30)');
  return {status:'passed',generatedAt:new Date().toISOString(),loadedFiles:loader.loadedFiles,checks,endlessResult:result,scope:'Isolated MemoryStorage; actual Cocos built JS and production defaults. No browser/user save injection.'};
}
try{const report=verify(),tag=process.argv.includes('--v061')?'v061':'v06',target=path.resolve(__dirname,`../../docs/reports/${tag}-built.json`);fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}catch(error){console.error(error);process.exitCode=1;}
