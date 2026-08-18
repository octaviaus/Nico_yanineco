import { Application, Ticker } from 'pixi.js'
import { SmokeField, makeCloudTexture } from './lib/SmokeField'
import { SMOKE_ORIGIN_FROM_BOTTOM, SMOKE_ORIGIN_FROM_RIGHT } from '../shared/geometry'

const app = new Application({
  resizeTo: window,
  backgroundAlpha: 0,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true
})
document.body.appendChild(app.view as HTMLCanvasElement)

const field = new SmokeField(makeCloudTexture(), 2.4)
app.stage.addChild(field.container)

function origin() {
  return {
    x: window.innerWidth - SMOKE_ORIGIN_FROM_RIGHT,
    y: window.innerHeight - SMOKE_ORIGIN_FROM_BOTTOM
  }
}

Ticker.shared.add(() => {
  field.tick(origin(), false)
})

window.niko.onSmoke((cmd) => {
  if (cmd.clear) field.clear()
  if (typeof cmd.intensity === 'number') field.setIntensity(Math.max(0.05, cmd.intensity))
  if (cmd.burst) {
    const o = origin()
    field.burst(o.x, o.y, 28)
    for (let i = 0; i < 10; i++) {
      field.spawn(o.x + Math.random() * 80, o.y - Math.random() * 40, true)
    }
  }
})

window.niko.getConfig().then((cfg) => {
  field.setIntensity(0.2)
  window.setInterval(() => {
    const o = origin()
    field.spawn(o.x, o.y, false)
  }, Math.max(10, cfg.idlePuffSeconds) * 400)
})
