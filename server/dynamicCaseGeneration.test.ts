import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  caseDefinitionToGeneratedDraft,
  compileGeneratedCaseDraft,
  draftGenerationQualityIssues,
  draftSchemaIssues,
  GeneratedCaseDraftSchema,
  normalizeGeneratedCaseDraft,
} from './dynamicCases/generatedCaseDraft'
import {
  applyTargetedRepairs,
  generateValidatedCase,
  parseGeneratedCaseJson,
  type CaseTextGenerator,
  type GenerationAttemptTrace,
} from './dynamicCases/generator'
import { createValidDynamicCaseFixture } from './dynamicCases/fixtures'
import { DynamicCaseSessionStore } from './dynamicCases/sessionStore'
import { validateCaseDefinition } from './dynamicCases/validator'

function validDraft() {
  return caseDefinitionToGeneratedDraft(createValidDynamicCaseFixture())
}

function withPublicCaseSemantics(text: string) {
  const draft = validDraft()
  draft.metadata.title = text.slice(0, 60)
  draft.metadata.subtitle = text.slice(0, 160)
  draft.metadata.summary = text
  draft.metadata.objective = text
  draft.metadata.missingItems = [text.slice(0, 160)]
  draft.timeline = draft.timeline.map((item) => ({ ...item, description: text.slice(0, 160) }))
  draft.facts = draft.facts.map((item) => ({ ...item, title: text.slice(0, 160), description: text, revealConditions: text }))
  draft.evidence = draft.evidence.map((item) => ({
    ...item,
    title: text.slice(0, 160),
    description: text,
    source: text.slice(0, 160),
    significance: text,
    presentationKeywords: ['证据', '记录'],
  }))
  draft.contradictions = draft.contradictions.map((item) => ({ ...item, title: text.slice(0, 160), description: text }))
  return draft
}

function hasDataLeakSemanticMismatch(text: string) {
  return draftGenerationQualityIssues(withPublicCaseSemantics(text), { caseType: 'data-leak', difficulty: 'normal' })
    .some((issue) => issue.error === 'CRIME_TYPE_SEMANTIC_MISMATCH')
}

test('incomplete JSON is classified as truncation instead of a generic schema failure', () => {
  assert.deepEqual(parseGeneratedCaseJson('{"metadata":{"title":"unfinished"'), { ok: false, reason: 'TRUNCATED_JSON' })
  assert.deepEqual(parseGeneratedCaseJson('{"ok":true}', 'length'), { ok: false, reason: 'TRUNCATED_JSON' })
})

test('missing optional-safe arrays are normalized without inventing story facts', () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  const facts = draft.facts as Array<Record<string, unknown>>
  const presets = (draft.suspects as Array<Record<string, unknown>>)[0].presetQuestions as Array<Record<string, unknown>>
  delete facts[0].prerequisiteFactIds
  delete facts[0].requiredEvidenceIds
  delete presets[0].revealFactIds
  const normalized = normalizeGeneratedCaseDraft(draft) as typeof draft
  assert.deepEqual((normalized.facts as Array<Record<string, unknown>>)[0].prerequisiteFactIds, [])
  assert.deepEqual((normalized.facts as Array<Record<string, unknown>>)[0].requiredEvidenceIds, [])
  assert.deepEqual((((normalized.suspects as Array<Record<string, unknown>>)[0].presetQuestions as Array<Record<string, unknown>>)[0]).revealFactIds, [])
})

test('known enum aliases are normalized to the compact contract', () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  const fact = (draft.facts as Array<Record<string, unknown>>)[0]
  const evidence = (draft.evidence as Array<Record<string, unknown>>)[0]
  const preset = ((draft.suspects as Array<Record<string, unknown>>)[0].presetQuestions as Array<Record<string, unknown>>)[0]
  fact.category = 'statement'
  evidence.category = 'photo'
  preset.emotion = 'anxious'
  const normalized = normalizeGeneratedCaseDraft(draft) as typeof draft
  assert.equal((normalized.facts as Array<Record<string, unknown>>)[0].category, 'testimony')
  assert.equal((normalized.evidence as Array<Record<string, unknown>>)[0].category, 'digital')
  assert.equal((((normalized.suspects as Array<Record<string, unknown>>)[0].presetQuestions as Array<Record<string, unknown>>)[0]).emotion, 'nervous')
})

