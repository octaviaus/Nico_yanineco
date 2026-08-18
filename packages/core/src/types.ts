export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessage = {
  role: ChatRole
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export type ToolCall = {
  id: string
  name: string
  arguments: string
}

export type LlmConfig = {
  baseURL: string
  model: string
  apiKey?: string
  apiKeyEnv?: string
}

export type SttProvider = 'openai' | 'local' | 'webspeech'

export type TtsProvider = 'edge' | 'openai' | 'local' | 'sapi'

export type AppConfig = {
  llm: LlmConfig
  stt: {
    provider: SttProvider
    baseURL?: string
    apiKey?: string
    apiKeyEnv?: string
    model?: string
  }
  tts: {
    provider: TtsProvider
    voice?: string
    rate?: number
    baseURL?: string
    apiKey?: string
    apiKeyEnv?: string
    model?: string
  }
  cursor: {
    cli: string
    workspace?: string
  }
  smoke?: {
    idlePuffSeconds?: number
  }
}

export type ToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ChatResult = {
  content: string
  toolCalls: ToolCall[]
}

export type CharacterPose = 'idle' | 'talk' | 'inhale' | 'exhale'

export type SmokeCommand = {
  intensity?: number
  burst?: boolean
  clear?: boolean
}
