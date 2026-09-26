const fs=require('fs'),base='game/assets/scripts/';function edit(p,f){fs.writeFileSync(base+p,f(fs.readFileSync(base+p,'utf8').replace(/\r\n/g,'\n')));}
fs.copyFileSync('C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14/exec-b991ecfb-6711-46b1-8efe-c011f3b7cc6e.png','game/assets/resources/art-modern/shop-packs-release.png');
edit('view/ArtV2Assets.ts',s=>s.replace('export type ArtV2Image=',"export type ArtV2Image='shop-packs-release'|").replace('const IMAGES:ArtV2Image[]=[',"const IMAGES:ArtV2Image[]=['shop-packs-release',").replace('const modern:Partial<Record<ArtV2Image,string>>={',"const modern:Partial<Record<ArtV2Image,string>>={'shop-packs-release':'shop-packs-release',").replace('    [0,0,1,12,14,2].forEach((index,i)=>{this.frames.get(`shop-${i}` as ArtV2Slice)?.destroy();this.frames.set(`shop-${i}` as ArtV2Slice,this.frames.get(`modern-${index}`)!);});',`    const packs=this.images.get('shop-packs-release')!;
    for(let i=0;i<6;i++){this.frames.get(\`shop-\${i}\` as ArtV2Slice)?.destroy();this.frames.set(\`shop-\${i}\` as ArtV2Slice,frame(packs.texture!,i%3*418+6,Math.floor(i/3)*560+92,406,490));}`)
 .replace("||key.startsWith('shop-')",''));
edit('core/battle.ts',s=>{
 const start=s.indexOf("  if(has(target,'holyLight')"),end=s.indexOf("  emit(state, { type: 'heal'",start);const block=s.slice(start,end);
 s=s.slice(0,start)+'  receiveHolyLight(state,target);\n'+s.slice(end);
 s=s.replace('function healDirect(',`function receiveHolyLight(state:BattleState,target:BattleUnit):void{\n${block}}\n\nfunction healDirect(`);
 return s.replace("target.hp=target.maxHp*.4;activate(target,'rebirth');","target.hp=target.maxHp*.4;receiveHolyLight(state,target);activate(target,'rebirth');");
});
