import type { AgentId } from '../types/agent'

export type FactCategory = 'timeline' | 'access' | 'motive' | 'behavior' | 'testimony'

export interface FactDefinition {
  id: string
  title: string
  description: string
  npcId: AgentId
  category: FactCategory
  revealConditions: string
  prerequisiteFactIds: string[]
  requiredEvidenceIds: string[]
  scoreValue: number
}

export interface ContradictionDefinition {
  id: string
  npcId: AgentId
  title: string
  description: string
  relatedFactIds: string[]
  relatedEvidenceIds: string[]
  requiredPresentedEvidenceIds: string[]
  scoreValue: number
}

export interface EvidenceUnlockRule {
  evidenceId: string
  unlockRequirements?:
    | { type: 'fact'; ids: string[] }
    | { type: 'contradiction'; ids: string[] }
}

export const factDefinitions: FactDefinition[] = [
  {
    id: 'jack_stayed_after_event',
    title: 'Jack 在活动后仍未离店',
    description: 'Jack 承认周年活动结束后仍留在咖啡馆，而非立即离开。',
    npcId: 'jack', category: 'timeline', revealConditions: 'Jack 明确认可自己在 22:45 后仍留在店内。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 2,
  },
  {
    id: 'jack_went_upstairs',
    title: 'Jack 曾进入二楼',
    description: 'Jack 承认活动结束后曾在二楼拍摄长曝光照片。',
    npcId: 'jack', category: 'behavior', revealConditions: 'Jack 明确承认去过二楼或在那里拍摄。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 3,
  },
  {
    id: 'alice_returned_spare_key',
    title: 'Alice 已交还备用钥匙',
    description: 'Alice 表示自己在案发当天傍晚已经归还办公室备用钥匙。',
    npcId: 'alice', category: 'access', revealConditions: 'Alice 明确说明钥匙已归还，并愿意接受日志核查。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 2,
  },
  {
    id: 'alice_returned_for_earphones',
    title: 'Alice 曾短暂返回店内',
    description: 'Alice 承认离店后曾返回员工区取耳机。',
    npcId: 'alice', category: 'timeline', revealConditions: 'Alice 明确承认返回及返回目的。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 2,
  },
  {
    id: 'alice_left_before_crime',
    title: 'Alice 在关键时段前离开',
    description: '交通记录支持 Alice 在后门警报触发前已经离开现场。',
    npcId: 'alice', category: 'timeline', revealConditions: 'Alice 的离开说法与交通记录同时成立。',
    prerequisiteFactIds: ['alice_returned_for_earphones'], requiredEvidenceIds: ['transit-record'], scoreValue: 3,
  },
  {
    id: 'tom_claimed_supplier_call',
    title: 'Tom 声称在打供应商电话',
    description: 'Tom 将案发时段解释为在楼上处理供应商来电。',
    npcId: 'tom', category: 'testimony', revealConditions: 'Tom 明确坚持供应商电话是不在场理由。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 1,
  },
  {
    id: 'tom_used_alarm_code',
    title: 'Tom 掌握办公室警报密码',
    description: 'Tom 承认自己熟知能够一次解除办公室警报的密码。',
    npcId: 'tom', category: 'access', revealConditions: 'Tom 承认掌握密码，且玩家已有警报记录。',
    prerequisiteFactIds: [], requiredEvidenceIds: ['alarm-log'], scoreValue: 3,
  },
  {
    id: 'tom_seen_at_office',
    title: 'Tom 在 23:09 位于办公室门口',
    description: '相机原片迫使 Tom 承认自己当时接触过办公室和募款箱。',
    npcId: 'tom', category: 'timeline', revealConditions: '玩家以 23:09 原片质问，Tom 承认照片中的人是自己。',
    prerequisiteFactIds: [], requiredEvidenceIds: ['memory-card-photo'], scoreValue: 4,
  },
  {
    id: 'tom_denied_office_contact',
    title: 'Tom 否认接近办公室与募款箱',
    description: 'Tom 明确声称案发时没有下楼、接近办公室或接触募款箱。',
    npcId: 'tom', category: 'testimony', revealConditions: 'Tom 明确否认案发时接近办公室、下楼或接触募款箱。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 1,
  },
  {
    id: 'tom_fake_supplier_call',
    title: 'Tom 的供应商电话无法成立',
    description: 'Tom 的通话说法与运营商详单冲突，他开始改称网络电话或记错时间。',
    npcId: 'tom', category: 'testimony', revealConditions: '玩家出示通话详单后，Tom 改变或弱化原说法。',
    prerequisiteFactIds: ['tom_claimed_supplier_call'], requiredEvidenceIds: ['supplier-call-record'], scoreValue: 4,
  },
  {
    id: 'tom_financial_pressure',
    title: 'Tom 面临明确财务压力',
    description: 'Tom 承认存在临近到期的私人债务。',
    npcId: 'tom', category: 'motive', revealConditions: '玩家主动调查 Tom 的财务状况，Tom 明确承认债务或资金压力。',
    prerequisiteFactIds: [], requiredEvidenceIds: [], scoreValue: 3,
  },
]

