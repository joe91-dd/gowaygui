const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../node_modules/typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/platform/runtimeQuery.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const load=globals=>{const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,...globals});return module.exports.runtimeQuery;};
test('JSB location shim without URLSearchParams safely disables URL-only review features',()=>{
  const read=load({location:{href:'game.js',pathname:'game.js',search:'',hash:'',protocol:''}});
  for(const key of ['showcase','review','qa','gait','boss','themeWave','all-modes'])assert.equal(read().get(key),null);
  assert.equal(read().has('qa'),false);
});
test('Browser query parsing retains existing decoded values and live navigation',()=>{
  const location={search:'?map=4&boss=2&label=%E9%BE%9F%E9%BE%9F&qa=1'};
  const read=load({location,URLSearchParams});assert.equal(read().get('map'),'4');assert.equal(read().get('label'),'龟龟');assert.equal(read().has('qa'),true);
  location.search='?map=50';assert.equal(read().get('map'),'50');assert.equal(read().get('qa'),null);
});
