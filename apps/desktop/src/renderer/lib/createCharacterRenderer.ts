import type { Container } from 'pixi.js'
import type { CharacterRenderer } from './CharacterRenderer'
import { SpriteRenderer } from './SpriteRenderer'
import { tryCreateLive2DRenderer } from './Live2DRenderer'

/** Prefer Live2D when a model3.json + Cubism Core are present; otherwise sprites. */
export async function createCharacterRenderer(
  parent: Container,
  viewW: number,
  viewH: number,
  modelRel: string | null,
  cubismRel: string | null
): Promise<CharacterRenderer> {
  const live2d = await tryCreateLive2DRenderer(parent, modelRel, cubismRel, viewW, viewH)
  if (live2d) return live2d
  const sprites = new SpriteRenderer(parent, viewW, viewH)
  await sprites.load()
  return sprites
}
