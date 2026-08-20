import assert from 'node:assert/strict'
import type { AppConfig } from '@niko/core'
import {
  createStreamingTranscriber,
  encodePcm16leWav,
  isStreamingReady,
  readSttStreamingConfig,
  requireStreamingTranscriber,
  shouldUseLegacyTranscription,
  transcribeAudioMaybeStreaming,
  type SegmentTranscript
} from './streaming.ts'

const baseConfig: AppConfig = {
  llm: { baseURL: 'https://llm.example/v1', model: 'm' },
  stt: { provider: 'openai', baseURL: 'https://stt.example/v1' },
  tts: { provider: 'edge' },
  cursor: { cli: 'agent' }
}

function withStreaming(streaming: Record<string, unknown>): AppConfig {
  return {
    ...baseConfig,
    stt: { ...baseConfig.stt, streaming } as AppConfig['stt']
  }
}

function installFetchMock(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return handler(url, init)
  }) as typeof fetch
  return () => {
    globalThis.fetch = orig
  }
}

function jsonOk(text: string): Response {
  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

async function main(): Promise<void> {
  const fromMissing = readSttStreamingConfig(undefined)
  assert.equal(fromMissing.enabled, false)

  const fromExample = readSttStreamingConfig({
    stt: { streaming: { enabled: false, mode: 'segmented', endpoint: '' } }
  })
  assert.equal(fromExample.enabled, false)
  assert.equal(fromExample.endpoint, '')

  const disabled = await createStreamingTranscriber({ stt: { streaming: { enabled: false } } })
  assert.equal(disabled.status, 'disabled')
  assert.equal(shouldUseLegacyTranscription(disabled), true)
  assert.equal(isStreamingReady(disabled), false)

  const emptyEndpoint = await createStreamingTranscriber({
    stt: { streaming: { enabled: true, endpoint: '' } }
  })
  assert.equal(emptyEndpoint.status, 'unavailable')
  assert.equal(emptyEndpoint.code, 'endpoint-empty')
  assert.equal(shouldUseLegacyTranscription(emptyEndpoint), true)
  assert.match(emptyEndpoint.reason, /empty/i)

  const unconfigured = await createStreamingTranscriber({
    streaming: { enabled: true, mode: 'faster-whisper' }
  })
  assert.equal(unconfigured.status, 'unavailable')
  assert.equal(unconfigured.code, 'unconfigured')
  assert.equal(shouldUseLegacyTranscription(unconfigured), true)
  assert.match(unconfigured.reason, /transcribeAudio/i)

  await assert.rejects(
    () => requireStreamingTranscriber({ streaming: { enabled: true, endpoint: '   ' } }),
    /streaming ASR unavailable/
  )

  const restoreDisabled = installFetchMock(async (url) => {
    assert.match(url, /stt\.example/)
    return jsonOk('legacy-ok')
  })
  const disabledResult = await transcribeAudioMaybeStreaming({
    config: withStreaming({ enabled: false }),
    buffer: Buffer.from('fake-webm'),
    mime: 'audio/webm'
  })
  restoreDisabled()
  assert.equal(disabledResult.usedStreaming, false)
  assert.equal(disabledResult.path, 'fallback')
  assert.equal(disabledResult.text, 'legacy-ok')
  assert.match(disabledResult.reason ?? '', /streaming\.enabled is false/i)

  const restoreEmpty = installFetchMock(async (url) => {
    assert.match(url, /stt\.example/)
    return jsonOk('empty-endpoint-fallback')
  })
  const emptyResult = await transcribeAudioMaybeStreaming({
    config: withStreaming({ enabled: true, endpoint: '' }),
    buffer: Buffer.from('fake-webm'),
    mime: 'audio/webm'
  })
  restoreEmpty()
  assert.equal(emptyResult.usedStreaming, false)
  assert.equal(emptyResult.path, 'fallback')
  assert.equal(emptyResult.text, 'empty-endpoint-fallback')

  const fakeCalls: string[] = []
  const restoreFake = installFetchMock(async (url) => {
    fakeCalls.push(url)
    if (url.includes('127.0.0.1:9')) {
      return new Response('nope', { status: 503 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  const fakeHandle = await createStreamingTranscriber(
    withStreaming({ enabled: true, mode: 'faster-whisper', endpoint: 'http://127.0.0.1:9/v1' })
  )
  assert.ok(isStreamingReady(fakeHandle))
  assert.equal(fakeHandle.endpoint, 'http://127.0.0.1:9/v1')
  await assert.rejects(
    () => fakeHandle.push({ buffer: Buffer.from('x'), mime: 'audio/webm' }),
    /streaming ASR failed \(http:\/\/127\.0\.0\.1:9\/v1\): STT 503/
  )
  await fakeHandle.close()
  restoreFake()
  assert.equal(fakeCalls.length, 1)
  assert.match(fakeCalls[0] ?? '', /127\.0\.0\.1:9/)

  const restoreFallbackFail = installFetchMock(async (url) => {
    if (url.includes('127.0.0.1:9')) {
      return new Response('down', { status: 500 })
    }
    if (url.includes('stt.example')) return jsonOk('fell-back')
    throw new Error(`unexpected fetch ${url}`)
  })
  const failedThenFallback = await transcribeAudioMaybeStreaming({
    config: withStreaming({ enabled: true, endpoint: 'http://127.0.0.1:9/v1' }),
    buffer: Buffer.from('fake-webm'),
    mime: 'audio/webm'
  })
  restoreFallbackFail()
  assert.equal(failedThenFallback.usedStreaming, false)
  assert.equal(failedThenFallback.path, 'fallback')
  assert.equal(failedThenFallback.text, 'fell-back')
  assert.match(failedThenFallback.reason ?? '', /STT 500/)

  const posted: { url: string; filename?: string }[] = []
  const restoreOk = installFetchMock(async (url, init) => {
    posted.push({ url })
    const body = init?.body
    if (body instanceof FormData) {
      const file = body.get('file')
      if (file instanceof File) posted[posted.length - 1]!.filename = file.name
    }
    return jsonOk(posted.length === 1 ? '你好' : '喵')
  })
  const ready = await requireStreamingTranscriber(
    withStreaming({
      enabled: true,
      mode: 'segmented',
      endpoint: 'http://127.0.0.1:9000/v1',
      minChunkMs: 50,
      overlapMs: 0
    })
  )
  const seen: SegmentTranscript[] = []
  ready.onPartial((seg) => seen.push(seg))

  const first = await ready.push({ buffer: Buffer.from('chunk-a'), mime: 'audio/webm' })
  assert.equal(first?.text, '你好')
  assert.equal(first?.isFinal, false)
  const second = await ready.push({ buffer: Buffer.from('chunk-b'), mime: 'audio/webm' })
  assert.equal(second?.text, '喵')
  const flushed = await ready.flush()
  assert.equal(flushed.text, '你好 喵')
  assert.deepEqual(
    seen.map((s) => s.text),
    ['你好', '喵']
  )
  await ready.close()

  const pcm = new Int16Array(1600)
  for (let i = 0; i < pcm.length; i++) pcm[i] = i % 2 === 0 ? 1200 : -1200
  const wavHandle = await requireStreamingTranscriber(
    withStreaming({
      enabled: true,
      endpoint: 'https://stt.example/v1',
      minChunkMs: 40,
      overlapMs: 0
    })
  )
  const wavSeg = await wavHandle.push({
    pcm,
    mime: 'audio/pcm',
    sampleRate: 16000
  })
  assert.ok(wavSeg)
  assert.ok(posted.some((p) => p.filename === 'segment.wav'))
  const wavBytes = encodePcm16leWav(pcm, 16000)
  assert.equal(wavBytes.subarray(0, 4).toString(), 'RIFF')
  await wavHandle.close()
  restoreOk()

  console.log('streaming.check: ok (disabled fallback / empty endpoint / fake endpoint fail)')
}

void main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
