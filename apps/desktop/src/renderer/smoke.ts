import { Application } from 'pixi.js'
import { SmokeField, makeCloudTexture } from './lib/SmokeField'
import { SMOKE_ORIGIN_FROM_BOTTOM, SMOKE_ORIGIN_FROM_RIGHT } from '../shared/geometry'

const app = new Application({
  resizeTo: window,
  backgroundAlpha: 0,
  antialias: false,
  resolution: 1,
  autoDensity: true,
  autoStart: false
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

function stopIfIdle() {
  if (!field.isEmpty) return
  if (app.ticker.started) app.ticker.stop()
}

app.ticker.add(() => {
  field.tick(null, false)
  stopIfIdle()
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
  if (field.isEmpty) {
    app.render()
    app.ticker.stop()
    return
  }
  if (!app.ticker.started) app.ticker.start()
})
