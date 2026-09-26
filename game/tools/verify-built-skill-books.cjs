const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {loadBuiltCore}=require('./test-built-core.cjs');

const DEFAULT_BUILD=path.resolve(__dirname,'../build/web-mobile');
const NOW=1788830000000,SEED=0x6f73412,BOOK='openingShield';
const plain=value=>JSON.parse(JSON.stringify(value));
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');

/** Real Cocos System.register modules; only a fresh in-memory inventory is supplied.
 * This does not touch browser storage, award a drop, complete a wave or create a UI.
 */
function verifyBuiltSkillBooks(buildDir=DEFAULT_BUILD){
  const report={generatedAt:new Date().toISOString(),buildDir:path.resolve(buildDir),status:'running',stage:'load built modules',checks:[],
    stimulus:{storage:'Fresh MemoryStorage from the identified built bundle; no user/browser storage',clock:NOW,seed:SEED,
      successfulInventory:{openingShield:1},rejectionInventory:{greatHeal:1,armor:1},
      turtle:'A validated permanent stone turtle with exactly 12 compatible skills and no openingShield',
      provenance:'Inventories and 12-skill parent are controlled rule stimuli, not observed rewards, drops or fusion outcomes.'},
    notVerified:['Skill-book acquisition, drop rate and economic balance','UI, touch targets, rendering, audio or browser integration',
      'All 12 effects executing simultaneously in a complete combat','A completed wave, rewards, endless mode or platform packaging',
      'Storage hardware failure and multi-tab races (covered separately by source/service tests)']};
  let loader;
  const check=(id,description,run)=>{report.stage=id;const details=run();report.checks.push({id,status:'passed',description,...(details===undefined?{}:{details})});};
  try{
    loader=loadBuiltCore(report.buildDir);report.loadedFiles=loader.loadedFiles;
    // Hash actual bytes as well as the loader's UTF-8 input; fail if they differ.
    for(const file of report.loadedFiles){const raw=fs.readFileSync(path.join(report.buildDir,file.relative));assert.equal(digest(raw),file.sha256);assert.equal(raw.length,file.bytes);}
    report.bundleSha256=report.loadedFiles.find(file=>file.relative==='assets/main/index.js').sha256;
    const books=loader.load('skillBooks');
    assert.equal(typeof books.applySkillBook,'function','actual bundle must export skillBooks.applySkillBook');
    const {GameService,makeInitialSave}=loader.load('game'),{MemoryStorage}=loader.load('storage');
    const {SaveRepository,SAVE_KEY,validateSave,encodeSave,decodeSave}=loader.load('save');
    const {skillsForRole}=loader.load('data');
    const {createBattle,getBattleEvents}=loader.load('battle');
    const {validateBattle}=loader.load('battleValidation');
    check('module-present','The actual System.register skillBooks module and GameService learning entry exist',()=>{
      assert.equal(typeof GameService.prototype.learnSkillBook,'function');
      assert.ok(loader.executed().includes('chunks:///_virtual/skillBooks.ts'));
      return {module:'chunks:///_virtual/skillBooks.ts',entry:'GameService.learnSkillBook'};
    });
    function fixture(inventory){
      const initial=plain(makeInitialSave(NOW,SEED)),turtle=Object.values(initial.collection).find(t=>t.role==='stone');
      turtle.skills=plain(skillsForRole('stone')).filter(id=>id!==BOOK).slice(0,12);
      assert.equal(turtle.skills.length,12);assert.equal(new Set(turtle.skills).size,12);assert.equal(turtle.skills.includes(BOOK),false);
      initial.skillBooks=plain(inventory);validateSave(initial);
      const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(initial));
      let service=new GameService(new SaveRepository(storage),{now:()=>NOW},SEED);
      return {storage,id:turtle.id,get service(){return service;},restart(){service=new GameService(new SaveRepository(storage),{now:()=>NOW},SEED);}};
    }
    const f=fixture({[BOOK]:1}),before=plain(f.service.snapshot),parent=plain(before.collection[f.id]);
    let receipt,after;
    check('twelve-slot-learning','One successful real transaction replaces one slot, preserves 12 unique skills and consumes one book',()=>{
      receipt=plain(f.service.learnSkillBook('built-books:learn',f.id,BOOK));after=plain(f.service.snapshot);
      const learned=after.collection[f.id];
      assert.equal(learned.skills.length,12);assert.equal(new Set(learned.skills).size,12);assert.ok(learned.skills.includes(BOOK));
      assert.deepEqual(receipt.beforeSkills,parent.skills);assert.deepEqual(receipt.afterSkills,learned.skills);
      assert.ok(Number.isInteger(receipt.replacedIndex)&&receipt.replacedIndex>=0&&receipt.replacedIndex<12);
      assert.equal(receipt.replacedSkillId,parent.skills[receipt.replacedIndex]);assert.equal(learned.skills[receipt.replacedIndex],BOOK);
      assert.equal(learned.skills.filter((id,index)=>id!==parent.skills[index]).length,1);
      const {skills:oldSkills,...oldIdentity}=parent,{skills:newSkills,...newIdentity}=learned;
      assert.deepEqual(newIdentity,oldIdentity);assert.equal(after.skillBooks[BOOK],0);
      assert.equal(after.gold,before.gold);assert.deepEqual(after.materials,before.materials);assert.deepEqual(after.history,before.history);
      assert.equal(after.idCounter,before.idCounter);assert.equal(after.revision,before.revision+1);assert.notEqual(after.rng,before.rng);
      validateSave(after);assert.deepEqual(plain(decodeSave(f.storage.getItem(SAVE_KEY))),after);
      return {receipt,beforeRng:before.rng,afterRng:after.rng,bookBefore:1,bookAfter:0,revisionBefore:before.revision,revisionAfter:after.revision};
    });
    check('restart-idempotency','Restart and repeated command return the original receipt without another write, book or RNG draw',()=>{
      const raw=f.storage.getItem(SAVE_KEY),storageBefore=plain(f.storage.values);f.restart();
      assert.deepEqual(plain(f.service.snapshot),after);
      assert.deepEqual(plain(f.service.learnSkillBook('built-books:learn',f.id,BOOK)),receipt);
      assert.deepEqual(plain(f.service.snapshot),after);assert.equal(f.storage.getItem(SAVE_KEY),raw);assert.deepEqual(plain(f.storage.values),storageBefore);
      return {savedEnvelopeSha256:digest(raw),revision:after.revision,rng:after.rng};
    });
    check('battle-effect','The next genuine run carries all 12 learned skills; createBattle generates the new opening shield',()=>{
      const old=createBattle(0,1,[{id:'before-book',turtle:parent,level:1,slot:0}],{seed:913});
      assert.equal(old.units[0].shield,0);
      f.service.beginRun('built-books:next-run',0,[f.id]);
      const r=f.service.snapshot.run,inputs=Object.values(r.units).filter(u=>!u.consumedBy&&u.slot!==null);
      assert.equal(inputs.length,1);assert.deepEqual(plain(inputs[0].turtle.skills),receipt.afterSkills);
      const battle=createBattle(r.levelId,1,inputs,{coreHealth:r.coreHealth,seed:913});
      assert.deepEqual(plain(battle.units[0].skills),receipt.afterSkills);assert.equal(battle.units[0].skills.length,12);
      assert.ok(battle.units[0].shield>0);assert.ok(Math.abs(battle.units[0].shield-battle.units[0].maxHp*.1)<1e-7);
      assert.ok(getBattleEvents(battle).some(event=>event.type==='shield'&&event.skillId===BOOK&&event.amount>0));
      validateBattle(battle);validateSave(f.service.snapshot);
      return {skill:BOOK,unitSkillCount:battle.units[0].skills.length,shieldBefore:0,shieldAfter:battle.units[0].shield,maxHp:battle.units[0].maxHp,
        stage:'Real beginRun and createBattle only; no simulated victory, settlement or drop'};
    });
    check('rejected-requests','Incompatible, unknown, already-owned and malformed command requests leave inventory, RNG and storage unchanged',()=>{
      const reject=fixture({greatHeal:1,armor:1}),unchanged=plain(reject.service.snapshot),raw=plain(reject.storage.values),cases=[];
      for(const [command,id] of [['built-books:incompatible','greatHeal'],['built-books:unknown','not-a-skill'],['built-books:owned','armor'],['invalid command','greatHeal']]){
        assert.throws(()=>reject.service.learnSkillBook(command,reject.id,id));
        assert.deepEqual(plain(reject.service.snapshot),unchanged);assert.deepEqual(plain(reject.storage.values),raw);
        validateSave(reject.service.snapshot);assert.deepEqual(plain(decodeSave(reject.storage.getItem(SAVE_KEY))),unchanged);cases.push(id);
      }
      reject.restart();assert.deepEqual(plain(reject.service.snapshot),unchanged);return {cases,inventory:unchanged.skillBooks,rng:unchanged.rng};
    });
    check('built-iteration-validation','Built array iteration and Set uniqueness check later entries, both receipt arrays and role-compatible unions',()=>{
      const invalids=[];
      for(const inventory of [{openingShield:0,'not-a-skill':1},{openingShield:0,armor:-1}]){
        const bad=plain(after);bad.skillBooks=inventory;assert.throws(()=>validateSave(bad));assert.throws(()=>decodeSave(encodeSave(bad)));invalids.push('invalid second inventory entry');
      }
      const duplicate=plain(after),badReceipt=duplicate.commands['built-books:learn'].result;
      badReceipt.afterSkills[11]=badReceipt.afterSkills[10];assert.throws(()=>validateSave(duplicate));assert.throws(()=>decodeSave(encodeSave(duplicate)));invalids.push('duplicate in second receipt array at slot 12');
      const badRole=plain(after),last=Object.values(badRole.collection).at(-1);last.skills[last.skills.length-1]='hold';
      assert.notEqual(last.role,'stone');assert.throws(()=>validateSave(badRole));invalids.push('incompatible final skill of last collection entry');
      // A single union preview is sufficient to exercise the built Set -> Array
      // path that previously emitted an empty/boxed pool. It creates no offspring.
      const {previewFusion}=loader.load('fusion'),other=Object.values(after.collection).find(t=>t.role==='leaf');
      const branches=previewFusion(after.collection[f.id],other);assert.equal(branches.length,2);
      for(const branch of branches){
        const allowed=plain(skillsForRole(branch.role)),expected=Array.from(new Set(receipt.afterSkills.concat(other.skills))).filter(id=>allowed.includes(id));
        assert.ok(expected.length>0);assert.deepEqual(plain(branch.pool),expected);assert.ok(branch.pool.every(id=>typeof id==='string'));
      }
      return {invalids,unionPools:plain(branches.map(branch=>({role:branch.role,skills:branch.pool})))};
    });
    report.status='passed';report.stage='complete';
  }catch(error){report.status='failed';report.error=error.stack||String(error);}
  if(loader)report.executedModules=loader.executed();
  return report;
}

