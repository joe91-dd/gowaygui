const fs=require('fs');
const edit=(p,fn)=>{p='game/tests/'+p;const s=fs.readFileSync(p,'utf8'),n=fn(s);if(s===n)throw Error(p);fs.writeFileSync(p,n);};
edit('raid-drag-release.test.cjs',s=>s.replace("require:n=>n.endsWith('/placement')", "require:n=>n.endsWith('/development')?{petRange:()=>1.85}:n.endsWith('/placement')"));
edit('multi-front.test.cjs',s=>s.replace("assert.throws(()=>moveRaidStation(r,0,1),/已有队友/);", "moveRaidStation(r,0,1);assert.equal(r.members[0].station,1);assert.equal(r.members[1].station,0,'occupied drop swaps both positions');"));
edit('menu-readability.test.cjs',s=>s.replace("f.click(turtleTitle(f,removed));assert.deepEqual", "f.click(turtleTitle(f,removed));assert.deepEqual(clone(f.entry.teamSelection),original,'inspection alone never changes lineup');f.click('取消出战');assert.deepEqual")
 .replace("f.click(turtleTitle(f,added));", "f.click(turtleTitle(f,added));f.click('确定出战');")
 .replace("assert.equal(extra.handlers.has(f.Node.EventType.TOUCH_END),false,'unselected cards are disabled at the five-turtle limit');extra.emit(f.Node.EventType.TOUCH_END);", "assert.equal(extra.handlers.has(f.Node.EventType.TOUCH_END),true,'full lineup still permits inspecting another pet');extra.emit(f.Node.EventType.TOUCH_END);assert.equal(f.target('确定出战'),undefined,'confirm is disabled at cap');f.click('返回');")
 .replace("const a=cardId(f,f.cards()[0]);f.click(f.cards()[0]);f.click('主龟 · 60%造型');const b=cardId(f,f.cards()[1]);f.click(f.cards()[1]);f.click('副龟 · 40%造型');", "const candidates=()=>f.nodes.filter(n=>f.alive(n)&&n.name==='按钮:'&&n.getComponent(f.UITransform)?.width===224);const a=cardId(f,candidates()[0]);f.click(candidates()[0]);f.click('选择为主龟');const b=cardId(f,candidates()[1]);f.click(candidates()[1]);f.click('选择为副龟');")
 .replace("f.click('去合成');const confirm=", "f.click('查看合成方案');const confirm=")
 .replace("f.click(turtleTitle(f,removed));\n  const duplicate", "f.click(turtleTitle(f,removed));f.click('取消出战');\n  const duplicate")
 .replace("f.click(duplicate);assert.equal(f.entry.teamSelection.length,5)", "f.click(duplicate);f.click('确定出战');assert.equal(f.entry.teamSelection.length,5)")
 .replace("'排行榜','三大副本','竞技场'","'排行榜','海岛副本','竞技场'")
 .replace("for(const id of ids)f.click(turtleTitle(f,id));", "for(const id of ids){f.click(turtleTitle(f,id));f.click('确定出战');}"));
