const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const code=ts.transpileModule(fs.readFileSync(__dirname+'/../assets/scripts/view/HomeChat.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(){
 const now=1789200000000,storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(makeInitialSave(now,712)));
 const service=new GameService(new SaveRepository(storage),{now:()=>now});service.communityAction('init',{kind:'init'});
 const buttons=[],labels=[],edits=[],errors=[];let redraws=0,id=0;
 class EditBox{static InputMode={SINGLE_LINE:0};static InputFlag={DEFAULT:0};static EventType={TEXT_CHANGED:'changed'};}
 const node=()=>({on(){},addComponent(Type){const c=new Type();if(c instanceof EditBox)edits.push(c);return c;}});
 const ui={anchorInput(){},root:node(),panel:()=>node(),text(text){labels.push(text);return{};},button(text,x,y,w,h,action,options){const n=node();buttons.push({text,action,options});return n;}};
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require(name){if(name==='cc')return{EditBox,Label:{Overflow:{CLAMP:0}},Node:class{}};if(name==='./IslandUI')return{UI_COLORS:{}};if(name==='../core/community')return{LOCAL_PLAYER:'local-player'};throw Error(name);}});
 const state={expanded:true,channel:'world',recipient:'',draft:''};
 const render=()=>{buttons.length=0;labels.length=0;edits.length=0;module.exports.homeChat(ui,service,state,()=>redraws++,()=>`chat:${++id}`,e=>errors.push(e));};
 return{storage,service,state,buttons,labels,edits,errors,render,get redraws(){return redraws;}};
}
test('home chat sends through saved local transactions and keeps private content out of world',()=>{
 const f=fixture(),friend=f.service.snapshot.community.friends[0];
 f.service.communityAction('private-fixture',{kind:'chat',to:friend,text:'只给好友的阵容建议'});
 f.render();assert.ok(!f.labels.join('').includes('只给好友'));
 f.edits[0].string='这关用控制龟';f.buttons.find(b=>b.text==='发送').action();assert.equal(f.errors.length,0);assert.equal(f.state.draft,'');
 const restored=new GameService(new SaveRepository(f.storage),{now:()=>1789200000000});assert.ok(restored.snapshot.community.messages.some(m=>m.to==='world'&&m.text==='这关用控制龟'));
 f.state.channel='private';f.render();assert.ok(f.labels.join('').includes('只给好友'));assert.ok(!f.labels.join('').includes('这关用控制龟'));
});
test('system channel is read-only and collapsed chat draws only one information line',()=>{
 const f=fixture();f.state.channel='system';f.render();assert.equal(f.edits.length,0);assert.ok(!f.buttons.some(b=>b.text==='发送'));assert.ok(f.labels.some(s=>s.includes('本地测试')));
 f.state.expanded=false;f.render();assert.equal(f.buttons.length,1);assert.equal(f.edits.length,0);assert.equal(f.labels.filter(s=>s.startsWith('[系统]')).length,1);
 f.buttons[0].action();assert.equal(f.state.expanded,true);assert.equal(f.redraws,1);
});
test('empty messages are rejected without saving or clearing the draft',()=>{
 const f=fixture();f.render();const before=f.storage.getItem(SAVE_KEY);f.state.draft=' ';f.edits[0].string=' ';f.buttons.find(b=>b.text==='发送').action();assert.equal(f.errors.length,1);assert.equal(f.storage.getItem(SAVE_KEY),before);assert.equal(f.state.draft,' ');
});
