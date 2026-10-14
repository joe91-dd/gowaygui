'use strict';
const crypto=require('node:crypto');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const counterKey=id=>'invite-total-'+hash(id);
function createCloudInvites({io,ownerKey,now=Date.now}){
 async function sync(account){const counter=await io.get(counterKey(account.id));account.inviteCount=counter?.count??0;}
 async function register(account,value,newAccount=false){
  const own='invite-code-'+account.code,entry=await io.get(own);
  if(entry&&entry.account!==account.id)throw Error('邀请码冲突，请联系支持');
  if(!entry)await io.put(own,{account:account.id,createdAt:now()});
  // A returning or recreated WeChat identity cannot credit another invitation.
  const receiptKey='invite-receipt-'+ownerKey,receipt=await io.get(receiptKey);
  if(!account.invitationFinalized){
   account.invitationFinalized=true;
   const code=typeof value==='string'?value.trim().toUpperCase():'';
   const inviter=!receipt&&newAccount&&/^[A-F0-9]{10}$/.test(code)?await io.get('invite-code-'+code):null;
   if(inviter?.account&&inviter.account!==account.id){
    const key=counterKey(inviter.account),total=await io.get(key)??{count:0};
    total.count++;await io.put(key,total);await io.put(receiptKey,{credited:true,at:now()});
   }else if(!receipt)await io.put(receiptKey,{credited:false,at:now()});
  }
  await sync(account);
 }
 async function erase(account){await io.put('invite-code-'+account.code,{deleted:true});await io.put(counterKey(account.id),{count:0,deleted:true});}
 return {register,sync,erase};
}
module.exports={createCloudInvites};
