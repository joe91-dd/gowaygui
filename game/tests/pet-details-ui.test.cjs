const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
class Node{
 constructor(name){this.name=name;this.children=[];this.position={x:0,y:0};}
 on(){} addComponent(T){return new T();}
 removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 destroy(){this.destroyed=true;this.children.forEach(n=>n.destroy());}
}
Node.EventType={TOUCH_START:'start'};
class Graphics{fill(){}stroke(){}roundRect(){}rect(){}ellipse(){}moveTo(){}lineTo(){}close(){}}
const core=name=>require('../.test-build/core/'+name+'.js');
const UI_COLORS={ink:'#153B55',sand:'#527889'};
function fixture(){
 const save=core('game').makeInitialSave(Date.parse('2026-09-17T08:00:00+08:00'),731);core('prototype').enablePrototype(save);core('living').enableLiving(save);
 const pets=Object.values(save.collection);core('development').grantExperience(save,[pets[0].id],74);
 const ui={root:new Node('root'),art:{attach(){}},secondaryPage(){},click(){},feedback(){},share(){}};
 ui.group=(name,x=0,y=0,parent=ui.root,w=0,h=0)=>{const n=new Node(name);n.position={x,y};n.width=w;n.height=h;n.parent=parent;parent.children.push(n);return n;};
 ui.panel=(x,y,w,h,p)=>ui.group('panel',x,y,p,w,h);
 ui.text=(text,x,y,size,hex,p,w,h)=>{const n=ui.group(text,x,y,p,w,h);n.text=text;return n;};
 ui.line=()=>{};ui.progress=()=>{};ui.icon=()=>{};ui.bookIcon=()=>{};
 ui.portrait=(role,x,y,side,p)=>ui.group('portrait:'+role,x,y,p,side,side);
 ui.button=(text,x,y,w,h,action,options)=>{const n=ui.group('button:'+text,x,y,options.parent,w,h);n.text=text;n.action=()=>{if(!options.disabled)action();};n.disabled=options.disabled;return n;};
 ui.dialog=(title,subtitle,close,w,h)=>{const v=ui.group('dialog');return ui.group(title,0,0,v,w,h);};
 const service={snapshot:save,allocatePetPoints:(cmd,id,points)=>core('development').allocatePoints(save,id,points)};
 const module={exports:{}},source=fs.readFileSync(path.join(__dirname,'../assets/scripts/view/PetDetails.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>id==='cc'?{Node,Graphics,isValid:n=>!!n&&!n.destroyed}:id==='./IslandUI'?{UI_COLORS,color:()=>({})}:id==='./VisualIdentity'?{visualName:t=>t.name,HERO_LOOK:Object.fromEntries(['stone','spike','crystal','leaf','bubble'].map(r=>[r,{job:r}]))}:id.startsWith('../core/')?core(id.slice(8)):{}});
 const details=new module.exports.PetDetails(ui,service,k=>k,e=>{throw e;});
 const nodes=()=>{const out=[],walk=n=>{out.push(n);n.children.forEach(walk);};walk(ui.root);return out;};
 const click=text=>{const n=nodes().find(n=>n.name==='button:'+text);assert.ok(n,text);n.action();};
 return {ui,save,pets,details,nodes,click};
}
test('switching tabs preserves the portrait; allocating then saving persists exactly the available points',()=>{
 const f=fixture(),t=f.pets[0];f.details.show(t,{owned:true,learn(){}});const portrait=f.nodes().find(n=>n.name.startsWith('portrait:'));
 f.click('+3');assert.equal(f.nodes().filter(n=>n.name==='button:+3').every(n=>n.disabled),true);
 f.click('星级天赋');assert.equal(f.nodes().find(n=>n.name.startsWith('portrait:')),portrait);
 f.click('属性加点');f.click('保存加点');assert.equal(t.development.points.attack,3);assert.equal(core('development').levelInfo(t).available,0);assert.equal(f.nodes().find(n=>n.name==='button:保存加点').disabled,true);
});
test('switching pets discards the old draft and twelve skills fit above the footer',()=>{
 const f=fixture();f.details.show(f.pets[0],{owned:true});f.click('+3');f.details.show(f.pets[1],{owned:true});assert.deepEqual({...f.details.draft},{attack:0,health:0,defense:0});
 f.pets[1].skills=core('data').SKILLS.slice(0,12).map(s=>s.id);f.details.show(f.pets[1],{owned:true});f.click('技能 12/12');
 const tiles=f.nodes().filter(n=>n.name==='button:');assert.equal(tiles.length,12);assert.ok(tiles.every(n=>n.position.y-n.height/2>-261));assert.equal(f.nodes().filter(n=>n.name.startsWith('portrait:')).length,1);
});
test('foreign display snapshots with a colliding id remain read-only and do not resolve to our own pet',()=>{
 const f=fixture(),local=f.pets[0],other={...structuredClone(local),role:'bubble',name:'外部展示伙伴'};f.details.show(local,{owned:true});f.details.show(other,{readOnly:true});
 assert.equal(f.nodes().filter(n=>n.name==='portrait:bubble').length,1);assert.equal(f.nodes().filter(n=>n.name==='portrait:'+local.role).length,local.role==='bubble'?1:0);assert.equal(f.nodes().some(n=>n.name==='button:+3'),false);
});
