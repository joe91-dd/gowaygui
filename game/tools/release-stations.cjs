const fs=require('fs'),root='game/assets/scripts/';function edit(p,f){fs.writeFileSync(root+p,f(fs.readFileSync(root+p,'utf8').replace(/\r\n/g,'\n')));}
edit('core/tacticalMaps.ts',s=>s+`
/** Keep bases entirely outside the road. A separate version preserves active snapshots. */
export function clearRoadStations(maps:LevelDefinition[]):LevelDefinition[]{
  return maps.map(map=>{
    if(map.id>=54)return map;
    const paths=map.routes??[map.route],points=paths.flat(),slots:Point[]=[];
    const roadDistance=(p:Point)=>Math.min(...paths.flatMap(r=>r.slice(1).map((b,i)=>{const a=r[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}))); 
    const rx=Math.max(...points.map(p=>Math.abs(p.x)))+.7,rz=Math.max(...points.map(p=>Math.abs(p.z)))+.7;
    for(const wanted of map.slots){let best:Point|undefined,score=Infinity;
      for(let x=-rx;x<=rx;x+=.12)for(let z=-rz;z<=rz;z+=.12){const p={x:Math.round(x*100)/100,z:Math.round(z*100)/100},d=roadDistance(p);
        if(d<1.08||d>2.5||slots.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<1.55))continue;
        const value=Math.hypot(p.x-wanted.x,p.z-wanted.z)+(slots.length===0?Math.abs(d-1.1)*5:0);
        if(value<score){score=value;best=p;}
      }
      if(!best)throw Error('无法生成离路站位: '+map.id);slots.push(best);
    }
    return {...map,stationVersion:2 as const,slots};
  });
}
`);
edit('core/types.ts',s=>s.replace('export interface LevelDefinition {','export interface LevelDefinition {\n  stationVersion?:2;'));
edit('core/data.ts',s=>s.replace("import {tacticalMaps}","import {tacticalMaps,clearRoadStations}").replace('export const BATTLE_MAPS:LevelDefinition[]=tacticalMaps(LEGACY_BATTLE_MAPS);',`export const LEGACY_TACTICAL_MAPS:LevelDefinition[]=tacticalMaps(LEGACY_BATTLE_MAPS);
export const BATTLE_MAPS:LevelDefinition[]=clearRoadStations(LEGACY_TACTICAL_MAPS);
export function battleMap(state:{levelId:number;layoutVersion?:number;stationVersion?:number}):LevelDefinition{return (state.layoutVersion!==2?LEGACY_BATTLE_MAPS:state.stationVersion===2?BATTLE_MAPS:LEGACY_TACTICAL_MAPS)[state.levelId];}`));
edit('core/battle.ts',s=>s.replace('ENEMIES, BATTLE_MAPS,','ENEMIES, battleMap, BATTLE_MAPS,').replace('  layoutVersion?:2;','  layoutVersion?:2;stationVersion?:2;').replace('contributions:{}, levelId','...(definition.stationVersion?{stationVersion:definition.stationVersion}:{}), contributions:{}, levelId').replaceAll('(state.layoutVersion===2?BATTLE_MAPS:LEGACY_BATTLE_MAPS)[state.levelId]','battleMap(state)'));
edit('core/battleValidation.ts',s=>s.replace('ENEMIES, BATTLE_MAPS,','ENEMIES, battleMap, BATTLE_MAPS,').replace("const levelId = integer(s.levelId, '关卡', 0, BATTLE_MAPS.length - 1), level = (s.layoutVersion===2?BATTLE_MAPS:LEGACY_BATTLE_MAPS)[levelId];", "const levelId = integer(s.levelId, '关卡', 0, BATTLE_MAPS.length - 1), level = battleMap({levelId,layoutVersion:s.layoutVersion as number|undefined,stationVersion:s.stationVersion as number|undefined});\n  if(s.stationVersion!==undefined)check(s.stationVersion===2,'站位版本','不支持');"));
edit('view/BattleWorld.ts',s=>s.replace('BATTLE_MAPS,','BATTLE_MAPS, LEGACY_TACTICAL_MAPS,').replace('  private legacyGeometry=false;','  private legacyGeometry=false;\n  private legacyStations=false;').replace('(this.legacyGeometry?LEGACY_BATTLE_MAPS:BATTLE_MAPS)', '(this.legacyGeometry?LEGACY_BATTLE_MAPS:this.legacyStations?LEGACY_TACTICAL_MAPS:BATTLE_MAPS)').replace('this.legacyModeLayout=false;this.legacyGeometry=false;','this.legacyModeLayout=false;this.legacyGeometry=false;this.legacyStations=false;').replace('    const oldGeometry=battle.layoutVersion!==2;', '    const oldStations=battle.layoutVersion===2&&battle.stationVersion!==2;if(oldStations!==this.legacyStations){this.legacyStations=oldStations;this.buildTemporaryEnvironment();}\n    const oldGeometry=battle.layoutVersion!==2;'));
edit('view/BattleScreen.ts',s=>s.replace('BATTLE_MAPS,','BATTLE_MAPS,battleMap,').replace('slots=BATTLE_MAPS[this.run.levelId].slots','slots=(this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId]).slots').replaceAll('BATTLE_MAPS[this.run.levelId].slots.forEach','(this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId]).slots.forEach'));
edit('view/ModernIsland.ts',s=>s.replace("  for(const route of routes)","  const road=level.stationVersion===2?.84:1.28;\n  for(const route of routes)").replace('1.28,.075,1.28','road,.075,road').replace('1.28,.075,Math.hypot','road,.075,Math.hypot').replace("  for(const p of level.slots){item(cylinder", "  const base=level.stationVersion===2?1:1.38,cap=level.stationVersion===2?.92:1.28;\n  for(const p of level.slots){item(cylinder").replace('1.38,.24,1.38','base,.24,base').replace('1.28,.025,1.28','cap,.025,cap'));
edit('view/GameEntry.ts',s=>s.replace("this.ui.panel(-494,310,176,44","this.ui.panel(-471,310,154,44").replace("??'小岛主',-497,310,24","??'小岛主',-479,310,24").replace("'',-444,311,34,34","'',-421,311,34,34").replace('this.mainCamera.node.setPosition(0,22,18)','this.mainCamera.node.setPosition(0,20,17)'));
edit('view/PrototypeMenus.ts',s=>s.replace("t.skills.forEach((id,i)=>{const n=this.ui.panel(-136+(i%4)*204,104-Math.floor(i/4)*104,180,88,p);\n      this.ui.text(SKILL_BY_ID[id].name,0,18,28,UI_COLORS.cream,n,168,40);\n      this.ui.text(SKILL_BY_ID[id].active?'主动技能':'被动技能',0,-22,26,UI_COLORS.sand,n,168,32);});",`t.skills.forEach((id,i)=>{const n=this.ui.button('',-136+(i%4)*204,104-Math.floor(i/4)*90,188,76,()=>{
      let details:Node;details=this.ui.sheet(SKILL_BY_ID[id].name,SKILL_BY_ID[id].precious?'珍贵 · 通用被动':'技能说明',()=>details.parent?.destroy());this.ui.bookIcon(id,-360,0,270,details);this.ui.text(SKILL_BY_ID[id].description,170,0,28,UI_COLORS.ink,details,670,250,true);
    },{parent:p});this.ui.bookIcon(id,-59,0,56,n);
      this.ui.text(SKILL_BY_ID[id].name,30,14,23,UI_COLORS.cream,n,116,32);
      this.ui.text(SKILL_BY_ID[id].active?'主动':SKILL_BY_ID[id].precious?'珍贵被动':'被动',30,-19,18,UI_COLORS.sand,n,116,28);});`));
console.log('Off-road stations versioned; old active battles keep prior stations');
