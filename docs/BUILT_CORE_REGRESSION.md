# Cocos 构建产物规则回归

2026-09-08 的真实浏览器首次合成发现：TypeScript 源码中的 `[...new Set([...a.skills, ...b.skills])]` 被项目的 Cocos Babel 编译结果转为 `[].concat(new Set([].concat(a.skills, b.skills)))`。Set 成为单个数组元素，按技能名过滤后技能池为空；源码 Node 测试通过也无法发现该问题。

核心改用 `Array.from(new Set(a.skills.concat(b.skills)))`。战斗快照验证器十一处 `for-of array.entries()` 也显式转换成数组。审计 core/platform 的全部五十八处数组展开和 for-of 迭代目标，未再发现非数组目标；正常数组展开、对象展开、Set 的 `has`/`size` 与原生构造操作保留。

`game/tools/test-built-core.cjs` 直接读取实际 Web 构建的 `assets/main/index.js` 及 `src/chunks/bundle.js`，按 `System.register` 依赖装载模块，包括同次构建的 Babel helpers。它不导入 TypeScript 源码，也不导入 `.test-build`。仅对 Cocos 脚本注册记录 `_RF.push/pop` 做空实现，未模拟战斗、合成、随机数、存档或事务行为。因此这是实际转换后规则的回归，不能替代 Cocos 画面和输入试玩。

回归从真实新档完成教学前两波，验证检查点重启与错误技能拒绝。第一只射手由服务升级为三技能，第二只肉盾保持两技能。接着检查两个职业分支的非空合法技能池、概率归一、三十二个生成样本、实际合成、未揭晓重启不重抽、揭晓比较、不收录保留亲本、确认后两来源进入历史、重复收录与最终存档解码。

旧构建已在相同的“三技能射手 + 两技能肉盾”预览阶段失败，错误为“合成数量参数不合法”；证据与实际 JS 文件 SHA-256 保存在 `docs/reports/built-core-before-iterable-fix.json`。工具在任何阶段失败均返回非零退出码，并报告所在阶段；不能用“源码测试通过”替代这条构建检查。

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' game/tools/test-built-core.cjs --report docs/reports/built-core-after-iterable-fix.json
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test game/tests/built-core.test.cjs
```

两条命令均须在真正的 Cocos Web 构建完成后运行。第一条可在工具名后传入另一个 Web 构建目录，不能传源码目录。干净工程缺少构建时会明确失败并提示先运行 `game/tools/build-web.ps1`，不会跳过当作通过。报告与测试诊断包含实际产物构建时间及 SHA-256；单独执行只证明所列产物，源码变化后必须重新构建。

`build-web.ps1` 已把此回归接入成功判定。编辑器退出码 36、入口文件及编译日志检查通过后，还要确认主 bundle 属于本轮构建，并且实际产物回归通过，最后才输出 `BUILD_SUCCESS`。Node 默认使用本机 bundled runtime，可用 `-NodePath` 覆盖。每轮回归 JSON 存在同轮 build-logs 内，`latest-build.json` 记录产物哈希、时间、回归路径及退出码。

新构建在 2026-09-08 11:52:22 完成；实际产物回归通过，射手技能池为五项、肉盾三项，两亲本准确各进入历史一次。通过证据为 `docs/reports/built-core-after-iterable-fix.json`，其主脚本 SHA-256 为 `fb9c031893ffdd42b6f4aa446fcabb80c794c5836504a667709dce8dc5088255`。当前项目构建配置没有已验证可用于游戏脚本的 Babel loose 覆盖设置；引擎自身的 `babel.config.js` 不是项目游戏脚本构建配置，本次不修改引擎或猜测全局开关。
