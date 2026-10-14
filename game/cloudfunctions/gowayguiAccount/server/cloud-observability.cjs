'use strict';
// Log only fixed operation labels and numeric metrics. Never serialize requests,
// account records, bearer tokens, OpenID, feedback or raw exception messages.
const account=new Set(['wx-login','state','save','save-transfer','claim','ack','logout','withdraw-consent','delete-account','feedback','social/market','social/trade','social/rankings','ad-begin','ad-pending','ad-status','ad-complete','ad-cancel','ad-ack','privacy','release-status','config','redeem','transport-check']);
const modes=new Set(['register','profile','state','create','match','join','action','ack','world-boss/state','world-boss/start','world-boss/claim','world-boss/showcase','world-boss/operationPause','world-boss/operationResume','world-boss/focus','world-boss/settings','world-boss/cast','world-boss/move']);
function operation(event,context){
 if(context?.SOURCE==='wx_trigger')return 'maintenance';
 const p=event?.path;if(typeof p!=='string')return 'invalid';
 if(p.startsWith('/api/account/')&&account.has(p.slice(13)))return 'account/'+p.slice(13);
 if(p.startsWith('/api/')&&modes.has(p.slice(5)))return 'modes/'+p.slice(5);
 return 'invalid';
}
function observed(handler,{logger=console,clock=Date.now,sample=Math.random}={}){
 return async(event,context)=>{
  const start=clock(),op=operation(event,context);let result;
  try{return result=await handler(event,context);}
  finally{
   const durationMs=Math.max(0,clock()-start),status=result?.ok?200:Number(result?.status)||503;
   // Every infrastructure failure and slow request is visible; ordinary success
   // is sampled to keep log volume bounded under multiplayer polling.
   if(status>=500||durationMs>=1500||sample()<.01){
    const entry={event:'gowaygui_request',operation:op,status,durationMs,slow:durationMs>=1500,sampled:status<500&&durationMs<1500};
    try{const level=status>=500?'error':durationMs>=1500?'warn':'info';logger[level]?.(JSON.stringify(entry));}catch{}
   }
  }
 };
}
module.exports={operation,observed};
