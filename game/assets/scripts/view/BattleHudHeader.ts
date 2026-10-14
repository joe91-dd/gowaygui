import {IslandUI} from './IslandUI';
import {PearlBattleArt} from './PearlBattleArt';
export function pearlBattleHeader(ui:IslandUI,name:string,speed:number,onSpeed:()=>void,onMenu:()=>void,menu='暂停'):void{
 const start=ui.root.children.length;
 if(ui.soloStyle){
  const title=ui.panel(-438,320,276,52,ui.root,'#FFF9EC',248,17);ui.text(name,0,0,24,'#153B55',title,258,40);
  ui.button(speed+'X',294,320,84,52,onSpeed,{size:23});ui.button(menu,412,320,126,52,onMenu,{size:23});ui.pinBattleFrom(start,1,0,0,'top');return;
 }
 const title=ui.group('珍珠海域标题',-438,320,ui.root,276,52);PearlBattleArt.attach(title,'plaque',276,52);ui.text(name,19,0,24,'#543719',title,223,40);
 for(const [text,x,w,action]of [[speed+'X',294,84,onSpeed],[menu,412,126,onMenu]] as const){const n=ui.button('',x,320,w,52,action,{surface:'bare'});PearlBattleArt.attach(n,'secondary',w,52);ui.text(text,0,0,23,'#543719',n,w-12,40);}
 ui.pinBattleFrom(start,1,0,0,'top');
}
