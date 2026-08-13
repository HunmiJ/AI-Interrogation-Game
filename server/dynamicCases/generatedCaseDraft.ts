import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { AgentEmotion } from '../types/agent'
import type { CaseDefinition, EvidenceCategory, GenerationOptions } from './types'

const id = z.string().trim().regex(/^[a-z][a-z0-9_-]{2,63}$/)
const shortText = z.string().trim().min(1).max(160)
const paragraph = z.string().trim().min(1).max(360)
const shortList = (min: number, max: number) => z.array(shortText).min(min).max(max)

const GeneratedPresetQuestionSchema = z.object({
  question: shortText,
  response: paragraph,
  emotion: z.enum(['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealFactIds: z.array(id).max(2),
  followUp: shortText,
}).strip()

export const GeneratedCaseDraftSchema = z.object({
  metadata: z.object({
    title: z.string().trim().min(4).max(60),
    subtitle: shortText,
    summary: paragraph,
    location: shortText,
    incidentTime: shortText,
    objective: paragraph,
    missingItems: shortList(1, 3),
  }).strip(),
  culpritId: id,
  suspects: z.array(z.object({
    id,
    name: z.string().trim().min(2).max(40),
    occupation: shortText,
    age: z.number().int().min(18).max(75),
    pronouns: z.string().trim().min(1).max(8),
    personality: shortList(2, 4),
    publicInformation: shortList(3, 4),
    privateInformation: z.array(paragraph).min(1).max(4),
    knownFacts: z.array(paragraph).min(2).max(5),
    unknownFacts: shortList(1, 4),
    goal: paragraph,
    alibi: paragraph,
    relationshipWithOthers: z.record(id, shortText),
    speechStyle: shortList(2, 4),
    truthStrategy: shortList(3, 5),
    suspiciousPoint: shortText,
    openingLine: paragraph,
    presetQuestions: z.array(GeneratedPresetQuestionSchema).length(2),
  }).strip()).length(3),
  timeline: z.array(z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    description: shortText,
  }).strip()).min(4).max(6),
  facts: z.array(z.object({
    id,
    title: shortText,
    description: paragraph,
    npcId: id,
    category: z.enum(['timeline', 'access', 'motive', 'behavior', 'testimony']),
    revealConditions: paragraph,
    prerequisiteFactIds: z.array(id).max(3),
    requiredEvidenceIds: z.array(id).max(3),
  }).strip()).min(5).max(10),
  evidence: z.array(z.object({
    id,
    title: shortText,
    description: paragraph,
    category: z.enum(['physical', 'digital', 'testimony', 'document']),
    source: shortText,
    significance: paragraph,
    relatedNpcIds: z.array(id).min(1).max(3),
    isKey: z.boolean(),
    isInitial: z.boolean(),
    unlockRequirements: z.object({
      type: z.enum(['fact', 'contradiction']),
      ids: z.array(id).min(1).max(3),
    }).strip().optional(),
    presentationKeywords: z.array(z.string().trim().min(2).max(32)).min(2).max(4),
  }).strip()).min(5).max(8),
  contradictions: z.array(z.object({
    id,
    npcId: id,
    title: shortText,
    description: paragraph,
    requiredFactIds: z.array(id).min(1).max(3),
    requiredEvidenceIds: z.array(id).min(1).max(3),
    requiredPresentedEvidenceIds: z.array(id).min(1).max(2),
  }).strip()).min(2).max(5),
  resolution: z.object({
    culpritDescriptor: shortText,
    explanation: z.array(paragraph).min(2).max(3),
    confession: paragraph,
  }).strip(),
}).strip()

export type GeneratedCaseDraft = z.infer<typeof GeneratedCaseDraftSchema>

export interface DraftRepairIssue {
  path: string
  error: string
  message: string
  allowed?: string[]
  minimum?: number
  maximum?: number
}

export interface DraftNormalizationResult {
  candidate: unknown
  actions: string[]
}

const emotionAliases: Record<string, AgentEmotion> = {
  composed: 'calm', tense: 'nervous', anxious: 'nervous', guarded: 'defensive',
  defensive: 'defensive', evasive: 'evasive', upset: 'angry', hostile: 'angry',
}

const factCategoryAliases: Record<string, GeneratedCaseDraft['facts'][number]['category']> = {
  time: 'timeline', location: 'timeline', chronology: 'timeline', permission: 'access',
  security: 'access', financial: 'motive', finance: 'motive', conduct: 'behavior',
  action: 'behavior', statement: 'testimony', alibi: 'testimony',
}

