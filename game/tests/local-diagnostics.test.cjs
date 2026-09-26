const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let ts;
for (const candidate of [process.env.GOWAYGUI_TYPESCRIPT, 'typescript', 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)) {
  try { ts = require(candidate); break; } catch {}
}
if (!ts) throw new Error('Diagnostics tests require the installed Cocos TypeScript compiler or GOWAYGUI_TYPESCRIPT');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../assets/scripts/view/LocalDiagnostics.ts'), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;

function fixture(options = {}) {
  let now = 100, nextTimer = 0, inDraw = false;
  const timers = new Map(), created = [], encodes = [], downloads = [], urls = new Map(), revoked = [], operations = [];
  class Events {
    constructor() { this.listeners = []; }
    once(event, fn, target) { this.listeners.push({event, fn, target, once: true}); }
    on(event, fn, target) { this.listeners.push({event, fn, target}); }
    off(event, fn, target) { this.listeners = this.listeners.filter(item => item.event !== event || item.fn !== fn || item.target !== target); }
    emit(event, value) {
      for (const item of this.listeners.slice().filter(item => item.event === event)) {
        if (item.once) this.off(item.event, item.fn, item.target);
        item.fn.call(item.target, value);
      }
    }
    count(event) { return this.listeners.filter(item => !event || item.event === event).length; }
    addEventListener(event, fn) { this.on(event, fn); }
    removeEventListener(event, fn) { this.off(event, fn); }
  }
  class Node extends Events { static EventType = {NODE_DESTROYED: 'node-destroyed'}; }
  class Element extends Events {
    constructor(tag) { super(); this.tagName = tag; this.dataset = {}; this.style = {}; this.children = []; this.disabled = false; this.width = 0; this.height = 0; }
    setAttribute(key, value) { this[key] = value; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; } }
    click() { if (this.disabled) return; for(let element=this;element;element=element.parent)if(element.hidden||element.style.display==='none')return; if (this.tagName === 'a') downloads.push({href: this.href, filename: this.download}); this.emit('click', {stopPropagation() {}}); }
    getContext(kind) {
      assert.equal(this.tagName, 'canvas'); assert.equal(kind, '2d');
      if (options.no2d) return null;
      return {drawImage: (source, x, y) => {
        assert.equal(source, canvas); assert.equal(x, 0); assert.equal(y, 0);
        assert.equal(inDraw, true, 'WebGL pixels must be copied inside AFTER_DRAW before the callback returns');
        operations.push('drawImage'); this.copiedFrame = source.frame;
      }};
    }
    toBlob(callback, type) { assert.equal(type, 'image/png'); operations.push('toBlob'); encodes.push({callback, canvas: this}); }
  }
  const document = new Events(); document.hidden = !!options.hidden; document.body = new Element('body');
  document.createElement = tag => { const element = new Element(tag); created.push(element); return element; };
  const window = {
    location: {hostname: 'localhost', protocol: 'http:', search: '?qa=1', ...options.location},
    devicePixelRatio: 2, innerWidth: 600, innerHeight: 900,
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, {at: now + ms, callback}); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const performance = {now: () => now};
  const canvas = {width: 600, height: 900, frame: 'first-frame', getContext(kind) {
    operations.push(kind); assert.ok(kind === 'webgl2' || kind === 'webgl');
    return {isContextLost: () => !!options.contextLost};
  }};
  const director = new Events(), owner = new Node(), module = {exports: {}};
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require(name) {
      if (name === 'cc/env') return {DEBUG: options.debug !== false};
      assert.equal(name, 'cc'); return {Director: {EVENT_AFTER_DRAW: 'after-draw'}, director, game: {canvas}, Node};
    }, document, window, performance, navigator: {userAgent: 'diagnostics-test'}, Blob, URLSearchParams,
    URL: {createObjectURL(blob) { const url = 'blob:fixture/' + (urls.size + revoked.length + 1); urls.set(url, blob); return url; }, revokeObjectURL(url) { revoked.push(url); urls.delete(url); }},
  });
  const diagnostics = new module.exports.LocalDiagnostics(owner);
  const advance = ms => {
    const target = now + ms;
    for (;;) {
      const due = Array.from(timers.entries()).filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break; now = due[1].at; timers.delete(due[0]); due[1].callback();
    }
    now = target;
  };
  return {diagnostics, document, window, performance, canvas, director, owner, timers, created, encodes, downloads, urls, revoked, operations, advance,
    frame(ms = 16, dt = .016) { advance(ms); diagnostics.recordFrame(dt, {screen: 'combat', levelId: 2, wave: 3}); },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    draw() { inDraw = true; try { director.emit('after-draw'); } finally { inDraw = false; } },
    button(name) { return created.find(element => element.tagName === 'button' && element.textContent === name); },
    finishEncoding(blob = new Blob(['pixels'], {type: 'image/png'})) { const entry = encodes.shift(); assert.ok(entry); entry.callback(blob); return entry; },
  };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('诊断默认关闭；远程来源、错误参数和非DEBUG构建没有DOM或监听副作用', () => {
  for (const options of [{location: {search: ''}}, {location: {hostname: 'example.com'}}, {location: {hostname: 'localhost.example.com'}}, {location: {search: '?qa=true'}}, {debug: false}]) {
    const f = fixture(options); assert.equal(f.diagnostics.enabled, false);
    f.diagnostics.recordFrame(.016, {screen: 'home'}); f.diagnostics.markReady(); f.diagnostics.saveScreenshot(); f.diagnostics.exportPerformance(); f.diagnostics.destroy();
    assert.equal(f.diagnostics.report(), null); assert.equal(f.created.length, 0);
    assert.equal(f.owner.count(), 0); assert.equal(f.director.count(), 0); assert.equal(f.document.count(), 0); assert.equal(f.timers.size, 0);
  }
  for (const location of [{hostname: '127.0.0.1'}, {hostname: '[::1]'}, {protocol: 'file:', hostname: ''}]) {
    const f = fixture({location}); assert.equal(f.diagnostics.enabled, true); f.diagnostics.destroy();
  }
});

