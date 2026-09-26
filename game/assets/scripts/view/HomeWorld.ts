import {AnimationClip, Color, instantiate, isValid, Layers, Material, Mesh, MeshRenderer, Node, Prefab, primitives, resources, SkeletalAnimation, utils} from 'cc';
import {TurtleMaterialAdapter} from './TurtleMaterialAdapter';
import {receiveIslandShadows} from './WorldLighting';

export type HomeRole = 'stone' | 'spike' | 'crystal' | 'leaf' | 'bubble';
export const HOME_ENVIRONMENT_PATH = 'environment/home-island/home-island/home-island';
/** Cocos Y-up; authored home-island/candidate-01 proposal, retained by c02. */
export const HOME_CAMERA = {
  position: [1.8, 8.2, 12.8] as const,
  target: [-.45, .9, 0] as const,
  baseVerticalFovDegrees: 38,
} as const;

const DISPLAYS: ReadonlyArray<{role: HomeRole; title: string; prefix: string; x: number; y: number; z: number; yaw: number}> = [
  {role: 'stone', title: '石头龟', prefix: 'StoneAtlas_', x: -.8, y: .16, z: 2.7, yaw: 8},
  {role: 'spike', title: '刺刺龟', prefix: 'SpikeAtlas_', x: -2.4, y: .16, z: -.25, yaw: 12},
  {role: 'crystal', title: '水晶龟', prefix: 'CrystalAtlas_', x: -3.15, y: .16, z: 2.15, yaw: 15},
  {role: 'leaf', title: '叶子龟', prefix: 'LeafAtlas_', x: 1.55, y: .16, z: 2.3, yaw: -8},
  {role: 'bubble', title: '泡泡龟', prefix: 'BubbleAtlas_', x: 2.05, y: .16, z: -.3, yaw: -12},
];
const turtlePath = (role: HomeRole): string => `models/${role}-turtle/${role}-turtle/${role}-turtle`;
type Phase = 'loading' | 'ready' | 'failed' | 'destroyed';
interface DisplayActor {model: Node; animations: SkeletalAnimation[]; remaining: number}
export interface HomeWorldOptions {reducedMotion?: boolean}

/** A display-only home scene. It reads no battle rules, collection or save state. */
export class HomeWorld {
  private readonly root: Node;
  private readonly adapter: TurtleMaterialAdapter;
  private readonly prefabs = new Map<string, Prefab>();
  private readonly pending = new Set<string>([HOME_ENVIRONMENT_PATH, ...DISPLAYS.map(display => turtlePath(display.role))]);
  private readonly actors = new Map<HomeRole, DisplayActor>();
  private phase: Phase = 'loading';
  private failure?: Error;
  private visible = false;
  private paused = false;
  private reducedMotion = false;
  private skeletonsStarted = false;
  private oceanMesh?: Mesh;
  private oceanMaterial?: Material;
  private readonly onRootDestroyed = (): void => this.destroy();

  get ready(): boolean { return this.phase === 'ready' && isValid(this.root, true) && isValid(this.parent, true); }
  get error(): Error | undefined { return this.failure; }
  get loadProgress(): {loaded: number; total: number} { return {loaded: this.prefabs.size, total: DISPLAYS.length + 1}; }

  constructor(private readonly parent: Node, private readonly pipelineMaterial: Material, options: HomeWorldOptions = {}) {
    if (!isValid(parent, true)) throw new Error('首页展示的父节点已销毁');
    this.reducedMotion = !!options.reducedMotion;
    this.adapter = new TurtleMaterialAdapter(pipelineMaterial, DISPLAYS.map(display => display.prefix));
    this.root = new Node('首页五龟展示');
    this.root.layer = Layers.Enum.DEFAULT;
    this.root.active = false;
    this.root.setParent(parent);
    this.root.once(Node.EventType.NODE_DESTROYED, this.onRootDestroyed);
    for (const path of Array.from(this.pending)) {
      if (this.phase !== 'loading') break;
      try {
        resources.load(path, Prefab, (error, prefab) => this.loaded(path, error, prefab));
      } catch (error) { this.fail(error); }
    }
  }

