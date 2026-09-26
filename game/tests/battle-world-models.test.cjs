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
if (!ts) throw new Error('Model lifecycle tests require the installed Cocos TypeScript compiler');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../assets/scripts/', file), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;
const worldCode = compile('view/BattleWorld.ts'), adapterCode = compile('view/TurtleMaterialAdapter.ts'), dataCode = compile('core/data.ts');
const screenCode = compile('view/BattleScreen.ts'), battleCode = compile('core/battle.ts'), randomCode = compile('core/random.ts'), fusionCode = compile('core/fusion.ts');
const INK = 'models/enemies/ink-blob/ink-blob/ink-blob';
const RUNNER = 'models/enemies/runner-crab/runner-crab/runner-crab';
const STONE = 'models-modern/stone-turtle/stone-turtle/stone-turtle';
const SPIKE = 'models-modern/spike-turtle/spike-turtle/spike-turtle';
const CRYSTAL = 'models-modern/crystal-turtle/crystal-turtle/crystal-turtle';
const LEAF = 'models-modern/leaf-turtle/leaf-turtle/leaf-turtle';
const BUBBLE = 'models-modern/bubble-turtle/bubble-turtle/bubble-turtle';
const ARMORED = 'models/enemies/armored-crab/armored-crab/armored-crab';
const MIST = 'models/enemies/mist-bubble/mist-bubble/mist-bubble';
const SNAIL = 'models/enemies/ink-snail/ink-snail/ink-snail';
const ELITE = 'models/enemies/shell-carrier/shell-carrier/shell-carrier';
const BOSS = 'models/enemies/giant-claw/giant-claw/giant-claw';
const DURATIONS = {idle: 2, walk: 16 / 30, attack: 23 / 30, hit: .5, exit: 25 / 30};
const RUNNER_DURATIONS = {idle: 2, walk: .4, attack: .7, hit: .5, exit: .8};
const ARMORED_DURATIONS = {idle: 2.4, walk: .8, attack: 1.1, hit: .5, exit: .9};

/**
 * Real transpiled BattleWorld + material adapter, with a deliberately small host.
 * Resources complete only when a test resolves them. Node.destroy is deferred
 * until flushDestroyed(), including strict validity and NODE_DESTROYED cleanup.
 * An explicit mock engine clock checks pause contracts; it does not sample bones.
 * There is no GPU, importer or actual Cocos animation clock here.
 */
