import OpenAI from 'openai'
import type { Response as OpenAIResponse } from 'openai/resources/responses/responses'
import { z } from 'zod'
import { ProviderRequestError } from './errors'
import type {
  GenerateNpcResponseInput,
  GenerateTextInput,
  LlmProvider,
  LlmProviderConfig,
} from './types'
import type { InterrogateResult } from '../types/agent'

const NpcResponseSchema = z.object({
  reply: z.string().min(1).max(600),
  emotion: z.enum(['calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealedFactIds: z.array(z.string().max(80)).max(8),
  contradictionIds: z.array(z.string().max(80)).max(8),
})

const npcResponseFormat = {
  type: 'json_object' as const,
}

const structuredOutputContract = `## RESPONSE FORMAT
只输出一个 JSON 对象，不要输出 Markdown、代码围栏、解释或其他文字。
对象必须严格包含以下字段：
- reply：1—4 句角色实际说的话，字符串
- emotion：calm、nervous、defensive、evasive、angry 之一
- revealedFactIds：本轮实际承认的 fact id 字符串数组，没有则为空数组
- contradictionIds：本轮新产生或被证据击中的矛盾 id 字符串数组，没有则为空数组`

export interface ProviderErrorLog {
  provider: string
  model: string
  httpStatus: number | null
  errorCode: string
  errorMessage: string
  timeout: boolean
  responseParsingError: boolean
  responseStatus: string | null
  outputItemTypes: string[]
  contentTypes: string[]
  incompleteDetails: string | null
}

export type ProviderErrorLogger = (record: ProviderErrorLog) => void

export interface ProviderDebugLog {
  event: 'empty_response_retry'
  provider: string
  model: string
  responseStatus: string | null
  outputItemTypes: string[]
  contentTypes: string[]
  incompleteDetails: string | null
}

export type ProviderDebugLogger = (record: ProviderDebugLog) => void

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|ds)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .slice(0, 600)
}

function defaultErrorLogger(record: ProviderErrorLog) {
  console.error('[llm-provider-error]', JSON.stringify(record))
}

function defaultDebugLogger(record: ProviderDebugLog) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[llm-provider-debug]', JSON.stringify(record))
  }
}

function safeDetail(value: unknown) {
  if (value == null) return undefined
  try {
    return JSON.stringify(value).slice(0, 400)
  } catch {
    return String(value).slice(0, 400)
  }
}

function responseShape(response: OpenAIResponse) {
  const outputItemTypes: string[] = []
  const contentTypes: string[] = []

  for (const item of response.output ?? []) {
    outputItemTypes.push(item.type)
    if (item.type !== 'message' || !Array.isArray(item.content)) continue
    for (const content of item.content) contentTypes.push(content.type)
  }

  return {
    responseStatus: response.status ?? undefined,
    outputItemTypes,
    contentTypes,
    incompleteDetails: safeDetail(response.incomplete_details),
  }
}

export function extractResponseText(response: OpenAIResponse) {
  const helperText = typeof response.output_text === 'string' ? response.output_text.trim() : ''
  if (helperText) return helperText

  const parts: string[] = []
  for (const item of response.output ?? []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text)
      }
    }
  }
  return parts.join('').trim()
}

function ensureCompletedResponse(response: OpenAIResponse) {
  if (!response.status || response.status === 'completed') return

  const shape = responseShape(response)
  const responseError = response.error
  if (response.status === 'failed') {
    throw new ProviderRequestError(
      'UNAVAILABLE',
      '模型响应失败，请重试。',
      true,
      {
        ...shape,
        providerCode: responseError?.code ?? 'response_failed',
        providerMessage: responseError?.message ?? 'DeepSeek response failed.',
      },
    )
  }
  if (response.status === 'incomplete') {
    throw new ProviderRequestError(
      'INVALID_RESPONSE',
      '模型响应未完整生成，请重试。',
      true,
      {
        ...shape,
        providerCode: response.incomplete_details?.reason ?? 'response_incomplete',
        providerMessage: `DeepSeek response incomplete: ${response.incomplete_details?.reason ?? 'unknown reason'}`,
        responseParsingError: true,
      },
    )
  }
  throw new ProviderRequestError(
    'INVALID_RESPONSE',
    `模型响应状态异常：${response.status}。`,
    true,
    {
      ...shape,
      providerCode: `response_${response.status}`,
      providerMessage: `Unexpected DeepSeek response status: ${response.status}`,
      responseParsingError: true,
    },
  )
}

