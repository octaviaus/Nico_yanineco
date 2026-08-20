import { Container, Graphics, Sprite, Texture, Ticker, SCALE_MODES, MIPMAP_MODES, Point } from 'pixi.js'
import type { CharacterPose } from '@niko/core'
import type { CharacterRenderer } from './CharacterRenderer'
import { assetPath } from './CharacterRenderer'
import { loadImage } from './knockout'
import {
  DEFAULT_PIXEL_SHEET,
  PIXEL_SCALE,
  faceVariantsOf,
  layerSrcCandidates,
  nextBlinkDelayMs,
  normalizeSheet,
  resolveGroupVariant,
  resolvePoseEyes,
  resolvePoseMouth,
  type FaceState,
  type PixelLayerDef,
  type PixelSheet,
  type PlaceholderShape
} from './pixelSheet'

type LayerView = {
  def: PixelLayerDef
  node: Container
}

export class PixelRenderer implements CharacterRenderer {
  readonly kind = 'pixel' as const
  private readonly root: Container
  private readonly puppet: Container
  private sheet: PixelSheet = DEFAULT_PIXEL_SHEET
  private layers: LayerView[] = []
  private pose: CharacterPose = 'idle'
  private mouthOpen = 0
  private eyeState: FaceState = 'open'
  private blinkSeq: FaceState[] = []
  private blinkIdx = -1
  private blinkAcc = 0
  private blinkHold = 0
  private nextBlink = nextBlinkDelayMs()
  private readonly onTick = (): void => this.tickBlink()

  constructor(
    parent: Container,
    private readonly viewW: number,
    private readonly viewH: number
  ) {
    this.root = new Container()
    this.puppet = new Container()
    this.root.addChild(this.puppet)
    parent.addChild(this.root)
  }

  async load(): Promise<void> {
    this.sheet = await this.loadSheet()
    this.puppet.removeChildren()
    this.layers = []

    const ordered = [...this.sheet.layers].sort((a, b) => a.z - b.z)
    for (const def of ordered) {
      const node = await this.makeLayer(def)
      node.position.set(def.x, def.y)
      this.puppet.addChild(node)
      this.layers.push({ def, node })
    }

    this.layout()
    this.applyPoseFace()
    Ticker.shared.add(this.onTick)
    console.info('Pixel puppet renderer active', {
      layers: this.layers.length,
      size: `${this.sheet.width}×${this.sheet.height}`,
      scale: this.sheet.scale || PIXEL_SCALE
    })
  }

  setPose(pose: CharacterPose): void {
    this.pose = pose
    if (pose === 'idle' || pose === 'inhale') this.mouthOpen = 0
    if (pose !== 'idle') this.stopBlink()
    this.applyPoseFace()
  }

  setMouthOpen(value: number): void {
    this.mouthOpen = Math.max(0, Math.min(1, value))
    this.applyMouth()
  }

  setSmokeParam(_value: number): void {}

  getMouthWorld(): { x: number; y: number } {
    const local = new Point(this.sheet.mouth.x, this.sheet.mouth.y)
    const world = this.puppet.toGlobal(local)
    return { x: world.x, y: world.y }
  }

  destroy(): void {
    Ticker.shared.remove(this.onTick)
    this.root.destroy({ children: true })
  }

  private layout() {
    const scale = this.sheet.scale || PIXEL_SCALE
    this.puppet.scale.set(scale)
    const w = this.sheet.width * scale
    const h = this.sheet.height * scale
    this.root.x = Math.round((this.viewW - w) / 2)
    this.root.y = Math.round(this.viewH - h)
  }

  private applyPoseFace() {
    this.applyMouth()
    if (this.blinkIdx < 0) this.applyEyes()
  }

  private applyEyes() {
    this.setEyes(resolvePoseEyes(this.pose, faceVariantsOf(this.sheet.layers, 'eyes')))
  }

