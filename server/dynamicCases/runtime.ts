import type { AgentEmotion, ConversationTurn, InterrogateResult } from '../types/agent'
import type { CaseDefinition } from './types'

export interface RuntimeInvestigationInput {
  npcId: string
  message: string
  conversationHistory: ConversationTurn[]
  discoveredEvidenceIds: string[]
  presentedEvidenceIds?: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
}

export interface RuntimeValidationResult extends InterrogateResult {
  emotion: AgentEmotion
}

export interface DynamicRejectedFact {
  id: string
  reason: 'unknown_fact' | 'npc_not_allowed' | 'already_discovered' | 'missing_prerequisite' | 'missing_evidence'
}

function uniqueKnown(ids: string[], catalog: Set<string>) {
  return [...new Set(ids)].filter((id) => catalog.has(id))
}

export function detectDynamicPresentedEvidence(message: string, discoveredEvidenceIds: string[], caseDefinition: CaseDefinition) {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  const discovered = new Set(discoveredEvidenceIds)
  return caseDefinition.evidence
    .filter((item) => discovered.has(item.id))
    .filter((item) => item.presentationKeywords.some((keyword) => normalized.includes(keyword.toLowerCase().replace(/\s+/g, ''))))
    .map((item) => item.id)
}

export function validateDynamicInvestigationTurn(
  input: RuntimeInvestigationInput,
  suggestedFactIds: string[],
  suggestedContradictionIds: string[],
  caseDefinition: CaseDefinition,
) {
  const factCatalog = new Map(caseDefinition.facts.map((item) => [item.id, item]))
  const evidenceCatalog = new Map(caseDefinition.evidence.map((item) => [item.id, item]))
  const contradictionCatalog = new Map(caseDefinition.contradictions.map((item) => [item.id, item]))
  const knownFacts = new Set(uniqueKnown(input.discoveredFactIds, new Set(factCatalog.keys())))
  const existingContradictions = new Set(uniqueKnown(input.discoveredContradictionIds, new Set(contradictionCatalog.keys())))
  const evidenceAtTurnStart = new Set(uniqueKnown(input.discoveredEvidenceIds, new Set(evidenceCatalog.keys())))
  const presentedThisTurn = new Set(detectDynamicPresentedEvidence(input.message, [...evidenceAtTurnStart], caseDefinition))
  const acceptedFactIds: string[] = []
  const pendingFacts = new Set(suggestedFactIds)
  const rejectedFactIds: DynamicRejectedFact[] = []

  let changed = true
  while (changed) {
    changed = false
    for (const id of [...pendingFacts]) {
      const fact = factCatalog.get(id)
      if (!fact) {
        rejectedFactIds.push({ id, reason: 'unknown_fact' })
        pendingFacts.delete(id)
        continue
      }
      if (fact.npcId !== input.npcId) {
        rejectedFactIds.push({ id, reason: 'npc_not_allowed' })
        pendingFacts.delete(id)
        continue
      }
      if (knownFacts.has(id)) {
        rejectedFactIds.push({ id, reason: 'already_discovered' })
        pendingFacts.delete(id)
        continue
      }
      if (!fact.prerequisiteFactIds.every((required) => knownFacts.has(required))) continue
      if (!fact.requiredEvidenceIds.every((required) => evidenceAtTurnStart.has(required))) continue
      knownFacts.add(id)
      acceptedFactIds.push(id)
      pendingFacts.delete(id)
      changed = true
    }
  }

  for (const id of pendingFacts) {
    const fact = factCatalog.get(id)
    if (!fact) continue
    rejectedFactIds.push({
      id,
      reason: fact.prerequisiteFactIds.some((required) => !knownFacts.has(required)) ? 'missing_prerequisite' : 'missing_evidence',
    })
  }

  const unlockedEvidenceIds = caseDefinition.evidence
    .filter((item) => !item.isInitial && !evidenceAtTurnStart.has(item.id) && item.unlockRequirements)
    .filter((item) => {
      const source = item.unlockRequirements?.type === 'fact' ? knownFacts : existingContradictions
      return item.unlockRequirements?.ids.every((id) => source.has(id))
    })
    .map((item) => item.id)

  const suggested = new Set(suggestedContradictionIds.filter((id) => contradictionCatalog.has(id)))
  const contradictionIds = caseDefinition.contradictions
    .filter((item) => item.npcId === input.npcId && !existingContradictions.has(item.id))
    .filter((item) => item.requiredFactIds.every((id) => knownFacts.has(id)))
    .filter((item) => item.requiredEvidenceIds.every((id) => evidenceAtTurnStart.has(id)))
    .filter((item) => item.requiredPresentedEvidenceIds.every((id) => presentedThisTurn.has(id)))
    .filter((item) => suggested.has(item.id) || item.requiredPresentedEvidenceIds.length > 0)
    .map((item) => item.id)

  return { acceptedFactIds, rejectedFactIds, contradictionIds, unlockedEvidenceIds, presentedEvidenceIds: [...presentedThisTurn] }
}

export function normalizeDynamicProgress(caseDefinition: CaseDefinition, input: {
  discoveredFactIds: string[]
  discoveredEvidenceIds: string[]
  discoveredContradictionIds: string[]
}) {
  const requestedFacts = new Set(input.discoveredFactIds)
  const requestedEvidence = new Set(input.discoveredEvidenceIds)
  const requestedContradictions = new Set(input.discoveredContradictionIds)
  const facts = new Set<string>()
  const evidence = new Set(caseDefinition.evidence.filter((item) => item.isInitial && requestedEvidence.has(item.id)).map((item) => item.id))
  const contradictions = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const fact of caseDefinition.facts) {
      if (!requestedFacts.has(fact.id) || facts.has(fact.id)) continue
      if (!fact.prerequisiteFactIds.every((id) => facts.has(id)) || !fact.requiredEvidenceIds.every((id) => evidence.has(id))) continue
      facts.add(fact.id); changed = true
    }
    for (const contradiction of caseDefinition.contradictions) {
      if (!requestedContradictions.has(contradiction.id) || contradictions.has(contradiction.id)) continue
      if (!contradiction.requiredFactIds.every((id) => facts.has(id)) || !contradiction.requiredEvidenceIds.every((id) => evidence.has(id))) continue
      contradictions.add(contradiction.id); changed = true
    }
    for (const item of caseDefinition.evidence) {
      if (!requestedEvidence.has(item.id) || evidence.has(item.id) || !item.unlockRequirements) continue
      const source = item.unlockRequirements.type === 'fact' ? facts : contradictions
      if (!item.unlockRequirements.ids.every((id) => source.has(id))) continue
      evidence.add(item.id); changed = true
    }
  }
  return { facts, evidence, contradictions }
}
