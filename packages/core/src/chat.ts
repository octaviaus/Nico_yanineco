import { chatCompletion, hasLlmCredentials } from './llm.js'
import { NO_LLM_FALLBACK, PERSONA_SYSTEM_PROMPT } from './persona.js'
import type { AppConfig, ChatMessage, ToolCall, ToolDef } from './types.js'

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<string>

const MAX_TOOL_ITERS = 5
const HISTORY_LIMIT = 24

export class NikoChat {
  private history: ChatMessage[] = []

  constructor(
    private readonly config: AppConfig,
    private readonly tools: ToolDef[],
    private readonly handleTool: ToolHandler
  ) {}

  async talk(userText: string): Promise<string> {
    const trimmed = userText.trim()
    if (!trimmed) return '……嗯？'

    this.history.push({ role: 'user', content: trimmed })
    this.trimHistory()

    if (!hasLlmCredentials(this.config)) {
      return NO_LLM_FALLBACK
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: PERSONA_SYSTEM_PROMPT },
      ...this.history
    ]

    for (let i = 0; i < MAX_TOOL_ITERS; i++) {
      const result = await chatCompletion({
        llm: this.config.llm,
        messages,
        tools: this.tools
      })

      if (!result.toolCalls.length) {
        const text = result.content || '……嗯。'
        this.history.push({ role: 'assistant', content: text })
        this.trimHistory()
        return text
      }

      messages.push({
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls
      })
      this.history.push({
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls
      })

      for (const call of result.toolCalls) {
        const output = await this.runTool(call)
        const toolMsg: ChatMessage = {
          role: 'tool',
          content: output,
          toolCallId: call.id,
          name: call.name
        }
        messages.push(toolMsg)
        this.history.push(toolMsg)
      }
    }

    return '工具转晕了。我抽烟去。'
  }

  private async runTool(call: ToolCall): Promise<string> {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
    } catch {
      args = {}
    }
    try {
      return await this.handleTool(call.name, args)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `失败了：${msg}`
    }
  }

  private trimHistory() {
    if (this.history.length > HISTORY_LIMIT) {
      this.history = this.history.slice(-HISTORY_LIMIT)
    }
  }
}
