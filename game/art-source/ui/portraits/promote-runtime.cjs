/** Authorized five-file byte-preserving promotion; frozen candidate stays untouched. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const HERE=__dirname,ROOT=path.resolve(HERE,'../../../..'),CANDIDATE=path.join(HERE,'candidate-01');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const plan=JSON.parse(fs.readFileSync(path.join(CANDIDATE,'promotion-plan.json'),'utf8'));
const freezeFile=path.join(CANDIDATE,'source-freeze.json'),freeze=JSON.parse(fs.readFileSync(freezeFile,'utf8'));
function verify(){assert.equal(sha(freezeFile),plan.sourceFreeze.sha256);for(const f of freeze.files)assert.equal(sha(path.join(CANDIDATE,f.path)),f.sha256,f.path);}
verify();assert.equal(plan.files.length,5);
const allowed=path.resolve(ROOT,'game/assets/resources/ui/portraits');
for(const f of plan.files){
 const source=path.resolve(ROOT,f.source),target=path.resolve(ROOT,f.target);
 assert.equal(path.dirname(target),allowed,'Target must stay inside the named portraits directory');
 assert.equal(sha(source),f.sha256);
 if(fs.existsSync(target))assert.equal(sha(target),f.sha256,'Refuse to overwrite different runtime bytes');
}
fs.mkdirSync(allowed,{recursive:true});
const copied=[];
for(const f of plan.files){const source=path.resolve(ROOT,f.source),target=path.resolve(ROOT,f.target),existed=fs.existsSync(target);if(!existed)fs.copyFileSync(source,target);assert.equal(sha(target),f.sha256);copied.push({...f,sourceSha256:sha(source),targetSha256:sha(target),alreadyIdentical:existed});}
verify();
fs.writeFileSync(path.join(HERE,'runtime-promotion.json'),JSON.stringify({status:'promoted-exact-five-approved-PNGs',promotedAtUTC:new Date().toISOString(),approval:'Root viewed all five 384px images and explicitly authorized five-file runtime promotion.',sourceFreeze:plan.sourceFreeze,files:copied,metaWritten:false,sourceFilesChanged:false,uiChanged:false,blenderStarted:false},null,2)+'\n');
console.log(JSON.stringify({promoted:copied.length,sourceFrozenFilesVerified:freeze.files.length,target:'game/assets/resources/ui/portraits',bytes:copied.reduce((n,f)=>n+f.bytes,0),metaWritten:false}));
