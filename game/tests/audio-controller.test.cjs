const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');

let ts;
for (const candidate of [process.env.GOWAYGUI_TYPESCRIPT, 'typescript', 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)) {
  try { ts = require(candidate); break; } catch {}
}
if (!ts) throw new Error('Audio tests require the installed Cocos TypeScript compiler or GOWAYGUI_TYPESCRIPT');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../assets/scripts/view/IslandAudio.ts'), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;

function fixture({deferStart = false} = {}) {
  const resourceLoads = [], playerLoads = [], playerStarts = [], sources = [], playback = [], allClips = [], warnings = [];
  let now = 1000;
  class Node extends EventEmitter {
    constructor(name) { super(); this.name = name; this.active = true; this.isValid = true; this.children = []; }
    setParent(parent) { this.removeFromParent(); this.parent = parent; parent.children.push(this); }
    removeFromParent() { if (this.parent) { this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; } }
    addComponent(Type) { const component = new Type(); component.node = this; return component; }
    off(event, handler) { if (handler) return super.off(event, handler); this.removeAllListeners(event); return this; }
    destroy() { this.isValid = false; for (const child of this.children) child.destroy(); this.children = []; }
  }
  class AudioClip {
    constructor(key) { this.key = key; this.refs = 0; allClips.push(this); }
    addRef() { this.refs++; return this; }
    decRef() { assert.ok(this.refs > 0, 'owned references cannot be released twice'); this.refs--; return this; }
    getDuration() { return this.key.startsWith('bgm') ? 80 : 1; }
  }
  class AudioSource {
    static EventType = {STARTED: 'started', ENDED: 'ended'};
    constructor() { this.volume = 1; this.playOnAwake = true; this._clip = null; this._lastSetClip = null; this.operations = []; this.loaded = false; this.playing = false; this.time = 0; sources.push(this); }
    set clip(clip) {
      if (clip === this._clip) return;
      this._clip = clip; this._lastSetClip = clip;
      if (!clip) {
        this.playing = false; this.loaded = false;
        // Web AudioPlayer.destroy directly removes the pending context-running callback.
        for (const entry of playerStarts) if (entry.source === this && !entry.done) entry.cancelled = true;
        return;
      }
      this.loaded = false; this.operations = [];
      // Models the second asynchronous layer in Cocos AudioSource._syncPlayer.
      playerLoads.push({source: this, clip, done: false, resolve: () => {
        if (this._lastSetClip !== clip) return;
        this.loaded = true;
        const operations = this.operations.splice(0);
        for (const [method, argument] of operations) {
          if (method === 'seek') this.time = argument; else this[method]();
        }
      }});
    }
    get clip() { return this._clip; }
    set currentTime(value) { if (!this.loaded && this.clip) this.operations.push(['seek', value]); else this.time = value; }
    get currentTime() { return this.time; }
    play() {
      if (!this.loaded && this.clip) { this.operations.push(['play']); return; }
      if (!this.clip) return;
      const clip = this.clip;
      const start = () => { this.playing = true; playback.push({source: this, key: clip.key, volume: this.volume, time: this.time}); };
      if (!deferStart) { start(); this.node.emit(AudioSource.EventType.STARTED, this); return; }
      // Third layer: AudioPlayer.play may wait for AudioContext; AudioSource emits
      // STARTED only in the fulfilled Promise continuation, not when play is called.
      new Promise(resolve => playerStarts.push({source: this, done: false, cancelled: false, complete(entry) {
        if (entry.cancelled) return;
        start(); resolve();
      }})).then(() => this.node.emit(AudioSource.EventType.STARTED, this));
    }
    stop() { if (!this.loaded && this.clip) this.operations.push(['stop']); else this.playing = false; }
    playOneShot() { throw new Error('Unmanaged OneShotAudio cannot satisfy cancellation requirements'); }
    ended() { this.playing = false; this.node.emit(AudioSource.EventType.ENDED, this); }
  }
  const resources = {load(name, Type, callback) { resourceLoads.push({name, callback, done: false}); }};
  const module = {exports: {}};
  vm.runInNewContext(compiled, {module, exports: module.exports, require(name) {
    assert.equal(name, 'cc'); return {AudioClip, AudioSource, Node, resources};
  }, performance: {now: () => now}, console: {warn(...values) { warnings.push(values); }}});
  const parent = new Node('owner');
  const settings = {music: .8, effects: .4, quality: 'high', reducedMotion: false};
  const audio = new module.exports.IslandAudio(parent, settings);
  const resolveResource = (key, error = false) => {
    const entry = resourceLoads.find(load => !load.done && load.name === 'audio/' + key);
    assert.ok(entry, `Pending resource: ${key}`); entry.done = true;
    const clip = error ? null : new AudioClip(key);
    entry.callback(error ? new Error('fixture failed load') : null, clip); return clip;
  };
  const resolvePlayer = (source) => {
    const entry = playerLoads.find(load => !load.done && (!source || load.source === source));
    assert.ok(entry, 'Pending native player'); entry.done = true; entry.resolve(); return entry.source;
  };
  const resolveStart = (source) => {
    const entry = playerStarts.find(start => !start.done && (!source || start.source === source));
    assert.ok(entry, 'Pending asynchronous play'); entry.done = true; entry.complete(entry); return entry.source;
  };
  const preload = async () => { for (const entry of resourceLoads.filter(load => !load.done)) resolveResource(entry.name.slice(6)); await flush(); };
  const playing = () => sources.filter(source => source.playing && source.clip);
  return {audio, parent, settings, resourceLoads, playerLoads, playerStarts, sources, playback, allClips, warnings, resolveResource, resolvePlayer, resolveStart, preload, playing, advance(ms) { now += ms; }, update(seconds) { for (let i = 0; i < Math.ceil(seconds / .05); i++) audio.update(.05); }};
}
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function startHome(f) { await f.preload(); f.audio.unlock(); await flush(); const source = f.resolvePlayer(); f.update(.2); return source; }