export const contradictionDefinitions: ContradictionDefinition[] = [
  {
    id: 'jack_exit_time_conflict', npcId: 'jack', title: 'Jack 的离店时间发生变化',
    description: 'Jack 从“活动结束后立即离开”改口为曾在二楼停留到约 23:18。',
    relatedFactIds: ['jack_stayed_after_event', 'jack_went_upstairs'], relatedEvidenceIds: ['camera-metadata'], requiredPresentedEvidenceIds: ['camera-metadata'], scoreValue: 4,
  },
  {
    id: 'tom_supplier_call_conflict', npcId: 'tom', title: '供应商通话无法验证',
    description: 'Tom 坚称在通话，但运营商记录显示相关时段没有任何通话。',
    relatedFactIds: ['tom_claimed_supplier_call'], relatedEvidenceIds: ['supplier-call-record'], requiredPresentedEvidenceIds: ['supplier-call-record'], scoreValue: 6,
  },
  {
    id: 'tom_location_conflict', npcId: 'tom', title: 'Tom 的位置口供冲突',
    description: 'Tom 明确否认案发时接近办公室或募款箱，23:09 原片却显示他在办公室门口拿着募款箱。',
    relatedFactIds: ['tom_denied_office_contact'], relatedEvidenceIds: ['memory-card-photo'], requiredPresentedEvidenceIds: ['memory-card-photo'], scoreValue: 6,
  },
  {
    id: 'tom_alarm_statement_conflict', npcId: 'tom', title: '警报说法与权限冲突',
    description: '警报被一次正确解除，而 Tom 是长期掌握密码并熟悉维护时段的人。',
    relatedFactIds: ['tom_used_alarm_code'], relatedEvidenceIds: ['alarm-log', 'rear-door-scratches'], requiredPresentedEvidenceIds: ['alarm-log'], scoreValue: 4,
  },
]

export const evidenceUnlockRules: EvidenceUnlockRule[] = [
  { evidenceId: 'rear-door-scratches' },
  { evidenceId: 'alarm-log' },
  { evidenceId: 'camera-metadata', unlockRequirements: { type: 'fact', ids: ['jack_stayed_after_event'] } },
  { evidenceId: 'memory-card-photo', unlockRequirements: { type: 'fact', ids: ['jack_went_upstairs'] } },
  { evidenceId: 'key-return-log', unlockRequirements: { type: 'fact', ids: ['alice_returned_spare_key'] } },
  { evidenceId: 'transit-record', unlockRequirements: { type: 'fact', ids: ['alice_returned_for_earphones'] } },
  { evidenceId: 'supplier-call-record', unlockRequirements: { type: 'fact', ids: ['tom_claimed_supplier_call'] } },
  { evidenceId: 'debt-letter', unlockRequirements: { type: 'fact', ids: ['tom_financial_pressure'] } },
]

