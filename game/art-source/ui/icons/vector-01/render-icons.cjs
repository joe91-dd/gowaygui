/** Render the newly authored SVG sources. Does not read any previous raster candidate. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require(require.resolve('sharp', { paths: [process.env.GOWAYGUI_NODE_MODULES || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', __dirname] }));
const root = __dirname;
const icons = JSON.parse(fs.readFileSync(path.join(root,'icon-list.json'),'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const inner = s => s.replace(/<\?xml[^?]*\?>\s*/,'').replace(/<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const write = (name,text) => fs.writeFileSync(path.join(root,name),text);
const labels = ['Gold','Stamina','Attack','Health','Defense','Growth','Lock','History'];
async function main(){
  fs.mkdirSync(path.join(root,'png'),{recursive:true});
  const source = icons.map(i => fs.readFileSync(path.join(root,i.id+'.svg'),'utf8'));
  const layout = {schemaVersion:1,image:'icons-atlas.png',imageWidth:1024,imageHeight:512,coordinateOrigin:'top-left',columns:4,rows:2,cellWidth:256,cellHeight:256,padding:24,cells:icons.map((i,index)=>({...i,row:Math.floor(index/4),column:index%4,spriteRect:{x:index%4*256,y:Math.floor(index/4)*256,width:256,height:256},originalSize:{width:256,height:256},offset:{x:0,y:0},pivot:{x:0.5,y:0.5},rotated:false}))};
  const report = {renderer:'sharp '+sharp.versions.sharp,svgBackend:'librsvg '+sharp.versions.rsvg,source:'new authored SVG files only',pixelImagesReadAsInput:[],checks:[],files:[]};
  for(let k=0;k<icons.length;k++){
    const id=icons[k].id;
    const png=await sharp(Buffer.from(source[k])).png().toBuffer();
    write('png/'+id+'.png',png);
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let transparent=0,opaque=0,semi=0,outside=0,x0=256,y0=256,x1=-1,y1=-1;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const a=data[(y*256+x)*info.channels+3];
      if(!a){transparent++;continue;}
      if(a===255)opaque++;else semi++;
      if(x<24||y<24||x>=232||y>=232)outside++;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    }
    const check={id,width:info.width,height:info.height,channels:info.channels,transparentPixels:transparent,opaquePixels:opaque,antialiasedPixels:semi,nonzeroOutside24pxMargin:outside,bounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},margins:{left:x0,top:y0,right:255-x1,bottom:255-y1}};
    report.checks.push(check);
    if(info.width!==256||info.height!==256||info.channels!==4||!transparent||!opaque||outside)throw new Error('Icon margin/alpha check failed: '+JSON.stringify(check));
    report.files.push({path:id+'.svg',sha256:sha(Buffer.from(source[k])),bytes:Buffer.byteLength(source[k])},{path:'png/'+id+'.png',sha256:sha(png),bytes:png.length});
  }
  const atlas=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">${source.map((s,k)=>`<g transform="translate(${k%4*256} ${Math.floor(k/4)*256})">${inner(s)}</g>`).join('')}</svg>`;
  write('icons-atlas.svg',atlas+'\n');
  const atlasPng=await sharp(Buffer.from(atlas)).png().toBuffer();
  write('icons-atlas.png',atlasPng);
  const atlasMetadata = await sharp(atlasPng).metadata();
  const atlasPixels = await sharp(atlasPng).raw().toBuffer({resolveWithObject:true});
  let atlasMarginNonzero = 0;
  for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
    const inMargin=x%256<24||x%256>=232||y%256<24||y%256>=232;
    if(inMargin&&atlasPixels.data[(y*1024+x)*4+3]!==0)atlasMarginNonzero++;
  }
  report.atlasChecks={width:atlasMetadata.width,height:atlasMetadata.height,channels:atlasMetadata.channels,hasAlpha:atlasMetadata.hasAlpha,cellMargin24NonzeroPixels:atlasMarginNonzero};
  if(atlasMetadata.width!==1024||atlasMetadata.height!==512||atlasMetadata.channels!==4||!atlasMetadata.hasAlpha||atlasMarginNonzero)throw new Error('Atlas alpha/margin verification failed');
  report.files.push({path:'icons-atlas.png',sha256:sha(atlasPng),bytes:atlasPng.length});
  const themes=[{size:64,bg:'#173f43',ink:'#f7e9ce',label:'64 px / dark teal'},{size:64,bg:'#f1e3c8',ink:'#46544c',label:'64 px / warm ivory'},{size:48,bg:'#173f43',ink:'#f7e9ce',label:'48 px / dark teal'},{size:48,bg:'#f1e3c8',ink:'#46544c',label:'48 px / warm ivory'}];
  const review=`<svg xmlns="http://www.w3.org/2000/svg" width="1088" height="640" viewBox="0 0 1088 640"><rect width="1088" height="640" fill="#384a4a"/><text x="24" y="30" font-family="Arial,sans-serif" font-size="18" fill="#fff2d8">Go Away Turtle / original vector icons / actual 64 px and 48 px</text>${themes.map((t,row)=>{const y=50+row*146;return `<rect x="16" y="${y}" width="1056" height="136" rx="10" fill="${t.bg}"/><text x="32" y="${y+24}" font-family="Arial,sans-serif" font-size="14" fill="${t.ink}">${t.label}</text>${source.map((s,k)=>`<g transform="translate(${32+k*128+(112-t.size)/2} ${y+36}) scale(${t.size/256})">${inner(s).replaceAll(/id="([^"]+)"/g,`id="$1-r${row}"`).replaceAll(/url\(#([^)]+)\)/g,`url(#$1-r${row})`)}</g><text x="${88+k*128}" y="${y+120}" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="${t.ink}">${labels[k]}</text>`).join('')}`;}).join('')}</svg>`;
  write('review-64-48.svg',review+'\n');
  write('review-64-48.png',await sharp(Buffer.from(review)).png().toBuffer());
  write('layout.json',JSON.stringify(layout,null,2)+'\n');
  write('inspection.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({renderer:report.renderer,svgBackend:report.svgBackend,checks:report.checks,atlas:report.files.at(-1)},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
