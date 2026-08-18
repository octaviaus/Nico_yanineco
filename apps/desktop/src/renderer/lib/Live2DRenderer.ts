import { Container, Ticker } from 'pixi.js'
import type { CharacterPose } from '@niko/core'
import type { CharacterRenderer } from './CharacterRenderer'
import { assetPath } from './CharacterRenderer'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-cubism="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.dataset.cubism = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Cubism Core 加载失败: ${src}`))
    document.head.appendChild(s)
  })
}

export async function tryCreateLive2DRenderer(
  parent: Container,
  modelRel: string | null,
  cubismRel: string | null,
  viewW: number,
  viewH: number
): Promise<CharacterRenderer | null> {
  if (!modelRel || !cubismRel) return null
  try {
    await loadScript(assetPath(cubismRel))
    const mod = await import('pixi-live2d-display/cubism4')
    const { Live2DModel } = mod
    Live2DModel.registerTicker(Ticker)
    const model = await Live2DModel.from(assetPath(modelRel))
    model.anchor.set(0.5, 1)
    const scale = (viewH * 0.94) / (model.height || 800)
    model.scale.set(scale)
    model.x = viewW / 2
    model.y = viewH - 4
    parent.addChild(model)
    console.info('Live2D renderer active')
    return new Live2DRenderer(model)
  } catch (err) {
    console.warn('[live2d] fallback to sprites', err)
    return null
  }
}

class Live2DRenderer implements CharacterRenderer {
  readonly kind = 'live2d' as const

  constructor(private readonly model: {
    x: number
    y: number
    width: number
    height: number
    internalModel?: {
      coreModel?: {
        setParameterValueById?: (id: string, value: number) => void
      }
      motionManager?: {
        startMotion?: (group: string, index?: number) => void
      }
    }
    motion?: (group: string) => Promise<unknown>
    destroy: (opts?: { children?: boolean }) => void
  }) {}

  setPose(pose: CharacterPose): void {
    const motion = this.model.motion
    if (typeof motion === 'function') {
      void motion.call(this.model, pose).catch(() => this.applyPoseParams(pose))
      return
    }
    this.applyPoseParams(pose)
  }

  setMouthOpen(value: number): void {
    this.setParam('ParamMouthOpenY', value)
  }

  setSmokeParam(value: number): void {
    this.setParam('ParamSmoke', value)
  }

  getMouthWorld(): { x: number; y: number } {
    return { x: this.model.x + 20, y: this.model.y - this.model.height * 0.55 }
  }

  destroy(): void {
    this.model.destroy({ children: true })
  }

  private applyPoseParams(pose: CharacterPose) {
    if (pose === 'talk') this.setMouthOpen(0.6)
    else if (pose === 'inhale') this.setMouthOpen(0.15)
    else if (pose === 'exhale') {
      this.setMouthOpen(0.4)
      this.setSmokeParam(0.8)
    } else {
      this.setMouthOpen(0)
      this.setSmokeParam(0.15)
    }
  }

  private setParam(id: string, value: number) {
    this.model.internalModel?.coreModel?.setParameterValueById?.(id, value)
  }
}