const factById = new Map(factDefinitions.map((fact) => [fact.id, fact]))
const contradictionById = new Map(contradictionDefinitions.map((item) => [item.id, item]))

function uniqueKnown(ids: string[], catalog: Map<string, unknown>) {
  return [...new Set(ids)].filter((id) => catalog.has(id))
}

function requirementsMet(rule: EvidenceUnlockRule, facts: Set<string>, contradictions: Set<string>) {
  if (!rule.unlockRequirements) return false
  return rule.unlockRequirements.type === 'fact'
    ? rule.unlockRequirements.ids.every((id) => facts.has(id))
    : rule.unlockRequirements.ids.every((id) => contradictions.has(id))
}

export interface ValidateInvestigationInput {
  npcId: AgentId
  suggestedFactIds: string[]
  suggestedContradictionIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  discoveredEvidenceIds: string[]
  presentedEvidenceIds?: string[]
}

export type FactRejectionReason =
  | 'unknown_fact'
  | 'npc_not_allowed'
  | 'already_discovered'
  | 'missing_prerequisite'
  | 'missing_evidence'

export interface RejectedFact {
  id: string
  reason: FactRejectionReason
  missingIds: string[]
}

export type ContradictionRejectionReason =
  | 'unknown_contradiction'
  | 'npc_not_allowed'
  | 'already_discovered'
  | 'missing_related_fact'
  | 'missing_related_evidence'
  | 'missing_presented_evidence'

export interface RejectedContradiction {
  id: string
  reason: ContradictionRejectionReason
  missingIds: string[]
}

export interface EvaluateContradictionsInput {
  discoveredFactIds: string[]
  discoveredEvidenceIds: string[]
  discoveredContradictionIds: string[]
  presentedEvidenceIds?: string[]
  npcId?: AgentId
}

export function evaluateContradictions(input: EvaluateContradictionsInput) {
  const facts = new Set(uniqueKnown(input.discoveredFactIds, factById))
  const evidence = new Set(input.discoveredEvidenceIds)
  const existing = new Set(uniqueKnown(input.discoveredContradictionIds, contradictionById))
  const presented = new Set((input.presentedEvidenceIds ?? []).filter((id) => evidence.has(id)))
  return contradictionDefinitions
    .filter((item) => !input.npcId || item.npcId === input.npcId)
    .filter((item) => !existing.has(item.id))
    .filter((item) => item.relatedFactIds.every((id) => facts.has(id)))
    .filter((item) => item.relatedEvidenceIds.every((id) => evidence.has(id)))
    .filter((item) => item.requiredPresentedEvidenceIds.every((id) => presented.has(id)))
    .map((item) => item.id)
}

function rejectContradictionCandidate(
  id: string,
  npcId: AgentId,
  facts: Set<string>,
  evidence: Set<string>,
  presentedEvidence: Set<string>,
  existing: Set<string>,
): RejectedContradiction | null {
  const contradiction = contradictionById.get(id)
  if (!contradiction) return { id, reason: 'unknown_contradiction', missingIds: [] }
  if (contradiction.npcId !== npcId) return { id, reason: 'npc_not_allowed', missingIds: [] }
  if (existing.has(id)) return { id, reason: 'already_discovered', missingIds: [] }
  const missingFacts = contradiction.relatedFactIds.filter((factId) => !facts.has(factId))
  if (missingFacts.length > 0) return { id, reason: 'missing_related_fact', missingIds: missingFacts }
  const missingEvidence = contradiction.relatedEvidenceIds.filter((evidenceId) => !evidence.has(evidenceId))
  if (missingEvidence.length > 0) return { id, reason: 'missing_related_evidence', missingIds: missingEvidence }
  const missingPresentedEvidence = contradiction.requiredPresentedEvidenceIds.filter((evidenceId) => !presentedEvidence.has(evidenceId))
  if (missingPresentedEvidence.length > 0) return { id, reason: 'missing_presented_evidence', missingIds: missingPresentedEvidence }
  return null
}