module.exports={verifyBuiltSkillBooks};
if(require.main===module){
  try{
    const args=process.argv.slice(2);let buildDir=DEFAULT_BUILD,reportPath,buildSet=false;
    for(let i=0;i<args.length;i++){
      const arg=args[i];
      if(arg==='--report'||arg==='--build-dir'){
        const value=args[++i];assert.ok(value&&!value.startsWith('--'),`${arg} requires a path`);
        if(arg==='--report'){assert.equal(reportPath,undefined,'duplicate --report');reportPath=path.resolve(value);}
        else{assert.equal(buildSet,false,'duplicate build directory');buildDir=path.resolve(value);buildSet=true;}
      }else{assert.ok(!arg.startsWith('-')&&!buildSet,`unexpected argument: ${arg}`);buildDir=path.resolve(arg);buildSet=true;}
    }
    // Refuse before evaluating a bundle, and use exclusive creation against races.
    if(reportPath)assert.ok(!fs.existsSync(reportPath),`Refusing to overwrite existing report: ${reportPath}`);
    const report=verifyBuiltSkillBooks(buildDir);
    if(reportPath){fs.mkdirSync(path.dirname(reportPath),{recursive:true});const fd=fs.openSync(reportPath,'wx');try{fs.writeFileSync(fd,JSON.stringify(report,null,2)+'\n');}finally{fs.closeSync(fd);}}
    console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='passed'?0:1;
  }catch(error){console.error(error.stack||String(error));process.exitCode=2;}
}
