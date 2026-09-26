import type {Point,Spawn} from './types';

const points=(rows:number[][]):Point[]=>rows.map(([x,z])=>({x,z}));
export const pathLength=(route:Point[]):number=>route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.z-route[i].z),0);
/** Functional layouts only: rendered with the existing map components. */
export function frontLayout(levelId:number):{routes:Point[][];routeLabels:string[];stations:Point[]}|undefined{
  if(levelId===50)return {routes:[
    points([[-10,-2],[-7,-3],[-4,-3],[-3,0],[0,0]]),
    points([[5,-5],[2,-4],[-1,-4],[-1,-2],[0,0]]),
    points([[10,2],[7,3],[4,3],[3,0],[0,0]]),
    points([[-5,5],[-2,4],[1,4],[1,2],[0,0]])],routeLabels:['西口','北口','东口','南口'],stations:points([[-2.1,0],[0,-2.1],[2.1,0],[0,2.1],[-2.4,2.2]])};
  if(levelId<51||levelId>53)return undefined;
  const routes=levelId===51?[
    [[-10,-4],[-7,-4],[-6,0],[-3,1],[0,0]],
    [[10,4],[7,4],[6,0],[3,-1],[0,0]]
  ]:levelId===52?[
    [[-10,-4],[-6,-4],[-5,-1],[-2,-1],[2,0]],
    [[9,-5],[6,-4],[6,-1],[4,1],[2,0]],
    [[-9,5],[-5,4],[-2,3],[2,3],[2,0]]
  ]:[
    [[-10,-4],[-7,-4],[-7,0],[-3,0],[0,1]],
    [[-2,-5],[2,-4],[4,-2],[2,0],[0,1]],
    [[10,4],[7,4],[7,1],[3,2],[0,1]],
    [[-6,5],[-3,4],[1,4],[1,2],[0,1]]
  ];
  const dx=levelId===52?2:0,dz=levelId===53?1:0;
  return {routes:routes.map(points),routeLabels:levelId===51?['西礁口','东礁口']:levelId===52?['西廊','北廊','南廊']:['西门','北门','东门','南门'],stations:points([[-2,0],[0,-2],[2,0],[0,2],[-2,2.5],[-5,-2],[-5,2],[5,-2],[5,2],[-2,-4],[2,-4],[2,4]]).map(p=>({x:p.x+dx,z:p.z+dz}))};
}
export function frontPlan(levelId:number,wave:number):number[]{
  const layout=frontLayout(levelId);if(!layout)return [0];
  const total=layout.routes.length;
  const count=total===2?2:levelId===50?(wave<=9?2:wave<=19?3:4):levelId===52?(wave<=3?2:3):(wave<=2?2:wave<=4?3:4);
  return Array.from({length:Math.min(total,count)},(_,i)=>(wave-1+i)%total);
}
export function assignFronts(spawns:Spawn[],levelId:number,wave:number):Spawn[]{
  const lanes=frontPlan(levelId,wave),last=Math.max(0,...spawns.map(s=>s.time)),groups=Math.max(1,Math.ceil(spawns.length/lanes.length)-1);
  return spawns.map((s,i)=>({...s,routeId:lanes[i%lanes.length],time:Math.round((.5+Math.floor(i/lanes.length)*Math.max(1,last-.5)/groups)*1000)/1000})).sort((a,b)=>a.time-b.time);
}
export function frontNotice(levelId:number,wave:number):string{
  const layout=frontLayout(levelId);if(!layout)return '';
  const lanes=frontPlan(levelId,wave);return `${lanes.map(i=>layout.routeLabels[i]).join(' + ')} · ${lanes.length===1?'单路来袭':lanes.length+'路同时来袭'}`;
}
