import type { CharacterPose } from '@niko/core'

/** Pixel puppet atlas: native art is 240×336 with nearest-neighbor scale 1. */

export const PIXEL_NATIVE_WIDTH = 80
export const PIXEL_NATIVE_HEIGHT = 112
export const PIXEL_SCALE = 3

export type PlaceholderShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number }
  | { kind: 'poly'; points: number[] }

export type PixelLayerGroup = 'eyes' | 'mouth'
export type FaceState = 'open' | 'half' | 'closed'

export type PixelLayerDef = {
  name: string
  src: string
  z: number
  x: number
  y: number
  group?: PixelLayerGroup
  variant?: FaceState
  color: number
  shapes: PlaceholderShape[]
}

export type PixelPoseFace = {
  eyes?: FaceState
  mouth?: FaceState
}

export type PixelSheet = {
  width: number
  height: number
  scale: number
  mouth: { x: number; y: number }
  layers: PixelLayerDef[]
  poses: Partial<Record<CharacterPose, PixelPoseFace>>
}

const SKIN = 0xe8d4c4
const HAIR = 0x9aa392
const HAIR_DARK = 0x7a8270
const SHIRT = 0xefe6d8
const PANTS = 0x4a5560
const CLOGS = 0x6b7348
const TAIL = 0x5a5850
const EYE = 0x3a2a20
const MOUTH_CLOSED = 0xc45c6a
const MOUTH_OPEN = 0x7a2838

function layer(
  name: string,
  z: number,
  color: number,
  shapes: PlaceholderShape[],
  extra: Partial<PixelLayerDef> = {}
): PixelLayerDef {
  return {
    name,
    src: `layers/${name}.png`,
    z,
    x: 0,
    y: 0,
    color,
    shapes,
    ...extra
  }
}

/** Bottom → top. Eye/mouth variants share a z and are toggled, not stacked. */
export const DEFAULT_PIXEL_SHEET: PixelSheet = {
  width: PIXEL_NATIVE_WIDTH,
  height: PIXEL_NATIVE_HEIGHT,
  scale: PIXEL_SCALE,
  mouth: { x: 40, y: 34 },
  layers: [
    layer('tail', 0, TAIL, [{ kind: 'ellipse', x: 18, y: 78, rx: 10, ry: 16 }]),
    layer('clogs', 1, CLOGS, [
      { kind: 'rect', x: 26, y: 100, w: 12, h: 8 },
      { kind: 'rect', x: 44, y: 100, w: 12, h: 8 }
    ]),
    layer('pants', 2, PANTS, [{ kind: 'rect', x: 28, y: 64, w: 26, h: 38 }]),
    layer('body-shirt', 3, SHIRT, [{ kind: 'rect', x: 26, y: 40, w: 28, h: 30 }]),
    layer('hand', 4, SKIN, [{ kind: 'ellipse', x: 58, y: 60, rx: 7, ry: 6 }]),
    layer('hair', 5, HAIR, [{ kind: 'ellipse', x: 40, y: 22, rx: 20, ry: 18 }]),
    layer('head', 6, SKIN, [
      { kind: 'ellipse', x: 40, y: 26, rx: 16, ry: 16 },
      { kind: 'ellipse', x: 32, y: 32, rx: 1.4, ry: 1.4 }
    ]),
    layer('ears', 7, HAIR_DARK, [
      { kind: 'poly', points: [24, 18, 20, 4, 34, 14] },
      { kind: 'poly', points: [56, 18, 60, 4, 46, 14] }
    ]),
    layer('hair-front', 8, HAIR, [
      { kind: 'rect', x: 26, y: 12, w: 10, h: 10 },
      { kind: 'rect', x: 44, y: 12, w: 10, h: 10 },
      { kind: 'rect', x: 36, y: 10, w: 8, h: 8 }
    ]),
    layer('eyes-open', 9, EYE, [
      { kind: 'ellipse', x: 33, y: 26, rx: 3.5, ry: 4 },
      { kind: 'ellipse', x: 47, y: 26, rx: 3.5, ry: 4 }
    ], { group: 'eyes', variant: 'open' }),
    layer('eyes-half', 9, EYE, [
      { kind: 'ellipse', x: 33, y: 26, rx: 3.5, ry: 1.6 },
      { kind: 'ellipse', x: 47, y: 26, rx: 3.5, ry: 1.6 }
    ], { group: 'eyes', variant: 'half' }),
    layer('eyes-closed', 9, EYE, [
      { kind: 'rect', x: 29, y: 26, w: 8, h: 2 },
      { kind: 'rect', x: 43, y: 26, w: 8, h: 2 }
    ], { group: 'eyes', variant: 'closed' }),
    layer('mouth-closed', 10, MOUTH_CLOSED, [{ kind: 'rect', x: 36, y: 33, w: 8, h: 2 }], {
      group: 'mouth',
      variant: 'closed'
    }),
    layer('mouth-open', 10, MOUTH_OPEN, [{ kind: 'ellipse', x: 40, y: 35, rx: 4.5, ry: 3.5 }], {
      group: 'mouth',
      variant: 'open'
    })
  ],
  poses: {
    idle: { eyes: 'open', mouth: 'closed' },
    talk: { eyes: 'open', mouth: 'open' },
    inhale: { eyes: 'closed', mouth: 'closed' },
    exhale: { eyes: 'half', mouth: 'open' }
  }
}

