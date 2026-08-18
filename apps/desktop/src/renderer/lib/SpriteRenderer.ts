import { Container, Sprite, Texture, Graphics } from 'pixi.js'
import type { CharacterPose } from '@niko/core'
import type { CharacterRenderer } from './CharacterRenderer'
import { assetPath } from './CharacterRenderer'
import { loadImage } from './knockout'

const POSES: CharacterPose[] = ['idle', 'talk', 'inhale', 'exhale']

type SpriteAnchors = {
  origin?: string
  mouth: { x: number; y: number }
  cigarette?: { x: number; y: number }
}

const DEFAULT_ANCHORS: SpriteAnchors = {
  origin: 'top-left',
  mouth: { x: 0.58, y: 0.19 },
  cigarette: { x: 0.64, y: 0.2 }
}

export class SpriteRenderer implements CharacterRenderer {
  readonly kind = 'sprite' as const
  private readonly root: Container
  private readonly sprite: Sprite
  private textures = new Map<CharacterPose, Texture>()
  private pose: CharacterPose = 'idle'
  private fallback: Graphics | null = null
  private anchors: SpriteAnchors = DEFAULT_ANCHORS

  constructor(
    parent: Container,
    private readonly viewW: number,
    private readonly viewH: number
  ) {
    this.root = new Container()
    this.sprite = new Sprite()
    this.sprite.anchor.set(0.5, 1)
    this.root.addChild(this.sprite)
    parent.addChild(this.root)
    this.root.x = this.viewW / 2
  }

  async load(): Promise<void> {
    await this.loadAnchors()
    let loaded = 0
    for (const pose of POSES) {
      try {
        const img = await loadImage(assetPath(`sprites/${pose}.png`))
        this.textures.set(pose, Texture.from(img))
        loaded += 1
      } catch {
        /* optional pose */
      }
    }
    if (!loaded) {
      this.fallback = drawFallbackCat()
      this.root.addChild(this.fallback)
      this.sprite.visible = false
    } else {
      this.setPose('idle')
      this.layout()
    }
  }

  setPose(pose: CharacterPose): void {
    this.pose = pose
    const tex = this.textures.get(pose) || this.textures.get('idle')
    if (tex) {
      this.sprite.texture = tex
      this.layout()
    }
  }

  setMouthOpen(_value: number): void {
    if (_value > 0.35 && this.textures.has('talk') && this.pose === 'idle') {
      this.sprite.texture = this.textures.get('talk')!
    }
  }

  setSmokeParam(_value: number): void {}

  getMouthWorld(): { x: number; y: number } {
    const b = this.sprite.getBounds()
    return {
      x: b.x + b.width * this.anchors.mouth.x,
      y: b.y + b.height * this.anchors.mouth.y
    }
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }

  private async loadAnchors(): Promise<void> {
    try {
      const res = await fetch(assetPath('sprites/anchor.json'))
      if (!res.ok) return
      const data = (await res.json()) as Partial<SpriteAnchors>
      if (data.mouth && Number.isFinite(data.mouth.x) && Number.isFinite(data.mouth.y)) {
        this.anchors = {
          origin: data.origin || 'top-left',
          mouth: data.mouth,
          cigarette: data.cigarette
        }
      }
    } catch {
      /* keep defaults */
    }
  }

  private layout() {
    const tex = this.sprite.texture
    if (!tex || !tex.width) return
    const maxH = this.viewH * 0.94
    const scale = maxH / tex.height
    this.sprite.scale.set(scale)
    this.root.y = this.viewH - 4
    this.root.x = this.viewW / 2
  }
}

function drawFallbackCat(): Graphics {
  const g = new Graphics()
  g.beginFill(0x6b6258)
  g.drawEllipse(0, 40, 58, 70)
  g.endFill()
  g.beginFill(0x5c534b)
  g.drawCircle(0, -28, 42)
  g.endFill()
  g.beginFill(0x5c534b)
  g.moveTo(-36, -48)
  g.lineTo(-18, -78)
  g.lineTo(-8, -50)
  g.closePath()
  g.endFill()
  g.beginFill(0x5c534b)
  g.moveTo(36, -48)
  g.lineTo(18, -78)
  g.lineTo(8, -50)
  g.closePath()
  g.endFill()
  g.lineStyle(3, 0x2a2420)
  g.moveTo(-16, -30)
  g.quadraticCurveTo(-10, -24, -4, -30)
  g.moveTo(4, -30)
  g.quadraticCurveTo(10, -24, 16, -30)
  g.lineStyle(0)
  g.beginFill(0xc4b8a4)
  g.drawEllipse(14, -12, 10, 5)
  g.endFill()
  g.lineStyle(2, 0xd0c8b0)
  g.moveTo(22, -12)
  g.lineTo(48, -28)
  g.lineStyle(0)
  g.beginFill(0xc45c2a)
  g.drawCircle(48, -28, 3)
  g.endFill()
  g.position.set(0, 0)
  return g
}