test('战斗事件区分五职业、自动施法、重生和护盾；旧快照与蓄力不发声', () => {
  const f=fixture(), calls=[];
  f.audio.effect=(key)=>calls.push(key);
  const battle={tick:100,units:['stone','spike','crystal','leaf','bubble'].map(role=>({id:role,role})),enemies:[]};
  const events=battle.units.map((u,i)=>({id:i+1,tick:100,type:'skill',sourceId:u.id,skillId:['hold','piercingShot','crystalCannon','greatHeal','bubbleRing'][i]}));
  f.audio.battleEvents(battle,events);
  assert.deepEqual(calls,['sfx_skill_stone','sfx_skill_spike','sfx_skill_crystal','sfx_skill_leaf','sfx_skill_bubble']);
  calls.length=0;
  f.audio.battleEvents(battle,[{tick:1,type:'skill',sourceId:'stone',skillId:'hold'},{tick:100,type:'attack',sourceId:'stone',effect:'windup'},{tick:100,type:'heal',amount:0},{tick:100,type:'shield',amount:0}]);
  assert.deepEqual(calls,[]);
  f.audio.battleEvents(battle,[{tick:100,type:'heal',skillId:'rebirth',amount:20},{tick:100,type:'heal',effect:'revive',amount:20},{tick:100,type:'shield',amount:10},{tick:100,type:'damage',amount:20,critical:true,sourceId:'spike'},{tick:100,type:'leak'}]);
  assert.deepEqual(calls,['sfx_revive','sfx_revive','sfx_shield','sfx_critical','sfx_core_hit']);
  f.audio.destroy();
});

test('首领出现切换音乐；多目标同帧技能只发一次音且合成能抢占普通攻击', async () => {
  const f=fixture();await startHome(f);
  const battle={tick:10,units:[{id:'crystal',role:'crystal'}],enemies:[{id:'boss',kind:'boss'}]};
  f.audio.battleEvents(battle,Array.from({length:8},(_,i)=>({id:i,tick:10,type:'skill',sourceId:'crystal',skillId:'crystalMastery'})));
  assert.equal(f.playerLoads.filter(x=>x.clip.key==='sfx_skill_crystal').length,1);
  f.audio.battleEvents(battle,[{tick:10,type:'spawn',sourceId:'boss'}]);
  f.resolveResource('bgm_boss');await flush();f.update(.3);f.resolvePlayer(f.playerLoads.find(x=>x.clip.key==='bgm_boss').source);
  assert.equal(f.playing().find(s=>s.loop).clip.key,'bgm_boss');
  for(const key of ['sfx_attack_melee','sfx_attack_projectile','sfx_attack_magic','sfx_hit_soft'])f.audio.effect(key);
  f.audio.effect('sfx_fusion_complete');
  assert.ok(f.playerLoads.some(x=>x.clip.key==='sfx_fusion_complete'));
  f.audio.pause();const count=f.playerLoads.length;f.audio.battleEvents(battle,[{tick:10,type:'skill',sourceId:'crystal',skillId:'crystalCannon'}]);assert.equal(f.playerLoads.length,count);
  f.audio.destroy();
});

