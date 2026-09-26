const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../output/battle-map-previews-20260920'),port=7637;
const types={'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{const u=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(f).pipe(res);}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/`));
