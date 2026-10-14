import {assetManager,ImageAsset,Texture2D,resources} from 'cc';

/** The approved atlas is shipped beside each build, never patched into a shared bundle. */
export async function approvedVfxTextures():Promise<Map<string,Texture2D>> {
 const result=new Map<string,Texture2D>();
 let failure:unknown;
 await Promise.all(['impacts','projectiles','volumes'].map(name=>new Promise<void>((resolve,reject)=>{
  const done=(error:Error|null,image:ImageAsset)=>{
   if(error||!image){reject(error??new Error('缺少已确认特效素材 '+name));return;}
   const t=new Texture2D();t.image=image;t.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);t.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
   result.set(name==='impacts'?'spell-volumes-v1':name==='volumes'?'approved-volumes':'approved-projectiles',t);resolve();
  };
  if(typeof location!=='undefined'&&/^https?:/.test(location.protocol)&&!location.pathname.includes('/preview/'))assetManager.loadRemote<ImageAsset>(new URL('presentation/vfx-approved/'+name+'.png',location.href).href,{ext:'.png'},done);
  else resources.load('vfx-approved/'+name,ImageAsset,done);
 }).catch(error=>{failure??=error;})));
 if(failure){for(const texture of result.values())texture.destroy();throw failure;}
 return result;
}
