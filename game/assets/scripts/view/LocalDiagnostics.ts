import {Director, director, game, Node} from 'cc';
import {DEBUG} from 'cc/env';

export interface DiagnosticsContext { readonly screen:string; readonly levelId?:number; readonly wave?:number }
interface HeapEstimate { usedJSHeapSize:number; totalJSHeapSize:number; jsHeapSizeLimit:number }
interface FrameSummary { frames:number; averageFrameMs:number|null; p95FrameMs:number|null; maxFrameMs:number|null; over33Ms:number; over50Ms:number }
interface TimelineEntry extends FrameSummary { atMs:number; context:DiagnosticsContext; heap:HeapEstimate|null }

/** A sparse 0.1 ms histogram keeps whole-session percentiles without retaining every frame. */
class Frames {
  count=0; total=0; max=0; over33=0; over50=0;
  private bins=new Map<number,number>();
  add(ms:number):void{this.count++;this.total+=ms;this.max=Math.max(this.max,ms);if(ms>33.3333)this.over33++;if(ms>50)this.over50++;const bin=Math.ceil(ms*10);this.bins.set(bin,(this.bins.get(bin)||0)+1);}
  summary():FrameSummary{
    let p95:number|null=null,seen=0;const rank=Math.ceil(this.count*.95);
    for(const [bin,count] of Array.from(this.bins.entries()).sort((a,b)=>a[0]-b[0])){seen+=count;if(seen>=rank){p95=bin/10;break;}}
    return {frames:this.count,averageFrameMs:this.count?this.total/this.count:null,p95FrameMs:p95,maxFrameMs:this.count?this.max:null,over33Ms:this.over33,over50Ms:this.over50};
  }
}

/** No side effects unless a debug build is opened locally with the exact query parameter qa=1. */
export function localDiagnosticsEnabled():boolean{
  if(!DEBUG||typeof window==='undefined'||typeof document==='undefined'||typeof performance==='undefined')return false;
  const {hostname,protocol,search}=window.location;
  const local=protocol==='file:'||hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]'||hostname==='::1';
  return local&&new URLSearchParams(search).get('qa')==='1';
}

/** Development-only observer. Never imports rules, storage, clocks, or internal game controls. */
export class LocalDiagnostics {
  readonly enabled:boolean;
  private destroyed=false;
  private startedAt=0;
  private startedISO='';
  private readyAt:number|null=null;
  private previousFrame:number|null=null;
  private hiddenAt:number|null=null;
  private hiddenMs=0;
  private lastSample=0;
  private readonly frames=new Frames();
  private readonly cocosFrames=new Frames();
  private interval=new Frames();
  private timeline:TimelineEntry[]=[];
  private droppedTimelineEntries=0;
  private context:DiagnosticsContext={screen:'loading'};
  private panel?:HTMLDivElement;
  private status?:HTMLDivElement;
  private downloadLink?:HTMLAnchorElement;
  private screenshotButton?:HTMLButtonElement;
  private screenshotPending=false;
  private drawCallback?:()=>void;
  private screenshotTimeout?:number;
  private urls=new Map<string,number>();

  constructor(private readonly owner:Node){
    this.enabled=localDiagnosticsEnabled();if(!this.enabled)return;
    this.startedAt=performance.now();this.lastSample=this.startedAt;this.startedISO=new Date().toISOString();
    if(document.hidden)this.hiddenAt=this.startedAt;
    document.addEventListener('visibilitychange',this.visibilityChanged);
    owner.once(Node.EventType.NODE_DESTROYED,this.destroy,this);
    this.createPanel();
  }

  /** Call once per GameEntry.update; context must contain only these small, read-only primitives. */
  recordFrame(dt:number,context:DiagnosticsContext):void{
    if(!this.enabled||this.destroyed)return;
    this.context={screen:String(context.screen).slice(0,80),levelId:context.levelId,wave:context.wave};
    const now=performance.now();
    if(document.hidden){this.previousFrame=null;return;}
    if(this.previousFrame!==null){
      const elapsed=now-this.previousFrame;
      if(Number.isFinite(elapsed)&&elapsed>0){this.frames.add(elapsed);this.interval.add(elapsed);}
      if(Number.isFinite(dt)&&dt>0)this.cocosFrames.add(dt*1000);
    }
    this.previousFrame=now;
    if(now-this.lastSample>=1000){this.sample(now);this.lastSample=now;}
  }

  /** Mark the first actually operable UI; repeated calls do not overwrite its original timestamp. */
  markReady():void{if(this.enabled&&!this.destroyed&&this.readyAt===null)this.readyAt=performance.now();}

  private readonly visibilityChanged=():void=>{
    const now=performance.now();this.previousFrame=null;
    if(document.hidden){if(this.hiddenAt===null)this.hiddenAt=now;}
    else if(this.hiddenAt!==null){this.hiddenMs+=now-this.hiddenAt;this.hiddenAt=null;}
  };

