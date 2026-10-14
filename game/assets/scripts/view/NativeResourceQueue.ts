import {Asset,resources,sys} from 'cc';

/** Serialize heavy prefab/texture creation on native devices. The queue belongs
 * to one world, so retiring a loading screen never starts its remaining jobs. */
export class NativeResourceQueue {
  private active=0;
  private retired=false;
  private waiting:{start:()=>void;cancel:()=>void}[]=[];
  private readonly limit=sys.isNative?2:Infinity;
  load<T extends Asset>(path:string,type:new (...args:any[])=>T,done:(error:Error|null,asset?:T)=>void):void{
    if(this.retired){done(new Error('Resource queue retired'));return;}
    this.waiting.push({cancel:()=>done(new Error('Resource queue retired')),start:()=>{
      this.active++;
      let settled=false;
      const finish=(error:Error|null,asset?:T)=>{
        if(settled)return;settled=true;this.active--;
        try{
          if(this.retired){if(asset&&asset.refCount===0)asset.decRef();done(new Error('Resource queue retired'));}
          else done(error,asset);
        }finally{setTimeout(()=>this.pump(),0);}
      };
      try{resources.load(path,type,finish);}catch(error){finish(error instanceof Error?error:new Error(String(error)));}
    }});
    this.pump();
  }
  private pump():void{while(!this.retired&&this.active<this.limit&&this.waiting.length)this.waiting.shift()!.start();}
  destroy():void{this.retired=true;const waiting=this.waiting;this.waiting=[];for(const job of waiting)job.cancel();}
}
