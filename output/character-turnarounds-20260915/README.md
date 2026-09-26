# 五龟造型确认稿 v1

日期：2026-09-15。状态：v1 整体造型已获用户确认；按用户追加意见修订 v2 的叶灵绿色及五只面部特征。使用内置 image_gen，根据当前角色原画分别生成正面、侧面、背面设定；本批是外观确认图，不是已完成的三维模型。

当前追加修订见 [v2 配色与面部设计说明](v2-art-direction.md)，生成记录见 [v2-generation-prompts.json](v2-generation-prompts.json)。下表保留原始 v1 文件供比较。

## 图稿

|角色|图稿|外观重点|
|---|---|---|
|岩盾|[三视图](01-yandun-turnaround-v1.png)|金黄色皮肤、厚重岩甲、背部与四肢的蓝色水晶|
|叶灵|[三视图](02-yeling-turnaround-v1.png)|深绿叶装、木弓、箭筒与叶披风下的龟壳|
|珊歌|[三视图](03-shange-turnaround-v1.png)|浅青面部、蓝白法袍、海浪法杖与蓝色龟壳|
|阳光|[三视图](04-yangguang-turnaround-v1.png)|温暖表情、草帽、橙色披肩与暖光提灯|
|潮行|[三视图](05-chaoxing-turnaround-v1.png)|浅紫面部、靛蓝金边盔甲、紫色宝石与装甲龟壳|

## 参考与审核范围

- 岩盾主要参考：`game/assets/resources/art-modern/home-stone-keyed.png`。
- 五只角色共同参考：`game/assets/resources/art-modern/companion-signatures-refined.png`。
- 正面以当前原角色为依据；背面为依据可见龟壳、披风、盔甲和装备推导的设计，其整体方向已随 v1 获用户确认。
- 请先审核脸型、头身比、配色、材质和背部装备结构。图稿部分侧面略带转角，建模前仍需核对严格侧视结构及跨视图一致性。
- 每张图单独排版，不代表五只角色的最终相对身高；游戏中仍按岩盾更厚重、另外四只略小的比例执行。
- 图稿尚未替换进游戏；本轮处理用户确认后的两项美术修订。后续先以静态模型的正、侧、背视图核对造型，再进入动作、技能或特效制作。

完整生成指令和原始参考路径见 [generation-prompts.json](generation-prompts.json)。五张原始生成图已无损复制到本目录，并核对源文件与副本的 SHA-256 一致。
