# 开发与交接（2026-09-26）

本仓库保存当前可维护源码与资源，不保存个人账号、房间存档、编辑器缓存和历次试玩导出。首次导入是当前工作目录的独立快照；原电脑上已有的 Git 分支、历史提交和本地检查点继续保留，没有清理或改写。

## 环境和首次启动

- Git + Git LFS；Cocos Creator **3.8.8**；Node.js **22 或更新的 LTS**。
- Windows 是目前维护和验证的平台。美术制作可选 Blender 4.5，脚本的具体依赖见各制作目录说明。

```powershell
git lfs install
git clone https://github.com/joe91-dd/gowaygui.git
cd gowaygui
git lfs pull
cd game
npm ci
```

在 Cocos Dashboard 中导入 `game` 目录，以 3.8.8 打开，等待首次资源导入完成。`temp/tsconfig.cocos.json`、`library` 等由编辑器生成，不要提交。图片或模型文件只有几行 `version https://git-lfs...` 文字时，说明 LFS 实体资源尚未下载，先运行 `git lfs pull`。

构建手机横屏 Web 版本：

```powershell
# 改成自己电脑上的安装位置，也可以给 build-web.ps1 传 -CreatorPath。
$env:COCOS_CREATOR = 'D:/Cocos/Creator/3.8.8/CocosCreator.exe'
npm run build:web
npm run serve
```

默认构建输出 `game/build/web-mobile`。也可在编辑器的构建发布面板导入 `build-config.web-mobile.json`，执行 Web Mobile 构建。根目录 `Build-Game.cmd`、`Play-Game.cmd` 提供相同入口。预览默认地址 `http://127.0.0.1:7658/`；端口被占用时先设置 `$env:PORT='7660'`。这不会停止原有试玩服务。

`npm run serve` 会先编译服务端核心，然后在同一个端口启动静态资源、账号、双人副本房间和世界 BOSS API。只启动静态文件服务器无法完整使用这些玩法。服务端存档默认保存在忽略的 `game/server/data`，不要提交或直接复制真实玩家数据。可用 `ROOM_DATA` 指定独立存档文件。

试玩全玩法：`/?preview=all-maps&all-modes=1&balance=coast&map=0`。该参数用于开发验证；不要把试玩解锁参数作为正式服账号权限设计。

已有不同名称的导出可运行：`npm run serve -- build/<目录名称>`。`build-expedition-scripts.cjs` 是历史的脚本增量导出工具，需要已存在且资源匹配的 Cocos 导出；新同事首次启动应先执行完整编辑器构建。

## 代码和资源

| 目录 | 用途 |
| --- | --- |
| `game/assets/scripts/core` | 战斗、征召/合成、干粮、关卡、技能、经济、副本、世界 BOSS 等领域逻辑 |
| `game/assets/scripts/view` | 战斗和主页呈现、HUD、地图站位、模型与动画 |
| `game/assets/scripts/platform` | 存档、网络和平台适配 |
| `game/assets` 其他目录 | Cocos 场景、运行时模型、材质、纹理、音效；必须保留 `.meta` UUID |
| `game/server` | 账号、房间和世界 BOSS 服务 |
| `game/tests`、`game/tools` | 自动化验证、构建、资源制作与检查工具 |
| `game/art-source`、`game/audio-source` | 可编辑美术/音频源文件与来源记录，二进制由 LFS 管理 |
| `tools` | 从原 C 盘兼容目录补齐的历史预览/美术脚本 |
| `game/tools/legacy-enemy-production` | 从外置素材工作区补齐的怪物制作脚本 |
| `docs`、`output` 中保留的脚本和 Markdown | 设计资料、历史修改记录和制作辅助脚本 |

历史制作脚本可能仍引用当时的素材工作区、旧导出或本机 Blender 路径，运行前根据脚本用途调整。它们不是启动游戏的必需入口。API 任务回执、账户余额、个人文件以及重复生成的预览和下载包未纳入仓库。

截至此快照，最新迭代包括干粮征召、局内合成与点位交换、前五关战术节奏试调、怪物脚部移动动画。历史设计文档和旧测试中的数量、玩法描述可能落后于当前源码，不应据此回退现有玩法。

## 检查

```powershell
npm run build:server
npm run typecheck       # 需要先用 Cocos 打开工程生成 temp 配置
npm run test:gait
npm test                # 包含历史回归测试；部分依赖旧构建/历史验收资源
```

本次整理的验证结果见 `docs/HANDOFF-VALIDATION.md`。不要将历史全量测试的失败当成已通过；涉及玩法的修改应补做对应模式的实际试玩。没有完整 Cocos 导出时，不要将已有构建或仅脚本替换误报为全新构建。

## 两人协作

1. 仓库所有者在 GitHub 的 Settings → Collaborators 中邀请同事的 GitHub 账号，不共享账号密码。
2. 每项修改从最新 `main` 建立功能分支，提交后发起 Pull Request。合并前检查差异和对应玩法。
3. 新增/移动/删除资源时一起提交 `.meta`；不要由两个人各自生成同一资源的新 UUID。
4. 修改大型 Blender/模型文件前协调分工；二进制不能像 TypeScript 一样逐行合并。
5. 更新依赖时一起提交 `package.json` 和 `package-lock.json`；不要提交 `node_modules`、`library`、`temp`、`build` 或服务器玩家存档。
6. 密钥通过环境变量或本地配置提供。示例 QA 脚本需要显式设置 `QA_PASSWORD`，仓库不提供真实密码。

资源受 Git LFS 管理，协作者应使用 Git 克隆并运行 LFS，而非依赖网页 ZIP 下载。GitHub 的 LFS 存储与下载额度由仓库账号管理；本次没有开通任何付费服务。
