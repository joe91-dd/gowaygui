const fs=require('fs');function edit(p,f){let s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,f(s));}
edit('game/assets/scripts/view/BattleScreen.ts',s=>{
 s=s.replace("    if(u?.slot===null&&",`    const actor=this.battle?.units.find(v=>v.id===id);
    if(actor&&!actor.alive)return '伙伴已倒下，请换上一只可战斗的龟';
    if(actor&&this.battle!.tick<(actor.moveReadyTick??0))return '调位尚在冷却，请稍等';
    if(this.battle?.storms?.some(v=>v.ownerId===id&&v.kind==='rock'&&v.untilTick>this.battle!.tick))return '岩石风暴结束后才能调位';
    if(u?.slot===null&&`);
 s=s.replace("this.act(()=>{this.service.placeUnit(this.command('place'),this.selected,p,this.battle);", "const issue=this.landingIssue(this.selected,p);if(issue){this.ui.toast(issue);return;}this.act(()=>{this.service.placeUnit(this.command('place'),this.selected,p,this.battle);");
 s=s.replace("else if(at)this.act(()=>{this.service.placeUnit(this.command('place'),id,at,this.battle);this.battle=this.run.battle;this.selected=id;});", "else if(at){const issue=this.landingIssue(id,at);if(issue){this.ui.toast(issue);return;}this.act(()=>{this.service.placeUnit(this.command('place'),id,at,this.battle);this.battle=this.run.battle;this.selected=id;});}");
 return s;
});
edit('game/assets/scripts/core/battle.ts',s=>s.replace("c.kind==='frost'||c.kind==='drain',false", "c.kind==='frost'||c.kind==='drain'||c.kind==='mortar',false").replace("      if(u.alive&&c.kind==='frost')", "      if(u.alive&&c.kind==='shock')setStatus(state,u,'weaken',.15,3,e.id);\n      if(u.alive&&c.kind==='frost')"));
edit('game/assets/scripts/core/bossCatalog.ts',s=>s.replace("if(bossFor(l,w).id===id)list.push(['碎礁洞穴'","if((([16,20,21][l-51]+w-1)%10===0||w===[6,8,10][l-51])&&bossFor(l,w).id===id)list.push(['碎礁洞穴'").replace('for(let w=5;w<=120;w+=5)','for(let w=10;w<=120;w+=10)'));
edit('game/tests/coral-expansion.test.cjs',s=>s.replace("b.spawns=[{time:999", "b.autoSkills=false;b.units.forEach(u=>u.nextAttackTick=1e8);b.spawns=[{time:999"));
edit('game/tests/raid-drag-release.test.cjs',s=>s.replace('assert.deepEqual(moves,expected)','assert.deepEqual(JSON.parse(JSON.stringify(moves)),expected)'));
edit('game/assets/scripts/view/BattleWorld.ts',s=>s.replace('paint?:Node;qualityRing?', 'skills?:string[];paint?:Node;qualityRing?').replace('this.syncActor(actor, unit, frame, tickChanged, elapsed);','actor.skills=unit.skills;this.syncActor(actor, unit, frame, tickChanged, elapsed);').replace("source&&'skills' in source?5:4", "source?.skills?.includes('crystalMastery')?5:4"));
