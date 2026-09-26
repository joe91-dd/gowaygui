'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../audio-review.html'),'utf8');
const data=JSON.parse(html.match(/<script id="audio-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function boot(){
 const elements=new Map();
 class Element{constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.textContent='';this.value='';this.checked=false;this.disabled=false;this.classes=new Set();this.classList={toggle:(name,enabled)=>enabled?this.classes.add(name):this.classes.delete(name)};}
  set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
  append(...children){this.children.push(...children);}setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}dispatch(type){for(const fn of this.listeners[type]??[])fn({target:this});}
 }
 for(const [,id] of html.matchAll(/id="([^"]+)"/g)){const e=new Element();e.id=id;}
 elements.get('audio-catalog').textContent=JSON.stringify(data);elements.get('music-volume').value='55';elements.get('effects-volume').value='65';
 const document=new Element(),window=new Element();document.hidden=false;document.getElementById=id=>elements.get(id);document.createElement=tag=>new Element(tag);
 const created=[];
 class Audio extends Element{constructor(){super('audio');this.paused=true;this.duration=NaN;this.currentTime=0;this.volume=1;this.src='';created.push(this);}
  play(){this.paused=false;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
  pause(){this.paused=true;}removeAttribute(name){if(name==='src')this.src='';}load(){this.loads=(this.loads??0)+1;}
 }
 const context=vm.createContext({document,window,Audio,Promise,Map,Number,String,Math,JSON});new vm.Script(source,{filename:'audio-review.html actual script'}).runInContext(context);
 const evalIn=text=>vm.runInContext(text,context);return {elements,document,window,created,eval:evalIn,click:id=>evalIn(`ui.get(${JSON.stringify(id)}).play.dispatch('click')`)};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('actual page boots with 3 music and 18 effects, zero autoplay/network/save operations',()=>{
 const b=boot();assert.equal(b.created.length,0);assert.equal(b.eval('ui.size'),21);assert.equal(data.filter(x=>x.kind==='music').length,3);assert.equal(data.filter(x=>x.kind==='effects').length,18);
 assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket)\b/);
 assert.equal(b.elements.get('music-list').children.length,3);assert.equal(b.elements.get('effects-list').children.length,4);
});
test('rapid music switching stops previous audio and stale promises/errors cannot stop the new song',async()=>{
 const b=boot();b.click('bgm_home');b.click('bgm_battle');b.click('bgm_boss');const [a,c,d]=b.created;assert.equal(a.paused,true);assert.equal(c.paused,true);assert.equal(d.paused,false);
 a.resolve();c.reject(new Error('stale abort'));d.resolve();await flush();assert.equal(b.eval('channels.music.id'),'bgm_boss');assert.equal(d.paused,false);a.dispatch('error');assert.equal(d.paused,false);assert.equal(b.created.filter(x=>!x.paused).length,1);
 b.click('bgm_boss');assert.equal(d.paused,true);assert.equal(b.eval('channels.music.id'),null);
});
test('effects replace only the previous effect; stop-all cancels both pending channels',async()=>{
 const b=boot();b.click('bgm_home');b.click('sfx_ui_confirm');b.click('sfx_skill_stone');assert.equal(b.created[0].paused,false);assert.equal(b.created[1].paused,true);assert.equal(b.created[2].paused,false);
 b.elements.get('stop-all').dispatch('click');for(const a of b.created)a.resolve();await flush();assert.ok(b.created.every(a=>a.paused&&a.src===''));assert.equal(b.eval('channels.music.id'),null);assert.equal(b.eval('channels.effects.id'),null);
});
test('music/effects volumes remain independent; join playback loops from actual duration minus five seconds',()=>{
 const b=boot();const mv=b.elements.get('music-volume'),ev=b.elements.get('effects-volume');mv.value='28';mv.dispatch('input');ev.value='74';ev.dispatch('input');b.eval('play("bgm_home",true)');b.click('sfx_heal');const [a,s]=b.created;assert.equal(a.volume,.28);assert.equal(s.volume,.74);a.duration=80;a.dispatch('loadedmetadata');assert.equal(a.currentTime,75);assert.equal(a.loop,true);
 b.eval('ui.get("bgm_home").loop.checked=false; ui.get("bgm_home").loop.dispatch("change")');assert.equal(a.loop,false);ev.value='10';ev.dispatch('input');assert.equal(a.volume,.28);assert.equal(s.volume,.1);
 b.elements.get('music-seek').value='500';b.elements.get('music-seek').dispatch('input');assert.equal(a.currentTime,40);a.dispatch('timeupdate');assert.equal(b.elements.get('music-position').textContent,'00:40 / 01:20');
});
test('background, pagehide and unload cancel pending plays and never auto-resume',async()=>{
 for(const event of ['visibilitychange','pagehide','beforeunload']){const b=boot();b.click('bgm_home');b.click('sfx_rare_reveal');if(event==='visibilitychange'){b.document.hidden=true;b.document.dispatch(event);}else b.window.dispatch(event);for(const a of b.created)a.resolve();await flush();assert.ok(b.created.every(a=>a.paused));b.document.hidden=false;b.document.dispatch('visibilitychange');assert.equal(b.created.length,2);assert.equal(b.eval('channels.music.id'),null);}
});
test('blocked or failed playback clears selection and a subsequent explicit click can recover',async()=>{
 const b=boot();b.click('bgm_home');b.created[0].reject(new Error('NotAllowedError'));await flush();assert.equal(b.eval('channels.music.id'),null);assert.match(b.elements.get('status').textContent,/未能播放/);b.click('bgm_home');b.created[1].resolve();await flush();assert.equal(b.eval('channels.music.id'),'bgm_home');assert.match(b.elements.get('status').textContent,/正在播放/);
 b.created[1].dispatch('error');assert.equal(b.eval('channels.music.id'),null);assert.equal(b.created[1].paused,true);
});
test('all relative file references resolve to exactly the 21 expected unchanged resources',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../audio-review-assets.json'),'utf8'));
 assert.equal(report.files.length,21);const base=source.match(/const AUDIO_BASE='([^']+)'/)[1];
 for(const item of data){const file=path.resolve(__dirname,'..',base,item.file);assert.equal(fs.existsSync(file),true);assert.ok(report.files.some(row=>row.file===item.file&&Math.abs(row.duration-item.duration)<1e-8));}
});
