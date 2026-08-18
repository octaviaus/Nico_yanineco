import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '@niko/core'

const DEFAULTS: AppConfig = {
  llm: {
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKeyEnv: 'NIKO_LLM_API_KEY'
  },
  stt: {
    provider: 'webspeech',
    model: 'whisper-1',
    apiKeyEnv: 'NIKO_LLM_API_KEY'
  },
  tts: {
    provider: 'edge',
    voice: 'zh-CN-YunxiNeural'
  },
  cursor: {
    cli: 'agent'
  },
  smoke: {
    idlePuffSeconds: 22
  }
}

export function resolveConfigPath(repoRoot: string, home: string): string {
  const local = path.join(repoRoot, 'config.json')
  if (existsSync(local)) return local
  const example = path.join(repoRoot, 'config.example.json')
  if (existsSync(example)) return example
  return path.join(home, '.niko-meow', 'config.json')
}

export function loadConfig(repoRoot: string, home: string): AppConfig {
  const file = resolveConfigPath(repoRoot, home)
  if (!existsSync(file)) return DEFAULTS
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<AppConfig>
    return {
      llm: { ...DEFAULTS.llm, ...raw.llm },
      stt: { ...DEFAULTS.stt, ...raw.stt },
      tts: { ...DEFAULTS.tts, ...raw.tts },
      cursor: { ...DEFAULTS.cursor, ...raw.cursor },
      smoke: { ...DEFAULTS.smoke, ...raw.smoke }
    }
  } catch (err) {
    console.warn('[config] parse failed, using defaults', err)
    return DEFAULTS
  }
}