  private heap():HeapEstimate|null{
    const memory=(performance as Performance&{memory?:HeapEstimate}).memory;
    if(!memory||![memory.usedJSHeapSize,memory.totalJSHeapSize,memory.jsHeapSizeLimit].every(n=>Number.isFinite(n)&&n>=0))return null;
    return {usedJSHeapSize:memory.usedJSHeapSize,totalJSHeapSize:memory.totalJSHeapSize,jsHeapSizeLimit:memory.jsHeapSizeLimit};
  }

  private graphics():Record<string,unknown>|null{
    try{
      const canvas=game.canvas,gl=canvas&&(canvas.getContext('webgl2')||canvas.getContext('webgl'));
      if(!gl)return null;
      const detail=gl.getExtension('WEBGL_debug_renderer_info');
      return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:detail?gl.getParameter(detail.UNMASKED_RENDERER_WEBGL):null,antialias:gl.getContextAttributes()?.antialias??null,contextLost:gl.isContextLost()};
    }catch{return null;}
  }

  private sample(now:number):void{
    const summary=this.interval.summary();this.timeline.push({atMs:now-this.startedAt,context:{...this.context},...summary,heap:this.heap()});this.interval=new Frames();
    if(this.status&&summary.averageFrameMs&&!this.screenshotPending)this.status.textContent=this.context.screen+' · '+(1000/summary.averageFrameMs).toFixed(1)+' FPS · P95 '+(summary.p95FrameMs??0).toFixed(0)+' ms';
    if(this.timeline.length>3600){this.timeline.shift();this.droppedTimelineEntries++;}
  }

  /** Report has no save contents, account IDs, query string, or game mutation hooks. */
  report():Record<string,unknown>|null{
    if(!this.enabled||this.destroyed)return null;
    const now=performance.now(),hidden=this.hiddenMs+(this.hiddenAt===null?0:now-this.hiddenAt),canvas=game.canvas;
    return {
      schema:'gowaygui-local-qa-v1',startedAt:this.startedISO,exportedAt:new Date().toISOString(),
      durationMs:now-this.startedAt,foregroundDurationMs:Math.max(0,now-this.startedAt-hidden),hiddenDurationMs:hidden,
      navigationToReadyMs:this.readyAt,diagnosticsToReadyMs:this.readyAt===null?null:this.readyAt-this.startedAt,
      frameTiming:{source:'performance.now intervals between actual Cocos update callbacks; hidden and first resumed intervals excluded',p95ResolutionMs:.1,p95Rounding:'upper bucket boundary, error below 0.1 ms',sampledDurationMs:this.frames.total,...this.frames.summary()},
      cocosDeltaTiming:{source:'unmodified dt supplied by Cocos; engine may clamp it',...this.cocosFrames.summary()},
      heap:this.heap(),heapMeaning:'Optional non-standard Chromium JS heap estimate; not game/GPU/total process memory; unavailable is null',
      requestedFrameRate:typeof game.frameRate==='number'?game.frameRate:null,graphics:this.graphics(),
      context:{...this.context},canvas:canvas?{width:canvas.width,height:canvas.height}:null,
      environment:{userAgent:navigator.userAgent,devicePixelRatio:window.devicePixelRatio,viewport:{width:window.innerWidth,height:window.innerHeight}},
      timeline:this.timeline.slice(),timelineRetention:{maximumEntries:3600,droppedEntries:this.droppedTimelineEntries},
      currentInterval:{atMs:now-this.startedAt,context:{...this.context},...this.interval.summary()},
      limitations:['Read-only instrumentation has a small cost. PNG encoding/export may affect adjacent frame samples.','Download requests do not prove that a browser saved a file.','Loading-to-ready ends at the caller markReady; it is not inferred from a screenshot.'],
    };
  }

  private createPanel():void{
    const panel=document.createElement('div');panel.dataset.gowayguiQa='1';
    panel.style.cssText='position:fixed;left:max(6px,env(safe-area-inset-left));bottom:max(6px,env(safe-area-inset-bottom));z-index:2147483647;color:#fff2cf;font:12px/1.4 sans-serif;pointer-events:none;';
    panel.setAttribute('aria-label','本地验收工具');
    const actions=document.createElement('div');actions.id='gowaygui-qa-actions';actions.hidden=true;
    actions.style.cssText='display:none;position:absolute;left:0;bottom:calc(100% + 6px);width:258px;max-width:calc(100vw - 24px);padding:6px;border:1px solid #739b96;border-radius:8px;background:rgba(20,42,43,.95);pointer-events:auto;';
    actions.setAttribute('role','group');actions.setAttribute('aria-label','验收导出操作');
    const button=(name:string,action:()=>void,parent:HTMLElement=actions):HTMLButtonElement=>{
      const element=document.createElement('button');element.type='button';element.textContent=name;
      element.style.cssText='cursor:pointer;border:1px solid #99bcb2;border-radius:5px;padding:7px;margin:2px;background:#345b55;color:#fff2cf;font:12px sans-serif;';
      element.addEventListener('click',event=>{event.stopPropagation();action();});parent.appendChild(element);return element;
    };
    const toggle=button('验收',()=>{
      actions.hidden=!actions.hidden;actions.style.display=actions.hidden?'none':'block';
      toggle.textContent=actions.hidden?'验收':'收起';toggle.setAttribute('aria-expanded',String(!actions.hidden));
    },panel);
    toggle.style.cssText='cursor:pointer;pointer-events:auto;width:44px;height:30px;padding:3px;border:1px solid #739b96;border-radius:6px;background:rgba(20,42,43,.82);color:#fff2cf;font:12px sans-serif;';
    toggle.setAttribute('aria-controls',actions.id);toggle.setAttribute('aria-expanded','false');panel.appendChild(actions);
    this.screenshotButton=button('保存当前截图',()=>this.saveScreenshot());button('导出性能记录',()=>this.exportPerformance());
    for(const event of ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup'])panel.addEventListener(event,e=>e.stopPropagation());
    this.status=document.createElement('div');this.status.setAttribute('role','status');actions.appendChild(this.status);
    this.downloadLink=document.createElement('a');this.downloadLink.style.cssText='display:none;color:#ffe49a;padding:4px;';actions.appendChild(this.downloadLink);
    document.body.appendChild(panel);this.panel=panel;
  }

  private message(text:string):void{if(this.status)this.status.textContent=text;}
  private filename(extension:'png'|'json'):string{return `gowaygui-qa-${new Date().toISOString().replace(/[-:]/g,'').replace('T','-').replace('Z','').replace('.','-')}.${extension}`;}

  exportPerformance():void{
    if(!this.enabled||this.destroyed)return;
    try{this.download(new Blob([JSON.stringify(this.report(),null,2)],{type:'application/json;charset=utf-8'}),this.filename('json'));}
    catch(error){this.message(`导出失败：${String(error)}`);}
  }

  saveScreenshot():void{
    if(!this.enabled||this.destroyed||this.screenshotPending)return;
    this.screenshotPending=true;if(this.screenshotButton)this.screenshotButton.disabled=true;this.message('正在等待下一帧画面…');
    this.drawCallback=()=>{
      this.removeDrawWait();
      try{
        const source=game.canvas;if(!source||!source.width||!source.height)throw new Error('游戏画布尚未就绪');
        const gl=source.getContext('webgl2')||source.getContext('webgl');if(gl&&gl.isContextLost())throw new Error('图形上下文暂时丢失');
        const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
        const context=copy.getContext('2d');if(!context)throw new Error('浏览器不支持截图画布');
        // This copy MUST stay synchronous inside AFTER_DRAW, before WebGL yields to the browser.
        // preserveDrawingBuffer=false can discard the source after this rendering task returns.
        context.drawImage(source,0,0);
        copy.toBlob(blob=>{
          copy.width=0;copy.height=0;
          if(this.destroyed)return;
          this.finishScreenshot();
          try{if(!blob)throw new Error('浏览器未能生成 PNG');this.download(blob,this.filename('png'));}
          catch(error){this.message(`截图失败：${String(error)}`);}
        },'image/png');
      }catch(error){this.finishScreenshot();this.message(`截图失败：${String(error)}`);}
    };
    director.once(Director.EVENT_AFTER_DRAW,this.drawCallback);
    this.screenshotTimeout=window.setTimeout(()=>{this.removeDrawWait();this.finishScreenshot();this.message('尚未收到绘制帧，请返回游戏前台后重试。');},5000);
  }

  private finishScreenshot():void{this.screenshotPending=false;if(this.screenshotButton)this.screenshotButton.disabled=false;}
  private removeDrawWait():void{
    if(this.drawCallback){director.off(Director.EVENT_AFTER_DRAW,this.drawCallback);this.drawCallback=undefined;}
    if(this.screenshotTimeout!==undefined){window.clearTimeout(this.screenshotTimeout);this.screenshotTimeout=undefined;}
  }

  private download(blob:Blob,filename:string):void{
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    if(this.downloadLink){this.downloadLink.href=url;this.downloadLink.download=filename;this.downloadLink.textContent='未出现下载？点此保存';this.downloadLink.style.display='block';}
    this.message('已向浏览器请求保存。备用链接保留 60 秒。');
    const timer=window.setTimeout(()=>{URL.revokeObjectURL(url);this.urls.delete(url);if(this.downloadLink?.href===url)this.downloadLink.style.display='none';},60000);
    this.urls.set(url,timer);
  }

  destroy():void{
    if(this.destroyed)return;this.destroyed=true;if(!this.enabled)return;
    this.removeDrawWait();document.removeEventListener('visibilitychange',this.visibilityChanged);this.owner.off(Node.EventType.NODE_DESTROYED,this.destroy,this);
    for(const [url,timer] of Array.from(this.urls.entries())){window.clearTimeout(timer);URL.revokeObjectURL(url);}this.urls.clear();
    this.panel?.remove();this.panel=undefined;this.status=undefined;this.downloadLink=undefined;this.screenshotButton=undefined;this.timeline=[];
  }
}
