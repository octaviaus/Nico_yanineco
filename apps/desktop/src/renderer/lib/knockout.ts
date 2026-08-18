/**
 * Dark-bg knockout for the old generated cat sprites.
 * Official 尼古喵喵 sheets are pre-keyed by scripts/knockout-sprite.py — do not
 * run this on cream-shirt art (it will eat the T-shirt).
 */
export function knockoutToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = image.data
  const corners = [
    0,
    (canvas.width - 1) * 4,
    (canvas.height - 1) * canvas.width * 4,
    ((canvas.height - 1) * canvas.width + canvas.width - 1) * 4
  ]
  let br = 0
  let bg = 0
  let bb = 0
  for (const i of corners) {
    br += d[i]
    bg += d[i + 1]
    bb += d[i + 2]
  }
  br /= 4
  bg /= 4
  bb /= 4
  const thresh = 28
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const dist = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)
    if (dist < thresh * 3) {
      d[i + 3] = 0
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`load failed: ${src}`))
    img.src = src
  })
}