function fixture(t) {
  const nodes = [], assets = [], pendingDestroy = [], loads = [], instances = [], playback = [];
  let now = 0;
  class Asset {
    constructor(name = '') { this.name = name; this.refs = 1; this.isValid = true; this.destroyed = 0; assets.push(this); }
    addRef() { assert.ok(this.isValid); this.refs++; return this; }
    decRef() { assert.ok(this.refs > 0, `${this.name}: reference underflow`); this.refs--; return this; }
    destroy() { assert.equal(this.destroyed, 0, `${this.name}: duplicate destruction`); this.destroyed++; this.isValid = false; return true; }
  }
  class Texture2D extends Asset {}
  class Mesh extends Asset {}
  class Prefab extends Asset { constructor(name, kind, source) { super(name); this.kind = kind; this.source = source; } }
  class Material extends Asset {
    constructor(name) { super(name); this.effectName = 'builtin-standard'; this.technique = 0; this.props = {}; this.defines = {}; }
    copy(source, overrides = {}) { this.effectName = source.effectName; this.technique = overrides.technique ?? source.technique; this.props = {...source.props}; this.defines = {...source.defines, ...overrides.defines}; }
    recompileShaders(defines){Object.assign(this.defines,defines);}
    setProperty(name, value) { this.props[name] = value; }
    getProperty(name) { return this.props[name] ?? null; }
  }
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { if (typeof x === 'object') ({x, y, z} = x); Object.assign(this, {x, y, z}); return this; }
    static transformMat4(out, point) { return out.set(point); } // Battlefield root is identity in these fixtures.
    static lerp(out, a, b, u) { return out.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u); }
    static distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  }
  class Vec4 extends Vec3 { constructor(x = 0, y = 0, z = 0, w = 0) { super(x, y, z); this.w = w; } }
  class Color {
    constructor(r = 255, g = 255, b = 255, a = 255) { Object.assign(this, {r, g, b, a}); }
    static fromHEX(out, hex) { const n = parseInt(hex.replace('#', ''), 16); Object.assign(out, {r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 255}); return out; }
  }
  class Node extends EventEmitter {
    static EventType = {NODE_DESTROYED: 'destroyed', TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel'};
    constructor(name) {
      super(); this.name = name; this.children = []; this.components = []; this.active = true; this.isValid = true; this.pending = false;
      this.position = new Vec3(); this.scale = new Vec3(1, 1, 1); this.eulerAngles = new Vec3(); this.worldRotation = {x: 0, y: 0, z: 0, w: 1}; this.worldMatrix = {};
      nodes.push(this);
    }
    setParent(parent) { assert.ok(parent.isValid && !parent.pending, 'no attachment to a retiring parent'); this.removeFromParent(); this.parent = parent; parent.children.push(this); }
    removeFromParent() { if (this.parent) { this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; } }
    setPosition(x, y, z) { this.position.set(x, y, z); }
    setScale(x, y, z) { this.scale.set(x, y, z); }
    setRotationFromEuler(x, y, z) { this.eulerAngles.set(x, y, z); }
    setWorldRotation(x, y, z, w) { this.worldRotation = {x, y, z, w}; }
    lookAt() {}
    addComponent(Type) { const value = new Type(); value.node = this; this.components.push(value); return value; }
    getComponent(Type) { return this.components.find(value => value instanceof Type) ?? null; }
    getComponentsInChildren(Type) { return [...this.components.filter(value => value instanceof Type), ...this.children.flatMap(child => child.getComponentsInChildren(Type))]; }
    getComponentInChildren(Type) { return this.getComponentsInChildren(Type)[0] ?? null; }
    off(type, listener) { return listener ? super.off(type, listener) : this.removeAllListeners(type); }
    destroy() { if (!this.isValid || this.pending) return false; this.pending = true; pendingDestroy.push(this); return true; }
  }
  class MeshRenderer {
    constructor() { this.sharedMaterials = []; this.isValid = true; }
    setMaterial(material, slot) { this.setSharedMaterial(material, slot); }
    setSharedMaterial(material, slot) { assert.ok(this.node.isValid && !this.node.pending, 'no material mutation on a retiring renderer'); this.sharedMaterials[slot] = material; }
    getSharedMaterial(slot) { return this.sharedMaterials[slot] ?? null; }
  }
  const AnimationClip = {WrapMode: {Normal: 1, Loop: 2}};
  class SkeletalAnimation {
    constructor() { this.clips = []; this.states = new Map(); this.current = null; this.paused = false; this.pauseCalls = 0; this.resumeCalls = 0; }
    getState(name) {
      if (!this.states.has(name)) this.states.set(name, {name, duration: this.clips.find(clip => clip.name === name).duration, wrapMode: AnimationClip.WrapMode.Loop});
      return this.states.get(name);
    }
    play(name) { assert.ok(this.node.isValid && !this.node.pending); this.current = this.getState(name); this.current.time = 0; this.paused = false; playback.push({animation: this, name, time: now}); return this.current; }
    pause() { assert.ok(this.node.isValid && !this.node.pending); this.paused = true; this.pauseCalls++; }
    resume() { assert.ok(this.node.isValid && !this.node.pending); this.paused = false; this.resumeCalls++; }
  }
  const resources = {load(name, Type, callback) { assert.equal(Type, Prefab); loads.push({name, callback, done: false}); }};
  function instantiate(prefab) {
    const model = new Node(prefab.name), rig = new Node('Rig'), surface = new Node('Skin'); rig.setParent(model); surface.setParent(rig);
    const animation = rig.addComponent(SkeletalAnimation);
    const durations = {ink: DURATIONS, runner: RUNNER_DURATIONS, armored: ARMORED_DURATIONS,
      mist:{idle:2.4,walk:.8,attack:1.2,hit:.6,exit:1},snail:{idle:2.8,walk:1.2,attack:1.2,hit:.6,exit:1.1},
      elite:{idle:2.8,walk:32/30,attack:1.3,hit:.6,exit:1.1},
      boss:{idle:2.8,walk:1.2,attack:.5,hit:.5,exit:1.2},
      crystal:{idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30},
      leaf:{idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30},
      bubble:{idle:71/30,attack:26/30,skill:41/30,hit:17/30,rest:71/30,fusion:59/30},
    }[prefab.kind] ?? {idle: 2, attack: .87, skill: 1.37, hit: .57, rest: 2, fusion: 2};
    const prefix = {ink: 'InkBlob', runner: 'RunnerCrab', armored: 'ArmoredCrab', mist:'MistBubble', snail:'InkSnail', elite:'ShellCarrier', boss:'GiantClaw', stone: 'StoneTurtle', spike: 'SpikeTurtle', crystal:'CrystalTurtle', leaf:'LeafTurtle', bubble:'BubbleTurtle'}[prefab.kind];
    animation.clips = Object.entries(durations).map(([action, duration]) => ({name: `${prefix}_Rig|${action}`, duration}));
    surface.addComponent(MeshRenderer).setSharedMaterial(prefab.source, 0);
    instances.push({prefab, model, animation, surface, createdAt: now}); return model;
  }
  class Label { static Overflow = {CLAMP: 1}; constructor() { this.string = ''; } }
  class Graphics { circle() {} ellipse() {} fill() {} stroke() {} }
  const cc = {AnimationClip, Camera: class {}, Color, Graphics, Label, instantiate, Layers: {Enum: {DEFAULT: 1}}, Material, Mesh, MeshRenderer, Node, Prefab, resources, SkeletalAnimation, Texture2D, Vec3, Vec4,
    view: {getVisibleSize: () => ({width: 1280, height: 720})},
    isValid: (value, strict) => !!value?.isValid && !(strict && value.pending),
    primitives: Object.fromEntries(['box', 'sphere', 'cylinder', 'cone', 'torus'].map(name => [name, () => ({name})])),
    utils: {createMesh: geometry => new Mesh(geometry.name)},
  };
  const log = {error() {}, warn() {}, info() {}};
  const modules = {};
  const load = (code, resolve) => { const module = {exports: {}}; vm.runInNewContext(code, {module, exports: module.exports, console: log, require: resolve}); return module.exports; };
  modules.adapter = load(adapterCode, name => { assert.equal(name, 'cc'); return cc; });
  modules.data = load(dataCode, name => { if(['./campaign','./tacticalMaps','./approvedCoast','./mapPresentation'].includes(name))return require('../.test-build/core/'+path.basename(name)+'.js');throw new Error(`Unexpected data runtime dependency ${name}`); });
  const {BattleWorld} = load(worldCode, name => {
    if(name==='./BubbleShimmer')return {BubbleShimmer:class{}};if(name==='../core/rewardPacks'||name==='../core/development')return require('../.test-build/core/'+path.basename(name)+'.js');if (name === 'cc') return cc;
    if(['../core/bossCatalog','../core/prototypeConfig'].includes(name))return require('../.test-build/core/'+path.basename(name)+'.js');if (name === '../core/data') return modules.data;
    if (name === './TurtleMaterialAdapter') return modules.adapter;
    if(name==='./ModernIsland')return{modernIslandMesh:()=>new Mesh('modern-terrain')};
    if(name==='./BattlePaint')return load(compile('view/BattlePaint.ts'),name=>name==='../core/mapPresentation'?require('../.test-build/core/mapPresentation.js'):cc);
    if(name==='./VisualIdentity')return{HERO_LOOK:Object.fromEntries(['stone','spike','crystal','leaf','bubble'].map(r=>[r,{accent:'#22BBDD'}]))};
    if (name === './WorldLighting') return {receiveIslandShadows() {}};
    throw new Error(`Unexpected view dependency ${name}`);
  });
  const pipeline = new Material('PipelineStandard');
  const source = kind => {
    const material = new Material({ink: 'InkBlob_Toy_Atlas', runner: 'RunnerCrab_Toy_Atlas', armored: 'ArmoredCrab_Toy_Atlas', mist:'MistBubble_Toy_Atlas', snail:'InkSnail_Toy_Atlas', elite:'ShellCarrier_Toy_Atlas', boss:'GiantClaw_Toy_Atlas', stone: 'StoneAtlas_01', spike: 'SpikeAtlas_01', crystal:'CrystalAtlas_01', leaf:'LeafAtlas_01', bubble:'BubbleAtlas_01'}[kind]); material.effectName = 'util/dcc/imported-specular-glossiness';
    material.props = {mainTexture: new Texture2D(`${kind}-colour`), shininessExponentMap: new Texture2D(`${kind}-roughness`), tilingOffset: new Vec4(1, 1, 0, 0)};
    return material;
  };
  const inkMaterial = source('ink'), stoneMaterial = source('stone'), runnerMaterial = source('runner');
  const spikeMaterial = source('spike'), armoredMaterial = source('armored');
  const crystalMaterial=source('crystal'),mistMaterial=source('mist'),snailMaterial=source('snail'),eliteMaterial=source('elite');
  const leafMaterial=source('leaf'),bubbleMaterial=source('bubble');
  const bossMaterial=source('boss');
  const parent = new Node('battle owner'), camera = {node: new Node('camera'), convertToUINode: point => point};
  const world = new BattleWorld(parent, camera, pipeline);
  function flushDestroyed() {
    function mark(node) { node.pending = true; for (const child of node.children) mark(child); }
    function finish(node) {
      if (!node.isValid) return;
      for (const child of [...node.children]) finish(child);
      node.emit(Node.EventType.NODE_DESTROYED); node.removeAllListeners();
      for (const component of node.components) component.isValid = false;
      node.isValid = false; node.removeFromParent(); node.children = [];
    }
    for (const node of pendingDestroy.splice(0)) if (node.isValid) { mark(node); finish(node); }
  }
  function resolve(kind, error = false) {
    const entry = loads.find(load => load.name === {ink: INK, runner: RUNNER, armored: ARMORED, mist:MIST, snail:SNAIL, elite:ELITE, boss:BOSS, stone: STONE, spike: SPIKE, crystal:CRYSTAL, leaf:LEAF, bubble:BUBBLE}[kind] && !load.done);
    assert.ok(entry, `Pending ${kind} resource`); entry.done = true;
    const prefab = error ? null : new Prefab(`${kind}-prefab`, kind, {ink: inkMaterial, runner: runnerMaterial, armored: armoredMaterial, mist:mistMaterial, snail:snailMaterial, elite:eliteMaterial, boss:bossMaterial, stone: stoneMaterial, spike: spikeMaterial, crystal:crystalMaterial, leaf:leafMaterial, bubble:bubbleMaterial}[kind]);
    entry.callback(error ? new Error('controlled load failure') : null, prefab); return prefab;
  }
  const f = {world, parent, nodes, assets, loads, instances, playback, pipeline, inkMaterial, stoneMaterial, runnerMaterial, spikeMaterial, armoredMaterial, crystalMaterial, mistMaterial, snailMaterial, eliteMaterial, leafMaterial, bubbleMaterial, bossMaterial, resolve, flushDestroyed,
    render(battle, dt = .05, events = []) { now += dt; world.update(battle, events, dt); },
    actor(id = 'ink-a') { const node = world.enemies.get(id); assert.ok(node, `actor ${id} exists`); return node; },
    model(id = 'ink-a') { return f.actor(id).body.children.find(node => node.name.endsWith(' · 原创模型')); },
    animation(id = 'ink-a') { return f.model(id)?.getComponentsInChildren(SkeletalAnimation)[0]; },
    time() { return now; },
    // Explicit engine stepping is independent from BattleScreen.update, as in Cocos.
    advanceEngine(dt) {
      for (const {animation, model} of instances) {
        let active = model.isValid;
        for (let node = model; node; node = node.parent) active &&= node.active && !node.pending;
        if (active && animation.current && !animation.paused) animation.current.time += dt*(animation.current.speed??1);
      }
    },
    screen({restored = false, phase = restored ? 'combat' : 'prep'} = {}) {
      modules.random ??= load(randomCode, name => { throw new Error(`Unexpected random dependency ${name}`); });
      const coreRequire = name => { if(name==='./bossCatalog')return require('../.test-build/core/bossCatalog.js');if (name === './data') return modules.data; if (name === './random') return modules.random; if(name==='./development')return require('../.test-build/core/development.js');if(name==='./talents')return require('../.test-build/core/talents.js'); if(name==='./multiFront'||name==='./prototypeConfig'||name==='./tacticalMaps'||name==='./placement')return require('../.test-build/core/'+path.basename(name)+'.js'); throw new Error(`Unexpected core dependency ${name}`); };
      modules.battle ??= load(battleCode, name => name==='./releaseBalance' ? require('../.test-build/core/releaseBalance.js') : coreRequire(name)); modules.fusion ??= load(fusionCode, coreRequire);
      const turtle = {id: 'stone-source', role: 'stone', name: '石头龟', skills: [], innate: {attack: 76, health: 76, defense: 76, growth: 100}, training: {attack: 0, health: 0, defense: 0, growth: 0}, generation: 0, parentIds: []};
      const runUnit = {id: 'stone-a', turtle, level: 1, slot: 0, sources: []};
      const run = {id: 'test-run', levelId: 0, phase, wave: 0, combatSeconds: 0, coreHealth: 20, units: {'stone-a': runUnit}, selectedSources: [], usedSources: [], recruitCandidates: [], merges: {}, mergeWavesUsed: [], recruitAvailable: true};
      if (restored) run.battle = modules.battle.createBattle(0, 1, [runUnit], {seed: 123});
      const snapshot = {run, settings:{autoSkills:true}, collection: {}, results: {}};
      const errors = [], calls = {checkpoint: 0, home: 0, audioPause: 0, audioResume: 0};
      const service = {snapshot,
        beginWave(id, runId, value) { run.phase = 'combat'; run.battle = value; },
        checkpointBattle() { calls.checkpoint++; if (calls.failCheckpoint) throw new Error('checkpoint failed'); },
        collectionPreview() { if (calls.failPreview) throw new Error('preview failed'); return {candidate: turtle, sources: [], lockedSources: [], alreadySaved: false}; },
        mergePreview() { return []; },
        completeWave(id, runId, value) { run.wave++; run.phase = 'between'; run.battle = undefined; },
        abandonRun() { run.phase = 'result'; snapshot.results[run.id] = {victory: false, waves: 0, combatSeconds: 0, baseGold: 0, firstClearGold: 0, materials: {}}; },
      };
      const buttons = new Map(), uiRoot = new Node('ui root');
      const make = (name, x, y, parent = uiRoot) => { const node = new Node(name); node.setPosition(x, y, 0); node.setParent(parent); return node; };
      const ui = {root: uiRoot,
        click() {},
        isInteractive(node) { for (let current=node; current; current=current.parent) { if (!cc.isValid(current,true)||!current.active) return false; if (current===uiRoot) return true; } return false; },
        clear() { buttons.clear(); for (const child of [...uiRoot.children]) { child.removeFromParent(); child.destroy(); } },
        panel(x, y, width, height, parent = uiRoot) { return make('panel', x, y, parent); },
        group(name, x, y, parent = uiRoot) { return make(name, x, y, parent); },
        modal(title) { return make(title, 0, 0); },
        sheet(title) { return make(title, 0, 0); },dialog(title){return make(title,0,0);},pet(){},skillDetail(){},
        label(text, x, y, size, color, parent = uiRoot) { const label = make('label', x, y, parent).addComponent(Label); label.string = text; return label; },
        text(...args) { const label=this.label(...args); label.overflow=Label.Overflow.CLAMP; return label; },
        button(text, x, y, width, height, callback, options = {}) { const node = make(text, x, y, options.parent ?? uiRoot); buttons.set(text, {callback, options}); return node; },
        roleMark() {}, portrait() {}, skillPill() {},
      };
      const audio = {pause() { calls.audioPause++; }, resume() { calls.audioResume++; }, playMusic() { return Promise.resolve(); }, effect() {}, battleEvents() {}};
      const {BattleScreen} = load(screenCode, name => {
        if(name==='./BubbleShimmer')return {BubbleShimmer:class{}};if(name==='../core/rewardPacks'||name==='../core/development')return require('../.test-build/core/'+path.basename(name)+'.js');if (name === 'cc') return cc;
        if (name === '../core/game') return {displayName: value => value.name};
        if (name === '../core/battle') return modules.battle;
        if(['../core/bossCatalog','../core/prototypeConfig','../core/placement'].includes(name))return require('../.test-build/core/'+path.basename(name)+'.js');if (name === '../core/data') return modules.data;
        if (name === '../core/fusion') return modules.fusion;
        if (name === '../core/multiFront'||name === '../core/economy'||name === '../core/prototype'||name==='../core/prototypeConfig'||name==='../core/waveTactics') return require('../.test-build/core/'+path.basename(name)+'.js');
        if (name === './BubbleReveal') return {}; // Legacy wave/resource lifecycle fixture.
        if (name === './VisualIdentity') return {visualName: value => value.name};
        if (name === './IslandUI') return {color: value => value, UI_COLORS: {}};
        if(name==='./ActiveSkillControls')return {ActiveSkillControls:class{render(){}update(){}}};throw new Error(`Unexpected screen runtime dependency ${name}`);
      });
      const screen = new BattleScreen({}, service, ui, world, camera, audio, kind => kind, () => { calls.home++; screen.destroy(); }, error => errors.push(error));
      return {screen, service, run, turtle, runUnit, buttons, errors, calls,
        click(text) { const button = buttons.get(text); assert.ok(button && !button.options.disabled, `enabled button ${text}`); button.callback(); },
        frame(dt) { now += dt; screen.update(dt); f.advanceEngine(dt); },
      };
    },
  };
  t.after(() => { world.destroy(); flushDestroyed(); });
  return f;
}
const enemy = (overrides = {}) => ({id: 'ink-a', kind: 'ink', x: 0, z: 0, distance: 0, hp: 120, maxHp: 120, alive: true, statuses: [], ...overrides});
const battle = (enemies = [enemy()], overrides = {}) => ({levelId: 0, wave: 1, tick: 1, units: [], enemies, ...overrides});
const values = v => [v.x, v.y, v.z];
const current = (f, id) => f.animation(id)?.current?.name.split('|').at(-1);
const unit = (overrides = {}) => ({id: 'stone-a', role: 'stone', x: -5, z: 1, hp: 100, maxHp: 100, shield: 0, alive: true, statuses: [], ...overrides});

