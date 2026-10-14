// Replay the actual old/new bundles. Timing here measures JS rules/reads, not GPU or phone FPS.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const load=p=>require('./test-built-core.cjs').loadBuiltCore(path.resolve(p));
const before=load(process.argv[2]),after=load(process.argv[3]);
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(L,map,seed,rich=false){
 const C=n=>L.load(n),B=C('battle'),R=C('expeditionRules'),templates=Object.values(C('allMapsReview').allMapsReviewSave(1790424000000,rich,!rich).collection);
 const kind=map===50?'endless':map>=51&&map<=55&&map!==54?'raid':'chapter';
 const players=[{id:'local-player',templates}];if(kind==='raid')players.push({id:'guest',templates});
 const limit=kind==='raid'?C('raids').RAIDS[map===55?3:map-51].waves:undefined;
 const b=B.createBattle(map,1,[],{seed,rulesVersion:'0.6',mode:kind==='chapter'?'chapter':'endless',formationVersion:2,expedition:R.newExpedition(kind,map,players,limit)});if(kind==='raid')b.encounter='raid';
 const act=(action,args={})=>B.expeditionAction(b,'local-player',action,args);
 act('recruit');act('recruit');b.autoSkills=true;return {b,act,C,B,R};
}
function replay(L,map,seed,rich){
 const {b,act,C,B,R}=fixture(L,map,seed,rich);let merges=0,casts=0,heals=0,peak=0;
 const start=performance.now();
 for(let n=0;n<3600&&b.status==='fighting';n++){
  const p=b.expedition.players[0];if(p.choices.length)act('buff',{buff:p.choices[0]});
  if(n%10===0){
   if(p.coins>=C('expeditionEconomy').expeditionRecruitCost(b.expedition,p)&&(!b.expedition.cap||p.recruited<b.expedition.cap)&&b.units.length<p.slots.length)act('recruit');
   const alive=b.units.filter(u=>u.alive),a=alive.find(u=>alive.length>=5&&u.fusionRank<3&&alive.some(v=>v!==u&&v.role===u.role&&v.fusionRank===u.fusionRank));
   if(a){const v=alive.find(v=>v!==a&&v.role===a.role&&v.fusionRank===a.fusionRank);try{act('move',{a:a.id,slot:v.slot});merges++;}catch{}}
  }
  B.stepBattle(b,.1);const events=B.getBattleEvents(b);casts+=events.filter(e=>e.type==='skill').length;heals+=events.filter(e=>e.type==='heal').length;peak=Math.max(peak,b.enemies.filter(e=>e.alive).length);
 }
 const ms=performance.now()-start;C('battleValidation').validateBattle(b);
 return {state:JSON.stringify(b),ms,map,seed,rich,merges,casts,heals,peak,ticks:b.tick,status:b.status,wave:b.wave};
}
const replays=[];
for(const [map,rich] of [[0,false],[1,false],[4,false],[0,true],[9,true],[49,true],[50,true],[51,true],[53,true],[55,true]]){
 const a=replay(before,map,41,rich),b=replay(after,map,41,rich);assert.equal(b.state,a.state,`Changed deterministic battle map ${map}`);
 const {state,...row}=b;replays.push({...row,beforeMs:a.ms,afterMs:b.ms,sha256:crypto.createHash('sha256').update(state).digest('hex')});
 console.log('PASS identical battle',map,'wave',b.wave,'peak',b.peak);
}
function service(L){const C=n=>L.load(n);const g=new (C('game').GameService)(new (C('save').SaveRepository)(new (C('storage').MemoryStorage)()),{now:()=>1790240000000},41);g.enablePrototype('enable');g.beginPrototypeRun('begin',0,Object.keys(g.snapshot.collection));g.expeditionCommand('r1','recruit');g.expeditionCommand('r2','recruit');return g;}
const g=service(after),original=plain(g.snapshot),settings=g.settingsSnapshot,run=g.runSnapshot;
settings.autoSkills=!settings.autoSkills;settings.manualSkillTurtles=['foreign'];run.levelId=99;run.battle.units[0].hp=0;
assert.deepEqual(plain(g.snapshot),original,'Narrow reads must remain isolated');
const revision=g.revision;g.updateSettings('settings',{autoSkills:true});assert.equal(g.revision,revision+1);assert.equal(g.settingsSnapshot.autoSkills,true);
assert.throws(()=>g.expeditionCommand('bad','move',{a:'unknown',slot:99}));assert.equal(g.revision,revision+1,'failed transaction must not invalidate/advance state');
const measure=(fn,n=1000)=>{for(let i=0;i<100;i++)fn();const values=[];for(let r=0;r<5;r++){const t=performance.now();for(let i=0;i<n;i++)fn();values.push(performance.now()-t);}return values.sort((a,b)=>a-b)[2];};
const old=service(before),fresh=service(after),iterations=1000;
const reads={iterations,saveBytes:Buffer.byteLength(JSON.stringify(old.snapshot)),beforeMs:measure(()=>{for(let i=0;i<8;i++)void old.snapshot.settings;void old.snapshot.run;void old.snapshot.run;}),afterMs:measure(()=>{for(let i=0;i<8;i++)void fresh.settingsSnapshot;void fresh.revision;void fresh.revision;})};
const report={at:new Date().toISOString(),scope:'Identical deterministic simulations plus isolated read-loop microbenchmark. Not Android FPS/loading time.',replays,reads};
const out=path.resolve(__dirname,'../../output/android-performance-20260928/core-comparison.json');fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('PASS snapshot isolation/invalidation; read benchmark',JSON.stringify(reads));
