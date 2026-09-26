import {Graphics} from 'cc';
import {SeaChart} from './SeaChart';
import {IslandUI,color} from './IslandUI';
import type {LevelDefinition} from '../core/types';

const MARKERS=[[-485,-87],[-292,62],[3,124],[220,208],[429,234]] as const;
const MOORINGS=[[-369,-163],[-147,-77],[-78,-104],[338,15],[441,95]] as const;

export function chapterMapState(levels:readonly LevelDefinition[],page:number,unlocked:number,cleared:readonly number[]){
  const pages=Math.ceil(levels.length/5),index=Math.max(0,Math.min(page,pages-1));
  const stages=levels.slice(index*5,index*5+5).map(level=>({level,locked:level.id>unlocked,completed:cleared.includes(level.id),current:level.id===unlocked}));
  const available=stages.filter(stage=>!stage.locked);
  const destination=available.find(stage=>stage.current)??available[available.length-1];
  return{page:index,pages,stages,destination};
}

export function renderChapterMap(ui:IslandUI,levels:readonly LevelDefinition[],page:number,region:string,progress:{unlockedLevel:number;cleared:readonly number[];settings:{reducedMotion?:boolean}},choose:(id:number)=>void,navigate:(page:number)=>void,close:()=>void):void{
  const state=chapterMapState(levels,page,progress.unlockedLevel,progress.cleared);
  const chart=new SeaChart(ui,'chart-chapter',region,'海域 '+String(state.page+1).padStart(2,'0')+' / '+state.pages,close,()=>!!progress.settings.reducedMotion),root=chart.root;
  const button=(text:string,x:number,y:number,width:number,height:number,action:()=>void,disabled=false)=>chart.button(text,x,y,width,height,action,height>55,disabled);
  state.stages.forEach((stage,index)=>{
    const [x,y]=MARKERS[index],node=ui.button('',x,y,100,100,()=>{if(!stage.locked)choose(stage.level.id);},{parent:root,disabled:stage.locked});
    node.name='海图关卡:'+stage.level.id;
    for(const child of [...node.children]){child.removeFromParent();child.destroy();}
    const graphics=node.getComponent(Graphics)??node.addComponent(Graphics);graphics.clear();
    if(stage.current){graphics.fillColor=color('#FFE27E',80);graphics.circle(0,0,39);graphics.fill();}
    graphics.fillColor=color(stage.locked?'#76939A':stage.completed?'#008B97':'#007F97');graphics.circle(0,0,26);graphics.fill();
    graphics.lineWidth=2;graphics.strokeColor=color(stage.locked?'#D8D4B5':'#FFEDAF');graphics.circle(0,0,25);graphics.stroke();
    ui.text(String(stage.level.id+1),0,1,28,'#FFF8DD',node,52,44);
    if(stage.locked)ui.icon('collection-lock',29,-20,25,node);
    const status=stage.locked?'未解锁':stage.current?'当前挑战':stage.completed?'已通关':'可挑战';
    const tag=ui.panel(0,-47,100,25,node,stage.locked?'#527889':'#FFF9EC',235,10);
    ui.text(status,0,0,16,stage.locked?'#FFFFFF':'#153B55',tag,94,23);
  });
  if(state.destination){
    const index=state.stages.indexOf(state.destination),[x,y]=MOORINGS[index];
    chart.boat(x,y,142);
  }
  const destination=state.destination;
  ui.text(destination?'第 '+(destination.level.id+1)+' 关 · '+destination.level.name:'通关前一海域后解锁',0,-204,23,'#153B55',root,630,36);
  button(destination?(destination.completed?'再次挑战':'继续冒险'):'尚未解锁',0,-268,286,62,()=>{if(destination)choose(destination.level.id);},!destination);
  button('‹ 上一海域',-332,-296,180,46,()=>navigate(state.page-1),state.page===0);
  button('下一海域 ›',332,-296,180,46,()=>navigate(state.page+1),state.page===state.pages-1);

}
