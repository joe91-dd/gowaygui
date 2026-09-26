from pathlib import Path
import json,shutil
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');OUT=Path(__file__).resolve().parent
def edit(rel,fn):
 p=ROOT/rel;b=OUT/'code-before'/rel;b.parent.mkdir(parents=True,exist_ok=True)
 if not b.exists():shutil.copy2(p,b)
 text=p.read_text('utf-8');updated=fn(text);p.write_text(updated,'utf-8')
def battle(s):
 s=s.replace("import {FAUNA_DIMENSIONS} from '../core/faunaDimensions';","import {FAUNA_DIMENSIONS} from '../core/faunaDimensions';\nimport {ENEMY_G1,ENEMY_G1_GRADES,enemyG1,enemyG1Grade,g1EnemyAssetKeys,ORDINARY_G1} from '../core/enemyG1Catalog';\nimport {ENEMY_G1_DIMENSIONS} from '../core/enemyG1Dimensions';")
 a=s.index('const ENEMY_MODELS:');b=s.index('const EFFECT_LIMIT',a)
 s=s[:a]+"""const ENEMY_MODELS: Partial<Record<EnemyKind, ModelSpec>> = Object.fromEntries(
 [...ENEMY_G1.slice(14),ENEMY_G1[0]].map(x=>[x.kind,{path:x.model,material:'G1_',scale:x.kind==='boss'?1:.5,height:x.kind==='boss'?2.12:1.12,controlHeight:x.kind==='boss'?2:1}])
);
"""+s[b:]
 a=s.index('    const required=new Set<string>();',s.index('private loadLevelFauna'));b=s.index('    for(const key of required)',a)
 s=s[:a]+"""    const required=new Set<string>(g1EnemyAssetKeys(level));
    // Old saved encounters can carry any ordinary discovery ID. Keep all ten identities available.
    if(level<50)for(const asset of ORDINARY_G1)required.add(asset.key);
"""+s[b:]
 s=s.replace("resources.load(`models-fauna/${key}/${key}/${key}`,Prefab","resources.load(enemyG1(key)?.model??`models-fauna/${key}/${key}/${key}`,Prefab")
 s=s.replace("key.startsWith('fauna-')?spec.kind:'boss'","spec.kind")
 s=s.replace("· CC0 三维模型","· G1 骨骼怪物")
 s=s.replace("const extent=FAUNA_DIMENSIONS[actor.variant??'']","const extent=ENEMY_G1_DIMENSIONS[actor.variant??'']??FAUNA_DIMENSIONS[actor.variant??'']")
 s=s.replace("clip?.name.endsWith('|exit')","clip&&(/(^|[|_])exit$/).test(clip.name)")
 a=s.index("      if(actor.model&&!enemy.turtleRole)");b=s.index("      if(enemy.worldBossIndex!==undefined&&actor.paint)",a)
 s=s[:a]+"""      const grade=enemyG1Grade(battle.levelId,battle.wave),boss=BOSSES.find(b=>b.id===enemy.bossId);
      const world=enemy.worldBossIndex===undefined?undefined:WORLD_BOSSES[((enemy.worldBossIndex%4)+4)%4];
      if(actor.model&&!enemy.turtleRole){
        const tier=world?6:boss?.tier??grade,colour=world?.color??boss?.color??ENEMY_G1_GRADES[grade].color;
        this.faunaRadiance.apply(actor.model,tier,colour,enemy.kind==='boss'||enemy.kind==='elite');
        this.faunaAura.apply(actor.node,actor.height,faunaAuraGrade(enemy.kind,battle.levelId,boss?.tier,!!world,battle.wave),enemy.kind==='boss',enemy.alive);
      }
      if(actor.realModel&&enemy.kind==='boss'){
        const size=world?1.92:boss?.tier===5?1.62:ENEMY_G1_GRADES[Math.min(4,boss?.tier??grade)].scale;
        actor.node.setScale(size,size,size);
      }else if(actor.realModel&&enemy.kind==='elite'){
        const size=1+(ENEMY_G1_GRADES[grade].scale-1)*.6;actor.node.setScale(size,size,size);
      }
"""+s[b:]
 return s
edit('game/assets/scripts/view/BattleWorld.ts',battle)
p=ROOT/'game/assets/scripts/core/enemyG1Dimensions.ts'
if not p.exists():p.write_text("export const ENEMY_G1_DIMENSIONS:Record<string,readonly [number,number,number]>={};\n",'utf8')
edit('game/assets/scripts/core/faunaAura.ts',lambda s:"""import {enemyG1Grade} from './enemyG1Catalog';
export const FAUNA_AURAS = [
 {name:'碧焰',color:'#4DACEB',highlight:'#DDFBFF'},
 {name:'紫潮',color:'#AC77DD',highlight:'#F1DEFF'},
 {name:'橙焰',color:'#E79A48',highlight:'#FFF0CA'},
 {name:'赤潮',color:'#DE6456',highlight:'#FFE9DD'},
 {name:'鎏金',color:'#EAC254',highlight:'#FFF5D6'},
] as const;
export function faunaAuraGrade(kind:string,level=0,bossTier?:number,world=false,wave=1):number{
 if(world)return 4;
 if(bossTier!==undefined)return Math.max(0,Math.min(4,Math.floor(bossTier)));
 return kind==='elite'?enemyG1Grade(level,wave):0;
}
""")
def service(s):
 s=s.replace(" const persist=()=>", """ // Keep old results/attempt counts; remap the removed fifth visual on unfinished fights.
 for(const d of Object.values(data.days)){
  if(d.bossIndex>=WORLD_BOSSES.length){d.legacyBossName??='破浪鲨君';d.bossIndex=d.bossIndex%WORLD_BOSSES.length;dirty=true;}
 }
 for(const f of Object.values(data.fights)){
  if(f.bossIndex>=WORLD_BOSSES.length){f.bossIndex=f.bossIndex%WORLD_BOSSES.length;dirty=true;}
  for(const e of f.battle?.enemies??[])if(e.worldBossIndex>=WORLD_BOSSES.length){e.worldBossIndex=e.worldBossIndex%WORLD_BOSSES.length;dirty=true;}
 }
 const persist=()=>""")
 s=s.replace("${WORLD_BOSSES[d.bossIndex].name}","${d.legacyBossName??WORLD_BOSSES[d.bossIndex].name}")
 s=s.replace("bossIndex:day.bossIndex,closes:day.closes,next:day.next","bossIndex:d.bossIndex,closes:day.closes,next:day.next")
 s=s.replace("day.key,day.bossIndex,client.roster","day.key,d.bossIndex,client.roster")
 return s
edit('game/server/world-boss-service.cjs',service)
p=OUT/'production-plan.json';plan=json.loads(p.read_text('utf8'));plan.update(stage='production-running',creditAuthorization=440);plan['limitations']=[x for x in plan['limitations'] if not x.startswith('Cloud cost')]
for item in plan['items']:
 a=OUT/'attempts'/(item['id']+'-r1.json')
 if a.exists():
  r=json.loads(a.read_text('utf8'));item.update(generationStatus=r['state'],taskId=r['taskId'])
p.write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf8')
print('Enemy runtime migration prepared; models pending.')