function pendingKinds(f){
  const paths={ink:INK,runner:RUNNER,armored:ARMORED,mist:MIST,snail:SNAIL,elite:ELITE,boss:BOSS,stone:STONE,spike:SPIKE,crystal:CRYSTAL,leaf:LEAF,bubble:BUBBLE};
  return f.loads.filter(load=>!load.done).map(load=>{
    const kind=Object.keys(paths).find(kind=>paths[kind]===load.name);
    assert.ok(kind,`fixture must describe every configured model: ${load.name}`);return kind;
  });
}

test('所有模型就绪才可显示：隐藏期间骨骼不推进，最后资源完成后一次性进入',t=>{
  const f=fixture(t);f.world.setVisible(false);assert.equal(f.world.modelsReady,false);
  const kinds=pendingKinds(f).reverse(),prefabs=[];
  for(let i=0;i<kinds.length;i++){
    prefabs.push(f.resolve(kinds[i]));assert.equal(f.world.modelsReady,i===kinds.length-1);
  }
  f.render(battle([],{units:[unit(),unit({id:'crystal-a',role:'crystal',x:0,z:1})]}));
  const crystal=f.instances.find(value=>value.prefab.kind==='crystal');
  assert.equal(crystal.model.name,'水晶龟 · 原创模型');assert.deepEqual(values(crystal.model.scale),[.8,.8,.8]);
  const material=crystal.surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.crystalMaterial.props.mainTexture);assert.equal(material.effectName,'builtin-standard');
  f.advanceEngine(.2);assert.equal(crystal.animation.current.time,0);
  f.world.setVisible(true);f.advanceEngine(.2);assert.equal(crystal.animation.current.time,.2);
  f.world.destroy();f.flushDestroyed();assert.equal(f.world.modelsReady,false);
  for(const prefab of prefabs)assert.equal(prefab.refs,1);
});

test('任意模型失败阻止准备完成，其余迟到成功仍可安全回收',t=>{
  const f=fixture(t);f.resolve('crystal',true);
  for(const kind of pendingKinds(f))f.resolve(kind);
  assert.equal(f.world.modelsReady,false);assert.match(f.world.loadingError.message,/controlled load failure/);
  f.world.destroy();f.flushDestroyed();
  for(const asset of f.assets.filter(asset=>asset.name.endsWith('-prefab')))assert.equal(asset.refs,1);
});