const evidenceCategoryAliases: Record<string, EvidenceCategory> = {
  photo: 'digital', video: 'digital', log: 'digital', file: 'digital', device: 'digital',
  record: 'document', paperwork: 'document', witness: 'testimony', interview: 'testimony',
  object: 'physical', trace: 'physical', forensic: 'physical',
}

function cloneUnknown<T>(value: T): T {
  return structuredClone(value)
}

function trimStrings(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(trimStrings)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimStrings(item)]))
}

function objectAt(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : undefined
}

function arrayAt(value: unknown, key: string): unknown[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return Array.isArray(candidate) ? candidate : undefined
}

function cropNonCriticalEvidence(root: Record<string, unknown>, items: unknown[]) {
  if (items.length <= 8) return items
  const protectedIds = new Set<string>()
  for (const fact of arrayAt(root, 'facts') ?? []) {
    for (const evidenceId of arrayAt(fact, 'requiredEvidenceIds') ?? []) if (typeof evidenceId === 'string') protectedIds.add(evidenceId)
  }
  for (const contradiction of arrayAt(root, 'contradictions') ?? []) {
    for (const key of ['requiredEvidenceIds', 'requiredPresentedEvidenceIds']) {
      for (const evidenceId of arrayAt(contradiction, key) ?? []) if (typeof evidenceId === 'string') protectedIds.add(evidenceId)
    }
  }
  const protectedItems = items.filter((item) => {
    const value = objectAt({ item }, 'item')
    return value?.isKey === true || typeof value?.id === 'string' && protectedIds.has(value.id)
  })
  if (protectedItems.length > 8) return items
  const optional = items.filter((item) => !protectedItems.includes(item))
  return [...protectedItems, ...optional].slice(0, 8)
}

function cropUnreferencedFacts(root: Record<string, unknown>, facts: unknown[]) {
  if (facts.length <= 10) return facts
  const referenced = new Set<string>()
  for (const suspect of arrayAt(root, 'suspects') ?? []) {
    for (const preset of arrayAt(suspect, 'presetQuestions') ?? []) {
      for (const factId of arrayAt(preset, 'revealFactIds') ?? []) if (typeof factId === 'string') referenced.add(factId)
    }
  }
  for (const evidence of arrayAt(root, 'evidence') ?? []) {
    const requirement = objectAt(evidence, 'unlockRequirements')
    if (requirement?.type === 'fact') for (const factId of arrayAt(requirement, 'ids') ?? []) if (typeof factId === 'string') referenced.add(factId)
  }
  for (const contradiction of arrayAt(root, 'contradictions') ?? []) {
    for (const factId of arrayAt(contradiction, 'requiredFactIds') ?? []) if (typeof factId === 'string') referenced.add(factId)
  }
  const required = facts.filter((fact) => {
    const idValue = objectAt({ fact }, 'fact')?.id
    return typeof idValue === 'string' && referenced.has(idValue)
  })
  if (required.length > 10) return facts
  const optional = facts.filter((fact) => !required.includes(fact))
  return [...required, ...optional].slice(0, 10)
}

export function normalizeGeneratedCaseDraft(candidate: unknown) {
  const trimmed = trimStrings(cloneUnknown(candidate))
  if (!trimmed || typeof trimmed !== 'object' || Array.isArray(trimmed)) return trimmed
  const root = trimmed as Record<string, unknown>
  for (const suspect of arrayAt(root, 'suspects') ?? []) {
    for (const preset of arrayAt(suspect, 'presetQuestions') ?? []) {
      if (!preset || typeof preset !== 'object' || Array.isArray(preset)) continue
      const item = preset as Record<string, unknown>
      if (!Array.isArray(item.revealFactIds)) item.revealFactIds = []
      if (item.emotion == null) item.emotion = 'calm'
      if (typeof item.emotion === 'string') item.emotion = emotionAliases[item.emotion.toLowerCase()] ?? item.emotion.toLowerCase()
    }
  }
  const facts = arrayAt(root, 'facts')
  if (facts) {
    for (const fact of facts) {
      if (!fact || typeof fact !== 'object' || Array.isArray(fact)) continue
      const item = fact as Record<string, unknown>
      if (!Array.isArray(item.prerequisiteFactIds)) item.prerequisiteFactIds = []
      if (!Array.isArray(item.requiredEvidenceIds)) item.requiredEvidenceIds = []
      if (typeof item.category === 'string') item.category = factCategoryAliases[item.category.toLowerCase()] ?? item.category.toLowerCase()
    }
    root.facts = cropUnreferencedFacts(root, facts)
  }
  const evidence = arrayAt(root, 'evidence')
  if (evidence) {
    for (const evidenceItem of evidence) {
      if (!evidenceItem || typeof evidenceItem !== 'object' || Array.isArray(evidenceItem)) continue
      const item = evidenceItem as Record<string, unknown>
      if (typeof item.category === 'string') item.category = evidenceCategoryAliases[item.category.toLowerCase()] ?? item.category.toLowerCase()
    }
    root.evidence = cropNonCriticalEvidence(root, evidence)
  }
  return root
}

