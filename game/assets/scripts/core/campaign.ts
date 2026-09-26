import type {LevelDefinition,Point} from './types';
import {frontLayout} from './multiFront';

export const CHAPTER_THEMES=['晴湾海岸','珊瑚浅滩','潮汐湿地','古树海岛','白帆礁群','月湾遗迹','风暴海峡','晶石深湾','沉船群岛','海心王座'] as const;
export const HARD_STAGES=[15,25,30,35,40,45,46,47,48,49,50] as const;
export const MODE_MAP={endless:50,raids:[51,52,53],arena:54} as const;

/** Preset geometry is deterministic and independent of the combat RNG or art assets. */
function geometry(index:number):{route:Point[];slots:Point[]}{
  const patterns=[[-1,0,-2,-2,1,0,0],[1,-1,-1,2,2,-1,0],[-2,-2,1,2,-1,-2,1],[2,1,-2,0,2,1,-1],[0,2,2,-2,-2,1,0]];
  const pattern=patterns[index%patterns.length],chapter=Math.floor(index/5),flip=chapter%2?-1:1;
  const route=pattern.map((z,i)=>({x:-9+i*3,z:Math.round((z*flip+Math.sin((chapter+1)*(i+1))*.36)*1000)/1000}));
  const slots=Array.from({length:5},(_,i)=>{
    const a=route[i],b=route[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),sign=i%2?-1:1;
    return {x:Math.round(((a.x+b.x)/2-dz/len*1.18*sign)*1000)/1000,z:Math.round(((a.z+b.z)/2+dx/len*1.18*sign)*1000)/1000};
  });return {route,slots};
}
export function campaignLevels(original:LevelDefinition[]):LevelDefinition[]{
  const levels=original.map(l=>({...l,sceneTheme:0,hard:false}));let difficulty=levels[4].difficulty;
  for(let id=5;id<50;id++){
    const stage=id+1,theme=Math.floor(id/5),hard=(HARD_STAGES as readonly number[]).includes(stage);
    difficulty*=hard?1.06:1.011;
    levels.push({id,name:`${CHAPTER_THEMES[theme]}·${id%5+1}`,subtitle:hard?'强敌关卡 · 培养与搭配都很重要':'观察新路线，调整站位和技能',waves:8,targetSeconds:[240,360],spawnDuration:17,preparationSeconds:5,mergeWaves:[3,6],difficulty:Math.round(difficulty*1000)/1000,sceneTheme:theme,hard,...geometry(id)});
  }return levels;
}
export function modeMaps():LevelDefinition[]{
  const raids:Point[][]=[
    [[-9,-3],[-5,-3],[0,-3],[5,-3],[8,-1],[6,2],[1,2],[-4,2],[-6,0],[-2,0],[4,0],[9,0]],
    [[-9,3],[-5,3],[4,3],[7,0],[3,-3],[-3,-3],[-6,0],[-2,1],[4,1],[9,-2]],
    [[-9,-3],[-5,-4],[5,-4],[8,0],[5,4],[-5,4],[-7,1],[-3,-1],[3,-1],[9,2]],
  ].map(route=>route.map(([x,z])=>({x,z})));
  return ['无尽海湾','碎礁洞穴','深潮遗迹','巨钳王庭','竞技海岛'].map((name,i)=>{
    const old=i>0&&i<4?{route:raids[i-1],slots:[{x:-5,z:-.8},{x:0,z:-1.8},{x:5,z:.6},{x:0,z:.7},{x:3.8,z:3.4}]}:geometry(65+i*7),front=frontLayout(50+i);
    return {id:50+i,name,subtitle:'独立挑战',waves:12,targetSeconds:[240,600] as [number,number],spawnDuration:22,preparationSeconds:5,mergeWaves:[],difficulty:i===0?1:12+i*4,sceneTheme:10+i,hard:i>0&&i<4,...old,...(front?{routes:front.routes,routeLabels:front.routeLabels,legacySlots:old.slots,slots:front.stations}:{})};
  });
}
