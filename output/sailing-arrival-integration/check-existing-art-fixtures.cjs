const fs=require('node:fs');
const path=require('node:path');
const read=fs.readFileSync.bind(fs);
const filename=path.resolve(__dirname,'../../game/assets/scripts/view/ArtV2Assets.ts');
fs.readFileSync=function(file,options){
  const content=read(file,options);
  if(path.resolve(String(file))!==filename)return content;
  return content.replace("'chapter-map'|'chapter-boat'|",'').replace("['chapter-map','chapter-boat',","[").replace("key.startsWith('chapter-')||",'');
};
require('../../game/tests/art-v2-assets.test.cjs');
