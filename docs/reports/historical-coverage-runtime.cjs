'use strict';
// Historical report loader only. Does not compile/write shared .test-build or execute current game modules.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const lf=value=>value.replace(/\r\n/g,'\n');
function compiler(){
  for(const name of [process.env.TYPESCRIPT_JS,process.env.GOWAYGUI_TYPESCRIPT,'typescript','C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)){
    try{return require(name);}catch{}
  }
  throw new Error('Historical replay needs the already-installed TypeScript compiler; no current-core fallback is permitted.');
}
function moduleLoader(codes){
  const cache=new Map();
  const load=name=>{
    name=path.posix.normalize(name);
    if(cache.has(name))return cache.get(name).exports;
    assert.ok(codes.has(name),`Unknown historical module ${name}; refusing to read current source or .test-build.`);
    const module={exports:{}};cache.set(name,module);
    const localRequire=id=>{
      if(!id.startsWith('.')){assert.ok(id.startsWith('node:'),`Unexpected historical dependency ${id}`);return require(id);}
      let target=path.posix.normalize(path.posix.join(path.posix.dirname(name),id));
      if(!path.posix.extname(target))target+='.js';
      return load(target);
    };
    localRequire.main=null;
    new Function('require','module','exports','__filename','__dirname',codes.get(name))(localRequire,module,module.exports,name,path.posix.dirname(name));
    return module.exports;
  };
  return load;
}
function createV1Runtime(){
  const ts=compiler(),fixtureRoot=path.join(root,'game/tests/fixtures/balance-v1');
  const provenance=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'provenance.json'),'utf8'));
  assert.equal(provenance.sourceCommit,'cf544b813771c7a9334f885c52703c43acb949db');
  const codes=new Map(),sourceSha256={};
  for(const file of provenance.files){
    const source=lf(fs.readFileSync(path.join(fixtureRoot,file.fixture),'utf8'));
    assert.equal(hash(source),file.sha256,'Frozen balance-v1 source changed');
    const name='game/.test-build/core/'+file.fixture.replace('.ts.txt','.js');
    codes.set(name,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
    sourceSha256['game/tests/fixtures/balance-v1/'+file.fixture]=file.sha256;
  }
  const load=moduleLoader(codes);
  return {load,data:load('game/.test-build/core/data.js'),battle:load('game/.test-build/core/battle.js'),sourceSha256,provenance:{kind:'frozen-balance-v1-fixture',sourceCommit:provenance.sourceCommit,typescriptVersion:ts.version}};
}
function createComparisonRuntime(){
  const ts=compiler(),fixtureRoot=path.join(__dirname,'fixtures/coverage-baseline-v2');
  const provenance=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'provenance.json'),'utf8'));
  assert.equal(ts.version,provenance.typescriptVersion,'Use the recorded compiler version for exact historical byte reproduction.');
  const originalText=lf(fs.readFileSync(path.join(root,provenance.historicalReport),'utf8'));
  assert.equal(hash(originalText),provenance.historicalReportSha256LF,'Original comparison report changed; refusing to overwrite or reinterpret it.');
  const originalReport=JSON.parse(originalText),codes=new Map();
  for(const entry of provenance.entries){
    const code=lf(fs.readFileSync(path.join(fixtureRoot,entry.fixture),'utf8'));
    assert.equal(hash(code),entry.sha256,'Historical compiled fixture changed');
    assert.equal(entry.sha256,originalReport.sourceSha256[entry.originalFile]);
    codes.set(entry.originalFile,code);
  }
  for(const entry of provenance.gitEntries){
    const source=cp.execFileSync('git',['show',provenance.gitCommit+':'+entry.source],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
    assert.equal(hash(source),entry.sourceSha256,`Pinned Git source changed: ${entry.source}`);
    const code=entry.source.endsWith('.ts')?ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText:source;
    assert.equal(hash(code),entry.compiledSha256,`Historical compiler output differs: ${entry.source}`);
    codes.set(entry.logicalModule,code);
  }
  const sourceSha256=Object.fromEntries(Object.keys(originalReport.sourceSha256).map(file=>{
    assert.ok(codes.has(file),`Missing historical report module ${file}`);
    return[file,hash(codes.get(file))];
  }));
  assert.deepEqual(sourceSha256,originalReport.sourceSha256,'Historical comparison must use all seven exact originally-recorded module hashes.');
  const load=moduleLoader(codes);
  return {load,data:load('game/.test-build/core/data.js'),battle:load('game/.test-build/core/battle.js'),sourceSha256,originalReport,provenance:{kind:'exact-recorded-baseline-v2-modules',gitCommit:provenance.gitCommit,compiledFixtures:provenance.entries.map(e=>({file:e.fixture,sha256:e.sha256,recovery:e.recovery})),typescriptVersion:ts.version,historicalReportSha256LF:provenance.historicalReportSha256LF}};
}
function replayDirectory(prefix){
  const parent=path.join(__dirname,'history-replays');fs.mkdirSync(parent,{recursive:true});
  // A fresh directory per run deliberately prevents replacing historical JSON/Markdown/SVG/PNG.
  return fs.mkdtempSync(path.join(parent,prefix+'-'));
}
module.exports={createV1Runtime,createComparisonRuntime,replayDirectory};
