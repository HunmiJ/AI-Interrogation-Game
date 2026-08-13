import type { CaseResolution } from '../types/caseResolution'

export interface CaseResolutionRequest {
  caseSessionId?: string
  accusedNpcId: string
  discoveredEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  questionCount: number
  interrogatedNpcIds: string[]
}

export class CaseResolutionApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) { super(message) }
}

function isCaseResolution(value: unknown): value is CaseResolution {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CaseResolution>
  return typeof candidate.correct === 'boolean'
    && typeof candidate.accusedName === 'string'
    && Boolean(candidate.culprit && typeof candidate.culprit.name === 'string')
    && Array.isArray(candidate.explanation)
    && typeof candidate.confession === 'string'
    && Boolean(candidate.score && typeof candidate.score.total === 'number')
}

export async function requestCaseResolution(input: CaseResolutionRequest): Promise<CaseResolution> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch('/api/case/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(input),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { code?: string; message?: string; retryable?: boolean } }).error
        : undefined
      throw new CaseResolutionApiError(apiError?.code ?? 'RESOLUTION_FAILED', apiError?.message ?? '暂时无法取得结案结果。', apiError?.retryable ?? response.status >= 500)
    }
    if (!isCaseResolution(payload)) throw new CaseResolutionApiError('INVALID_RESOLUTION', '结案记录格式异常，请重试。', true)
    return payload
  } catch (error) {
    if (error instanceof CaseResolutionApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new CaseResolutionApiError('RESOLUTION_TIMEOUT', '结案核对超时，请重试。', true)
    throw new CaseResolutionApiError('RESOLUTION_OFFLINE', '无法连接结案服务，请确认本地服务正在运行。', true)
  } finally {
    window.clearTimeout(timeout)
  }
}
