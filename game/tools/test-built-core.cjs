const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');

const DEFAULT_BUILD=path.resolve(__dirname,'../build/web-mobile');
const plain=value=>JSON.parse(JSON.stringify(value));

/** Load the actual Cocos System.register output, including its emitted Babel helpers.
 * Only Cocos' script-registration bookkeeping is stubbed; no core source or TS test output is imported.
 */
function loadBuiltCore(buildDir=DEFAULT_BUILD,externals={}){
  const registrations=new Map(),instances=new Map(),loadedFiles=[];
  const cc={cclegacy:{_RF:{push(){},pop(){}}}};
  const register=(name,deps,declare)=>{
    if(typeof name!=='string'){
      declare=deps;deps=name;
      assert.equal(deps.length,0,'unexpected external dependency in bundle registration wrapper');
      declare(()=>{},{id:'bundle-registration',meta:{}}).execute();return;
    }
    assert.ok(!registrations.has(name),`duplicate built module ${name}`);
    registrations.set(name,{deps,declare});
  };
  const context=vm.createContext({System:{register},console,URL,setTimeout,clearTimeout});
  for(const relative of ['src/chunks/bundle.js','assets/main/index.js']){
    const filename=path.join(buildDir,relative);
    assert.ok(fs.existsSync(filename),`Cocos Web build is missing or incomplete: ${filename}. Run game/tools/build-web.ps1 before this regression.`);
    const source=fs.readFileSync(filename,'utf8');
    loadedFiles.push({relative,sha256:crypto.createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source),builtAt:fs.statSync(filename).mtime.toISOString()});
    vm.runInContext(source,context,{filename,timeout:10000});
  }
  function load(id){
    if(Object.prototype.hasOwnProperty.call(externals,id))return externals[id];
    if(id==='cc')return cc;
    const existing=instances.get(id);if(existing){assert.ok(existing.done,`unexpected core module cycle ${id}`);return existing.exports;}
    const definition=registrations.get(id);assert.ok(definition,`built module not found: ${id}`);
    const module={exports:{},done:false};instances.set(id,module);
    const exported=(name,value)=>{if(typeof name==='object')Object.assign(module.exports,name);else module.exports[name]=value;return value;};
    const record=definition.declare(exported,{id,meta:{url:id},import:()=>{throw new Error('unexpected dynamic import in core');}});
    definition.deps.forEach((dependency,index)=>{
      const resolved=dependency.startsWith('.')?new URL(dependency,id).href:dependency;
      record.setters[index](load(resolved));
    });
    record.execute();module.done=true;return module.exports;
  }
  return {load:name=>load(`chunks:///_virtual/${name}.ts`),loadedFiles,moduleCount:registrations.size,executed:()=>Array.from(instances.keys())};
}

