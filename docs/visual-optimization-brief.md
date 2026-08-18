# 尼古喵喵视觉优化任务书

给**另一个 Agent** 读：把桌面助手从「临时 AI 猫贴图」换成用户提供的**动漫角色尼古喵喵**。不要改人设文案的核心语气，不要重做 Electron / LLM / Cursor 桥，除非视觉接入必须碰到。

## 0. 任务目标

用户确认：尼古喵喵是**动漫角色**（猫耳少女），官方/设定图在仓库：

- 源目录：[尼古喵喵角色图/](../尼古喵喵角色图/)
- 目前仅有：`尼古喵喵角色图/50.webp`（全身站立设定图，白底、中性站姿、右手微抬）

当前桌宠用的是实现阶段生成的**另一只抽烟猫**（`assets/sprites/*.png` + `assets/live2d-layers/*.png`），外形、配色、体型都对不上。优化 = **以设定图为唯一视觉真源**，让窗口里的角色、烟雾吐口位置、托盘图标、Live2D 分层全部跟这张图走。

完成标准（验收）：

1. 桌面上出现的是设定图里的少女，而不是灰毛卫衣猫。
2. 白底被去掉，角色贴在桌面上，没有白方块、没有误切身体。
3. 待机 / 说话 / 吸气 / 吐烟四种状态看得出是**同一个角色**。
4. 烟从**嘴附近**冒出，不是凭空从旧猫嘴坐标喷。
5. UI 配色贴近设定图（米白 T 恤、暗蓝垮裤、灰绿短发），不再用焦油棕。
6. `docs/live2d-spec.md` 与 `assets/live2d-layers/` 按**本角色**重写，旧猫分层作废。

## 1. 角色视觉真源（必须遵守）

从 `50.webp` 锁定，禁止脑补成兽形猫、禁止换发型发色。

| 项 | 内容 |
|----|------|
| 物种 | 人形少女 + 猫耳 + 细长深灰猫尾 |
| 发 | 短、凌乱、浅灰绿；刘海不齐，遮一点额 |
| 眼 | 大、深棕、没精神；**左眼下方有一颗痣** |
| 耳 | 与头发同色，耳尖深灰/黑 |
| 上衣 | 过大的米白/奶油短袖 T，领口松、有小 V 口 |
| 下装 | 非常宽松的暗蓝/石板灰垮裤，堆在脚踝 |
| 鞋 | 橄榄绿洞洞鞋/clog |
| 气质 | 颓、散、没整理过；动作幅度小 |
| 当前图姿态 | 正面全身站立，右手略伸，闭嘴，**图上没有烟** |

配色（UI / 粒子可取样）：

- 发/耳：`#9aa392` 一带
- T 恤：`#efe6d8`
- 裤：`#4a5560`
- 鞋：`#6b7348`
- 皮肤：浅，冷调
- 烟：浅灰，不要纯白、不要工业黑烟

## 2. 现状（不要在这些上原地打补丁将就）

| 路径 | 问题 |
|------|------|
| [`assets/sprites/{idle,talk,inhale,exhale}.png`](../assets/sprites/) | AI 生成的另一只角色，带暗底 |
| [`assets/live2d-layers/`](../assets/live2d-layers/) | 按旧猫切的层，不能给本角色用 |
| [`apps/desktop/src/renderer/lib/knockout.ts`](../apps/desktop/src/renderer/lib/knockout.ts) | 按「暗角抠黑」写的，设定图是**白底**，会抠失败或吃掉浅色衣服 |
| [`SpriteRenderer.getMouthWorld`](../apps/desktop/src/renderer/lib/SpriteRenderer.ts) | 嘴坐标写死 `宽*0.62, 高*0.38`，是旧猫比例 |
| 角色窗 `300×460` / stage `340` 高 | 按坐姿猫估的；本角色是**全身站立**，要更高更窄，或脚裁掉一点但头不能顶破 |
| [`character.css`](../apps/desktop/src/renderer/character.css) | 焦油棕气泡，和米白/灰绿设定冲突 |
| [`docs/live2d-spec.md`](./live2d-spec.md) | 层名按旧猫（卫衣、兽爪） |

