import type { CharacterPose } from './types.js'

/**
 * Conversation + puff phases for the pixel pet (ST-STATE-01 / R06).
 * Listening / Thinking are conversation states; they reuse Idle face layers.
 * Layer names match `assets/pixel/sheet.json` (`eyes` / `mouths`) — do not rename.
 */
export const PET_PHASES = [
  'Idle',
  'Listening',
  'Thinking',
  'Speaking',
  'Inhale',
  'Exhale'
] as const

export type PetPhase = (typeof PET_PHASES)[number]

export const PetPhase = {
  Idle: 'Idle',
  Listening: 'Listening',
  Thinking: 'Thinking',
  Speaking: 'Speaking',
  Inhale: 'Inhale',
  Exhale: 'Exhale'
} as const satisfies Record<PetPhase, PetPhase>

/** `sheet.json` `eyes` values. */
export type PetEyeLayer = 'open' | 'half' | 'closed'

/** `sheet.json` `mouths` values. */
export type PetMouthLayer = 'closed' | 'open' | 'smoke'

export type PetPhaseFace = {
  /** Allowed eye layers for this phase (contract §2). */
  readonly eyes: readonly PetEyeLayer[]
  readonly preferredEyes: PetEyeLayer
  /** Allowed mouth layers for this phase (contract §2). */
  readonly mouth: readonly PetMouthLayer[]
  readonly preferredMouth: PetMouthLayer
  /**
   * Speaking drives the mouth through the existing `setMouthOpen` API
   * rather than freezing a single mouth PNG.
   */
  readonly setMouthOpen: boolean
}

const IDLE_FACE = {
  eyes: ['open', 'half'],
  preferredEyes: 'half',
  mouth: ['closed'],
  preferredMouth: 'closed',
  setMouthOpen: false
} as const satisfies PetPhaseFace

/**
 * Phase → eye/mouth combo. Aligns with `docs/agent-split.md` §2:
 * idle: 眼 open/half，嘴 closed
 * talk: `setMouthOpen` 切嘴
 * inhale: 眼更眯，嘴 closed
 * exhale: 嘴 smoke 或 open
 *
 * Listening / Thinking map to the Idle combo until a dedicated face exists.
 */
export const PET_PHASE_FACE = {
  Idle: IDLE_FACE,
  Listening: IDLE_FACE,
  Thinking: IDLE_FACE,
  Speaking: {
    eyes: ['open', 'half'],
    preferredEyes: 'half',
    mouth: ['open'],
    preferredMouth: 'open',
    setMouthOpen: true
  },
  Inhale: {
    eyes: ['closed', 'half'],
    preferredEyes: 'closed',
    mouth: ['closed'],
    preferredMouth: 'closed',
    setMouthOpen: false
  },
  Exhale: {
    eyes: ['half', 'open'],
    preferredEyes: 'half',
    mouth: ['smoke', 'open'],
    preferredMouth: 'smoke',
    setMouthOpen: false
  }
} as const satisfies Record<PetPhase, PetPhaseFace>

export type ResolvedPetPhaseFace = {
  eyes: PetEyeLayer
  mouth: PetMouthLayer
  setMouthOpen: boolean
}

export function resolvePetPhaseFace(phase: PetPhase): ResolvedPetPhaseFace {
  const face = PET_PHASE_FACE[phase]
  return {
    eyes: face.preferredEyes,
    mouth: face.preferredMouth,
    setMouthOpen: face.setMouthOpen
  }
}

/**
 * Bridge to the existing `CharacterPose` union. Listening/Thinking stay on
 * `idle` so PixelRenderer can keep blinking; desktop wiring is P0-E.
 */
export function petPhaseToPose(phase: PetPhase): CharacterPose {
  switch (phase) {
    case 'Idle':
    case 'Listening':
    case 'Thinking':
      return 'idle'
    case 'Speaking':
      return 'talk'
    case 'Inhale':
      return 'inhale'
    case 'Exhale':
      return 'exhale'
  }
}

