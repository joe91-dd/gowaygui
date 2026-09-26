const fs=require('fs'),base='game/assets/scripts/';function edit(p,f){let s=fs.readFileSync(base+p,'utf8');fs.writeFileSync(base+p,f(s));}
edit('view/ChallengeScreen.ts',s=>{
 s="import {placementIssue,normalizedPoint} from '../core/placement';\nimport type {Point} from '../core/types';\n"+s;
 // Map hit targets precede the HUD, so controls remain touchable.
 s=s.replace('this.hud(config.name);','this.stationMarkers();this.hud(config.name);').replace('    this.stationMarkers();const rosterStart','    const rosterStart');
 const a=s.indexOf('  private stationMarkers():void{'),b=s.indexOf('  private renderArena():void{',a);if(a<0||b<0)throw Error('bounds');
 s=s.slice(0,a)+`  private stationMarkers():void{
    const r=this.raid!,map=r.battle?battleMap(r.battle):BATTLE_MAPS[raidMapId(r.tier)],mine=r.members[0],epoch=this.epoch,pet=mine.roster.find(p=>p.id===mine.activeId);if(!pet)return;
    const size=displayScreen.windowSize,scale=Math.min(size.width/1280,size.height/720),local=(p:{x:number;y:number})=>new Vec3((p.x-size.width/2)/scale,(p.y-size.height/2)/scale,0);
    const ground=(p:{x:number;y:number}):Point|undefined=>{const ray=this.camera.screenPointToRay(p.x,p.y);if(Math.abs(ray.d.y)<.001)return;const t=-ray.o.y/ray.d.y;return normalizedPoint({x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t});};
    const issue=(p:Point)=>placementIssue(map,p,r.members.filter((_,i)=>i>0).map((m,i)=>m.placement??map.slots[m.station??i+1]));
    const commit=(p:Point)=>{if(this.epoch!==epoch)return;try{const reason=issue(p);if(reason){this.ui.toast(reason);return;}if(r.phase==='combat'){moveRaidStation(r,0,mine.station??0,p);this.checkpoint();}else{this.service.selectRaidStation(this.command('raidPlace'),mine.station??0,p);this.raid=this.service.snapshot.community!.raid;}this.render();}catch(e){this.world.showRange(null);this.onError(e);}};
    const surface=this.ui.group('副本自由布阵地图',0,0,this.ui.root,1280,720),g=surface.addComponent(Graphics);g.fillColor=color('#FFFFFF',1);g.rect(-640,-360,1280,720);g.fill();let origin:{x:number;y:number}|undefined;
    surface.on(Node.EventType.TOUCH_START,(e:EventTouch)=>origin=e.getLocation());surface.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{const end=e.getLocation();if(origin&&Math.hypot(end.x-origin.x,end.y-origin.y)<8){const p=ground(end);if(p)commit(p);}origin=undefined;});
    const hit=this.ui.group('拖动我的副本伙伴',0,0,this.ui.root,84,106);let start:Vec3|undefined,ghost:Node|undefined;
    this.stationOverlay=()=>{if(this.epoch!==epoch)return;const actor=r.battle?.units.find(u=>u.id===mine.activeId),at=actor??mine.placement??map.slots[mine.station??0],p=local(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));hit.setPosition(p);};this.stationOverlay();
    const reset=()=>{start=undefined;ghost?.destroy();ghost=undefined;this.world.showRange(null);};
    hit.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{start=local(e.getLocation());this.world.showRange(mine.station??0,ROLES[pet.turtle.role].range,pet.turtle.role==='leaf',mine.placement);});
    hit.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!start||this.epoch!==epoch)return;const p=local(e.getLocation());if(!ghost&&Math.hypot(p.x-start.x,p.y-start.y)<8)return;if(!ghost){ghost=this.ui.group('副本拖动伙伴',p.x,p.y,this.ui.root,108,108);this.ui.battleFigure(pet.turtle.role,0,0,130,ghost);}ghost.setPosition(p);const at=ground(e.getLocation());this.world.showRange(null,ROLES[pet.turtle.role].range,pet.turtle.role==='leaf',at);this.world.tintRange(!!at&&!issue(at));});
    const finish=(e:EventTouch)=>{const moved=!!ghost,at=ground(e.getLocation());reset();if(moved&&at)commit(at);else this.ui.toast('拖动到陆地空处，或点陆地调整我的伙伴');};
    hit.on(Node.EventType.TOUCH_END,finish);hit.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.getEventCode()===Node.EventType.TOUCH_END&&ghost)finish(e);else reset();});hit.once(Node.EventType.NODE_DESTROYED,reset);
  }
  private stationPage():void{this.render();this.ui.toast('直接拖动自己的伙伴，或点击陆地空处摆放');}
`+s.slice(b);return s;
});
edit('core/raids.ts',s=>s.replace(".filter(slot=>!occupied.has(slot))",".filter(slot=>!occupied.has(slot)&&!placementIssue(map,map.slots[slot],r.members.filter(o=>o!==m).map((o)=>o.placement??map.slots[o.station??r.members.indexOf(o)])))").replace("if(best!==undefined&&score(best)>score(current)+1)moveRaidStation(r,i,best);","if(best!==undefined&&score(best)>score(current)+1)try{moveRaidStation(r,i,best);}catch{/* A spell or transfer keeps the AI in place. */}").replace("const key=`${p.ownerId}:${p.originalId}`;","requireRule(JSON.stringify(m.placement)===JSON.stringify(u?.placement),'副本落点与伙伴不一致');const key=`${p.ownerId}:${p.originalId}`;"));
edit('core/battleValidation.ts',s=>s.replace("if(s.encounterVersion!==undefined)","if(s.faunaVersion!==undefined)check(s.faunaVersion===1,'首领机制版本','不支持');\n  if(s.encounterVersion!==undefined)").replace("check(s.encounterVersion===1&&['mender'","check((s.encounterVersion===1||s.faunaVersion===1)&&['mender'").replace("    if(enemy.slam!==undefined)",`    if(enemy.abilityReadyTick!==undefined)integer(enemy.abilityReadyTick,name+'.abilityReadyTick');
    if(enemy.cast!==undefined){const c=object(enemy.cast,name+'.cast');check(s.faunaVersion===1&&['breakwater','frost','mortar','drain','rally','shock'].includes(String(c.kind)),name,'敌人蓄力不合法');point(c,name+'.cast');integer(c.landTick,name+'.cast.landTick');}
    if(enemy.slam!==undefined)`));
edit('view/BattleWorld.ts',s=>{
 const a=s.indexOf('        for(const p of this.mapDefinition.slots){'),b=s.indexOf("        if(this.levelId===0)this.painted.guard",a);if(a>=0&&b>=0)s=s.slice(0,a)+s.slice(b);
 return s;
});
