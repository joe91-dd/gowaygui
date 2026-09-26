const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
test('unused artwork does not upload textures; shared background aliases allocate and release once',()=>{
 let uploads=0,destroyedTextures=0,destroyedFrames=0;const requests=[];
 class ImageAsset{constructor(){this.width=2048;this.height=1024;this.refs=0;}addRef(){this.refs++;}decRef(){this.refs--;}}
 class Texture2D{static Filter={LINEAR:1,NONE:0};static WrapMode={CLAMP_TO_EDGE:0};constructor(){uploads++;}setFilters(){}setMipFilter(){}setWrapMode(){}destroy(){destroyedTextures++;}}
 class SpriteFrame{destroy(){destroyedFrames++;}}
 class Color{static WHITE={};}class Rect{constructor(...v){this.values=v;}}class Size{}class EffectAsset{}
 const cc={ImageAsset,Texture2D,SpriteFrame,Color,Rect,Size,EffectAsset,isValid:()=>true,resources:{load(path,type,callback){requests.push({path,type,callback});}}};
 const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(__dirname+'/../assets/scripts/view/ArtV2Assets.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='cc'?cc:name.includes('enemyG1Catalog')?{ENEMY_G1:[],WORLD_G1_IDS:[]}:{} });
 const art=new module.exports.ArtV2Assets();art.finishLoading=()=>{};art.preload();
 const shared=new ImageAsset(),unused=new ImageAsset();
 const aliases=requests.filter(r=>r.path==='art-modern/home-environment-full');assert.equal(aliases.length,3);
 aliases.forEach(r=>r.callback(null,shared));requests.find(r=>r.path==='art-modern/honor-terrace').callback(null,unused);
 assert.equal(uploads,0);assert.equal(shared.refs,1);assert.equal(unused.refs,1);
 const home=art.battleFrame('home-background'),login=art.battleFrame('login-background');assert.equal(home,login);assert.equal(uploads,1);
 art.destroy();assert.equal(uploads,1,'destroy must not upload unused artwork');assert.equal(destroyedTextures,1);assert.equal(destroyedFrames,1);assert.equal(shared.refs,0);assert.equal(unused.refs,0);
});
