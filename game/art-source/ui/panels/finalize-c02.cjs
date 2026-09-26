'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const old=path.join(__dirname,'candidate-01'),next=path.join(__dirname,'candidate-02');
const bytes=(base,p)=>fs.readFileSync(path.join(base,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(path.join(next,'source-freeze.json')))throw new Error('Candidate already frozen');
const oldFreeze=JSON.parse(bytes(old,'source-freeze.json'));
for(const entry of oldFreeze.files){const b=bytes(old,entry.path);assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256,entry.path);}
const oldLayout=JSON.parse(bytes(old,'layout.json')),layout=JSON.parse(bytes(next,'layout.json')),inspect=JSON.parse(bytes(next,'inspection.json'));
assert.equal(layout.frames.length,30);assert.equal(inspect.checks.length,30);
for(const frame of oldLayout.frames){assert.deepEqual(layout.frames.find(f=>f.id===frame.id),frame);assert.deepEqual(bytes(old,'png/'+frame.id+'.png'),bytes(next,'png/'+frame.id+'.png'));}
for(const entry of inspect.files)assert.equal(sha(bytes(next,entry.path)),entry.sha256,entry.path);
const review={status:'root-reviewed-expanded-compact-corners-awaiting-Cocos',opened:[{path:'review-compact.png',sha256:sha(bytes(next,'review-compact.png'))}],observations:['All four new exact radii match the former rounded contours in the opened compact comparison.','Original 18 frames preserve their metadata and rendered tile bytes.','No c01 archived file changed.'],oldFilesVerified:oldFreeze.files.length,oldFramesVerified:18,limitations:['Only the compact review was newly opened in this root turn.','Actual Cocos sampling, user interaction, and frame/memory performance remain to be checked.'],runtimeFilesWritten:false};
fs.writeFileSync(path.join(next,'visual-review.json'),JSON.stringify(review,null,2)+'\n');
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else{const b=fs.readFileSync(file);files.push({path:path.relative(next,file).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)});}}}
walk(next);files.sort((a,b)=>a.path.localeCompare(b.path));
fs.writeFileSync(path.join(next,'source-freeze.json'),JSON.stringify({status:'source-frozen-root-reviewed-awaiting-runtime',files,runtimeFilesWritten:false},null,2)+'\n');
console.log(JSON.stringify({filesFrozen:files.length,oldSourceFilesVerified:oldFreeze.files.length,oldFramesUnchanged:18,atlasSha256:inspect.atlas.sha256}));
