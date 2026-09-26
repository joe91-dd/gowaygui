export interface RandomState { rng: number }
/** Deterministic PRNG for local simulation. This is not an anti-cheat boundary. */
export function random(state: RandomState): number {
  let x=state.rng|0; if(x===0)x=0x6d2b79f5;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng=x>>>0; return state.rng/4294967296;
}
export function choose<T>(state: RandomState, values: readonly T[]): T {
  if (!values.length) throw new Error('候选为空');
  return values[Math.floor(random(state)*values.length)];
}
export function weighted<T>(state: RandomState, values: {value:T;probability:number}[]): T {
  const total=values.reduce((a,b)=>a+b.probability,0);
  if(!Number.isFinite(total)||Math.abs(total-1)>1e-8||values.some(v=>v.probability<0))throw new Error('概率分布不合法');
  let ticket=random(state);
  for(const entry of values){ ticket-=entry.probability; if(ticket<0)return entry.value; }
  return values[values.length-1].value;
}
export function sample<T>(state: RandomState, values: readonly T[], count: number): T[] {
  if(!Number.isInteger(count)||count<0||count>values.length)throw new Error('采样数量不合法');
  const bag=[...values];
  for(let i=0;i<count;i++){const j=i+Math.floor(random(state)*(bag.length-i)); [bag[i],bag[j]]=[bag[j],bag[i]];}
  return bag.slice(0,count);
}