function runBuiltCoreRegression(buildDir=DEFAULT_BUILD){
  const report={buildDir:path.resolve(buildDir),generatedAt:new Date().toISOString(),scope:'Validates the identified built JavaScript artifact. Source edits require a fresh Cocos build.',status:'running',stage:'load actual System.register output',checks:[]};
  try{
    const loader=loadBuiltCore(buildDir);report.loadedFiles=loader.loadedFiles;
    const {GameService}=loader.load('game'),{MemoryStorage}=loader.load('storage');
    const {SaveRepository,decodeSave,SAVE_KEY}=loader.load('save');
    const {createBattle,stepBattle,getBattleEvents}=loader.load('battle');
    const {validateBattle}=loader.load('battleValidation');
    const {previewFusion,generateFusion}=loader.load('fusion'),{skillsForRole}=loader.load('data');
    const storage=new MemoryStorage(),clock={now:()=>1788830000000};
    let service=new GameService(new SaveRepository(storage),clock,731);
    const restart=()=>{service=new GameService(new SaveRepository(storage),clock,731);};
    const initial=service.snapshot;
    const sourceIds=['spike','stone'].map(role=>Object.values(initial.collection).find(t=>t.role===role).id);
    const runId=service.beginRun('built:start',0,sourceIds);
    report.stage='two genuine tutorial waves with checkpoint and restart';
    for(let wave=1;wave<=2;wave++){
      const r=service.snapshot.run,units=Object.values(r.units).filter(u=>!u.consumedBy&&u.slot!==null);
      let battle=createBattle(0,wave,units,{coreHealth:r.coreHealth,seed:1000+wave});
      const bad=plain(battle);bad.units[0].skills=['not-a-real-skill'];
      assert.throws(()=>validateBattle(bad),'built validator must actually visit array iterators');
      service.beginWave(`built:begin:${wave}`,runId,battle);stepBattle(battle,2.375);getBattleEvents(battle);
      service.checkpointBattle(`built:checkpoint:${wave}`,runId,battle);const uninterrupted=plain(battle);
      restart();battle=service.snapshot.run.battle;assert.deepEqual(plain(battle),uninterrupted);
      stepBattle(battle,300);stepBattle(uninterrupted,300);assert.deepEqual(plain(battle),plain(uninterrupted));
      assert.equal(battle.status,'won');
      service.completeWave(`built:finish:${wave}`,runId,battle);
      if(wave===1)service.recruit('built:recruit',{permanentId:sourceIds[1]});
    }
    report.checks.push('real two-wave combat, malformed-skill validation and deterministic checkpoint recovery');
    const parents=Object.values(service.snapshot.run.units).filter(u=>!u.consumedBy);
    const spike=parents.find(u=>u.turtle.role==='spike'),stone=parents.find(u=>u.turtle.role==='stone');
    assert.deepEqual(plain(spike.turtle.skills),plain(initial.collection[sourceIds[0]].skills));assert.deepEqual(plain(stone.turtle.skills),plain(initial.collection[sourceIds[1]].skills));
    for(const u of [spike,stone])assert.equal(u.level,loader.load('development').levelInfo(u.turtle).level);
    report.parents=parents.map(u=>({role:u.turtle.role,skills:plain(u.turtle.skills),level:u.level}));
    report.stage='persistent skills and level, then fusion preview';
    const branches=previewFusion(spike.turtle,stone.turtle);
    assert.equal(branches.length,2);
    for(const branch of branches){
      const allowed=skillsForRole(branch.role),expected=Array.from(new Set(spike.turtle.skills.concat(stone.turtle.skills))).filter(id=>allowed.includes(id));
      assert.deepEqual(plain(branch.pool),expected);assert.ok(branch.pool.length>0);
      assert.ok(branch.pool.every(id=>typeof id==='string'));
      assert.ok(Math.abs(branch.counts.reduce((sum,x)=>sum+x.probability,0)-1)<1e-10);
    }
    report.pools=branches.map(b=>({role:b.role,skills:plain(b.pool)}));
    report.stage='generated offspring uses compatible unique skills';
    const random={rng:2831};
    for(let i=0;i<32;i++){
      const child=generateFusion(random,spike.turtle,stone.turtle,`probe-${i}`,clock.now());
      assert.ok(child.skills.length>=1&&child.skills.length<=12);
      assert.equal(new Set(child.skills).size,child.skills.length);
      assert.ok(child.skills.every(id=>skillsForRole(child.role).includes(id)));
    }
    report.checks.push('nonempty role-filtered union, normalized odds and 32 valid offspring');
    report.stage='service merge, reveal, comparison and collection';
    const before=service.snapshot.collection,child=service.merge('built:merge',spike.id,stone.id),savedRng=service.snapshot.rng;
    restart();assert.equal(service.snapshot.run.phase,'reveal');assert.deepEqual(plain(service.snapshot.collection),plain(before));
    assert.deepEqual(plain(service.merge('built:merge',spike.id,stone.id)),plain(child));assert.equal(service.snapshot.rng,savedRng);
    service.reveal('built:reveal');const preview=service.collectionPreview(child.id);
    assert.deepEqual(plain(preview.sources.map(t=>t.id).sort()),sourceIds.slice().sort());
    restart();assert.deepEqual(plain(service.snapshot.collection),plain(before));
    const collected=service.collect('built:collect',child.id);restart();
    assert.deepEqual(plain(service.collect('built:collect',child.id)),plain(collected));
    const after=service.snapshot;
    assert.equal(Object.keys(after.collection).length,Object.keys(before).length-1);
    assert.ok(after.collection[collected.id]);
    for(const id of sourceIds){assert.ok(!after.collection[id]);assert.equal(after.history[id].replacementId,collected.id);}
    assert.deepEqual(plain(decodeSave(storage.getItem(SAVE_KEY))),plain(after));
    report.checks.push('uncollected parents persist; confirmed collection retires both sources once; restart and duplicate commands preserve result');
    report.output={role:collected.role,skills:plain(collected.skills),sourceCount:sourceIds.length,historyCount:Object.keys(after.history).length};
    report.executedModules=loader.executed();report.status='passed';report.stage='complete';
  }catch(error){report.status='failed';report.error=error.stack||String(error);}
  return report;
}

module.exports={loadBuiltCore,runBuiltCoreRegression};
if(require.main===module){
  const args=process.argv.slice(2),reportIndex=args.indexOf('--report');
  const buildDir=args[0]&&!args[0].startsWith('--')?path.resolve(args[0]):DEFAULT_BUILD;
  const result=runBuiltCoreRegression(buildDir);
  if(reportIndex>=0){const filename=path.resolve(args[reportIndex+1]);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(result,null,2));}
  console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='passed'?0:1;
}
