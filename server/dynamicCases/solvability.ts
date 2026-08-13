import type { CaseDefinition, SolvabilityReport, ValidationIssue } from './types'

function node(kind: 'fact' | 'evidence' | 'contradiction', id: string) {
  return `${kind}:${id}`
}

export function findCaseDependencyCycles(caseDefinition: CaseDefinition) {
  const graph = new Map<string, string[]>()
  for (const fact of caseDefinition.facts) {
    graph.set(node('fact', fact.id), [
      ...fact.prerequisiteFactIds.map((id) => node('fact', id)),
      ...fact.requiredEvidenceIds.map((id) => node('evidence', id)),
    ])
  }
  for (const evidence of caseDefinition.evidence) {
    graph.set(node('evidence', evidence.id), evidence.isInitial || !evidence.unlockRequirements
      ? []
      : evidence.unlockRequirements.ids.map((id) => node(evidence.unlockRequirements!.type, id)))
  }
  for (const contradiction of caseDefinition.contradictions) {
    graph.set(node('contradiction', contradiction.id), [
      ...contradiction.requiredFactIds.map((id) => node('fact', id)),
      ...contradiction.requiredEvidenceIds.map((id) => node('evidence', id)),
      ...contradiction.requiredPresentedEvidenceIds.map((id) => node('evidence', id)),
    ])
  }

  const cycles: string[][] = []
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []
  const visit = (current: string) => {
    if (active.has(current)) {
      const start = path.indexOf(current)
      cycles.push([...path.slice(start), current])
      return
    }
    if (visited.has(current)) return
    visited.add(current)
    active.add(current)
    path.push(current)
    for (const dependency of graph.get(current) ?? []) visit(dependency)
    path.pop()
    active.delete(current)
  }
  for (const current of graph.keys()) visit(current)
  return cycles
}

export function checkCaseSolvability(caseDefinition: CaseDefinition): SolvabilityReport {
  const reachableFacts = new Set<string>()
  const reachableEvidence = new Set(caseDefinition.evidence.filter((item) => item.isInitial).map((item) => item.id))
  const reachableContradictions = new Set<string>()
  const cycles = findCaseDependencyCycles(caseDefinition)

  let changed = true
  while (changed) {
    changed = false
    for (const fact of caseDefinition.facts) {
      if (reachableFacts.has(fact.id)) continue
      if (!fact.prerequisiteFactIds.every((id) => reachableFacts.has(id))) continue
      if (!fact.requiredEvidenceIds.every((id) => reachableEvidence.has(id))) continue
      reachableFacts.add(fact.id)
      changed = true
    }
    for (const evidence of caseDefinition.evidence) {
      if (reachableEvidence.has(evidence.id) || !evidence.unlockRequirements) continue
      const source = evidence.unlockRequirements.type === 'fact' ? reachableFacts : reachableContradictions
      if (!evidence.unlockRequirements.ids.every((id) => source.has(id))) continue
      reachableEvidence.add(evidence.id)
      changed = true
    }
    for (const contradiction of caseDefinition.contradictions) {
      if (reachableContradictions.has(contradiction.id)) continue
      if (!contradiction.requiredFactIds.every((id) => reachableFacts.has(id))) continue
      if (!contradiction.requiredEvidenceIds.every((id) => reachableEvidence.has(id))) continue
      if (!contradiction.requiredPresentedEvidenceIds.every((id) => reachableEvidence.has(id))) continue
      reachableContradictions.add(contradiction.id)
      changed = true
    }
  }

  const unreachableFactIds = caseDefinition.facts.filter((item) => !reachableFacts.has(item.id)).map((item) => item.id)
  const unreachableEvidenceIds = caseDefinition.evidence.filter((item) => !reachableEvidence.has(item.id)).map((item) => item.id)
  const unreachableContradictionIds = caseDefinition.contradictions.filter((item) => !reachableContradictions.has(item.id)).map((item) => item.id)
  const reachableCulpritEvidence = caseDefinition.scoringConfig.culpritEvidenceIds
    .filter((id) => reachableEvidence.has(id)).length
  const culpritContradiction = caseDefinition.contradictions.some((item) =>
    item.npcId === caseDefinition.culpritId && reachableContradictions.has(item.id))
  const culpritChainComplete = reachableCulpritEvidence >= caseDefinition.scoringConfig.minimumCulpritEvidence
    && culpritContradiction
  const issues: ValidationIssue[] = []
  if (cycles.length) issues.push({ code: 'DEPENDENCY_CYCLE', path: 'graph', message: '案件依赖图存在循环。' })
  if (unreachableFactIds.length) issues.push({ code: 'UNREACHABLE_FACT', path: 'facts', message: `存在不可达事实：${unreachableFactIds.join(', ')}` })
  if (unreachableEvidenceIds.length) issues.push({ code: 'UNREACHABLE_EVIDENCE', path: 'evidence', message: `存在不可达证据：${unreachableEvidenceIds.join(', ')}` })
  if (unreachableContradictionIds.length) issues.push({ code: 'UNREACHABLE_CONTRADICTION', path: 'contradictions', message: `存在不可达矛盾：${unreachableContradictionIds.join(', ')}` })
  if (!culpritChainComplete) issues.push({ code: 'CULPRIT_CHAIN_INCOMPLETE', path: 'scoringConfig.culpritEvidenceIds', message: '支持正确指认真凶的证据闭环不可达或不足。' })

  return {
    valid: issues.length === 0,
    reachableFactIds: [...reachableFacts],
    reachableEvidenceIds: [...reachableEvidence],
    reachableContradictionIds: [...reachableContradictions],
    unreachableFactIds,
    unreachableEvidenceIds,
    unreachableContradictionIds,
    dependencyCycles: cycles,
    culpritChainComplete,
    issues,
  }
}
