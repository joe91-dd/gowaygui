import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export async function acquire(root, state, options={}) {
 const headers=JSON.parse(await fs.readFile(path.join(root,'gdevelop-headers.json'),'utf8'));
 const index=JSON.parse(await fs.readFile(path.join(root,'gdevelop-index.json'),'utf8'));
 const packs=JSON.parse(await fs.readFile(path.join(root,'gdevelop-packs.json'),'utf8')).starterPacks;
 const selectedTags=options.tags||['3d pirate kit','3d colorful monsters'];
 const chosen=headers.filter(h=>h.tags?.some(t=>selectedTags.includes(t)));
 state.total=chosen.length;state.done=0;state.failed=[];state.files=[];let cursor=0;
 async function get(url){let last;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){last=e;}}throw last;}
 async function worker(){while(cursor<chosen.length){const h=chosen[cursor++];try{
   const tag=h.tags.find(t=>selectedTags.includes(t));
   const group=tag==='3d pirate kit'?'pirates':tag==='3d colorful monsters'?'monsters':tag==='3d rocks and trees'?'nature':'fantasy-props';
   const slug=h.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+h.id.slice(0,6);
   const dir=path.join(root,group,slug);await fs.mkdir(dir,{recursive:true});
   const asset=JSON.parse((await get(index.assetCdn.baseUrl.live+'/assets/'+h.id+'.json')).toString());
   if(!asset.license.startsWith('CC0'))throw Error('License not CC0');
   const pack=packs.find(p=>p.tag===tag);
   await fs.writeFile(path.join(dir,'source.json'),JSON.stringify({asset,pack,distribution:'GDevelop public asset CDN',original:group==='pirates'?'https://quaternius.com/packs/piratekit.html':group==='monsters'?'https://quaternius.com/packs/ultimatemonsters.html':'https://quaternius.com'},null,2));
   for(const r of asset.objectAssets.flatMap(o=>o.resources)){if(r.kind!=='model3D')continue;
    const dest=path.join(dir,'source.glb');let data;try{data=await fs.readFile(dest);}catch{data=await get(r.file);}
    if(data.subarray(0,4).toString()!=='glTF')throw Error('Invalid GLB');
    await fs.writeFile(dest,data);state.files.push({name:h.name,group,path:dest,source:r.file,license:asset.license,author:asset.authors,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length,animations:asset.animationsCount});
   }
   state.done++;
  }catch(e){state.failed.push({name:h.name,id:h.id,error:String(e)});}
 }}
 await Promise.all(Array.from({length:5},worker));
 state.complete=true;await fs.writeFile(path.join(root,options.manifest||'download-manifest.json'),JSON.stringify(state,null,2));return state;
}
