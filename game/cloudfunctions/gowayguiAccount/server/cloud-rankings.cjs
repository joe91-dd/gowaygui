'use strict';
const crypto=require('node:crypto'),copy=require('./clone.cjs');
const {publicName,publicPet}=require('./public-profile.cjs');
const KINDS=['pet','chapter','endless','arena'];
const key=(account,region,kind)=>'rank-'+kind+'-'+crypto.createHash('sha256').update(account+':'+region).digest('hex');
const compare=(a,b)=>b.score-a.score||a.seconds-b.seconds||a.at-b.at||(a.id<b.id?-1:a.id>b.id?1:0);
function createCloudRankings({core,io}){
 const {turtleQuality}=require(core+'/prototypeConfig.js');
 function records(account,region,slot){
  const save=slot?.save,visible=slot?.competitiveVerified===true&&!!save&&!save.community?.hideRankings&&!account.privacyConsent?.withdrawnAt;
  const pets=visible?Object.values(save.collection).filter(p=>!save.community?.hiddenPets?.includes(p.id)).map(publicPet):[];
  const display=(save?.community?.showcase?.ids??[]).map(id=>pets.find(p=>p.id===id)).filter(Boolean).slice(0,5);
  const common={id:account.id,ownerId:account.id,name:publicName(account.id),pets:display.length?display:pets.slice(0,1),at:slot?.at??0};
  return KINDS.map(kind=>{
   let rows=[];
   if(visible){
    if(kind==='pet')rows=pets.map(p=>({...common,id:account.id+':'+p.id,score:turtleQuality(p).score,seconds:0,pets:[p]}));
    else if(kind==='arena'){if(save.progression?.arena?.games>0)rows=[{...common,score:save.progression.arena.rating,seconds:0}];}
    else{
     const results=Object.values(save.results??{}).filter(r=>kind==='chapter'?(r.mode??'chapter')==='chapter'&&r.victory&&r.levelId>=0&&r.levelId<50:r.mode==='endless');
     for(const r of results)rows.push({...common,score:kind==='chapter'?r.levelId+1:r.waves,seconds:r.combatSeconds,at:r.at});
    }
   }
   rows=rows.filter(r=>Number.isFinite(r.score)&&Number.isFinite(r.seconds)&&r.score>=0&&r.seconds>=0).sort(compare).slice(0,kind==='pet'?50:1);
   return {id:key(account.id,region,kind),region,kind,ownerId:account.id,rows};
  });
 }
 async function refresh(account,region,slot){
  const all=records(account,region,slot);
  const signature=crypto.createHash('sha256').update(JSON.stringify(all.map(r=>({...r,rows:r.rows.map(row=>({...row,at:r.kind==='pet'||r.kind==='arena'?0:row.at}))})))).digest('hex');
  if(slot.rankingFingerprint===signature)return;
  for(const record of all){
   const old=await io.get(record.id);
   if(record.kind==='pet'||record.kind==='arena')for(const row of record.rows){const prior=old?.rows?.find(r=>r.id===row.id&&r.score===row.score);if(prior)row.at=prior.at;}
   await io.put(record.id,record);
  }
  slot.rankingFingerprint=signature;
 }
 async function erase(account){for(const region of Object.keys(account.saves??{}))for(const kind of KINDS)await io.put(key(account.id,region,kind),{id:key(account.id,region,kind),region,kind,ownerId:account.id,rows:[]});}
 async function list(account,body){
  const region=body.region,kind=body.kind??'pet';
  if(region!=='island-1'||!KINDS.includes(kind))throw Error('榜单不存在');
  if(!io.rankings)throw Error('排行榜索引尚未准备完成，请稍后重试');
  // The best 51 owners suffice for the top 50 pets as well: every owner above
  // the cutoff contributes at least one pet. Read one extra to replace this
  // request's own not-yet-committed projection (including hiding all entries).
  const slot=account.saves?.[region];if(slot)await refresh(account,region,slot);
  const stored=await io.rankings(region,kind,51),own=await io.get(key(account.id,region,kind));
  const candidates=stored.filter(r=>r.ownerId!==account.id).flatMap(r=>r.rows).concat(own?.rows??[]);
  const rows=candidates.sort(compare).slice(0,50).map((r,i)=>({...copy(r),rank:i+1}));
  return {kind,rows,basis:'server-verified',ownEligible:account.saves?.[region]?.competitiveVerified===true};
 }
 return {refresh,erase,list,records};
}
module.exports={createCloudRankings,KINDS,rankKey:key};
