import http from 'node:http';
import {readFile} from 'node:fs/promises';
const html = await readFile(new URL('./试听.html', import.meta.url));
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(!['/','/index.html'].includes(req.url?.split('?')[0])){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':html.length,'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:html);
}).listen(7462,'127.0.0.1',()=>console.log('Music audition: http://127.0.0.1:7462'));
