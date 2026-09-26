const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const load=process.argv[2]?require('./test-built-core.cjs').loadBuiltCore(path.resolve(process.argv[2])).load:n=>require('../.test-build/'+(n==='storage'?'platform':'core')+'/'+n+'.js');
const plain=x=>JSON.parse(JSON.stringify(x));
const {BATTLE_MAPS}=load('data'),{GameService,makeInitialSave}=load('game'),{MemoryStorage}=load('storage'),{SaveRepository}=load('save');
const {createBattle,moveBattleUnit,stepBattle}=load('battle'),{moveRaidStation}=load('raids'),{exchangePlacementIssue,placementIssue}=load('placement');
const pets=Object.values(makeInitialSave(1788830000000,731).collection).slice(0,5),position=(m,u)=>u.placement??m.slots[u.slot];
let checks=0;
for(const m of BATTLE_MAPS){
 const b=createBattle(m.id,1,pets.map((turtle,slot)=>({id:'swap-'+slot,turtle,slot,level:1,placement:slot<2?{...m.slots[slot]}:undefined})),{rulesVersion:'0.6',mode:'endless'});
 const [a,c]=b.units,pa=plain(position(m,a)),pc=plain(position(m,c));
 assert.equal(exchangePlacementIssue(m,pc,pa,b.units.slice(1).map(u=>position(m,u))),undefined);
 moveBattleUnit(b,a.id,c.slot);assert.deepEqual(plain(position(m,a)),pc);assert.deepEqual(plain(position(m,c)),pa);
 assert.equal(a.moveReadyTick,b.tick+160);assert.equal(c.moveReadyTick,b.tick+160);
 const after=JSON.stringify(b);assert.throws(()=>moveBattleUnit(b,a.id,c.slot),/冷却/);assert.equal(JSON.stringify(b),after);
 b.spawns=[{kind:"runner",time:100,hpScale:1,attackScale:1}];stepBattle(b,1.1);assert.ok(Math.hypot(a.x-pc.x,a.z-pc.z)<1e-8);assert.ok(Math.hypot(c.x-pa.x,c.z-pa.z)<1e-8);
 assert.equal(new Set(b.units.map(u=>u.slot)).size,5);checks++;
}
for(const tier of [0,1,2,3])for(const combat of [false,true]){
 const m=BATTLE_MAPS[tier===3?55:51+tier],b=createBattle(m.id,1,pets.map((turtle,slot)=>({id:'raid-'+slot,turtle,slot,level:1,placement:{...m.slots[slot]}})),{rulesVersion:'0.6',mode:'endless'});
 const r={tier,phase:combat?'combat':'prep',battle:b,members:b.units.map((u,i)=>({activeId:u.id,station:i,placement:plain(m.slots[i]),roster:[{id:u.id}]}))};
 const identities=r.members.map(u=>u.activeId),pa=plain(r.members[0].placement),pb=plain(r.members[1].placement);
 moveRaidStation(r,0,0,pb);assert.deepEqual(r.members[0].placement,pb);assert.deepEqual(r.members[1].placement,pa);assert.deepEqual(r.members.map(u=>u.activeId),identities);
 if(combat){assert.deepEqual(plain(b.units[0].placement),pb);const before=JSON.stringify(r);assert.throws(()=>moveRaidStation(r,0,1,pa),/冷却/);assert.equal(JSON.stringify(r),before);}checks++;
}
// A blocked recipient must reject atomically even when the dragged turtle is ready.
for(const blocked of ['cooldown','fallen']){
 const b=createBattle(0,1,pets.map((turtle,slot)=>({id:'blocked-'+slot,turtle,slot,level:1})),{rulesVersion:'0.6',mode:'chapter'});
 if(blocked==='cooldown')b.units[1].moveReadyTick=160;else b.units[1].alive=false;
 const before=JSON.stringify(b);assert.throws(()=>moveBattleUnit(b,b.units[0].id,1),/冷却|倒下/);assert.equal(JSON.stringify(b),before);checks++;
}
const {createWorldBossFight,worldBossAction}=load('worldBoss');
const f=createWorldBossFight('swap','day',0,pets,1788830000000),[wa,wb]=f.battle.units,ma=BATTLE_MAPS[56],pa=plain(position(ma,wa)),pb=plain(position(ma,wb));
worldBossAction(f,'move',{unitId:wa.id,point:pb});assert.deepEqual(plain(position(ma,wa)),pb);assert.deepEqual(plain(position(ma,wb)),pa);checks++;
// Execute the actual screen drag handlers: a core-only test misses the former UI veto.
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
class Node{static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel',NODE_DESTROYED:'destroy'};constructor(){this.events={};this.children=[];}on(k,f){this.events[k]=f;}off(){}once(k,f){this.on(k,f);}setPosition(){}destroy(){}getComponent(){}}
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('assets/scripts/view/BattleScreen.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports,module:mod,setTimeout,clearTimeout,require:n=>n==='cc'?{Vec3,Node}:n.startsWith('../core/')?load(n.split('/').at(-1)):n==='./IslandUI'?{UI_COLORS:{ink:'#000'}}:{}});
for(const phase of ['prep','combat'])for(const cancel of [false,true]){
 const service=new GameService(new SaveRepository(new MemoryStorage()),{now:()=>1788830000000},731);service.enablePrototype('enable');service.beginPrototypeRun('start',0,Object.keys(service.snapshot.collection).slice(0,5));
 let r=service.snapshot.run,units=Object.values(r.units).filter(u=>u.slot!==null),m=BATTLE_MAPS[0];
 service.placeUnit('custom-a',units[0].id,{x:m.slots[0].x+.02,z:m.slots[0].z});service.placeUnit('custom-b',units[1].id,{x:m.slots[1].x+.02,z:m.slots[1].z});
 if(phase==='combat'){r=service.snapshot.run;service.beginWave('wave',r.id,createBattle(0,1,Object.values(r.units).filter(u=>u.slot!==null),{rulesVersion:'0.6',mode:'chapter',waveLimit:5,coreHealth:20}));}
 const controller=Object.create(mod.exports.BattleScreen.prototype),labels=[],toasts=[],node=new Node();
 Object.assign(controller,{service,battle:service.snapshot.run.battle,pageEpoch:0,benchTargets:new Map(),dropTargets:new Map(),world:{showRange(){},tintRange(){}},camera:{worldToScreen:v=>v},screenPoint:p=>p,groundPoint:p=>({x:p.x/100,z:p.y/100}),setMoving(){},act:fn=>fn(),command:k=>'drag-'+k,ui:{root:new Node(),isInteractive:()=>true,battleLandingIssue:()=>undefined,group:()=>new Node(),panel:()=>new Node(),battleFigure(){},text:()=>{const t={string:''};labels.push(t);return t;},toast:s=>toasts.push(s)}});
 units=Object.values(service.snapshot.run.units).filter(u=>u.slot!==null);const [a,b]=units,p1=plain(position(m,a)),p2=plain(position(m,b));
 controller.attachBenchDrag(node,a.id,true);const ev=p=>({getLocation:()=>({x:p.x*100,y:p.z*100}),getEventCode:()=>cancel?'cancel':'end'});
 node.events.start(ev(p1));node.events.move(ev(p2));assert.equal(labels.at(-1).string,'松手互换位置');node.events[cancel?'cancel':'end'](ev(p2));
 assert.deepEqual(toasts,[]);const result=service.snapshot.run;assert.deepEqual(plain(position(m,result.units[a.id])),cancel?p1:p2);assert.deepEqual(plain(position(m,result.units[b.id])),cancel?p2:p1);
 if(phase==='combat'&&!cancel){const [ba,bb]=result.battle.units;assert.deepEqual(plain(position(m,ba)),p2);assert.deepEqual(plain(position(m,bb)),p1);}
 checks++;
}
const m=BATTLE_MAPS[0];assert.ok(exchangePlacementIssue(m,m.route[0],m.slots[0],[m.slots[1]]));assert.equal(exchangePlacementIssue(m,m.slots[2],m.slots[0],[m.slots[1]]),undefined);
console.log(JSON.stringify({checks,all57Maps:true,raidPrepAndCombat:true,worldBoss:true,actualDragHandlers:true,cancelAndCooldown:true,build:process.argv[2]??'source'}));



