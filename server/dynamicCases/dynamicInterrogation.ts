import { createLlmProvider } from '../providers/providerFactory'
import { cleanNpcReply } from '../services/replyCleaning'
import type { InterrogateInput, InterrogateResult } from '../types/agent'
import { buildDynamicNpcPrompt } from './dynamicPrompt'
import { validateDynamicInvestigationTurn } from './runtime'
import { dynamicCaseSessionStore } from './sessionStore'
import { ProviderConfigurationError, ProviderRequestError } from '../providers/errors'
import { InterrogationError } from '../services/interrogationError'
import { markLlmLive, markLlmOffline } from '../services/llmRuntimeStatus'
import { extractDynamicSemanticFactCandidates } from './dynamicFactCandidates'
import type { LlmProvider } from '../providers/types'
import type { DynamicCaseSessionStore } from './sessionStore'

function logDynamicInvestigationTrace(stage: string, details: Record<string, unknown>) {
  if (process.env.DEBUG_DYNAMIC_CASE_INVESTIGATION !== 'true') return
  console.info('[dynamic-investigation-trace]', JSON.stringify({ stage, ...details }))
}

export async function interrogateDynamicNpc(input: InterrogateInput, dependencies: {
  store?: DynamicCaseSessionStore
  provider?: Pick<LlmProvider, 'generateNpcResponse'>
} = {}): Promise<InterrogateResult> {
  const store = dependencies.store ?? dynamicCaseSessionStore
  const session = input.caseSessionId ? store.get(input.caseSessionId) : undefined
  if (!session) throw new InterrogationError('DYNAMIC_CASE_NOT_FOUND', '动态案件会话已失效，请重新生成。', 404, false)
  const trustedInput: InterrogateInput = {
    ...input,
    discoveredEvidenceIds: session.progress.discoveredEvidenceIds,
    presentedEvidenceIds: session.progress.presentedEvidenceIds,
    discoveredFactIds: session.progress.confirmedFactIds,
    discoveredContradictionIds: session.progress.discoveredContradictionIds,
  }
  const systemPrompt = buildDynamicNpcPrompt(session.caseDefinition, input.npcId, trustedInput.discoveredEvidenceIds)
  if (!systemPrompt) throw new InterrogationError('NPC_NOT_FOUND', '没有找到这名审讯对象。', 404, false)
  logDynamicInvestigationTrace('dynamic_interrogation_start', {
    caseId: session.caseDefinition.metadata.caseId,
    sessionId: session.sessionId,
    npcId: input.npcId,
    factsForNpc: session.caseDefinition.facts
      .filter((fact) => fact.npcId === input.npcId)
      .map((fact) => ({
        id: fact.id,
        npcId: fact.npcId,
        title: fact.title,
        description: fact.description,
        category: fact.category,
        revealConditions: fact.revealConditions,
        prerequisiteFactIds: fact.prerequisiteFactIds,
        requiredEvidenceIds: fact.requiredEvidenceIds,
      })),
  })
  const history = input.conversationHistory.slice(-24).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 800) }))
  try {
    const parsed = await (dependencies.provider ?? createLlmProvider()).generateNpcResponse({ systemPrompt, conversationHistory: history, message: input.message })
    markLlmLive()
    const semanticCandidates = extractDynamicSemanticFactCandidates({
      npcId: input.npcId,
      reply: parsed.reply,
      caseDefinition: session.caseDefinition,
    })
    const candidateFactIds = [...new Set([...parsed.revealedFactIds, ...semanticCandidates.map((candidate) => candidate.id)])]
    const validation = validateDynamicInvestigationTurn(trustedInput, candidateFactIds, parsed.contradictionIds, session.caseDefinition)
    const progress = store.applyInvestigationUpdate(session.sessionId, {
      revealedFactIds: validation.acceptedFactIds,
      unlockedEvidenceIds: validation.unlockedEvidenceIds,
      contradictionIds: validation.contradictionIds,
      presentedEvidenceIds: validation.presentedEvidenceIds,
    })
    logDynamicInvestigationTrace('dynamic_interrogation_turn', {
      caseId: session.caseDefinition.metadata.caseId,
      sessionId: session.sessionId,
      npcId: input.npcId,
      modelReply: parsed.reply,
      modelEmotion: parsed.emotion,
      modelRevealedFactIds: parsed.revealedFactIds,
      modelContradictionIds: parsed.contradictionIds,
      candidateFactIds,
      semanticFallbackCandidates: semanticCandidates,
      acceptedFactIds: validation.acceptedFactIds,
      rejectedFactIds: validation.rejectedFactIds,
      unlockedEvidenceIds: validation.unlockedEvidenceIds,
      confirmedFactIds: progress?.confirmedFactIds ?? [],
    })
    return {
      reply: cleanNpcReply(parsed.reply), emotion: parsed.emotion,
      revealedFactIds: validation.acceptedFactIds, contradictionIds: validation.contradictionIds,
      unlockedEvidenceIds: validation.unlockedEvidenceIds, presentedEvidenceIds: validation.presentedEvidenceIds,
      factRecords: session.caseDefinition.facts.filter((item) => validation.acceptedFactIds.includes(item.id)).map(({ id, title, description, npcId }) => ({ id, title, description, npcId })),
      contradictionRecords: session.caseDefinition.contradictions.filter((item) => validation.contradictionIds.includes(item.id)).map(({ id, title, description, npcId, scoreValue }) => ({ id, title, description, npcId, scoreValue })),
      evidenceRecords: session.caseDefinition.evidence.filter((item) => validation.unlockedEvidenceIds.includes(item.id)).map(({ id, title, description, category, source, significance, relatedNpcIds, isKey }) => ({ id, title, description, category, source, significance, relatedNpcIds, isKey })),
    }
  } catch (error) {
    markLlmOffline()
    if (error instanceof InterrogationError) throw error
    if (error instanceof ProviderConfigurationError) throw new InterrogationError('LLM_NOT_CONFIGURED', 'AI 服务尚未配置。动态案件仍可使用预设问题。', 503, false)
    if (error instanceof ProviderRequestError) throw new InterrogationError(`LLM_${error.code}`, error.message, error.code === 'TIMEOUT' ? 504 : 503, error.retryable)
    throw new InterrogationError('LLM_UNAVAILABLE', 'AI 审讯暂时不可用。动态案件仍可使用预设问题。', 503, true)
  }
}
