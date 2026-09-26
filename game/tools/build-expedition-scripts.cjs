// Reproducible script-only build against the previously exported Cocos runtime
// and unchanged resource UUIDs. This is not an editor/resource re-export.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ts=require('typescript');
const game=path.resolve(__dirname,'..'),base=path.resolve(game,process.env.GOWAYGUI_BASE_BUILD||'build/turtle-swap-20260923'),out=path.join(game,'build',process.argv[2]||'expedition-20260924-preview');
if(!fs.existsSync(path.join(base,'assets/main/index.js')))throw Error('Export a Cocos web build first and set GOWAYGUI_BASE_BUILD to its directory.');
const sourceFiles=new Map();
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(e.name.endsWith('.ts')&&!e.name.endsWith('.d.ts')){if(sourceFiles.has(e.name))throw Error('Ambiguous module '+e.name);sourceFiles.set(e.name,q);}}}
walk(path.join(game,'assets/scripts'));
const original=fs.readFileSync(path.join(base,'assets/main/index.js'),'utf8'),tree=ts.createSourceFile('index.js',original,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),replacements=[],found=new Set(),report=[];
function compile(name,id,old=''){
 const file=sourceFiles.get(name);if(!file)throw Error('Source missing '+name);
 let source=fs.readFileSync(file,'utf8');
 // The editor folds cc/env at build time; this exported runtime is a debug build.
 source=source.replace(/import\s*\{DEBUG\}\s*from\s*['"]cc\/env['"];?/g,'const DEBUG=true;');
 // Cocos flattens the project script graph to virtual basename modules.
 source=source.replace(/(from\s*|import\s*\()(['"])(\.{1,2}\/[^'"]+)\2/g,(all,lead,quote,target)=>lead+quote+'./'+path.posix.basename(target).replace(/\.ts$/,'')+'.ts'+quote);
 const rf=old.match(/cclegacy\._RF\.push\(\{\},\s*["']([^"']+)["'],\s*["']([^"']+)["']/);
 if(rf)source="import {cclegacy as __buildCc} from 'cc';\n__buildCc._RF.push({}, "+JSON.stringify(rf[1])+", "+JSON.stringify(rf[2])+", undefined);\n"+source+'\n__buildCc._RF.pop();\n';
 const result=ts.transpileModule(source,{fileName:file,moduleName:id,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.System,experimentalDecorators:true,useDefineForClassFields:false,removeComments:false,sourceMap:false}});
 const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(errors.length)throw Error(ts.formatDiagnostics(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>game,getNewLine:()=> '\n'}));
 report.push({module:id,source:path.relative(game,file),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});return result.outputText;
}
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='System.register'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const id=n.arguments[0].text,name=id.split('/').at(-1);if(id.startsWith('chunks:///_virtual/')&&sourceFiles.has(name)){found.add(name);replacements.push({start:n.getStart(tree),end:n.end,text:compile(name,id,n.getText(tree))});return;}}ts.forEachChild(n,visit);}
visit(tree);let built=original;for(const r of replacements.sort((a,b)=>b.start-a.start))built=built.slice(0,r.start)+r.text+built.slice(r.end);
for(const name of sourceFiles.keys())if(!found.has(name))built+='\n'+compile(name,'chunks:///_virtual/'+name);
built=built.replace(/\/\/# sourceMappingURL=.*$/gm,'');
if(!out.startsWith(path.join(game,'build')+path.sep)||out===base)throw Error('Unsafe output');
console.log('Compiled',report.length,'source modules; sharing unchanged exported runtime/resources');
fs.mkdirSync(out,{recursive:true});
function shared(from,to){if(!fs.existsSync(to))fs.symlinkSync(from,to,'junction');else if(fs.realpathSync(to)!==fs.realpathSync(from))throw Error('Resource link mismatch '+to);}
for(const e of fs.readdirSync(base,{withFileTypes:true})){const from=path.join(base,e.name),to=path.join(out,e.name);if(e.name==='assets')continue;if(e.isDirectory())shared(from,to);else fs.copyFileSync(from,to);}
fs.mkdirSync(path.join(out,'assets/main'),{recursive:true});
for(const e of fs.readdirSync(path.join(base,'assets'),{withFileTypes:true})){if(e.name==='main')continue;const from=path.join(base,'assets',e.name),to=path.join(out,'assets',e.name);if(e.isDirectory())shared(from,to);else fs.copyFileSync(from,to);}
for(const e of fs.readdirSync(path.join(base,'assets/main'),{withFileTypes:true})){const from=path.join(base,'assets/main',e.name),to=path.join(out,'assets/main',e.name);if(e.isDirectory())shared(from,to);else if(e.name!=='index.js')fs.copyFileSync(from,to);}
fs.writeFileSync(path.join(out,'assets/main/index.js'),built);
const manifest={method:'TypeScript System.register script rebuild; unchanged Cocos 3.8.8 exported runtime/resources',base,output:out,at:new Date().toISOString(),modules:report,bundleSha256:crypto.createHash('sha256').update(built).digest('hex')};
fs.writeFileSync(path.join(out,'script-build-manifest.json'),JSON.stringify(manifest,null,2));console.log(out);
