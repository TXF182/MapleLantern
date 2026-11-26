# 灯台 · 布景图库（MapleLantern-ImagePack 1.5.14）

本包提供布景九层使用的 **106 张背景 + 106 张前景**，和灯台本体分开发布、分开更新。

- 背景目录：`img/decorations/ml/background1/`
- 前景目录：`img/decorations/ml/foreground1/`
- 两个目录严格分开：背景选择器只读 `background1`，前景选择器只读 `foreground1`，不会把不透明背景图误放进前景槽。
- `hotel` / `bus_station` / `soup_kitchen` / `police_back_office` 4 张前景是两帧呼吸微差（宿主 `idle` 动画每帧 1000ms 循环），其余前景两帧完全一致；差异只在左右装饰带，中央人物区始终透明。
- 需要先安装 `MapleLantern-1.5.14.mod.zip`，再导入本包；两个包都刷新页面后生效。
- 只装灯台本体不装本包时，布景功能仍然存在，但图库缩略图与自动背景/前景没有图可读。