test('叶子龟治疗和技能播放自身动作，休整跨暂停保持独立图集与引用',t=>{
  const f=fixture(t),prefab=f.resolve('leaf');
  const leaf=unit({id:'leaf-a',role:'leaf',x:-1,z:1});
  f.render(battle([],{units:[unit(),leaf]}));
  const actor=f.world.units.get('leaf-a');
  const {model,animation,surface}=f.instances.find(value=>value.prefab.kind==='leaf');
  assert.equal(model.name,'叶子龟 · 原创模型');assert.deepEqual(values(model.scale),[.8,.8,.8]);
  assert.equal(actor.bar.position.y,2.22);assert.equal(actor.control.position.y,1.94);
  const material=surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.leafMaterial.props.mainTexture);
  assert.equal(material.props.pbrMap,f.leafMaterial.props.shininessExponentMap);
  f.render(battle([],{tick:2,units:[unit(),leaf]}),.05,[{id:1,tick:2,type:'attack',effect:'heal',sourceId:'leaf-a',targetId:'stone-a'}]);
  assert.equal(animation.current.name,'LeafTurtle_Rig|attack');assert.equal(actor.actionTime,26/30);
  f.render(battle([],{tick:3,units:[unit(),leaf]}),.05,[{id:2,tick:3,type:'skill',skillId:'greatHeal',sourceId:'leaf-a'}]);
  assert.equal(animation.current.name,'LeafTurtle_Rig|skill');assert.equal(actor.actionTime,41/30);
  f.world.setPaused(true);f.advanceEngine(2);assert.equal(animation.current.time,0);
  f.world.setPaused(false);f.advanceEngine(.4);assert.equal(animation.current.time,.4);
  f.render(battle([],{tick:4,units:[unit(),{...leaf,hp:0,alive:false}]}));
  assert.equal(animation.current.name,'LeafTurtle_Rig|rest');assert.equal(animation.current.wrapMode,2);
  f.world.setPaused(true);f.advanceEngine(2);assert.equal(animation.current.time,0);
  f.world.destroy();f.flushDestroyed();assert.equal(model.isValid,false);
  assert.equal(prefab.refs,1);assert.equal(f.leafMaterial.refs,1);
});

test('泡泡龟迟到加载独立图集，控制技能与护盾可见，暂停休整后单独回收',t=>{
  const f=fixture(t),leafPrefab=f.resolve('leaf'),inkPrefab=f.resolve('ink');
  const leaf=unit({id:'leaf-a',role:'leaf',x:-1,z:1}),bubble=unit({id:'bubble-a',role:'bubble',x:2,z:1});
  const target=enemy({x:1.4,z:-.5}),units=[leaf,bubble];
  f.render(battle([target],{units}));
  const leafInstance=f.instances.find(value=>value.prefab.kind==='leaf');
  const leafSkin=leafInstance.surface.components[0].getSharedMaterial(0);
  f.world.setPaused(true);const prefab=f.resolve('bubble');
  const actor=f.world.units.get('bubble-a');
  const {model,animation,surface}=f.instances.find(value=>value.prefab===prefab);
  assert.equal(model.name,'泡泡龟 · 原创模型');assert.deepEqual(values(model.scale),[.8,.8,.8]);
  assert.equal(actor.bar.position.y,2.28);assert.equal(actor.control.position.y,2.00);
  assert.equal(animation.current.name,'BubbleTurtle_Rig|idle');assert.equal(animation.current.duration,71/30);
  assert.equal(animation.paused,true,'late model inherits pause');
  const material=surface.components[0].getSharedMaterial(0);
  assert.equal(material.effectName,'builtin-standard');
  assert.equal(material.props.mainTexture,f.bubbleMaterial.props.mainTexture);
  assert.equal(material.props.pbrMap,f.bubbleMaterial.props.shininessExponentMap);
  assert.notEqual(material.props.mainTexture,leafSkin.props.mainTexture,'bubble cannot borrow leaf atlas');
  f.world.setPaused(false);
  const protectedUnits=[leaf,{...bubble,shield:20}],controlled={...target,statuses:[{kind:'root'}]};
  f.render(battle([controlled],{tick:2,units:protectedUnits}),.05,[
    {id:1,tick:2,type:'skill',skillId:'bubbleRing',sourceId:'bubble-a',targetId:'ink-a'},
    {id:2,tick:2,type:'control',sourceId:'bubble-a',targetId:'ink-a'},
    {id:3,tick:2,type:'shield',sourceId:'leaf-a',targetId:'bubble-a',amount:20},
  ]);
  assert.equal(animation.current.name,'BubbleTurtle_Rig|skill');assert.equal(actor.actionTime,41/30);
  assert.equal(animation.current.wrapMode,1);
  assert.equal(f.actor().control.active,true);assert.equal(actor.shieldRing.active,true);assert.equal(actor.shieldFill.active,true);
  const ring=f.world.effects.find(effect=>effect.active&&effect.kind==='ring'&&effect.priority===3);
  assert.ok(ring,'bubbleRing creates its visible control area');
  assert.deepEqual([ring.end.x,ring.end.z],[target.x,target.z],'area is centered on the target, not the turtle');
  f.world.setPaused(true);f.advanceEngine(2);
  f.render(battle([controlled],{tick:2,units:protectedUnits}),2);
  assert.equal(animation.current.time,0);assert.equal(actor.actionTime,41/30);
  f.world.setPaused(false);f.advanceEngine(.2);assert.equal(animation.current.time,.2);
  f.world.setPaused(true);
  f.render(battle([controlled],{tick:3,units:[leaf,{...bubble,alive:false,hp:0}]}));
  assert.equal(animation.current.name,'BubbleTurtle_Rig|rest');assert.equal(animation.current.duration,71/30);
  assert.equal(animation.current.wrapMode,2);assert.equal(animation.paused,true);
  f.advanceEngine(2);assert.equal(animation.current.time,0);
  f.world.syncRunUnits([{id:'leaf-a',turtle:{role:'leaf'},slot:0,level:1}]);f.flushDestroyed();
  assert.equal(model.isValid,false);assert.equal(material.isValid,false);assert.equal(f.bubbleMaterial.refs,1);
  assert.equal(leafInstance.model.isValid,true);assert.equal(leafSkin.isValid,true,'retiring bubble leaves leaf model/material intact');
  f.world.destroy();f.flushDestroyed();
  for(const resource of [prefab,leafPrefab,inkPrefab,f.bubbleMaterial,f.leafMaterial])assert.equal(resource.refs,1);
});

test('加载中销毁后即使所有资源到齐也不变为就绪、持有引用或创建模型',t=>{
  const f=fixture(t);f.world.destroy();const nodes=f.nodes.length;
  for(const kind of pendingKinds(f)){const prefab=f.resolve(kind);assert.equal(prefab.refs,1);}
  f.world.setVisible(true);assert.equal(f.world.modelsReady,false);assert.equal(f.nodes.length,nodes);assert.equal(f.instances.length,0);
});

test('吐墨螺独立材质与原地步态，暂停期间不缩短1.1秒真实退场',t=>{
  const f=fixture(t),prefab=f.resolve('snail');
  f.render(battle([enemy({kind:'snail'})]));
  assert.equal(f.model().name,'吐墨螺 · 原创模型');assert.deepEqual(values(f.model().scale),[.93,.93,.93]);
  assert.equal(f.actor().bar.position.y,1.02);
  const material=f.instances[0].surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.snailMaterial.props.mainTexture);
  f.render(battle([enemy({kind:'snail',x:.05,distance:.05})],{tick:2}));assert.equal(current(f),'walk');
  f.render(battle([enemy({kind:'snail',x:.05,distance:.05,hp:0,alive:false})],{tick:3}));
  const model=f.model();assert.equal(current(f),'exit');
  f.world.syncRunUnits([]);assert.equal(f.world.hasPendingExits,true);
  f.world.setPaused(true);f.world.updatePresentation(2);f.advanceEngine(2);assert.equal(model.pending,false);
  f.world.setPaused(false);f.world.updatePresentation(1.09);assert.equal(model.pending,false);
  f.world.updatePresentation(.02);f.flushDestroyed();assert.equal(model.isValid,false);
  f.world.destroy();f.flushDestroyed();assert.equal(prefab.refs,1);assert.equal(f.snailMaterial.refs,1);
});

