import {runtimeQuery} from '../platform/runtimeQuery';
import {AudioClip, AudioSource, Node, resources} from 'cc';
import type {Settings} from '../core/types';
import type {BattleEvent, BattleState} from '../core/battle';

const MUSIC_KEYS = new Set(['bgm_home', 'bgm_battle', 'bgm_boss']);
const EFFECTS: Record<string, {interval: number; priority: number}> = {
  sfx_panel_slide:{interval:150,priority:4},sfx_draw_tick:{interval:100,priority:3},
  sfx_wish_start:{interval:600,priority:5},sfx_wish_gather:{interval:600,priority:5},sfx_wish_burst:{interval:600,priority:5},
  sfx_boss_skill:{interval:450,priority:4},
  sfx_ui_confirm: {interval: 45, priority: 4},
  sfx_ui_back: {interval: 100, priority: 2},
  sfx_ui_error: {interval: 600, priority: 3},
  sfx_upgrade: {interval: 350, priority: 4},
  sfx_equip: {interval: 120, priority: 2},
  sfx_chest: {interval: 500, priority: 4},
  sfx_learn_complete: {interval: 500, priority: 4},
  sfx_bubble_pop: {interval: 65, priority: 1},
  sfx_bubble_rub: {interval: 120, priority: 0},
  sfx_collect: {interval: 300, priority: 4},
  sfx_rare_reveal: {interval: 600, priority: 4},
  sfx_victory: {interval: 600, priority: 4},
  sfx_attack_melee: {interval: 90, priority: 1},
  sfx_attack_projectile: {interval: 90, priority: 1},
  sfx_attack_magic: {interval: 100, priority: 1},
  sfx_hit_soft: {interval: 110, priority: 0},
  sfx_heal: {interval: 180, priority: 1},
  sfx_core_hit: {interval: 160, priority: 3},
  sfx_skill_stone: {interval: 200, priority: 3},
  sfx_skill_spike: {interval: 200, priority: 3},
  sfx_skill_crystal: {interval: 200, priority: 3},
  sfx_skill_leaf: {interval: 250, priority: 3},
  sfx_skill_bubble: {interval: 250, priority: 3},
  sfx_defeat: {interval: 600, priority: 4},
  sfx_death: {interval: 240, priority: 2},
  sfx_fusion_start: {interval: 600, priority: 4},
  sfx_fusion_complete: {interval: 600, priority: 4},
  sfx_purchase: {interval: 300, priority: 4},
  sfx_learn: {interval: 500, priority: 4},
  sfx_wave_start: {interval: 1000, priority: 3},
  sfx_boss_arrive: {interval: 3000, priority: 4},
  sfx_shield: {interval: 500, priority: 2},
  sfx_revive: {interval: 1000, priority: 3},
  sfx_critical: {interval: 450, priority: 1},
};
const MAX_EFFECT_VOICES = 6;
const HALF_TRANSITION_SECONDS = .2;
const volume = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

interface Voice {
  node: Node; source: AudioSource; key: string; started: boolean;
  gain: number; priority: number; createdAt: number; deadline: number;
}
interface Selection {key: string; clip: AudioClip; revision: number}

/** Managed sources let pause/stop cancel sounds that are still loading inside Cocos. */
export class IslandAudio {
  private readonly root: Node;
  private music?: Voice;
  private readonly effects = new Set<Voice>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly pending = new Map<string, Promise<AudioClip | null>>();
  private readonly playedAt = new Map<string, number>();
  private volumes = {music: 0, effects: 0};
  private unlocked = false;
  private paused = false;
  private stopped = false;
  private disposed = false;
  private desired = 'bgm_home';
  private selectionRevision = 0;
  private loadEpoch = 0;
  private next?: Selection;
  private suspended?: {key: string; time: number};
  private musicGain = 0;
  private transition: 'in' | 'out' | 'steady' = 'steady';
  private lastClock = 0;

  constructor(parent: Node, settings: Settings) {
    this.root = new Node('海岛声音'); this.root.setParent(parent);
    this.apply(settings);
    void this.load('bgm_home');
    for (const key of Object.keys(EFFECTS)) void this.load(key);
  }

