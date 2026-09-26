import {KeyValueStorage} from './storage';
import {requireRule} from '../core/save';

export interface LocalSession { storage:KeyValueStorage; close():void }
/** A Web Lock is held for the entire writable local session, not just a storage read. */
export async function acquireLocalSession(storage:KeyValueStorage):Promise<LocalSession>{
  const manager=typeof navigator==='undefined'?undefined:navigator.locks;
  requireRule(manager,'当前浏览器不能安全地协调本地存档，请用较新的 Chrome 或 Edge 打开本地版本。','LOCAL_SESSION');
  let finish:(()=>void)|undefined,live=false;
  const lifetime=new Promise<void>(resolve=>{finish=resolve;});
  return new Promise<LocalSession>((resolve,reject)=>{
    void manager.request('gowaygui.chapter1.writer',{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock){reject(new Error('游戏已经在另一个页面运行。请先关闭那个页面，再刷新这里。'));return;}
      live=true;
      const protectedStorage:KeyValueStorage={
        getItem:key=>{requireRule(live,'游戏会话已经关闭','LOCAL_SESSION');return storage.getItem(key);},
        setItem:(key,value)=>{requireRule(live,'游戏会话已经关闭','LOCAL_SESSION');storage.setItem(key,value);},
      };
      resolve({storage:protectedStorage,close:()=>{live=false;finish?.();}});
      await lifetime;live=false;
    }).catch(reject);
  });
}
