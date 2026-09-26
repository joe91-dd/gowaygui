# 哥喂龟 / gowaygui

Cocos Creator 3.8.8 手机横屏游戏工程。这里集中保存当前客户端、服务端、运行时资源、可编辑素材、测试和制作脚本，供协作维护开发。

**首次接手请阅读 [开发与交接说明](docs/DEVELOPMENT.md)。** 本次验证结果见 [交接检查记录](docs/HANDOFF-VALIDATION.md)。

## 获取完整工程

需要 Git、Git LFS、Node.js 22+ 和 Cocos Creator 3.8.8。

```powershell
git lfs install
git clone https://github.com/joe91-dd/gowaygui.git
cd gowaygui
git lfs pull
cd game
npm ci
```

用 Cocos Creator 3.8.8 打开 `game` 并等待资源导入。设置自己的编辑器路径后构建和启动：

```powershell
$env:COCOS_CREATOR = 'D:/Cocos/Creator/3.8.8/CocosCreator.exe'
npm run build:web
npm run serve
```

默认访问 http://127.0.0.1:7658/ 。预览全部玩法可加 `?preview=all-maps&all-modes=1&balance=coast&map=0`。副本房间和世界 BOSS 需要随游戏一起启动的 API 服务，不能只运行静态预览。

## 内容

- `game/assets/scripts`：战斗、玩法、UI、网络和存档代码。
- `game/server`：账号、组队房间和世界 BOSS 服务。
- `game/assets`：Cocos 场景与游戏资源，连同所有 `.meta` 一起版本管理。
- `game/art-source`、`game/audio-source`：美术和音频制作源文件；二进制采用 Git LFS。
- `game/tests`、`game/tools`、`tools`：测试、构建和制作工具。
- `docs`、`output` 中保留的脚本及 Markdown：设计、历史制作工具与进度记录。

本地缓存、试玩导出、编辑器安装包、重复下载、真实账号/存档和凭据不上传。首次发布为当前源码快照，旧本地提交和检查点仍保留在原电脑。

现有文档与部分历史测试对应较早的玩法阶段；请结合 [交接说明](docs/DEVELOPMENT.md) 和当前源码判断。本文不代表所有玩法已完成上线验收。
