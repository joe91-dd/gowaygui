/** Cocos JSB exposes a location shim but does not provide URLSearchParams. */
interface QueryReader {get(name:string):string|null;has(name:string):boolean}
const EMPTY_QUERY:QueryReader={get:()=>null,has:()=>false};
export function runtimeQuery():QueryReader{
  if(typeof location==='undefined'||typeof URLSearchParams!=='function')return EMPTY_QUERY;
  return new URLSearchParams(location.search);
}
