from pathlib import Path
import json,shutil,re
R=Path(__file__).resolve().parent;ROOT=R.parents[1]
p=json.loads((R/'plan.json').read_text('utf8'))
names=json.loads(re.search(r'=\s*(\[[\s\S]*?\]);',(ROOT/'game/assets/scripts/core/faunaCatalog.ts').read_text('utf8')).group(1))
for i,r in enumerate(p['fauna']):r['displayName']=names[i]['name']
boss_names=json.loads((R/'boss-names.json').read_text('utf8'))
for i,r in enumerate(p['bosses']):r['name']=boss_names[i]
for r in [*p['fauna'],*p['bosses'],*p['world']]:
 mfile=R/'production'/r['key']/'manifest.json'
 if mfile.exists():
  m=json.loads(mfile.read_text('utf8'));m['name']=r.get('displayName',r['name']);mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
(R/'plan.json').write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
dest=ROOT/'game/build/coastal-a-20260916/fauna-review';dest.mkdir(parents=True,exist_ok=True)
s=(R.parent/'boss-refine-20260916/review.html').read_text('utf8')
s=s.replace('首领精修 · 海岛生灵 · 怪物与首领预览','海雾灵焰 A · 全怪物模型预览').replace('/ 三维造型与动作','/ 海雾灵焰 A')
s=s.replace('background:#f4f5ee','background:#F8F5E9').replace('#fcfdf6,#e1eeea 75%','#FFF9E9,#DDF0EF 75%')
s=s.replace('.card img{','.card{box-shadow:0 3px 12px #315B5B08}.card img{')
s=s.replace('<div class="controls">','<div style="position:absolute;right:20px;top:75px;width:150px"><select id="aura" aria-label="妖气强度"><option value="auto">妖气 · 当前强度</option value="0">绿色 · 翠潮</option><option value="1">蓝色 · 碧焰</option><option value="2">黄色 · 曜黄</option><option value="3">红色 · 赤潮</option><option value="4">金色 · 鎏金</option><option value="off">关闭妖气对照</option></select></div><div class="controls">')
s=s.replace('let current,model,mixer,clips=', 'let auraMesh,auraMat;let current,model,mixer,clips=')
code=r'''
const auraPalette=[['#42BFA6','#CFFFE5'],['#42B6E7','#DDFBFF'],['#E8D254','#FFF9C8'],['#E8664E','#FFE9CD'],['#E8AD49','#FFF5D6']];
function addAura(height){
 if(auraMesh){scene.remove(auraMesh);auraMesh.geometry.dispose();auraMat.dispose();}
 const positions=[],uvs=[],indices=[],count=current.group==='fauna'?3:5;
 for(let j=0;j<count;j++)for(let i=0;i<=18;i++){
  const t=i/18,a=j/count*Math.PI*2+t*1.7,r=.88+.28*Math.sin(t*Math.PI),h=t*(.86+(j%3)*.10),w=.19*Math.pow(Math.sin(t*Math.PI),.65);
  for(const side of [-1,1]){const rr=r+side*w;positions.push(Math.cos(a)*rr,h+side*w*.65,Math.sin(a)*rr);uvs.push(t,(side+1)/2);}
  if(i){const k=(j*19+i)*2;indices.push(k-2,k,k-1,k-1,k,k+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
 auraMat=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},tint:{value:new THREE.Color()},crest:{value:new THREE.Color()}},
 vertexShader:`varying vec2 vuv;uniform float time;void main(){vuv=uv;vec3 p=position;p.x+=sin(time*1.55+uv.x*5.)*.042*uv.x;p.z+=cos(time*1.3+uv.x*4.)*.045*uv.x;p.y*=.9+.1*sin(time*1.6);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec2 vuv;uniform float time;uniform vec3 tint;uniform vec3 crest;void main(){float across=max(0.,1.-abs(vuv.y*2.-1.));float ends=pow(max(0.,sin(vuv.x*3.14159265)),.48);float sweep=pow(.5+.5*sin(vuv.x*11.-time*2.8),5.);float edge=exp(-((vuv.y-.22)*17.)*((vuv.y-.22)*17.));float alpha=pow(across,.65)*ends*(.22+.23*sweep+.58*edge)*.76;gl_FragColor=vec4(mix(tint,crest,min(.94,edge*.88+sweep*.42)),alpha);}`});
 auraMesh=new THREE.Mesh(geo,auraMat);auraMesh.position.y=.022;auraMesh.scale.set(height*.58,height*.64,height*.58);scene.add(auraMesh);setAura();
}
function setAura(){if(!auraMesh)return;const v=document.querySelector('#aura').value;auraMesh.visible=v!=='off';const grade=v==='auto'||v==='off'?current.grade:Number(v),c=auraPalette[grade];auraMat.uniforms.tint.value.set(c[0]);auraMat.uniforms.crest.value.set(c[1]);}
document.querySelector('#aura').onchange=setAura;
'''
s=s.replace('function dispose(object)',code+'\nfunction dispose(object)')
s=s.replace('controls.update();renderer.render(scene,camera);status.textContent=', 'controls.update();addAura(size.y);renderer.render(scene,camera);status.textContent=')
s=s.replace("mixer?.update(dt);controls.update();renderer.render", "mixer?.update(dt);if(auraMat)auraMat.uniforms.time.value+=dt;controls.update();renderer.render")
s=s.replace("choose(all.find(x=>x.group==='world')??all[0])","choose(all.find(x=>x.key==='world-4')??all[0])")
(R/'review.html').write_text(s,encoding='utf8');(dest/'index.html').write_text(s,encoding='utf8')
shutil.copytree(ROOT/'output/aholo-pro-cast-20260915/review/vendor/three',dest/'vendor/three',dirs_exist_ok=True)
records=[*[dict(r,group='fauna',name=r['displayName'],category='海岛生灵',grade=1 if r['kind']=='elite' else 0) for r in p['fauna']],*[dict(r,group='boss',category=['绿色','蓝色','紫色','黄色','红色','金色'][r['tier']]+'首领',grade=[0,1,1,2,3,4][r['tier']]) for r in p['bosses']],*[dict(r,group='world',category='世界首领',grade=4) for r in p['world']]]
catalog=[]
for r in records:
 src=R/'production'/r['key']
 if not (src/'manifest.json').exists():continue
 m=json.loads((src/'manifest.json').read_text('utf8'))
 for folder,file,out in [('models',r['key']+'.glb',r['key']+'.glb'),('portraits','portrait.png',r['key']+'.png')]:
  (dest/folder).mkdir(exist_ok=True);shutil.copy2(src/file,dest/folder/out)
 catalog.append({k:r[k] for k in ['key','name','group','category','grade']}|{'triangles':m['triangles'],'materials':m['drawMaterials']})
(dest/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
print('Review models:',len(catalog))