test('搬壳大蟹真实模型不叠加临时缩放，独立图集与慢动作跨暂停后完整退场',t=>{
  const f=fixture(t),prefab=f.resolve('elite');
  f.render(battle([enemy({kind:'elite'})]));
  const actor=f.actor(),model=f.model(),animation=f.animation();
  assert.equal(model.name,'搬壳大蟹 · 原创模型');
  assert.deepEqual(values(model.scale),[1,1,1]);assert.deepEqual(values(actor.body.scale),[1,1,1]);
  assert.equal(actor.bar.position.y,1.36);assert.equal(actor.control.position.y,1.26);
  const material=f.instances[0].surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.eliteMaterial.props.mainTexture);
  assert.equal(material.props.pbrMap,f.eliteMaterial.props.shininessExponentMap);
  f.render(battle([enemy({kind:'elite',x:.03})],{tick:2}));
  assert.equal(current(f),'walk');assert.equal(animation.current.duration,32/30);
  f.render(battle([enemy({kind:'elite',x:.03})],{tick:3}),.05,[{id:1,tick:3,type:'attack',sourceId:'ink-a',x:1,z:0}]);
  assert.equal(current(f),'attack');assert.equal(animation.current.duration,1.3);
  f.world.setPaused(true);f.advanceEngine(2);assert.equal(animation.current.time,0);
  f.world.setPaused(false);f.render(battle([enemy({kind:'elite',x:.03})],{tick:4}),1.31);
  assert.equal(current(f),'idle');
  f.render(battle([enemy({kind:'elite',x:.03,alive:false,hp:0})],{tick:5}));
  assert.equal(current(f),'exit');assert.equal(actor.exitDuration,1.1);
  f.world.syncRunUnits([]);f.world.updatePresentation(1.09);assert.equal(model.pending,false);
  f.world.updatePresentation(.02);f.flushDestroyed();assert.equal(model.isValid,false);
  f.world.destroy();f.flushDestroyed();assert.equal(prefab.refs,1);assert.equal(f.eliteMaterial.refs,1);
});

test('首领短钳击驱动普通和特殊攻击，特效保留且五动作跨暂停完整退场',t=>{
  const f=fixture(t),prefab=f.resolve('boss');
  f.render(battle([enemy({kind:'boss'})]));
  const actor=f.actor(),model=f.model(),animation=f.animation();
  assert.equal(model.name,'巨钳蟹 · 原创模型');
  assert.deepEqual(values(model.scale),[1,1,1]);assert.deepEqual(values(actor.body.scale),[1,1,1]);
  assert.equal(actor.bar.position.y,1.52);assert.equal(actor.control.position.y,1.43);
  assert.equal(f.nodes.some(node=>node.name.startsWith('临时敌人资源')),false,'ready models do not allocate temporary bodies');
  const material=f.instances[0].surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.bossMaterial.props.mainTexture);
  assert.equal(material.props.pbrMap,f.bossMaterial.props.shininessExponentMap);
  f.render(battle([enemy({kind:'boss',x:.05})],{tick:2}));
  assert.equal(current(f),'walk');assert.equal(animation.current.duration,1.2);
  f.render(battle([enemy({kind:'boss',x:.05})],{tick:3}),.05,[{id:1,tick:3,type:'attack',sourceId:'ink-a',x:1,z:0}]);
  assert.equal(current(f),'attack');assert.equal(actor.actionTime,.5);
  for(const [i,effect] of ['crabSlam','crabSummon'].entries()){
    const tick=4+i;
    f.render(battle([enemy({kind:'boss',x:.05})],{tick}),.05,[{id:2+i,tick,type:'skill',effect,sourceId:'ink-a',x:1,z:0}]);
    assert.equal(current(f),'attack');assert.equal(actor.actionTime,.5);
    assert.ok(f.world.effects.some(item=>item.active&&item.kind==='ring'&&item.priority===3&&item.size===(effect==='crabSlam'?3:2)));
  }
  f.world.setPaused(true);f.advanceEngine(2);assert.equal(animation.current.time,0);
  f.world.setPaused(false);f.render(battle([enemy({kind:'boss',x:.05})],{tick:6}),.51);
  assert.equal(current(f),'idle');
  f.render(battle([enemy({kind:'boss',x:.05,hp:0,alive:false})],{tick:7}));
  assert.equal(current(f),'exit');assert.equal(actor.exitDuration,1.2);
  f.world.syncRunUnits([]);f.world.updatePresentation(1.19);assert.equal(model.pending,false);
  f.world.updatePresentation(.02);f.flushDestroyed();assert.equal(model.isValid,false);
  f.world.destroy();f.flushDestroyed();assert.equal(prefab.refs,1);assert.equal(f.bossMaterial.refs,1);
});

test('Prefab先完成：首次敌人创建替换临时节点，嵌套骨骼与显式Ink材质适配生效', t => {
  const f = fixture(t), prefab = f.resolve('ink'); assert.equal(prefab.refs, 2);
  f.render(battle([enemy(), enemy({id: 'runner-a', kind: 'runner'})]));
  assert.equal(f.instances.length, 1); assert.equal(f.instances[0].prefab, prefab);
  assert.deepEqual(values(f.model().scale), [.68, .68, .68]); assert.equal(f.actor().bar.position.y, .89);
  assert.equal(current(f), 'idle'); assert.equal(f.animation().current.wrapMode, 2);
  assert.equal(f.actor().body.children.length, 1); assert.equal(f.actor('runner-a').realModel, false);
  const adapted = f.instances[0].surface.components[0].getSharedMaterial(0);
  assert.equal(adapted.effectName, 'builtin-standard'); assert.equal(adapted.props.mainTexture, f.inkMaterial.props.mainTexture);
  assert.equal(adapted.props.pbrMap, f.inkMaterial.props.shininessExponentMap);
  f.flushDestroyed(); assert.equal(f.inkMaterial.refs, 2);
});

test('Prefab后完成：只替换仍活着的墨团，后续新敌人复用已持有Prefab', t => {
  const f = fixture(t); let snapshot = battle([enemy(), enemy({id: 'ink-b', x: 1})]); f.render(snapshot);
  const oldHolder = f.actor().body.children[0]; assert.match(oldHolder.name, /临时敌人资源/);
  snapshot = battle([enemy(), enemy({id: 'ink-b', alive: false, hp: 0})], {tick: 2}); f.render(snapshot);
  const prefab = f.resolve('ink'); assert.equal(f.instances.length, 1); assert.ok(f.model());
  assert.equal(oldHolder.pending, true); assert.equal(oldHolder.parent, null); assert.equal(f.actor('ink-b').realModel, false);
  f.render(battle([...snapshot.enemies, enemy({id: 'ink-c', x: 2})], {tick: 3}));
  assert.equal(f.instances.length, 2); assert.ok(f.model('ink-c')); assert.equal(prefab.refs, 2);
  f.flushDestroyed(); assert.equal(oldHolder.isValid, false);
});

test('加载失败保留临时表现；destroy后的迟到成功不持有资产也不重建节点', t => {
  const f = fixture(t); f.render(battle()); f.resolve('ink', true);
  assert.equal(f.actor().realModel, false); assert.equal(f.instances.length, 0);
  f.world.destroy(); const before = f.nodes.length; const late = f.resolve('stone');
  f.world.destroy(); f.render(battle(), .1); f.world.setLevel(1); f.world.syncRunUnits([]);
  assert.equal(late.refs, 1); assert.equal(f.nodes.length, before); assert.equal(f.instances.length, 0);
  assert.equal(f.pipeline.refs, 1); f.flushDestroyed(); assert.equal(f.parent.children.length, 0);
});

test('两个Prefab均在destroy后完成：没有本地引用、实例或已销毁renderer写入', t => {
  const f = fixture(t); f.world.destroy(); const before = f.nodes.length;
  const ink = f.resolve('ink'), stone = f.resolve('stone'); f.flushDestroyed();
  assert.equal(ink.refs, 1); assert.equal(stone.refs, 1); assert.equal(f.nodes.length, before);
  assert.equal(f.instances.length, 0); assert.equal(f.pipeline.refs, 1);
});

test('新模拟tick中只有实际移动且未眩晕/定身的墨团进入walk，减速仍可行走', t => {
  const f = fixture(t); f.resolve('ink'); f.render(battle());
  f.render(battle([enemy({x: .05})], {tick: 2})); assert.equal(current(f), 'walk'); assert.equal(f.animation().current.wrapMode, 2);
  f.render(battle([enemy({x: .05})], {tick: 3})); assert.equal(current(f), 'idle');
  for (const [tick, kind] of [[4, 'stun'], [5, 'root']]) {
    f.render(battle([enemy({x: tick * .05, statuses: [{kind, untilTick: 100}]})], {tick})); assert.equal(current(f), 'idle', kind);
  }
  f.render(battle([enemy({x: .30, statuses: [{kind: 'slow', untilTick: 100, amount: .25}]})], {tick: 6})); assert.equal(current(f), 'walk');
});

