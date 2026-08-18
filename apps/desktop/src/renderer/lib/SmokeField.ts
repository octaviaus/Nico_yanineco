import { Container, Sprite, Texture } from 'pixi.js'

type Puff = {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  max: number
  grow: number
}

export function makeCloudTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  g.addColorStop(0, 'rgba(210,210,208,0.42)')
  g.addColorStop(0.45, 'rgba(168,170,166,0.16)')
  g.addColorStop(1, 'rgba(140,142,138,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(64, 64, 62, 0, Math.PI * 2)
  ctx.fill()
  return Texture.from(canvas)
}

export class SmokeField {
  readonly container = new Container()
  private puffs: Puff[] = []
  private intensity = 0.2
  private readonly tex: Texture
  private readonly scaleMul: number

  constructor(tex: Texture, scaleMul = 1) {
    this.tex = tex
    this.scaleMul = scaleMul
  }

  get isEmpty(): boolean {
    return this.puffs.length === 0
  }

  setIntensity(v: number) {
    this.intensity = Math.min(1, Math.max(0, v))
  }

  clear() {
    for (const p of this.puffs) p.sprite.destroy()
    this.puffs = []
    this.intensity = 0
  }

  burst(x: number, y: number, count = 18) {
    for (let i = 0; i < count; i++) this.spawn(x, y, true)
  }

  spawn(x: number, y: number, strong = false) {
    const s = new Sprite(this.tex)
    s.anchor.set(0.5)
    s.x = x + (Math.random() - 0.4) * 22
    s.y = y + (Math.random() - 0.5) * 14
    const size = (strong ? 0.85 : 0.32) * (0.6 + Math.random()) * this.scaleMul
    s.scale.set(size)
    s.alpha = 0.08 + Math.random() * 0.18
    this.container.addChild(s)
    this.puffs.push({
      sprite: s,
      vx: (0.12 + Math.random()) * (strong ? 1.1 : 0.35) * this.scaleMul,
      vy: (-0.22 - Math.random() * 0.45) * (strong ? 1.2 : 0.5) * this.scaleMul,
      life: 0,
      max: 90 + Math.random() * (strong ? 160 : 70),
      grow: 0.004 + Math.random() * 0.008
    })
  }

  tick(origin: { x: number; y: number } | null, talking: boolean) {
    const idleRate = 0.02 + this.intensity * 0.08
    const talkRate = 0.12 + this.intensity * 0.2
    const rate = talking ? talkRate : idleRate
    if (origin && Math.random() < rate && this.intensity > 0.02) {
      this.spawn(origin.x, origin.y, talking || this.intensity > 0.7)
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]
      p.life += 1
      p.sprite.x += p.vx
      p.sprite.y += p.vy
      p.vx *= 0.995
      p.vy *= 0.99
      p.sprite.scale.x += p.grow
      p.sprite.scale.y += p.grow
      const t = p.life / p.max
      p.sprite.alpha = Math.max(0, (1 - t) * (0.18 + this.intensity * 0.35))
      if (p.life >= p.max) {
        p.sprite.destroy()
        this.puffs.splice(i, 1)
      }
    }
    if (this.puffs.length > 180) {
      const extra = this.puffs.splice(0, this.puffs.length - 180)
      extra.forEach((p) => p.sprite.destroy())
    }
  }
}
