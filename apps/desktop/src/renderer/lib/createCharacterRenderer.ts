import type { Container } from 'pixi.js'
import type { CharacterRenderer } from './CharacterRenderer'
import { PixelRenderer } from './PixelRenderer'

/** Default: pixel puppet. Live2D takeover is Wave 2. */
export async function createCharacterRenderer(
  parent: Container,
  viewW: number,
  viewH: number,
  _modelRel: string | null,
  _cubismRel: string | null
): Promise<CharacterRenderer> {
  const pixel = new PixelRenderer(parent, viewW, viewH)
  await pixel.load()
  return pixel
}
