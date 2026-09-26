const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const source=name=>fs.readFileSync(path.join(__dirname,'../assets/scripts/'+name+'.ts'),'utf8');
test('百波结算真实发箱，重新载入与重复领取不重复发奖',()=>{
  const core='../.test-build/core/',{makeInitialSave,GameService}=require(core+'game.js'),{enablePrototype,startPrototypeRun,settlePrototype}=require(core+'prototype.js'),{enableLiving}=require(core+'living.js'),{SaveRepository,SAVE_KEY,encodeSave,decodeSave}=require(core+'save.js');
  const now=Date.parse('2026-09-17T08:00:00+08:00'),save=makeInitialSave(now,71);enablePrototype(save);enableLiving(save);save.cleared=[0,1];save.unlockedLevel=2;
  const run=startPrototypeRun(save,now,50,Object.keys(save.collection).slice(0,5),'endless',()=>{throw Error('unused recruitment');});run.wave=100;run.phase='between';settlePrototype(save,run,false,now);
  const chest=save.progression.chests.find(item=>item.id==='endless:'+run.id+':100');assert.ok(chest);assert.ok(save.progression.chests.some(item=>item.title==='5波里程宝箱'));
  const count=save.progression.chests.length,rng=save.rng;settlePrototype(save,run,false,now);assert.equal(save.progression.chests.length,count);assert.equal(save.rng,rng);
  const data=new Map([[SAVE_KEY,encodeSave(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const game=new GameService(new SaveRepository(storage),{now:()=>now});game.claimChest('claim-100',chest.id);const gold=game.snapshot.gold;game.claimChest('claim-100',chest.id);assert.equal(game.snapshot.gold,gold);
  const restored=decodeSave(data.get(SAVE_KEY));assert.ok(restored.progression.chests.find(item=>item.id===chest.id).claimed);assert.equal(restored.endlessBest.waves,100);
});
function compile(text,require){const module={exports:{}};vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require});return module.exports;}
test('无尽海图包含百波，奖励保留所有十波档及百波后的兼容奖励',()=>{
  const policy=compile(source('core/endlessRewards'),()=>({}));
  assert.deepEqual(Array.from(policy.ENDLESS_ROUTE_WAVES),[5,10,20,30,50,80,100]);
  assert.deepEqual(Array.from(policy.endlessMilestoneWaves(100)),Array.from(policy.ENDLESS_REWARD_WAVES));
  assert.equal(policy.endlessMilestoneWaves(99).includes(100),false);assert.equal(policy.endlessMilestoneWaves(100).includes(100),true);
  assert.equal(policy.endlessMilestoneWaves(120).includes(120),true);assert.equal(policy.endlessMilestoneWaves(4).length,0);
});
test('海图运动支持动态关闭，销毁释放材质及高分辨率贴图',()=>{
  const callbacks=[],cc={Component:class{},resources:{load(...args){callbacks.push(args.at(-1));}},Vec4:class{constructor(...values){this.values=values;}},isValid:()=>true};
  const {SeaChartMotion}=compile(source('view/SeaChart'),name=>name==='cc'?cc:{color:()=>({})});
  const motion=new SeaChartMotion();motion.node={};const node={position:{x:12,y:19},setPosition(x,y){this.position={x,y};},setScale(){}};
  motion.drift(node,'ship');motion.update(.1);assert.notEqual(node.position.y,19);motion.reduced=()=>true;motion.update(.1);assert.equal(node.position.y,19);assert.equal(node.angle,0);
  let destroyed=0,released=0;motion.materials.push({destroy(){destroyed++;}});motion.effects.push({decRef(){released++;}});motion.owned.push({frame:{destroy(){destroyed++;}},texture:{destroy(){destroyed++;}},image:{decRef(){released++;}}});motion.onDestroy();assert.equal(destroyed,3);assert.equal(released,2);
  motion.surface({node:{}});callbacks[0](null,{addRef(){throw Error('late load must not attach');}});
});
test('五幅生产海图已入库，世界首领绑定每日服务端配置',()=>{
  for(const name of ['chapter','raid','endless','arena','world']){const bytes=fs.readFileSync(path.join(__dirname,'../assets/resources/art-modern/chart-'+name+'.png'));assert.equal(bytes.readUInt32BE(16),1672);assert.ok(bytes.readUInt32BE(20)>=940);}
  const world=source('view/WorldBossMenus');assert.match(world,/WORLD_BOSSES\[v.bossIndex\]/);assert.match(world,/chart.boss\(def.art/);assert.match(world,/before.bossIndex!==after.bossIndex/);
  assert.match(source('core/prototype'),/endlessMilestoneWaves\(r.wave\)/);
});
