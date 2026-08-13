import type { ConversationTurn, InterrogateResult } from '../types/agent'

export type LlmProviderName = 'deepseek' | 'openai'

export interface LlmProviderConfig {
  provider: LlmProviderName
  apiKey?: string
  model: string
  baseURL: string
  timeoutMs: number
  apiFormat: 'responses'
}

export interface GenerateNpcResponseInput {
  systemPrompt: string
  conversationHistory: ConversationTurn[]
  message: string
}

export interface GenerateTextInput {
  instructions?: string
  message: string
  maxOutputTokens?: number
}

export interface GenerateStructuredJsonInput {
  instructions: string
  message: string
  maxOutputTokens?: number
}

export interface StructuredJsonOutput {
  text: string
  finishReason: string | null
}

export interface LlmProvider {
  readonly name: LlmProviderName
  readonly model: string
  readonly baseURL: string
  readonly apiFormat: 'responses'
  generateNpcResponse(input: GenerateNpcResponseInput): Promise<InterrogateResult>
  generateText(input: GenerateTextInput): Promise<string>
  generateStructuredJson(input: GenerateStructuredJsonInput): Promise<StructuredJsonOutput>
}
