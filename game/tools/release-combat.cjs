const fs=require('node:fs'),root='game/assets/scripts/';
function edit(f,fn){if(process.argv.includes('--battle-only')&&f!=='core/battle.ts')return;const p=root+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));return s.replace(a,b);}
edit('core/types.ts',s=>rep(rep(s,"  | 'strong'", "  | 'scatter' | 'daze' | 'arcane' | 'holyLight' | 'spirit' | 'counterStorm'\n  | 'strong'"),"export interface SkillDefinition {","export interface SkillDefinition { precious?:boolean;"));
edit('core/data.ts',s=>{
 s=rep(s,"export const SKILLS: SkillDefinition[] = [",`export const SKILLS: SkillDefinition[] = [
  {id:'scatter',name:'散射',precious:true,description:'普攻额外攻击2个不同敌人，各造成70%普攻伤害；与多重攻击叠加。治疗普攻不额外攻击。'},
  {id:'daze',name:'迷糊',precious:true,description:'自己嘲讽的敌人移动速度降低30%，持续3秒。同类减速取最高值。'},
  {id:'arcane',name:'法术奥义',precious:true,description:'法术技能伤害提高20%，命中减速20%持续2秒；每次命中1%概率晕眩0.5秒，触发后冷却3秒。'},
  {id:'holyLight',name:'圣光',precious:true,description:'自己获得有效治疗或恢复生命时25%概率获得3秒圣光：受到伤害降低10%、造成伤害提高10%；触发冷却6秒。'},
  {id:'spirit',name:'通灵',precious:true,description:'召唤改为异时空石头人，落地造成100%继承攻击的范围伤害；免疫伤害，普攻并每秒灼烧周围敌人。最多2只，持续5秒。'},
  {id:'counterStorm',name:'反击风暴',precious:true,description:'受到直接攻击时20%概率对周围敌人发动1～3次风暴；每次伤害为最大生命3%＋护甲与法抗之和的20%，触发冷却3秒。'},`);
 s=rep(s,'range: 4.8','range: 5.6');
 s=rep(s,"name: '潮汐冲击', description: '主目标260%法术攻击；附近最多3个敌人各受110%法术攻击'","name: '海霜风暴', description: '在射程内指定区域降下3秒暴风雪，每秒造成80%法术攻击并减速25%；半径1.8格'");
 s=rep(s,"name: '泡泡圈', description: '半径1.5格内最多五个敌人定身1.8秒'","name: '潮灵召唤', description: '在射程内召唤2只小龟，继承自身40%攻击、35%生命和50%双抗，可攻击也可被攻击，持续12秒'");return s;
});
edit('core/prototypeConfig.ts',s=>rep(s,"  pursuit:{normal:4",`  scatter:{normal:1,ordinary:0,fine:2,quality:1},daze:{normal:1,ordinary:0,fine:2,quality:.8},
  arcane:{normal:1,ordinary:0,fine:2,quality:1},holyLight:{normal:1,ordinary:0,fine:2,quality:.95},
  spirit:{normal:1,ordinary:0,fine:2,quality:1},counterStorm:{normal:1,ordinary:0,fine:2,quality:1},
  pursuit:{normal:4`));
