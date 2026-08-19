# P-Gen log — 240×336 layered puppet (overlap cut)

入选源：`尼古喵喵角色图/nico_miaomiao_transparent.png`

## 分层方案

不再按像素独占切片。每层从种子 flood-fill，关节处允许重叠；被挡住的底（裤腰、刘海底下的额）只画在下层，上层盖住后 idle 仍等于原图。

自下而上：

| 层 | 内容 |
|----|------|
| tail | 左髋后的细尾，不进裤腿 |
| clogs | 鞋，含裤脚交界 |
| pants | 整条垮裤 + 衣摆底下的裤腰补底 |
| body-shirt | 完整 T 恤，袖洞给手层盖 |
| hand | 伸出的右手 + 插袋的左手 |
| head | 脸和颈的皮肤，眼窝补皮肤，不含头发 |
| hair | 完整发型，含猫耳外沿与耳内（耳朵层仍叠在上面） |
| ears | 两只完整猫耳（外沿 + 耳内） |
| eyes / mouth | 眼从原图抠；闭口为唇线，张嘴为对准唇线的 3px 小开口 |
| hair-front | 盖住额和眼的刘海 |

轮廓像素会复制到相邻的每一层，单独看某一层时边是封住的。

```
python scripts/gen-pixel-puppet.py
```
