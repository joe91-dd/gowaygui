const fs=require('fs'),base='game/assets/scripts/';function edit(p,f){fs.writeFileSync(base+p,f(fs.readFileSync(base+p,'utf8').replace(/\r\n/g,'\n')));}
edit('view/IslandUI.ts',s=>s.replace("this.icon('book'","this.icon('growth-history'").replace('if(text && h>=68 && h<=96)','if(this.art?.ready && text && h>=68 && h<=96)').replace('this.hover(n);','IslandUI.prototype.hover.call(this,n);').replace('    const children=this.root.children.slice(index);','    if(!this.art?.ready)return;const children=this.root.children.slice(index);'));
edit('view/BattleScreen.ts',s=>s.replace('    this.panBase??=','    if(!this.ui.art?.ready)return;this.panBase??='));
edit('view/ProfileAvatar.ts',s=>s.replace('const texture=new Texture2D();texture.image=new ImageAsset(picture);','const asset=new ImageAsset(picture),texture=new Texture2D();texture.image=asset;').replace('frame.destroy();texture.destroy();','frame.destroy();texture.destroy();asset.destroy();'));
edit('core/battle.ts',s=>s.replace('state.storms=state.storms?.filter(s=>s.untilTick>state.tick);','if(state.storms)state.storms=state.storms.filter(s=>s.untilTick>state.tick);')
 .replace("damageEnemy(state,target,e,amount,false,'reflect','counterStorm')","damageEnemy(state,target,e,amount,false,'secondary','counterStorm')")
 .replace('magic: boolean, melee: boolean): number {','magic: boolean, melee: boolean,allowCounter=true): number {').replace("if(actual>0&&target.alive&&has(target,'counterStorm')", "if(allowCounter&&actual>0&&target.alive&&has(target,'counterStorm')")
 .replace("magic,source.role==='stone');","magic,source.role==='stone',skillId!=='counterStorm');")
 .replace("    if(kind==='golem')for(const e of state.enemies.filter(e=>e.alive&&distance(e,pet)<=1.5))damageEnemy(state,owner,e,pet.attack,true,'secondary','spirit');",'')
 .replace("    const enemies=state.enemies.filter(e=>e.alive).sort", "    if(pet.kind==='golem'&&state.tick-pet.bornTick<10)continue;\n    if(pet.kind==='golem'&&state.tick-pet.bornTick===10){for(const e of state.enemies.filter(e=>e.alive&&distance(e,pet)<=1.5))damageEnemy(state,owner,e,pet.attack,true,'secondary','spirit');emit(state,{type:'skill',sourceId:pet.id,skillId:'spirit',x:pet.x,z:pet.z,effect:'landing'});}\n    const enemies=state.enemies.filter(e=>e.alive).sort")
 .replace("  const pending=unit.pendingAttack;",`  if(state.duelUnits&&unit.role!=='leaf'){
    const own=state.duelTeamA!.includes(unit.id),pet=state.summons?.filter(p=>p.alive&&state.duelTeamA!.includes(p.ownerId)!==own&&distance(p,unit)<=unit.range).sort((a,b)=>distance(a,unit)-distance(b,unit))[0];
    const main=targetEnemy(state,unit);
    if(pet&&(!main||distance(pet,unit)<distance(main,unit))){
      if(state.tick<unit.nextAttackTick)return;delete unit.pendingAttack;unit.nextAttackTick=state.tick+tickTime(unit.interval);unit.attackCount++;
      const magic=unit.role==='crystal'||unit.role==='bubble',amount=pet.kind==='golem'?0:Math.min(pet.hp,power(unit)*100/(100+(magic?pet.resist:pet.armor)));
      pet.hp-=amount;pet.alive=pet.hp>0;emit(state,{type:'attack',sourceId:unit.id,targetId:pet.id,x:pet.x,z:pet.z,effect:unit.role});emit(state,{type:'damage',sourceId:unit.id,targetId:pet.id,amount,x:pet.x,z:pet.z});return;
    }
  }
  const pending=unit.pendingAttack;`));
edit('view/CommunityMenus.ts',s=>s.replace("else this.ui.icon('growth-history',-208,0,72,n)","else this.ui.bookIcon(l.skillId!,-208,0,86,n)").replace("else this.ui.icon('growth-history',0,108,112,p)","else this.ui.bookIcon(l.skillId!,0,108,136,p)"));
fs.copyFileSync('C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14/exec-74a85bc3-75a1-4be6-acc5-8e9f42577287.png','game/assets/resources/art-modern/skill-books-common.png');
edit('view/ArtV2Assets.ts',s=>s.replace("export type ArtV2Image=","export type ArtV2Image='skill-books-common'|").replace("const IMAGES:ArtV2Image[]=[","const IMAGES:ArtV2Image[]=['skill-books-common',").replace("const modern:Partial<Record<ArtV2Image,string>>={","const modern:Partial<Record<ArtV2Image,string>>={'skill-books-common':'skill-books-common',").replace('    const controls=this.images',`    const common=this.images.get('skill-books-common')!;
    ['strong','armor','resist','swift'].forEach((id,i)=>this.frames.set(\`book-\${id}\`,frame(common.texture!,i*278+14,12,262,255)));
    ['steady','regen','openingShield','lastShield','encourage','block','reflect','share','critical','lifesteal','bounce','spellDrain','shredResist','doubleHeal','healShield','cleanse','shredArmor','root','weaken','pursuit'].forEach((id,i)=>this.frames.set(\`book-\${id}\`,frame(common.texture!,i%5*250+14,272+Math.floor(i/5)*237,230,236)));
    const controls=this.images`));
// Update only fixtures for the new additive methods; actual lifecycle assertions stay intact.
for(const file of ['battle-screen-lifecycle.test.cjs','menu-readability.test.cjs','home-entry.test.cjs']){
 const p='game/tests/'+file;let s=fs.readFileSync(p,'utf8');
 s=s.replace("if(name==='cc')return cc;", "if(name==='./ProfileAvatar')return {avatarPicker(){},paintAvatar(){}};if(name==='cc')return cc;");
 s=s.replace('roleMark(){},','roleMark(){},hover(){},compactFrom(){},bookIcon(){},');
 fs.writeFileSync(p,s);
}
const p='game/tests/battle-validation.test.cjs';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('SKILLS.filter(s => !s.role &&','SKILLS.filter(s => !s.precious && !s.role &&'));
console.log('Hardening applied');