export function validateInvestigationSuggestions(input: ValidateInvestigationInput) {
  const knownFacts = new Set(uniqueKnown(input.discoveredFactIds, factById))
  const knownContradictions = new Set(uniqueKnown(input.discoveredContradictionIds, contradictionById))
  const evidenceAtTurnStart = new Set(input.discoveredEvidenceIds)
  const presentedThisTurn = new Set((input.presentedEvidenceIds ?? []).filter((id) => evidenceAtTurnStart.has(id)))
  const acceptedFactIds: string[] = []
  const pendingFacts = new Set(input.suggestedFactIds)
  const rejectedFactIds: RejectedFact[] = []

  let changed = true
  while (changed) {
    changed = false
    for (const id of [...pendingFacts]) {
      const fact = factById.get(id)
      if (!fact) {
        rejectedFactIds.push({ id, reason: 'unknown_fact', missingIds: [] })
        pendingFacts.delete(id)
        continue
      }
      if (fact.npcId !== input.npcId) {
        rejectedFactIds.push({ id, reason: 'npc_not_allowed', missingIds: [] })
        pendingFacts.delete(id)
        continue
      }
      if (knownFacts.has(id)) {
        rejectedFactIds.push({ id, reason: 'already_discovered', missingIds: [] })
        pendingFacts.delete(id)
        continue
      }
      const prerequisitesMet = fact.prerequisiteFactIds.every((requiredId) => knownFacts.has(requiredId))
      const evidenceMet = fact.requiredEvidenceIds.every((requiredId) => evidenceAtTurnStart.has(requiredId))
      if (!prerequisitesMet || !evidenceMet) continue
      knownFacts.add(id)
      acceptedFactIds.push(id)
      pendingFacts.delete(id)
      changed = true
    }
  }


  for (const id of pendingFacts) {
    const fact = factById.get(id)
    if (!fact) continue
    const missingPrerequisites = fact.prerequisiteFactIds.filter((requiredId) => !knownFacts.has(requiredId))
    const missingEvidence = fact.requiredEvidenceIds.filter((requiredId) => !evidenceAtTurnStart.has(requiredId))
    rejectedFactIds.push({
      id,
      reason: missingPrerequisites.length > 0 ? 'missing_prerequisite' : 'missing_evidence',
      missingIds: missingPrerequisites.length > 0 ? missingPrerequisites : missingEvidence,
    })
  }

  const unlockedEvidenceIds = evidenceUnlockRules
    .filter((rule) => !evidenceAtTurnStart.has(rule.evidenceId) && requirementsMet(rule, knownFacts, knownContradictions))
    .map((rule) => rule.evidenceId)

  const deterministicContradictionIds = evaluateContradictions({
    discoveredFactIds: [...knownFacts],
    discoveredEvidenceIds: [...evidenceAtTurnStart],
    discoveredContradictionIds: [...knownContradictions],
    presentedEvidenceIds: [...presentedThisTurn],
    npcId: input.npcId,
  })
  deterministicContradictionIds.forEach((id) => knownContradictions.add(id))

  const acceptedContradictionIds = deterministicContradictionIds
  const rejectedContradictionIds = [...new Set(input.suggestedContradictionIds)]
    .filter((id) => !acceptedContradictionIds.includes(id))
    .map((id) => rejectContradictionCandidate(
      id,
      input.npcId,
      knownFacts,
      evidenceAtTurnStart,
      presentedThisTurn,
      new Set(input.discoveredContradictionIds),
    ))
    .filter((item): item is RejectedContradiction => item !== null)

  return {
    acceptedFactIds,
    rejectedFactIds,
    acceptedContradictionIds,
    rejectedContradictionIds,
    unlockedEvidenceIds,
  }
}

export function getAllowedInvestigationTriggers(npcId: AgentId) {
  return {
    facts: factDefinitions.filter((fact) => fact.npcId === npcId),
    contradictions: contradictionDefinitions.filter((item) => item.npcId === npcId),
  }
}