test('同一固定模拟tick的多次渲染保留walk，不在坐标未推进的间隙重启idle', t => {
  const f = fixture(t); f.resolve('ink'); f.render(battle());
  const moving = battle([enemy({x: .05})], {tick: 2}); f.render(moving, .05);
  const plays = f.playback.length; assert.equal(current(f), 'walk');
  f.render(moving, 1 / 60); f.render(moving, 1 / 60);
  assert.equal(current(f), 'walk', 'render frames between 50ms simulation ticks must not restart locomotion');
  assert.equal(f.playback.length, plays, 'same-tick render frames must not replay a clip');
  f.render(battle([enemy({x: .05})], {tick: 3})); assert.equal(current(f), 'idle', 'a new stationary simulation tick stops walking');
});

test('attack和hit播单次，结束后按当前移动状态恢复walk或idle', t => {
  for (const action of ['attack', 'hit']) for (const moving of [true, false]) {
    const f = fixture(t); f.resolve('ink'); f.render(battle());
    const event = action === 'attack' ? {id: 1, tick: 2, type: 'attack', sourceId: 'ink-a', x: 1, z: 0} : {id: 1, tick: 2, type: 'damage', targetId: 'ink-a', amount: 1};
    f.render(battle([enemy({x: .05})], {tick: 2}), .05, [event]);
    assert.equal(current(f), action); assert.equal(f.animation().current.wrapMode, 1);
    const steps = Math.ceil(DURATIONS[action] / .05) + 1;
    for (let i = 1; i <= steps; i++) f.render(battle([enemy({x: moving ? .05 + i * .05 : .05})], {tick: 2 + i}), .05);
    assert.equal(current(f), moving ? 'walk' : 'idle', `${action} -> ${moving ? 'walk' : 'idle'}`);
    assert.equal(f.animation().current.wrapMode, 2);
    assert.equal(f.playback.filter(item => item.name.endsWith('|' + action)).length, 1);
  }
});

test('真实exit自实际开始起完整播放0.833秒，不叠加临时缩小/下沉，最后释放材质', t => {
  const f = fixture(t), prefab = f.resolve('ink'); f.render(battle());
  const actor = f.actor(), model = f.model(), native = f.instances[0].surface.components[0].getSharedMaterial(0);
  f.render(battle([enemy({alive: false, hp: 0})], {tick: 2}), .1);
  const began = f.playback.find(item => item.name.endsWith('|exit')).time;
  assert.equal(current(f), 'exit'); assert.equal(f.animation().current.wrapMode, 1);
  for (let i = 1; i <= 8; i++) {
    f.render(battle([enemy({alive: false, hp: 0})], {tick: 2 + i}), .1);
    const elapsed = f.time() - began;
    assert.ok(elapsed < DURATIONS.exit, 'pre-completion observation');
    assert.ok(actor.node.active && !actor.node.pending, `exit retired early at ${elapsed.toFixed(3)}s`);
    assert.deepEqual(values(actor.body.scale), [1, 1, 1]); assert.equal(actor.body.position.y, 0);
    assert.deepEqual(values(model.scale), [.68, .68, .68]); assert.equal(native.destroyed, 0);
  }
  f.render(battle([enemy({alive: false, hp: 0})], {tick: 11}), .05);
  assert.ok(f.time() - began >= DURATIONS.exit); assert.equal(f.world.enemies.size, 0); assert.equal(actor.node.active, false);
  assert.equal(actor.node.parent, null); assert.equal(actor.node.pending, true);
  f.flushDestroyed(); assert.equal(model.isValid, false); assert.equal(native.destroyed, 1);
  assert.equal(f.inkMaterial.refs, 1); assert.equal(f.inkMaterial.props.mainTexture.refs, 1); assert.equal(f.inkMaterial.props.shininessExponentMap.refs, 1);
  assert.equal(prefab.refs, 2, 'world retains loaded prefab for later enemies');
  const count = f.instances.length; f.render(battle([enemy({alive: false, hp: 0})], {tick: 12})); assert.equal(f.instances.length, count);
});

test('恢复含已死敌人的快照不实例化旧敌人，也不重放旧退场', t => {
  const f = fixture(t); f.resolve('ink');
  const dead = [enemy({alive: false, hp: 0}), enemy({id: 'ink-b', alive: false, hp: 0, x: 2})];
  f.render(battle(dead, {tick: 240}), .05, [{id: 30, tick: 100, type: 'defeat', targetId: 'ink-a'}]);
  assert.equal(f.world.enemies.size, 0); assert.equal(f.instances.length, 0); assert.equal(f.playback.length, 0);
  f.render(battle([...dead, enemy({id: 'ink-c'})], {tick: 241})); assert.equal(f.instances.length, 1); assert.ok(f.model('ink-c'));
});

test('切波时延迟销毁旧节点：共享材质保持到最后一个用户退出，destroy归还Prefab引用', t => {
  const f = fixture(t), prefab = f.resolve('ink');
  f.render(battle([enemy(), enemy({id: 'ink-b', x: 1})]));
  const first = f.instances[0], native = first.surface.components[0].getSharedMaterial(0);
  assert.equal(f.instances[1].surface.components[0].getSharedMaterial(0), native); assert.equal(f.inkMaterial.refs, 2);
  f.render(battle([enemy({id: 'ink-next'})], {wave: 2, tick: 1}));
  assert.equal(first.model.pending, false, 'Cocos defers subtree destruction until the end-of-frame flush');
  f.flushDestroyed(); assert.equal(first.model.isValid, false); assert.equal(native.destroyed, 0); assert.equal(f.inkMaterial.refs, 2);
  f.world.destroy(); f.world.destroy(); f.flushDestroyed();
  assert.equal(native.destroyed, 1); assert.equal(prefab.refs, 1); assert.equal(f.pipeline.refs, 1); assert.equal(f.inkMaterial.refs, 1);
  assert.equal(f.inkMaterial.props.mainTexture.refs, 1); assert.equal(f.inkMaterial.props.shininessExponentMap.refs, 1);
  assert.equal(f.parent.children.length, 0);
});

test('setPaused立即冻结所有嵌套骨骼与退场计时，恢复不重播；销毁后无效', t => {
  const f = fixture(t); f.resolve('ink'); f.resolve('stone');
  const state = battle([enemy()], {units: [unit()]}); f.render(state);
  const dead = battle([enemy({alive: false, hp: 0})], {tick: 2, units: [unit()]}); f.render(dead, .05);
  f.render(dead, .2); f.advanceEngine(.2);
  const actor = f.actor(), deathTime = actor.deathTime, plays = f.playback.length;
  const times = f.instances.map(({animation}) => animation.current.time);
  f.world.setPaused(true); f.world.setPaused(true);
  assert.ok(f.instances.every(({animation}) => animation.paused && animation.pauseCalls === 1));
  f.render(dead, 3); f.advanceEngine(3);
  assert.equal(actor.deathTime, deathTime); assert.equal(f.playback.length, plays);
  assert.deepEqual(f.instances.map(({animation}) => animation.current.time), times);
  f.world.setPaused(false); f.world.setPaused(false);
  assert.ok(f.instances.every(({animation}) => !animation.paused && animation.resumeCalls === 1));
  assert.equal(f.playback.length, plays, 'resume preserves clip phase');
  f.render(dead, .64); assert.ok(!actor.node.active && actor.node.pending, 'only unpaused time completes exit');
  f.world.destroy(); f.flushDestroyed();
  const calls = f.instances.map(({animation}) => [animation.pauseCalls, animation.resumeCalls]);
  f.world.setPaused(true); f.world.setPaused(false);
  assert.deepEqual(f.instances.map(({animation}) => [animation.pauseCalls, animation.resumeCalls]), calls);
});

test('暂停期间迟到的石龟/墨团Prefab以及重新play的模型保持暂停，新状态恢复后才运行', t => {
  const f = fixture(t); f.world.setPaused(true); f.render(battle([enemy()], {units: [unit()]}));
  f.resolve('stone'); f.resolve('ink');
  assert.equal(f.instances.length, 2); assert.ok(f.instances.every(({animation}) => animation.paused));
  f.advanceEngine(2); assert.ok(f.instances.every(({animation}) => animation.current.time === 0));
  f.world.syncRunUnits([{id: 'stone-a', turtle: {role: 'stone'}, slot: 0, level: 1}]);
  const stone = f.instances.find(({prefab}) => prefab.kind === 'stone').animation;
  assert.equal(stone.paused, true, 'syncRunUnits calls play but must preserve world pause');
  f.world.setPaused(false); f.advanceEngine(.1); assert.equal(stone.paused, false); assert.equal(stone.current.time, .1);
  f.world.setPaused(true); f.render(battle([enemy({id: 'new-ink'})], {tick: 3, units: [unit()]}));
  assert.equal(f.animation('new-ink').paused, true, 'new actors also inherit pause');
});

