'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),source=path.join(__dirname,'candidate-02');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freezePath=path.join(source,'source-freeze.json'),freeze=JSON.parse(fs.readFileSync(freezePath));
for(const f of freeze.files){const b=fs.readFileSync(path.join(source,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256,f.path);}
const current=path.join(__dirname,'runtime-promotion.json'),archive=path.join(__dirname,'runtime-promotion-c01.json');
assert.ok(!fs.existsSync(archive),'c01 promotion already archived; refusing duplicate promotion');
const old=JSON.parse(fs.readFileSync(current)),target=path.join(root,old.files[0].destination);
assert.equal(sha(fs.readFileSync(target)),old.files[0].sha256,'runtime no longer matches reviewed c01');
const layout=JSON.parse(fs.readFileSync(path.join(source,'layout.json'))),png=fs.readFileSync(path.join(source,'panels-atlas.png'));
assert.equal(layout.frames.length,30);assert.equal(png.readUInt32BE(16),layout.width);assert.equal(png.readUInt32BE(20),layout.height);
fs.copyFileSync(current,archive);fs.writeFileSync(target,png);
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const manifest={schemaVersion:1,status:'root-reviewed-c02-promoted-awaiting-Cocos',promotedAtUtc:new Date().toISOString(),approval:'Root opened the compact corner comparison, verified all c01 archive bytes and the original 18 tile bytes, then approved this exact four-radius extension.',sourceFreeze:{path:relative(freezePath),sha256:sha(fs.readFileSync(freezePath)),files:freeze.files.length},layout:{path:relative(path.join(source,'layout.json')),sha256:sha(fs.readFileSync(path.join(source,'layout.json')))},files:[{source:relative(path.join(source,'panels-atlas.png')),destination:relative(target),sha256:sha(png),bytes:png.length}],resourcePath:'ui/panels/panels-atlas',width:layout.width,height:layout.height,sharedFrames:30,sharedTextures:1,metasOrUuidsAuthored:false,sourceModified:false,previousPromotion:relative(archive),pending:['Actual Cocos import and compact-corner sampling','Actual home/collection/battle interaction and resource cost']};
fs.writeFileSync(current,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.files[0]));
