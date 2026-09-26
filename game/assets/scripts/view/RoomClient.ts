import {GameService} from '../core/game';
import {AccountClient,accountSession} from '../platform/AccountClient';
import type {RoomView,RoomState} from '../core/roomTypes';
import type {WorldBossView} from '../core/worldBoss';
import type {Point} from '../core/types';
import {showcasePets} from '../core/honor';
export class RoomClient {
 world?:WorldBossView;worldSelection:string[]=[];
 state?:RoomState;error='';private auth?:{id:string;token:string};private registering?:Promise<void>;private requestCounter=0;private syncing?:Promise<void>;
 private identityKey='gowaygui.room.identity.v1'+(accountSession()?':'+accountSession()!.id+':'+accountSession()!.region:'');
 constructor(private service:GameService,private account?:AccountClient){try{this.auth=JSON.parse(localStorage.getItem(this.identityKey)??'null')??undefined;}catch{}}
 get room(){return this.state?.room;}
 get id(){return this.auth?.id??'';}
 private async request<T>(path:string,body?:Record<string,unknown>):Promise<T>{
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
  try{const account=accountSession();const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(this.auth?{Authorization:'Bearer '+this.auth.token}:{}),...(account?{'X-Game-Account':account.token,'X-Game-Region':account.region}:{})},...(body?{body:JSON.stringify({...body,requestId:Date.now().toString(36)+'-'+(++this.requestCounter)})}:{}),signal:abort.signal});
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('房间服务尚未启动，请从配套房间服务的试玩地址进入');const value=await response.json();if(!value.ok)throw Error(value.error||'房间操作失败');this.error='';return value.data as T;
  }catch(e){this.error=e instanceof Error?(e.name==='AbortError'?'连接超时，房间进度已保存在服务器，请重试':e.message):'连接失败，请重试';throw Error(this.error);}finally{clearTimeout(timer);}
 }
 async connect(ids?:string[]):Promise<void>{
  if(this.auth)return;if(this.registering)return this.registering;
  const s=this.service.snapshot,roster=(ids??s.homeTeam??Object.keys(s.collection).slice(0,5)).map(id=>s.collection[id]).filter(Boolean);
  this.registering=this.request<{id:string;token:string}>('register',{name:s.community?.name??'小岛主',roster}).then(value=>{this.auth=value;localStorage.setItem(this.identityKey,JSON.stringify(value));}).finally(()=>this.registering=undefined);return this.registering;
 }
 async profile(ids:string[]):Promise<void>{await this.connect(ids);const s=this.service.snapshot;await this.request('profile',{name:s.community?.name??'小岛主',roster:ids.map(id=>s.collection[id]).filter(Boolean)});}
 async sync():Promise<void>{if(this.syncing)return this.syncing;this.syncing=(async()=>{await this.connect();const value=await this.request<RoomState>('state');if(value.room&&this.room?.id===value.room.id&&this.room.revision>value.room.revision)value.room=this.room;this.state=value;for(const mail of value.mail){this.service.receiveRoomMail('received:'+mail.id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,144),mail);if(mail.id.startsWith('world:')&&accountSession())await (this.account??=new AccountClient(this.service)).save();await this.request('ack',{id:mail.id});}})().finally(()=>this.syncing=undefined);return this.syncing;}
 async create(tier:number,ids:string[]):Promise<RoomView>{await this.profile(ids);const room=await this.request<RoomView>('create',{tier});await this.sync();return room;}
 async match(tier:number,ids:string[]):Promise<RoomView|null>{await this.profile(ids);const room=await this.request<RoomView|null>('match',{tier});if(room)await this.sync();return room;}
 async join(code:string,ids:string[]):Promise<void>{await this.profile(ids);await this.request('join',{code});await this.sync();}
 async action(action:string,body:Record<string,unknown>={}):Promise<RoomView|null>{const roomId=this.room?.id;if(!roomId)throw Error('当前没有房间，请重新连接');const room=await this.request<RoomView|null>('action',{roomId,action,...body});if(this.state&&(!room||room.id!==this.room?.id||room.revision>=this.room.revision))this.state.room=room;return room;}
 async worldState(ids?:string[]):Promise<WorldBossView>{await this.connect(ids);return this.world=await this.request<WorldBossView>('world-boss/state',{});}
 async worldShowcase():Promise<WorldBossView>{
  await this.connect();if(accountSession())await (this.account??=new AccountClient(this.service)).save();
  const s=this.service.snapshot;return this.world=await this.request<WorldBossView>('world-boss/showcase',{pets:showcasePets(s),rotate:s.community?.showcase?.rotate??true});
 }
 async worldStart(ids:string[],placements:Point[]):Promise<WorldBossView>{if(accountSession())await (this.account??=new AccountClient(this.service)).save();await this.profile(ids);return this.world=await this.request<WorldBossView>('world-boss/start',{placements});}
 async worldAction(action:string,body:Record<string,unknown>={}):Promise<WorldBossView>{return this.world=await this.request<WorldBossView>('world-boss/'+action,{fightId:this.world?.fight?.id,...body});}
 async worldClaim(tier:number):Promise<void>{await this.worldAction('claim',{tier});await this.sync();}
}