export function parseFaceState(v: unknown): FaceState | undefined {
  return v === 'open' || v === 'half' || v === 'closed' ? v : undefined
}

export function inferFaceSlot(name: string): Pick<PixelLayerDef, 'group' | 'variant'> {
  const n = name.toLowerCase()
  if (/(eye|blink)/.test(n)) {
    let variant: FaceState = 'open'
    if (/(close|shut)/.test(n)) variant = 'closed'
    else if (/half/.test(n)) variant = 'half'
    return { group: 'eyes', variant }
  }
  if (/(mouth|lip)/.test(n)) {
    return {
      group: 'mouth',
      variant: /(open|talk|smoke)/.test(n) ? 'open' : 'closed'
    }
  }
  return {}
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function parseLayer(raw: unknown, index: number, fallback: PixelLayerDef | undefined): PixelLayerDef {
  if (typeof raw === 'string') {
    const name = raw.replace(/\.(png|webp|gif)$/i, '')
    const base = fallback ?? layer(name, index, 0x888888, [{ kind: 'rect', x: 8, y: 8 + index * 6, w: 64, h: 8 }])
    const face = inferFaceSlot(name)
    return { ...base, name, src: `layers/${name}.png`, ...face }
  }
  const o = asRecord(raw)
  if (!o) {
    return fallback ?? layer(`layer-${index}`, index, 0x888888, [{ kind: 'rect', x: 8, y: 8, w: 64, h: 8 }])
  }
  const name = str(o.name) || str(o.id) || fallback?.name || `layer-${index}`
  const src =
    str(o.src) ||
    str(o.file) ||
    str(o.path) ||
    str(o.image) ||
    fallback?.src ||
    `layers/${name}.png`
  const face = inferFaceSlot(name)
  const group =
    parseGroup(o.group) ?? parseGroup(o.slot) ?? face.group ?? fallback?.group
  const variant =
    parseFaceState(o.variant) ?? parseFaceState(o.state) ?? face.variant ?? fallback?.variant
  return {
    name,
    src,
    z: num(o.z ?? o.zIndex ?? o.order, fallback?.z ?? index),
    x: num(o.x, fallback?.x ?? 0),
    y: num(o.y, fallback?.y ?? 0),
    group,
    variant,
    color: num(o.color, fallback?.color ?? 0x888888),
    shapes: fallback?.shapes ?? [{ kind: 'rect', x: 8, y: 8 + index * 6, w: 64, h: 8 }]
  }
}

function parseGroup(v: unknown): PixelLayerGroup | undefined {
  return v === 'eyes' || v === 'mouth' ? v : undefined
}

function parsePoses(raw: unknown): PixelSheet['poses'] {
  const poses: PixelSheet['poses'] = {
    idle: { ...DEFAULT_PIXEL_SHEET.poses.idle },
    talk: { ...DEFAULT_PIXEL_SHEET.poses.talk },
    inhale: { ...DEFAULT_PIXEL_SHEET.poses.inhale },
    exhale: { ...DEFAULT_PIXEL_SHEET.poses.exhale }
  }
  const o = asRecord(raw)
  if (!o) return poses
  for (const key of ['idle', 'talk', 'inhale', 'exhale'] as CharacterPose[]) {
    const p = asRecord(o[key])
    if (!p) continue
    poses[key] = {
      eyes: parseFaceState(p.eyes) ?? poses[key]?.eyes,
      mouth: parseFaceState(p.mouth) ?? poses[key]?.mouth
    }
  }
  return poses
}

function parseLayerList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  const o = asRecord(raw)
  if (!o) return null
  return Object.entries(o).map(([name, value]) => {
    if (typeof value === 'string') return { name, src: value }
    const rec = asRecord(value)
    return rec ? { name, ...rec } : { name }
  })
}

