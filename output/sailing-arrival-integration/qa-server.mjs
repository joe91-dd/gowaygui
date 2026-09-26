import http from 'node:http';
import {readFileSync,createReadStream,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../game/build/sailing-arrival-20260916');
const config=JSON.parse(readFileSync(path.join(root,'assets/resources/config.json'),'utf8'));
const entry=Object.entries(config.paths).find(([,value])=>value[0]==='environment/home-island/home-island/home-island');
if(!entry)throw new Error('Home prefab missing');
const packed=Object.entries(config.packs??{}).find(([,members])=>members.includes(entry[0]));
const blocked=packed?.[0]??entry[0];
let enabled=true;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm','.bin':'application/octet-stream','.ogg':'audio/ogg','.wav':'audio/wav'};
http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
  if(pathname==='/__qa/release'&&request.method==='POST'){enabled=false;response.writeHead(200).end('released');return;}
  if(enabled&&pathname.endsWith('/'+blocked+'.json')){response.writeHead(503).end('QA simulated home asset failure');return;}
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)||!existsSync(filename)||!statSync(filename).isFile()){response.writeHead(404).end();return;}
  response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type',types[path.extname(filename)]??'application/octet-stream');
  createReadStream(filename).pipe(response);
}).listen(7492,'127.0.0.1',()=>console.log('QA only http://127.0.0.1:7492/ blocked='+blocked));
