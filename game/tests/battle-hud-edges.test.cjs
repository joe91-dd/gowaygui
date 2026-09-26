const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../assets/scripts/view/IslandUI.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
test('battle bands follow landscape viewport edges without shrinking touch targets or stretching portrait UI',()=>{
 const windowSize={width:1280,height:720},exports={};vm.runInNewContext(source,{exports,require:id=>id==='cc'?{screen:{windowSize},isValid:n=>n.valid}: {}});
 const ui=Object.create(exports.IslandUI.prototype),top={valid:true,setPosition(x,y){this.x=x;this.y=y;}},bottom={valid:true,setPosition(x,y){this.x=x;this.y=y;}};
 ui.battleAnchors=[{node:top,x:0,y:0,edge:'top',side:0},{node:bottom,x:188,y:-103,edge:'bottom',side:1}];ui.layoutBattleEdges();assert.equal(top.y,0);assert.equal(bottom.y,-103);
 Object.assign(windowSize,{width:554,height:373});ui.layoutBattleEdges();const extra=(373/(554/1280)-720)/2;assert.equal(top.y,extra);assert.equal(bottom.y,-103-extra);assert.equal(bottom.x,188);
 Object.assign(windowSize,{width:1600,height:720});ui.layoutBattleEdges();assert.equal(top.y,0);assert.equal(bottom.x,348);
 Object.assign(windowSize,{width:690,height:864});ui.layoutBattleEdges();assert.equal(top.y,0);assert.equal(bottom.x,188);assert.equal(bottom.y,-103);
 top.valid=false;ui.layoutBattleEdges();assert.equal(ui.battleAnchors.length,1);
});