export function findInvestigationDependencyCycles() {
  const graph = new Map<string, string[]>()
  for (const fact of factDefinitions) {
    graph.set(`fact:${fact.id}`, [
      ...fact.prerequisiteFactIds.map((id) => `fact:${id}`),
      ...fact.requiredEvidenceIds.map((id) => `evidence:${id}`),
    ])
  }
  for (const contradiction of contradictionDefinitions) {
    graph.set(`contradiction:${contradiction.id}`, [
      ...contradiction.relatedFactIds.map((id) => `fact:${id}`),
      ...contradiction.relatedEvidenceIds.map((id) => `evidence:${id}`),
      ...contradiction.requiredPresentedEvidenceIds.map((id) => `evidence:${id}`),
    ])
  }
  for (const rule of evidenceUnlockRules) {
    graph.set(`evidence:${rule.evidenceId}`, rule.unlockRequirements
      ? rule.unlockRequirements.ids.map((id) => `${rule.unlockRequirements?.type}:${id}`)
      : [])
  }

  const cycles: string[][] = []
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []
  const visit = (node: string) => {
    if (active.has(node)) {
      const start = path.indexOf(node)
      cycles.push([...path.slice(start), node])
      return
    }
    if (visited.has(node)) return
    visited.add(node)
    active.add(node)
    path.push(node)
    for (const dependency of graph.get(node) ?? []) visit(dependency)
    path.pop()
    active.delete(node)
  }
  for (const node of graph.keys()) visit(node)
  return cycles
}

export interface InvestigationProgressInput {
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  discoveredEvidenceIds: string[]
  presentedEvidenceIds?: string[]
}

/**
 * Rebuilds a session's trusted investigation state from the case graph.
 * This keeps scoring independent from client-provided ownership claims.
 */
export function normalizeInvestigationProgress(input: InvestigationProgressInput) {
  const requestedFacts = new Set(uniqueKnown(input.discoveredFactIds, factById))
  const requestedContradictions = new Set(uniqueKnown(input.discoveredContradictionIds, contradictionById))
  const evidenceRuleById = new Map(evidenceUnlockRules.map((rule) => [rule.evidenceId, rule]))
  const requestedEvidence = new Set(input.discoveredEvidenceIds.filter((id) => evidenceRuleById.has(id)))
  const facts = new Set<string>()
  const contradictions = new Set<string>()
  const evidence = new Set<string>()
  const requestedPresentedEvidence = new Set(input.presentedEvidenceIds ?? input.discoveredEvidenceIds)

  for (const rule of evidenceUnlockRules) {
    if (!rule.unlockRequirements && requestedEvidence.has(rule.evidenceId)) evidence.add(rule.evidenceId)
  }

  let changed = true
  while (changed) {
    changed = false

    for (const fact of factDefinitions) {
      if (!requestedFacts.has(fact.id) || facts.has(fact.id)) continue
      if (!fact.prerequisiteFactIds.every((id) => facts.has(id))) continue
      if (!fact.requiredEvidenceIds.every((id) => evidence.has(id))) continue
      facts.add(fact.id)
      changed = true
    }

    for (const contradiction of contradictionDefinitions) {
      if (!requestedContradictions.has(contradiction.id) || contradictions.has(contradiction.id)) continue
      if (!contradiction.relatedFactIds.every((id) => facts.has(id))) continue
      if (!contradiction.relatedEvidenceIds.every((id) => evidence.has(id))) continue
      if (!contradiction.requiredPresentedEvidenceIds.every((id) => requestedPresentedEvidence.has(id))) continue
      contradictions.add(contradiction.id)
      changed = true
    }

    for (const rule of evidenceUnlockRules) {
      if (!requestedEvidence.has(rule.evidenceId) || evidence.has(rule.evidenceId)) continue
      if (!requirementsMet(rule, facts, contradictions)) continue
      evidence.add(rule.evidenceId)
      changed = true
    }
  }

  return {
    discoveredFactIds: [...facts],
    discoveredContradictionIds: [...contradictions],
    discoveredEvidenceIds: [...evidence],
  }
}