test('帧平均与P95取真实performance间隔；引擎dt单列，首次markReady保持幂等', () => {
  const f = fixture(); f.advance(75); f.diagnostics.markReady(); f.advance(25); f.diagnostics.markReady();
  f.diagnostics.recordFrame(.001, {screen: 'home'});
  const intervals = Array(18).fill(10.04).concat([20.02, 80.08]);
  for (const ms of intervals) f.frame(ms, .001);
  const report = f.diagnostics.report(), summary = report.frameTiming;
  assert.equal(summary.frames, 20); assert.ok(Math.abs(summary.averageFrameMs - 14.041) < 1e-9);
  assert.equal(summary.p95FrameMs, 20.1); assert.ok(Math.abs(summary.maxFrameMs - 80.08) < 1e-9);
  assert.equal(summary.over33Ms, 1); assert.equal(summary.over50Ms, 1); assert.equal(report.cocosDeltaTiming.averageFrameMs, 1);
  assert.equal(report.navigationToReadyMs, 175); assert.equal(report.diagnosticsToReadyMs, 75); f.diagnostics.destroy();
});

test('验收开关默认收起于左下安全边缘；展开收起不影响采样或触发导出', () => {
  const f=fixture(),toggle=f.button('验收'),actions=f.created.find(element=>element.id==='gowaygui-qa-actions');
  const panel=f.document.body.children[0];assert.match(panel.style.cssText,/left:max\(6px,env\(safe-area-inset-left\)\)/);assert.match(panel.style.cssText,/bottom:max\(6px,env\(safe-area-inset-bottom\)\)/);
  assert.equal(actions.hidden,true);assert.equal(toggle['aria-expanded'],'false');
  f.button('保存当前截图').click();f.button('导出性能记录').click();assert.equal(f.director.count(),0);assert.equal(f.downloads.length,0);
  f.frame();toggle.click();assert.equal(actions.hidden,false);assert.equal(toggle.textContent,'收起');assert.equal(toggle['aria-expanded'],'true');
  f.frame();toggle.click();assert.equal(actions.hidden,true);assert.equal(toggle.textContent,'验收');assert.equal(toggle['aria-expanded'],'false');
  assert.equal(f.diagnostics.report().frameTiming.frames,1);assert.equal(f.director.count(),0);assert.equal(f.timers.size,0);assert.equal(f.downloads.length,0);
  toggle.click();f.button('保存当前截图').click();toggle.click();f.draw();f.finishEncoding();
  assert.equal(actions.hidden,true,'Late screenshot status must not reopen the panel');assert.equal(f.downloads.length,1);f.diagnostics.destroy();
});