function countTrimmedStrings(before: unknown, after: unknown): number {
  if (typeof before === 'string' && typeof after === 'string') return before !== after && before.trim() === after ? 1 : 0
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.slice(0, after.length).reduce((total, item, index) => total + countTrimmedStrings(item, after[index]), 0)
  }
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    return Object.entries(after).reduce((total, [key, value]) => total + countTrimmedStrings((before as Record<string, unknown>)[key], value), 0)
  }
  return 0
}

export function normalizeGeneratedCaseDraftWithReport(candidate: unknown): DraftNormalizationResult {
  const normalized = normalizeGeneratedCaseDraft(candidate)
  const actions: string[] = []
  const before = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate as Record<string, unknown> : undefined
  const after = normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized as Record<string, unknown> : undefined
  if (!before || !after) return { candidate: normalized, actions }

  const trimmedStrings = countTrimmedStrings(before, after)
  let safeArraysDefaulted = 0
  let enumAliasesMapped = 0
  const beforeFacts = arrayAt(before, 'facts') ?? []
  const afterFacts = arrayAt(after, 'facts') ?? []
  beforeFacts.forEach((fact, index) => {
    const original = fact && typeof fact === 'object' ? fact as Record<string, unknown> : undefined
    const repaired = afterFacts[index] && typeof afterFacts[index] === 'object' ? afterFacts[index] as Record<string, unknown> : undefined
    if (!original || !repaired) return
    if (!Array.isArray(original.prerequisiteFactIds) && Array.isArray(repaired.prerequisiteFactIds)) safeArraysDefaulted += 1
    if (!Array.isArray(original.requiredEvidenceIds) && Array.isArray(repaired.requiredEvidenceIds)) safeArraysDefaulted += 1
    if (typeof original.category === 'string' && original.category.trim().toLowerCase() !== repaired.category) enumAliasesMapped += 1
  })
  const beforeSuspects = arrayAt(before, 'suspects') ?? []
  const afterSuspects = arrayAt(after, 'suspects') ?? []
  beforeSuspects.forEach((suspect, suspectIndex) => {
    const originalPresets = arrayAt(suspect, 'presetQuestions') ?? []
    const repairedPresets = arrayAt(afterSuspects[suspectIndex], 'presetQuestions') ?? []
    originalPresets.forEach((preset, presetIndex) => {
      const original = preset && typeof preset === 'object' ? preset as Record<string, unknown> : undefined
      const repaired = repairedPresets[presetIndex] && typeof repairedPresets[presetIndex] === 'object' ? repairedPresets[presetIndex] as Record<string, unknown> : undefined
      if (!original || !repaired) return
      if (!Array.isArray(original.revealFactIds) && Array.isArray(repaired.revealFactIds)) safeArraysDefaulted += 1
      if (original.emotion == null && repaired.emotion === 'calm') safeArraysDefaulted += 1
      else if (typeof original.emotion === 'string' && original.emotion.trim().toLowerCase() !== repaired.emotion) enumAliasesMapped += 1
    })
  })
  const beforeEvidence = arrayAt(before, 'evidence') ?? []
  const afterEvidence = arrayAt(after, 'evidence') ?? []
  beforeEvidence.slice(0, afterEvidence.length).forEach((evidence, index) => {
    const original = evidence && typeof evidence === 'object' ? evidence as Record<string, unknown> : undefined
    const repaired = afterEvidence[index] && typeof afterEvidence[index] === 'object' ? afterEvidence[index] as Record<string, unknown> : undefined
    if (original && repaired && typeof original.category === 'string' && original.category.trim().toLowerCase() !== repaired.category) enumAliasesMapped += 1
  })

  if (trimmedStrings) actions.push(`trim_strings:${trimmedStrings}`)
  if (safeArraysDefaulted) actions.push(`safe_array_defaults:${safeArraysDefaulted}`)
  if (enumAliasesMapped) actions.push(`enum_aliases:${enumAliasesMapped}`)
  if (beforeFacts.length > afterFacts.length) actions.push(`unreferenced_facts_trimmed:${beforeFacts.length - afterFacts.length}`)
  if (beforeEvidence.length > afterEvidence.length) actions.push(`noncritical_evidence_trimmed:${beforeEvidence.length - afterEvidence.length}`)
  return { candidate: normalized, actions }
}

