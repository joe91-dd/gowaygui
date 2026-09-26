'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),source=path.join(__dirname,'candidate-01');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const frozen=JSON.parse(fs.readFileSync(path.join(source,'source-freeze.json'),'utf8'));
for(const file of frozen.files){const p=path.join(source,file.path);if(hash(p)!==file.sha256||fs.statSync(p).size!==file.bytes)throw new Error('Frozen panel source differs: '+file.path);}
const from=path.join(source,'panels-atlas.png'),to=path.join(root,'game/assets/resources/ui/panels/panels-atlas.png');
const expected='728a09f0e7b1f12d6e6ea6b8c5467dfb372735334ac865c56d34298ea849686a';
if(hash(from)!==expected)throw new Error('Approved panel atlas SHA differs');
fs.mkdirSync(path.dirname(to),{recursive:true});
if(fs.existsSync(to)){if(hash(to)!==expected)throw new Error('Unexpected existing runtime atlas');}
else fs.copyFileSync(from,to);
if(hash(to)!==expected)throw new Error('Runtime byte verification failed');
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const result={schemaVersion:1,status:'approved-atlas-promoted-view-adapter-awaiting-root-gate-and-cocos-verification',promotedAtUtc:new Date().toISOString(),
  approval:'Root actually reviewed both panel comparisons and authorized copying only the atlas; source SHA reconfirmed by its author.',
  sourceFreeze:{path:relative(path.join(source,'source-freeze.json')),sha256:hash(path.join(source,'source-freeze.json')),files:frozen.files.length},
  layout:{path:relative(path.join(source,'layout.json')),sha256:hash(path.join(source,'layout.json'))},
  files:[{source:relative(from),destination:relative(to),sha256:expected,bytes:fs.statSync(to).size}],resourcePath:'ui/panels/panels-atlas',
  width:512,height:1024,sharedFrames:18,sharedTextures:1,metasOrUuidsAuthored:false,sourceModified:false,gameEntryModified:false,
  pending:['Root preload gate and optional IslandUI fourth-parameter injection','Actual Cocos sliced seams, UI hit area and Buffer measurements']};
fs.writeFileSync(path.join(__dirname,'runtime-promotion.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
