import type { CharacterPose } from '@niko/core'

/** Cursor / 编码任务可视化阶段（ST-VIZ-01）。桌面接线是 ST-VIZ-03，本包只给映射。 */
export const AGENT_PHASES = [
  'idle',
  'session_start',
  'thinking',
  'streaming',
  'tool_call',
  'tool_result',
  'permission',
  'reading',
  'writing',
  'searching',
  'complete',
  'error',
  'cancelled',
  'timeout'
] as const

export type AgentPhase = (typeof AGENT_PHASES)[number]

/** R08 aemeath：同一 phase 最小展示，防气泡闪烁。 */
export const PHASE_MIN_DISPLAY_MS = 800

export type AgentPhaseVisual = {
  pose: CharacterPose
  smokeIntensity: number
  bubble: string
  minDisplayMs: number
}

const ms = PHASE_MIN_DISPLAY_MS

/**
 * phase → 现有 CharacterPose + 烟浓度 + 颓系短气泡。
 * 文案对齐 docs/persona.md：短句、不卖萌、不打鸡血。
 */
export const AGENT_PHASE_MAP: Record<AgentPhase, AgentPhaseVisual> = {
  idle: {
    pose: 'idle',
    smokeIntensity: 0.18,
    bubble: '……',
    minDisplayMs: ms
  },
  session_start: {
    pose: 'inhale',
    smokeIntensity: 0.24,
    bubble: '行吧。',
    minDisplayMs: ms
  },
  thinking: {
    pose: 'idle',
    smokeIntensity: 0.28,
    bubble: '嗯……',
    minDisplayMs: ms
  },
  streaming: {
    pose: 'talk',
    smokeIntensity: 0.22,
    bubble: '写着呢。',
    minDisplayMs: ms
  },
  tool_call: {
    pose: 'talk',
    smokeIntensity: 0.36,
    bubble: '动手了。',
    minDisplayMs: ms
  },
  tool_result: {
    pose: 'idle',
    smokeIntensity: 0.26,
    bubble: '看完了。',
    minDisplayMs: ms
  },
  permission: {
    pose: 'inhale',
    smokeIntensity: 0.12,
    bubble: '你批一下。',
    minDisplayMs: ms
  },
  reading: {
    pose: 'idle',
    smokeIntensity: 0.22,
    bubble: '翻文件。',
    minDisplayMs: ms
  },
  writing: {
    pose: 'talk',
    smokeIntensity: 0.34,
    bubble: '改仓库。',
    minDisplayMs: ms
  },
  searching: {
    pose: 'idle',
    smokeIntensity: 0.2,
    bubble: '在翻。',
    minDisplayMs: ms
  },
  complete: {
    pose: 'exhale',
    smokeIntensity: 0.48,
    bubble: '完了。烟？',
    minDisplayMs: ms
  },
  error: {
    pose: 'inhale',
    smokeIntensity: 0.1,
    bubble: '……挺惨。',
    minDisplayMs: ms
  },
  cancelled: {
    pose: 'idle',
    smokeIntensity: 0.16,
    bubble: '算了。',
    minDisplayMs: ms
  },
  timeout: {
    pose: 'idle',
    smokeIntensity: 0.12,
    bubble: '跑太久，我先撤了。',
    minDisplayMs: ms
  }
}

const PHASE_SET: ReadonlySet<string> = new Set(AGENT_PHASES)

export function isAgentPhase(value: string): value is AgentPhase {
  return PHASE_SET.has(value)
}

export function getAgentPhaseVisual(phase: string): AgentPhaseVisual {
  if (isAgentPhase(phase)) return AGENT_PHASE_MAP[phase]
  return AGENT_PHASE_MAP.idle
}