**不要删** `尼古喵喵角色图/`。那是源文件。运行时资源仍走 Vite `publicDir` → [`assets/`](../assets/)（见 [`apps/desktop/electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts)）。

## 3. 约束

- 只做视觉与贴图管线。语音、LLM、Cursor 工具、托盘逻辑能不动就不动。
- **禁止**再生成一只「像那么回事的猫」顶替官方图。
- 若必须补表情/持烟图：只能以 `50.webp` 为参考做 **img2img / 局部重绘**，锁脸、锁衣服、锁左眼下痣；出图后和设定图并排，不像就丢掉重来。
- 没有 Cubism Editor 就不要假装做出 `.moc3`。Live2D 本阶段 = 分层 PNG + 更新规范；程序侧继续 `createCharacterRenderer`：有 model3 用 Live2D，否则精灵。
- 大图不要塞进 git 重复：源图留在 `尼古喵喵角色图/`，处理后的透明 PNG 才进 `assets/`。
- 改完用 `npx pnpm@9.15.0 --filter @niko/desktop build` 确认能编过；`npx pnpm@9.15.0 dev` 看桌面。

## 4. 建议工作顺序（按阶段做，每阶段可单独提交）

### 阶段 A — 盘点源图（先做，可能提前结束幻想）

1. 列出 `尼古喵喵角色图/` 全部文件（格式、分辨率、是否白底、是否含表情/三视图/烟）。
2. 若仍只有 `50.webp`：后续表情用「同一张全身 + 局部改嘴/眼/烟」而不是四张完全不同的生成图。
3. 在本文件末尾「源图清单」补上实际文件表（文件名、用途判定）。

**完成：** 文档里有清单；知道缺哪些表情。

### 阶段 B — 去底与运行时贴图

1. 把 `50.webp` 转成带 Alpha 的 PNG（可用脚本或画布：白/近白阈值抠，保护米白衣服——T 恤不是纯白，不要把衣服抠没）。
2. 输出到 `assets/sprites/idle.png`（覆盖旧猫）。
3. **删掉或停用** 对这套图的 `knockoutToCanvas` 暗角逻辑。透明 PNG 直接 `Texture.from`；若仍要兜底，改成「只抠与画布四角同色的近白」，并加容差配置。
4. 按透明图重算窗口：全身站立建议角色窗大约 **280×560** 或裁成膝盖以上半身（桌宠更清晰）。改：
   - [`apps/desktop/src/main/windows.ts`](../apps/desktop/src/main/windows.ts) 窗口尺寸与初始坐标
   - [`character.html`](../apps/desktop/src/renderer/character.html) / CSS `#stage` 高
   - [`character.ts`](../apps/desktop/src/renderer/character.ts) 里 Pixi `Application` 高
   - `SpriteRenderer` 的 `viewH`、锚点（建议仍 `anchor (0.5, 1)` 脚贴底）
5. 托盘图标：从去底后的**头+耳**裁 64×64 再缩到 16，替换 [`tray.ts`](../apps/desktop/src/main/tray.ts) 对 `sprites/idle.png` 整图缩小（整身缩 16px 会糊成泥）。

**完成：** 启动后桌面上是这名少女，白底没了，头耳可辨。

### 阶段 C — 四态：idle / talk / inhale / exhale

`SpriteRenderer` 仍读：

- `assets/sprites/idle.png`
- `assets/sprites/talk.png`
- `assets/sprites/inhale.png`
- `assets/sprites/exhale.png`

在**同一角色、同一构图**下制作：

| 文件 | 建议做法（只有一张设定图时） |
|------|------------------------------|
| idle | 去底后的站姿；可微垂眼皮 |
| talk | 同一张，只改嘴（微张）；不要换发型 |
| inhale | 同一张，眼更眯、腮微收；可在嘴边加短烟 |
| exhale | 同一张，嘴微张 + 嘴前一小缕烟（大团烟仍用粒子，不要画满屏烟在贴图上） |

香烟：设定图**没画烟**。吐烟人设要保留的话：

- 优先做单独图层 `cigarette.png`，程序叠在手指/嘴角；或
- 只在 inhale/exhale 两张上画细烟，idle 可以不拿烟（更像设定图）或嘴角挂一根（需局部重绘，锁身份）

**完成：** 切姿态时是同一人在换表情，不是四只不同的猫。

### 阶段 D — 烟口坐标与粒子

1. 不要再用魔法数 `0.62 / 0.38`。
2. 增加 `assets/sprites/anchor.json`（或写进 config），例如：

```json
{
  "mouth": { "x": 0.52, "y": 0.22 },
  "cigarette": { "x": 0.58, "y": 0.24 }
}
```

坐标为相对精灵贴图的 0–1（原点左上或与 Pixi 锚点约定写清）。用设定图量：嘴在**头下部、略偏角色左眼痣对侧**；全身图里嘴大约在画布高度 18%–25% 一带，不是旧猫的 38%。

3. [`SpriteRenderer.getMouthWorld`](../apps/desktop/src/renderer/lib/SpriteRenderer.ts) 读这份配置。
4. [`SmokeField`](../apps/desktop/src/renderer/lib/SmokeField.ts) 粒子改淡灰、更散、更慢，匹配无精打采；全屏烟仍从角色窗位置出（[`smoke.ts`](../apps/desktop/src/renderer/smoke.ts) 的 `origin()` 要随新窗口宽高改，现在写死右下 `width-160, height-280`）。
5. 待机自动吐烟间隔可保持；吸/吐时切对应 pose。

**完成：** 烟从脸上出来；改窗口大小后烟口仍准。

### 阶段 E — UI 跟设定图

改 [`character.css`](../apps/desktop/src/renderer/character.css)：

- 气泡：半透明米白/浅灰，字深灰，不要棕黑焦油风
- 输入框、按钮：石板灰 + 米白字
- 顶栏「尼古喵喵」更淡、更小，别抢角色
- 尽量让 **Pixi 画布占满窗口**，聊天条可做成角色脚边一条，不要一块厚重控制台

**完成：** 截图里 UI 不像另一套皮肤。

### 阶段 F — Live2D 资产管线（仍无 moc3 也要做）

作废旧 `assets/live2d-layers/` 里的猫部件。从去底全身图切层（允许同一轮廓重复切，Cubism 再修网格）：

建议层（按叠放，下→上）：

1. `clogs.png` 鞋  
2. `pants.png` 裤  
3. `tail.png` 尾  
4. `body-shirt.png` 躯干 + T 恤（不含头）  
5. `head.png` 脸+颈（闭口、开眼或半眯）  
6. `hair-back.png` / `hair-front.png`（若切得出）  
7. `ears.png`  
8. `eyes-open.png` / `eyes-half.png` / `eyes-closed.png`  
9. `mouth-closed.png` / `mouth-open.png` / `mouth-smoke.png`  
10. `cigarette.png` + `hand.png`（右手微抬，烟可夹在这只手）

重写 [`docs/live2d-spec.md`](./live2d-spec.md)：删掉卫衣/兽爪描述；参数表可保留 `ParamMouthOpenY`、`ParamEyeLOpen`、`ParamBreath`、`ParamSmoke`。注明源图是 `尼古喵喵角色图/50.webp`。

程序：[`createCharacterRenderer.ts`](../apps/desktop/src/renderer/lib/createCharacterRenderer.ts) 逻辑保持「有 Live2D 模型则用」。本阶段不强制做出 `.moc3`。

**完成：** 分层目录与规范描述的是这个少女；旧猫层不在仓库里误导下一任。

### 阶段 G — 人设与视觉对齐（小改即可）

[`docs/persona.md`](./persona.md) 现在写「一只猫」。视觉已是猫耳少女，建议补一句：**外形是猫耳少女，说话仍按颓废猫耳人，不要突然变成女仆或元气偶像**。system prompt（[`packages/core/src/persona.ts`](../packages/core/src/persona.ts)）同步一句即可，不要改工具策略。

**完成：** 说话自称/外形不互相打架。

## 5. 明确不要做

- 不要用现有 `idle.png` 那只抽烟猫「微调」。
- 不要为了透明去把 T 恤扣成镂空。
- 不要把设定图拉伸成方形桌宠头像只露脸（除非用户后来要求 chibi）；默认**能认出全身剪影**。
- 不要在本任务里接 Cubism Editor 商业授权流程以外的「假 Live2D」。
- 不要把 `尼古喵喵角色图/50.webp` 删掉或改名到找不到。

## 6. 关键代码入口（改这些就够）

- 精灵加载：`apps/desktop/src/renderer/lib/SpriteRenderer.ts`
- 去底：`apps/desktop/src/renderer/lib/knockout.ts`
- 渲染选择：`apps/desktop/src/renderer/lib/createCharacterRenderer.ts`
- 角色窗 Pixi + 口型/PTT：`apps/desktop/src/renderer/character.ts`
- 全屏烟位置：`apps/desktop/src/renderer/smoke.ts`
- 窗口几何：`apps/desktop/src/main/windows.ts`
- 托盘：`apps/desktop/src/main/tray.ts`
- 资源目录：`assets/sprites/`、`assets/live2d-layers/`（Vite publicDir = 仓库 `assets/`）

## 7. 源图清单（阶段 A 填）

| 文件 | 类型 | 备注 |
|------|------|------|
| `尼古喵喵角色图/50.webp` | 全身设定、白底、站立、闭嘴、无烟 | **当前唯一真源**；1027×1197 RGB；右下萌娘百科水印 |
| （无表情差分 / 三视图 / 持烟图 / PSD） | — | 四态先复用去底 idle；烟靠粒子 |

---

接手 Agent 开场应做：打开 `50.webp` 确认与上文外貌一致 → 阶段 B 去底替换 idle → 再补四态和烟口。不要先画 Live2D。
