/** Original, editable vector masks. No downloaded art or previous raster input. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const HERE=__dirname;
const RADII=[10,14,18,21,22,24], PARTS=['fill','border','highlight'];
const FRAME=128,CELL=144,PAD=8,WIDTH=512,HEIGHT=1024;
const write=(name,text)=>fs.writeFileSync(path.join(HERE,name),text);
const svg=(w,h,inner)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>\n`;
const json=(name,obj)=>write(name,JSON.stringify(obj,null,2)+'\n');
function shape(radius,part,colour='#ffffff'){
  // Logical source is 64x64; fill bounds (2,2)-(62,62), with 2px overscan.
  // Outer 2px stroke extends 1px beyond fill, leaving 1px transparent margin.
  if(part==='fill')return `<rect x="4" y="4" width="120" height="120" rx="${radius*2}" fill="${colour}"/>`;
  if(part==='border')return `<rect x="4" y="4" width="120" height="120" rx="${radius*2}" fill="none" stroke="${colour}" stroke-width="4"/>`;
  return `<rect x="14" y="14" width="100" height="100" rx="${Math.max(2,radius-5)*2}" fill="none" stroke="${colour}" stroke-width="2"/>`;
}
fs.mkdirSync(path.join(HERE,'svg'),{recursive:true});
const frames=[];
for(let row=0;row<RADII.length;row++)for(let col=0;col<PARTS.length;col++){
  const radius=RADII[row],part=PARTS[col],id=`r${radius}-${part}`;
  write(`svg/${id}.svg`,svg(FRAME,FRAME,shape(radius,part)));
  frames.push({id,radius,part,source:`svg/${id}.svg`,rect:{x:col*CELL+PAD,y:row*CELL+PAD,width:FRAME,height:FRAME},originalSize:{width:FRAME,height:FRAME},pivot:{x:.5,y:.5},offset:{x:0,y:0},rotated:false,insets:{left:2*(radius+2),right:2*(radius+2),top:2*(radius+2),bottom:2*(radius+2)}});
}
write('panels-atlas.svg',svg(WIDTH,HEIGHT,frames.map(f=>`<g transform="translate(${f.rect.x} ${f.rect.y})">${shape(f.radius,f.part)}</g>`).join('')));
json('layout.json',{schemaVersion:1,image:'panels-atlas.png',width:WIDTH,height:HEIGHT,format:'RGBA8',coordinateOrigin:'top-left',runtimeScale:.5,logicalFrameSize:64,logicalOverscanPerSide:2,sourcePixelRatio:2,atlasCellPadding:PAD,estimatedGfxTextureBytes:WIDTH*HEIGHT*4,
  defaultPalette:{shadow:{hex:'#132D30',alpha:90,offset:{x:3,y:-5},framePart:'fill'},fill:{hex:'#203D3F',alpha:244},border:{hex:'#B4874D',alpha:255},highlight:{hex:'#FFF2CF',alpha:65}},
  nodeSizing:'Existing interactive parent keeps w,h. Each decorative child is 2*(w+4) by 2*(h+4), local scale(.5,.5,1), anchor(.5,.5). All non-shadow children at (0,0); shadow at (3,-5).',
  drawOrder:['shadow/reused fill','fill','border','highlight'],frames});

// Preview these exact SVG mask geometries with the same nine regions as SLICED.
// These previews are offline vector simulations, not screenshots from Cocos.
let serial=0;
function nine(radius,part,w,h,colour,alpha=1){
  const id=`piece${serial++}`,s=2*(radius+2),src=[0,s,128-s,128],dstX=[0,s/2,w+4-s/2,w+4],dstY=[0,s/2,h+4-s/2,h+4];
  let out=`<defs><g id="${id}">${shape(radius,part,colour)}</g></defs><g opacity="${alpha}">`;
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const dw=dstX[x+1]-dstX[x],dh=dstY[y+1]-dstY[y];if(dw<=0||dh<=0)continue;
    out+=`<svg x="${dstX[x]-2}" y="${dstY[y]-2}" width="${dw}" height="${dh}" viewBox="${src[x]} ${src[y]} ${src[x+1]-src[x]} ${src[y+1]-src[y]}" preserveAspectRatio="none" overflow="hidden"><use xlink:href="#${id}"/></svg>`;
  }
  return out+'</g>';
}
function panel(x,y,w,h,r,fill='#203D3F',alpha=244/255){
  return `<g transform="translate(${x} ${y})"><g transform="translate(3 5)">${nine(r,'fill',w,h,'#132D30',90/255)}</g>${nine(r,'fill',w,h,fill,alpha)}${nine(r,'border',w,h,'#B4874D')}${nine(r,'highlight',w,h,'#FFF2CF',65/255)}</g>`;
}
function oldPanel(x,y,w,h,r,fill='#203D3F',alpha=244/255){
  return `<g transform="translate(${x} ${y})"><rect x="3" y="5" width="${w}" height="${h}" rx="${r}" fill="#132D30" opacity="${90/255}"/><rect width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${alpha}"/><rect width="${w}" height="${h}" rx="${r}" fill="none" stroke="#B4874D" stroke-width="2"/><rect x="5" y="5" width="${w-10}" height="${h-10}" rx="${Math.max(2,r-5)}" fill="none" stroke="#FFF2CF" stroke-opacity="${65/255}" stroke-width="1"/></g>`;
}
const text=(s,x,y,size=18,colour='#FFF2CF',anchor='start')=>`<text x="${x}" y="${y}" fill="${colour}" font-family="Microsoft YaHei,Arial,sans-serif" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
const bg=(w,h)=>`<rect width="${w}" height="${h}" fill="#668779"/><path d="M0 ${h*.4} Q${w*.4} ${h*.15} ${w} ${h*.65} L${w} ${h} H0Z" fill="#759381"/>`;
let original=bg(1280,1140)+text('原创九宫格面板 · 按实际 UI 尺寸显示',44,40,24);
original+=panel(110,84,1060,596,24)+text('1060 × 596 / 圆角24',640,127,28,'#FFF2CF','middle');
original+=panel(151,170,482,359,18,'#35544E',1)+text('482 × 359 / 圆角18',392,220,22,'#FFF2CF','middle');
original+=panel(665,170,221,139,24,'#3D5E56')+text('221 × 139',775,244,21,'#FFF2CF','middle');
original+=panel(908,170,184,306,24,'#45685D')+text('184 × 306',1000,330,18,'#FFF2CF','middle');
original+=panel(684,366,246,56,22,'#EDB951',1)+text('主要按钮 246 × 56',807,402,18,'#293F3E','middle');
original+=panel(684,452,210,36,18,'#47645C',1)+text('小按钮 210 × 36',789,476,16,'#FFF2CF','middle');
original+=panel(409,590,144,34,10,'#436F79',1)+text('技能牌 144 × 34',481,613,14,'#AFE5ED','middle');
original+=panel(110,737,300,154,24,'#395750')+text('普通卡片',260,824,23,'#FFF2CF','middle');
original+=panel(445,737,300,154,24,'#3C504D')+text('锁定卡片',595,824,23,'#8CA6A0','middle');
original+=panel(780,737,300,154,24,'#397D73')+text('选中卡片',930,824,23,'#FFF2CF','middle');
original+=text('白色透明填充 + 外金线 + 内奶油细线，共用一张图集；阴影复用填充。',110,951,20);
original+=text('这里保留了原布局用色。此图是实际九块切分的离线 SVG 预览，不是 Cocos 运行截图。',110,991,18);
write('review-original-size.svg',svg(1280,1140,original));

// Fractionally scaled nested SVG viewports create clip antialias hairlines that
// a shared-vertex Sprite mesh does not have. Use the mathematically equivalent
// continuous rounded contours for this readability sheet, and label the scope.
let small=bg(1100,620)+text('手机等效轮廓检查 · 左 0.67 倍 / 右 0.50 倍',28,38,23);
for(const [s,x] of [[.67,30],[.5,660]]){
  let bits=oldPanel(0,0,482,359,18,'#35544E',1)+text('数值比较',241,47,22,'#FFF2CF','middle');
  bits+=text('攻击 238    生命 1260',241,104,18,'#EAD4A4','middle');
  bits+=text('防御 164    成长 1.23',241,143,18,'#EAD4A4','middle');
  bits+=oldPanel(112,200,246,56,22,'#EDB951',1)+text('确认收录',235,237,22,'#293F3E','middle');
  bits+=oldPanel(170,281,144,34,10,'#436F79',1)+text('生命强化',242,305,16,'#AFE5ED','middle');
  small+=`<g transform="translate(${x} 80) scale(${s})">${bits}</g>`;
  small+=text(`${s} × / 标签保持当前系统字体`,x,400,17);
  small+=`<g transform="translate(${x} 443) scale(${s})">${oldPanel(0,0,210,36,18,'#47645C',1)}${text('培养 100 金币',105,25,16,'#FFF2CF','middle')}${oldPanel(0,68,150,42,21,'#47645C',1)}${text('返回海岛',75,96,17,'#FFF2CF','middle')}</g>`;
}
small+=text('小图用等效连续轮廓避免 SVG 分块裁切伪接缝；实际 Cocos 纹理采样和抗锯齿待验。',28,592,15);
write('review-small.svg',svg(1100,620,small));

let comp=bg(1250,870)+text('原 Graphics 路径几何示意',40,42,24)+text('候选 SLICED 九区域示意',665,42,24);
const examples=[{w:482,h:160,r:18,fill:'#35544E',y:86},{w:246,h:56,r:22,fill:'#EDB951',y:293},{w:210,h:36,r:18,fill:'#47645C',y:405},{w:150,h:42,r:21,fill:'#47645C',y:505},{w:144,h:34,r:10,fill:'#436F79',y:612},{w:300,h:52,r:24,fill:'#203D3F',y:711}];
for(const e of examples){comp+=oldPanel(40,e.y,e.w,e.h,e.r,e.fill,1)+panel(665,e.y,e.w,e.h,e.r,e.fill,1);comp+=text(`${e.w}×${e.h}  r${e.r}`,40,e.y+e.h+28,16)+text(`${e.w}×${e.h}  r${e.r}`,665,e.y+e.h+28,16);}
comp+=text('左侧只是现有函数的等价 SVG 路径；最终抗锯齿、合批和 Buffer 必须在 Cocos 实测。',40,846,16);
write('review-comparison.svg',svg(1250,870,comp));
console.log(JSON.stringify({frames:frames.length,radii:RADII,atlas:{width:WIDTH,height:HEIGHT},source:'authored SVG masks',runtimeFilesWritten:false}));
