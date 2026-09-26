# 石龟 c11 运行候选晋升记录

2026-09-08：根代理实际查看 c11 三分之四、战斗、攻击侧面和受击关键帧后，批准其替换 v10 运行样板。此次只晋升运行候选，最终美术与用户审美验收尚未通过。没有启动 Blender 或 Cocos，没有修改视图文件。

## 文件与哈希

目标目录：`game/assets/resources/models/stone-turtle/`。来源为本候选 `export/` 下的同名文件，复制后逐字节校验通过。

| 运行文件 | SHA-256 |
| --- | --- |
| stone-turtle.fbx | `9bc1cc37580ad3cb1c9fb57e2f54bf574fc7bac129befb1f7b08f60027d836a7` |
| stone-colour.png | `331db30651c09e8930435b91bf78b7e714b13d6852e488c82a67233bad66ea57` |
| stone-roughness.png | `8fb7f0157aebcd620a6f6535ef04d7307412aea09c553b64e1957335b8b52434` |

粗糙图与 v10 内容相同，仍复制当前候选对应的导出文件。三个 `.meta` 未被工具替换，晋升后即时哈希也与原件完全一致；FBX UUID 保持 `5d7d68a1-9672-41e8-a0ad-05d7a87185f7`。后续 Cocos 正常重新导入可能更新派生元数据，不能把这一动作误写成此次工具修改了 meta。

运行加载路径保持 `models/stone-turtle/stone-turtle/stone-turtle`。导出检查预期为 22,986 三角形、12,581 顶点、1 材质、10 骨、六动作；这并不是已在本轮重新构建后读取到的 Cocos 统计。Cocos 导入、实际运行外观、动作与材质适配由根代理下一次构建检查。

## 原件与可编辑源

`../versions/v10/runtime/` 完整保存原 v10 FBX、两张纹理及三个 meta。`../versions/v10/archive-manifest.json` 记录每个文件大小和 SHA-256；旧的 v10 晋升清单保存在 `../versions/v10/promotion-manifest.json`。原 v10 FBX SHA 为 `8b8f0c56b2be36e8fa1fb082a253cc34271cf53d6983001f78f61ce4eb38260d`。

新的 `promotion-manifest.json` 同时保存在本候选目录和上一级石龟目录，记录来源、目标、前后哈希、UUID、源文件哈希与剩余审查项。`promotion-verification.json` 为完成复制后的校验结果。

canonical 的 `stone-turtle.blend`、`stone-turtle-review-scene.blend`、`stone-turtle.glb` 与 `game/art-source/build_stone_turtle.py` 全部保持 v10 原样。**当前 c11 的可编辑源是本目录中的 Blender 文件，生成脚本是 `game/art-source/build_stone_turtle_candidate11.py`。** 不要运行 canonical v10 脚本去重建当前 c11。候选图和旧的审查证据保持原样。

## 核验与回滚

从项目根目录，用现有 Python 运行以下只读检查：

```powershell
python game/art-source/stone-turtle/candidate-11/runtime_promotion.py verify
python game/art-source/stone-turtle/candidate-11/verify_files.py
```

若明确决定回退，在没有正在写入资源的 Cocos 构建或导入操作时执行：

```powershell
python game/art-source/stone-turtle/candidate-11/runtime_promotion.py rollback
```

该命令先验证备份哈希、UUID 和当前版本，拒绝覆盖后续未知版本；再恢复六个 v10 文件及旧晋升清单，并生成 `rollback-receipt.json`。本次未实际回退，以保留获准运行候选。脚本默认不带参数时仅做只读核验；不调用 Blender/Cocos，不触及 canonical 源。回滚之后，c11 的只读校验会按预期报当前版本不匹配；重新晋升应另做有记录的新决定，避免覆盖原晋升历史。
