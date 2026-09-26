# 面板运行组件接线交付

已将唯一图集原字节复制到 `game/assets/resources/ui/panels/panels-atlas.png`，资源加载名 `ui/panels/panels-atlas`。SHA 为 `728a09f0e7b1f12d6e6ea6b8c5467dfb372735334ac865c56d34298ea849686a`。52 份冻结候选源均核对通过；没有修改候选、手写 `.meta` 或安装工具。实际推广记录为同目录 `runtime-promotion.json`。

## 已冻结接口

`view/IslandPanels.ts`：

- `new IslandPanels()`：尚未发起资源请求。
- `preload(): Promise<boolean>`：单次共享预载门控。重复调用返回同一 Promise；成功返回 true 并进入 `ready`，失败返回 false 并进入 `failed`，日志前缀 `[GOWAYGUI_UI_PANELS]`。
- `retry(): Promise<boolean>`：仅 `failed` 状态重新发起一次请求；其余状态共用既有结果。旧回调使用 attempt 标识拒绝，不能覆盖新重试。
- `state`：`idle | loading | ready | failed | destroyed`。
- `destroy(): void`：幂等。若仍在加载，立即把等待门控结算为 false，迟到资源不建立引用、纹理或帧。
- `supports(radius,width,height)`：精确匹配 10 / 14 / 18 / 21 / 22 / 24，且宽高至少为两倍圆角；不会取最接近半径或压扁固定角。
- `attach(parent,width,height,radius,fillColor)`：内部供 IslandUI 使用。同步检查 parent 严格有效；已注入普通面板但资源尚未 ready 时明确抛错。

`IslandUI` 构造函数新增可选第四参数：

```ts
// The application owner checks its own validity/screen epoch after awaiting the gate.
const panels = new IslandPanels();
const ready = await panels.preload();
if (ready) {
  const ui = new IslandUI(contentNode, onClick, icons, panels);
  // Now render ordinary panels and buttons.
}
// At application-owner destruction: panels.destroy().
```

资源失败时不应继续注入并绘制普通页面，也不能把旧 Graphics 当作本次皮肤/性能通过。未注入管理器或明确不受支持的动态形状（现有方向提示 `14/scale`）保留原 Graphics；支持形状一律四层 Sprite。GameEntry 的启动门控、失败界面/重试与所有者销毁由根任务及 turtle_art 负责，本任务未修改 GameEntry。

## 尺寸与资源所有权

父 Node 的名字、位置、`UITransform(w,h)`、文本坐标、事件和 tween 均保持原样。每层装饰为 `2*(w+4)` × `2*(h+4)`、local scale `(.5,.5,1)`、anchor `(.5,.5)`。实际外扩的 2px 是透明余量，填充仍恰好 w×h，不增大父触摸区。四层依次为阴影、填充、金线、奶油内线；阴影复用同圆角 fill 帧并位移 `(3,-5)`。

六行 inset 每边依次为 24 / 32 / 40 / 46 / 48 / 52 源像素，对应精确 `layout.json`。全部 18 帧共享一张 Texture2D，`SLICED / CUSTOM / trim=false / packable=false`；LINEAR、无 mip、CLAMP_TO_EDGE。颜色通过 Sprite.color，不为每个面板分配材质、纹理或帧，不修改共享帧 inset。

关闭一个面板只解绑其四层 Sprite 的帧监听，不释放共享图集。销毁管理器时，先清除所有装饰（包括已排队销毁但仍有效的节点）的帧引用，然后销毁 18 帧和单纹理，最后 ImageAsset.decRef。创建装饰中途失败会清理已分配的本面板装饰，保留已有文字子节点。

## 实际检查与剩余验收

`game/tests/island-panels.test.cjs`：10 项通过。覆盖共用 gate、精确冻结 rect/insets、最小高度不压角、2x/.5 的父布局与透明外延、页面与所有者销毁、迟到回调、失败重试、部分分配异常、动态形状 fallback、按钮名称/位置/尺寸/文本/事件保持，以及运行 PNG 与冻结源一致。颜色没有另写一组镜像常量测试。

已执行 Cocos 3.8.8 捆绑 TypeScript 的 `tsc --noEmit -p game/tsconfig.json`，退出 0。没有运行全套测试、Cocos 构建或 Blender，也没有提交 Git。

这些检查验证接口和资源生命周期，不代替实际 Cocos 的九宫格接缝、真实触摸命中、Buffer 占用与帧率验收。未宣称减少多少 draw/FPS/内存。真实引擎渲染与入口门控接线由根任务统一完成。
