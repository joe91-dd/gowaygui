import {Asset} from 'cc';

/** JSB effect structs expose fields as prototype accessors. JSON serialization
 * loses those fields (a technique becomes {} and creates zero native passes).
 * Copy their data into plain objects before editing, then assign it back once. */
export function cloneEffectData<T>(source:T,seen=new WeakMap<object,unknown>()):T{
  if(source===null||typeof source!=='object')return source;
  if(source instanceof Asset)return source; // Texture defaults remain assets.
  const cached=seen.get(source as object);if(cached)return cached as T;
  if(ArrayBuffer.isView(source))return Array.from(source as unknown as ArrayLike<number>) as unknown as T;
  if(Array.isArray(source)){const copy:unknown[]=[];seen.set(source,copy);for(const value of source)copy.push(cloneEffectData(value,seen));return copy as T;}
  const copy:Record<string,unknown>={},keys=new Set<string>();seen.set(source as object,copy);
  for(let object:object|null=source as object;object&&object!==Object.prototype;object=Object.getPrototypeOf(object)){
    for(const key of Object.getOwnPropertyNames(object))if(key!=='constructor'&&!key.startsWith('__'))keys.add(key);
  }
  for(const key of keys){const value=(source as Record<string,unknown>)[key];if(value!==undefined&&typeof value!=='function')copy[key]=cloneEffectData(value,seen);}
  return copy as T;
}

export function requireEffectPasses(techniques:{passes?:unknown[]}[],name:string):void{
  if(!techniques.length||techniques.some(t=>!Array.isArray(t.passes)||!t.passes.length))throw new Error('特效渲染通道为空：'+name);
}