edit('core/talents.ts',s=>rep(s,"probability:x.role===role?5:!x.role?2:1","probability:x.precious?.15:x.role===role?5:!x.role?2:1"));
edit('core/battle.ts',s=>{
 s=rep(s,"  pendingAttack?:","  holyUntilTick?:number;holyReadyTick?:number;\n  pendingAttack?:");
 s=rep(s,"export interface BattleState {",`export interface BattleSummon {
  id:string;ownerId:string;kind:'turtle'|'golem';x:number;z:number;hp:number;maxHp:number;attack:number;armor:number;resist:number;
  bornTick:number;untilTick:number;nextAttackTick:number;nextBurnTick:number;alive:boolean;
}
export interface BattleStorm {ownerId:string;x:number;z:number;untilTick:number;nextTick:number}
export interface BattleState {
  summons?:BattleSummon[];storms?:BattleStorm[];nextSummonId?:number;`);
 s=rep(s,"id==='bubbleRing'?'area'","(id==='bubbleRing'||id==='crystalCannon')?'area'");
 s=rep(s,"&&state.enemies.some(e=>e.alive&&distance(e,p)<=BATTLE_RULES.splashRadius)","&&(command.skillId==='bubbleRing'||state.enemies.some(e=>e.alive&&distance(e,p)<=1.8))");
 s=rep(s,"  for (const enemy of state.enemies) {\n    if (!enemy.alive) continue;","  tickSummons(state);\n  for (const enemy of state.enemies) {\n    if (!enemy.alive) continue;");
 s=rep(s,"function power(unit: BattleUnit): number { return unit.attack *", "function power(unit: BattleUnit): number { return unit.attack *");
 s=rep(s,"  if(has(unit,'extraTarget')){const extra=state.enemies", "  if(has(unit,'scatter')){activate(unit,'scatter');for(const e of state.enemies.filter(e=>e.alive&&!hitIds.has(e.id)&&distance(e,unit)<=unit.range).sort((a,b)=>remainingRoute(state,a)-remainingRoute(state,b)).slice(0,2)){hitIds.add(e.id);damageEnemy(state,unit,e,amount*.7,magic,'secondary','scatter');}}\n  if(has(unit,'extraTarget')){const extra=state.enemies");
 const start=s.indexOf("  else if (skill === 'crystalCannon'&&target)"),end=s.indexOf('  } else return false;',start);if(start<0||end<0)throw Error('cast anchor');
 s=s.slice(0,start)+`  else if (skill === 'crystalCannon') {
    const center=command?.point??target!;state.storms??=[];
    state.storms.push({ownerId:unit.id,x:center.x,z:center.z,nextTick:state.tick,untilTick:state.tick+tickTime(3)});
  } else if (skill === 'bubbleRing') {
    summonCompanions(state,unit,command?.point??target!);
`+s.slice(end);
 s=rep(s,"  const pursuit=",`  if(tag!=='reflect'&&(source.holyUntilTick??0)>state.tick)raw*=1.1;
  if(magic&&skillId&&tag!=='reflect'&&has(source,'arcane')){
    raw*=1.2;activate(source,'arcane');setStatus(state,target,'slow',.2,2,source.id);
    if((source.cooldowns.arcane??0)<=state.tick&&random(state)<.01){
      const before=target.controlCount;controlEnemy(state,target,.5,source.id,'arcane');
      const root=target.statuses.find(x=>x.kind==='root');if(root&&target.controlCount>before)setStatus(state,target,'stun',1,Math.max(.05,(root.untilTick-state.tick)*.05),source.id);
      source.cooldowns.arcane=state.tick+tickTime(3);
    }
  }
  const pursuit=`);
 s=rep(s,"  const blocked = state.units.find",`  const pet=state.summons?.filter(p=>p.alive&&distance(p,enemy)<=enemy.range).sort((a,b)=>distance(a,enemy)-distance(b,enemy))[0];
  const forcedOwner=enemy.statuses.some(s=>s.kind==='taunt'&&s.untilTick>state.tick);
  if(pet&&!forcedOwner&&!enemy.blockedBy){
    enemy.nextAttackTick=state.tick+tickTime(enemy.interval);enemy.attackCount++;
    emit(state,{type:'attack',sourceId:enemy.id,targetId:pet.id,x:pet.x,z:pet.z,effect:enemy.kind});
    const amount=pet.kind==='golem'?0:Math.min(pet.hp,enemy.attack*100/(100+(enemy.kind==='mist'?pet.resist:pet.armor)));
    pet.hp-=amount;pet.alive=pet.hp>0;emit(state,{type:'damage',sourceId:enemy.id,targetId:pet.id,amount,x:pet.x,z:pet.z});return;
  }
  const blocked = state.units.find`);
 s=rep(s,"  let amount = raw * 100 / (100 + defense);","  let amount = raw * 100 / (100 + defense)*((target.holyUntilTick??0)>state.tick?.9:1);");
 s=rep(s,"  return actual;\n}\n\nfunction loseUnitHealth",`  if(actual>0&&target.alive&&has(target,'counterStorm')&&(target.cooldowns.counterStorm??0)<=state.tick&&random(state)<.2){
    target.cooldowns.counterStorm=state.tick+tickTime(3);activate(target,'counterStorm');
    const strikes=1+Math.floor(random(state)*3),amount=target.maxHp*.03+(target.armor+target.resist)*.2;
    for(let i=0;i<strikes;i++)for(const e of state.enemies.filter(e=>e.alive&&distance(e,target)<=1.8))damageEnemy(state,target,e,amount,false,'secondary','counterStorm');
    emit(state,{type:'skill',sourceId:target.id,skillId:'counterStorm',amount:strikes,x:target.x,z:target.z});
  }
  return actual;
}

function loseUnitHealth`);
 s=rep(s,"  target.hp += amount;",`  target.hp += amount;
  if(has(target,'holyLight')&&(target.holyReadyTick??0)<=state.tick&&random(state)<.25){
    target.holyReadyTick=state.tick+tickTime(6);target.holyUntilTick=state.tick+tickTime(3);activate(target,'holyLight');
    emit(state,{type:'skill',sourceId:target.id,targetId:target.id,skillId:'holyLight',x:target.x,z:target.z});
  }`);
 s=rep(s,"  emit(state,{type:'skill',sourceId:unit.id,targetId:target.id,skillId:'taunt'", "  if(has(unit,'daze')){setStatus(state,target,'slow',.3,3,unit.id);activate(unit,'daze');}\n  emit(state,{type:'skill',sourceId:unit.id,targetId:target.id,skillId:'taunt'");
 s+=`
function summonCompanions(state:BattleState,owner:BattleUnit,point:Point):void{
  state.summons??=[];const kind=has(owner,'spirit')?'golem':'turtle';
  const alive=state.summons.filter(p=>p.ownerId===owner.id&&p.alive);
  // Refresh one's own pair; the cap never depends on cast or movement spam.
  for(const p of alive){p.alive=false;p.hp=0;}
  if(kind==='golem')activate(owner,'spirit');
  for(let i=0;i<2;i++){
    const pet:BattleSummon={id:'summon-'+(state.nextSummonId=(state.nextSummonId??0)+1),ownerId:owner.id,kind,
      x:point.x+(i? .32:-.32),z:point.z,hp:owner.maxHp*.35,maxHp:owner.maxHp*.35,attack:power(owner)*.4,armor:owner.armor*.5,resist:owner.resist*.5,
      bornTick:state.tick,untilTick:state.tick+tickTime(kind==='golem'?5:12),nextAttackTick:state.tick+tickTime(.5),nextBurnTick:state.tick+tickTime(1),alive:true};
    state.summons.push(pet);emit(state,{type:'spawn',sourceId:pet.id,skillId:kind==='golem'?'spirit':'bubbleRing',x:pet.x,z:pet.z,effect:kind});
    if(kind==='golem')for(const e of state.enemies.filter(e=>e.alive&&distance(e,pet)<=1.5))damageEnemy(state,owner,e,pet.attack,true,'secondary','spirit');
  }
}
function tickSummons(state:BattleState):void{
  for(const area of state.storms??[]){
    const owner=state.units.concat(state.benchUnits??[]).find(u=>u.id===area.ownerId);
    if(!owner||state.tick>=area.untilTick||state.tick<area.nextTick)continue;
    area.nextTick+=tickTime(1);
    for(const e of state.enemies.filter(e=>e.alive&&distance(e,area)<=1.8)){
      damageEnemy(state,owner,e,power(owner)*.8,true,'secondary','crystalCannon');setStatus(state,e,'slow',.25,1.2,owner.id);
    }
    emit(state,{type:'skill',sourceId:owner.id,skillId:'crystalCannon',x:area.x,z:area.z,effect:'blizzardPulse'});
  }
  state.storms=state.storms?.filter(s=>s.untilTick>state.tick);
  for(const pet of state.summons??[]){
    if(!pet.alive)continue;if(state.tick>=pet.untilTick){pet.alive=false;pet.hp=0;continue;}
    const owner=state.units.concat(state.benchUnits??[]).find(u=>u.id===pet.ownerId);if(!owner)continue;
    const enemies=state.enemies.filter(e=>e.alive).sort((a,b)=>distance(a,pet)-distance(b,pet)),target=enemies[0];
    if(!target)continue;
    const d=distance(target,pet);
    if(d>1.1){const move=Math.min(d-1,2.2*.05);pet.x+=(target.x-pet.x)/d*move;pet.z+=(target.z-pet.z)/d*move;}
    if(d<=1.4&&state.tick>=pet.nextAttackTick){pet.nextAttackTick=state.tick+tickTime(1.1);emit(state,{type:'attack',sourceId:pet.id,targetId:target.id,x:target.x,z:target.z,effect:pet.kind});damageEnemy(state,owner,target,pet.attack,false,'secondary',pet.kind==='golem'?'spirit':'bubbleRing');}
    if(pet.kind==='golem'&&state.tick>=pet.nextBurnTick){pet.nextBurnTick=state.tick+tickTime(1);for(const e of enemies.filter(e=>distance(e,pet)<=1.6))damageEnemy(state,owner,e,pet.attack*.4,true,'secondary','spirit');emit(state,{type:'skill',sourceId:pet.id,skillId:'spirit',x:pet.x,z:pet.z,effect:'burn'});}
  }
}
`;
 // Both arena sides use the same persistent summon/effect simulation.
 s=rep(s,"const opponents=side===teamA?teamB:teamA;state.units=side;updateAuras(state);","const opponents=side===teamA?teamB:teamA;state.units=side;updateAuras(state);state.enemies=opponents.map((t,i)=>turtleEnemy(t,100-i));tickSummons(state);");
 return s;
});
console.log('Six precious passives and summon/blizzard simulation applied');
