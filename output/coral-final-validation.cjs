const fs=require('fs'),base='game/assets/scripts/';function edit(p,f){let s=fs.readFileSync(base+p,'utf8');fs.writeFileSync(base+p,f(s));}
edit('core/save.ts',s=>s.replace('groundIssue,placementIssue','groundIssue,placementIssue,fieldIssue').replace('    if(r.pendingMergeId)requireRule',"    requireRule(!fieldIssue(BATTLE_MAPS[r.levelId],Object.values(r.units).filter(u=>!u.consumedBy&&!u.removed&&u.slot!==null) as {slot:number;placement?:import('./types').Point}[]),'自由布阵重叠或非法','SAVE');\n    if(r.pendingMergeId)requireRule").replace('const source=r.units[unit.id];',"const source=r.units[unit.id];requireRule(JSON.stringify(source?.placement)===JSON.stringify(unit.placement),'战斗自由落点与本局不一致','SAVE');"));
edit('core/battleValidation.ts',s=>s.replace('groundIssue,placementIssue','groundIssue,placementIssue,fieldIssue').replace("  const bench=s.benchUnits", "  check(!fieldIssue(level,units as {slot:number;placement?:Point}[]),'布阵','自由落点重叠或非法');\n  const bench=s.benchUnits"));
edit('core/communityValidation.ts',s=>"import {fieldIssue} from './placement';\n"+s.replace('const stations=new Set<number>();',"const stations=new Set<number>();ok(!fieldIssue(BATTLE_MAPS[r.tier===3?55:51+r.tier],r.members.map((m,i)=>({slot:m.station??i,placement:m.placement}))), '副本自由落点非法');"));
// A fixed-slot move remains a compatibility action, but cannot overlap a freely placed turtle.
edit('core/battle.ts',s=>s.replace("  if(slot===oldSlot&&!point)return;",`  if(!point&&state.units.some(u=>u.placement)){
    const target=other?.placement??battleMap(state).slots[slot],rest=state.units.filter(u=>u!==unit&&u!==other);
    if(rest.some(u=>distance(u.placement??u,target)<1))throw Error('目标位置被其他伙伴占用');
  }
  if(slot===oldSlot&&!point)return;`));
const config=JSON.parse(fs.readFileSync('game/build-config.tide-mastery.json'));config.name='哥喂龟 珊海远征试玩';config.outputName='coral-expansion';fs.writeFileSync('game/build-config.coral-expansion.json',JSON.stringify(config,null,2));