test('资源回调遵守到达时的暂停状态，早先暂停后已经恢复不会冻结迟到模型', t => {
  const f = fixture(t); f.render(battle()); f.world.setPaused(true); f.world.setPaused(false); f.resolve('ink');
  assert.equal(f.animation().paused, false); f.advanceEngine(.1); assert.equal(f.animation().current.time, .1);
});

test('真实模型单次动作和退场使用完整引擎dt，长帧不会被0.1秒插值上限拖慢', t => {
  const f = fixture(t); f.resolve('ink'); f.render(battle());
  f.render(battle([], {enemies: [enemy()], tick: 2}), .05, [{id: 1, tick: 2, type: 'attack', sourceId: 'ink-a'}]);
  assert.equal(current(f), 'attack');
  f.render(battle([enemy()], {tick: 3}), .8); assert.equal(current(f), 'idle');
  const dead = battle([enemy({alive: false, hp: 0})], {tick: 4}); f.render(dead, .4);
  const actor = f.actor(); assert.equal(actor.deathTime, 0, 'new exit never consumes the frame preceding play');
  f.render(dead, .5); assert.ok(actor.node.active); assert.equal(actor.deathTime, .5);
  f.render(dead, .34); assert.ok(!actor.node.active && actor.node.pending);
});

test('实际BattleScreen恢复快照先冻结模型；继续按钮当场恢复，暂停期间规则tick不推进', t => {
  const f = fixture(t), s = f.screen({restored: true}); f.resolve('stone');
  const animation = f.instances[0].animation, tick = s.run.battle.tick;
  assert.equal(animation.paused, true); s.frame(.8); assert.equal(s.run.battle.tick, tick); assert.equal(animation.current.time, 0);
  s.click('继续冒险'); assert.equal(animation.paused, false, 'resume does not wait for the next update');
  s.frame(.05); assert.ok(s.run.battle.tick > tick); assert.ok(animation.current.time > 0);
});

test('实际BattleScreen手动暂停与hide/show冻结骨骼，继续保持动作相位；回首页销毁', t => {
  const f = fixture(t), s = f.screen(); f.resolve('stone'); f.resolve('ink');
  s.click('守住海岛'); s.frame(.05); const state = s.run.battle;
  assert.ok(state); assert.equal(f.instances[0].animation.paused, false);
  s.click('暂停'); const tick = state.tick, times = f.instances.map(({animation}) => animation.current.time);
  assert.ok(f.instances.every(({animation}) => animation.paused)); s.frame(2);
  assert.equal(state.tick, tick); assert.deepEqual(f.instances.map(({animation}) => animation.current.time), times);
  s.click('继续冒险'); assert.ok(f.instances.every(({animation}) => !animation.paused));
  s.screen.hide(); assert.ok(f.instances.every(({animation}) => animation.paused));
  s.screen.show(); assert.ok(f.instances.every(({animation}) => animation.paused), 'foreground still requires explicit continue');
  s.frame(.1); assert.equal(state.tick, tick); s.click('继续冒险'); s.frame(.05); assert.ok(state.tick > tick);
  s.click('暂停'); s.click('保存并回到海岛'); f.flushDestroyed(); assert.equal(s.calls.home, 1);
  assert.ok(f.instances.every(({model}) => !model.isValid));
  const calls = [s.calls.audioPause, s.calls.audioResume]; s.screen.hide(); s.screen.show();
  assert.deepEqual([s.calls.audioPause, s.calls.audioResume], calls, 'destroyed screen ignores visibility callbacks');
});

test('实际BattleScreen伙伴/合成/比较弹窗立即冻结，关闭弹窗不覆盖手动暂停', t => {
  for (const [method, cancel] of [['recruit', '先想想'], ['fusion', '返回'], ['compare', '暂不收录']]) {
    const f = fixture(t), s = f.screen(); f.resolve('stone'); const animation = f.instances[0].animation;
    s.screen[method](method==='compare'?'stone-a':undefined); assert.equal(animation.paused, true, method);
    s.frame(.4); assert.equal(animation.current.time, 0); s.click(cancel); assert.equal(animation.paused, false, method + ' close');
    s.click('暂停'); s.screen[method](method==='compare'?'stone-a':undefined); s.click(cancel); assert.equal(animation.paused, true, method + ' preserves explicit pause');
  }
});

test('实际BattleScreen揭晓、结算及放弃流程同步模型暂停，错误检查点不会误恢复', t => {
  const f = fixture(t), s = f.screen(); f.resolve('stone'); const animation = f.instances[0].animation;
  s.run.phase = 'reveal'; s.run.pendingMergeId = 'merge-a'; s.run.merges['merge-a'] = {outputId: 'stone-a'}; s.screen.render();
  assert.equal(animation.paused, true, 'reveal pauses immediately'); s.frame(.5); assert.equal(animation.current.time, 0);
  s.run.phase = 'between'; s.screen.render(); assert.equal(animation.paused, false);
  s.click('守住海岛'); s.calls.failCheckpoint = true; s.click('暂停');
  assert.equal(animation.paused, true); assert.equal(s.errors.length, 1); const tick = s.run.battle.tick; s.frame(.5); assert.equal(s.run.battle.tick, tick);
  s.calls.failCheckpoint = false; s.screen.show(); s.click('结束本次挑战');
  assert.equal(s.run.phase, 'result'); assert.equal(animation.paused, true, 'abandon result dialog remains paused');
  s.click('回到海岛'); f.flushDestroyed(); assert.equal(s.calls.home, 1); assert.equal(f.instances[0].model.isValid, false);
});

test('实际BattleScreen推进异常当场暂停；恢复后波间待机可运行而规则不多推进', t => {
  const f = fixture(t), s = f.screen(); f.resolve('stone'); s.click('守住海岛');
  const animation = f.instances[0].animation;
  s.calls.failCheckpoint = true; s.screen.lastCheckpointTick = -100; s.frame(.05);
  assert.equal(s.errors.length, 1); assert.equal(animation.paused, true, 'update catch freezes engine animation immediately');
  const state = s.run.battle, tick = state.tick, time = animation.current.time;
  s.frame(.5); assert.equal(state.tick, tick); assert.equal(animation.current.time, time);
  s.calls.failCheckpoint = false; s.click('暂停'); s.click('继续冒险'); assert.equal(animation.paused, false);
  state.status = 'won'; s.frame(.05);
  assert.equal(s.run.phase, 'between'); assert.equal(animation.paused, false, 'between-wave idle is not a modal');
  const idleTime = animation.current.time; s.frame(.2); assert.ok(animation.current.time > idleTime); assert.equal(state.tick, tick);
  s.click('开始下一波'); assert.equal(s.run.phase, 'combat'); assert.equal(animation.paused, false);
});

test('波间保留最后敌人的退场，暂停冻结且完整退场后归还材质引用', t => {
  const f = fixture(t); f.resolve('ink'); f.render(battle());
  const actor = f.actor(), model = f.model(), animation = f.animation();
  f.render(battle([enemy({alive:false,hp:0})],{tick:2}));
  f.world.syncRunUnits([]); f.flushDestroyed();
  assert.equal(f.world.enemies.size,0); assert.equal(f.world.hasPendingExits,true);
  assert.equal(model.isValid,true); assert.equal(animation.current.name,'InkBlob_Rig|exit');
  f.world.updatePresentation(.4); assert.equal(actor.deathTime,.4);
  f.world.setPaused(true); f.world.updatePresentation(2); f.advanceEngine(2);
  assert.equal(actor.deathTime,.4); assert.equal(animation.paused,true);
  f.world.setPaused(false); f.world.updatePresentation(.4); assert.equal(model.pending,false);
  f.world.updatePresentation(.04); f.flushDestroyed();
  assert.equal(f.world.hasPendingExits,false); assert.equal(model.isValid,false); assert.equal(f.inkMaterial.refs,1);
});

test('新波同名敌人与上波退场互不混淆，重设关卡清理全部退场', t => {
  const f = fixture(t); f.resolve('ink'); f.render(battle()); const previous = f.model();
  f.render(battle([enemy({alive:false,hp:0})],{tick:2})); f.world.syncRunUnits([]);
  f.render(battle([enemy()],{wave:2,tick:1})); const next = f.model();
  assert.notEqual(next,previous); assert.equal(previous.pending,false); assert.equal(f.world.hasPendingExits,true);
  f.world.setLevel(1); f.flushDestroyed();
  assert.equal(previous.isValid,false); assert.equal(next.isValid,false); assert.equal(f.world.hasPendingExits,false);
  assert.equal(f.inkMaterial.refs,1);
});