  /** Visibility is requested explicitly; no partially loaded garden is shown. */
  setVisible(visible: boolean): void {
    if (this.phase === 'destroyed' || this.phase === 'failed') return;
    if (this.visible === visible) return;
    this.visible = visible;
    this.syncVisibility();
  }

  /** Background/modals pause both the skeletons and greeting completion timer. */
  setPaused(paused: boolean): void {
    if (this.phase === 'destroyed' || this.phase === 'failed') return;
    if (!isValid(this.parent, true) || !isValid(this.root, true)) { this.destroy(); return; }
    if (this.paused === paused) return;
    this.paused = paused;
    this.syncSkeletons();
  }

  /** Settings take effect immediately, including a greeting already in progress. */
  setReducedMotion(reduced: boolean): void {
    if (this.phase === 'destroyed' || this.phase === 'failed') return;
    if (!isValid(this.parent, true) || !isValid(this.root, true)) { this.destroy(); return; }
    if (this.reducedMotion === reduced) return;
    this.reducedMotion = reduced;
    if (reduced) for (const actor of this.actors.values()) {
      if (actor.remaining <= 0) continue;
      actor.remaining = 0;
      this.play(actor, 'idle');
    }
  }

  /** One original fusion hop per idle actor; repeat taps do not restart it. */
  greet(role?: HomeRole): boolean {
    if (!this.canAnimate() || this.reducedMotion) return false;
    let started = false;
    for (const [kind, actor] of this.actors) {
      if ((role && kind !== role) || actor.remaining > 0) continue;
      actor.remaining = this.play(actor, 'fusion');
      started = true;
    }
    return started;
  }

  update(dt: number): void {
    // The owner may itself have been inactive when visibility was requested.
    // Its first active frame is also safe: engine onLoad has now initialized states.
    if (this.ready && !this.skeletonsStarted) this.syncSkeletons();
    if (!this.canAnimate() || !Number.isFinite(dt) || dt <= 0) return;
    // Use full engine dt, like the skeleton clock, rather than a capped interpolation step.
    for (const actor of this.actors.values()) {
      if (actor.remaining <= 0) continue;
      actor.remaining = Math.max(0, actor.remaining - dt);
      if (actor.remaining === 0) this.play(actor, 'idle');
    }
  }

  destroy(): void {
    if (this.phase === 'destroyed') return;
    this.phase = 'destroyed';
    this.releaseOwned();
  }

  private loaded(path: string, error: Error | null, prefab?: Prefab): void {
    if (this.phase !== 'loading') return;
    if (!isValid(this.parent, true) || !isValid(this.root, true)) { this.destroy(); return; }
    if (!this.pending.delete(path)) return; // Ignore duplicate host callbacks.
    if (error || !prefab) { this.fail(error || new Error(`首页资源为空：${path}`)); return; }
    try {
      prefab.addRef();
      this.prefabs.set(path, prefab);
      if (this.pending.size === 0) this.assemble();
    } catch (error) { this.fail(error); }
  }

  private assemble(): void {
    const environment = instantiate(this.prefabs.get(HOME_ENVIRONMENT_PATH)!);
    environment.name = '首页海岛';
    environment.setParent(this.root);
    this.worldLayer(environment);
    receiveIslandShadows(environment);
    this.createOcean();
    for (const display of DISPLAYS) {
      const model = instantiate(this.prefabs.get(turtlePath(display.role))!);
      model.name = `${display.title} · 首页展示`;
      model.setParent(this.root);
      model.setPosition(display.x, display.y, display.z);
      model.setRotationFromEuler(0, display.yaw, 0);
      model.setScale(.65, .65, .65);
      this.worldLayer(model);
      receiveIslandShadows(model);
      this.adapter.apply(model);
      const animations = model.getComponentsInChildren(SkeletalAnimation);
      if (!animations.length || animations.some(animation => ['idle', 'fusion'].some(action => {
        const clip = animation.clips.find(candidate => candidate?.name.endsWith(`|${action}`));
        return !clip || !Number.isFinite(clip.duration) || clip.duration <= 0;
      }))) throw new Error(`${display.title}首页待机或招呼动作缺失`);
      const actor: DisplayActor = {model, animations, remaining: 0};
      this.actors.set(display.role, actor);
    }
    this.phase = 'ready';
    this.syncVisibility();
  }

