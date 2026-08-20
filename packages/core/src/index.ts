export { NikoChat } from './chat.js'
export { chatCompletion, hasLlmCredentials, resolveApiKey } from './llm.js'
export { NO_LLM_FALLBACK, PERSONA_SYSTEM_PROMPT } from './persona.js'
export * from './petPhase.js'
export type {
  AppConfig,
  CharacterPose,
  ChatMessage,
  ChatResult,
  LlmConfig,
  SmokeCommand,
  SttProvider,
  ToolCall,
  ToolDef,
  TtsProvider
} from './types.js'
