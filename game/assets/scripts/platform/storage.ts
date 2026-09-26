/** Synchronous local adapter. Platform builds must replace this with a server-owned save flow. */
export interface KeyValueStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export interface Clock { now():number }
export const systemClock:Clock={now:()=>Date.now()};
export class MemoryStorage implements KeyValueStorage {
  readonly values:Record<string,string>={};
  getItem(key:string):string|null{return this.values[key]??null;}
  setItem(key:string,value:string):void{this.values[key]=value;}
}
