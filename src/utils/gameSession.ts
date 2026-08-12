import type { InvestigationUpdate } from './investigationRules'

export interface DiscoveryEvent extends InvestigationUpdate {
  nonce: number
}

export interface InvestigationSessionState {
  askedDialogueIds: string[]
  collectedEvidenceIds: string[]
  presentedEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  questionCount: number
  lastDiscovery: DiscoveryEvent | null
}

export function createInvestigationSession(initialEvidenceIds: string[]): InvestigationSessionState {
  return {
    askedDialogueIds: [],
    collectedEvidenceIds: [...initialEvidenceIds],
    presentedEvidenceIds: [],
    discoveredFactIds: [],
    discoveredContradictionIds: [],
    questionCount: 0,
    lastDiscovery: null,
  }
}

export function applySessionUpdate(
  session: InvestigationSessionState,
  update: InvestigationUpdate,
): InvestigationSessionState {
  const newFacts = [...new Set(update.revealedFactIds)].filter((id) => !session.discoveredFactIds.includes(id))
  const newContradictions = [...new Set(update.contradictionIds)].filter((id) => !session.discoveredContradictionIds.includes(id))
  const newEvidence = [...new Set(update.unlockedEvidenceIds)].filter((id) => !session.collectedEvidenceIds.includes(id))
  const newPresentedEvidence = [...new Set(update.presentedEvidenceIds ?? [])]
    .filter((id) => session.collectedEvidenceIds.includes(id))
    .filter((id) => !session.presentedEvidenceIds.includes(id))
  const hasDiscovery = newFacts.length > 0 || newContradictions.length > 0 || newEvidence.length > 0

  return {
    ...session,
    discoveredFactIds: [...session.discoveredFactIds, ...newFacts],
    discoveredContradictionIds: [...session.discoveredContradictionIds, ...newContradictions],
    collectedEvidenceIds: [...session.collectedEvidenceIds, ...newEvidence],
    presentedEvidenceIds: [...session.presentedEvidenceIds, ...newPresentedEvidence],
    lastDiscovery: hasDiscovery
      ? { revealedFactIds: newFacts, contradictionIds: newContradictions, unlockedEvidenceIds: newEvidence, nonce: Date.now() }
      : session.lastDiscovery,
  }
}