test('unknown enum values require targeted repair', () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  ;(draft.facts as Array<Record<string, unknown>>)[0].category = 'psychological_profile'
  const normalized = normalizeGeneratedCaseDraft(draft)
  const issue = draftSchemaIssues(normalized).find((item) => item.path === 'facts[0].category')
  assert.equal(issue?.error, 'INVALID_ENUM')
  assert.deepEqual(issue?.allowed, ['timeline', 'access', 'motive', 'behavior', 'testimony'])
})

test('more than eight evidence items deterministically drops only unreferenced non-key overflow', () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  const evidence = draft.evidence as Array<Record<string, unknown>>
  while (evidence.length < 10) {
    const clone = structuredClone(evidence.find((item) => item.isKey === false) ?? evidence[0])
    clone.id = `extra_evidence_${evidence.length}`
    clone.isKey = false
    evidence.push(clone)
  }
  const normalized = normalizeGeneratedCaseDraft(draft) as typeof draft
  const normalizedEvidence = normalized.evidence as Array<Record<string, unknown>>
  assert.equal(normalizedEvidence.length, 8)
  assert.ok(evidence.filter((item) => item.isKey).every((item) => normalizedEvidence.some((candidate) => candidate.id === item.id)))
})

test('missing critical fields remain repair issues', () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  delete draft.culpritId
  assert.ok(draftSchemaIssues(normalizeGeneratedCaseDraft(draft)).some((item) => item.path === 'culpritId'))
})

test('targeted repair cannot change a valid culpritId', () => {
  const draft = validDraft()
  const result = applyTargetedRepairs(draft, { repairs: [{ path: 'culpritId', value: 'jack' }] }, [{ path: 'facts[0].category', error: 'INVALID_ENUM', message: 'invalid' }])
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'REPAIR_PATH_NOT_ALLOWED')
  assert.equal((result.candidate as typeof draft).culpritId, draft.culpritId)
})

test('targeted repair cannot modify valid IDs through an unrelated repair', () => {
  const draft = validDraft()
  const originalId = draft.facts[0].id
  const result = applyTargetedRepairs(draft, { repairs: [{ path: 'facts[0].id', value: 'changed_fact_id' }] }, [{ path: 'facts[0].category', error: 'INVALID_ENUM', message: 'invalid' }])
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'REPAIR_PATH_NOT_ALLOWED')
  assert.equal((result.candidate as typeof draft).facts[0].id, originalId)
})

test('a successful compact draft compiles into deterministic runtime fields', () => {
  const draft = GeneratedCaseDraftSchema.parse(validDraft())
  const compiled = compileGeneratedCaseDraft(draft, { caseType: 'item-swap', difficulty: 'normal' })
  assert.match(compiled.metadata.caseId, /^dynamic_[a-f0-9]{10}$/)
  assert.equal(compiled.metadata.mode, 'dynamic')
  assert.equal(compiled.suspects.filter((item) => item.isCulprit).length, 1)
  assert.ok(compiled.evidence.every((item) => Object.keys(item.reactionGuidance).length === 3))
  assert.ok(compiled.facts.every((item) => item.scoreValue === 3))
})

test('compiled CaseDefinition passes full Validator and Solvability checks', () => {
  const compiled = compileGeneratedCaseDraft(validDraft(), { caseType: 'item-swap', difficulty: 'normal' })
  const validation = validateCaseDefinition(compiled)
  assert.equal(validation.valid, true)
  assert.equal(validation.solvability.valid, true)
})

test('targeted repair preserves valid culprit and IDs while fixing an enum', async () => {
  const draft = validDraft() as unknown as Record<string, unknown>
  const originalCulprit = draft.culpritId
  const originalFactId = (draft.facts as Array<Record<string, unknown>>)[0].id
  ;(draft.facts as Array<Record<string, unknown>>)[0].category = 'mystery'
  let calls = 0
  const generator: CaseTextGenerator = {
    generate: async () => {
      calls += 1
      return calls === 1
        ? JSON.stringify(draft)
        : JSON.stringify({ repairs: [{ path: 'facts[0].category', value: 'testimony' }] })
    },
  }
  const session = await generateValidatedCase({ caseType: 'item-swap', difficulty: 'normal' }, { generator, store: new DynamicCaseSessionStore() })
  assert.equal(calls, 2)
  assert.equal(session.caseDefinition.culpritId, originalCulprit)
  assert.equal(session.caseDefinition.facts[0].id, originalFactId)
})

