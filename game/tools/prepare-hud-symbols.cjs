const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'art-source/hud-reference');
const icons=['tree-palm','shield-half','chevrons-up','clock-3','leaf','snowflake','shield-plus','flame','moon'];
(async()=>{fs.mkdirSync(out,{recursive:true});const composite=[];
for(let i=0;i<icons.length;i++){
 const name=icons[i],url=`https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${name}.svg`,r=await fetch(url);if(!r.ok)throw Error(`${name}: ${r.status}`);
 const svg=await r.text();fs.writeFileSync(path.join(out,name+'.svg'),svg);
 const png=await sharp(Buffer.from(svg.replace(/currentColor/g,i>=4?'#ffffff':i===2?'#18bce5':'#07385e'))).resize(96,96).png().toBuffer();composite.push({input:png,left:i*128+16,top:16});
}
await sharp({create:{width:128*icons.length,height:128,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toFile(path.join(root,'assets/resources/art-modern/hud-symbols.png'));
const license=await fetch('https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE');if(!license.ok)throw Error('license download failed');fs.writeFileSync(path.join(out,'LICENSE-lucide.txt'),await license.text());
fs.writeFileSync(path.join(out,'SOURCES.md'),'HUD symbols: Lucide, https://lucide.dev, ISC license (included). Original SVG paths retained.\n'+icons.join(', '));console.log('HUD symbols ready');})();
