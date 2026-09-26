const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:1100}});
 const errors=[];page.on('pageerror',err=>errors.push(String(err)));
 await page.goto('http://127.0.0.1:7462',{waitUntil:'load'});
 const ids=await page.locator('audio').evaluateAll(els=>els.map(e=>e.id));
 if(ids.length!==6)throw new Error('Expected six tracks');
 const result=[];
 for(const id of ids){
   await page.locator(`button[data-track="${id}"][data-start="30"]`).click();
   await page.waitForFunction(id=>{const a=document.getElementById(id);return !a.paused&&a.currentTime>30.1},id);
   result.push(await page.evaluate(id=>{const a=document.getElementById(id);return{id,duration:a.duration,currentTime:a.currentTime,error:a.error?.message??null,playing:[...document.querySelectorAll('audio')].filter(a=>!a.paused).length}},id));
 }
 if(result.some(r=>r.error||r.playing!==1))throw new Error('Playback/isolation failed');
 await page.locator('#stop').click();
 if(!(await page.locator('audio').evaluateAll(els=>els.every(a=>a.paused))))throw new Error('Stop failed');
 await page.screenshot({path:path.join(__dirname,'试听-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile overflow');
 await page.screenshot({path:path.join(__dirname,'试听-mobile.png'),fullPage:true});
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({sixTracksPlay:true,oneTrackAtATime:true,stopWorks:true,mobileNoOverflow:true,errors,result},null,2));
 console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
