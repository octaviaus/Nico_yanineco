export { NikoChat } from './chat.js'
export { chatCompletion, hasLlmCredentials, resolveApiKey } from './llm.js'
export { NO_LLM_FALLBACK, PERSONA_SYSTEM_PROMPT } from './persona.js'
export {
  PET_PHASES,
  PET_PHASE_FACE,
  PET_PHASE_TRANSITIONS,
  PetPhase,
  IllegalPetPhaseTransitionError,
  canTransitionPetPhase,
  createPetPhaseMachine,
  isPetPhase,
  petPhaseToPose,
  resolvePetPhaseFace,
  transitionPetPhase,
  tryTransitionPetPhase
} from './petPhase.js'
export type {
  PetEyeLayer,
  PetMouthLayer,
  PetPhase,
  PetPhaseFace,
  PetPhaseMachine,
  PetPhaseTransitionErr,
  PetPhaseTransitionOk,
  PetPhaseTransitionResult,
  ResolvedPetPhaseFace
} from './petPhase.js'
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