test('后台与恢复首帧不进入卡顿统计；堆不可用或异常为null而非零', () => {
  const f = fixture(); f.diagnostics.recordFrame(.016, {screen: 'home'}); f.frame(16);
  f.hidden(true); f.advance(3000); f.diagnostics.recordFrame(3, {screen: 'combat'}); f.hidden(false);
  f.diagnostics.recordFrame(3, {screen: 'combat'}); f.frame(20);
  const report = f.diagnostics.report();
  assert.equal(report.frameTiming.frames, 2); assert.equal(report.frameTiming.averageFrameMs, 18);
  assert.equal(report.hiddenDurationMs, 3000); assert.equal(report.foregroundDurationMs, 36); assert.equal(report.heap, null);
  f.performance.memory = {usedJSHeapSize: 100, totalJSHeapSize: 200, jsHeapSizeLimit: 1000};
  assert.deepEqual(plain(f.diagnostics.report().heap), f.performance.memory);
  f.performance.memory.usedJSHeapSize = NaN; assert.equal(f.diagnostics.report().heap, null); f.diagnostics.destroy();
});

test('点击截图在AFTER_DRAW同栈先复制WebGL像素，再异步编码；下载链接延后释放', () => {
  const f = fixture();f.button('验收').click(); const button = f.button('保存当前截图'); button.click(); button.click();
  assert.equal(f.director.count('after-draw'), 1); assert.equal(f.operations.length, 0); assert.equal(f.downloads.length, 0);
  f.draw(); assert.deepEqual(f.operations, ['webgl2', 'drawImage', 'toBlob']);
  assert.equal(f.downloads.length, 0); assert.equal(f.director.count('after-draw'), 0); assert.equal(f.timers.size, 0);
  f.canvas.frame = 'discarded-after-render'; const copy = f.finishEncoding().canvas;
  assert.equal(copy.copiedFrame, 'first-frame'); assert.equal(copy.width, 0); assert.equal(copy.height, 0);
  assert.equal(f.downloads.length, 1); assert.match(f.downloads[0].filename, /\.png$/); assert.equal(button.disabled, false);
  f.advance(59999); assert.equal(f.urls.size, 1); f.advance(1); assert.equal(f.urls.size, 0); assert.equal(f.revoked.length, 1); f.diagnostics.destroy();
});

test('销毁取消待绘制监听；编码迟到回调也不能触发下载', () => {
  for (const alreadyCopied of [false, true]) {
    const f = fixture();f.button('验收').click(); f.button('保存当前截图').click(); if (alreadyCopied) f.draw();
    f.owner.emit('node-destroyed'); f.diagnostics.destroy();
    assert.equal(f.director.count(), 0); assert.equal(f.owner.count(), 0); assert.equal(f.document.count(), 0);
    assert.equal(f.timers.size, 0); assert.equal(f.document.body.children.length, 0);
    f.draw(); if (alreadyCopied) f.finishEncoding(); f.advance(60000);
    assert.equal(f.downloads.length, 0); assert.equal(f.urls.size, 0); assert.equal(f.diagnostics.report(), null);
  }
});

test('未绘制超时和截图失败可重试，均不下载；迟到绘制已解绑', () => {
  const f = fixture();f.button('验收').click(); const button = f.button('保存当前截图'); button.click(); f.advance(5000);
  assert.equal(f.director.count(), 0); assert.equal(button.disabled, false); f.draw(); assert.equal(f.operations.length, 0);
  button.click(); f.draw(); f.finishEncoding(null); assert.equal(button.disabled, false); assert.equal(f.downloads.length, 0); f.diagnostics.destroy();
  for (const options of [{contextLost: true}, {no2d: true}]) {
    const failed = fixture(options);failed.button('验收').click(); failed.button('保存当前截图').click(); failed.draw();
    assert.equal(failed.button('保存当前截图').disabled, false); assert.equal(failed.director.count(), 0);
    assert.equal(failed.downloads.length, 0); assert.equal(failed.encodes.length, 0); failed.diagnostics.destroy();
  }
});

test('性能导出包含独立报告快照，销毁撤销URL和计时器且不保留面板', async () => {
  const f = fixture({location: {search: '?qa=1&private_token=do-not-export'}});
  f.frame(); f.frame();f.button('验收').click(); f.button('导出性能记录').click();
  assert.equal(f.downloads.length, 1); assert.match(f.downloads[0].filename, /\.json$/);
  const blob = f.urls.get(f.downloads[0].href), serialized = await blob.text(), report = JSON.parse(serialized);
  assert.equal(report.schema, 'gowaygui-local-qa-v1'); assert.equal(report.frameTiming.frames, 1);
  assert.equal(serialized.includes('private_token'), false); assert.equal(serialized.includes('do-not-export'), false);
  f.frame(); assert.equal(report.frameTiming.frames, 1); f.diagnostics.destroy();
  assert.equal(f.urls.size, 0); assert.equal(f.revoked.length, 1); assert.equal(f.timers.size, 0); assert.equal(f.document.body.children.length, 0);
});
