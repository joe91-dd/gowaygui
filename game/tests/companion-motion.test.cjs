const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
function fixture(role='stone',battle=false){
 class Material{constructor(){this.values={};this.uploads=0;this.passes=[{update:()=>this.uploads++}];}setProperty(k,v){this.values[k]=v;}destroy(){this.disposed=true;}}
 class Graphics{ellipse(){}fill(){}}
 class Node{static EventType={TOUCH_END:'tap',NODE_DESTROYED:'destroy'};constructor(){this.events={};this.position={x:0,y:0};this.scale={x:1,y:1};this.size={width:423,height:423};}setParent(){}setSiblingIndex(){}setPosition(x,y){this.position={x,y};}addComponent(C){return new C();}getComponent(){return{contentSize:this.size,setContentSize:(width,height)=>{this.size={width,height};}};}on(k,f){this.events[k]=f;}once(k,f){this.on(k,f);}}
 class Vec4{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}}
 const cc={Material,Graphics,Node,Vec4,Color:class{},isValid:x=>!x.dead,UITransform:class{}};const modules={};
 function load(name){if(modules[name])return modules[name];const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../assets/scripts/view/'+name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:id=>id==='cc'?cc:load(id.slice(2))});return modules[name]=mod.exports;}
 const original=new Material(),renderMaterial=new Material(),sprite={customMaterial:original,node:new Node(),getMaterialInstance:()=>renderMaterial},frame={rect:{x:280,y:253,width:280,height:263},texture:{width:1122,height:1402}},art={companionMaterial:()=>new Material(),battleFrame:()=>frame};
 const motion=new (load('CompanionMotion').CompanionMotion)(sprite,role,new Node(),art);
 return{motion,sprite,frame,original,load,Material,renderMaterial};
}

test('home animation preserves one original pose continuously and repeat clicks do not snap its joints',()=>{
 const a=fixture('leaf'),b=fixture('crystal');const frame=a.sprite.spriteFrame,m=a.renderMaterial;assert.notEqual(m,a.original);
 let previous=m.values.rigAngles;for(let i=0;i<800;i++){if(i%9===0)a.sprite.node.events.tap();a.motion.update(1/60);assert.equal(a.sprite.spriteFrame,frame);const current=m.values.rigAngles;assert.ok(Math.abs(current.x-previous.x)<.025&&Math.abs(current.y-previous.y)<.025);previous={...current};}
 assert.equal(a.sprite.node.position.y,0);assert.equal(a.sprite.node.scale.y,1);assert.equal(b.renderMaterial.values.rigParams.x,0);assert.ok(m.uploads>=800);assert.equal(a.sprite.customMaterial.values.rigParams,undefined,'updates reach the actual renderer, not a detached source material');
 a.motion.update(.02,true);assert.equal(m.values.rigParams.w,0);assert.equal(m.values.rigAngles.x,0);assert.equal(m.values.rigBody.z,0);
 a.sprite.node.events.destroy();assert.ok(a.sprite.customMaterial.disposed);assert.ok(!m.disposed,'render instance belongs to its component');assert.ok(!a.original.disposed);
});

test('emitter expansion preserves the apparent character size and gives weapons room outside their crop',()=>{
 const f=fixture('crystal'),m=f.renderMaterial.values;
 assert.ok(m.rigShape.y>1.4);
 assert.equal(f.sprite.node.size.height/m.rigShape.y,423);
 assert.ok(Math.abs(f.sprite.node.size.width/m.rigShape.y-423*f.frame.rect.width/f.frame.rect.height)<1e-9);
 assert.ok(m.rigWeapon.w>.4);assert.ok(m.rigHandle.x<.3);
 const data=f.load('CompanionRigData');for(const bank of [data.HOME_RIG,data.BATTLE_RIG]){
   for(const role of ['spike','crystal','leaf','bubble']){const p=bank[role];assert.ok(p.weapon[2]>0&&p.weapon[3]>0);assert.ok(p.handle[3]>0&&p.handle[3]<1);}
   assert.ok(bank.stone.gear6[1]>.7,'toes receive their own local emission region');
 }
});

test('blinks close fully, reopen more slowly, and do not synchronize all five faces',()=>{
 const {blinkAmount,ROLE_NUMBER}=fixture().load('CompanionRigData');
 for(const role of Object.keys(ROLE_NUMBER)){
   let previous=0,closed=0,closing=0,opening=0,active=0;
   for(let i=0;i<10000;i++){
     const value=blinkAmount(role,i/1000);assert.ok(value>=0&&value<=1);
     assert.ok(Math.abs(value-previous)<.025,'no abrupt pop in the eyelid motion');
     if(value>.99)closed++;if(value>previous)closing++;if(value<previous)opening++;if(value>0)active++;
     previous=value;
   }
   assert.ok(closed>15);assert.ok(opening>closing);assert.ok(active<700,'eyes remain open between blinks');
 }
 assert.notEqual(blinkAmount('stone',4.06),blinkAmount('crystal',4.06));
});

test('source-space emitters distinguish home and combat weapon sides and retain original atlas coordinates',()=>{
 const f=fixture('bubble'),{CompanionRig}=f.load('CompanionRig'),mat=new f.Material(),battle=new CompanionRig(mat,'bubble',f.frame,true);
 assert.ok(f.renderMaterial.values.rigGear.x<.3);assert.ok(mat.values.rigGear.x>.7,'combat summoner staff is on the opposite side');
 assert.equal(mat.values.rigRect.x,f.frame.rect.x/f.frame.texture.width);assert.equal(mat.values.rigRect.z,f.frame.rect.width/f.frame.texture.width);
 const data=f.load('CompanionRigData');for(const role of Object.keys(data.HOME_RIG))for(const p of [data.HOME_RIG[role],data.BATTLE_RIG[role]])for(const key of ['gear','gear2','gear3'])assert.ok(p[key][0]>0&&p[key][0]<1&&p[key][1]>0&&p[key][1]<1);
 battle.update(.05);assert.ok(mat.values.rigParams.x>0);battle.destroy();assert.ok(mat.disposed);
});
