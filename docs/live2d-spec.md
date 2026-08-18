# Live2D 资产规范

仓库**不能**直接产出 Cubism 的 `.moc3`（需要 Live2D Cubism Editor）。这里提供可导入的分层 PNG、参数表和导出约定。精灵图阶段由 `SpriteRenderer` 负责；当 `assets/live2d/` 下出现 `*.model3.json` 且 Cubism Core 就位时，`Live2DRenderer` 会自动接管。

## 源图

- 官方设定：`尼古喵喵角色图/50.webp`（猫耳少女，全身站立，白底，图上**没有烟**）
- 切层真源：`assets/sprites/idle.png`（已去底，459×1197）
- 切层脚本：`scripts/slice-live2d-layers.py`（改完 idle 后重跑）

## 烟（方案 A）

**不提供 `cigarette.png`。** 抽烟人设只靠程序粒子（`SmokeField` + `assets/sprites/anchor.json` 的嘴坐标）。Cubism 里不要画一根烟来冒充。`ParamSmoke` 仍由程序写入，用来调粒子浓度，不驱动烟图层。

## 分层原图

全部在 [`assets/live2d-layers/`](../assets/live2d-layers/)，**画布与 `idle.png` 同尺寸**，角色像素位置锁定，直接叠。关节处有重叠，被挡住的身体没有脑补。导入后请自己切网格。

建议叠放顺序（下 → 上）：

| 文件 | 用途 |
|------|------|
| `clogs.png` | 橄榄绿洞洞鞋 |
| `pants.png` | 暗蓝垮裤 |
| `tail.png` | 深色细尾（与右腿侧裤腿有重叠，进 Cubism 再修） |
| `body-shirt.png` | 躯干 + 过大米白 T 恤（不含头） |
| `head.png` | 脸 + 颈（源图闭口、睁眼，可被上层盖住）。与头发交界不干净，先将就 |
| `hair.png` | 灰绿短发（不含耳）。与头、刘海有串色，先将就 |
| `hair-front.png` | 刘海 |
| `ears.png` | 猫耳 |
| `eyes-open.png` | 源图睁眼 |
| `mouth-closed.png` | 源图闭嘴 |
| `hand.png` | 微抬的右手，摊开，**不持烟** |

旧猫层（`body.png`、卫衣、兽爪、`cigarette.png`、张嘴/吐烟嘴）已删除，不要再引用。

一张平涂图按颜色切，`head.png` / `hair.png` / `hair-front.png` 边缘会黏。没有 PSD 和 Cubism 前不修；以后有分层源文件或 Editor 再抠。桌宠运行不读这些层，毛边不影响现在的窗口。

### 暂无差分（不要用 AI 另生成一张脸来填）

只有一张设定图，下列文件**故意没有**：

- `eyes-half.png` / `eyes-closed.png`
- `mouth-open.png` / `mouth-smoke.png`
- `cigarette.png`

有官方表情或持烟图后再补，仍须锁脸、锁衣服、锁左眼下痣。眨眼/张嘴在有差分之前，用程序粒子和 `ParamMouthOpenY` 将就。

## 参数

| 参数 | 范围 | 说明 |
|------|------|------|
| `ParamAngleX` / `Y` / `Z` | -30 ~ 30 | 跟随指针，幅度要小，别精神 |
| `ParamEyeLOpen` / `ParamEyeROpen` | 0 ~ 1 | 0 闭，0.35 半眯，1 睁。目前只有 `eyes-open` 贴图 |
| `ParamMouthOpenY` | 0 ~ 1 | 口型；TTS 时可按音量抖动。目前只有 `mouth-closed` 贴图 |
| `ParamBreath` | 0 ~ 1 | 呼吸，idle 慢循环 |
| `ParamSmoke` | 0 ~ 1 | 自定义：越大程序粒子越浓，**不显示烟图层** |

## 动作文件（.motion3.json）

| 名称 | 用途 |
|------|------|
| `idle` | 几乎不动，偶尔眨眼 |
| `talk` | 嘴动，身体别大幅度 |
| `inhale` | 吸一口，肩微塌 |
| `exhale` | 吐烟；程序侧拉高 `ParamSmoke` 和粒子 |

## 导出到本项目

1. Cubism 导出 **Cubism 4 / 5 SDK** 格式到临时目录。
2. 把 `*.model3.json`、`*.moc3`、纹理、物理、动作拷进 `assets/live2d/`。
3. 从 [Live2D Cubism SDK for Web](https://www.live2d.com/sdk/download/web/) 取得 `live2dcubismcore.min.js`，放到 `assets/live2d/runtime/live2dcubismcore.min.js`（官方运行时，许可证限制，**不要**把 Core 提交到公开仓库除非你有授权）。
4. 重启桌面助手。日志出现 `Live2D renderer active` 即成功。本阶段没有 moc3 时，桌宠仍走精灵图，分层只给以后导入。

## 程序侧映射

`Live2DRenderer` 会尝试：

- `setPose('talk'|'idle'|'inhale'|'exhale')` → 播放同名 motion，找不到就只改参数
- `setMouthOpen(v)` → `ParamMouthOpenY`
- `setSmokeParam(v)` → `ParamSmoke`（粒子，不是烟贴图）
