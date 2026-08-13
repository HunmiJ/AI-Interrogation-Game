import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from './app'
import { createValidDynamicCaseFixture } from './dynamicCases/fixtures'
import { caseDefinitionToGeneratedDraft } from './dynamicCases/generatedCaseDraft'
import { generateValidatedCase, type CaseTextGenerator } from './dynamicCases/generator'
import { toPublicCaseDefinition } from './dynamicCases/publicCase'
import { validateDynamicInvestigationTurn } from './dynamicCases/runtime'
import { DynamicCaseSessionStore } from './dynamicCases/sessionStore'
import { checkCaseSolvability } from './dynamicCases/solvability'
import { validateCaseDefinition } from './dynamicCases/validator'
import { resolveDynamicCase } from './dynamicCases/dynamicResolution'
import type { CaseDefinition } from './dynamicCases/types'

function mutation(change: (value: CaseDefinition) => void) {
  const value = createValidDynamicCaseFixture()
  change(value)
  return value
}

test('valid generated CaseDefinition passes structure, quality and solvability validation', () => {
  const result = validateCaseDefinition(createValidDynamicCaseFixture())
  assert.equal(result.valid, true)
  assert.equal(result.solvability.valid, true)
})

test('missing culpritId fails validation', () => {
  const result = validateCaseDefinition(mutation((value) => { value.culpritId = 'missing_suspect' }))
  assert.ok(result.issues.some((item) => item.code === 'CULPRIT_NOT_FOUND'))
})

test('multiple culprits fail validation', () => {
  const result = validateCaseDefinition(mutation((value) => { value.suspects[0].isCulprit = true }))
  assert.ok(result.issues.some((item) => item.code === 'CULPRIT_COUNT_INVALID'))
})

test('duplicate IDs fail validation', () => {
  const result = validateCaseDefinition(mutation((value) => { value.evidence[0].id = value.facts[0].id }))
  assert.ok(result.issues.some((item) => item.code === 'DUPLICATE_ID'))
})

test('missing Fact references fail validation', () => {
  const result = validateCaseDefinition(mutation((value) => { value.facts[0].prerequisiteFactIds = ['not_a_fact'] }))
  assert.ok(result.issues.some((item) => item.code === 'FACT_REFERENCE_MISSING'))
})

test('missing Evidence references fail validation', () => {
  const result = validateCaseDefinition(mutation((value) => { value.facts[0].requiredEvidenceIds = ['not_evidence'] }))
  assert.ok(result.issues.some((item) => item.code === 'FACT_EVIDENCE_MISSING'))
})

test('missing Contradiction references fail validation', () => {
  const target = mutation((value) => {
    const evidence = value.evidence.find((item) => !item.isInitial)!
    evidence.unlockRequirements = { type: 'contradiction', ids: ['not_contradiction'] }
  })
  assert.ok(validateCaseDefinition(target).issues.some((item) => item.code === 'EVIDENCE_REFERENCE_MISSING'))
})

test('dependency cycles fail solvability validation', () => {
  const target = mutation((value) => {
    const fact = value.facts.find((item) => item.id === 'jack_stayed_after_event')!
    fact.requiredEvidenceIds = ['camera-metadata']
  })
  const result = validateCaseDefinition(target)
  assert.ok(result.issues.some((item) => item.code === 'DEPENDENCY_CYCLE'))
})

test('unreachable Evidence fails validation', () => {
  const target = mutation((value) => {
    const evidence = value.evidence.find((item) => item.id === 'camera-metadata')!
    evidence.unlockRequirements = { type: 'fact', ids: ['alice_left_before_crime'] }
    value.facts.find((item) => item.id === 'alice_left_before_crime')!.requiredEvidenceIds = ['camera-metadata']
  })
  assert.ok(validateCaseDefinition(target).issues.some((item) => item.code === 'UNREACHABLE_EVIDENCE'))
})

test('unreachable Contradiction fails validation', () => {
  const target = mutation((value) => { value.contradictions[0].requiredFactIds = ['alice_left_before_crime']; value.facts.find((item) => item.id === 'alice_left_before_crime')!.requiredEvidenceIds = ['camera-metadata']; value.evidence.find((item) => item.id === 'camera-metadata')!.unlockRequirements = { type: 'contradiction', ids: [value.contradictions[0].id] } })
  assert.ok(validateCaseDefinition(target).issues.some((item) => item.code === 'UNREACHABLE_CONTRADICTION'))
})

test('unreachable culprit evidence chain fails validation', () => {
  const target = mutation((value) => {
    value.culpritId = 'alice'
    value.suspects.forEach((item) => { item.isCulprit = item.id === 'alice' })
  })
  assert.ok(validateCaseDefinition(target).issues.some((item) => item.code === 'CULPRIT_CHAIN_INCOMPLETE'))
})

