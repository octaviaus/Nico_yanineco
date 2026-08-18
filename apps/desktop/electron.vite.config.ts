import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

const core = resolve(__dirname, '../../packages/core/src')
const voice = resolve(__dirname, '../../packages/voice/src')
const agent = resolve(__dirname, '../../packages/agent/src')

const alias = {
  '@niko/core': core,
  '@niko/voice': voice,
  '@niko/agent': agent
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@niko/core', '@niko/voice', '@niko/agent'] })],
    resolve: { alias }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    resolve: { alias },
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, '../../assets'),
    base: './',
    build: {
      rollupOptions: {
        input: {
          character: resolve(__dirname, 'src/renderer/character.html'),
          smoke: resolve(__dirname, 'src/renderer/smoke.html')
        }
      }
    }
  }
})
