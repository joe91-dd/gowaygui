const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.env.ENEMY_REVIEW_PORT||7597);
const types={'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.zip':'application/zip'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
}).listen(port,'127.0.0.1',()=>console.log('Enemy review http://127.0.0.1:'+port));

