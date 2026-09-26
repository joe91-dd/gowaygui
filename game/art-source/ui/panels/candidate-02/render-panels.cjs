/** Render only newly authored vectors using the project's existing sharp/librsvg. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sharp=require(require.resolve('sharp',{paths:[process.env.GOWAYGUI_NODE_MODULES||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',__dirname]}));
sharp.concurrency(2);
const HERE=__dirname,read=n=>fs.readFileSync(path.join(HERE,n)),write=(n,b)=>fs.writeFileSync(path.join(HERE,n),b),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const layout=JSON.parse(read('layout.json'));
async function render(name){const bytes=await sharp(read(name+'.svg')).png().toBuffer();write(name+'.png',bytes);return bytes;}
async function main(){
  fs.mkdirSync(path.join(HERE,'png'),{recursive:true});
  const checks=[];
  const atlas=await render('panels-atlas'),raw=await sharp(atlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(raw.info.width,layout.width);assert.equal(raw.info.height,layout.height);assert.equal(raw.info.channels,4);
  let nonWhite=0,nonzeroGutter=0;
  for(let y=0;y<layout.height;y++)for(let x=0;x<layout.width;x++){
    const i=(y*layout.width+x)*4,a=raw.data[i+3];if(!a)continue;
    if(raw.data[i]!==255||raw.data[i+1]!==255||raw.data[i+2]!==255)nonWhite++;
    if(!layout.frames.some(f=>x>=f.rect.x&&x<f.rect.x+128&&y>=f.rect.y&&y<f.rect.y+128))nonzeroGutter++;
  }
  assert.equal(nonWhite,0,'Tint masks must have white RGB wherever alpha is nonzero');assert.equal(nonzeroGutter,0,'Atlas padding must stay transparent');
  for(const f of layout.frames){
    const bytes=await sharp(read(f.source)).png().toBuffer();write('png/'+f.id+'.png',bytes);
    const own=await sharp(bytes).ensureAlpha().raw().toBuffer(),rect=f.rect;let mismatch=0,edgeAlpha=0,semi=0,opaque=0;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const a=own[(y*128+x)*4+3];if(a===255)opaque++;else if(a>0)semi++;
      if((x===0||y===0||x===127||y===127)&&a)edgeAlpha++;
      const ai=((y+rect.y)*layout.width+x+rect.x)*4,oi=(y*128+x)*4;
      for(let c=0;c<4;c++)if(own[oi+c]!==raw.data[ai+c])mismatch++;
    }
    assert.equal(mismatch,0,f.id+' atlas tile differs from editable SVG render');assert.equal(edgeAlpha,0,f.id+' must retain transparent frame edge');assert.ok(opaque>0&&semi>0,f.id+' must contain both solid and antialiased pixels');
    checks.push({id:f.id,atlasPixelMismatch:mismatch,frameEdgeAlphaPixels:edgeAlpha,opaquePixels:opaque,antialiasedPixels:semi,sha256:sha(bytes)});
  }
  const previews=[];
  for(const name of ['review-original-size','review-small','review-comparison','review-compact']){const bytes=await render(name),m=await sharp(bytes).metadata();previews.push({path:name+'.png',width:m.width,height:m.height,sha256:sha(bytes)});}
  const files=['make-panels.cjs','render-panels.cjs','layout.json','panels-atlas.svg','panels-atlas.png',...layout.frames.map(f=>f.source),...previews.flatMap(p=>[p.path.replace('.png','.svg'),p.path])].map(p=>({path:p,bytes:read(p).length,sha256:sha(read(p))}));
  const report={status:'technical-vector-and-pixel-checks-passed-awaiting-visual-review',renderer:'sharp '+sharp.versions.sharp,svgBackend:'librsvg '+sharp.versions.rsvg,concurrency:2,originalSource:'All masks are original SVG geometry derived from this project IslandUI.panel shape, not from external pictures.',externalArt:[],existingRasterInputs:[],runtimeFilesWritten:false,atlas:{width:layout.width,height:layout.height,rgbaBytes:layout.width*layout.height*4,nonWhitePixels:nonWhite,nonzeroGutterPixels:nonzeroGutter,sha256:sha(atlas)},checks,previews,files};
  write('inspection.json',JSON.stringify(report,null,2)+'\n');
  write('review.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>九宫格面板候选</title><style>body{margin:24px;background:#203d3f;color:#fff2cf;font:16px Microsoft YaHei,sans-serif}img{display:block;max-width:100%;height:auto;margin:16px 0 28px}a{color:#ead4a4}.mask{background:repeating-conic-gradient(#4b6159 0 25%,#668779 0 50%) 0/20px 20px;width:256px}</style><h1>九宫格面板 c02</h1><p>全部来自本项目原创 SVG。技术检查通过；这不是 Cocos 实际截图。点击图可按原始像素打开。</p>${previews.map(p=>`<p>${p.path} · ${p.width}×${p.height}</p><a href="${p.path}"><img src="${p.path}" alt="面板尺寸与样式检查"></a>`).join('')}<p>白色 alpha 共用 atlas，显示为原图 1/2 尺寸。</p><img class="mask" src="panels-atlas.png" alt="30个面板透明蒙版"></html>`);
  console.log(JSON.stringify({checks:checks.length,atlas:report.atlas,previews:previews.map(p=>p.path),runtimeFilesWritten:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
