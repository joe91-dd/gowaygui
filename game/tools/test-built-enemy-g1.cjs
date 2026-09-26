const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),config=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/config.json'),'utf8'));
const paths=new Set(Object.values(config.paths).map(entry=>entry[0]));
const ids=[...Array.from({length:10},(_,i)=>'B'+String(i+1).padStart(2,'0')),...Array.from({length:4},(_,i)=>'H0'+(i+1)),...Array.from({length:5},(_,i)=>'M0'+(i+1)),'E01'];
let clips=0,variants=0;
for(const id of ids){const key=id.toLowerCase(),base=`models-enemy-g1/${key}/${key}`;
 assert.ok(paths.has(`${base}/${key}`),id+' prefab missing from actual build');
 assert.ok(paths.has(`enemy-g1/icons/${key}`),id+' icon missing from actual build');
 for(const clip of ['idle','walk','attack','skill','hit','exit']){assert.ok(paths.has(`${base}/${clip}`),id+' '+clip+' missing from actual build');clips++;}
 if(id.startsWith('B')||id==='E01')for(const grade of ['blue','purple','orange','red','gold']){assert.ok(paths.has(`enemy-g1/variants/${key}/${grade}/texture`),id+' '+grade+' texture missing');variants++;}
}
const {loadBuiltCore}=require('./test-built-core.cjs');
const loader=loadBuiltCore(root),catalog=loader.load('enemyG1Catalog');
for(let level=0;level<=56;level++){
 const keys=catalog.g1EnemyAssetKeys(level);
 assert.ok(keys.length>=6,`map ${level} must preload the approved mobs`);
 assert.equal(new Set(keys).size,keys.length,`map ${level} duplicate model keys`);
 for(const key of keys){assert.equal(typeof key,'string',`map ${level}: emitted spread must yield strings, not a Set`);const asset=catalog.enemyG1(key);assert.ok(asset,`map ${level}: unknown ${key}`);assert.ok(paths.has(asset.model),`map ${level}: built prefab missing ${asset.model}`);}
}
const {ResourceLoadDeadline}=loader.load('ResourceLoadDeadline'),deadline=new ResourceLoadDeadline(0);
for(const [now,count] of [[60000,4],[120000,12],[180000,20]])assert.equal(deadline.expired(now,count,false),false,'steady loading must survive the old total timeout');
assert.equal(deadline.expired(270001,20,false),true,'stalled loading must remain bounded');
assert.equal(deadline.expired(900000,30,true),false,'completed loading must not fail on tab resume');
const report={status:'passed',build:root,prefabs:ids.length,icons:ids.length,animationClips:clips,mutationTextures:variants,mapPreloadLists:57,progressDeadline:true,loadedFiles:loader.loadedFiles};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