test('预载三十九个音效；多次手势和同曲请求只播放一次，首帧静音淡入', async () => {
  const f = fixture(); assert.equal(f.resourceLoads.length, 40);
  assert.equal(f.resourceLoads.filter(load => load.name.includes('/sfx_')).length, 39);
  await f.preload(); assert.equal(f.playerLoads.length, 0);
  for (let i = 0; i < 5; i++) f.audio.unlock();
  await Promise.all([f.audio.playMusic('bgm_home'), f.audio.playMusic('bgm_home')]);
  assert.equal(f.playerLoads.length, 1);
  const source = f.resolvePlayer(); assert.equal(f.playback[0].volume, 0);
  f.update(.2); assert.equal(source.volume, .8); assert.equal(f.playback.length, 1);
  f.audio.destroy();
});

test('资源乱序完成时只选择最新曲目，不让旧回调覆盖', async () => {
  const f = fixture(); f.audio.unlock();
  const battle = f.audio.playMusic('bgm_battle'), boss = f.audio.playMusic('bgm_boss');
  f.resolveResource('bgm_boss'); await flush();
  f.resolveResource('bgm_home'); f.resolveResource('bgm_battle'); await Promise.all([battle, boss]);
  assert.equal(f.playerLoads.length, 1); f.resolvePlayer();
  assert.deepEqual(f.playback.map(event => event.key), ['bgm_boss']); f.audio.destroy();
});

test('暂停覆盖资源加载与底层播放器加载，恢复才播放并保留位置', async () => {
  const f = fixture(); f.audio.unlock(); f.audio.pause();
  f.resolveResource('bgm_home'); await flush(); assert.equal(f.playerLoads.length, 0);
  f.audio.resume(); await flush(); const old = f.playerLoads[0].source;
  f.audio.pause(); f.resolvePlayer(old); assert.equal(f.playback.length, 0);
  f.audio.resume(); await flush(); const resumed = f.resolvePlayer();
  assert.notEqual(resumed, old); assert.equal(f.playback.length, 1);
  resumed.currentTime = 23.5; f.audio.pause(); f.audio.resume(); await flush();
  f.resolvePlayer(); assert.equal(f.playback[1].time, 23.5);
  f.audio.destroy();
});

test('A→B→A撤销淡出不重启；慢C请求保留旧曲；切换始终不重叠', async () => {
  const f = fixture(), home = await startHome(f);
  const requested = f.audio.playMusic('bgm_battle'); f.resolveResource('bgm_battle'); await requested;
  f.update(.1); assert.equal(home.volume, .4);
  await f.audio.playMusic('bgm_home'); f.update(.1); assert.equal(home.volume, .8); assert.equal(f.playback.length, 1);
  await f.audio.playMusic('bgm_battle'); f.update(.1);
  const boss = f.audio.playMusic('bgm_boss'); f.update(.1);
  assert.equal(home.volume, .8); assert.equal(home.playing, true);
  f.resolveResource('bgm_boss'); await boss;
  f.update(.2); assert.equal(home.clip, null); assert.equal(f.playing().length, 0);
  const next = f.resolvePlayer(); assert.equal(next.volume, 0); f.update(.2);
  assert.equal(next.volume, .8); assert.deepEqual(f.playing().map(source => source.clip.key), ['bgm_boss']);
  f.audio.destroy();
});

test('六路音效上限、优先级、节流、独立音量和静音取消底层未完成播放', async () => {
  const f = fixture(), music = await startHome(f);
  const ordinary = ['sfx_bubble_rub','sfx_hit_soft','sfx_attack_melee','sfx_attack_projectile','sfx_attack_magic','sfx_heal'];
  for (const key of ordinary) f.audio.effect(key, 0, .5);
  const native = f.playerLoads.filter(load => !load.done); assert.equal(native.length, 6);
  f.audio.effect('sfx_attack_melee', 0); assert.equal(f.playerLoads.filter(load => !load.done).length, 6);
  f.audio.effect('sfx_skill_stone'); assert.equal(native[0].source.clip, null);
  f.advance(300); f.audio.effect('sfx_bubble_rub');
  assert.equal(f.sources.filter(source => source.clip && !source.loop).length, 6);
  f.audio.apply({...f.settings, music: .25, effects: .2}); assert.equal(music.volume, .25);
  const ordinaryVoice = native[2].source; assert.equal(ordinaryVoice.volume, .1, 'volume setting applied exactly once');
  f.audio.apply({...f.settings, music: .25, effects: 0});
  for (const load of f.playerLoads.filter(load => !load.done)) f.resolvePlayer(load.source);
  assert.deepEqual(f.playback.map(event => event.key), ['bgm_home']);
  assert.equal(f.sources.filter(source => source.clip && !source.loop).length, 0);
  assert.equal(music.playing, true); f.audio.destroy();
});

