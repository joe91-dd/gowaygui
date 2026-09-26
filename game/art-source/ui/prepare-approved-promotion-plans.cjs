/** Supplemental expected-copy records. Verify frozen candidates; do not copy art. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const UI=__dirname,ROOT=path.resolve(UI,'../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(p);
function verify(dir){const freeze=JSON.parse(read(path.join(dir,'source-freeze.json')));for(const f of freeze.files)assert.equal(sha(read(path.join(dir,f.path))),f.sha256,f.path+' changed after freeze');return{file:path.relative(ROOT,path.join(dir,'source-freeze.json')).replaceAll('\\','/'),sha256:sha(read(path.join(dir,'source-freeze.json'))),files:freeze.files.length};}
function record(dir,source,target,resourcePath){const p=path.join(dir,source),b=read(p);return{source:path.relative(ROOT,p).replaceAll('\\','/'),target,resourcePath,bytes:b.length,sha256:sha(b)};}
const panels=path.join(UI,'panels/candidate-01'),portraits=path.join(UI,'portraits/candidate-01');
const pFreeze=verify(panels),tFreeze=verify(portraits);
const pLayout=JSON.parse(read(path.join(panels,'layout.json')));
const panelPlan={status:'parent-reviewed-approved-candidate-promotion-planned-not-copied',sourceFreeze:pFreeze,
 supplementalManifest:'Created after source freeze; original frozen source files and freeze record remain unchanged.',
 approval:'Root visually opened comparison/small previews and accepted the equivalent contour. Cocos sliced sampling and seams remain unverified.',
 files:[record(panels,'panels-atlas.png','game/assets/resources/ui/island-panels.png','ui/island-panels')],
 texture:{width:512,height:1024,channels:'RGBA8',alpha:'straight alpha white masks',estimatedGfxBytes:2097152,filters:'LINEAR/LINEAR',mip:'NONE',wrap:'CLAMP_TO_EDGE'},
 atlasLayout:path.relative(ROOT,path.join(panels,'layout.json')).replaceAll('\\','/'),frames:pLayout.frames,
 cocos:{loadAs:'ImageAsset',oneOwnedTexture:true,sharedFrames:18,packable:false,spriteType:'SLICED',sizeMode:'CUSTOM',trim:false,localScale:.5,decorativeContentSize:'2*(w+4), 2*(h+4)',parentLayout:'unchanged w,h',colour:'Sprite.color, shared material',shadowFrame:'reuse radius-matching fill',shadowOffset:{x:3,y:-5}},
 runtimeFilesCopied:false,metaWritten:false,uiChanged:false};
const roles=['stone','spike','crystal','leaf','bubble'];
const portraitPlan={status:'parent-reviewed-approved-candidate-promotion-planned-not-copied',sourceFreeze:tFreeze,
 supplementalManifest:'Created after source freeze; original frozen source files and freeze record remain unchanged.',
 approval:'Root visually opened all five 384px PNGs and accepted character identity and transparent composition. Actual UI and phone readability remain unverified.',
 files:roles.map(role=>record(portraits,`portrait-${role}.png`,`game/assets/resources/ui/portraits/portrait-${role}.png`,`ui/portraits/portrait-${role}`)),
 texture:{eachWidth:384,eachHeight:384,channels:'RGBA8',alpha:'straight alpha transparent background',individualImages:5,totalEstimatedGfxBytes:5*384*384*4,filters:'LINEAR/LINEAR',mip:'NONE',wrap:'CLAMP_TO_EDGE'},
 cocos:{loadAs:'ImageAsset',spriteType:'SIMPLE',sizeMode:'CUSTOM',trim:false,rect:{x:0,y:0,width:384,height:384},originalSize:{width:384,height:384},offset:{x:0,y:0},anchor:{x:.5,y:.5},suggestedDisplay:'48–96 logical pixels; keep square full frame, preserve common framing; Cocos phone review required',sixtyFourPixelImages:'source review only; not planned for runtime copy'},
 runtimeFilesCopied:false,metaWritten:false,uiChanged:false};
fs.writeFileSync(path.join(panels,'promotion-plan.json'),JSON.stringify(panelPlan,null,2)+'\n');
fs.writeFileSync(path.join(portraits,'promotion-plan.json'),JSON.stringify(portraitPlan,null,2)+'\n');
console.log(JSON.stringify({frozenSourcesVerified:pFreeze.files+tFreeze.files,plannedFiles:6,runtimeCopies:0,panelTextureBytes:2097152,portraitTextureBytes:2949120}));
