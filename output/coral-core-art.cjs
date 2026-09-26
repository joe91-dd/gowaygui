const fs=require('fs'),base='game/assets/scripts/';
function edit(p,f){let s=fs.readFileSync(base+p,'utf8');fs.writeFileSync(base+p,f(s));}
function rep(s,a,b){if(!s.includes(a))throw Error('missing '+a.slice(0,100));return s.replace(a,b);}
const bounds=JSON.parse(fs.readFileSync('output/coral-expansion-20260914/boss-bounds.json'));
edit('view/ArtV2Assets.ts',s=>{
 s="import {BOSSES} from '../core/bossCatalog';\n"+s;
 const names=Object.keys(bounds).map(c=>'boss-'+c+'-roster');
 s=s.replace('export type ArtV2Image=', 'export type ArtV2Image='+names.map(x=>JSON.stringify(x)).join('|')+'|');
 s=s.replace('const IMAGES:ArtV2Image[]=[','const IMAGES:ArtV2Image[]=['+names.map(x=>JSON.stringify(x)).join(',')+',');
 s=s.replace('const modern:Partial<Record<ArtV2Image,string>>={','const modern:Partial<Record<ArtV2Image,string>>={'+names.map(x=>JSON.stringify(x)+':'+JSON.stringify(x)).join(',')+',');
 s=s.replace("    const enemy=this.images.get('battle-enemies-painted')!;",`    const bossCrops:Record<string,number[][]>=${JSON.stringify(bounds)};
    BOSSES.forEach((boss,i)=>{if(!boss.art)return;const [x,y,w,h]=bossCrops[boss.art.split('-')[1]][boss.cell!],atlas=this.images.get(boss.art as ArtV2Image)!;this.frames.set(('boss-'+i) as ArtV2Slice,frame(atlas.texture!,x,y,w,h));});
    const enemy=this.images.get('battle-enemies-painted')!;`);
 return s;
});
edit('view/BattlePaint.ts',s=>"import {mapProps} from '../core/placement';\nimport {BOSSES} from '../core/bossCatalog';\n"+s.replace("this.material('boss-atlas',f,1)","this.material(BOSSES[index]?.art??'boss-atlas',f,1)").replace('node.setPosition(0,0,0);}', '}'));
edit('view/GameEntry.ts',s=>s.replace("this.ui.bookIcon('calm',0,17,36,n)","this.ui.modernIcon(13,0,17,40,n)"));
edit('core/bossCatalog.ts',s=>s.replace('w<=3;w++','w<=[6,8,10][l-51];w++').replace("'深渊回廊 · 第'","'双环潮狱 · 第'").replace("list.push('副本难度'+(l-50)+' · 第'+w+'波')","list.push(['碎礁洞穴','深潮遗迹','巨钳王庭'][l-51]+' · 第'+w+'波')"));
edit('core/battle.ts',s=>{
 s=s.replace("import {bossFor}","import {bossFor,BOSSES,BossAbility}");
 s=s.replace('  bossId?:string;',"  bossId?:string;abilityReadyTick?:number;\n  cast?:{kind:BossAbility;x:number;z:number;landTick:number};");
 s=s.replace('  encounterVersion?:1;','  encounterVersion?:1;faunaVersion?:1;');
 s=s.replace("if(options.rulesVersion==='0.6'){state.rulesVersion", "if(options.rulesVersion==='0.6'){state.faunaVersion=1;state.rulesVersion");
 s=s.replace('bossFor(state.levelId,state.wave);','bossFor(state.levelId,state.wave,state.enemies.filter(e=>e.kind===\'boss\').length);');
 s=s.replace('  state.enemies.push(enemy);',`  if(state.faunaVersion===1){
    if(enemy.bossId)enemy.abilityReadyTick=state.tick+tickTime(4);
    else if(enemy.kind==='elite'||enemy.kind==='mist')enemy.abilityReadyTick=state.tick+tickTime(5);
    if(enemy.kind==='runner'&&!enemy.trait){enemy.trait='sprinter';enemy.traitReadyTick=state.tick+tickTime(5);}
  }
  state.enemies.push(enemy);`);
 s=s.replace('    if(enemy.slam){','    tickEnemyAbility(state,enemy);\n    if(enemy.slam){');
 s=s.replace("if (state.tick >= enemy.nextAttackTick && statusAmount(enemy, 'stun')", "if (!enemy.cast && state.tick >= enemy.nextAttackTick && statusAmount(enemy, 'stun')");
 s=s.replace('function updateAuras(state: BattleState): void {',`function tickEnemyAbility(state:BattleState,e:BattleEnemy):void{
  if(state.faunaVersion!==1)return;
  if(e.cast){
    if(statusAmount(e,'stun')>0||statusAmount(e,'sheep')>0){delete e.cast;emit(state,{type:'control',sourceId:e.id,effect:'castInterrupted',x:e.x,z:e.z});return;}
    if(state.tick<e.cast.landTick)return;
    const c=e.cast;delete e.cast;
    emit(state,{type:'skill',sourceId:e.id,effect:'boss-'+c.kind,x:c.x,z:c.z});
    if(c.kind==='rally'){
      if(state.enemies.filter(v=>v.alive).length<50)for(let i=0;i<2;i++)spawnEnemy(state,{kind:i?'runner':'armored',time:state.elapsed,hpScale:Math.max(1,e.maxHp/2400*.1),attackScale:.8,...(e.routeId!==undefined?{routeId:e.routeId}:{})},Math.max(0,e.distance-.4-i*.45));
      return;
    }
    const radius=c.kind==='drain'?2.6:1.5;
    for(const u of state.units.filter(u=>u.alive&&distance(u,c)<=radius)){
      if(c.kind==='shock'){for(const shield of u.shields)shield.amount*=.5;u.shield=u.shields.reduce((n,a)=>n+a.amount,0);}
      const dealt=damageUnit(state,e,u,e.attack*(c.kind==='mortar'?1.2:c.kind==='drain'?.55:.8),c.kind==='frost'||c.kind==='drain',false);
      if(c.kind==='drain')e.hp=Math.min(e.maxHp,e.hp+dealt*.8);
      if(u.alive&&c.kind==='frost')controlUnit(state,u,.85,e.id);
      if(u.alive&&c.kind==='breakwater')setStatus(state,u,'armorDown',15,3,e.id);
    }return;
  }
  if(state.tick<(e.abilityReadyTick??Infinity)||statusAmount(e,'stun')>0||statusAmount(e,'sheep')>0||e.slam)return;
  const boss=BOSSES.find(b=>b.id===e.bossId),kind=boss?.ability??(e.kind==='mist'?'frost':'breakwater');
  const nearby=state.units.filter(u=>u.alive&&distance(u,e)<(kind==='mortar'?5:3.3));
  const target=nearby.sort((a,b)=>kind==='mortar'?distance(b,e)-distance(a,e):distance(a,e)-distance(b,e))[0];
  if(!target)return;
  const p=kind==='rally'||kind==='drain'?e:target;
  e.cast={kind,x:p.x,z:p.z,landTick:state.tick+tickTime(1.35)};e.abilityReadyTick=state.tick+tickTime(boss?11:13);e.actionUntilTick=e.cast.landTick+tickTime(.25);
  emit(state,{type:'skill',sourceId:e.id,effect:'bossTell-'+kind,x:p.x,z:p.z});
}
function updateAuras(state: BattleState): void {`);
 return s;
});
edit('core/progression.ts',s=>{
 s=s.replace("import {BOSSES}","import {BOSSES,bossDropChance}");
 s=s.replace('version:1;skills:string[]','version:1;bossDropClaims?:string[];skills:string[]');
 const a=s.indexOf('export function discoverBattle('),b=s.indexOf('export function syncProgression(',a);
 s=s.slice(0,a)+`export function discoverBattle(s:GameSave,b?:BattleState):void{
 if(!b)return;const p=progression(s);
 for(const e of b.enemies)if(e.bossId&&!e.alive&&e.hp<=0){
  if(!p.bosses.includes(e.bossId))p.bosses.push(e.bossId);
  if(b.faunaVersion!==1)continue;
  const boss=BOSSES.find(v=>v.id===e.bossId);if(!boss)continue;
  const key=(b.encounter==='raid'?s.community?.raid?.id:s.run?.id)+':'+b.wave+':'+e.id;p.bossDropClaims??=[];
  if(p.bossDropClaims.includes(key))continue;p.bossDropClaims.push(key);
  const hash=(text:string)=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  const mat=(['attack','health','defense','growth'] as const)[hash(boss.id)%4];
  s.gold+=goldAmount(s,10+boss.tier*6);s.materials[mat]+=1+Math.floor(boss.tier/2);
  if(boss.dropBook&&hash(key+':loot')/4294967296<bossDropChance(boss.tier)){s.skillBooks??={};s.skillBooks[boss.dropBook]=(s.skillBooks[boss.dropBook]??0)+1;}
 }
}
`+s.slice(b);
 s=s.replace(' check(p.version===1);',' check(p.version===1);if(p.bossDropClaims)check(Array.isArray(p.bossDropClaims)&&new Set(p.bossDropClaims).size===p.bossDropClaims.length&&p.bossDropClaims.every(x=>typeof x===\'string\'));');
 return s;
});
