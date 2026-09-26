import type {GameService} from '../core/game';
import type {GameSave,AdKind} from '../core/types';
import type {AccountParcel} from '../core/taskPolicy';
import type {KeyValueStorage} from './storage';
import {SAVE_KEY,BACKUP_KEY,encodeSave} from '../core/save';
export interface AccountSession {id:string;token:string;username:string;region:string;version:number}
export interface AccountView {id:string;username:string;code:string;invites:number;ads:number;days:number;claims:string[];dailyPoints:number;weeklyPoints:number;pending:AccountParcel[];regions:{id:string;name:string;status:string}[];adAvailable:boolean;support:string;serverDay:string;serverWeek:string}
const KEY='gowaygui.account.session.v1';
export const accountSession=():AccountSession|undefined=>{try{return JSON.parse(localStorage.getItem(KEY)??'null')??undefined;}catch{return undefined;}};
export function accountStorage(storage:KeyValueStorage):KeyValueStorage{const a=accountSession(),prefix=a?'account:'+a.id+':'+a.region+':':'';return {getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v)};}
export class AccountClient {
 view?:AccountView;private sending?:Promise<void>;private lastRevision=-1;
 constructor(private service:GameService){}
 get session(){return accountSession();}
 async request<T>(route:string,body:Record<string,unknown>={}):Promise<T>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);try{const response=await fetch('/api/account/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(this.session?{Authorization:'Bearer '+this.session.token}:{})},body:JSON.stringify(body),signal:abort.signal});if(!response.headers.get('content-type')?.includes('application/json'))throw Error('账号服务尚未启动');const r=await response.json();if(!r.ok)throw Error(r.error??'操作未完成，请重试');return r.data as T;}catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('连接超时，请重试。已领取奖励不会重复发放。');throw e;}finally{clearTimeout(timer);}}
 async sync():Promise<void>{if(!this.session)return;await this.save();this.view=await this.request<AccountView>('state');}
 async save():Promise<void>{if(!this.session)return;if(this.sending){await this.sending;return this.save();}this.sending=(async()=>{const a=this.session!,save=this.service.snapshot;if(save.revision===this.lastRevision)return;const r=await this.request<{version:number}>('save',{region:a.region,version:a.version,save});const current=this.session;if(current?.id!==a.id)return;current.version=r.version;localStorage.setItem(KEY,JSON.stringify(current));this.lastRevision=save.revision;})().finally(()=>this.sending=undefined);return this.sending;}
 async login(username:string,password:string,register=false,inviter=''):Promise<void>{
  if(this.session)await this.save();if(register)await this.request('register',{username,password,inviter});
  const r=await this.request<{token:string;account:AccountView}>('login',{username,password}),region=r.account.regions[0].id,a:AccountSession={id:r.account.id,token:r.token,username:r.account.username,region,version:0};
  const old=this.session;localStorage.setItem(KEY,JSON.stringify(a));
  try{const remote=await this.request<{version:number;save?:GameSave}>('save',{region});a.version=remote.version;
   const store=accountStorage(localStorage);if(remote.save){store.setItem(SAVE_KEY,encodeSave(remote.save));store.setItem(BACKUP_KEY,encodeSave(remote.save));}
   else if(register&&!old&&!localStorage.getItem('gowaygui.guest.bound')){const guest=this.service.snapshot;store.setItem(SAVE_KEY,encodeSave(guest));store.setItem(BACKUP_KEY,encodeSave(guest));localStorage.setItem('gowaygui.guest.bound',a.id);}
   localStorage.setItem(KEY,JSON.stringify(a));location.reload();
  }catch(e){if(old)localStorage.setItem(KEY,JSON.stringify(old));else localStorage.removeItem(KEY);throw e;}
 }
 async logout():Promise<void>{await this.save();await this.request('logout');localStorage.removeItem(KEY);location.reload();}
 async region(id:string):Promise<void>{if(!this.session)throw Error('请先登录账号');await this.save();const a=this.session!;if(id===a.region)return;const remote=await this.request<{version:number;save?:GameSave}>('save',{region:id});a.region=id;a.version=remote.version;localStorage.setItem(KEY,JSON.stringify(a));if(remote.save){const store=accountStorage(localStorage);store.setItem(SAVE_KEY,encodeSave(remote.save));store.setItem(BACKUP_KEY,encodeSave(remote.save));}location.reload();}
 async password(oldPassword:string,password:string):Promise<void>{const r=await this.request<{token:string}>('password',{oldPassword,password}),a=this.session!;a.token=r.token;localStorage.setItem(KEY,JSON.stringify(a));}
 async claim(key:string):Promise<void>{await this.sync();const p=await this.request<AccountParcel>('claim',{key,region:this.session?.region});await this.receive(p);}
 async receive(p:AccountParcel):Promise<void>{if(p.region&&p.region!==this.session?.region)throw Error('请切换到这份奖励所属的区服后领取');this.service.receiveAccountParcel(p);await this.save();await this.request('ack',{id:p.id,region:this.session?.region});this.view=await this.request<AccountView>('state');}
 async share(title='和我一起守护龟岛',text='五龟小队，一起合宠、打书、守护海岛！'):Promise<'shared'|'copied'|'cancelled'>{if(this.session&&!this.view)await this.sync();const url=new URL(location.href);url.search='';url.hash='';if(this.view)url.searchParams.set('invite',this.view.code);if(navigator.share){try{await navigator.share({title,text,url:url.href});return 'shared';}catch(e){if(e instanceof Error&&e.name==='AbortError')return 'cancelled';}}await navigator.clipboard.writeText(title+'\n'+text+'\n'+url.href);return 'copied';}
 async ad(kind:AdKind|'supplies',context:string|undefined,open:(url:string)=>void,onProgress:(message:string)=>void):Promise<void>{
  if(!this.session)throw Error('请先登录账号，再领取广告奖励');
  const pending=await this.request<{nonce:string;done:boolean;kind:AdKind|'supplies';context?:string}[]>('ad-pending',{region:this.session.region}),recovered=pending.find(p=>p.done);
  if(recovered){await this.completeAd(recovered.nonce);onProgress('上次已完成的广告奖励已补发');return;}
  if(pending.length)throw Error('上次广告仍在验证中，请稍后重试；完成后会补领，不会丢失次数');
  const r=await this.request<{nonce:string;url:string}>('ad-begin',{kind,context,region:this.session.region});open(r.url);
  localStorage.setItem('gowaygui.pending.ad',JSON.stringify({...r,account:this.session.id}));
  const account=this.session.id,region=this.session.region;
  for(let i=0;i<180;i++){await new Promise(resolve=>setTimeout(resolve,2000));if(this.session?.id!==account||this.session?.region!==region)throw Error('账号或区服已切换，请在原账号领取广告奖励');if(await this.completeAd(r.nonce))return;onProgress('等待广告完成验证…');}throw Error('广告暂未验证，奖励记录已保留，可稍后重试');
 }
 private async completeAd(nonce:string):Promise<boolean>{const state=await this.request<{done:boolean;claimed?:boolean;expired?:boolean;kind:AdKind|'supplies';context?:string;receipt:string}>('ad-status',{nonce,region:this.session?.region});if(state.expired)throw Error('广告验证超时，未扣除物品，请稍后重试');if(!state.done)return false;if(!state.claimed){this.service.receiveAdReward(state.receipt,state.kind,state.context);await this.save();await this.request('ad-ack',{nonce,region:this.session?.region});}localStorage.removeItem('gowaygui.pending.ad');await this.sync();return true;}
}
