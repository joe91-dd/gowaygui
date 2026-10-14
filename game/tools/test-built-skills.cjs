const {loadBuiltCore}=require('./test-built-core.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// This headless test exercises command persistence; the Cocos animation component is checked in-browser.
const build=path.resolve(process.argv[2]),loader=loadBuiltCore(build,{'chunks:///_virtual/IslandUI.ts':{UI_COLORS:{},color:x=>x},'chunks:///_virtual/BattleHudMotion.ts':{BattleHudMotion:{}}});
const {ActiveSkillControls}=loader.load('ActiveSkillControls'),{GameService}=loader.load('game'),{SaveRepository}=loader.load('save'),{MemoryStorage}=loader.load('storage');
const service=new GameService(new SaveRepository(new MemoryStorage()),{now:()=>1788830000000},731),t=Object.values(service.snapshot.collection)[0],battle={manualSkillTurtles:[]};let seq=0;
const controls=new ActiveSkillControls({toast(){}},{},service,()=>`built-skill:${++seq}`,fn=>fn(battle),()=>{},()=>{},()=>true);
controls.hold({turtleId:t.id});controls.hold({turtleId:t.id});
assert.deepEqual(Array.from(service.snapshot.settings.manualSkillTurtles),[t.id]);assert.deepEqual(Array.from(battle.manualSkillTurtles),[t.id]);assert.equal(controls.isAutomatic({turtleId:t.id}),false);
const report={status:'passed',build,checks:['Actual Cocos emitted skill hold saves a string array through the real GameService','Holding twice does not duplicate entries','Held skill is excluded from automatic casting']};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log(JSON.stringify(report));
