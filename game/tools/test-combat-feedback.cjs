const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.argv[2]||'build/approved-mode-scenes-20260923';const code=fs.readFileSync(path.join(root,'assets/main/index.js'),'utf8');new vm.Script(code);
const handlers=[...code.matchAll(/_proto\.buildFeedback = (function buildFeedback\(battle, event\) \{[\s\S]*?\n        \});/g)].map(m=>m[1]);assert.equal(handlers.length,2);
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
const reports=[];
for(const [index,handler]of handlers.entries()){
 function render(event,casterX=-220){const shown=[],motions=[];const context={Math,Vec3,Color:class{},LabelOutline:class{},UI_COLORS:{ink:'#123'},SKILL_BY_ID:{hold:{active:true,name:'岩盾庇护'},encourage:{active:false,name:'鼓舞'}},screen:{windowSize:{width:1280,height:720}},isValid:n=>n.isValid,tween:()=>({to(duration,props){motions.push({duration,...props});return this;},call(){return this;},start(){}})};
 const fn=vm.runInNewContext('('+handler+')',context),self={feedbackTimes:new Map(),feedbackNodes:[],camera:{worldToScreen:p=>new Vec3(p.x+640,p.y+360,p.z)},screenPoint:p=>new Vec3(p.x-640,p.y-360,0),ui:{root:{},text(label,x,y,size,tint){shown.push({label,x,y,size,tint});return {node:{isValid:true,parent:{},addComponent:()=>({}),destroy(){}}};}}};
 const battle={tick:100,levelId:54,wave:1,units:[{id:'caster',x:casterX,z:0}],enemies:[{id:'target',x:300,z:0}]};fn.call(self,battle,{id:7,sourceId:'caster',targetId:'target',skillId:'hold',...event});return {shown,motions};}
 for(const event of [{type:'skill'},{type:'skill',skillId:'encourage'},{type:'control'}]){const r=render(event);assert.equal(r.shown[0].x,-220,'announcement must anchor to caster');assert.ok(r.motions[0].position.x>r.shown[0].x);assert.ok(r.motions[0].position.y>r.shown[0].y);}
 const right=render({type:'skill'},440);assert.equal(right.shown[0].x,440);assert.ok(right.motions[0].position.x<440,'right-side caster drifts inward');
 for(const type of ['damage','heal','shield']){const r=render({type,amount:50});assert.equal(r.shown[0].x,300,'number stays on recipient');assert.equal(r.motions[0].position.x,300);}
 const missing=render({type:'skill',sourceId:'missing',x:300,z:0});assert.equal(missing.shown.length,0,'unknown caster must not use target coordinates');
 const enemy=render({type:'skill',sourceId:'target',targetId:'caster'});assert.equal(enemy.shown[0].x,300,'enemy skill originates from its own caster');
 reports.push({implementation:index===0?'campaign/endless':'arena/local raid',checks:9,status:'passed'});
}
console.log(JSON.stringify(reports,null,2));fs.writeFileSync('temp/combat-text-caster-20260923/verification.json',JSON.stringify({at:new Date().toISOString(),reports},null,2));
