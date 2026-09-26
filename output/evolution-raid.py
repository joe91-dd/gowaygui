from pathlib import Path
root=Path('game/assets/scripts')
def edit(f,a,b):
 p=root/f;s=p.read_text(encoding='utf-8');assert a in s,(f,a[:50]);p.write_text(s.replace(a,b),encoding='utf-8')
p=root/'core/data.ts';s=p.read_text(encoding='utf-8');s=s.replace('expandedStations(LEGACY_APPROVED_MAPS);', '''expandedStations(LEGACY_APPROVED_MAPS).concat({id:55,name:'双环潮狱',subtitle:'三分钟潮汐围城',waves:1,targetSeconds:[180,180],spawnDuration:174,preparationSeconds:0,mergeWaves:[],difficulty:3,layoutVersion:2,stationVersion:4,
 route:[{x:-8,z:-3},{x:-1,z:-3},{x:-1,z:3},{x:-8,z:3},{x:-8,z:-3},{x:1,z:-3},{x:8,z:-3},{x:8,z:3},{x:1,z:3},{x:1,z:-3},{x:-8,z:-3}],
 slots:[{x:-5,z:-1.5},{x:-5,z:1.5},{x:4,z:-1.5},{x:4,z:1.5},{x:0,z:0},{x:-9.3,z:0},{x:9.3,z:0},{x:-4,z:4.3},{x:4,z:4.3},{x:-4,z:-4.3},{x:4,z:-4.3},{x:-2.5,z:0},{x:2.5,z:0},{x:-6.5,z:0},{x:6.5,z:0},{x:0,z:4.3}]});''');p.write_text(s,encoding='utf-8')
edit(Path('core/mapPresentation.ts'),'MAP_THEMES[m.id<50?Math.floor(m.id/5):m.id-40]','MAP_THEMES[m.id===55?13:m.id<50?Math.floor(m.id/5):m.id-40]')
p=root/'core/raids.ts';s=p.read_text(encoding='utf-8');s="import {grantChest,discoverBattle} from './progression';\n"+s;s=s.replace("export const RAIDS=[","export const raidMapId=(tier:number)=>tier===3?55:51+tier;\nexport const RAIDS=[")
s=s.replace("] as const;\nexport const RAID_BALANCE", "  {name:'双环潮狱',waves:1,baseWave:22,gold:1200,food:9,books:3,description:'难度3 · 三分钟连通双环；剩余超过15只失败，5只以内完美'},\n] as const;\nexport const RAID_BALANCE",1)
s=s.replace("{health:1.3,boss:.58}]","{health:1.3,boss:.58},{health:1.35,boss:.65}]")
s=s.replace('51+r.tier','raidMapId(r.tier)').replace('51+next.tier','raidMapId(next.tier)')
s=s.replace('  return b;\n}', '''  if(r.tier===3){b.spawns=Array.from({length:300},(_,i)=>({kind:(i%60===59?'boss':['ink','runner','armored','mist','snail','elite'][i%6]) as import('./types').EnemyKind,time:i*.58,hpScale:(1.8+Math.floor(i/50)*.55)*(i%60===59?.5:1),attackScale:1.3+Math.floor(i/50)*.14}));}
  return b;
}''',1)
s=s.replace('    const won=r.battle.status===\'won\';', "    discoverBattle(s,r.battle);if(r.tier===3)r.remaining=r.battle.enemies.filter(e=>e.alive).length;\n    const won=r.battle.status==='won';")
s=s.replace('  finishLoans(s,r.id);return copy(r);', '''  if(r.victory){r.stars=r.tier===3?((r.remaining??0)<=5?3:(r.remaining??0)<=10?2:1):r.coreHealth===20?3:r.coreHealth>=12?2:1;
   r.chestId=grantChest(s,'raid:'+r.id,'副本 '+r.stars+' 星宝箱',r.stars,[{kind:'gold',amount:goldAmount(s,RAIDS[r.tier].gold*r.stars/5)},{kind:'material',material:'growth',amount:r.stars},{kind:'book',skillId:drawBook(s,r.stars===3?'fine':'ordinary'),amount:1}]).id;}
  finishLoans(s,r.id);return copy(r);''')
p.write_text(s,encoding='utf-8')
p=root/'view/ChallengeScreen.ts';s=p.read_text(encoding='utf-8');s="import {raidMapId} from '../core/raids';\n"+s;s=s.replace('51+this.raid.tier','raidMapId(this.raid.tier)').replace('51+r.tier','raidMapId(r.tier)');s=s.replace("if(this.heading)this.heading.string=this.raid?`守护 ${b.coreHealth}/20 · 第${this.raid.wave+1}波`", "if(this.heading)this.heading.string=this.raid?.tier===3?`双环潮狱 · 剩余 ${Math.max(0,180-Math.floor(b.elapsed))}秒 · 敌人 ${b.enemies.filter(e=>e.alive).length}/15`:this.raid?`守护 ${b.coreHealth}/20 · 第${this.raid.wave+1}波`")
s=s.replace("      this.ui.text('奖励已保存，伙伴仍保留在收藏。'", "      if(r?.chestId){const id=r.chestId,c=this.service.snapshot.progression?.chests.find(c=>c.id===id);this.button(c?.claimed?'宝箱已领取':`领取 ${r.stars} 星宝箱`,0,-88,340,48,()=>{this.service.claimChest(this.command('raidChest'),id);this.result();},p,!!c?.claimed,true);}\n      this.ui.text('基础奖励已保存；宝箱可在成就中补领。'")
p.write_text(s,encoding='utf-8')
p=root/'core/communityValidation.ts';s=p.read_text(encoding='utf-8');s=s.replace('n(r.tier,0,2)','n(r.tier,0,3)').replace('BATTLE_MAPS[51+r.tier]','BATTLE_MAPS[r.tier===3?55:51+r.tier]');p.write_text(s,encoding='utf-8')
p=root/'core/battle.ts';s=p.read_text(encoding='utf-8');s=s.replace("  else if (state.spawnCursor >= state.spawns.length && state.enemies.every(e => !e.alive)) state.status = 'won';", "  else if(state.levelId===55){if(state.tick>=3600)state.status=state.enemies.filter(e=>e.alive).length<=15?'won':'lost';}\n  else if (state.spawnCursor >= state.spawns.length && state.enemies.every(e => !e.alive)) state.status = 'won';")
s=s.replace('      Object.assign(enemy, positionOnRoute(state, enemy.distance,enemy.routeId));', '      if(state.levelId===55&&enemy.distance>=state.routeLength)enemy.distance%=state.routeLength;\n      Object.assign(enemy, positionOnRoute(state, enemy.distance,enemy.routeId));')
s=s.replace("if(state.stationVersion===4&&spawn.kind==='boss')", "if(state.encounterVersion===1&&spawn.kind==='boss')")
s=s.replace('definition.id<54','definition.id!==54')
p.write_text(s,encoding='utf-8')
p=root/'core/battleValidation.ts';s=p.read_text(encoding='utf-8');s=s.replace("if (status === 'won') check(spawnCursor === spawns.length && deadEnemies === enemies.length", "if (status === 'won') check(s.levelId===55?s.tick===3600&&enemies.filter(e=>e.alive).length<=15:spawnCursor === spawns.length && deadEnemies === enemies.length")
p.write_text(s,encoding='utf-8')
