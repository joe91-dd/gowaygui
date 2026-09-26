const fs=require('node:fs'),root='game/assets/scripts/';
function edit(f,fn){const p=root+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));return s.replace(a,b);}
edit('core/types.ts',s=>rep(s,'  waveLimit?:number;','  waveLimit?:number;\n  bossRescuedWaves?:number[];'));
edit('core/prototype.ts',s=>{
 s=rep(s,'{waveLimit:levelId===0?5:8}','{waveLimit:5,bossRescuedWaves:[]}');
 s=rep(s,"    if(old){old.removed='refresh';delete old.benchSlot;}","    if(old){if(r.battle)retireBenchedBattleUnit(r.battle,old.id);old.removed='refresh';delete old.benchSlot;}");return s;
});
edit('core/battle.ts',s=>rep(s,"options.waveLimit!==(levelId===0?5:8)","!(options.waveLimit===5||levelId>0&&options.waveLimit===8)"));
edit('core/save.ts',s=>{
 s=rep(s,"r.waveLimit===(r.levelId===0?5:8)","(r.waveLimit===5||r.levelId>0&&r.waveLimit===8)");
 s=rep(s,"    if(r.waveLimit!==undefined)","    if(r.bossRescuedWaves!==undefined)requireRule(Array.isArray(r.bossRescuedWaves)&&r.bossRescuedWaves.length<=5&&new Set(r.bossRescuedWaves).size===r.bossRescuedWaves.length&&r.bossRescuedWaves.every(w=>integer(w,1,5)),'解救记录损坏','SAVE');\n    if(r.waveLimit!==undefined)");return s;
});
edit('core/prototypeConfig.ts',s=>{
 s=rep(s,"  const c=PROTOTYPE.endless,phase=",`  if(!endless&&levelId<50&&waveLimit===5){
    const tutorial=levelId===0,duration=tutorial?16+wave*2:32+wave*2;
    const count=tutorial?7+wave*2:13+Math.floor(levelId/10)+wave*3;
    const scale=level.difficulty*Math.pow(1.10,wave-1);
    const regular:Spawn[]=Array.from({length:count},(_,i)=>({kind:'ink',time:i*duration/(count-1),hpScale:scale,attackScale:Math.sqrt(scale)*(tutorial?1.05:1.2)}));
    regular.push({kind:'boss',time:duration,hpScale:scale*(wave===5?(tutorial?.38:.68):(tutorial?.12:.23)),attackScale:Math.sqrt(scale)*(wave===5?1.05:.7)});
    return tacticalSpawns(regular,levelId,wave);
  }
  const c=PROTOTYPE.endless,phase=`);return s;
});
edit('core/game.ts',s=>{
 s=rep(s,'function runOf(s:GameSave',`function rescueBoss(s:GameSave,r:RunState,battle:BattleState,now:number):boolean{
  if(r.bossRescuedWaves===undefined||r.mode!=='chapter'||r.bossRescuedWaves.includes(battle.wave)||!battle.enemies.some(e=>e.kind==='boss'&&!e.alive&&e.hp<=0))return false;
  r.bossRescuedWaves.push(battle.wave);
  prototype.refreshBench(s,r,now,(save,at)=>{
    const t=freshTurtle(save,at),roll=random(save),last=battle.wave===5;
    const count=last?(roll<.2?3:roll<.7?4:5):(roll<.25?2:roll<.75?3:4);
    t.skills=initialSkills(save,t.role,count);
    for(const key of ['attack','health','defense'] as const)t.innate[key]=Math.min(100,t.innate[key]+(last?10:5));
    t.innate.growth=Math.min(110,t.innate.growth+(last?3:1));return t;
  });return true;
}
function runOf(s:GameSave`);
 s=rep(s,"this.transact(commandId,'checkpoint',s=>{const r=runOf(s,['combat']);checkBattle(r,runId,battle);r.battle=copy(battle);});","this.transact(commandId,'checkpoint',(s,now)=>{const r=runOf(s,['combat']);checkBattle(r,runId,battle);r.battle=copy(battle);rescueBoss(s,r,r.battle,now);});");
 s=rep(s,"      r.coreHealth=battle.coreHealth;r.combatSeconds+=battle.elapsed;delete r.battle;","      if(r.bossRescuedWaves!==undefined){r.battle=copy(battle);rescueBoss(s,r,r.battle,now);}\n      r.coreHealth=battle.coreHealth;r.combatSeconds+=battle.elapsed;delete r.battle;");
 s=rep(s,"if(r.mode==='chapter')prototype.refreshBench(s,r,now,freshTurtle)","if(r.mode==='chapter'&&r.bossRescuedWaves===undefined)prototype.refreshBench(s,r,now,freshTurtle)");return s;
});
edit('view/GameEntry.ts',s=>rep(s,"(level.id===0?5:8)","5"));
edit('view/BattleScreen.ts',s=>{
 s=rep(s,"this.service.checkpointBattle(this.command('checkpoint'),this.run.id,this.battle);this.lastCheckpointTick=this.battle.tick;",`const rescued=this.run.bossRescuedWaves?.length??0;
        this.service.checkpointBattle(this.command('checkpoint'),this.run.id,this.battle);this.lastCheckpointTick=this.battle.tick;
        this.battle=this.run.battle;
        if((this.run.bossRescuedWaves?.length??0)>rescued){this.render();this.ui.toast('击败首领！新伙伴已解救到未锁定备战槽');}`);
 s=s.replaceAll("'空槽\\n下波补充'","'空槽\\n击败首领补充'");return s;
});
edit('core/battleValidation.ts',s=>{
 s=rep(s,"check(id==='bubbleRing',name,'该技能不接受区域目标');","check(id==='bubbleRing'||id==='crystalCannon',name,'该技能不接受区域目标');");
 const anchor="  const queuedUnits = new Set<string>();";
 s=rep(s,anchor,`  if(s.summons!==undefined){
    const summoned=array(s.summons,'召唤物',512),next=integer(s.nextSummonId,'召唤序号',1),ids=new Set<string>();
    for(const raw of summoned){const pet=object(raw,'召唤物'),id=text(pet.id,'召唤物编号');check(!refs.entities.has(id)&&!ids.has(id),'召唤物','编号重复');ids.add(id);refs.entities.add(id);
      reference(pet.ownerId,'召唤者',new Set(refs.units.keys()));check(pet.kind==='golem'||pet.kind==='turtle','召唤类型','未知');point(pet,'召唤位置');health(pet,'召唤生命');
      for(const key of ['attack','armor','resist'])number(pet[key],'召唤属性.'+key);
      const born=integer(pet.bornTick,'召唤时间',0,tick);integer(pet.untilTick,'召唤截止',born+1,born+240);
      integer(pet.nextAttackTick,'召唤普攻');integer(pet.nextBurnTick,'召唤灼烧');
      check(Number(id.slice(7))<=next,'召唤序号','越界');
    }
    for(const id of refs.units.keys())check(summoned.filter(raw=>(raw as RecordValue).ownerId===id&&(raw as RecordValue).alive).length<=2,'召唤物','每位最多两只');
  }
  if(s.storms!==undefined)for(const raw of array(s.storms,'风暴区域',20)){const storm=object(raw,'风暴区域');reference(storm.ownerId,'风暴来源',new Set(refs.units.keys()));point(storm,'风暴位置');integer(storm.untilTick,'风暴截止');integer(storm.nextTick,'风暴触发');}
  const queuedUnits = new Set<string>();`);
 // Register pet references before validating unit statuses/events, not just commands.
 const blockStart=s.indexOf('  if(s.summons!==undefined){'),blockEnd=s.indexOf('  const queuedUnits',blockStart),block=s.slice(blockStart,blockEnd);
 s=s.slice(0,blockStart)+s.slice(blockEnd);const pos=s.indexOf('  for (const [i, raw] of Array.from(allUnits.entries()))',s.indexOf('refs.enemies.add(id)'));
 if(pos<0){/* entity references to pets only occur in events, so the original location is sufficient */s=s.replace(anchor,block+anchor);}else s=s.slice(0,pos)+block+s.slice(pos);
 return s;
});
console.log('Five-wave bosses, transactional rescue and summon validation applied');