test('generator retries no more than three attempts and invalid cases never enter session store', async () => {
  let calls = 0
  const invalidGenerator: CaseTextGenerator = { generate: async () => { calls += 1; return '{}' } }
  const store = new DynamicCaseSessionStore()
  await assert.rejects(() => generateValidatedCase({ caseType: 'theft', difficulty: 'normal' }, { generator: invalidGenerator, store }), /本次案件生成失败/)
  assert.equal(calls, 3)
  assert.equal(store.size, 0)
})

test('classic case adapts to the shared CaseDefinition without regression', () => {
  const classic = createValidDynamicCaseFixture()
  classic.metadata.mode = 'classic'
  assert.equal(validateCaseDefinition(classic).valid, true)
})

test('API permits only one case generation at a time', async () => {
  const fixture = createValidDynamicCaseFixture()
  const store = new DynamicCaseSessionStore()
  const session = store.create({ caseDefinition: fixture, validation: validateCaseDefinition(fixture), generationAttempts: 1, retryCount: 0, options: { caseType: 'item-swap', difficulty: 'normal' } })
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { release = resolve })
  const app = createApp({ generateCase: async () => { await gate; return session } })
  const first = request(app).post('/api/cases/generate').send({ caseType: 'item-swap', difficulty: 'normal' }).then((response) => response)
  await new Promise((resolve) => setTimeout(resolve, 5))
  const second = await request(app).post('/api/cases/generate').send({ caseType: 'item-swap', difficulty: 'normal' })
  assert.equal(second.status, 409)
  assert.equal(second.body.error.code, 'GENERATION_BUSY')
  release?.()
  assert.equal((await first).status, 200)
})

test('retry feedback can produce a validated session before the third attempt', async () => {
  let calls = 0
  const draft = caseDefinitionToGeneratedDraft(createValidDynamicCaseFixture())
  const candidate = structuredClone(draft) as unknown as Record<string, unknown>
  ;(candidate.facts as Array<Record<string, unknown>>)[0].category = 'unsupported-category'
  const generator: CaseTextGenerator = {
    generate: async () => {
      calls += 1
      return calls === 1
        ? JSON.stringify(candidate)
        : JSON.stringify({ repairs: [{ path: 'facts[0].category', value: draft.facts[0].category }] })
    },
  }
  const session = await generateValidatedCase({ caseType: 'item-swap', difficulty: 'normal' }, { generator, store: new DynamicCaseSessionStore() })
  assert.equal(session.generationAttempts, 2)
  assert.equal(session.retryCount, 1)
  assert.equal(session.validation.valid, true)
})

test('public dynamic case excludes culpritId, private profiles and hidden solution nodes', () => {
  const publicCase = toPublicCaseDefinition(createValidDynamicCaseFixture()) as Record<string, unknown>
  const serialized = JSON.stringify(publicCase)
  assert.equal('culpritId' in publicCase, false)
  assert.doesNotMatch(serialized, /privateInformation|truthStrategy|confession|tom_theft/)
  assert.equal((publicCase.facts as unknown[]).length, 0)
})

test('validated dynamic case enters existing API game flow and keeps NPC histories isolated', async () => {
  const fixture = createValidDynamicCaseFixture()
  const store = new DynamicCaseSessionStore()
  const session = store.create({ caseDefinition: fixture, validation: validateCaseDefinition(fixture), generationAttempts: 1, retryCount: 0, options: { caseType: 'item-swap', difficulty: 'normal' } })
  const app = createApp({
    generateCase: async () => session,
    interrogate: async (input) => ({ reply: `${input.npcId}:${input.conversationHistory.map((turn) => turn.content).join('|')}`, emotion: 'calm', revealedFactIds: [], contradictionIds: [], unlockedEvidenceIds: [], presentedEvidenceIds: [] }),
  })
  const generated = await request(app).post('/api/cases/generate').send({ caseType: 'item-swap', difficulty: 'normal' })
  assert.equal(generated.status, 200)
  assert.equal(generated.body.generation.validationPassed, true)
  const jack = await request(app).post('/api/interrogate').send({ caseSessionId: session.sessionId, npcId: 'jack', message: '问题', conversationHistory: [{ role: 'assistant', content: 'jack-memory' }], discoveredEvidenceIds: [], discoveredFactIds: [], discoveredContradictionIds: [] })
  const alice = await request(app).post('/api/interrogate').send({ caseSessionId: session.sessionId, npcId: 'alice', message: '问题', conversationHistory: [{ role: 'assistant', content: 'alice-memory' }], discoveredEvidenceIds: [], discoveredFactIds: [], discoveredContradictionIds: [] })
  assert.equal(jack.body.reply, 'jack:jack-memory')
  assert.equal(alice.body.reply, 'alice:alice-memory')
})

test('dynamic Fact Discovery unlocks Evidence without same-turn Contradiction cascade', () => {
  const fixture = createValidDynamicCaseFixture()
  const result = validateDynamicInvestigationTurn({ npcId: 'tom', message: '你在做什么？', conversationHistory: [], discoveredEvidenceIds: ['rear-door-scratches', 'alarm-log'], discoveredFactIds: [], discoveredContradictionIds: [] }, ['tom_claimed_supplier_call'], [], fixture)
  assert.deepEqual(result.acceptedFactIds, ['tom_claimed_supplier_call'])
  assert.ok(result.unlockedEvidenceIds.includes('supplier-call-record'))
  assert.deepEqual(result.contradictionIds, [])
})

