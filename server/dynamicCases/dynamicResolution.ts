import { normalizeDynamicProgress } from './runtime'
import type { CaseDefinition } from './types'

export interface DynamicResolutionInput {
  accusedNpcId: string
  discoveredEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  questionCount: number
  interrogatedNpcIds: string[]
}

export function resolveDynamicCase(caseDefinition: CaseDefinition, input: DynamicResolutionInput) {
  const normalized = normalizeDynamicProgress(caseDefinition, input)
  const keyEvidence = caseDefinition.scoringConfig.keyEvidenceIds.filter((id) => normalized.evidence.has(id))
  const contradictions = caseDefinition.contradictions.filter((item) => normalized.contradictions.has(item.id))
  const accusation = input.accusedNpcId === caseDefinition.culpritId ? 40 : 0
  const evidenceScore = Math.round((keyEvidence.length / caseDefinition.scoringConfig.keyEvidenceIds.length) * 30)
  const contradictionScore = Math.min(20, contradictions.reduce((sum, item) => sum + item.scoreValue, 0))
  const efficiencyScore = input.questionCount === 0 ? 0 : input.questionCount <= 12 ? 10 : input.questionCount <= 18 ? 8 : input.questionCount <= 24 ? 6 : 4
  const culprit = caseDefinition.suspects.find((item) => item.id === caseDefinition.culpritId)!
  const accused = caseDefinition.suspects.find((item) => item.id === input.accusedNpcId)
  const missedDirections: string[] = []
  if (keyEvidence.length < caseDefinition.scoringConfig.keyEvidenceIds.length) missedDirections.push('仍有关键证据尚未进入调查记录。')
  if (!contradictions.some((item) => item.npcId === caseDefinition.culpritId)) missedDirections.push('尚未通过主动举证拆解真凶的关键口供。')
  if (new Set(input.interrogatedNpcIds).size < 3) missedDirections.push('完成对三名嫌疑人的交叉审讯。')
  return {
    correct: input.accusedNpcId === caseDefinition.culpritId,
    accusedName: accused?.name ?? '未知对象',
    culprit: { id: culprit.id, name: culprit.name, descriptor: caseDefinition.resolution.culpritDescriptor },
    explanation: caseDefinition.resolution.explanation,
    confession: caseDefinition.resolution.confession,
    score: {
      total: Math.min(100, Math.max(0, accusation + evidenceScore + contradictionScore + efficiencyScore)),
      breakdown: {
        accusation: { earned: accusation, maximum: 40 }, evidence: { earned: evidenceScore, maximum: 30 },
        contradictions: { earned: contradictionScore, maximum: 20 }, efficiency: { earned: efficiencyScore, maximum: 10 },
      },
      discoveredFactCount: normalized.facts.size,
      discoveredContradictionCount: normalized.contradictions.size,
      keyEvidenceCount: keyEvidence.length,
      missedDirections,
    },
  }
}
