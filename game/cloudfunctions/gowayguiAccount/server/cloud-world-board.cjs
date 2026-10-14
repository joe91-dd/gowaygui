'use strict';
// Keep each player's authoritative score/claims in one of 32 transaction rows.
// Other shards are an advisory live ranking. Closing a day takes a consistent
// transaction snapshot before freezing ranks and issuing ranking rewards.
const shard=id=>(parseInt(id.slice(0,8),16)%32).toString(16).padStart(2,'0');
const baseKey=day=>'mode-world-'+day.replace(/-/g,'')+'-island-1';
const shardKey=(day,s)=>baseKey(day)+'-shard-'+s;
function attachWorldBoards(io,readShards){
 const loaded=new Map();
 io.worldBoard=async(day,owner,at)=>{
  const base=await io.get(baseKey(day)),own=shard(owner);
  let shards=await readShards(day);
  const ownRow=await io.get(shardKey(day,own));
  const merge=rows=>{
   const board=base?JSON.parse(JSON.stringify(base)):null;
   if(!board&&!rows.some(Boolean))return null;
   const value=board??{day,bossIndex:rows.find(Boolean).bossIndex,closes:rows.find(Boolean).closes,players:{},active:{},settled:false};
   value.active??={};
   for(const row of rows.filter(Boolean)){
    // A shard replaces its legacy entries, including removed active markers.
    for(const id of Object.keys(value.players))if(shard(id)===row.shard)delete value.players[id];
    for(const id of Object.keys(value.active))if(shard(id)===row.shard)delete value.active[id];
    for(const [id,player]of Object.entries(row.players))value.players[id]={...player,...(base?.settled&&base.players[id]?.finalRank?{finalRank:base.players[id].finalRank}:{})};
    Object.assign(value.active,row.active);
   }
   return value;
  };
  shards=shards.filter(row=>row.shard!==own);if(ownRow)shards.push(ownRow);
  let board=merge(shards),locked=false;
  // Finalization is rare (once per day), not part of every battle poll.
  if(board&&!base?.settled&&at>=board.closes&&!Object.entries(board.active??{}).some(([id,active])=>id!==owner&&active)){
   shards=[];for(let n=0;n<32;n++)shards.push(await io.get(shardKey(day,n.toString(16).padStart(2,'0'))));
   board=merge(shards);locked=true;
  }
  loaded.set(day,{base,own,locked});
  return board;
 };
 io.putWorldBoard=async(board,owner,erase=false)=>{
  const context=loaded.get(board.day);if(!context)throw Error('World board was not loaded');
  const own=context.own;
  // A newly created board has no shared mutable row. Old boards remain readable.
  await io.put(shardKey(board.day,own),{day:board.day,bossIndex:board.bossIndex,closes:board.closes,shard:own,
   players:Object.fromEntries(Object.entries(board.players).filter(([id])=>shard(id)===own)),
   active:Object.fromEntries(Object.entries(board.active??{}).filter(([id])=>shard(id)===own))});
  if(board.settled&&!context.base?.settled){
   if(!context.locked)throw Error('World ranking cannot settle without a consistent snapshot');
   await io.put(baseKey(board.day),board);
  }
  if(erase&&context.base){delete context.base.players[owner];delete context.base.active?.[owner];await io.put(baseKey(board.day),context.base);}
 };
}
module.exports={attachWorldBoards,shard,baseKey,shardKey};