test('stop释放引用且拒绝旧世代回调；旧Promise不能删除新请求；destroy幂等', async () => {
  const f = fixture(); f.audio.unlock(); const oldRequest = f.audio.playMusic('bgm_battle');
  f.audio.stop(); const freshRequest = f.audio.playMusic('bgm_battle');
  const stale = f.resolveResource('bgm_battle'); await oldRequest; assert.equal(stale.refs, 0);
  const joined = f.audio.playMusic('bgm_battle');
  assert.equal(f.resourceLoads.filter(load => load.name === 'audio/bgm_battle').length, 2);
  const fresh = f.resolveResource('bgm_battle'); await Promise.all([freshRequest, joined]); assert.equal(fresh.refs, 1);
  const source = f.playerLoads[0].source; f.audio.destroy(); f.audio.destroy();
  assert.equal(fresh.refs, 0); assert.equal(f.parent.isValid, true); assert.equal(f.parent.children.length, 0);
  f.resolvePlayer(source); f.resolveResource('bgm_home'); await flush();
  assert.equal(f.playback.length, 0); assert.ok(f.allClips.every(clip => clip.refs === 0));
});

test('加载失败可重试；迟到的普通音效不补播；未知资源不会加载', async () => {
  const f = fixture(); f.audio.unlock(); f.resolveResource('bgm_home', true); await flush();
  f.audio.unlock(); f.resolveResource('bgm_home'); await flush(); f.resolvePlayer();
  f.audio.effect('sfx_attack_melee'); f.resolveResource('sfx_attack_melee'); await flush();
  assert.equal(f.playback.length, 1); f.audio.effect('sfx_attack_melee'); f.resolvePlayer();
  assert.equal(f.playback.length, 2);
  const count = f.resourceLoads.length;
  f.audio.effect('__proto__'); f.audio.effect('toString'); await f.audio.playMusic('missing');
  assert.equal(f.resourceLoads.length, count); f.audio.destroy();
});

test('音效自然结束释放声道；底层失败未发结束事件也不会永久占满', async () => {
  const f = fixture(); await startHome(f);
  f.audio.effect('sfx_skill_leaf'); const leaf = f.resolvePlayer(); leaf.ended();
  assert.equal(leaf.clip, null); assert.equal(leaf.node.isValid, false);
  f.audio.effect('sfx_attack_melee'); const waiting = f.playerLoads.find(load => !load.done).source;
  f.advance(2600); f.audio.update(.05); assert.equal(waiting.clip, null);
  const count = f.playback.length; f.resolvePlayer(waiting); assert.equal(f.playback.length, count);
  f.audio.destroy();
});

test('异步play完成前首手势和重复手势不重建声道；STARTED之后才淡入且不再启动超时', async () => {
  const f = fixture({deferStart: true}); await f.preload();
  assert.equal(f.playerLoads.length, 0, 'preload alone must not attempt playback');
  f.audio.unlock(); await flush(); const source = f.resolvePlayer();
  for (let i = 0; i < 4; i++) f.audio.unlock();
  await flush(); assert.equal(f.sources.length, 1); assert.equal(f.playerStarts.length, 1);
  f.advance(4900); f.audio.update(.1); assert.equal(source.volume, 0); assert.equal(f.playback.length, 0);
  f.resolveStart(source); f.audio.update(.1);
  assert.equal(source.volume, 0, 'play resolution has not delivered STARTED microtask yet');
  await flush(); f.update(.2); assert.equal(source.volume, .8);
  f.advance(10000); f.audio.update(.1); assert.equal(source.playing, true); assert.deepEqual(f.warnings, []);
  f.audio.destroy();
});

