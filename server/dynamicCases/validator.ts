import { CaseDefinitionSchema } from './schema'
import { checkCaseSolvability } from './solvability'
import type { CaseDefinition, CaseValidationResult, ValidationIssue } from './types'

const directlyExposesCulprit = /(?:真凶|盗窃者|作案者|就是他|就是她|偷走|盗走|泄露了|调包了)/

function duplicateValues(values: string[]) {
  const seen = new Set<string>()
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))]
}

function emptySolvability(issues: ValidationIssue[]) {
  return {
    valid: false,
    reachableFactIds: [], reachableEvidenceIds: [], reachableContradictionIds: [],
    unreachableFactIds: [], unreachableEvidenceIds: [], unreachableContradictionIds: [],
    dependencyCycles: [], culpritChainComplete: false, issues,
  }
}

export function validateCaseDefinition(candidate: unknown): CaseValidationResult {
  const parsed = CaseDefinitionSchema.safeParse(candidate)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue): ValidationIssue => ({
      code: 'SCHEMA_INVALID', path: issue.path.join('.'), message: issue.message,
    }))
    return { valid: false, issues, solvability: emptySolvability(issues) }
  }

  const caseDefinition = parsed.data as CaseDefinition
  const issues: ValidationIssue[] = []
  const suspectIds = new Set(caseDefinition.suspects.map((item) => item.id))
  const factIds = new Set(caseDefinition.facts.map((item) => item.id))
  const evidenceIds = new Set(caseDefinition.evidence.map((item) => item.id))
  const contradictionIds = new Set(caseDefinition.contradictions.map((item) => item.id))
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message })

  if (caseDefinition.metadata.mode === 'dynamic' && (caseDefinition.facts.length < 5 || caseDefinition.facts.length > 10)) add('FACT_COUNT_INVALID', 'facts', '动态案件必须包含 5—10 个 Facts。')

  if (!suspectIds.has(caseDefinition.culpritId)) add('CULPRIT_NOT_FOUND', 'culpritId', 'culpritId 不在嫌疑人列表中。')
  const markedCulprits = caseDefinition.suspects.filter((item) => item.isCulprit)
  if (markedCulprits.length !== 1) add('CULPRIT_COUNT_INVALID', 'suspects', '案件必须且只能有一名真凶。')
  if (markedCulprits.length === 1 && markedCulprits[0].id !== caseDefinition.culpritId) add('CULPRIT_MISMATCH', 'culpritId', 'culpritId 与嫌疑人真凶标记不一致。')

  const nestedIds = caseDefinition.suspects.flatMap((suspect) => [
    ...suspect.privateInformation.map((item) => item.id),
    ...suspect.knownFacts.map((item) => item.id),
    ...suspect.presetQuestions.map((item) => item.id),
  ])
  const allIds = [caseDefinition.metadata.caseId, ...suspectIds, ...factIds, ...evidenceIds, ...contradictionIds, ...nestedIds]
  const duplicates = duplicateValues(allIds)
  if (duplicates.length) add('DUPLICATE_ID', 'case', `ID 必须全局唯一：${duplicates.join(', ')}`)

  for (const fact of caseDefinition.facts) {
    if (!suspectIds.has(fact.npcId)) add('FACT_NPC_MISSING', `facts.${fact.id}.npcId`, 'Fact 引用的 NPC 不存在。')
    for (const id of fact.prerequisiteFactIds) if (!factIds.has(id)) add('FACT_REFERENCE_MISSING', `facts.${fact.id}`, `Fact 引用了不存在的 Fact：${id}`)
    for (const id of fact.requiredEvidenceIds) if (!evidenceIds.has(id)) add('FACT_EVIDENCE_MISSING', `facts.${fact.id}`, `Fact 引用了不存在的 Evidence：${id}`)
  }
  for (const evidence of caseDefinition.evidence) {
    for (const id of evidence.relatedNpcIds) if (!suspectIds.has(id)) add('EVIDENCE_NPC_MISSING', `evidence.${evidence.id}`, `Evidence 引用了不存在的 NPC：${id}`)
    if (evidence.isInitial && evidence.unlockRequirements) add('INITIAL_EVIDENCE_LOCKED', `evidence.${evidence.id}`, '初始证据不能同时设置解锁条件。')
    if (!evidence.isInitial && !evidence.unlockRequirements) add('EVIDENCE_WITHOUT_PATH', `evidence.${evidence.id}`, '非初始证据必须有明确解锁条件。')
    if (evidence.unlockRequirements) for (const id of evidence.unlockRequirements.ids) {
      const exists = evidence.unlockRequirements.type === 'fact' ? factIds.has(id) : contradictionIds.has(id)
      if (!exists) add('EVIDENCE_REFERENCE_MISSING', `evidence.${evidence.id}`, `Evidence 引用了不存在的 ${evidence.unlockRequirements.type}：${id}`)
    }
    for (const id of Object.keys(evidence.reactionGuidance)) if (!suspectIds.has(id)) add('REACTION_NPC_MISSING', `evidence.${evidence.id}.reactionGuidance`, `证据反应引用了不存在的 NPC：${id}`)
  }
  for (const contradiction of caseDefinition.contradictions) {
    if (!suspectIds.has(contradiction.npcId)) add('CONTRADICTION_NPC_MISSING', `contradictions.${contradiction.id}`, 'Contradiction 引用的 NPC 不存在。')
    for (const id of contradiction.requiredFactIds) if (!factIds.has(id)) add('CONTRADICTION_FACT_MISSING', `contradictions.${contradiction.id}`, `Contradiction 引用了不存在的 Fact：${id}`)
    for (const id of [...contradiction.requiredEvidenceIds, ...contradiction.requiredPresentedEvidenceIds]) if (!evidenceIds.has(id)) add('CONTRADICTION_EVIDENCE_MISSING', `contradictions.${contradiction.id}`, `Contradiction 引用了不存在的 Evidence：${id}`)
    if (!contradiction.requiredPresentedEvidenceIds.every((id) => contradiction.requiredEvidenceIds.includes(id))) add('PRESENTED_EVIDENCE_NOT_REQUIRED', `contradictions.${contradiction.id}`, '玩家出示的证据必须也是矛盾成立所需证据。')
  }

  for (const suspect of caseDefinition.suspects) {
    const relationIds = Object.keys(suspect.relationshipWithOthers)
    if (relationIds.some((id) => !suspectIds.has(id) || id === suspect.id)) add('RELATIONSHIP_INVALID', `suspects.${suspect.id}.relationshipWithOthers`, '关系对象必须是另一名现有嫌疑人。')
    for (const preset of suspect.presetQuestions) for (const id of preset.revealFactIds) {
      const fact = caseDefinition.facts.find((item) => item.id === id)
      if (!fact || fact.npcId !== suspect.id) add('PRESET_FACT_INVALID', `suspects.${suspect.id}.presetQuestions.${preset.id}`, `预设问题引用了无效 Fact：${id}`)
    }
  }
  const culprit = caseDefinition.suspects.find((item) => item.id === caseDefinition.culpritId)
  if (culprit?.publicInformation.some((item) => directlyExposesCulprit.test(item))) add('CULPRIT_PUBLICLY_EXPOSED', `suspects.${culprit.id}.publicInformation`, '真凶不能在初始公开信息中直接暴露。')
  if (culprit && directlyExposesCulprit.test(culprit.openingLine)) add('CULPRIT_OPENING_EXPOSED', `suspects.${culprit.id}.openingLine`, '真凶不能在开场对白中直接暴露。')
  if (culprit) {
    const culpritName = culprit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const directInitialEvidence = caseDefinition.evidence.filter((item) => item.isInitial).some((item) =>
      new RegExp(culpritName, 'i').test(`${item.title}${item.description}${item.significance}`) && directlyExposesCulprit.test(`${item.description}${item.significance}`))
    if (directInitialEvidence) add('CULPRIT_INITIAL_EVIDENCE_EXPOSED', 'evidence', '初始证据不能直接宣布真凶及其犯罪行为。')
  }
  const innocents = caseDefinition.suspects.filter((item) => !item.isCulprit)
  if (innocents.length !== 2 || innocents.some((item) => item.suspiciousPoint.length < 8)) add('INNOCENT_SUSPICION_WEAK', 'suspects', '两名无辜嫌疑人都必须具有合理嫌疑点。')
  if (!innocents.some((item) => item.privateInformation.length > 0 && item.truthStrategy.some((line) => /隐瞒|秘密|不主动|回避/.test(line)))) add('RED_HERRING_MISSING', 'suspects', '至少一名无辜嫌疑人需要拥有会主动隐瞒的真实秘密。')
  if (caseDefinition.evidence.every((item) => item.relatedNpcIds.includes(caseDefinition.culpritId))) add('EVIDENCE_TOO_OBVIOUS', 'evidence', '证据不能全部直接指向真凶。')
  if (!caseDefinition.evidence.some((item) => !item.isInitial && item.unlockRequirements?.type === 'fact')) add('INTERROGATION_PATH_MISSING', 'evidence', '至少一条证据必须通过审讯 Fact 解锁。')
  if (!caseDefinition.contradictions.some((item) => item.requiredPresentedEvidenceIds.length > 0)) add('PRESENTATION_PATH_MISSING', 'contradictions', '至少一条矛盾必须要求玩家主动出示证据。')
  if (!caseDefinition.evidence.some((item) => item.isInitial)) add('INITIAL_EVIDENCE_MISSING', 'evidence', '案件至少需要一条初始证据。')

  const times = caseDefinition.timeline.map((item) => item.time)
  const sortedTimes = [...times].sort()
  if (times.some((time, index) => time !== sortedTimes[index]) || new Set(times).size !== times.length) add('TIMELINE_INCOHERENT', 'timeline', '时间线必须按时间递增且时间点唯一。')

  for (const [path, ids, catalog] of [
    ['scoringConfig.keyEvidenceIds', caseDefinition.scoringConfig.keyEvidenceIds, evidenceIds],
    ['scoringConfig.culpritEvidenceIds', caseDefinition.scoringConfig.culpritEvidenceIds, evidenceIds],
    ['scoringConfig.importantFactIds', caseDefinition.scoringConfig.importantFactIds, factIds],
  ] as const) for (const id of ids) if (!catalog.has(id)) add('SCORING_REFERENCE_MISSING', path, `评分配置引用了不存在的 ID：${id}`)
  if (caseDefinition.scoringConfig.minimumCulpritEvidence > caseDefinition.scoringConfig.culpritEvidenceIds.length) add('CULPRIT_THRESHOLD_INVALID', 'scoringConfig.minimumCulpritEvidence', '真凶证据阈值超过候选证据数量。')

  const solvability = checkCaseSolvability(caseDefinition)
  const allIssues = [...issues, ...solvability.issues]
  return { valid: allIssues.length === 0, issues: allIssues, solvability }
}

export function summarizeValidationIssues(result: CaseValidationResult) {
  return [...new Set(result.issues.map((issue) => `${issue.code}: ${issue.message}`))].slice(0, 8)
}
