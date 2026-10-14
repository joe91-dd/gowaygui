'use strict';
/** Retry only an explicitly rolled-back database conflict. A network timeout
 * might follow a committed write and must never be blindly replayed here. */
// Contended world-board settlements need more than the SDK's short default
// window. Keep a hard six-second retry deadline within the 20-second function
// timeout; capped jitter spreads arrivals without an exponential multi-second
// final sleep. Only an explicitly rolled-back conflict reaches this branch.
async function retryConflict(run,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),clock=Date.now,random=Math.random,maxAttempts=8,budgetMs=6000}={}){
 const start=clock();
 for(let attempt=0;;attempt++){
  try{return await run();}
  catch(error){
   if(error?.code!=='DATABASE_TRANSACTION_CONFLICT'||attempt+1>=maxAttempts)throw error;
   const delay=Math.floor(Math.min(640,40*Math.pow(2,attempt))*(.5+random()));
   if(clock()-start+delay>=budgetMs)throw error;
   await sleep(delay);
  }
 }
}
module.exports={retryConflict};