function repairPath(path: PropertyKey[]) {
  return path.map((part, index) => typeof part === 'number' ? `[${part}]` : `${index ? '.' : ''}${String(part)}`).join('')
}

function allowedForPath(path: string) {
  if (path.endsWith('.emotion')) return ['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']
  if (/facts\[\d+\]\.category$/.test(path)) return ['timeline', 'access', 'motive', 'behavior', 'testimony']
  if (/evidence\[\d+\]\.category$/.test(path)) return ['physical', 'digital', 'testimony', 'document']
  return undefined
}

export function draftSchemaIssues(candidate: unknown): DraftRepairIssue[] {
  const parsed = GeneratedCaseDraftSchema.safeParse(candidate)
  if (parsed.success) return []
  return parsed.error.issues.map((issue) => {
    const path = repairPath(issue.path)
    const issueWithBounds = issue as typeof issue & { minimum?: number | bigint; maximum?: number | bigint }
    return {
      path,
      error: issue.code === 'invalid_value' ? 'INVALID_ENUM'
        : issue.code === 'too_big' ? 'MAX_ITEMS'
          : issue.code === 'too_small' ? 'MIN_ITEMS'
            : issue.code === 'invalid_type' ? 'MISSING_OR_INVALID_TYPE'
              : 'SCHEMA_INVALID',
      message: issue.message,
      allowed: allowedForPath(path),
      minimum: typeof issueWithBounds.minimum === 'number' ? issueWithBounds.minimum : undefined,
      maximum: typeof issueWithBounds.maximum === 'number' ? issueWithBounds.maximum : undefined,
    }
  })
}

const exampleFingerprint = /夜班样本失踪案|青岚检测中心|林舟|周岚|许澄/

const dataAssetPattern = /(?:数据|数据库|资料|信息|文件|档案|报告|客户(?:资料|名单|数据)?|源代码|代码|设计(?:图|文件)?|机密(?:资料|信息|文件)?)/
const dataTransferActionPattern = /(?:下载|导出|复制|拷贝|上传|外传|发送|转发|传输|同步|提取)/
const dataLeakOutcomePattern = /(?:数据|资料|信息|文件|档案|报告|客户(?:资料|名单|数据)?|源代码|代码).{0,12}(?:已|遭|被)?(?:泄露|外泄)/
const credentialAbusePattern = /(?:账号|凭据|密码).{0,24}(?:盗用|滥用|越权|未(?:经)?授权).{0,24}(?:登录|访问|读取|查看|下载|导出|提取)|(?:盗用|滥用|越权|未(?:经)?授权).{0,24}(?:账号|凭据|密码|系统|数据库).{0,24}(?:登录|访问|读取|查看|下载|导出|提取)/
const negatedDataActionPattern = /(?:没有|未曾|未发生|未进行|并无|不存在|未见|缺乏|尚无|无法证明).{0,18}(?:下载|导出|复制|拷贝|上传|外传|发送|转发|传输|同步|提取|泄露|外泄)/
const uncertainDataActionPattern = /(?:下载|导出|复制|拷贝|上传|外传|发送|转发|传输|同步|提取|泄露|外泄).{0,8}(?:风险|可能|隐患|嫌疑|迹象)/
const physicalTheftPattern = /(?:失窃|盗窃|被盗|偷走|窃取|失踪|丢失)/