  private applyMouth() {
    this.setGroup(
      'mouth',
      resolvePoseMouth(this.pose, this.mouthOpen, faceVariantsOf(this.sheet.layers, 'mouth'))
    )
  }

  private setEyes(state: FaceState) {
    this.eyeState = state
    this.setGroup('eyes', state)
  }

  private setGroup(group: 'eyes' | 'mouth', variant: FaceState) {
    const members = this.layers.filter((l) => l.def.group === group)
    if (!members.length) return
    const resolved = resolveGroupVariant(
      members.map((l) => l.def.variant),
      variant
    )
    for (const layer of members) {
      if (!layer.def.variant) {
        layer.node.visible = true
        continue
      }
      layer.node.visible = layer.def.variant === resolved
    }
  }

  private hasEye(variant: FaceState): boolean {
    return this.layers.some((l) => l.def.group === 'eyes' && l.def.variant === variant)
  }

  private stopBlink() {
    this.blinkIdx = -1
    this.blinkSeq = []
    this.blinkAcc = 0
  }

  private tickBlink() {
    if (this.pose !== 'idle') {
      if (this.blinkIdx >= 0) {
        this.stopBlink()
        this.applyEyes()
      }
      return
    }
    const dt = Ticker.shared.deltaMS
    this.blinkAcc += dt
    if (this.blinkIdx >= 0) {
      if (this.blinkAcc >= this.blinkHold) {
        this.blinkIdx += 1
        this.blinkAcc = 0
        const next = this.blinkSeq[this.blinkIdx]
        if (!next) {
          this.stopBlink()
          this.applyEyes()
          this.nextBlink = nextBlinkDelayMs()
          return
        }
        this.setEyes(next)
        this.blinkHold = next === 'closed' ? 120 : 55
      }
      return
    }
    if (this.blinkAcc < this.nextBlink) return
    this.blinkAcc = 0
    this.blinkSeq = this.hasEye('half') ? ['half', 'closed', 'half'] : ['closed']
    this.blinkIdx = 0
    this.setEyes(this.blinkSeq[0])
    this.blinkHold = this.blinkSeq[0] === 'closed' ? 140 : 55
  }

  private async loadSheet(): Promise<PixelSheet> {
    try {
      const res = await fetch(assetPath('pixel/sheet.json'))
      if (!res.ok) return DEFAULT_PIXEL_SHEET
      return normalizeSheet(await res.json())
    } catch {
      return DEFAULT_PIXEL_SHEET
    }
  }

  private async makeLayer(def: PixelLayerDef): Promise<Container> {
    const node = new Container()
    node.name = def.name
    const sprite = await this.tryLoadSprite(def)
    if (sprite) {
      node.addChild(sprite)
      return node
    }
    node.addChild(drawPlaceholder(def))
    return node
  }

  private async tryLoadSprite(def: PixelLayerDef): Promise<Sprite | null> {
    for (const rel of layerSrcCandidates(def)) {
      try {
        const img = await loadImage(assetPath(rel))
        const tex = Texture.from(img)
        tex.baseTexture.scaleMode = SCALE_MODES.NEAREST
        tex.baseTexture.mipmap = MIPMAP_MODES.OFF
        const sprite = new Sprite(tex)
        sprite.roundPixels = true
        return sprite
      } catch {
        /* try next candidate */
      }
    }
    return null
  }
}

function drawPlaceholder(def: PixelLayerDef): Graphics {
  const g = new Graphics()
  g.name = def.name
  for (const shape of def.shapes) paintShape(g, shape, def.color)
  return g
}

function paintShape(g: Graphics, shape: PlaceholderShape, color: number) {
  g.lineStyle(0)
  g.beginFill(color, 1)
  if (shape.kind === 'rect') {
    g.drawRect(shape.x, shape.y, shape.w, shape.h)
  } else if (shape.kind === 'ellipse') {
    g.drawEllipse(shape.x, shape.y, shape.rx, shape.ry)
  } else {
    g.drawPolygon(shape.points)
  }
  g.endFill()
}