test('末波奖励立即提交，结算面板等退场结束；暂停与恢复不重复结算', t => {
  const f=fixture(t),s=f.screen({restored:true});f.resolve('ink');s.click('继续冒险');
  const state=s.run.battle;state.enemies=[enemy()];s.screen.render();
  const model=f.model(),animation=f.animation();let completed=0;
  s.service.completeWave=()=>{
    completed++;s.run.wave=5;s.run.phase='result';s.run.battle=undefined;
    s.service.snapshot.results[s.run.id]={victory:true,waves:5,combatSeconds:100,baseGold:60,firstClearGold:100,materials:{health:1}};
  };
  state.enemies[0].alive=false;state.enemies[0].hp=0;state.status='won';state.tick++;
  s.frame(.05);
  assert.equal(completed,1);assert.equal(s.service.snapshot.results[s.run.id].firstClearGold,100);
  assert.equal(s.buttons.has('回到海岛'),false);assert.equal(s.screen.waitingForResult,true);
  assert.equal(animation.paused,false);assert.equal(model.pending,false);
  s.click('暂停');const time=animation.current.time;s.frame(1);assert.equal(animation.current.time,time);
  s.click('继续冒险');s.frame(.8);assert.equal(s.buttons.has('回到海岛'),false);
  s.frame(.04);f.flushDestroyed();
  assert.equal(model.isValid,false);assert.equal(s.buttons.has('回到海岛'),true);assert.equal(completed,1);
  s.frame(1);assert.equal(completed,1);s.click('回到海岛');assert.equal(s.calls.home,1);
});

test('快跑蟹迟到加载继承暂停，独立材质与五动作适配且退出完整播放', t => {
  const f=fixture(t), runner=overrides=>enemy({id:'runner-a',kind:'runner',...overrides});
  const inkPrefab=f.resolve('ink'); f.render(battle([enemy(),runner()]));
  const inkModel=f.model(); f.world.setPaused(true); const prefab=f.resolve('runner');
  const actor=f.actor('runner-a'),model=f.model('runner-a'),animation=f.animation('runner-a');
  assert.equal(model.name,'快跑蟹 · 原创模型'); assert.deepEqual(values(model.scale),[.83,.83,.83]);
  assert.equal(actor.exitDuration,.8); assert.equal(animation.paused,true);
  assert.equal(f.model(),inkModel,'runner load cannot replace the ink model');
  const skin=f.instances.find(instance=>instance.prefab===prefab).surface.components[0].getSharedMaterial(0);
  assert.equal(skin.props.mainTexture,f.runnerMaterial.props.mainTexture);
  assert.equal(skin.props.pbrMap,f.runnerMaterial.props.shininessExponentMap);
  assert.equal(skin.effectName,'builtin-standard');
  f.world.setPaused(false); f.render(battle([enemy(),runner({x:.08})],{tick:2}));
  assert.equal(current(f,'runner-a'),'walk'); assert.equal(animation.current.duration,.4);
  f.render(battle([enemy(),runner({x:.16})],{tick:3}),.05,[{id:1,tick:3,type:'attack',sourceId:'runner-a',x:1,z:0}]);
  assert.equal(current(f,'runner-a'),'attack'); assert.equal(animation.current.duration,.7);
  f.render(battle([enemy(),runner({x:.16,alive:false,hp:0})],{tick:4}));
  assert.equal(current(f,'runner-a'),'exit'); f.world.syncRunUnits([]);
  f.world.updatePresentation(.79); assert.equal(model.pending,false);
  f.world.updatePresentation(.02); f.flushDestroyed(); assert.equal(model.isValid,false);
  assert.equal(f.runnerMaterial.refs,1); f.world.destroy(); f.flushDestroyed();
  assert.equal(prefab.refs,1); assert.equal(inkPrefab.refs,1);
});

test('退出战斗后迟到的快跑蟹资源不会创建模型或持有引用', t => {
  const f=fixture(t); f.render(battle([enemy({id:'runner-a',kind:'runner'})]));
  f.world.destroy(); const nodeCount=f.nodes.length,prefab=f.resolve('runner'); f.flushDestroyed();
  assert.equal(prefab.refs,1); assert.equal(f.nodes.length,nodeCount); assert.equal(f.instances.length,0);
});

test('双龟异步加载独立：休整刺龟保留暂停，同ID换职业后回收原模型与材质', t => {
  const f=fixture(t); f.resolve('stone');
  f.render(battle([],{units:[unit(),unit({id:'spike-a',role:'spike',alive:false,hp:0})]}));
  const stone=f.instances[0]; f.world.setPaused(true); const prefab=f.resolve('spike');
  const spike=f.instances.find(value=>value.prefab===prefab);
  assert.equal(spike.model.name,'刺刺龟 · 原创模型');
  assert.equal(spike.animation.current.name,'SpikeTurtle_Rig|rest'); assert.equal(spike.animation.paused,true);
  assert.equal(stone.model.isValid,true); assert.equal(stone.animation.current.name,'StoneTurtle_Rig|idle');
  const material=spike.surface.components[0].getSharedMaterial(0);
  assert.equal(material.props.mainTexture,f.spikeMaterial.props.mainTexture);
  assert.notEqual(material.props.mainTexture,stone.surface.components[0].getSharedMaterial(0).props.mainTexture);
  f.render(battle([],{tick:2,units:[unit(),unit({id:'spike-a',role:'stone'})]})); f.flushDestroyed();
  assert.equal(spike.model.isValid,false); assert.equal(material.isValid,false);
  assert.equal(f.spikeMaterial.refs,1); assert.equal(stone.model.isValid,true);
  const replacement=f.instances.at(-1); assert.equal(replacement.animation.current.name,'StoneTurtle_Rig|idle');
  assert.equal(replacement.animation.paused,true); f.world.setPaused(false); f.advanceEngine(.2);
  assert.equal(replacement.animation.current.time,.2);
  f.world.destroy(); f.flushDestroyed(); assert.equal(prefab.refs,1);
});

test('V0.6 speed changes skeleton states including late models, while an in-wave replacement preserves enemy identity', t=>{
  const f=fixture(t);f.resolve('stone');f.resolve('ink');f.world.setPlaybackSpeed(2);
  f.render(battle([enemy()],{rulesVersion:'0.6',mode:'chapter',units:[unit()]}));
  const model=f.model(),animation=f.animation();assert.equal(animation.current.speed,2);f.advanceEngine(.25);assert.equal(animation.current.time,.5);
  const first=f.instances.find(i=>i.prefab.kind==='stone');assert.equal(first.animation.current.speed,2);
  f.render(battle([enemy({x:.2})],{rulesVersion:'0.6',mode:'chapter',tick:2,units:[unit({id:'new-stone'})]}));
  assert.equal(f.model(),model,'replacing a friendly must not rebuild the active enemy wave');assert.equal(model.pending,false);
  f.world.setPaused(true);const paused=animation.current.time;f.advanceEngine(.25);assert.equal(animation.current.time,paused);
  f.world.setPlaybackSpeed(1);f.world.setPaused(false);f.advanceEngine(.25);assert.equal(animation.current.time,paused+.25);
});

test('铁壳蟹独立使用较慢动作，波末保留真实退场时长并释放资源', t => {
  const f=fixture(t),prefab=f.resolve('armored');
  f.render(battle([enemy({kind:'armored'})]));
  const model=f.model(),animation=f.animation();
  assert.equal(model.name,'铁壳蟹 · 原创模型');
  assert.equal(f.instances[0].surface.components[0].getSharedMaterial(0).props.mainTexture,f.armoredMaterial.props.mainTexture);
  f.render(battle([enemy({kind:'armored',x:.03})],{tick:2}));
  assert.equal(current(f),'walk'); assert.equal(animation.current.duration,.8);
  f.render(battle([enemy({kind:'armored',x:.03,alive:false,hp:0})],{tick:3}));
  assert.equal(current(f),'exit'); f.world.syncRunUnits([]);
  f.world.updatePresentation(.85); assert.equal(model.pending,false);
  f.world.updatePresentation(.06); f.flushDestroyed(); assert.equal(model.isValid,false);
  assert.equal(f.armoredMaterial.refs,1); f.world.destroy(); f.flushDestroyed(); assert.equal(prefab.refs,1);
});
