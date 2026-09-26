const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const moduleUnderTest={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../assets/scripts/view/ResourceLoadDeadline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports});
const {ResourceLoadDeadline}=moduleUnderTest.exports;
test('a steadily loading roster may exceed 90 seconds without a false failure',()=>{
 const deadline=new ResourceLoadDeadline(1000);
 for(const [at,count] of [[21000,2],[81000,8],[141000,16],[201000,24]])assert.equal(deadline.expired(at,count,false),false);
 assert.equal(deadline.expired(230000,30,true),false);
});
test('a stalled request times out even when unrelated frames keep rendering',()=>{
 const deadline=new ResourceLoadDeadline(1000);deadline.expired(11000,4,false);
 assert.equal(deadline.expired(101001,4,false),true);
});
test('continuous trickle remains bounded and already-ready resources survive a long hidden tab',()=>{
 const deadline=new ResourceLoadDeadline(1000);
 for(let i=1;i<=5;i++)assert.equal(deadline.expired(i*50000,i,false),false);
 assert.equal(deadline.expired(301001,6,false),true);
 assert.equal(deadline.expired(900000,7,true),false);
});
