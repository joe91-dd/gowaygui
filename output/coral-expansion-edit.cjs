const fs=require('node:fs');
function edit(file,fn){const p='game/assets/scripts/'+file;let s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,fn(s));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));return s.replace(a,b);}
edit('core/battleValidation.ts',s=>"import {groundIssue,placementIssue} from './placement';\n"+s);
edit('core/save.ts',s=>"import {groundIssue,placementIssue} from './placement';\n"+rep(s,"if(u.fallen!==undefined)","if(u.placement)requireRule(!groundIssue(BATTLE_MAPS[r.levelId],u.placement),'自由落点无效','SAVE');\n      if(u.fallen!==undefined)"));
edit('view/BattleScreen.ts',s=>{
 s="import {placementIssue,normalizedPoint} from '../core/placement';\nimport type {Point} from '../core/types';\n"+s;
 s=s.replaceAll('slot:u.slot!,sleepUntilWave:', 'slot:u.slot!,placement:u.placement,sleepUntilWave:');
 const a=s.indexOf('  private worldDragTargets():void{'),b=s.indexOf('  private attachBenchDrag(',a);
 s=s.slice(0,a)+`  private groundPoint(p:{x:number;y:number}):Point|undefined{
    const ray=this.camera.screenPointToRay(p.x,p.y);if(Math.abs(ray.d.y)<.001)return;
    const t=-ray.o.y/ray.d.y;if(t<0)return;return normalizedPoint({x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t});
  }
  private landingIssue(id:string,p:Point):string|undefined{
    const m=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId],u=this.units.find(v=>v.id===id);
    if(u?.slot===null&&this.units.filter(v=>v.slot!==null).length>=5)return '已上阵五只，请拖到要替换的伙伴';
    return placementIssue(m,p,this.units.filter(v=>v.id!==id&&v.slot!==null).map(v=>v.placement??m.slots[v.slot!]));
  }
  private worldDragTargets():void{
    const map=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId];
    const surface=this.ui.group('自由布阵地图',0,0,this.ui.root,1280,720);let start:{x:number;y:number}|undefined;
    surface.on(Node.EventType.TOUCH_START,(e:EventTouch)=>start=e.getLocation());
    surface.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{const end=e.getLocation();if(!start||Math.hypot(end.x-start.x,end.y-start.y)>10)return;start=undefined;const p=this.groundPoint(end);if(!p)return;if(!this.selected){this.ui.toast('先点选一只伙伴，再点陆地摆放');return;}this.act(()=>{this.service.placeUnit(this.command('place'),this.selected,p,this.battle);this.battle=this.run.battle;});});
    for(const u of this.units.filter(u=>u.slot!==null)){
      const at=this.battle?.units.find(a=>a.id===u.id)??u.placement??map.slots[u.slot!],p=this.screenPoint(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));if(!p)continue;
      const n=this.ui.group('战场拖动:'+u.id,p.x,p.y,this.ui.root,90,94);this.attachBenchDrag(n,u.id,true);
    }
  }
`+s.slice(b);
 // Replace only the drag preview section, keep bench fusion and real TOUCH_CANCEL handling.
 const c=s.indexOf('        ghost.setPosition(p.x,p.y,0);let nearest='),d=s.indexOf('\n      }\n    });',c);
 s=s.slice(0,c)+`        ghost.setPosition(p.x,p.y,0);const at=this.groundPoint(event.getLocation()),issue=at?this.landingIssue(id,at):'请拖到地图上';
        this.world.showRange(null,radius(u),u.turtle.role==='leaf',at);this.world.tintRange(!issue);
        if(dragHint)dragHint.string=issue??'松手放置 · 波间自由 / 战中转移';
`+s.slice(d);
 const e=s.indexOf('      if(slot===undefined){',s.indexOf('  private attachBenchDrag')),f=s.indexOf('\n    };\n    node.on(Node.EventType.TOUCH_END,finish);',e);
 s=s.slice(0,e)+`      const landing=this.groundPoint(point);
      clear();if(slot!==undefined)this.act(()=>{this.service.moveUnit(this.command('move'),id,slot!,this.battle);this.battle=this.run.battle;this.selected=id;});
      else if(landing)this.act(()=>{this.service.placeUnit(this.command('place'),id,landing,this.battle);this.battle=this.run.battle;this.selected=id;});
      else this.ui.toast('请放到陆地空处或备战槽');
`+s.slice(f);
 s=s.replaceAll("'点选站位调动 · 拖动也可以'","'点陆地空处摆放 · 拖动也可以'");
 // Remaining selection ranges follow their freely authored coordinates.
 s=s.replaceAll("u.turtle.role==='leaf');}});","u.turtle.role==='leaf',u.placement);}});");
 s=s.replace("selected.turtle.role==='leaf');","selected.turtle.role==='leaf',selected.placement);");
 return s;
});
edit('view/BattleWorld.ts',s=>rep(s,'  /** Freeze both engine-driven',`  tintRange(valid:boolean):void{this.rangePreview.getComponent(MeshRenderer)!.setMaterial(this.material(valid?'#75DDAC':'#ED897B'),0);}
  /** Freeze both engine-driven`));
edit('core/communityTypes.ts',s=>s.replace('station?:number;moveReadyTick?:number','station?:number;placement?:import(\'./types\').Point;moveReadyTick?:number'));
edit('core/raids.ts',s=>{
 s="import {placementIssue,normalizedPoint} from './placement';\n"+s;
 s=s.replaceAll('slot,level:10,sleepUntilWave:', 'slot,placement:m.placement,level:10,sleepUntilWave:');
 s=s.replace('slot:member.station??memberIndex,level:10,','slot:member.station??memberIndex,placement:member.placement,level:10,');
 s=s.replace('memberIndex:number,station:number):void{','memberIndex:number,station:number,point?:import(\'./types\').Point):void{');
 s=s.replace('if((m.station??memberIndex)===station)return;',`if(point){const issue=placementIssue(map,point,r.members.filter((_,i)=>i!==memberIndex).map(o=>o.placement??map.slots[o.station??r.members.indexOf(o)]));requireRule(!issue,issue??'这里不能摆放');}
  if((m.station??memberIndex)===station&&!point)return;`);
 s=s.replace('moveBattleUnit(b,m.activeId,station);','moveBattleUnit(b,m.activeId,station,point);');
 s=s.replace('m.station=station;','m.station=station;m.placement=point?normalizedPoint(point):undefined;');
 return s;
});
edit('core/game.ts',s=>s.replace('selectRaidStation(commandId:string,station:number):void','selectRaidStation(commandId:string,station:number,point?:import(\'./types\').Point):void').replace('moveRaidStation(r,0,station);','moveRaidStation(r,0,station,point);'));