test('五秒未收到STARTED只清理一次；后续手势重试缓存曲目并隔离旧声道事件', async () => {
  const f = fixture({deferStart: true}); await f.preload();
  f.audio.unlock(); await flush(); const old = f.resolvePlayer();
  f.advance(5000); f.audio.update(.1); assert.ok(old.clip, 'the deadline condition is strictly greater than five seconds');
  f.advance(1); f.audio.update(.1);
  assert.equal(old.clip, null); assert.equal(old.volume, 0); assert.equal(old.node.isValid, false);
  assert.equal(old.node.listenerCount('started'), 0);
  assert.deepEqual(f.warnings, [['[AUDIO_START_TIMEOUT]', 'bgm_home']]);
  f.advance(6000); f.update(.2); assert.equal(f.warnings.length, 1); assert.equal(f.sources.length, 1);
  f.resolveStart(old); await flush(); assert.equal(f.playback.length, 0, 'released Web player cannot start on a later context-running event');
  const loadCount = f.resourceLoads.length;
  f.audio.unlock(); await flush(); const recovered = f.resolvePlayer();
  assert.notEqual(recovered, old); assert.equal(f.resourceLoads.length, loadCount, 'retry reuses owned clip');
  old.node.emit('started', old); f.update(.2); assert.equal(recovered.volume, 0);
  f.resolveStart(recovered); await flush(); f.update(.2);
  assert.deepEqual(f.playing().map(source => source.clip.key), ['bgm_home']); assert.equal(recovered.volume, .8);
  f.audio.destroy(); assert.ok(f.allClips.every(clip => clip.refs === 0));
});

test('超时同帧已有最新切曲请求时转到最新曲；之后主动切曲也能恢复', async () => {
  const f = fixture({deferStart: true}); await f.preload();
  f.audio.unlock(); await flush(); const old = f.resolvePlayer();
  const battle = f.audio.playMusic('bgm_battle'), boss = f.audio.playMusic('bgm_boss');
  f.resolveResource('bgm_battle'); f.resolveResource('bgm_boss'); await Promise.all([battle, boss]);
  f.advance(5001); f.audio.update(.1); const selected = f.resolvePlayer();
  assert.equal(old.clip, null); assert.equal(selected.clip.key, 'bgm_boss');
  f.resolveStart(old); f.resolveStart(selected); await flush(); f.update(.2);
  assert.deepEqual(f.playback.map(event => event.key), ['bgm_boss']); assert.equal(f.playing().length, 1);
  await f.audio.playMusic('bgm_battle'); f.update(.2); const waiting = f.resolvePlayer();
  f.advance(5001); f.audio.update(.1); assert.equal(waiting.clip, null);
  await f.audio.playMusic('bgm_home'); const home = f.resolvePlayer();
  f.resolveStart(waiting); f.resolveStart(home); await flush(); f.update(.2);
  assert.deepEqual(f.playing().map(source => source.clip.key), ['bgm_home']);
  assert.equal(f.warnings.length, 2); f.audio.destroy();
});

test('异步play期间暂停、stop与destroy撤销旧声道；仅显式恢复或手势才重新启动', async () => {
  const f = fixture({deferStart: true}); await f.preload();
  f.audio.unlock(); await flush(); const paused = f.resolvePlayer();
  f.audio.pause(); f.resolveStart(paused); await flush();
  f.advance(10000); f.audio.update(.1); f.audio.unlock(); await flush();
  assert.equal(f.playback.length, 0); assert.equal(f.sources.length, 1); assert.equal(f.warnings.length, 0);
  f.audio.resume(); await flush(); const resumed = f.resolvePlayer();
  f.audio.stop(); f.resolveStart(resumed); await flush(); f.audio.resume(); await flush();
  assert.equal(f.sources.length, 2); assert.ok(f.allClips.every(clip => clip.refs === 0));
  f.audio.unlock(); await f.preload(); const fresh = f.resolvePlayer();
  f.resolveStart(fresh); f.audio.destroy(); await flush();
  assert.equal(fresh.node.listenerCount('started'), 0); assert.equal(f.playing().length, 0);
  assert.equal(f.parent.children.length, 0); assert.ok(f.allClips.every(clip => clip.refs === 0));
  f.audio.unlock(); f.audio.resume(); await flush(); assert.equal(f.sources.length, 3);
});

test('五职业与首领施法各自命中音效，过期事件不补播', () => {
  const f=fixture(),calls=[];f.audio.effect=key=>calls.push(key);
  const roles=['stone','spike','crystal','leaf','bubble'];
  const battle={tick:100,units:roles.map(role=>({id:role,role})),enemies:[{id:'boss',kind:'boss'}]};
  f.audio.battleEvents(battle,roles.map(role=>({tick:100,type:'skill',sourceId:role})).concat([
    {tick:100,type:'skill',sourceId:'boss'},
    {tick:100,type:'control',sourceId:'boss',effect:'boss-slam'},
    {tick:90,type:'skill',sourceId:'boss'}
  ]));
  assert.deepEqual(calls,roles.map(role=>'sfx_skill_'+role).concat(['sfx_boss_skill','sfx_boss_skill']));
  f.audio.destroy();
});