  private play(actor: DisplayActor, action: 'idle' | 'fusion'): number {
    let duration = 0;
    for (const animation of actor.animations) {
      const clip = animation.clips.find(candidate => candidate?.name.endsWith(`|${action}`))!;
      const state = animation.getState(clip.name);
      if (!state) throw new Error(`首页动作无法播放：${clip.name}`);
      state.wrapMode = action === 'idle' ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;
      animation.play(clip.name);
      if (this.paused || !this.visible || this.phase !== 'ready') animation.pause();
      duration = Math.max(duration, clip.duration);
    }
    return duration;
  }

  private canAnimate(): boolean {
    return this.ready && this.skeletonsStarted && this.visible && !this.paused && this.root.activeInHierarchy;
  }

  private syncVisibility(): void {
    if (!isValid(this.root, true) || !isValid(this.parent, true)) { this.destroy(); return; }
    this.root.active = this.phase === 'ready' && this.visible;
    this.syncSkeletons();
  }

  private syncSkeletons(): void {
    if (!isValid(this.root, true) || !isValid(this.parent, true)) { this.destroy(); return; }
    if (!this.skeletonsStarted) {
      if (this.phase !== 'ready' || !this.root.activeInHierarchy) return;
      // Cocos 3.8.8 initializes serialized clips in Animation.onLoad. Activating
      // the complete root invokes that lifecycle synchronously, before this call.
      // Creating/playing states while hidden is unsafe: onLoad replaces them.
      try {
        for (const actor of this.actors.values()) this.play(actor, 'idle');
        this.skeletonsStarted = true;
      } catch (error) { this.fail(error); return; }
    }
    const pause = this.paused || !this.visible || this.phase !== 'ready' || !this.root.activeInHierarchy;
    for (const actor of this.actors.values()) for (const animation of actor.animations) {
      if (!isValid(animation, true) || !isValid(animation.node, true)) continue;
      if (pause) animation.pause(); else animation.resume();
    }
  }

  private createOcean(): void {
    const ocean = new Node('首页外海');
    ocean.setParent(this.root); ocean.layer = Layers.Enum.DEFAULT;
    // Top surface is the authored waterY=-.72; the real island covers its center.
    ocean.setPosition(0, -.745, 0); ocean.setScale(64, .05, 48);
    this.oceanMesh = utils.createMesh(primitives.box());
    this.oceanMaterial = new Material();
    this.oceanMaterial.copy(this.pipelineMaterial, {technique: 0, defines: {USE_ALBEDO_MAP: false, USE_PBR_MAP: false}});
    this.oceanMaterial.setProperty('mainColor', new Color(89, 157, 166, 255));
    this.oceanMaterial.setProperty('roughness', .7);
    this.oceanMaterial.setProperty('metallic', 0);
    const renderer = ocean.addComponent(MeshRenderer);
    renderer.mesh = this.oceanMesh; renderer.setMaterial(this.oceanMaterial, 0);
  }

  private worldLayer(node: Node): void {
    node.layer = Layers.Enum.DEFAULT;
    for (const child of node.children) this.worldLayer(child);
  }

  private fail(reason: unknown): void {
    if (this.phase === 'destroyed' || this.phase === 'failed') return;
    this.failure = reason instanceof Error ? reason : new Error(String(reason));
    this.phase = 'failed';
    this.releaseOwned();
  }

  private releaseOwned(): void {
    // Release adapter bindings before retiring nodes, preserving source ownership.
    this.adapter.destroy();
    this.actors.clear();
    this.pending.clear();
    if (isValid(this.root)) this.root.off(Node.EventType.NODE_DESTROYED, this.onRootDestroyed);
    if (isValid(this.root, true)) {
      this.root.active = false;
      this.root.removeFromParent();
      this.root.destroy();
    }
    for (const prefab of this.prefabs.values()) prefab.decRef();
    this.prefabs.clear();
    this.oceanMesh?.destroy(); this.oceanMesh = undefined;
    this.oceanMaterial?.destroy(); this.oceanMaterial = undefined;
  }
}
