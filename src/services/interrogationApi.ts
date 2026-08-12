import type { AiConversationMessage, InterrogateResponse, InterrogationUiError } from '../types/interrogation'

interface InterrogateRequest {
  npcId: string
  message: string
  conversationHistory: AiConversationMessage[]
  discoveredEvidenceIds: string[]
}

export class InterrogationApiError extends Error implements InterrogationUiError {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
  }
}

function isInterrogateResponse(value: unknown): value is InterrogateResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<InterrogateResponse>
  return typeof candidate.reply === 'string'
    && typeof candidate.emotion === 'string'
    && Array.isArray(candidate.revealedFactIds)
    && Array.isArray(candidate.contradictionIds)
}

export async function requestInterrogation(input: InterrogateRequest): Promise<InterrogateResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 22_000)

  try {
    const response = await fetch('/api/interrogate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        npcId: input.npcId,
        message: input.message,
        conversationHistory: input.conversationHistory.slice(-24).map(({ role, content }) => ({ role, content })),
        discoveredEvidenceIds: input.discoveredEvidenceIds,
      }),
    })

    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const errorPayload = payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: Partial<InterrogationUiError> }).error
        : undefined
      throw new InterrogationApiError(
        errorPayload?.code ?? 'REQUEST_FAILED',
        errorPayload?.message ?? 'AI 审讯暂时不可用，请稍后重试。',
        errorPayload?.retryable ?? response.status >= 500,
      )
    }

    if (!isInterrogateResponse(payload)) {
      throw new InterrogationApiError('INVALID_RESPONSE', '角色回答格式异常，请重试。', true)
    }

    return payload
  } catch (error) {
    if (error instanceof InterrogationApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new InterrogationApiError('CLIENT_TIMEOUT', '角色思考时间过长，请重试。', true)
    }
    throw new InterrogationApiError('NETWORK_ERROR', '无法连接 AI 审讯服务。预设问题仍可正常使用。', true)
  } finally {
    window.clearTimeout(timeout)
  }
}