test('dynamic Contradiction requires already discovered player-presented Evidence', () => {
  const fixture = createValidDynamicCaseFixture()
  const result = validateDynamicInvestigationTurn({ npcId: 'tom', message: '运营商记录和通话详单证明没有电话，你怎么解释？', conversationHistory: [], discoveredEvidenceIds: ['supplier-call-record'], discoveredFactIds: ['tom_claimed_supplier_call'], discoveredContradictionIds: [] }, [], [], fixture)
  assert.deepEqual(result.contradictionIds, ['tom_supplier_call_conflict'])
})

test('dynamic deterministic scoring rewards complete investigation and remains bounded', () => {
  const fixture = createValidDynamicCaseFixture()
  const solvability = checkCaseSolvability(fixture)
  const result = resolveDynamicCase(fixture, { accusedNpcId: fixture.culpritId, discoveredEvidenceIds: solvability.reachableEvidenceIds, discoveredFactIds: solvability.reachableFactIds, discoveredContradictionIds: solvability.reachableContradictionIds, questionCount: 12, interrogatedNpcIds: fixture.suspects.map((item) => item.id) })
  assert.equal(result.correct, true)
  assert.ok(result.score.total >= 90 && result.score.total <= 100)
})

test('dynamic result key evidence count is a scoring subset, not the full notebook evidence count', () => {
  const fixture = createValidDynamicCaseFixture()
  const solvability = checkCaseSolvability(fixture)
  const result = resolveDynamicCase(fixture, {
    accusedNpcId: fixture.culpritId,
    discoveredEvidenceIds: solvability.reachableEvidenceIds,
    discoveredFactIds: solvability.reachableFactIds,
    discoveredContradictionIds: solvability.reachableContradictionIds,
    questionCount: 12,
    interrogatedNpcIds: fixture.suspects.map((item) => item.id),
  })
  assert.equal(solvability.reachableEvidenceIds.length, fixture.evidence.length)
  assert.equal(result.score.keyEvidenceCount, fixture.scoringConfig.keyEvidenceIds.length)
  assert.ok(result.score.keyEvidenceCount < solvability.reachableEvidenceIds.length)
})

test('dynamic result content is sourced from the current case rather than Classic Case data', () => {
  const fixture = createValidDynamicCaseFixture()
  fixture.suspects = fixture.suspects.map((suspect) => ({
    ...suspect,
    name: suspect.id === fixture.culpritId ? '林薇' : suspect.id === 'jack' ? '陈默' : '赵晴',
  }))
  fixture.resolution = {
    culpritDescriptor: '拥有会议纪要权限的人',
    explanation: ['邮件访问记录与口供指向当前动态案件的负责人。', '外发操作发生在明确的时间窗口内。'],
    confession: '我承认把会议纪要发送到了私人邮箱。',
  }
  const result = resolveDynamicCase(fixture, {
    accusedNpcId: fixture.culpritId,
    discoveredEvidenceIds: fixture.evidence.filter((item) => item.isInitial).map((item) => item.id),
    discoveredFactIds: [], discoveredContradictionIds: [], questionCount: 1, interrogatedNpcIds: fixture.suspects.map((item) => item.id),
  })
  assert.equal(result.culprit.name, '林薇')
  assert.deepEqual(result.explanation, fixture.resolution.explanation)
  assert.equal(result.confession, fixture.resolution.confession)
  assert.doesNotMatch(JSON.stringify(result), /Jack|Alice|Tom/)
})

test('new dynamic sessions keep investigation progress isolated from older sessions', () => {
  const fixture = createValidDynamicCaseFixture()
  const validation = validateCaseDefinition(fixture)
  const store = new DynamicCaseSessionStore()
  const first = store.create({ caseDefinition: fixture, validation, generationAttempts: 1, retryCount: 0, options: { caseType: 'item-swap', difficulty: 'normal' } })
  store.applyInvestigationUpdate(first.sessionId, {
    revealedFactIds: ['jack_stayed_after_event'], unlockedEvidenceIds: ['camera-metadata'], contradictionIds: [], presentedEvidenceIds: [],
  })
  const second = store.create({ caseDefinition: structuredClone(fixture), validation, generationAttempts: 1, retryCount: 0, options: { caseType: 'item-swap', difficulty: 'normal' } })
  assert.deepEqual(store.get(first.sessionId)?.progress.confirmedFactIds, ['jack_stayed_after_event'])
  assert.deepEqual(store.get(second.sessionId)?.progress.confirmedFactIds, [])
  assert.ok(!store.get(second.sessionId)?.progress.discoveredEvidenceIds.includes('camera-metadata'))
})
