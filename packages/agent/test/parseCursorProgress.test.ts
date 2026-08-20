import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  AGENT_PHASE_MAP,
  AGENT_PHASES,
  PHASE_MIN_DISPLAY_MS,
  getAgentPhaseVisual,
  isAgentPhase
} from '../src/agentPhase.ts'
import {
  createCursorProgressParser,
  extractCursorResultText,
  parseCursorCliOutput
} from '../src/parseCursorProgress.ts'

const dir = dirname(fileURLToPath(import.meta.url))

function phasesOf(stdout: string, stderr = '') {
  return parseCursorCliOutput(stdout, stderr).map((e) => e.phase)
}

describe('ST-VIZ-01 agent phase mapping', () => {
  it('covers 8–15 phases and every key has a visual', () => {
    assert.ok(AGENT_PHASES.length >= 8 && AGENT_PHASES.length <= 15)
    for (const phase of AGENT_PHASES) {
      assert.equal(isAgentPhase(phase), true)
      const visual = AGENT_PHASE_MAP[phase]
      assert.ok(visual, `missing map for ${phase}`)
      assert.ok(['idle', 'talk', 'inhale', 'exhale'].includes(visual.pose), visual.pose)
      assert.equal(typeof visual.smokeIntensity, 'number')
      assert.ok(visual.smokeIntensity >= 0 && visual.smokeIntensity <= 1)
      assert.equal(typeof visual.bubble, 'string')
      assert.ok(visual.bubble.length > 0 && visual.bubble.length <= 24, visual.bubble)
      assert.ok(visual.minDisplayMs >= PHASE_MIN_DISPLAY_MS)
      assert.equal(visual.bubble.includes('!'), false)
      assert.equal(/[♪♡★]/.test(visual.bubble), false)
    }
    assert.deepEqual(Object.keys(AGENT_PHASE_MAP).sort(), [...AGENT_PHASES].sort())
  })

  it('unknown phase falls back to idle visual', () => {
    const idle = getAgentPhaseVisual('idle')
    const unknown = getAgentPhaseVisual('not-a-phase')
    assert.deepEqual(unknown, idle)
    assert.equal(unknown.pose, 'idle')
  })
})

describe('ST-VIZ-02 cursor CLI progress parse', () => {
  it('parses the happy-path stream-json fixture', () => {
    const fixture = readFileSync(join(dir, 'fixtures/cursor-cli-progress.ndjson'), 'utf8')
    const phases = phasesOf(fixture)
    assert.deepEqual(phases, [
      'session_start',
      'streaming',
      'reading',
      'tool_result',
      'searching',
      'tool_result',
      'permission',
      'writing',
      'tool_result',
      'streaming',
      'complete'
    ])
    assert.equal(extractCursorResultText(fixture), 'Done. Summary is in summary.txt')
  })

  it('parses the error fixture', () => {
    const fixture = readFileSync(join(dir, 'fixtures/cursor-cli-error.ndjson'), 'utf8')
    const phases = phasesOf(fixture)
    assert.deepEqual(phases, ['session_start', 'streaming', 'tool_call', 'error', 'error'])
  })

  it('never throws on garbage and empty stays idle', () => {
    const garbage = '<<< not json >>>\x00\n{broken\n\n'
    assert.doesNotThrow(() => parseCursorCliOutput(garbage, '{also broken'))
    const events = parseCursorCliOutput(garbage, '{also broken')
    assert.ok(events.length >= 1)
    assert.ok(events.every((e) => isAgentPhase(e.phase)))
    assert.deepEqual(phasesOf(''), ['idle'])
    assert.deepEqual(
      parseCursorCliOutput(undefined as unknown as string, undefined as unknown as string).map((e) => e.phase),
      ['idle']
    )
  })

  it('maps text --print and stderr hints', () => {
    assert.deepEqual(phasesOf('The rebase command is git rebase --onto main HEAD~3.\n'), [
      'streaming',
      'complete'
    ])
    assert.deepEqual(phasesOf('', 'Error: not logged in (agent login)\n'), ['error'])
    assert.deepEqual(phasesOf('', 'Waiting for approval to run shell\n'), ['permission', 'complete'])
  })

  it('extracts json-format result blob', () => {
    const json = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '只改了这一处。',
      session_id: 'x'
    })
    assert.deepEqual(phasesOf(json), ['complete'])
    assert.equal(extractCursorResultText(json), '只改了这一处。')
  })

  it('parses NDJSON across chunk boundaries', () => {
    const fixture = readFileSync(join(dir, 'fixtures/cursor-cli-progress.ndjson'), 'utf8')
    const parser = createCursorProgressParser()
    const mid = Math.floor(fixture.length / 3)
    const phases = [
      ...parser.push(fixture.slice(0, mid), 'stdout'),
      ...parser.push(fixture.slice(mid), 'stdout'),
      ...parser.finish({ exitCode: 0 })
    ].map((e) => e.phase)
    assert.deepEqual(phases, [
      'session_start',
      'streaming',
      'reading',
      'tool_result',
      'searching',
      'tool_result',
      'permission',
      'writing',
      'tool_result',
      'streaming',
      'complete'
    ])
  })
})