/** Merge optional assets/pixel/sheet.json onto the default puppet contract. */
export function normalizeSheet(raw: unknown): PixelSheet {
  const sheet: PixelSheet = {
    width: DEFAULT_PIXEL_SHEET.width,
    height: DEFAULT_PIXEL_SHEET.height,
    scale: DEFAULT_PIXEL_SHEET.scale,
    mouth: { ...DEFAULT_PIXEL_SHEET.mouth },
    layers: DEFAULT_PIXEL_SHEET.layers.map((l) => ({ ...l, shapes: [...l.shapes] })),
    poses: parsePoses(null)
  }
  const o = asRecord(raw)
  if (!o) return sheet

  const canvas = asRecord(o.canvas)
  const size = asRecord(o.size)
  sheet.width = num(o.width ?? canvas?.width ?? size?.w, sheet.width)
  sheet.height = num(o.height ?? canvas?.height ?? size?.h, sheet.height)
  sheet.scale = num(o.scale, sheet.scale) || PIXEL_SCALE

  const mouth = asRecord(o.mouth) || asRecord(asRecord(o.anchors)?.mouth)
  if (mouth) {
    const x = num(mouth.x, sheet.mouth.x)
    const y = num(mouth.y, sheet.mouth.y)
    if (x > 0 && x <= 1 && y > 0 && y <= 1) {
      sheet.mouth = { x: x * sheet.width, y: y * sheet.height }
    } else {
      sheet.mouth = { x, y }
    }
  }

  sheet.poses = parsePoses(o.poses)

  const listed = parseLayerList(o.layers ?? o.parts ?? o.sprites)
  if (!listed?.length) return sheet

  const byName = new Map(sheet.layers.map((l) => [l.name, l]))
  const next: PixelLayerDef[] = []
  const seen = new Set<string>()
  listed.forEach((item, i) => {
    const rec = asRecord(item)
    const nameGuess =
      typeof item === 'string'
        ? item.replace(/\.(png|webp|gif)$/i, '')
        : str(rec?.name) || str(rec?.id)
    const parsed = parseLayer(item, i, nameGuess ? byName.get(nameGuess) : undefined)
    next.push(parsed)
    seen.add(parsed.name)
  })
  for (const keep of sheet.layers) {
    if (!seen.has(keep.name) && keep.group) next.push(keep)
  }
  sheet.layers = next
  return sheet
}

export function layerSrcCandidates(layer: PixelLayerDef): string[] {
  const src = layer.src.replace(/^\//, '').replace(/^pixel\//, '')
  const name = layer.name
  const out = [`pixel/${src}`, `pixel/layers/${name}.png`, `pixel/${name}.png`]
  return [...new Set(out)]
}
