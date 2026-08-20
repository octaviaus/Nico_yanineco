import assert from 'node:assert/strict'
import {
  createVoiceActivityDetector,
  isVadReady,
  readSttVadConfig,
  requireVoiceActivityDetector,
  shouldUseLegacyPtt,
  type VadEvent
} from './vad.ts'

function tone(hz: number, seconds: number, sampleRate: number, amp: number): Float32Array {
  const n = Math.floor(seconds * sampleRate)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sampleRate)
  return out
}

function silence(seconds: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.floor(seconds * sampleRate))
}

async function main(): Promise<void> {
  const fromMissing = readSttVadConfig(undefined)
  assert.equal(fromMissing.enabled, false)

  const fromExample = readSttVadConfig({
    stt: { vad: { enabled: false, engine: 'silero', modelPath: '' } }
  })
  assert.equal(fromExample.enabled, false)
  assert.equal(fromExample.modelPath, undefined)

  const disabled = await createVoiceActivityDetector({ stt: { vad: { enabled: false } } })
  assert.equal(disabled.status, 'disabled')
  assert.equal(shouldUseLegacyPtt(disabled), true)
  assert.equal(isVadReady(disabled), false)

  const unconfigured = await createVoiceActivityDetector({
    stt: { vad: { enabled: true, engine: 'silero' } }
  })
  assert.equal(unconfigured.status, 'unavailable')
  assert.equal(unconfigured.code, 'unconfigured')
  assert.equal(shouldUseLegacyPtt(unconfigured), true)
  assert.match(unconfigured.reason, /old PTT path/i)

  const missingModel = await createVoiceActivityDetector({
    enabled: true,
    engine: 'silero',
    modelPath: 'models/does-not-exist.onnx'
  })
  assert.equal(missingModel.status, 'unavailable')
  assert.equal(missingModel.code, 'model-missing')
  assert.equal(shouldUseLegacyPtt(missingModel), true)

  await assert.rejects(
    () => requireVoiceActivityDetector({ enabled: true, engine: 'silero' }),
    /VAD unavailable/
  )

  const sr = 16000
  const vad = await createVoiceActivityDetector({
    enabled: true,
    engine: 'rms',
    sampleRate: sr,
    frameSamples: 512,
    minSpeechMs: 96,
    minSilenceMs: 288
  })
  assert.ok(isVadReady(vad))
  assert.equal(vad.engine, 'rms')
  assert.equal(shouldUseLegacyPtt(vad), false)

  const seen: VadEvent[] = []
  vad.on('start', (ev) => seen.push(ev))
  vad.on('stop', (ev) => seen.push(ev))

  const quiet = await vad.push(silence(0.4, sr), sr)
  assert.equal(quiet.speaking, false)
  assert.equal(quiet.events.length, 0)

  const voiced = await vad.push(tone(220, 0.4, sr, 0.3), sr)
  assert.equal(voiced.speaking, true)
  assert.ok(voiced.events.some((e) => e.type === 'start'))

  const after = await vad.push(silence(0.5, sr), sr)
  assert.equal(after.speaking, false)
  assert.ok(after.events.some((e) => e.type === 'stop'))

  assert.deepEqual(
    seen.map((e) => e.type),
    ['start', 'stop']
  )

  await vad.close()
  console.log('vad.check: ok (disabled / unavailable / rms start-stop)')
}

void main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
