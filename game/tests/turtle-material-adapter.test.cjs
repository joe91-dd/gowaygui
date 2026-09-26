const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let ts;
for (const candidate of [process.env.GOWAYGUI_TYPESCRIPT, 'typescript', 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'].filter(Boolean)) {
  try { ts = require(candidate); break; } catch {}
}
if (!ts) throw new Error('Material tests require Cocos TypeScript or GOWAYGUI_TYPESCRIPT');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../assets/scripts/view/' + file), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;
const adapterCode = compile('TurtleMaterialAdapter.ts'), lightingCode = compile('WorldLighting.ts');

function fixture() {
  const assets = [], assignments = []; let failCopy = false, failAssignment = false;
  class Asset {
    constructor(name = '') { this.name = name; this.refs = 1; this.isValid = true; this.destroyed = 0; assets.push(this); }
    addRef() { this.refs++; return this; }
    decRef() { assert.ok(this.refs > 0, 'no reference underflow'); this.refs--; return this; }
    destroy() { assert.equal(this.destroyed, 0, 'no double material destruction'); this.destroyed++; this.isValid = false; }
  }
  class Texture2D extends Asset {}
  class Material extends Asset {
    constructor(name) { super(name); this.effectName = 'util/dcc/imported-specular-glossiness'; this.technique = 0; this.props = {}; this.defines = {}; }
    copy(source, overrides) {
      if (failCopy) throw new Error('GPU variant unavailable');
      this.effectName = source.effectName; this.technique = overrides.technique;
      this.props = {...source.props}; this.defines = {...source.defines, ...overrides.defines};
    }
    getProperty(name) { return this.props[name] ?? null; }
    setProperty(name, value) { this.props[name] = value; }
  }
  class Vec3 { constructor(x, y, z) { Object.assign(this, {x, y, z}); } }
  class Vec4 extends Vec3 { constructor(x, y, z, w) { super(x, y, z); this.w = w; } }
  class Color { constructor(r, g, b, a) { Object.assign(this, {r, g, b, a}); } }
  class Node {
    static EventType = {NODE_DESTROYED: 'destroy'};
    constructor(materials) { this.isValid = true; this.pending = false; this.listeners = []; this.meshes = [new MeshRenderer(this, materials)]; }
    getComponentsInChildren(Type) { assert.equal(Type, MeshRenderer); return this.meshes; }
    once(event, callback) { this.listeners.push({event, callback}); }
    off(event, callback) { this.listeners = this.listeners.filter(item => item.event !== event || item.callback !== callback); }
    destroy() { this.pending = true; for (const entry of this.listeners.slice()) entry.callback(); this.listeners = []; this.isValid = false; }
  }
  class MeshRenderer {
    static ShadowCastingMode = {ON: 1};
    constructor(node, materials) { this.node = node; this.sharedMaterials = materials.slice(); this.isValid = true; }
    getSharedMaterial(slot) { return this.sharedMaterials[slot]; }
    setSharedMaterial(material, slot) {
      assert.ok(this.isValid && this.node.isValid && !this.node.pending, 'never mutate a destroying renderer');
      if (failAssignment) { failAssignment = false; throw new Error('Renderer rejected assignment'); }
      assignments.push({renderer: this, material, slot}); this.sharedMaterials[slot] = material;
    }
  }
  class DirectionalLight {}
  const cc = {Material, MeshRenderer, Node, Texture2D, Vec3, Vec4, Color, DirectionalLight,
    renderer: {scene: {PCFType: {SOFT: 1, HARD: 0}}}, isValid: (value, strict) => !!value?.isValid && !(strict && value.pending)};
  const load = code => { const module = {exports: {}}; vm.runInNewContext(code, {module, exports: module.exports, require(name) { assert.equal(name, 'cc'); return cc; }}); return module.exports; };
  const pipeline = new Material('PipelineStandard'); pipeline.effectName = 'builtin-standard'; pipeline.props = {roughness: .8, metallic: 0}; pipeline.defines = {USE_ALBEDO_MAP: false};
  const colour = new Texture2D('stone-colour'), roughness = new Texture2D('stone-roughness');
  const original = new Material('StoneAtlas_01'); original.props = {mainTexture: colour, shininessExponentMap: roughness, mainColor: new Color(231, 231, 231, 255), specularFactor: .135, tilingOffset: new Vec4(1, 1, 0, 0)};
  const {TurtleMaterialAdapter} = load(adapterCode), lighting = load(lightingCode);
  const adapter = new TurtleMaterialAdapter(pipeline);
  return {adapter, pipeline, original, colour, roughness, assets, assignments, Material, Texture2D, Node, TurtleMaterialAdapter, lighting, DirectionalLight,
    root(materials = [original]) { return new Node(materials); }, failCopy(value) { failCopy = value; }, failAssignment() { failAssignment = true; },
  };
}

test('原atlas映射到Standard正确PBR通道；保留色值、默认F0并不修改原材质', () => {
  const f = fixture(), root = f.root(), before = {...f.original.props};
  assert.equal(f.adapter.apply(root), 1); const native = root.meshes[0].getSharedMaterial(0);
  assert.equal(native.effectName, 'builtin-standard'); assert.equal(native.defines.USE_ALBEDO_MAP, true); assert.equal(native.defines.USE_PBR_MAP, true);
  assert.equal(native.props.mainTexture, f.colour); assert.equal(native.props.pbrMap, f.roughness);
  assert.deepEqual([native.props.mainColor.r, native.props.mainColor.g, native.props.mainColor.b], [255, 255, 255]);
  assert.equal(native.props.roughness, 1); assert.equal(native.props.metallic, 0); assert.equal(native.props.occlusion, 0);
  assert.equal(native.props.specularIntensity * 1 * .08, .04, 'opaque map alpha retains default dielectric F0');
  for (const channel of [145, 110, 51]) assert.equal(native.props.roughness * channel / 255, channel / 255, 'roughness scale does not flatten or halve the atlas');
  assert.deepEqual(f.original.props, before); assert.equal(f.pipeline.props.roughness, .8); assert.equal(f.pipeline.defines.USE_ALBEDO_MAP, false);
  f.adapter.destroy(); assert.equal(root.meshes[0].getSharedMaterial(0), f.original);
});

test('多只龟复用一次材质和纹理引用；重复apply及单只释放不提前销毁共享资源', () => {
  const f = fixture(), a = f.root(), b = f.root();
  f.adapter.apply(a); f.adapter.apply(b); const native = a.meshes[0].getSharedMaterial(0);
  assert.equal(b.meshes[0].getSharedMaterial(0), native); assert.equal(f.adapter.apply(a), 1);
  assert.equal(f.colour.refs, 2); assert.equal(f.roughness.refs, 2); assert.equal(f.original.refs, 2);
  f.adapter.release(a); assert.equal(a.meshes[0].getSharedMaterial(0), f.original); assert.equal(native.destroyed, 0);
  assert.equal(f.colour.refs, 2); f.adapter.release(b); assert.equal(native.destroyed, 1);
  assert.equal(f.colour.refs, 1); assert.equal(f.roughness.refs, 1); assert.equal(f.original.refs, 1);
  f.adapter.destroy(); assert.equal(f.pipeline.refs, 1);
});

test('节点销毁自动释放且不访问将销毁的renderer；适配器destroy恢复存活节点且幂等', () => {
  const f = fixture(), dead = f.root(), alive = f.root(); f.adapter.apply(dead); f.adapter.apply(alive);
  const native = alive.meshes[0].getSharedMaterial(0); dead.destroy(); assert.equal(native.destroyed, 0);
  f.adapter.destroy(); f.adapter.destroy(); assert.equal(alive.meshes[0].getSharedMaterial(0), f.original);
  assert.equal(native.destroyed, 1); assert.equal(alive.listeners.length, 0); assert.equal(f.adapter.apply(f.root()), 0);
  assert.ok([f.pipeline, f.original, f.colour, f.roughness].every(asset => asset.refs === 1 && asset.destroyed === 0));
});

test('不改无关模型或缺失纹理；回退保留后续外部材质覆盖', () => {
  const f = fixture(), other = new f.Material('IslandSurface'), missing = new f.Material('StoneAtlas_02');
  other.props = {...f.original.props}; missing.props = {mainTexture: f.colour};
  const root = f.root([other, missing, f.original]); assert.equal(f.adapter.apply(root), 1);
  assert.equal(root.meshes[0].getSharedMaterial(0), other); assert.equal(root.meshes[0].getSharedMaterial(1), missing);
  const external = new f.Material('ExternalOverride'); root.meshes[0].setSharedMaterial(external, 2); f.adapter.destroy();
  assert.equal(root.meshes[0].getSharedMaterial(2), external); assert.equal(f.original.refs, 1);
});

test('默认白名单不适配Ink材质，不创建变体、不增加引用或替换材质', () => {
  const f = fixture(), ink = new f.Material('InkBlob_Toy_Atlas'); ink.props = {...f.original.props};
  const root = f.root([ink]), originalProps = {...ink.props};
  const assetCount = f.assets.length, references = f.assets.map(asset => asset.refs);
  assert.equal(f.adapter.apply(root), 0); assert.equal(f.adapter.apply(root), 0);
  assert.equal(root.meshes[0].getSharedMaterial(0), ink); assert.equal(f.assignments.length, 0);
  assert.equal(f.assets.length, assetCount); assert.deepEqual(f.assets.map(asset => asset.refs), references);
  assert.deepEqual(ink.props, originalProps); assert.equal(root.listeners.length, 0);
  f.adapter.destroy(); assert.equal(root.meshes[0].getSharedMaterial(0), ink);
  assert.ok(f.assets.every(asset => asset.refs === 1 && asset.destroyed === 0));
});

test('显式atlas白名单适配并共享Ink，排除其他名称和空前缀；释放与destroy恢复引用及原材质', () => {
  const f = fixture(); f.adapter.destroy();
  const adapter = new f.TurtleMaterialAdapter(f.pipeline, ['StoneAtlas_', 'InkBlob_Toy_Atlas']);
  const inkColour = new f.Texture2D('ink-colour'), inkRoughness = new f.Texture2D('ink-roughness');
  const ink = new f.Material('InkBlob_Toy_Atlas');
  ink.props = {...f.original.props, mainTexture: inkColour, shininessExponentMap: inkRoughness};
  const other = new f.Material('Other_InkBlob_Toy_Atlas'), unnamed = new f.Material('');
  other.props = {...ink.props}; unnamed.props = {...ink.props};
  const a = f.root([ink, other, unnamed, f.original]), b = f.root([ink, other]);
  assert.equal(adapter.apply(a), 2); assert.equal(adapter.apply(b), 1);
  const nativeInk = a.meshes[0].getSharedMaterial(0), nativeStone = a.meshes[0].getSharedMaterial(3);
  assert.notEqual(nativeInk, ink); assert.equal(nativeInk.effectName, 'builtin-standard');
  assert.equal(nativeInk.props.mainTexture, inkColour); assert.equal(nativeInk.props.pbrMap, inkRoughness);
  assert.equal(b.meshes[0].getSharedMaterial(0), nativeInk); assert.notEqual(nativeStone, f.original);
  assert.equal(a.meshes[0].getSharedMaterial(1), other); assert.equal(a.meshes[0].getSharedMaterial(2), unnamed);
  assert.equal(b.meshes[0].getSharedMaterial(1), other); assert.equal(other.refs, 1); assert.equal(unnamed.refs, 1);
  assert.equal(adapter.apply(a), 2); assert.equal(f.assignments.length, 3, 'repeat apply does not bind again');
  assert.ok([ink, inkColour, inkRoughness, f.original, f.colour, f.roughness].every(asset => asset.refs === 2));
  adapter.release(a);
  assert.deepEqual(a.meshes[0].sharedMaterials, [ink, other, unnamed, f.original]);
  assert.equal(nativeStone.destroyed, 1); assert.equal(nativeInk.destroyed, 0);
  assert.ok([ink, inkColour, inkRoughness].every(asset => asset.refs === 2), 'second root retains shared Ink resources');
  assert.ok([f.original, f.colour, f.roughness].every(asset => asset.refs === 1));
  adapter.destroy(); adapter.destroy();
  assert.deepEqual(b.meshes[0].sharedMaterials, [ink, other]); assert.equal(nativeInk.destroyed, 1);
  assert.equal(a.listeners.length, 0); assert.equal(b.listeners.length, 0);
  assert.ok([f.pipeline, f.original, f.colour, f.roughness, ink, inkColour, inkRoughness, other, unnamed]
    .every(asset => asset.refs === 1 && asset.destroyed === 0));
  const emptyPrefixAdapter = new f.TurtleMaterialAdapter(f.pipeline, ['']);
  const untouched = f.root([other, unnamed, ink, f.original]);
  const assignments = f.assignments.length, assetCount = f.assets.length, references = f.assets.map(asset => asset.refs);
  assert.equal(emptyPrefixAdapter.apply(untouched), 0, 'empty prefix must not match every material');
  assert.deepEqual(untouched.meshes[0].sharedMaterials, [other, unnamed, ink, f.original]);
  assert.equal(f.assignments.length, assignments); assert.equal(f.assets.length, assetCount);
  assert.deepEqual(f.assets.map(asset => asset.refs), references); assert.equal(untouched.listeners.length, 0);
  emptyPrefixAdapter.destroy(); assert.equal(f.pipeline.refs, 1);
});

test('编译和绑定失败均回滚资源引用，可重试；错误模板在持有引用前拒绝', () => {
  const f = fixture(), root = f.root(); f.failCopy(true); assert.throws(() => f.adapter.apply(root), /GPU variant/);
  assert.equal(f.colour.refs, 1); assert.equal(f.original.refs, 1); assert.equal(root.meshes[0].getSharedMaterial(0), f.original);
  f.failCopy(false); f.failAssignment(); assert.throws(() => f.adapter.apply(root), /Renderer rejected/);
  assert.equal(f.colour.refs, 1); assert.equal(f.original.refs, 1); assert.equal(f.adapter.apply(root), 1); f.adapter.destroy();
  const invalid = new f.Material('Unlit'); const refs = invalid.refs;
  assert.throws(() => new f.TurtleMaterialAdapter(invalid), /Standard/); assert.equal(invalid.refs, refs);
});

test('LDR补光更新实时公开属性，太阳使用LDR强度且保持四采样PCF', () => {
  const f = fixture(); const sun = {node: {setRotationFromEuler() {}}, illuminance: 1.7};
  const scene = {globals: {shadows: {}, ambient: {skyIllum: .8}, skybox: {useIBL: false}}, getComponentInChildren(Type) { assert.equal(Type, f.DirectionalLight); return sun; }};
  f.lighting.lightIsland(scene); assert.equal(sun.shadowPcf, 1); assert.equal(scene.globals.shadows.shadowMapSize, 1024);
  assert.equal(sun.illuminance, 1.7); assert.equal(scene.globals.ambient.skyIllum, 1.05); assert.equal(scene.globals.skybox.useIBL, false);
  f.lighting.lightIsland(scene, false); assert.equal(sun.shadowPcf, 0); f.adapter.destroy();
});


test('boss packed surface and normal maps are shared and survive actor recycling',()=>{
 const f=fixture();f.adapter.destroy();const a=new f.TurtleMaterialAdapter(f.pipeline,['CC0_']);
 const normal=new f.Texture2D('normal'),surface=new f.Texture2D('surface');
 const source=new f.Material('CC0_CoastalAtlas_world-2');source.props={mainTexture:f.colour};
 a.registerSurface('world-2',normal,surface);a.registerSurface('world-2',normal,surface);
 const first=f.root([source]),second=f.root([source]);assert.equal(a.apply(first),1);a.apply(second);
 const m=first.meshes[0].getSharedMaterial(0);assert.equal(m,second.meshes[0].getSharedMaterial(0));
 assert.equal(m.defines.USE_NORMAL_MAP,true);assert.equal(m.defines.USE_PBR_MAP,true);assert.equal(m.props.normalMap,normal);assert.equal(m.props.pbrMap,surface);
 assert.equal(m.props.roughness,1);assert.equal(m.props.metallic,1);assert.equal(normal.refs,3);
 a.release(first);assert.equal(normal.refs,3);a.release(second);assert.equal(normal.refs,2);
 a.destroy();assert.equal(normal.refs,1);assert.equal(surface.refs,1);assert.equal(source.refs,1);
});
