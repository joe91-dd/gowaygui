const test=require('node:test');
const assert=require('node:assert/strict');
const {runBuiltCoreRegression}=require('../tools/test-built-core.cjs');

test('actual Cocos web bundle can preview, generate, reveal and collect the first 3+2-skill fusion',t=>{
  const report=runBuiltCoreRegression();
  assert.equal(report.status,'passed',`${report.stage}\n${report.error||''}`);
  const main=report.loadedFiles.find(file=>file.relative==='assets/main/index.js');
  t.diagnostic(`Built artifact ${main.builtAt}; SHA256 ${main.sha256}. Rebuild after source edits.`);
  assert.equal(report.checks.length,3);
  assert.equal(report.output.sourceCount,2);
  assert.ok(report.executedModules.every(name=>name.startsWith('chunks:///_virtual/')));
});
