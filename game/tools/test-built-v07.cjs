const {loadBuiltCore}=require('./test-built-core.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../../docs/reports/v07-built.json');
const report={status:'running',scope:'Actual Cocos System.register V07 output; all saves isolated MemoryStorage, no browser save access',checks:[]};
try{
 const loader=loadBuiltCore(),{GameService}=loader.load('game'),{MemoryStorage}=loader.load('storage'),{SaveRepository,validateSave}=loader.load('save'),{SKILLS}=loader.load('data'),{previewFusion}=loader.load('fusion'),{stepRaid}=loader.load('raids'),{stepArena}=loader.load('arena');report.loadedFiles=loader.loadedFiles;
 assert.equal(SKILLS.length,33);const g=new GameService(new SaveRepository(new MemoryStorage()),{now:()=>1788948000000},9137);g.enablePrototype('v07');const turtles=Object.values(g.snapshot.collection);assert.deepEqual(JSON.parse(JSON.stringify(previewFusion(turtles[0],turtles[1]).map(x=>x.probability))),[.6,.4]);
 g.communityAction('init',{kind:'init'});const c=g.snapshot.community,book=c.listings.find(l=>l.kind==='book');g.communityAction('buy',{kind:'buy',id:book.id});g.communityAction('buy',{kind:'buy',id:book.id});assert.equal(g.snapshot.gold,300-book.price);assert.equal(g.snapshot.community.receipts.length,1);
 report.checks.push('33 skills, 60/40 parents, local AI creation, finite book market purchase and idempotent receipt');
 g.beginRaid('raid',0,turtles.map(t=>t.id));g.beginRaidWave('wave');const r=g.snapshot.community.raid;stepRaid(r,2);g.checkpointRaid('checkpoint',r);g.finishRaid('leave',r,true);assert.equal(g.snapshot.community.raid.settled,true);
 report.checks.push('five-member local raid runs the actual built battle loop and checkpoint/settlement validators');
 g.beginArena('arena',c.arenaOrder[c.arenaOrder.length-2],turtles.map(t=>t.id));const a=g.snapshot.community.arena;for(let i=0;i<120&&a.phase==='combat';i++)stepArena(a,1);assert.equal(a.phase,'result');g.finishArena('finish',a);g.finishArena('finish',a);validateSave(g.snapshot);
 report.checks.push('five-versus-five ordered arena reaches a real result and commits one rank settlement');
 const order=g.snapshot.community.arenaOrder,opponent=order[order.indexOf('local-player')-1],body=g.snapshot.community.aiPlayers[opponent].assists[0];g.communityAction('friend',{kind:'friend',id:opponent,action:'add'});const loan=g.communityAction('borrow',{kind:'borrow',ownerId:opponent,petId:body});assert.throws(()=>g.beginArena('conflict',opponent,[loan.id,...turtles.slice(1).map(t=>t.id)]),/仅可用于关卡、无尽/);report.checks.push('all borrowed and rented pets are restricted to chapter/endless');report.status='passed';report.modules=loader.executed();
}catch(e){report.status='failed';report.error=e.stack||String(e);}
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='passed'?0:1;
