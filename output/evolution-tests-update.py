from pathlib import Path
p=Path('game/tests/companion-motion.test.cjs');s=p.read_text(encoding='utf-8').replace('lineTo(){}stroke(){}','lineTo(){}quadraticCurveTo(){}stroke(){}').replace('this.events={};','this.events={};this.position={x:0,y:0};').replace('setPosition(){}addComponent','setPosition(x,y){this.position={x,y};}setScale(x,y){this.scale={x,y};}setRotationFromEuler(){}addComponent').replace('contentSize:{width:423,height:423}','contentSize:{width:423,height:423},setContentSize(){}')
s=s.replace("motion=new mod.exports.CompanionMotion(sprite,role,new Node());", "art={motionMaterial:()=>new Material(),battleFrame:key=>({key,rect:{x:0,y:0,width:400,height:400},texture:{width:400,height:400}})},motion=new mod.exports.CompanionMotion(sprite,role,new Node(),art);")
a=s.index("test('home companions");s=s[:a]+'''test('signature animation changes whole poses, keeps the feet planted and never pulls the neck',()=>{
 const a=fixture('stone'),b=fixture('crystal');assert.notEqual(a.sprite.customMaterial,a.original);
 for(let i=0;i<20;i++)a.motion.update(.04);assert.ok(a.sprite.spriteFrame.key.endsWith('-2'));assert.equal(a.sprite.customMaterial.values.portraitMotion.z,0);
 const foot=a.sprite.node.position.y-a.sprite.node.scale.y*423*.45;assert.ok(Math.abs(foot+423*.45)<1e-8);
 a.sprite.node.events.tap();a.motion.update(.02);assert.ok(a.sprite.spriteFrame.key.endsWith('-0'));assert.equal(b.sprite.customMaterial.values.portraitMotion,undefined);
 a.motion.update(.02,true);assert.equal(a.sprite.node.scale.y,1);assert.equal(a.sprite.customMaterial.values.portraitMotion.y,0);
 a.sprite.node.events.destroy();assert.equal(a.sprite.customMaterial.disposed,true);assert.ok(!a.original.disposed);
});
''';p.write_text(s,encoding='utf-8')
p=Path('game/tests/doc4-polish.test.cjs');s=p.read_text(encoding='utf-8').replace('BATTLE_MAPS.length,55','BATTLE_MAPS.length,56');p.write_text(s,encoding='utf-8')
p=Path('game/tests/increment-campaign.test.cjs');s=p.read_text(encoding='utf-8').replace('BATTLE_MAPS.slice(50).length,5','BATTLE_MAPS.slice(50).length,6');p.write_text(s,encoding='utf-8')
p=Path('game/tests/battle-screen-lifecycle.test.cjs');s=p.read_text(encoding='utf-8').replace('    portrait(role,x,y,side,parent=root)', '    fusionCard(t,p){return this.portrait(t.role,0,0,124,p);},\n    portrait(role,x,y,side,parent=root)');p.write_text(s,encoding='utf-8')
p=Path('game/tests/menu-readability.test.cjs');s=p.read_text(encoding='utf-8').replace("assert.equal(f.real.snapshot.outsideFusion.revealed,true);f.click('查看伙伴');", "assert.equal(f.real.snapshot.outsideFusion.revealed,true);");p.write_text(s,encoding='utf-8')
p=Path('game/tests/domain.test.cjs');s=p.read_text(encoding='utf-8');a=s.index("test('日常时钟");a2=s.index('const before=',a);s=s[:a2]+"f.game.refreshClock('progression:bootstrap');"+s[a2:];p.write_text(s,encoding='utf-8')
