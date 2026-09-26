import http from 'node:http';
import {createReadStream, statSync} from 'node:fs';
const file=new URL('../../../output/audio-cc0-review.html',import.meta.url);
const size=statSync(file).size;
http.createServer((req,res)=>{
  if(req.url!=='/'){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':size,'Cache-Control':'no-store'});
  createReadStream(file).pipe(res);
}).listen(7459,'127.0.0.1',()=>console.log('CC0 audio review: http://127.0.0.1:7459/'));