function hasConcreteDataLeakAction(publicSemantics: string) {
  return publicSemantics
    .split(/[。！？；;\n]/)
    .map((item) => item.replace(/\s+/g, ''))
    .some((clause) => {
      if (!clause || negatedDataActionPattern.test(clause) || uncertainDataActionPattern.test(clause)) return false
      const hasDataTransfer = dataTransferActionPattern.test(clause) && dataAssetPattern.test(clause)
      const hasLeakOutcome = dataLeakOutcomePattern.test(clause)
      const hasCredentialAbuse = credentialAbusePattern.test(clause) && dataAssetPattern.test(publicSemantics)
      return hasDataTransfer || hasLeakOutcome || hasCredentialAbuse
    })
}

function addCrimeTypeSemanticIssues(issues: DraftRepairIssue[], message: string) {
  for (const path of ['metadata', 'timeline', 'facts', 'evidence']) {
    issues.push({ path, error: 'CRIME_TYPE_SEMANTIC_MISMATCH', message })
  }
}

export function draftGenerationQualityIssues(draft: GeneratedCaseDraft, options: GenerationOptions): DraftRepairIssue[] {
  const publicSemantics = [
    draft.metadata.title, draft.metadata.subtitle, draft.metadata.summary, draft.metadata.objective,
    ...draft.metadata.missingItems,
    ...draft.timeline.map((item) => item.description),
    ...draft.facts.flatMap((item) => [item.title, item.description, item.revealConditions]),
    ...draft.evidence.flatMap((item) => [item.title, item.description, item.source, item.significance, ...item.presentationKeywords]),
    ...draft.contradictions.flatMap((item) => [item.title, item.description]),
  ].join(' ')
  const fullDraft = JSON.stringify(draft)
  const issues: DraftRepairIssue[] = []
  if (exampleFingerprint.test(fullDraft)) {
    for (const path of ['metadata', 'suspects', 'timeline', 'facts', 'evidence', 'contradictions', 'resolution']) {
      issues.push({ path, error: 'EXAMPLE_REUSE', message: '候选案件复用了生成示例的标题、地点、人物或情节；保持现有 ID 与 culpritId 不变，改写为原创案件。' })
    }
  }
  if (options.caseType === 'data-leak') {
    if (!hasConcreteDataLeakAction(publicSemantics)) {
      const theftOnly = physicalTheftPattern.test(publicSemantics)
      addCrimeTypeSemanticIssues(
        issues,
        theftOnly
          ? 'Data Leak 案件不能只描述实体物品或纸质文件失窃；必须明确出现未经授权的数据复制、导出、访问、传输或外泄行为。'
          : 'Data Leak 案件必须明确出现未经授权的数据复制、导出、访问、传输或外泄行为；仅有机密资料、档案或泄密风险不足以成立。',
      )
    }
    return issues
  }

  const semanticRules: Partial<Record<GenerationOptions['caseType'], RegExp[]>> = {
    theft: [/(?:失窃|盗窃|被盗|偷走|窃取|失踪|丢失)/],
    'data-leak': [/(?:数据|资料|文件|代码|源码|数据库|客户名单|机密)/, /(?:泄露|外传|导出|下载|拷贝|复制|窃取|未授权|发送)/],
    fraud: [/(?:欺诈|伪造|虚报|骗取|假账|报销|款项)/],
    'item-swap': [/(?:调包|替换|赝品|复制品|掉包)/],
  }
  const rules = options.caseType === 'random' ? [] : semanticRules[options.caseType] ?? []
  if (rules.some((rule) => !rule.test(publicSemantics))) {
    for (const path of ['metadata', 'facts', 'evidence', 'contradictions']) {
      issues.push({ path, error: 'CRIME_TYPE_SEMANTIC_MISMATCH', message: `案件公开情节与请求的 ${options.caseType} 类型不一致；保持合法 ID 和 culpritId 不变，只修复核心事件与证据链语义。` })
    }
  }
  return issues
}

function initials(name: string) {
  return name.replace(/\s+/g, '').slice(0, 2).toUpperCase()
}