  /** Call from the first user gesture; repeated UI gestures do not restart music. */
  unlock(): void {
    if (this.disposed) return;
    const wasStopped = this.stopped;
    if (this.unlocked && !wasStopped) {
      if (!this.music && !this.pending.has(this.desired) && !this.paused) void this.playMusic(this.desired);
      return;
    }
    this.unlocked = true; this.stopped = false;
    if (wasStopped) for (const key of Object.keys(EFFECTS)) void this.load(key);
    void this.playMusic(this.desired);
  }

  async playMusic(key: string): Promise<void> {
    if (this.disposed || !MUSIC_KEYS.has(key)) return;
    if (key !== this.desired || this.stopped) {
      this.selectionRevision++; this.next = undefined;
      if (this.music && this.transition === 'out') this.transition = 'in';
    }
    this.desired = key; this.stopped = false;
    const revision = this.selectionRevision;
    // Reversing A -> B -> A during the fade keeps A's position; never call play twice.
    if (this.music?.key === key) {
      this.next = undefined; this.transition = this.musicGain < 1 ? 'in' : 'steady'; return;
    }
    const clip = await this.load(key);
    if (!clip || !this.canPlay() || revision !== this.selectionRevision || this.desired !== key) return;
    if (this.music?.key === key) return;
    this.next = {key, clip, revision};
    if (this.music) this.transition = 'out'; else this.startNext();
  }

  /** GameEntry.update calls this even when combat is paused or a modal is open. */
  update(dt: number): void {
    if (!this.canPlay() || !Number.isFinite(dt) || dt <= 0) return;
    const now = this.clock();
    // Decode/play failures do not always emit ENDED; do not strand scarce voices.
    for (const voice of this.effects) if (now >= voice.deadline) {
      this.effects.delete(voice); this.releaseVoice(voice);
    }
    if (!this.music) return;
    if (!this.music.started && now - this.music.createdAt > 5000) {
      console.warn('[AUDIO_START_TIMEOUT]', this.music.key);
      this.releaseVoice(this.music); this.music = undefined; this.musicGain = 0;
      this.startNext(); return;
    }
    const step = Math.min(.1, dt) / HALF_TRANSITION_SECONDS;
    if (this.transition === 'out') {
      this.musicGain = Math.max(0, this.musicGain - step);
      this.music.source.volume = this.volumes.music * this.musicGain;
      if (this.musicGain <= 0) { this.releaseVoice(this.music); this.music = undefined; this.startNext(); }
    } else if (this.music.started && this.transition === 'in') {
      this.musicGain = Math.min(1, this.musicGain + step);
      this.music.source.volume = this.volumes.music * this.musicGain;
      if (this.musicGain >= 1) this.transition = 'steady';
    }
  }

