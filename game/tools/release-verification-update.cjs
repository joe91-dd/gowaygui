const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
edit('game/assets/scripts/view/IslandUI.ts',s=>s.replace("    const nodes=this.root.children.slice(index)","    if(!this.art?.ready)return;const nodes=this.root.children.slice(index)"));
edit('game/assets/scripts/core/battleValidation.ts',s=>s.replace("    if(unit.rebirthUsed!==undefined)","    for(const key of ['holyUntilTick','holyReadyTick'])if(unit[key]!==undefined){integer(unit[key],`${name}.${key}`);check(owned.has('holyLight'),name,'未拥有圣光');}\n    if(unit.rebirthUsed!==undefined)"));
edit('game/assets/scripts/core/shop.ts',s=>s.replace("export const ATTACK_BOOKS:SkillId[]=[","export const ATTACK_BOOKS:SkillId[]=['scatter','arcane','counterStorm','spirit',").replace('水晶炮','海霜风暴'));
fs.copyFileSync('C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14/exec-6af2f0ba-f15b-4e0c-a632-590e588d0e3b.png','game/assets/resources/art-modern/skill-icons-release.png');
edit('game/assets/scripts/view/ArtV2Assets.ts',s=>s.replace('export type ArtV2Image=',"export type ArtV2Image='skill-icons-release'|").replace('const IMAGES:ArtV2Image[]=[',"const IMAGES:ArtV2Image[]=['skill-icons-release',").replace('const modern:Partial<Record<ArtV2Image,string>>={',"const modern:Partial<Record<ArtV2Image,string>>={'skill-icons-release':'skill-icons-release',").replace('    [0,0,1,12,14,2].forEach',`    const release=this.images.get('skill-icons-release')!;
    this.frames.set('book-reach',frame(release.texture!,842,630,396,435));
    ['stone','spike','crystal','leaf','bubble'].forEach((role,i)=>this.frames.set(\`skill-\${role}\` as ArtV2Slice,frame(release.texture!,i%3*412+103,Math.floor(i/3)*470+250,248,252)));
    [0,0,1,12,14,2].forEach`));
// Historical tests retain their original UI branch; new shape screen requires a real return node.
edit('game/tests/battle-screen-lifecycle.test.cjs',s=>s.replace('portraits.push({role,x,y,side,parent});','portraits.push({role,x,y,side,parent});return this.group("portrait",x,y,parent,side,side);').replace("assert.equal(f.real.snapshot.run.phase,'between');","assert.equal(f.real.snapshot.run.phase,'between',JSON.stringify({errors:f.calls.error,battle:f.screen.battle?.tick,paused:f.screen.paused}));"));
edit('game/tests/battle.test.cjs',s=>s.replace('exactly thirty-five','exactly forty-one').replace('SKILLS.length,35','SKILLS.length,41').replace('s.id)).size,35','s.id)).size,41')
 .replace('crystalCannon deals 260 percent','blizzard starts with an 80 percent pulse').replace('45*2.6/1.6','45*.8/1.6').replace("near(enemy.statuses.find(s=>s.kind==='resistDown').amount,5);\n  stepBattle(state,4)","\n  stepBattle(state,4)")
 .replace(/test\('bubbleRing controls[\s\S]+?\n\}\);/,`test('bubbleRing summons two damageable allies instead of rooting enemies',()=>{
  const state=arena([input('bubble',['bubbleRing'])]);stepBattle(state,.05);
  assert.equal(state.summons.filter(p=>p.alive).length,2);assert.equal(getBattleEvents(state).filter(e=>e.type==='control').length,0);
  const u=state.units[0];for(const p of state.summons){near(p.maxHp,u.maxHp*.35);near(p.attack,u.attack*.4);}
});`));
edit('game/tests/c-increment-combat.test.cjs',s=>s.replace("test('C area skill accepts only a reachable area containing enemies'","test('C summoning area permits empty in-range ground and rejects invalid coordinates'")
 .replace("assert.equal(commandBattle(b,{...c,point:{x:0,z:3}}),false);assert.ok(commandBattle(b,{...c,point:{x:1,z:0}}));", "assert.ok(commandBattle(b,{...c,point:{x:0,z:3}}));")
 .replace("assert.ok(b.enemies.every(e=>e.statuses.some(s=>s.kind==='root')));","assert.equal(b.summons.filter(p=>p.alive).length,2);"));
edit('game/tests/fixed-slot-coverage.test.cjs',s=>s.replace(/spike:4\.8/g,'spike:5.6'));
edit('game/tests/v07-domain.test.cjs',s=>s.replace('SKILLS.length,35','SKILLS.length,41'));
edit('game/tests/modern-tactics.test.cjs',s=>s.replace('new Set(hits.map(e=>e.targetId)).size,4','new Set(hits.map(e=>e.targetId)).size,5'));
edit('game/tests/prototype-domain.test.cjs',s=>s.replace("mode:r.mode});f.game.beginWave", "mode:r.mode,waveLimit:r.waveLimit});f.game.beginWave").replace('five introductory/eight ordinary waves','five waves in all new chapters').replace('next.game.snapshot.run.waveLimit,8','next.game.snapshot.run.waveLimit,5'));
edit('game/tests/menu-readability.test.cjs',s=>s.replace("assert.equal(f.real.snapshot.outsideFusion.revealed,true);","assert.equal(f.real.snapshot.outsideFusion.revealed,true);f.click('查看伙伴');"));
edit('game/tests/release-polish.test.cjs',s=>s.replace("const u=b.units[0];for(const [i,e]", "const u=b.units[0];u.x=b.enemies[0].x;u.z=b.enemies[0].z+.3;for(const [i,e]").replace("b.enemies[3].z=u.z+7;","b.enemies[3].distance=15;b.enemies[3].z=u.z+7;"));
console.log('Verification fixtures follow new rules; existing save/lifecycle checks retained');
