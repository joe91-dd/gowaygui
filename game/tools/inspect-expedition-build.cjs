console.log('Inspect build started');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../build/turtle-swap-20260923');
const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(e.name.endsWith('.js'))files.push(q);}}walk(path.join(root,'src/chunks'));
files.push(path.join(root,'assets/main/index.js'));
for(const f of files){const s=fs.readFileSync(f,'utf8');if(s.includes('GameEntry.ts')){console.log(f,s.length);const i=s.indexOf('GameEntry.ts');console.log(s.slice(Math.max(0,i-120),i+1800));const j=s.indexOf('GameEntry.ts',i+50);console.log('NEXT',s.slice(Math.max(0,j-120),j+500));}}
console.log('typescript',require.resolve('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript'));
console.log('new-source-files',fs.statSync(path.resolve(__dirname,'../assets/scripts/view/ExpeditionHUD.ts')).size);
