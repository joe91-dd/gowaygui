const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const file=path.resolve(__dirname,'../assets/scripts/core/faunaAura.ts'),mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports,module:mod,require:()=>({enemyG1Grade:(level,wave=1)=>Math.min(4,level===50?Math.floor(Math.max(0,wave-1)/100):Math.floor(Math.max(0,level)/10))})});
const {FAUNA_AURAS,faunaAuraGrade}=mod.exports;
test('five strength colours are distinct and rank progression is monotonic',()=>{
 assert.equal(FAUNA_AURAS.length,5);assert.equal(new Set(FAUNA_AURAS.map(v=>v.color)).size,5);
 const grades=Array.from({length:6},(_,i)=>faunaAuraGrade('boss',0,i));
 assert.deepEqual(grades,[0,1,2,3,4,4]);
 for(let i=1;i<grades.length;i++)assert.ok(grades[i]>=grades[i-1]);
 assert.notEqual(FAUNA_AURAS[2].color,FAUNA_AURAS[4].color);
});
test('world bosses retain gold, ordinary encounters do not compete with top-tier bosses',()=>{
 for(const level of [0,5,34,35,50,56,999]){
  assert.equal(faunaAuraGrade('boss',level,0,true),4);
  assert.ok(faunaAuraGrade('ink',level)<3);assert.ok(faunaAuraGrade('elite',level)<=4);
  assert.ok(faunaAuraGrade('elite',level)>=faunaAuraGrade('ink',level));
 }
});