function structuredCandidates(outputText: string) {
  const withoutFence = outputText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const firstBrace = withoutFence.indexOf('{')
  const lastBrace = withoutFence.lastIndexOf('}')
  const objectSlice = firstBrace >= 0 && lastBrace > firstBrace
    ? withoutFence.slice(firstBrace, lastBrace + 1)
    : withoutFence
  return [...new Set([outputText.trim(), withoutFence, objectSlice])].filter(Boolean)
}

function parseNpcResponse(outputText: string, response: OpenAIResponse): InterrogateResult {
  let decoded: unknown
  for (const candidate of structuredCandidates(outputText)) {
    try {
      decoded = JSON.parse(candidate) as unknown
      break
    } catch {
      // DeepSeek may wrap JSON; try the next normalized candidate.
    }
  }

  const parsed = NpcResponseSchema.safeParse(decoded)
  if (parsed.success) return parsed.data

  if (decoded && typeof decoded === 'object' && 'reply' in decoded) {
    const reply = (decoded as { reply?: unknown }).reply
    if (typeof reply === 'string' && reply.trim()) {
      return {
        reply: reply.trim().slice(0, 600),
        emotion: 'neutral',
        revealedFactIds: [],
        contradictionIds: [],
      }
    }
  }

  const plainText = structuredCandidates(outputText)[1] ?? outputText.trim()
  const looksLikeBrokenJson = /^[{[]/.test(plainText) || /"reply"\s*:/.test(plainText)
  if (plainText && !looksLikeBrokenJson) {
    return {
      reply: plainText.slice(0, 600),
      emotion: 'neutral',
      revealedFactIds: [],
      contradictionIds: [],
    }
  }

  throw new ProviderRequestError(
    'INVALID_RESPONSE',
    '模型返回的结构化文本无法解析。',
    true,
    { ...responseShape(response), responseParsingError: true },
  )
}

export class ResponsesApiProvider implements LlmProvider {
  readonly name
  readonly model
  readonly baseURL
  readonly apiFormat = 'responses' as const
  private readonly client: OpenAI
  private readonly errorLogger: ProviderErrorLogger
  private readonly debugLogger: ProviderDebugLogger

  constructor(
    config: LlmProviderConfig & { apiKey: string },
    runtime: {
      fetch?: typeof globalThis.fetch
      maxRetries?: number
      errorLogger?: ProviderErrorLogger
      debugLogger?: ProviderDebugLogger
    } = {},
  ) {
    this.name = config.provider
    this.model = config.model
    this.baseURL = config.baseURL
    this.errorLogger = runtime.errorLogger ?? defaultErrorLogger
    this.debugLogger = runtime.debugLogger ?? defaultDebugLogger
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      maxRetries: runtime.maxRetries ?? 1,
      fetch: runtime.fetch,
    })
  }

  private getProviderOptions() {
    return this.name === 'deepseek'
      ? { reasoning: { effort: 'none' as const } }
      : { temperature: 0.75 }
  }

  private requestNpcResponse(input: GenerateNpcResponseInput, structured: boolean) {
    const responseInstructions = structured
      ? `${input.systemPrompt}\n\n${structuredOutputContract}`
      : `${input.systemPrompt}\n\n## RESPONSE FORMAT FALLBACK\n直接用 1—4 句自然中文回答调查员，不要输出 JSON、Markdown、标题或列表。`

    return this.client.responses.create({
      model: this.model,
      instructions: responseInstructions,
      input: [
        ...input.conversationHistory,
        { role: 'user' as const, content: input.message },
      ],
      max_output_tokens: 350,
      ...(structured ? { text: { format: npcResponseFormat } } : {}),
      ...this.getProviderOptions(),
    })
  }

  private normalizeError(error: unknown) {
    if (error instanceof ProviderRequestError) return error

    const isTimeout = error instanceof OpenAI.APIConnectionTimeoutError
      || (error instanceof Error && /timeout|timed out|aborted/i.test(error.message))

    if (error instanceof OpenAI.APIError) {
      const details = {
        httpStatus: error.status,
        providerCode: error.code ?? undefined,
        timeout: isTimeout,
      }
      if (error.status === 429) {
        return new ProviderRequestError('RATE_LIMITED', '审讯服务暂时繁忙，请稍后重试。', true, details)
      }
      if (error.status === 401 || error.status === 403) {
        return new ProviderRequestError('AUTH_ERROR', 'AI 服务配置无效，请检查服务端 API Key。', false, details)
      }
      return new ProviderRequestError(
        'UNAVAILABLE',
        'AI 审讯暂时不可用，你仍可以使用预设问题继续调查。',
        true,
        details,
      )
    }

    return new ProviderRequestError(
      isTimeout ? 'TIMEOUT' : 'UNAVAILABLE',
      isTimeout ? '角色回应超时，请重试。' : 'AI 审讯暂时不可用，你仍可以使用预设问题继续调查。',
      true,
      { timeout: isTimeout },
    )
  }

  private throwLoggedError(error: unknown): never {
    const requestError = this.normalizeError(error)
    const originalMessage = requestError.details.providerMessage
      ?? (error instanceof Error ? error.message : requestError.message)
    const originalCode = error instanceof OpenAI.APIError && error.code
      ? error.code
      : requestError.details.providerCode ?? requestError.code

    this.errorLogger({
      provider: this.name,
      model: this.model,
      httpStatus: requestError.details.httpStatus ?? null,
      errorCode: originalCode,
      errorMessage: sanitizeErrorMessage(originalMessage),
      timeout: requestError.details.timeout ?? requestError.code === 'TIMEOUT',
      responseParsingError: requestError.details.responseParsingError ?? false,
      responseStatus: requestError.details.responseStatus ?? null,
      outputItemTypes: requestError.details.outputItemTypes ?? [],
      contentTypes: requestError.details.contentTypes ?? [],
      incompleteDetails: requestError.details.incompleteDetails ?? null,
    })
    throw requestError
  }

  async generateNpcResponse(input: GenerateNpcResponseInput) {
    try {
      let response = await this.requestNpcResponse(input, true)
      ensureCompletedResponse(response)
      let outputText = extractResponseText(response)
      if (!outputText && this.name === 'deepseek') {
        const shape = responseShape(response)
        this.debugLogger({
          event: 'empty_response_retry',
          provider: this.name,
          model: this.model,
          responseStatus: shape.responseStatus ?? null,
          outputItemTypes: shape.outputItemTypes,
          contentTypes: shape.contentTypes,
          incompleteDetails: shape.incompleteDetails ?? null,
        })
        response = await this.requestNpcResponse(input, false)
        ensureCompletedResponse(response)
        outputText = extractResponseText(response)
      }
      if (!outputText) {
        throw new ProviderRequestError(
          'INVALID_RESPONSE',
          '模型响应中没有可读取的文本。',
          true,
          { ...responseShape(response), responseParsingError: true },
        )
      }
      return parseNpcResponse(outputText, response)
    } catch (error) {
      this.throwLoggedError(error)
    }
  }

  async generateText(input: GenerateTextInput) {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions: input.instructions,
        input: input.message,
        max_output_tokens: input.maxOutputTokens ?? 64,
        ...this.getProviderOptions(),
      })
      ensureCompletedResponse(response)
      const outputText = extractResponseText(response)
      if (!outputText) {
        throw new ProviderRequestError(
          'INVALID_RESPONSE',
          '模型响应中没有可读取的文本。',
          true,
          { ...responseShape(response), responseParsingError: true },
        )
      }
      return outputText
    } catch (error) {
      this.throwLoggedError(error)
    }
  }
}
