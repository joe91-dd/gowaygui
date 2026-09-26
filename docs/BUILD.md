# Cocos 工程与本地构建

工程目录：`game`。编辑器固定使用 `C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe`。

## 构建

从项目工作区运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File game/tools/build-web.ps1
```

构建脚本调用真实 Cocos Creator，等待编辑器的 `36` 成功退出码，并检查 `game/build/web-mobile/index.html` 以及缺失脚本和编译错误。编辑器可能在场景组件缺失时仍返回 36，所以退出码不能单独证明成功。日志及最新结果在 `game/temp/build-logs`；此目录和生成目录不纳入版本管理。

脚本使用 `game/temp/creator-user-data` 保存独立编辑器缓存，并以隐藏窗口执行。当前 Codex 沙箱内的 Electron GPU 子进程会退出，实际构建已通过沙箱外执行验证；这不需要管理员安装，也不修改系统默认程序。日后由 Codex 执行时，必要的沙箱外执行仍需工具审批。

## 本地启动

```powershell
node game/tools/build-serve.mjs
```

打开 `http://127.0.0.1:7457`。端口只监听本机，静态服务器不使用第三方依赖。不支持直接双击 HTML，通过 HTTP 启动可以避免浏览器的文件协议限制。

若 PATH 没有 Node，可使用本机现有的 `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` 代替命令开头的 `node`。

## 编辑器与入口

在 Creator 中打开 `game` 文件夹，打开 `assets/scenes/Main.scene`。入口是 `Game` 节点挂载的 `assets/scripts/view/GameEntry.ts`，由 `@ccclass('GameEntry')` 注册。

- 主场景 UUID：`f5b8b6b2-c8cc-41f8-afd7-f6ce7b5f6401`。
- 入口脚本 UUID：`67125b11-b370-4554-88e7-294920499661`。
- 默认相机与方向光已序列化在场景中。
- 初期圆球和地面仅用于 M1 构建管线验证，必须在视听验收前替换。

## 官方依据

[Cocos Creator 3.8 命令行发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html) 规定 `--project`、`--build configPath=...` 入口以及成功退出码 36。

## 已验证结果

2026-09-08 09:48 的第二轮构建：Cocos 3.8.8 成功退出码 36，缺失脚本和编译错误扫描为空，生成了真实引擎、脚本包、主场景和 Web 启动页面。Cocos 构建任务耗时 19 秒，完整启动导入到退出约 46 秒。记录：`game/temp/build-logs/20260908-094806.*.log` 与 `latest-build.json`。

本机静态服务已验证根页面 HTTP 200。浏览器画面、WebGL 和 `GameEntry.start()` 的实际运行验证由整合验收另行记录；HTTP 200 不代替这些检查。

当前版本固定为 landscape；该属性根据本机 web-mobile 插件 `@types/index.d.ts` 使用 `packages.web-mobile.orientation`，不是旧版 `webOrientation`。

首次浏览器检查随后发现动态创建材质缺少被打包的 standard effect，以及属性名称 `albedo` 不合法。已增加 `PipelineStandard.mtl`，在场景通过 `@property(Material)` 显式序列化引用保证效果入包；运行时复制材质并设置正确 `mainColor`。2026-09-08 10:09 构建再次返回 36，仍需浏览器刷新检查真正的三维画面。这项修复保留了 M1 画面只是临时管线夹具的标记。
