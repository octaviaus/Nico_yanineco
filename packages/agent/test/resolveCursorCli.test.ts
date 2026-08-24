import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isEditorCursorLauncher, resolveCursorAgentCli, buildCursorAgentArgs } from '../src/resolveCursorCli.ts'

describe('resolve Cursor Agent CLI', () => {
  it('does not treat the IDE cursor.exe as the agent CLI', () => {
    assert.equal(isEditorCursorLauncher('cursor'), true)
    assert.equal(isEditorCursorLauncher('cursor.exe'), true)
    assert.equal(isEditorCursorLauncher('C:\\\\foo\\\\cursor.cmd'), true)
    assert.equal(isEditorCursorLauncher('agent'), false)
    assert.equal(isEditorCursorLauncher('agent.exe'), false)
  })

  it('preferred editor launcher is skipped so we do not spawn the IDE', () => {
    const resolved = resolveCursorAgentCli('cursor')
    if (resolved) {
      assert.equal(isEditorCursorLauncher(resolved), false)
    }
  })

  it('headless dispatch always trusts the workspace', () => {
    const args = buildCursorAgentArgs('看 README', 'D:\\尼古喵喵')
    assert.ok(args.includes('-p'))
    assert.ok(args.includes('--trust'))
    assert.ok(args.includes('--workspace'))
    assert.equal(args[args.indexOf('--workspace') + 1], 'D:\\尼古喵喵')
    assert.equal(args.at(-1), '看 README')
  })
})
