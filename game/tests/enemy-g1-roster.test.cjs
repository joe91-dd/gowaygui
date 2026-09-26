const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const cache=new Map();
function core(name){if(cache.has(name))return cache.get(name).exports;const m={exports:{}};cache.set(name,m);vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/core',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>core(n.replace('./','')),console});return m.exports;}
const {ENEMY_G1,ORDINARY_G1,ENEMY_G1_GRADES,enemyG1Grade,g1EnemyAssetKeys,WORLD_G1_IDS}=core('enemyG1Catalog'),{BOSSES,RAID_BOSSES,bossFor,ABILITIES}=core('bossCatalog');
test('50 campaign stages cover 36 distinct bosses, then reuse earlier identities at stronger tiers',()=>{
 assert.ok(ENEMY_G1.length>=68);assert.equal(new Set(ENEMY_G1.map(x=>x.id)).size,ENEMY_G1.length);assert.equal(ORDINARY_G1.length,36);
 const seen=new Set();
 for(let level=0;level<50;level++){
  const b=bossFor(level,1);seen.add(b.id);assert.equal(b.assetId,'B'+String(level%36+1).padStart(2,'0'));assert.equal(b.tier,Math.floor(level/10));assert.ok(ABILITIES[b.ability]);
  for(let wave=1;wave<=5;wave++)assert.equal(bossFor(level,wave).id,b.id);
  assert.ok(g1EnemyAssetKeys(level).includes(ORDINARY_G1[level%36].key));
 }
 assert.equal(seen.size,50);assert.equal(BOSSES.length,54);
 for(let i=1;i<5;i++)assert.ok(ENEMY_G1_GRADES[i].scale>ENEMY_G1_GRADES[i-1].scale);
});
test('four raid bosses and four world bosses use disjoint identities',()=>{
 assert.equal(RAID_BOSSES.length,4);[51,52,53,55].forEach((level,i)=>assert.equal(bossFor(level,1).assetId,'H0'+(i+1)));
 assert.equal(new Set(WORLD_G1_IDS).size,4);for(const id of WORLD_G1_IDS){assert.ok(ENEMY_G1.some(x=>x.id===id));assert.ok(!RAID_BOSSES.some(b=>b.assetId===id));}
 assert.ok(Math.min(...RAID_BOSSES.map(b=>b.hp))>Math.max(...BOSSES.filter(b=>b.tier<5).map(b=>b.hp)));
});
test('endless progresses through the 50 discovery encounters and preserves five mutation grades',()=>{
 for(let band=0;band<5;band++)for(let i=0;i<10;i++){
  const wave=band*100+(i+1)*10,b=bossFor(50,wave);assert.equal(b.assetId,'B'+String((band*10+i)%36+1).padStart(2,'0'));assert.equal(b.tier,band);assert.equal(enemyG1Grade(50,wave),band);
 }
 assert.equal(enemyG1Grade(50,900),4);assert.equal(enemyG1Grade(49),4);
});
test('ordinary save discovery IDs still resolve and every gameplay monster has a source',()=>{
 for(const id of ['reef-pirate','shark-captain','ink-oracle','abyss-warden','lobster-tyrant','tide-emperor','green-1','gold-5'])assert.ok(BOSSES.some(b=>b.id===id));
 for(const level of [0,50,51,52,53,55,56]){
  const keys=g1EnemyAssetKeys(level);assert.equal(new Set(keys).size,keys.length);for(const key of keys)assert.ok(ENEMY_G1.some(x=>x.key===key));
  for(const kind of ['ink','runner','armored','mist','snail','elite'])assert.ok(ENEMY_G1.some(x=>x.kind===kind&&keys.includes(x.key)));
 }
});
