import { evidence } from '../data/gameData'
import { notebookContradictionById, notebookFactById } from '../data/investigationNotebook'

export interface InvestigationUpdate {
  revealedFactIds: string[]
  contradictionIds: string[]
  unlockedEvidenceIds: string[]
  presentedEvidenceIds?: string[]
}

export function resolveTrustedPresetUpdate(
  suggestedFactIds: string[],
  suggestedContradictionIds: string[],
  discoveredFactIds: string[],
  discoveredContradictionIds: string[],
  discoveredEvidenceIds: string[],
): InvestigationUpdate {
  const factSet = new Set(discoveredFactIds)
  const contradictionSet = new Set(discoveredContradictionIds)
  const evidenceSet = new Set(discoveredEvidenceIds)
  const revealedFactIds = [...new Set(suggestedFactIds)]
    .filter((id) => notebookFactById[id] && !factSet.has(id))
  revealedFactIds.forEach((id) => factSet.add(id))

  const unlockedEvidenceIds = evidence
    .filter((item) => !evidenceSet.has(item.id) && item.unlockRequirements?.type === 'fact')
    .filter((item) => item.unlockRequirements?.ids.every((id) => factSet.has(id)))
    .map((item) => item.id)

  const contradictionIds = [...new Set(suggestedContradictionIds)].filter((id) => {
    const item = notebookContradictionById[id]
    if (!item || contradictionSet.has(id)) return false
    const factReady = item.id === 'jack_exit_time_conflict'
      ? ['jack_stayed_after_event', 'jack_went_upstairs'].every((factId) => factSet.has(factId))
      : item.id === 'tom_supplier_call_conflict'
        ? factSet.has('tom_claimed_supplier_call')
        : item.id === 'tom_location_conflict'
          ? factSet.has('tom_denied_office_contact')
          : item.id === 'tom_alarm_statement_conflict'
            ? factSet.has('tom_used_alarm_code')
            : false
    const evidenceReady = item.id === 'jack_exit_time_conflict'
      ? evidenceSet.has('camera-metadata')
      : item.id === 'tom_supplier_call_conflict'
        ? evidenceSet.has('supplier-call-record')
        : item.id === 'tom_location_conflict'
          ? evidenceSet.has('memory-card-photo')
          : item.id === 'tom_alarm_statement_conflict'
            ? evidenceSet.has('alarm-log') && evidenceSet.has('rear-door-scratches')
            : false
    return factReady && evidenceReady
  })
  return { revealedFactIds, contradictionIds, unlockedEvidenceIds }
}
