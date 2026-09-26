export const ENDLESS_ROUTE_WAVES=[5,10,20,30,50,80,100] as const;
export const ENDLESS_REWARD_WAVES=[5,10,20,30,40,50,60,70,80,90,100] as const;
export function endlessMilestoneWaves(completed:number):number[]{
  const waves:number[]=[];if(completed>=5)waves.push(5);
  for(let wave=10;wave<=completed;wave+=10)waves.push(wave);
  return waves;
}
