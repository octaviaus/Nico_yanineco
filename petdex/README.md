# PetDex 导出（与原项目隔离）

本目录是给 **PetDex / Codex pet.json 导入器** 用的独立资产包。

**不修改** `apps/`、`packages/`、`assets/`、`scripts/`、`尼古喵喵角色图/` 或任何原桌宠代码。原项目继续用 240×336 分层木偶。

## 可导入包

把整个文件夹，或 zip，丢给对方项目即可：

```text
petdex/niko-miao/
├── pet.json
└── spritesheet.webp

petdex/niko-miao.zip          # 根目录就是 pet.json + spritesheet.webp
```

- 表尺寸 **1536×2288**（v2，8×11，每格 192×208）
- `spriteVersionNumber`: **2**
- 行 0–8：`idle`（点烟）· `running-right` · `running-left` · `waving` · `jumping` · `failed` · `waiting` · `running`（干活抽烟）· `review`
- 行 9–10：`look-directions-a`（八向转身）· `look-directions-b`（视线）
- idle 慢点烟；干活行（`running`）叼烟吐一小口。走路/挥手做了持帧，`pet.json` 里 `animation.durationMs` 约 220–280ms
- 未用格留空（透明）

```json
{
  "id": "niko-miao",
  "displayName": "尼古喵喵",
  "description": "A sleepy cat-eared girl in an oversized tee who smokes and watches you code.",
  "spritesheetPath": "spritesheet.webp",
  "spriteVersionNumber": 2
}
```

对照：`qa/contact-sheet.png`。循环预览：`qa/preview-idle.gif`、`preview-waving.gif`、`preview-jumping.gif`、`preview-look-a.gif`。

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

## Windows：装到 Codex `~/.codex/pets`

`Copy-Item` **不会**创建还不存在的目录。若报错
`未能找到路径 …\.codex\pets\niko-miao\ 的一部分`，先建文件夹再拷：

```powershell
# 在仓库根目录执行（先 git checkout cursor/petdex-ref-sheet-854e）
powershell -ExecutionPolicy Bypass -File petdex\install-to-codex.ps1
```

或手敲：

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex\pets\niko-miao"
Copy-Item "petdex\niko-miao\pet.json","petdex\niko-miao\spritesheet.webp" `
  "$env:USERPROFILE\.codex\pets\niko-miao\"
dir "$env:USERPROFILE\.codex\pets\niko-miao"
```

若当前不在仓库根目录，把 `petdex\niko-miao\` 换成该文件夹的完整路径。拷完后重启导入器，选「尼古喵喵」。
