const fs=require('node:fs'),root='game/assets/scripts/';
function edit(file,fn){if(['core/save.ts','core/communityValidation.ts'].includes(file))return;const path=root+file;let text=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');const r=(a,b)=>{if(!text.includes(a))throw Error(file+' missing '+a.slice(0,75));text=text.replace(a,b)};fn(r,()=>text,v=>text=v);fs.writeFileSync(path,text);}
edit('core/save.ts',(r)=>{
 r("if(g.kind==='gold')return;","if(g.kind==='gold')return;if(g.kind==='bookPack'){requireRule(validReward(g),'技能礼包损坏','SAVE');return;}");
 r("export function validateTurtle(t:Turtle):void{","export function validateTurtle(t:Turtle):void{\n  if(t)validateDevelopment(t);");
 r("s.economyVersion===undefined||s.economyVersion===2","s.economyVersion===undefined||s.economyVersion===2||s.economyVersion===3");
 r('validateProgression(s);',"validateProgression(s);validateMailbox(s);requireRule(s.livingVersion===undefined||s.livingVersion===1,'成长版本损坏','SAVE');if(s.bookPacks)for(const [grade,count] of Object.entries(s.bookPacks))requireRule(!!PACK_NAMES[grade as keyof typeof PACK_NAMES]&&integer(count,0),'技能礼包背包损坏','SAVE');");
});
edit('core/communityValidation.ts',(r)=>{r('s.economyVersion===2?','s.economyVersion?');r("denomination===1||denomination===1000&&s.economyVersion===2","denomination===1||denomination===1000&&s.economyVersion===2||denomination===100&&s.economyVersion===3");});
edit('core/game.ts',(r)=>{
 r("import {goldAmount,migrateEconomy} from './economy';", "import {goldAmount,migrateEconomy} from './economy';\nimport {enableLiving} from './living';\nimport {initDevelopment,grantExperience,allocatePoints,resetPoints} from './development';\nimport {readMail,claimMail,deleteMail} from './mail';\nimport {openBookPack} from './rewardPacks';");
 r('if(this.state.economyVersion!==2)','if(!this.state.economyVersion)');
 r('  purchaseShop(commandId:',`  enableLiving(commandId:string):void{if(!this.state.livingVersion)this.transact(commandId,'livingV1',s=>enableLiving(s));}
  allocatePetPoints(commandId:string,id:string,points:Record<import('./types').Aptitude,number>):void{this.transact(commandId,'allocate',s=>{ensureHome(s);allocatePoints(s,id,points);});}
  resetPetPoints(commandId:string,id:string):void{this.transact(commandId,'resetPoints',s=>{ensureHome(s);resetPoints(s,id);});}
  readMail(commandId:string,id:string):void{this.transact(commandId,'readMail',s=>readMail(s,id));}
  claimMail(commandId:string,id:string):void{this.transact(commandId,'claimMail',s=>claimMail(s,id));}
  deleteMail(commandId:string,id:string):void{this.transact(commandId,'deleteMail',s=>deleteMail(s,id));}
  openBookPack(commandId:string,grade:import('./types').BookPackGrade):SkillId{return this.transact(commandId,'openPack',s=>openBookPack(s,grade));}
  purchaseShop(commandId:`);
 r('    syncProgression(next,now);\n    // Clock', '    if(next.livingVersion)for(const t of Object.values(next.collection))initDevelopment(t);\n    syncProgression(next,now);\n    // Clock');
 r("const growth=material==='growth',cap=growth?5:10,", "const growth=material==='growth',cap=s.livingVersion?(growth?20:40):(growth?5:10),");
 r("      r.wave++;r.goldEarned", "      r.wave++;grantExperience(s,r.usedSources,r.mode==='endless'?10+Math.min(60,r.wave)*2:22+r.levelId*2+r.wave*3);for(const u of live(r)){const owned=u.savedId&&s.collection[u.savedId];if(owned?.development)u.turtle.development=copy(owned.development);}\n      r.goldEarned");
});
edit('core/battle.ts',(r)=>{
 r("import {", "import {developmentBonus} from './development';\nimport {");
 r("    const maxHp = role.health", "    const bonus=developmentBonus(turtle);\n    const maxHp = bonus.health * role.health");
 r("attack: role.attack * aptitude('attack') * progression,", "attack: role.attack * aptitude('attack') * progression * bonus.attack,");
 r("armor: role.armor * aptitude('defense') +", "armor: bonus.armor + role.armor * aptitude('defense') +");
 r("resist: role.resist * aptitude('defense') +", "resist: bonus.resist + role.resist * aptitude('defense') +");
 r("range: (definition.stationVersion===4&&turtle.role==='stone'?2.2:role.range)", "range: (turtle.development&&turtle.role==='stone'?2.8:definition.stationVersion===4&&turtle.role==='stone'?2.2:role.range)");
});
edit('core/data.ts',(r)=>r('range: 5.6, starters:', 'range: 4.6, starters:'));
edit('core/fusion.ts',(r)=>r("return {id,role:branch.role", "return {...(a.development||b.development?{development:{version:1 as const,xp:Math.floor(((a.development?.xp??0)+(b.development?.xp??0))/2),points:{attack:0,health:0,defense:0}}}:{}),id,role:branch.role"));
edit('core/prototype.ts',(r,get,set)=>{
 r("import {goldAmount,goldGrants} from './economy';", "import {goldAmount,goldGrants} from './economy';\nimport {applyReward,packForWave} from './rewardPacks';\nimport {grantExperience} from './development';");
 set(get().replaceAll('s.economyVersion===2','!!s.economyVersion'));
 r("else{s.skillBooks??={};s.skillBooks[g.skillId]", "else if(g.kind==='bookPack'){applyReward(s,g);}else{s.skillBooks??={};s.skillBooks[g.skillId]");
 r("    firstClearGold:first?", "    firstClearGold:first?");
 r("  if(endless&&r.wave>0){", "  if(s.livingVersion){grantExperience(s,r.usedSources,(!endless&&victory?50:0));}\n  if(endless&&r.wave>0){");
 r("amount:Math.max(1,Math.floor(floor/5))}],now)", "amount:Math.max(1,Math.floor(floor/5))},...(s.livingVersion?[{kind:'bookPack' as const,grade:packForWave(floor),amount:Math.max(1,Math.floor(floor/20))}]:[])],now)");
 // Each ten-wave milestone is a distinct chest; unlocks only at settlement.
 r("  finishLoans(s,r.id);s.gold", "  if(s.livingVersion&&endless)for(let wave=10;wave<=r.wave;wave+=10)grantChest(s,'endless:'+r.id+':'+wave,wave+'波里程宝箱',Math.min(3,1+Math.floor(wave/30)),[{kind:'gold',amount:goldAmount(s,30+wave*5)},{kind:'bookPack',grade:packForWave(wave),amount:1}],now);\n  finishLoans(s,r.id);s.gold");
});
edit('core/raids.ts',(r)=>{
 r("import {goldAmount} from './economy';", "import {goldAmount} from './economy';\nimport {applyReward} from './rewardPacks';\nimport {grantExperience} from './development';");
 r("function grant(s:GameSave,g:RewardGrant):void{if(g.kind==='gold')s.gold+=g.amount;else if(g.kind==='material')s.materials[g.material]+=g.amount;else{s.skillBooks??={};s.skillBooks[g.skillId]=(s.skillBooks[g.skillId]??0)+g.amount;}}", "function grant(s:GameSave,g:RewardGrant):void{applyReward(s,g);}");
 r("  finishLoans(s,r.id);return copy(r);", "  grantExperience(s,r.members[0].roster.map(p=>p.originalId),r.wave*(16+r.tier*8)+(r.victory?60:0));\n  finishLoans(s,r.id);return copy(r);");
});
edit('core/arena.ts',(r)=>{r("import type {GameSave,Point}", "import {grantExperience} from './development';\nimport type {GameSave,Point}");r("  const outcome=arenaOutcome(next);", "  requireRule(!current.settled,'竞技场已结算');\n  const outcome=arenaOutcome(next);");r("  a.rankAfter=c.arenaOrder", "  if(!a.practice)grantExperience(s,c.arenaAttack,a.victory?65:abandon?0:32);\n  a.rankAfter=c.arenaOrder");});
console.log('Living core integration complete');
