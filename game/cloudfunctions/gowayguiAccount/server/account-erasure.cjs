'use strict';
const crypto=require('node:crypto');
const deletionKey=id=>crypto.createHash('sha256').update('gowaygui-erased:'+id).digest('hex');
function eraseAccount(data,a,now){
 const id=a.id;
 data.accounts=data.accounts.filter(other=>other.id!==id);
 for(const [key,s]of Object.entries(data.sessions??{}))if(s.id===id)delete data.sessions[key];
 for(const [key,ad]of Object.entries(data.ads??{}))if(ad.account===id)delete data.ads[key];
 data.feedback=(data.feedback??[]).filter(f=>f.account!==id);
 // Tombstones contain neither account names, credentials nor contact data. Keep
 // them separately when restoring backups so deleted accounts cannot reappear.
 data.erasures??={};data.erasures[deletionKey(id)]={at:now};
 data.market=(data.market??[]).filter(l=>l.ownerId!==id&&l.buyerId!==id);
 for(const key of Object.keys(data.tradeReceipts??{}))if(key.startsWith(id+':'))delete data.tradeReceipts[key];
 for(const other of data.accounts){other.invitees=(other.invitees??[]).filter(v=>v!==id);if(other.inviter===a.code)delete other.inviter;}
 // CDK redemption ledgers store account IDs; remove only this account's entries.
 function scrub(value){if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(key===id||value[key]?.accountId===id||value[key]?.account===id)delete value[key];else scrub(value[key]);}}
 scrub(data.cdk);
}
function applyErasures(data,ledger={}){
 data.erasures={...(data.erasures??{}),...ledger};
 for(const account of [...data.accounts]){const row=data.erasures[deletionKey(account.id)];if(row)eraseAccount(data,account,row.at);}
 return data;
}
module.exports={eraseAccount,deletionKey,applyErasures};
