# PetDex 导出（与原项目隔离）

本目录是给 **PetDex / Codex pet.json 导入器** 用的独立资产包。

**不修改** `apps/`、`packages/`、`assets/`、`scripts/`、`尼古喵喵角色图/` 或任何原桌宠代码。原项目继续用 240×336 分层木偶。

## 这一步完成了什么（设定图）

真源仍是仓库里已有的官方图，这里只做拷贝级派生：

| 文件 | 作用 |
|------|------|
| `ref/official-sheet.png` | `尼古喵喵角色图/50.webp` 去白底、去水印后的透明立绘（身份锁） |
| `ref/official-face.png` | 头+耳特写，用来锁痣、眼、发色 |
| `ref/pixel-idle.png` | `nico_miaomiao_transparent.png` 裁边后的像素 idle |
| `ref/petdex-canonical-idle.png` | 按 PetDex 格比例做的 chibi idle（派生，不是替身） |
| `ref/petdex-canonical-idle-192x208.png` | 同一角色放进 **192×208** 单格 |
| `ref/identity-sheet.png` | 四联对照：官方 / 像素 / chibi / 单格 |
| `ref/identity.json` | 辨识点与路径 |

原图路径只读，没有改过。

## 下一步（还没做）

9 行动画精灵表 + `pet.json`。做的时候继续只写 `petdex/`。
