import { getAgentProfile } from '../agents/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { ProviderConfigurationError, ProviderRequestError } from '../providers/errors'
import { createLlmProvider } from '../providers/providerFactory'
import type { InterrogateInput, InterrogateResult } from '../types/agent'
import { markLlmLive, markLlmOffline } from './llmRuntimeStatus'
import { validateInvestigationSuggestions } from '../data/investigationRules'
import { extractSemanticFactCandidates, getTurnDisclosureDirective, isFinancialInquiry } from './investigationCandidateExtractor'
import { detectPresentedEvidenceIds } from './evidencePresentation'

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

function logInvestigationTrace(stage: string, details: Record<string, unknown>) {
  if (process.env.DEBUG_AI_INVESTIGATION !== 'true') return
  console.info('[investigation-trace]', JSON.stringify({ stage, ...details }))
}

export async function interrogateNpc(input: InterrogateInput): Promise<InterrogateResult> {
  const profile = getAgentProfile(input.npcId)
  if (!profile) {
    throw new InterrogationError('NPC_NOT_FOUND', '没有找到这名审讯对象。', 404, false)
  }

  const history = input.conversationHistory.slice(-24).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 800),
  }))
  const turnDirective = getTurnDisclosureDirective({
    npcId: input.npcId,
    message: input.message,
    conversationHistory: history,
  })
  const systemPrompt = [
    buildSystemPrompt(profile, input.discoveredEvidenceIds),
    turnDirective,
  ].filter(Boolean).join('\n\n')

  try {
    const provider = createLlmProvider()
    const parsed = await provider.generateNpcResponse({
      systemPrompt,
      conversationHistory: history,
      message: input.message,
    })
    markLlmLive()

    logInvestigationTrace('provider_structured_result', {
      npcId: input.npcId,
      reply: parsed.reply,
      emotion: parsed.emotion,
      revealedFactIds: parsed.revealedFactIds,
      contradictionIds: parsed.contradictionIds,
    })
    const semanticCandidates = extractSemanticFactCandidates({
      npcId: input.npcId,
      message: input.message,
      reply: parsed.reply,
      conversationHistory: history,
    })
    const candidateFactIds = [...new Set([
      ...parsed.revealedFactIds,
      ...semanticCandidates.map((candidate) => candidate.id),
    ])].filter((id) => id !== 'tom_financial_pressure' || isFinancialInquiry(input.message))
    const turnPresentedEvidenceIds = detectPresentedEvidenceIds(input.message, input.discoveredEvidenceIds)
    logInvestigationTrace('candidate_fact_ids', {
      npcId: input.npcId,
      modelFactIds: parsed.revealedFactIds,
      semanticFallback: semanticCandidates,
      candidateFactIds,
    })
    logInvestigationTrace('candidate_contradiction_ids', {
      npcId: input.npcId,
      modelContradictionIds: parsed.contradictionIds,
      candidateContradictionIds: parsed.contradictionIds,
      turnPresentedEvidenceIds,
    })

    const validation = validateInvestigationSuggestions({
      npcId: input.npcId,
      suggestedFactIds: candidateFactIds,
      suggestedContradictionIds: parsed.contradictionIds,
      discoveredFactIds: input.discoveredFactIds,
      discoveredContradictionIds: input.discoveredContradictionIds,
      discoveredEvidenceIds: input.discoveredEvidenceIds,
      presentedEvidenceIds: turnPresentedEvidenceIds,
    })

    logInvestigationTrace('fact_validation', {
      npcId: input.npcId,
      acceptedFactIds: validation.acceptedFactIds,
      rejectedFactIds: validation.rejectedFactIds,
    })
    logInvestigationTrace('contradiction_validation', {
      npcId: input.npcId,
      acceptedContradictionIds: validation.acceptedContradictionIds,
      rejectedContradictionIds: validation.rejectedContradictionIds,
    })

    logInvestigationTrace('api_result', {
      npcId: input.npcId,
      revealedFactIds: validation.acceptedFactIds,
      contradictionIds: validation.acceptedContradictionIds,
      unlockedEvidenceIds: validation.unlockedEvidenceIds,
      presentedEvidenceIds: turnPresentedEvidenceIds,
    })

    return {
      reply: cleanReply(parsed.reply),
      emotion: parsed.emotion,
      revealedFactIds: validation.acceptedFactIds,
      contradictionIds: validation.acceptedContradictionIds,
      unlockedEvidenceIds: validation.unlockedEvidenceIds,
      presentedEvidenceIds: turnPresentedEvidenceIds,
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
