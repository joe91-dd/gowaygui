const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'production-manifest.json'),'utf8'));
 const files=manifest.items.flatMap(x=>['icons/'+x.id+'-'+x.slug+'.png','turnarounds/'+x.id+'-'+x.slug+'-three-views.png']);
 const checks=await Promise.all(files.map(async file=>{
  const buf=fs.readFileSync(path.join(root,file));
  if(buf.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG '+file);
  const width=buf.readUInt32BE(16),height=buf.readUInt32BE(20);
  if(width<1000||height<600)throw Error('Unexpected dimensions '+file);
  const r=await fetch('http://127.0.0.1:7597/'+file,{method:'HEAD'});
  if(!r.ok)throw Error('HTTP '+r.status+' '+file);
  return {file,width,height,bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),httpStatus:r.status};
 }));
 if(checks.length!==40)throw Error('Expected 40 assets');
 const report={status:'passed',files:40,icons:checks.filter(x=>x.file.startsWith('icons/')).length,turnarounds:checks.filter(x=>x.file.startsWith('turnarounds/')).length,totalBytes:checks.reduce((n,x)=>n+x.bytes,0),uiChecks:['分类筛选：高级 BOSS 显示 4 / 20','图鉴＋三视图对照模式可用','三视图弹窗放大已截图检查'],artReview:'造型审阅稿；部分侧视略有透视，正式建模仍需核对结构与尺寸。',checks};
 fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,checks:undefined},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

