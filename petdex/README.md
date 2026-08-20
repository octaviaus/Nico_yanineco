# PetDex 导出（与原项目隔离）

本目录是给 **PetDex / Codex pet.json 导入器** 用的独立资产包。

**不修改** `apps/`、`packages/`、`assets/`、`scripts/`、`尼古喵喵角色图/` 或任何原桌宠代码。原项目继续用 240×336 分层木偶。

## 可导入包

把整个文件夹丢给对方项目即可：

```text
petdex/niko-miao/
├── pet.json
└── spritesheet.webp   # 也有 spritesheet.png 备份
```

- 表尺寸 **1536×1872**（8×9，每格 192×208）
- 行：`idle` · `running-right` · `running-left` · `waving` · `jumping` · `failed` · `waiting` · `running` · `review`
- 未用格留空（透明）

```json
{
  "id": "niko-miao",
  "displayName": "尼古喵喵",
  "description": "A sleepy cat-eared girl in an oversized tee who smokes and watches you code.",
  "spritesheetPath": "spritesheet.webp",
  "spriteVersionNumber": 1
}
```

对照图：`qa/contact-sheet.png`。

## 设定图（身份锁）

| 文件 | 作用 |
|------|------|
| `ref/official-sheet.png` | `尼古喵喵角色图/50.webp` 去白底（真源） |
| `ref/official-face.png` | 头+耳特写 |
| `ref/pixel-idle.png` | 已有像素 idle |
| `ref/identity-sheet.png` | 四联对照 |
| `ref/identity.json` | 辨识点 |

## 重跑

```bash
python3 petdex/tools/prepare_ref.py
python3 petdex/tools/assemble_spritesheet.py
```

只写 `petdex/`。
