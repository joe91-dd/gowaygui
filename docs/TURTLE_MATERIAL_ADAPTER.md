# 石龟原生材质对照适配

这是可回退的运行时材质修正，尚需 Cocos 实际画面对照验收。没有改变 FBX、PNG、导入 meta、角色造型、环境色或太阳强度，也没有加入 IBL/反射探针。Blender 摄影棚使用三盏大面积光和 AgX，与当前 Cocos 单方向光/LDR 的结果仍然存在合理差别。

## 使用与回退

```ts
import {TurtleMaterialAdapter} from './TurtleMaterialAdapter';
const turtleMaterials = new TurtleMaterialAdapter(pipelineMaterial);
const changedSlots = turtleMaterials.apply(instantiatedStoneNode);
// 多只石龟可共用一份适配器，同一节点多次 apply 幂等。
// apply 必须在 instantiate 后调用；不在每帧创建材质。

turtleMaterials.release(instantiatedStoneNode); // 该龟立即恢复原始材质
turtleMaterials.apply(instantiatedStoneNode);   // 可再次对照
turtleMaterials.destroy();                     // 场景/界面退出时清理
```

`apply` 返回替换的材质槽数。默认只处理名称以 `StoneAtlas_` 开头、effect 为 `util/dcc/imported-specular-glossiness`（兼容不带路径名）、且含两个有效 Texture2D 的材质；其余材质保持原状。BattleWorld显式传入第二个参数 `['StoneAtlas_', 'InkBlob_Toy_Atlas']` 后才适配小墨团。空前缀不会匹配全部资源。返回 0 时应核验资源名称和导入内容，不应宣称适配已生效。不同根节点共享同一原始材质时，复用一个原生材质。

节点 `NODE_DESTROYED` 会自动注销并释放该节点的使用计数。显式 `release` / `destroy` 恢复仍存活、且尚未被其他代码覆盖的材质槽；不覆盖其他系统后续换入的材质。最后一个使用者释放时销毁创建的材质并归还原始材质、两张纹理的自持引用。适配器生命周期内另持有项目模板引用，以保持所复制 effect 的依赖存活；不调用 `resources.release`，不销毁原素材。创建或绑定异常会回滚已持引用。

光照独立回退：`lightIsland(scene)` 明确使用 `renderer.scene.PCFType.SOFT`（4 次采样），`lightIsland(scene, false)` 恢复 `HARD`。两者都保持 1024 阴影图、原方向、bias、环境亮度和太阳强度。这样可以分别检查“材质”与“阴影”的效果。

## 本地引擎核验与数值

核验版本：本机 Cocos Creator 3.8.8，源码根目录 `C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine`。

| 项目 | 适配值 | 引擎依据 |
| --- | --- | --- |
| Effect | 复制项目 `PipelineStandard.mtl` 的 `builtin-standard`，不透明 technique 0 | `Material.copy(mat, overrides)` 可在复制时编译宏；基础 `Material.recompileShaders` 只警告，不生效 |
| 颜色 | 原 `mainTexture`；白色 mainColor；albedoScale=(1,1,1) | `builtin-standard.effect:246–251` 颜色采样执行 SRGBToLinear，再乘白色 |
| 粗糙度 | 原 `shininessExponentMap` 绑定 `pbrMap`；roughness=1 | `builtin-standard.effect:226–229,334–341` 默认通道 R=遮蔽、G=粗糙度、B=金属、A=高光；roughness 乘 G，按线性数据采样 |
| 遮蔽/金属 | occlusion=0，metallic=0 | 遮蔽为 mix(1,R,0)=1；金属为0×B=0，避免把灰度图其他通道错误解释为遮蔽或金属 |
| 非金属反射 | specularIntensity=.5，粗糙度 PNG 的 A=1 | `surfaces/module-functions/standard-fs.chunk:161` 的 F0=specularIntensity×.08，因此 F0=.04 |
| 发光/法线 | 发光黑色，关闭额外发光图/法线图/顶点色等宏 | 防止继承模板的附加表面效果，隔离当前材质对照变量 |
| 阴影 | 1024，PCF SOFT=1，4采样 | `cocos/render-scene/scene/shadows.ts` 明确 HARD=0、SOFT=1；仅提高贴图尺寸并不改变滤波类型 |

现石龟粗糙度 PNG 的像素只有 RGB=145、110、51，Alpha 全255，因此实际 roughness 分别约 .569、.431、.200。原图与 FBX 导入嵌入图的 SHA256 和逐像素比较完全一致。此适配依赖这张**不透明灰度图**；未来若更换带非白 alpha 的图，必须重新检查 specularIntensity 的 A 通道，不能机械复用本方案。

小墨团candidate-02粗糙图也是不透明灰度图，RGB=79/82/110、Alpha=255，对应粗糙度约.310/.322/.431。运行FBX的预期材质名为InkBlob_Toy_Atlas；实际导入名称、贴图槽和替换效果仍待统一Cocos构建检查。

原导入材质的 `specularFactor=.135` 经 Blender 专用转换得到 `specularIntensity=(1+4r)×.135×.25`，进入 Standard 光照后 F0 约为 .00884/.00736/.00486。这是本次替换的可确认参数差异。没有证据表明原颜色图被错误修改或粗糙度接反；导入 SG shader 的 `1-r` 与最终 `1-glossiness` 会还原原粗糙度。导入材质的 mainColor=231 在有颜色图的分支并不再乘 RGB，也不作为本次提亮理由。

## 验证边界

`game/tests/turtle-material-adapter.test.cjs` 使用安装的 Cocos TypeScript 编译器和最小引擎对象桩，覆盖正确通道配置、原素材不变、共享引用、重复调用、节点销毁、外部覆盖、异常回滚与阴影回退。它能验证接口/资源生命周期，不能证明 WebGL shader 在目标设备上的视觉结果。需在下一次真实构建记录 apply 返回槽数，对同一龟、相机、背景、曝光分别截图比较原材质与原生材质，再单独比较 HARD/SOFT；最终亮度、材质观感和小游戏 GPU 成本由实际验收决定。
