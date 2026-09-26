const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,plan=JSON.parse(fs.readFileSync(path.join(root,'production-plan.json'),'utf8'));
const inputs=plan.items.flatMap(a=>['icon','turnaround'].map(kind=>{
 const data=fs.readFileSync(a[kind]);
 if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG '+a.id);
 return {id:a.id,kind,path:a[kind],bytes:data.length,width:data.readUInt32BE(16),height:data.readUInt32BE(20),sha256:crypto.createHash('sha256').update(data).digest('hex')};
}));
if(new Set(plan.items.map(x=>x.id)).size!==20||inputs.length!==40)throw Error('Incorrect count');
const report={status:'passed',characterCount:20,inputCount:40,bytes:inputs.reduce((n,x)=>n+x.bytes,0),inputs};
fs.writeFileSync(path.join(root,'input-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,inputs:undefined}));
