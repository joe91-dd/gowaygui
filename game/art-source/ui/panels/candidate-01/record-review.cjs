/** Run only after the author opens the three final preview PNGs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const HERE=__dirname,read=n=>fs.readFileSync(path.join(HERE,n)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.ok(!fs.existsSync(path.join(HERE,'source-freeze.json')),'Candidate already frozen');
const inspect=JSON.parse(read('inspection.json'));assert.equal(inspect.checks.length,18);
for(const f of inspect.files)assert.equal(sha(read(f.path)),f.sha256,f.path);
const review={status:'author-reviewed-independent-source-candidate-awaiting-parent-and-Cocos-A-B',
 opened:inspect.previews.map(p=>({path:p.path,sha256:p.sha256})),
 observations:['Original-size preview preserves rounded fill, offset shadow, opaque gold outer line and low-alpha cream inner line.',
 'Comparison preview retains the existing geometry at radii 10,18,21,22,24, including zero-height centre strip on short capsule buttons.',
 'The final small-size preview was reopened after removing nested-SVG clip antialias artefacts using equivalent continuous contours; this is explicitly labelled and is not a Cocos screenshot.',
 'Chinese preview labels are readable. Fontconfig could not write its user cache, but existing fonts rendered and both scripts exited 0.',
 'All tint masks are alpha-transparent with white RGB; three mask layers are required to preserve separate outer-gold and inner-cream colours.'],
 limitations:['No resources, meta, UI layout, text or interaction changed.',
 'Cocos actual sliced texture seams, adjacent batching, Buffer reduction, close/reopen release and phone input remain untested.',
 'This candidate preserves the existing panel style; it does not claim the full UI has reached final art quality.'],runtimeFilesWritten:false};
fs.writeFileSync(path.join(HERE,'visual-review.json'),JSON.stringify(review,null,2)+'\n');
const files=[];
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())visit(p);else if(entry.name!=='source-freeze.json'){const relative=path.relative(HERE,p).replaceAll('\\','/'),b=fs.readFileSync(p);files.push({path:relative,bytes:b.length,sha256:sha(b)});}}}
visit(HERE);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
fs.writeFileSync(path.join(HERE,'source-freeze.json'),JSON.stringify({status:'candidate-frozen-awaiting-parent-review',files,runtimeFilesWritten:false},null,2)+'\n');
console.log(JSON.stringify({frames:18,atlas:inspect.atlas.sha256,filesFrozen:files.length,previewImagesOpened:3,runtimeFilesWritten:false}));
