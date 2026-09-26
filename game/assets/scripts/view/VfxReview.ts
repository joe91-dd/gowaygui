import {Node,Vec3} from 'cc';
import {DEBUG} from 'cc/env';
import {ROLES} from '../core/data';
import {ENEMY_G1,enemyG1} from '../core/enemyG1Catalog';
import type {Role} from '../core/types';
import {G1BattleEffects} from './G1BattleEffects';

export type VfxReviewActor={id:string;kind:'role'|'enemy';role?:Role;variant?:string;advanced?:boolean;label:string};
export interface VfxReviewHost{
 stageVfxAcceptance(source:VfxReviewActor,target:VfxReviewActor):{from:Vec3;to:Vec3;sourceModel?:Node;targetModel?:Node;sourceLabel:string;targetLabel:string};
}

/** Local visual inspection uses the exact renderer used by BattleWorld. No save or combat writes. */
export class VfxReview {
 static create(fx:G1BattleEffects,host?:VfxReviewHost):VfxReview|undefined{
  if(!DEBUG||typeof location==='undefined'||typeof document==='undefined')return;
  const q=new URLSearchParams(location.search);
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)||q.get('preview')!=='all-maps'||q.get('vfx')!=='1')return;
  return new VfxReview(fx,host);
 }
 private panel=document.createElement('div');
 private select=document.createElement('select');
 private source=document.createElement('select');
 private target=document.createElement('select');
 private slider=document.createElement('input');
 private caption=document.createElement('div');
 private verdict=document.createElement('div');
 private motion=false;private age=0;private pending=true;
 private checks:HTMLInputElement[]=[];
 private readonly recordKey='gowaygui-vfx-acceptance-v1';
 private readonly choices:[string,string][]=[
  ['rock','岩石风暴'],['rockMastery','碎岩天灾（专精）'],['frost','冰晶暴风雪'],['frostMastery','极寒回响（专精）'],['arrows','箭雨'],['arrowsMastery','箭雨风暴（专精）'],['piercing','穿透箭'],['heal','治疗圣光'],['healMastery','曙光归来（专精）'],
  ['shield','护盾'],['web','蛛网束缚'],['root','藤蔓缠绕'],['fireRain','火雨'],['mortar','陨石爆破'],['breakwater','破浪'],['drain','汲取'],['shock','震荡'],['beacon','信标'],['rally','增援'],
  ['fervor','狂热'],['giant','巨大化'],['taunt','嘲讽'],['encourage','鼓舞'],['cleanse','净化'],['revive','复活'],['polymorph','变形爆发'],['silence','沉默'],['slow','减速'],['stun','眩晕'],['armorBreak','破甲'],['castInterrupted','施法打断'],['enemy-melee','怪物近战普攻'],['enemy-ranged','怪物远程普攻'],['boss-melee','Boss近战普攻'],['boss-ranged','Boss远程普攻'],['enemy-mend','怪物治疗'],['boss-slam','Boss重击'],['boss-summon','Boss召唤'],
  ['attack-stone','岩盾普攻'],['attack-spike','弓手普攻'],['attack-crystal','冰系普攻'],['attack-leaf','治疗弹'],['attack-bubble','召唤弹'],['critical','暴击'],['death','消散']
 ];
 private constructor(private fx:G1BattleEffects,private readonly host?:VfxReviewHost){
  this.panel.style.cssText='position:fixed;right:12px;top:12px;z-index:9000;width:344px;padding:14px;border-radius:12px;background:rgba(16,27,36,.95);color:#f5eedc;font:13px sans-serif;box-shadow:0 5px 28px #0005;max-height:calc(100vh - 24px);overflow:auto';
  const title=document.createElement('strong');title.textContent='特效逐项验收模型';this.panel.append(title);
  const note=document.createElement('p');note.textContent='带入施法者与受击者 · 同时检查动作、比例、出手点、命中反馈和裁边';note.style.cssText='font-size:12px;color:#b6cfce;margin:8px 0 10px;line-height:1.5';this.panel.append(note);
  this.appendField('施法者',this.source,this.actorOptions(true));
  this.appendField('受击者',this.target,this.actorOptions(false));
  this.appendField('验收技能',this.select,this.choices);
  const bind=()=>{this.pending=true;this.age=0;};this.source.onchange=bind;this.target.onchange=bind;this.select.onchange=bind;
  const q=new URLSearchParams(location.search);this.source.value=q.get('reviewSource')??'role:stone:normal';this.target.value=q.get('reviewTarget')??'enemy:M03';
  this.select.value=q.get('spell')??'frost';if(!this.select.value)this.select.value='frost';
  const button=document.createElement('button');button.textContent='播放动画';button.style.cssText='margin:10px 0;padding:7px 14px;cursor:pointer';button.onclick=()=>{this.motion=!this.motion;button.textContent=this.motion?'定格检视':'播放动画';this.pending=true;this.age=0;};this.panel.append(button);
  this.slider.type='range';this.slider.min='0.05';this.slider.max='1.5';this.slider.step='0.05';this.slider.value='.35';this.slider.style.width='100%';this.slider.oninput=()=>{this.motion=false;button.textContent='播放动画';this.pending=true;};this.panel.append(this.slider,this.caption);
  const checklist=document.createElement('div');checklist.style.cssText='margin-top:10px;padding-top:8px;border-top:1px solid #41616a';const checkTitle=document.createElement('div');checkTitle.textContent='六项验收';checkTitle.style.color='#bfe8e4';checklist.append(checkTitle);
  for(const label of ['动作协调','出手位置','特效形体','命中/受击反馈','角色与特效比例','性能与裁边']){const row=document.createElement('label');row.style.cssText='display:block;margin:5px 0;color:#d9e4de';const box=document.createElement('input');box.type='checkbox';box.style.marginRight='6px';box.onchange=()=>this.updateVerdict();this.checks.push(box);row.append(box,document.createTextNode(label));checklist.append(row);}
  this.panel.append(checklist);const pass=document.createElement('button');pass.textContent='记录通过';pass.style.cssText='margin:8px 6px 0 0;padding:6px 10px;cursor:pointer';pass.onclick=()=>this.record('通过');const reject=document.createElement('button');reject.textContent='记录退回';reject.style.cssText='padding:6px 10px;cursor:pointer';reject.onclick=()=>this.record('退回');this.panel.append(pass,reject);this.verdict.style.cssText='font-size:12px;color:#d7c99e;margin-top:7px;line-height:1.45';this.panel.append(this.verdict);this.updateVerdict();
  document.body.append(this.panel);
 }
 private appendField(label:string,select:HTMLSelectElement,items:[string,string][]):void{const wrap=document.createElement('label');wrap.style.cssText='display:block;color:#bfe8e4;margin:7px 0 3px';wrap.textContent=label;select.style.cssText='display:block;width:100%;padding:7px;border-radius:6px;margin-top:4px';for(const [value,text]of items){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}wrap.append(select);this.panel.append(wrap);}
 private actorOptions(source:boolean):[string,string][]{const result:[string,string][]=[];if(source)for(const role of Object.keys(ROLES) as Role[])result.push([`role:${role}:normal`,`${ROLES[role].name} · 普通`]);for(const e of ENEMY_G1){const group=e.kind==='elite'?'精英':e.id.startsWith('W')?'世界 Boss':e.kind==='boss'?'Boss':'小怪';result.push([`enemy:${e.id}`,`${group} · ${e.id} ${e.name}`]);}return result;}
 private parseActor(value:string):VfxReviewActor{const parts=value.split(':');if(parts[0]==='role'){const role=parts[1] as Role;return{id:value,kind:'role',role,advanced:false,label:`${ROLES[role].name} · 普通`};}const e=enemyG1(parts[1]);return{id:value,kind:'enemy',variant:parts[1],label:e?`${e.id} ${e.name}`:parts[1]};}
 private record(result:'通过'|'退回'):void{const count=this.checks.filter(x=>x.checked).length;if(result==='通过'&&count<6){this.verdict.textContent='未完成六项检查，不能记录通过';this.verdict.style.color='#FFB59C';return;}const entry={at:new Date().toISOString(),source:this.source.value,target:this.target.value,spell:this.select.value,result};const previous=JSON.parse(localStorage.getItem(this.recordKey)??'[]') as unknown[];previous.push(entry);localStorage.setItem(this.recordKey,JSON.stringify(previous.slice(-100)));this.verdict.textContent=`已记录：${result}`;this.verdict.style.color=result==='通过'?'#9BE0A7':'#FFB59C';}
 private updateVerdict():void{const count=this.checks.filter(x=>x.checked).length;this.verdict.textContent=`当前验收：${this.source.options[this.source.selectedIndex]?.text} → ${this.target.options[this.target.selectedIndex]?.text} · ${count}/6 项通过`;this.verdict.style.color=count===6?'#9BE0A7':'#D7C99E';}
 private emit():void{
  const source=this.parseActor(this.source.value),target=this.parseActor(this.target.value),staged=this.host?.stageVfxAcceptance(source,target),at=staged?.to??new Vec3(0,.6,-.4),from=staged?.from??new Vec3(-2,.8,.3),id=this.select.value;
  if(['rock','frost','arrows','heal'].includes(id))this.fx.cast(id as 'rock',at,1.45,id==='rock'||id==='frost'?3:1.2);
  else if(id==='rockMastery')this.fx.cast('rock',at,1.72,3.6,true);
  else if(id==='frostMastery')this.fx.cast('frost',at,1.72,4.5,true);
  else if(id==='arrowsMastery')this.fx.cast('arrows',at,1.72,1.25,true);
  else if(id==='healMastery')this.fx.cast('heal',at,1.35,1.35,true);
  else if(id==='piercing')this.fx.piercing(from,at);
  else if(['fireRain','mortar','breakwater','drain','shock','beacon','rally'].includes(id))this.fx.bossCast(id,at,from);
  else if(id==='enemy-melee')this.fx.enemyAttack(from,at,false,false,source.variant);
  else if(id==='enemy-ranged')this.fx.enemyAttack(from,at,true,false,source.variant);
  else if(id==='boss-melee')this.fx.enemyAttack(from,at,false,true,source.variant);
  else if(id==='boss-ranged')this.fx.enemyAttack(from,at,true,true,source.variant);
  else if(id==='enemy-mend')this.fx.status('enemyMend',at,.9);
  else if(id==='boss-slam')this.fx.cast('impact',at,1.7,.8,true);
  else if(id==='boss-summon')this.fx.bossCast('rally',at,from);
  else if(id.startsWith('attack-'))this.fx.attack(staged?.sourceModel,source.role,from,at);
  else if(id==='critical')this.fx.impact(at,true);
  else if(id==='death')this.fx.death(at,true);
  else this.fx.status(id,at,1);
 }
 update(dt:number):void{
  if(this.pending){this.fx.clearTransient();this.emit();this.pending=false;
   if(!this.motion){const t=Number(this.slider.value);for(let n=0;n<Math.ceil(t*60);n++)this.fx.update(Math.min(1/60,t-n/60));this.caption.textContent='定格 '+t.toFixed(2)+' 秒';}
  }
  if(this.motion){this.fx.update(dt);this.age+=dt;this.caption.textContent='播放中';if(this.age>3.2){this.age=0;this.pending=true;}}
 }
 destroy():void{this.panel.remove();}
}
