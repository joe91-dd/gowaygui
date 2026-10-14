import {sys} from 'cc';
const KEY='gowaygui.native-battle-load.v1';
/** Persist a few loading boundaries so a killed native process can be diagnosed
 * after restart without a USB connection. No save contents or account data. */
export function recordNativeBattleStage(stage:string,levelId?:number):void{
  if(!sys?.isNative)return;
  try{const old=JSON.parse(sys.localStorage.getItem(KEY)||'[]') as unknown;const rows=Array.isArray(old)?old:[];
    rows.push({at:new Date().toLocaleTimeString(),stage,level:levelId===undefined?undefined:levelId+1});
    sys.localStorage.setItem(KEY,JSON.stringify(rows.slice(-8)));
  }catch{} // Diagnostics must never interrupt loading or save the battle twice.
}
export function nativeBattleTraceText():string{
  try{const rows=JSON.parse(sys.localStorage.getItem(KEY)||'[]') as {at:string;stage:string;level?:number}[];
    return rows.map(r=>`${r.at} · ${r.level===undefined?'':`地图 ${r.level} · `}${r.stage}`).join('\n')||'暂无战斗加载记录';
  }catch{return '暂无战斗加载记录';}
}
