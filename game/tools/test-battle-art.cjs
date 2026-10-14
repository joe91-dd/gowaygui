const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const game=path.resolve(__dirname,'..');
const effects=path.join(game,'build/enemy-gait-20260926/assets/resources/import/46');
const file=fs.readdirSync(effects).find(n=>n.startsWith('46400649-2215-4fbb-a091-702c6c613b9f')&&n.endsWith('.json'));
assert.ok(file,'exported battle effect exists');
const data=JSON.parse(fs.readFileSync(path.join(effects,file),'utf8')),shaders=[],techniques=[];
function walk(x){if(!x||typeof x!=='object')return;if(x.glsl3&&x.glsl1)shaders.push(x);if(x.passes)techniques.push(x);for(const v of Object.values(x))walk(v);}walk(data);
assert.equal(shaders.length,1);assert.ok(techniques.length);
class EffectAsset{constructor(name){this.name=name;this.isValid=true;}onLoaded(){this.loaded=true;}}
const source=new EffectAsset('source');Object.assign(source,{shaders,techniques,combinations:[]});const before=JSON.stringify(source);
const exportsObject={},context={exports:exportsObject,require:n=>{assert.equal(n,'cc');return{EffectAsset};}};
const sourceTS=fs.readFileSync(path.join(game,'assets/scripts/view/BattleArtDirection.ts'),'utf8');
vm.runInNewContext(ts.transpileModule(sourceTS,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const derived=exportsObject.illustratedBattleEffect(source);
assert.equal(JSON.stringify(source),before,'shared source effect must remain unchanged');
assert.equal(exportsObject.illustratedBattleEffect(source),derived,'reuse shader instead of recompiling per material');
assert.ok(derived.loaded);assert.notEqual(derived.shaders[0].hash,source.shaders[0].hash);
for(const variant of ['glsl1','glsl3']){
 const frag=derived.shaders[0][variant].frag;assert.ok(frag.includes('keyParams.x > -0.5 && keyParams.x < 0.5'));
 assert.ok(frag.includes(variant==='glsl1'?'texture2D(mainTexture,flowUV+':'texture(mainTexture,flowUV+'));
 assert.equal(frag.split('Reduce microtexture').length,2);assert.ok(frag.includes('c *= mainColor;'));
}
for(const t of derived.techniques)for(const p of t.passes)assert.equal(p.program,derived.shaders[0].name);
const old=JSON.parse(fs.readFileSync(path.join(game,'build/coast-guards-20260927/script-build-manifest.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(game,'build/battle-art-20260927/script-build-manifest.json'),'utf8'));
let checked=0;for(const m of old.modules.filter(m=>m.source.replaceAll('\\','/').startsWith('assets/scripts/core/'))){assert.equal(current.modules.find(x=>x.source===m.source)?.sha256,m.sha256,'gameplay changed: '+m.source);checked++;}
console.log('PASS: WebGL 1/2 terrain shader variants, source isolation, program identity, effect cache; '+checked+' core modules unchanged.');
