const fs=require('fs'),root=process.cwd()+'/game/assets/scripts/';
function edit(file,fn){let s=fs.readFileSync(root+file,'utf8').replace(/\r\n/g,'\n');const replace=(a,b)=>{if(!s.includes(a))throw Error(file+' missing '+a.slice(0,100));s=s.replace(a,b);};fn(replace,()=>s,v=>s=v);fs.writeFileSync(root+file,s);}
edit('core/game.ts',r=>r("import {readMail,claimMail,deleteMail}","import {sendSystemMail,readMail,claimMail,deleteMail}"));
edit('core/save.ts',r=>r("t.innate[key]+t.training[key]<=(growth?110:100)","t.innate[key]+t.training[key]<=(growth?115:110)"));
edit('core/data.ts',(r,g,s)=>{s(g().replace(/(stone:\s*\{[^}]*?range:\s*)1\.2/,'$12.8'));});
edit('view/PetDetails.ts',r=>r('size*3.9','size*6.3'));
edit('view/GameEntry.ts',r=>r("this.service.enableIncrement(this.command('economyV2'));","this.service.enableIncrement(this.command('economyV2'));this.service.enableLiving(this.command('livingV1'));"));
edit('view/BattleScreen.ts',r=>{
 r("const r=this.run,s=this.service.snapshot,level=BATTLE_MAPS[r.levelId],units=this.units,active=r.phase==='combat';","const r=this.run,s=this.service.snapshot,level=BATTLE_MAPS[r.levelId],units=this.units,active=r.phase==='combat';\n    if(r.mode==='endless'&&r.phase==='between'&&!this.paused&&!r.rewardNodes?.some(hasPendingReward)){this.startWave();return;}");
 r("if(slot===undefined&&source?.slot===null)for(const [otherId,target] of this.worldHits)","if(slot===undefined)for(const [otherId,target] of this.worldHits)");
 r("if(u?.slot===null&&this.units.filter(v=>v.slot!==null).length>=5)","const occupied=this.units.find(v=>v.id!==id&&v.slot!==null&&Math.hypot((v.placement??m.slots[v.slot]).x-p.x,(v.placement??m.slots[v.slot]).z-p.z)<.78);if(occupied)return undefined;\n    if(u?.slot===null&&this.units.filter(v=>v.slot!==null).length>=5)");
});
edit('core/raids.ts',r=>r("requireRule(!r.members.some((other,i)=>i!==memberIndex&&(other.station??i)===station),'此站位已有队友，请选择空位');","const occupied=r.members.findIndex((other,i)=>i!==memberIndex&&(point?Math.hypot((other.placement??map.slots[other.station??i]).x-point.x,(other.placement??map.slots[other.station??i]).z-point.z)<.78:(other.station??i)===station));if(occupied>=0){swapRaidPositions(r,memberIndex,occupied);return;}"));
edit('view/ChallengeScreen.ts',r=>{
 r("const issue=(p:Point)=>placementIssue(map,p,r.members.filter((_,i)=>i>0).map((m,i)=>m.placement??map.slots[m.station??i+1]));","const issue=(p:Point)=>r.members.some((m,i)=>i>0&&Math.hypot((m.placement??map.slots[m.station??i]).x-p.x,(m.placement??map.slots[m.station??i]).z-p.z)<.78)?undefined:placementIssue(map,p,r.members.filter((_,i)=>i>0).map((m,i)=>m.placement??map.slots[m.station??i+1]));");
 r('基础奖励已保存；宝箱可在成就中补领。','基础奖励已保存；宝箱可在副本奖励页补领。');
});