export function compileGeneratedCaseDraft(draft: GeneratedCaseDraft, options: GenerationOptions): CaseDefinition {
  const hash = createHash('sha256').update(JSON.stringify(draft)).digest('hex').slice(0, 10)
  const randomTypes = ['theft', 'data-leak', 'fraud', 'item-swap'] as const
  const crimeType = options.caseType === 'random'
    ? randomTypes[Number.parseInt(hash.slice(0, 2), 16) % randomTypes.length]
    : options.caseType
  const accents = ['#b58b4c', '#75869a', '#8f6f62']
  const evidenceForCulprit = draft.evidence
    .filter((item) => item.relatedNpcIds.includes(draft.culpritId))
    .sort((left, right) => Number(right.isKey) - Number(left.isKey))
    .map((item) => item.id)
    .slice(0, 6)
  return {
    metadata: {
      mode: 'dynamic',
      caseId: `dynamic_${hash}`,
      caseNumber: `DYN-${hash.slice(0, 8).toUpperCase()}`,
      crimeType,
      difficulty: options.difficulty,
      estimatedMinutes: 15,
      ...draft.metadata,
    },
    culpritId: draft.culpritId,
    suspects: draft.suspects.map((suspect, suspectIndex) => ({
      ...suspect,
      privateInformation: suspect.privateInformation.map((statement, index) => ({ id: `${suspect.id}_private_${index + 1}`, statement })),
      knownFacts: suspect.knownFacts.map((statement, index) => ({ id: `${suspect.id}_known_${index + 1}`, statement })),
      status: '待审讯',
      accent: accents[suspectIndex],
      initials: initials(suspect.name),
      presetQuestions: suspect.presetQuestions.map((question, index) => ({ id: `${suspect.id}_question_${index + 1}`, ...question })),
      isCulprit: suspect.id === draft.culpritId,
    })),
    timeline: [...draft.timeline].sort((left, right) => left.time.localeCompare(right.time)),
    facts: draft.facts.map((fact) => ({ ...fact, scoreValue: 3 })),
    evidence: draft.evidence.map((evidence) => ({
      ...evidence,
      reactionGuidance: Object.fromEntries(draft.suspects.map((suspect) => [
        suspect.id,
        `面对“${evidence.title}”时只依据自身已知事实回应，不得编造或获知他人的秘密。`,
      ])),
    })),
    contradictions: draft.contradictions.map((contradiction) => ({ ...contradiction, scoreValue: 6 })),
    scoringConfig: {
      keyEvidenceIds: draft.evidence.filter((item) => item.isKey).map((item) => item.id),
      importantFactIds: draft.facts.map((item) => item.id),
      culpritEvidenceIds: evidenceForCulprit,
      minimumCulpritEvidence: 2,
    },
    resolution: draft.resolution,
  }
}

export function caseDefinitionToGeneratedDraft(definition: CaseDefinition): GeneratedCaseDraft {
  return GeneratedCaseDraftSchema.parse({
    metadata: definition.metadata,
    culpritId: definition.culpritId,
    suspects: definition.suspects.map((suspect) => ({
      ...suspect,
      personality: suspect.personality.slice(0, 4),
      publicInformation: suspect.publicInformation.slice(0, 4),
      privateInformation: suspect.privateInformation.slice(0, 4).map((item) => item.statement),
      knownFacts: suspect.knownFacts.slice(0, 5).map((item) => item.statement),
      unknownFacts: suspect.unknownFacts.slice(0, 4),
      speechStyle: suspect.speechStyle.slice(0, 4),
      truthStrategy: suspect.truthStrategy.slice(0, 5),
      presetQuestions: suspect.presetQuestions.slice(0, 2).map(({ id: _id, ...question }) => ({
        ...question,
        revealFactIds: question.revealFactIds.slice(0, 2),
      })),
    })),
    timeline: definition.timeline.slice(0, 6),
    facts: definition.facts.slice(0, 10).map(({ scoreValue: _scoreValue, ...fact }) => ({
      ...fact,
      prerequisiteFactIds: fact.prerequisiteFactIds.slice(0, 3),
      requiredEvidenceIds: fact.requiredEvidenceIds.slice(0, 3),
    })),
    evidence: definition.evidence.slice(0, 8).map(({ reactionGuidance: _reactionGuidance, ...evidence }) => ({
      ...evidence,
      presentationKeywords: evidence.presentationKeywords.slice(0, 4),
      unlockRequirements: evidence.unlockRequirements ? {
        ...evidence.unlockRequirements,
        ids: evidence.unlockRequirements.ids.slice(0, 3),
      } : undefined,
    })),
    contradictions: definition.contradictions.slice(0, 5).map(({ scoreValue: _scoreValue, ...contradiction }) => ({
      ...contradiction,
      requiredFactIds: contradiction.requiredFactIds.slice(0, 3),
      requiredEvidenceIds: contradiction.requiredEvidenceIds.slice(0, 3),
      requiredPresentedEvidenceIds: contradiction.requiredPresentedEvidenceIds.slice(0, 2),
    })),
    resolution: definition.resolution,
  })
}