/**
 * Legal directed edges. Self-transitions are allowed (idempotent).
 * Conversation cycle (R06): Idle ↔ Listening → Thinking → Speaking → Idle.
 * Puff cycle (contract §2): Idle → Inhale → Exhale → Idle; tray puff may skip to Exhale.
 * Barge-in: Speaking → Listening / Inhale / Thinking.
 */
export const PET_PHASE_TRANSITIONS = {
  Idle: ['Idle', 'Listening', 'Thinking', 'Speaking', 'Inhale', 'Exhale'],
  Listening: ['Listening', 'Idle', 'Thinking', 'Inhale'],
  Thinking: ['Thinking', 'Idle', 'Listening', 'Speaking', 'Exhale'],
  Speaking: ['Speaking', 'Idle', 'Listening', 'Thinking', 'Inhale'],
  Inhale: ['Inhale', 'Exhale', 'Idle', 'Listening', 'Thinking', 'Speaking'],
  Exhale: ['Exhale', 'Idle', 'Speaking', 'Listening']
} as const satisfies Record<PetPhase, readonly PetPhase[]>

const TRANSITION_SET: Record<PetPhase, ReadonlySet<PetPhase>> = {
  Idle: new Set(PET_PHASE_TRANSITIONS.Idle),
  Listening: new Set(PET_PHASE_TRANSITIONS.Listening),
  Thinking: new Set(PET_PHASE_TRANSITIONS.Thinking),
  Speaking: new Set(PET_PHASE_TRANSITIONS.Speaking),
  Inhale: new Set(PET_PHASE_TRANSITIONS.Inhale),
  Exhale: new Set(PET_PHASE_TRANSITIONS.Exhale)
}

export function isPetPhase(value: unknown): value is PetPhase {
  return (
    typeof value === 'string' && (PET_PHASES as readonly string[]).includes(value)
  )
}

export class IllegalPetPhaseTransitionError extends Error {
  readonly from: unknown
  readonly to: unknown

  constructor(from: unknown, to: unknown) {
    super(`Illegal pet phase transition: ${String(from)} → ${String(to)}`)
    this.name = 'IllegalPetPhaseTransitionError'
    this.from = from
    this.to = to
  }
}

export type PetPhaseTransitionOk = { ok: true; phase: PetPhase }
export type PetPhaseTransitionErr = {
  ok: false
  from: unknown
  to: unknown
  error: IllegalPetPhaseTransitionError
}
export type PetPhaseTransitionResult = PetPhaseTransitionOk | PetPhaseTransitionErr

export function canTransitionPetPhase(from: PetPhase, to: PetPhase): boolean {
  return TRANSITION_SET[from].has(to)
}

export function tryTransitionPetPhase(
  from: unknown,
  to: unknown
): PetPhaseTransitionResult {
  if (!isPetPhase(from) || !isPetPhase(to) || !canTransitionPetPhase(from, to)) {
    const error = new IllegalPetPhaseTransitionError(from, to)
    return { ok: false, from, to, error }
  }
  return { ok: true, phase: to }
}

/** Throws on an illegal transition. Never silently rewrites the phase. */
export function transitionPetPhase(from: PetPhase, to: PetPhase): PetPhase {
  const result = tryTransitionPetPhase(from, to)
  if (!result.ok) throw result.error
  return result.phase
}

export type PetPhaseMachine = {
  readonly phase: PetPhase
  canTransition(to: PetPhase): boolean
  transition(to: PetPhase): PetPhase
  tryTransition(to: PetPhase): PetPhaseTransitionResult
}

export function createPetPhaseMachine(initial: PetPhase = 'Idle'): PetPhaseMachine {
  if (!isPetPhase(initial)) {
    throw new IllegalPetPhaseTransitionError(undefined, initial)
  }
  let phase: PetPhase = initial
  return {
    get phase() {
      return phase
    },
    canTransition(to) {
      return canTransitionPetPhase(phase, to)
    },
    transition(to) {
      phase = transitionPetPhase(phase, to)
      return phase
    },
    tryTransition(to) {
      const result = tryTransitionPetPhase(phase, to)
      if (result.ok) phase = result.phase
      return result
    }
  }
}
