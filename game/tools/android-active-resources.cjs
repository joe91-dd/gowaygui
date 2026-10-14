// Enumerate runtime resource entry points before following the Cocos dependency graph.
// Source assets stay untouched. Review-only models are deliberately not entry points.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
const root=path.resolve(__dirname,'../assets/scripts'),cache=new Map(),requests=[];
const cc={resources:{load(p){requests.push(p);}}};
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('ArtV2Assets.ts'))source+='\nexport {IMAGES};';
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:file})(id=>id==='cc'?cc:load(path.resolve(path.dirname(file),id+'.ts')),module,module.exports);
 return module.exports;
}
async function main(){
 const {ArtV2Assets,IMAGES}=load(path.join(root,'view/ArtV2Assets.ts'));
 const art=new ArtV2Assets();art.ensure=async()=>{};art.finishLoading=()=>{};art.preload();
 const entries=new Map(),add=(p,reason)=>entries.set(p,reason);
 for(const p of requests)add(p,'ArtV2Assets runtime effect');
 for(const key of IMAGES)add(key.startsWith('enemy-g1-')?'enemy-g1/icons/'+key.slice(9):art.imagePaths[key]?'art-modern/'+art.imagePaths[key]:'art-v2/'+key,'ArtV2Assets registered runtime image');
 const {ENEMY_G1,g1EnemyAssetKeys,enemyG1,endlessG1}=load(path.join(root,'core/enemyG1Catalog.ts'));
 for(const enemy of ENEMY_G1){add(enemy.model,'Current approved enemy catalog');add(enemy.icon,'Current enemy codex');}
 for(let level=0;level<=56;level++)for(const key of g1EnemyAssetKeys(level))if(!enemyG1(key))throw Error('Unmapped gameplay enemy: '+key);
 for(let wave=1;wave<=10000;wave++)if(!enemyG1(endlessG1(wave).key))throw Error('Unmapped endless enemy');
 const roles=['stone','spike','crystal','leaf','bubble'];
 for(const role of roles){
  add(`models-g1/${role}/${role}/${role}`,'Base battle turtle');
  for(const folder of ['advanced','advanced-weapons'])add(`models-g1/${folder}/${role}/${role}/${role}`,'In-battle rank 2/3 fusion');
  add(`models/${role}-turtle/${role}-turtle/${role}-turtle`,'HomeWorld startup dependency');
  add(`ui/portraits/portrait-${role}`,'TurtlePortraits startup dependency');
 }
 for(const id of ['s01','s02'])add(`models-g1/summons/${id}/${id}/${id}`,'Tide summons');
 for(const name of ['palm','rock','gem','guard-beacon','golem','demon','mako','shark','captain','armored'])add(`models-cc0/${name}/${name}/${name}`,'BattleWorld prop dependency');
 for(const name of ['light_02','flame_01','spark_04','star_04','trace_01','circle_05','cethiel-spells'])add(`models-g1/fx/${name}/texture`,'G1 battle effect');
 for(const p of ['models-approved/cast-energy','models-approved/fauna-aura','models-g1/g1-particle','ui/island-icons','ui/panels/panels-atlas','art-modern/sea-chart','art-modern/sailing-arrival','art-modern/sailing-honor','art-modern/sailing-mist'])add(p,'Shared live presentation');
 for(const name of ['home-island','tutorial-island','tidal-island','coral-bend','dusk-bay','boss-bay'])add(`environment/${name}/${name}/${name}`,'Home scene or old-save scene migration');
 add('models-fauna/fauna-00/fauna-00/fauna-00','Explicit enemyModelFor fallback');
 // These small, dynamically selected families are all runtime-used.
 const prefixes=['audio/','enemy-g1/variants/','vfx-approved/','battle-pearl/'];
 const report={version:1,sourceRoot:root,verifiedBattleMaps:57,verifiedEndlessWaves:10000,entries:Object.fromEntries([...entries].sort()),prefixes,notes:['No source files deleted.','Old model libraries and unreferenced art are omitted by dependency closure, not by file age.','Fusion and summons remain included.']};
 fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log('Runtime entry points:',entries.size);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
