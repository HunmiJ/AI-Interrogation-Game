import { getAgentProfile } from '../agents/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { ProviderConfigurationError, ProviderRequestError } from '../providers/errors'
import { createLlmProvider } from '../providers/providerFactory'
import type { InterrogateInput, InterrogateResult } from '../types/agent'
import { markLlmLive, markLlmOffline } from './llmRuntimeStatus'

export class InterrogationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message)
  }
}

function cleanReply(reply: string) {
  return reply
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .trim()
}

export async function interrogateNpc(input: InterrogateInput): Promise<InterrogateResult> {
  const profile = getAgentProfile(input.npcId)
  if (!profile) {
    throw new InterrogationError('NPC_NOT_FOUND', '没有找到这名审讯对象。', 404, false)
  }

  const systemPrompt = buildSystemPrompt(profile, input.discoveredEvidenceIds)
  const history = input.conversationHistory.slice(-24).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 800),
  }))

  try {
    const provider = createLlmProvider()
    const parsed = await provider.generateNpcResponse({
      systemPrompt,
      conversationHistory: history,
      message: input.message,
    })
    markLlmLive()

    const allowedFactIds = new Set([
      ...profile.privateInformation.map((fact) => fact.id),
      ...profile.knownFacts.map((fact) => fact.id),
    ])

    return {
      reply: cleanReply(parsed.reply),
      emotion: parsed.emotion,
      revealedFactIds: parsed.revealedFactIds.filter((id) => allowedFactIds.has(id)),
      contradictionIds: parsed.contradictionIds,
    }
  } catch (error) {
    markLlmOffline()
    if (error instanceof InterrogationError) throw error
    if (error instanceof ProviderConfigurationError) {
      const isMissingKey = error.code === 'MISSING_API_KEY'
      throw new InterrogationError(
        isMissingKey ? 'LLM_NOT_CONFIGURED' : 'LLM_PROVIDER_INVALID',
        isMissingKey ? 'AI 服务尚未配置。你仍可以使用预设问题继续调查。' : error.message,
        503,
        false,
      )
    }
    if (error instanceof ProviderRequestError) {
      const status = error.code === 'RATE_LIMITED' ? 429 : error.code === 'TIMEOUT' ? 504 : 503
      const code = error.code === 'AUTH_ERROR' ? 'LLM_AUTH_ERROR' : `LLM_${error.code}`
      throw new InterrogationError(code, error.message, status, error.retryable)
    }
    throw new InterrogationError('LLM_UNAVAILABLE', 'AI 审讯暂时不可用，你仍可以使用预设问题继续调查。', 503, true)
  }
}