test('generation still terminates after three invalid draft or repair attempts', async () => {
  let calls = 0
  const generator: CaseTextGenerator = { generate: async () => { calls += 1; return '{"metadata":' } }
  await assert.rejects(() => generateValidatedCase({ caseType: 'theft', difficulty: 'normal' }, { generator, store: new DynamicCaseSessionStore() }))
  assert.equal(calls, 3)
})

test('provider truncation consumes one attempt and the next attempt can still succeed', async () => {
  const traces: GenerationAttemptTrace[] = []
  const draft = validDraft()
  let calls = 0
  const generator: CaseTextGenerator = {
    generate: async () => {
      calls += 1
      return calls === 1
        ? { text: '{"metadata":', finishReason: 'length' }
        : { text: JSON.stringify(draft), finishReason: 'stop' }
    },
  }
  const session = await generateValidatedCase(
    { caseType: 'item-swap', difficulty: 'normal' },
    { generator, store: new DynamicCaseSessionStore(), attemptObserver: (trace) => traces.push(trace) },
  )
  assert.equal(session.generationAttempts, 2)
  assert.equal(traces[0].truncation, true)
  assert.equal(traces[1].caseValidator, 'PASS')
})

test('Classic Case still passes the unchanged full validator', () => {
  const classic = createValidDynamicCaseFixture()
  classic.metadata.mode = 'classic'
  const validation = validateCaseDefinition(classic)
  assert.equal(validation.valid, true)
  assert.equal(validation.solvability.valid, true)
})

test('data-leak generation rejects copied theft example semantics before compilation', () => {
  const draft = validDraft()
  draft.metadata.title = '夜班样本失踪案'
  draft.metadata.location = '青岚检测中心'
  draft.metadata.summary = '一份测试样本在交接期间失踪。'
  const issues = draftGenerationQualityIssues(draft, { caseType: 'data-leak', difficulty: 'normal' })
  assert.ok(issues.some((issue) => issue.error === 'EXAMPLE_REUSE'))
  assert.ok(issues.some((issue) => issue.error === 'CRIME_TYPE_SEMANTIC_MISMATCH'))
})

test('Data Leak rejects a confidential document stolen from an archive without a data action', () => {
  assert.equal(hasDataLeakSemanticMismatch('机密文件从档案室被偷走。'), true)
})

test('Data Leak rejects a stolen USB when there is no copy or transmission evidence', () => {
  assert.equal(hasDataLeakSemanticMismatch('装有内部资料的 USB 失窃，但没有复制或外传证据。'), true)
})

test('Data Leak accepts an account downloading a customer database and uploading it to an external drive', () => {
  assert.equal(hasDataLeakSemanticMismatch('员工账号在深夜下载客户数据库，并上传至外部网盘。'), false)
})

test('Data Leak accepts unauthorized account access followed by customer-data access', () => {
  assert.equal(hasDataLeakSemanticMismatch('有人盗用员工账号，未经授权访问并读取客户数据。'), false)
})

test('Data Leak accepts confidential design files copied to a USB drive', () => {
  assert.equal(hasDataLeakSemanticMismatch('机密设计文件被复制到 USB。'), false)
})

test('Data Leak accepts an internal report sent to a personal email address', () => {
  assert.equal(hasDataLeakSemanticMismatch('内部报告被发送到私人邮箱。'), false)
})

test('Data Leak accepts a physical theft when a scanned copy was also sent outside', () => {
  assert.equal(hasDataLeakSemanticMismatch('纸质文件被偷走，同时扫描副本已发送到外部邮箱。'), false)
})

test('Theft continues to accept a physical confidential-file theft case', () => {
  const issues = draftGenerationQualityIssues(withPublicCaseSemantics('机密文件从档案室被偷走。'), { caseType: 'theft', difficulty: 'normal' })
  assert.equal(issues.some((issue) => issue.error === 'CRIME_TYPE_SEMANTIC_MISMATCH'), false)
})
