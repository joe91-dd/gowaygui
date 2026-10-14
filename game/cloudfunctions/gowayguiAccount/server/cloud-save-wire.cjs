'use strict';
const zlib=require('node:zlib');
const RAW_LIMIT=4*1024*1024,PART_LIMIT=48*1024,MAX_PARTS=128,TTL=15*60000;
const check=(v,m)=>{if(!v)throw Error(m);};
function decodeCloudSave(body){
 if(body?.$wire!=='zlib-base64-v1')return body;
 const {payload,rawBytes}=body;
 check(Number.isSafeInteger(rawBytes)&&rawBytes>0&&rawBytes<=RAW_LIMIT,'同步数据大小无效');
 check(typeof payload==='string'&&payload.length<=MAX_PARTS*PART_LIMIT&&payload.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(payload),'同步数据格式无效');
 let text;try{const bytes=zlib.inflateSync(Buffer.from(payload,'base64'),{maxOutputLength:rawBytes});check(bytes.length===rawBytes,'同步数据不完整');text=bytes.toString('utf8');}catch{throw Error('同步数据损坏或过大，本机进度已保留');}
 let result;try{result=JSON.parse(text);}catch{throw Error('同步数据格式无效');}
 check(result&&typeof result==='object'&&!Array.isArray(result)&&!result.$wire,'同步数据格式无效');return result;
}
/** Called only after account authentication and consent checks, inside its transaction. */
function acceptSavePart(account,body,now){
 const {requestId,region,version,rawBytes,total,index,chunk}=body;
 check(body.encoding==='zlib-base64-v1'&&typeof requestId==='string'&&/^[a-zA-Z0-9:_-]{8,160}$/.test(requestId),'同步编号无效');
 check(typeof region==='string'&&Object.prototype.hasOwnProperty.call(account.saves??{},region),'区服不存在');
 check(Number.isSafeInteger(version)&&version>=1&&Number.isSafeInteger(rawBytes)&&rawBytes>0&&rawBytes<=RAW_LIMIT,'同步数据大小无效');
 check(Number.isInteger(total)&&total>=2&&total<=MAX_PARTS&&Number.isInteger(index)&&index>=0&&index<total,'同步分段编号无效');
 check(typeof chunk==='string'&&chunk.length>0&&chunk.length<=PART_LIMIT&&/^[A-Za-z0-9+/]*={0,2}$/.test(chunk)&&chunk.length%4===0&&(index===total-1||chunk.length===PART_LIMIT&&!chunk.includes('=')),'同步分段格式无效');
 const slot=account.saves[region];check(slot.version===version||slot.lastRequest===requestId,'其他设备更新了此账号，请重新登录后继续');
 let transfer=account.saveTransfer;
 if(!transfer||transfer.expires<now||transfer.requestId!==requestId){check(index===0,'同步分段已过期，请重新连接');transfer=account.saveTransfer={requestId,region,version,rawBytes,total,expires:now+TTL,parts:[]};}
 check(['region','version','rawBytes','total'].every(k=>transfer[k]===body[k]),'同一保存编号的数据不一致');
 check(index<=transfer.parts.length,'同步分段顺序不一致');
 if(index<transfer.parts.length)check(transfer.parts[index]===chunk,'同一保存编号的数据不一致');else transfer.parts.push(chunk);
 if(transfer.parts.length<total)return;
 const decoded=decodeCloudSave({$wire:'zlib-base64-v1',rawBytes,payload:transfer.parts.join('')});
 check(decoded.requestId===requestId&&decoded.region===region&&decoded.version===version&&decoded.save,'同步内容与编号不一致');return decoded;
}
function encodeCloudResponse(value){
 const json=JSON.stringify(value),rawBytes=Buffer.byteLength(json);
 check(rawBytes<=RAW_LIMIT,'战斗数据过大，请返回海岛后重新连接；进度仍保留');
 if(rawBytes<32768)return value;
 const payload=zlib.deflateSync(json,{level:6}).toString('base64');
 check(payload.length<=PART_LIMIT,'战斗数据暂时无法完整同步，请稍后重新连接；进度仍保留');
 return {$wire:'zlib-base64-response-v1',rawBytes,payload};
}
module.exports={decodeCloudSave,acceptSavePart,encodeCloudResponse,RAW_LIMIT,PART_LIMIT};
