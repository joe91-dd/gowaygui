const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync(__dirname+'/../assets/scripts/view/ChallengeScreen.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(){
 class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
 class Graphics{ellipse(){}fill(){}stroke(){}clear(){}rect(){}}
 class Node{static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel',NODE_DESTROYED:'destroy'};constructor(name){this.name=name;this.events={};}on(k,f){this.events[k]=f;}once(k,f){this.on(k,f);}addComponent(C){const g=new C();g.node=this;return g;}setPosition(){}destroy(){}}
 const slots=[{x:0,z:0},{x:200,z:0}],maps=[];maps[51]={slots};const mods={exports:{}};
 const cc={Vec3,Graphics,Node,screen:{windowSize:{width:1280,height:720}}};
 vm.runInNewContext(source,{setTimeout,clearTimeout,exports:mods.exports,module:mods,require:n=>n.endsWith('/development')?{petRange:()=>1.85}:n.endsWith('/placement')?{normalizedPoint:p=>p,placementIssue:()=>undefined,exchangePlacementIssue:()=>undefined}:n.endsWith('/raids')?{raidMapId:t=>51+t}:n==='cc'?cc:n.endsWith('/data')?{BATTLE_MAPS:maps,ROLES:{stone:{range:1.85}}}:n==='./IslandUI'?{color:x=>x,UI_COLORS:{}}:{}});
 const controller=Object.create(mods.exports.ChallengeScreen.prototype),nodes=[],moves=[];
 const raid={tier:0,phase:'prep',members:[{station:0,activeId:'mine',roster:[{id:'mine',turtle:{role:'stone'}}]}]};
 controller.raid=raid;controller.epoch=1;controller.camera={screenPointToRay:(x,y)=>({o:{x:x-640,y:10,z:360-y},d:{x:0,y:-1,z:0}}),worldToScreen:p=>new Vec3(640+p.x,360-p.z,0)};controller.world={showRange(){},tintRange(){}};
 controller.ui={root:new Node('root'),group:name=>{const n=new Node(name);nodes.push(n);return n;},text(){},battleFigure(){},toast(){}};
 controller.service={snapshot:{community:{raid}},selectRaidStation(_id,slot,point){moves.push(point);raid.members[0].station=slot;}};
 controller.command=()=> 'drag';controller.render=()=>{};controller.onError=e=>{throw e;};controller.stationMarkers();
 return{moves,hit:nodes.find(n=>n.name==='拖动我的副本伙伴'),Node};
}
test('raid drag commits an outside release but never an OS touch cancellation',()=>{
 for(const [eventCode,expected] of [['touch-end',[{x:200,z:-24}]],['touch-cancel',[]]]){
  const {hit,moves,Node}=fixture(),event=(x,y)=>({getLocation:()=>({x,y}),getEventCode:()=>eventCode});
  hit.events[Node.EventType.TOUCH_START](event(640,382));
  hit.events[Node.EventType.TOUCH_MOVE](event(840,384));
  hit.events[Node.EventType.TOUCH_CANCEL](event(840,384));
  assert.deepEqual(JSON.parse(JSON.stringify(moves)),expected);
 }
});