  /** Optional gain scales one cue; the effects setting is multiplied exactly once. */
  effect(key: string, minIntervalMs?: number, gain = 1): void {
    const definition = Object.prototype.hasOwnProperty.call(EFFECTS, key) ? EFFECTS[key] : undefined;
    if (!definition || !this.canPlay() || this.volumes.effects <= 0 || volume(gain) <= 0) return;
    const now = this.clock();
    const interval = Math.max(definition.interval, Number.isFinite(minIntervalMs) ? Math.max(0, minIntervalMs!) : 0);
    if (now - (this.playedAt.get(key) ?? -Infinity) < interval) return;
    const clip = this.clips.get(key);
    // A late sound is misleading. Preload or retry, but do not queue an obsolete cue.
    if (!clip) { void this.load(key); return; }
    if (this.effects.size >= MAX_EFFECT_VOICES) {
      const candidate = Array.from(this.effects).sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)[0];
      if (candidate.priority >= definition.priority) return;
      this.effects.delete(candidate); this.releaseVoice(candidate);
    }
    const voice = this.createVoice(key, false, volume(gain), definition.priority);
    this.effects.add(voice); this.playedAt.set(key, now);
    voice.node.on(AudioSource.EventType.ENDED, () => {
      if (!this.effects.delete(voice)) return; this.releaseVoice(voice);
    });
    voice.node.on(AudioSource.EventType.STARTED, () => {
      if (this.effects.has(voice) && this.canPlay()) {
        voice.started = true;
        this.trace(key);
        const duration = clip.getDuration();
        voice.deadline = this.clock() + (Number.isFinite(duration) && duration > 0 ? duration : 4) * 1000 + 250;
      }
    });
    voice.source.volume = this.volumes.effects * voice.gain;
    voice.source.clip = clip; voice.source.play();
  }

  apply(settings: Settings): void {
    if (this.disposed) return;
    this.volumes = {music: volume(settings.music), effects: volume(settings.effects)};
    if (this.music) this.music.source.volume = this.volumes.music * this.musicGain;
    if (this.volumes.effects === 0) this.clearEffects();
    else for (const voice of this.effects) voice.source.volume = this.volumes.effects * voice.gain;
  }

  /** All combat screens consume the same event cues, including automatic casts.
   * Call only with newly consumed events; stale network history stays silent. */
  battleEvents(battle: BattleState, events: BattleEvent[]): void {
    if(battle.status==='fighting'){
      const key=battle.levelId===56||battle.enemies.some(e=>e.alive&&e.kind==='boss')?'bgm_boss':'bgm_battle';
      if(this.desired!==key)void this.playMusic(key);
    }
    const casts: Record<string, string> = {hold:'stone', piercingShot:'spike', crystalCannon:'crystal', greatHeal:'leaf', bubbleRing:'bubble'};
    for (const e of events) {
      if (e.tick < battle.tick - 8) continue;
      const source = battle.units.find(u => u.id === e.sourceId) ?? battle.duelUnits?.find(u => u.id === e.sourceId);
      const enemySource = battle.enemies.find(enemy => enemy.id === e.sourceId);
      if (e.type === 'defeat') {
        // Death is emitted after the final damage event. Give the visual burst
        // its own cue instead of letting it inherit the hit sound.
        const bossDeath = battle.enemies.some(enemy => enemy.id === e.targetId && enemy.kind === 'boss');
        this.effect('sfx_death', 240, bossDeath ? .9 : .55);
      } else if (e.type === 'skill') {
        const role = (e.skillId && casts[e.skillId]) || source?.role;
        if (role) this.effect('sfx_skill_' + role, 240, 1);
        else if(battle.enemies.some(enemy=>enemy.id===e.sourceId))this.effect('sfx_boss_skill',500,1);
      } else if(e.type === 'control' && (e.effect?.startsWith('boss')||e.effect?.includes('slam')||e.effect?.includes('shockwave'))){this.effect('sfx_boss_skill',650,.85);
      } else if (e.type === 'spawn' && battle.enemies.some(enemy => enemy.id === e.sourceId && enemy.kind === 'boss')) {
        void this.playMusic('bgm_boss');
        this.effect('sfx_boss_arrive');
      } else if (e.type === 'leak') this.effect('sfx_core_hit');
      else if (e.type === 'shield' && (e.amount ?? 0) > 0) this.effect('sfx_shield', 500, .65);
      else if (e.type === 'heal' && (e.amount ?? 0) > 0) {
        if (e.skillId === 'rebirth' || e.effect === 'revive') this.effect('sfx_revive');
        else this.effect('sfx_heal', 180, .55);
      } else if (e.type === 'damage' && (e.amount ?? 0) > 0) {
        if (e.critical) this.effect('sfx_critical', 450, .7);
        else this.effect('sfx_hit_soft', 160, .42);
      } else if (e.type === 'attack' && e.effect !== 'heal' && e.effect !== 'windup') {
        const role = source?.role;
        const enemyRanged = (enemySource?.range ?? 0) > 1.5;
        this.effect(role === 'stone' ? 'sfx_attack_melee' : role === 'spike' ? 'sfx_attack_projectile' : role === 'bubble' ? 'sfx_bubble_pop' : role ? 'sfx_attack_magic' : enemyRanged ? 'sfx_attack_projectile' : 'sfx_attack_melee', 160, .5);
      }
    }
  }

  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true; this.selectionRevision++; this.next = undefined;
    if (this.music) {
      const time = this.music.source.currentTime;
      this.suspended = {key: this.music.key, time: Number.isFinite(time) ? Math.max(0, time) : 0};
      // clip=null cancels Cocos's pending AudioPlayer.load, including queued PLAY.
      this.releaseVoice(this.music); this.music = undefined;
    }
    this.musicGain = 0; this.clearEffects();
  }

  resume(): void {
    if (this.disposed || this.stopped || !this.paused) return;
    this.paused = false; if (this.unlocked) void this.playMusic(this.desired);
  }

  /** Reversible stop: cancels pending work, releases owned clip refs, no auto-resume. */
  stop(): void {
    if (this.disposed) return;
    this.stopped = true; this.paused = false; this.selectionRevision++; this.loadEpoch++;
    this.next = undefined; this.suspended = undefined; this.musicGain = 0;
    if (this.music) { this.releaseVoice(this.music); this.music = undefined; }
    this.clearEffects(); this.playedAt.clear(); this.pending.clear();
    for (const clip of this.clips.values()) clip.decRef(); this.clips.clear();
  }

  /** Call on owner destruction. Idempotent; never destroys the caller's parent. */
  destroy(): void {
    if (this.disposed) return;
    this.stop(); this.disposed = true;
    if (this.root.isValid) { this.root.active = false; this.root.removeFromParent(); this.root.destroy(); }
  }

  private trace(key:string):void{if(typeof location!=='undefined'&&runtimeQuery().get('qa')==='1')console.info('[AUDIO_STARTED]',key);}
  private canPlay(): boolean { return !this.disposed && !this.stopped && !this.paused && this.unlocked && this.root.isValid; }
  private clock(): number {
    const current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastClock = Math.max(this.lastClock, current); return this.lastClock;
  }
  private load(key: string): Promise<AudioClip | null> {
    if (this.disposed || (!MUSIC_KEYS.has(key) && !Object.prototype.hasOwnProperty.call(EFFECTS, key))) return Promise.resolve(null);
    const cached = this.clips.get(key); if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(key); if (existing) return existing;
    const epoch = this.loadEpoch;
    let finish!: (clip: AudioClip | null) => void;
    const task = new Promise<AudioClip | null>(resolve => { finish = resolve; });
    this.pending.set(key, task);
    resources.load('audio/' + key, AudioClip, (error, clip) => {
      if (this.pending.get(key) === task) this.pending.delete(key);
      if (this.disposed || epoch !== this.loadEpoch || !this.root.isValid) { finish(null); return; }
      if (error || !clip) { console.warn('[AUDIO_LOAD]', key, error?.message); finish(null); return; }
      clip.addRef(); this.clips.set(key, clip); finish(clip);
    });
    return task;
  }
  private createVoice(key: string, loop: boolean, gain: number, priority: number): Voice {
    const node = new Node(loop ? '背景音乐声道' : `音效声道 · ${key}`);
    node.active = false; node.setParent(this.root);
    const source = node.addComponent(AudioSource);
    source.playOnAwake = false; source.loop = loop; source.volume = 0; node.active = true;
    const createdAt = this.clock();
    return {node, source, key, gain, priority, createdAt, deadline: createdAt + 2500, started: false};
  }
  private startNext(): void {
    const selected = this.next;
    if (!selected || !this.canPlay() || selected.revision !== this.selectionRevision || selected.key !== this.desired) return;
    this.next = undefined; this.musicGain = 0; this.transition = 'in';
    const voice = this.createVoice(selected.key, true, 1, 5); this.music = voice;
    voice.node.on(AudioSource.EventType.STARTED, () => {
      if (this.music === voice && this.canPlay()) {voice.started = true;this.trace(voice.key);}
    });
    voice.source.clip = selected.clip;
    if (this.suspended?.key === selected.key && this.suspended.time > 0) voice.source.currentTime = this.suspended.time;
    this.suspended = undefined; voice.source.play();
  }
  private clearEffects(): void { for (const voice of this.effects) this.releaseVoice(voice); this.effects.clear(); }
  private releaseVoice(voice: Voice): void {
    // Fresh components per accepted voice avoid Cocos's same-clip ABA loading race.
    voice.source.volume = 0; voice.source.stop(); voice.source.clip = null;
    voice.node.off(AudioSource.EventType.STARTED); voice.node.off(AudioSource.EventType.ENDED);
    if (voice.node.isValid) { voice.node.active = false; voice.node.removeFromParent(); voice.node.destroy(); }
  }
}
