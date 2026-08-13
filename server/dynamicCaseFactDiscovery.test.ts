import assert from 'node:assert/strict'
import { test } from 'node:test'
import { interrogateDynamicNpc } from './dynamicCases/dynamicInterrogation'
import { extractDynamicSemanticFactCandidates } from './dynamicCases/dynamicFactCandidates'
import { buildDynamicNpcPrompt } from './dynamicCases/dynamicPrompt'
import { createValidDynamicCaseFixture } from './dynamicCases/fixtures'
import { DynamicCaseSessionStore } from './dynamicCases/sessionStore'
import { validateCaseDefinition } from './dynamicCases/validator'
import { applySessionUpdate, createInvestigationSession } from '../src/utils/gameSession'
import type { InterrogateInput, InterrogateResult } from './types/agent'
import type { CaseDefinition } from './dynamicCases/types'

const npcIdMap: Record<string, string> = { jack: 'chen-mo', alice: 'lin-wei', tom: 'zhao-qing' }

function morningMinutesFixture(): CaseDefinition {
  const fixture = structuredClone(createValidDynamicCaseFixture())
  const factIdMap = new Map(fixture.facts.map((fact, index) => [fact.id, `generated_fact_${index + 1}`]))
  const evidenceIdMap = new Map(fixture.evidence.map((evidence, index) => [evidence.id, `generated_evidence_${index + 1}`]))
  const contradictionIdMap = new Map(fixture.contradictions.map((item, index) => [item.id, `generated_conflict_${index + 1}`]))
  fixture.metadata.caseId = 'morning_minutes_leak_fixture'
  fixture.metadata.title = '晨会纪要外泄案'
  fixture.metadata.crimeType = 'data-leak'
  fixture.culpritId = npcIdMap[fixture.culpritId]
  fixture.suspects = fixture.suspects.map((suspect) => ({
    ...suspect,
    id: npcIdMap[suspect.id],
    isCulprit: npcIdMap[suspect.id] === fixture.culpritId,
    relationshipWithOthers: Object.fromEntries(Object.entries(suspect.relationshipWithOthers).map(([id, value]) => [npcIdMap[id], value])),
    presetQuestions: suspect.presetQuestions.map((question) => ({ ...question, revealFactIds: question.revealFactIds.map((id) => factIdMap.get(id)!) })),
  }))
  fixture.facts = fixture.facts.map((fact) => ({
    ...fact,
    id: factIdMap.get(fact.id)!,
    npcId: npcIdMap[fact.npcId],
    prerequisiteFactIds: fact.prerequisiteFactIds.map((id) => factIdMap.get(id)!),
    requiredEvidenceIds: fact.requiredEvidenceIds.map((id) => evidenceIdMap.get(id)!),
  }))
  fixture.evidence = fixture.evidence.map((evidence) => ({
    ...evidence,
    id: evidenceIdMap.get(evidence.id)!,
    relatedNpcIds: evidence.relatedNpcIds.map((id) => npcIdMap[id]),
    unlockRequirements: evidence.unlockRequirements && {
      type: evidence.unlockRequirements.type,
      ids: evidence.unlockRequirements.ids.map((id) => evidence.unlockRequirements!.type === 'fact' ? factIdMap.get(id)! : contradictionIdMap.get(id)!),
    },
    reactionGuidance: Object.fromEntries(Object.entries(evidence.reactionGuidance).map(([id, value]) => [npcIdMap[id], value])),
  }))
  fixture.contradictions = fixture.contradictions.map((item) => ({
    ...item,
    id: contradictionIdMap.get(item.id)!,
    npcId: npcIdMap[item.npcId],
    requiredFactIds: item.requiredFactIds.map((id) => factIdMap.get(id)!),
    requiredEvidenceIds: item.requiredEvidenceIds.map((id) => evidenceIdMap.get(id)!),
    requiredPresentedEvidenceIds: item.requiredPresentedEvidenceIds.map((id) => evidenceIdMap.get(id)!),
  }))
  fixture.scoringConfig = {
    ...fixture.scoringConfig,
    keyEvidenceIds: fixture.scoringConfig.keyEvidenceIds.map((id) => evidenceIdMap.get(id)!),
    importantFactIds: fixture.scoringConfig.importantFactIds.map((id) => factIdMap.get(id)!),
    culpritEvidenceIds: fixture.scoringConfig.culpritEvidenceIds.map((id) => evidenceIdMap.get(id)!),
  }

  const [responsibility, emailAt0933, mailPermission] = fixture.facts
  Object.assign(responsibility, {
    id: 'lin_wei_minutes_reviewed', npcId: 'lin-wei', title: '审核并保存晨会纪要',
    description: '林薇负责审核并保存晨会纪要。', category: 'behavior',
    revealConditions: '林薇明确承认自己审核并保存了晨会纪要。', prerequisiteFactIds: [], requiredEvidenceIds: [],
  })
  Object.assign(emailAt0933, {
    id: 'lin_wei_email_at_0933', npcId: 'lin-wei', title: '09:33 在工位处理邮件',
    description: '林薇承认 09:33 仍在工位处理邮件。', category: 'timeline',
    revealConditions: '林薇明确说明 09:33 在工位处理邮件。', prerequisiteFactIds: [], requiredEvidenceIds: [],
  })
  Object.assign(mailPermission, {
    id: 'lin_wei_mail_permission', npcId: 'lin-wei', title: '拥有公司邮件系统使用权限',
    description: '林薇承认拥有公司邮件系统使用权限。', category: 'access',
    revealConditions: '林薇明确承认拥有邮件系统使用权限。', prerequisiteFactIds: [], requiredEvidenceIds: [],
  })
  fixture.evidence[2] = {
    ...fixture.evidence[2], id: 'mail_system_access_log', title: '邮件系统访问日志',
    description: '邮件系统记录了 09:33 的外发邮件操作。', source: '邮件系统',
    significance: '用于核对林薇处理邮件时的实际操作。', relatedNpcIds: ['lin-wei'], isInitial: false,
    unlockRequirements: { type: 'fact', ids: ['lin_wei_email_at_0933'] }, presentationKeywords: ['邮件系统记录', '09:33 外发邮件'],
  }
  const rewrittenFactIds = new Map([
    ['generated_fact_1', 'lin_wei_minutes_reviewed'],
    ['generated_fact_2', 'lin_wei_email_at_0933'],
    ['generated_fact_3', 'lin_wei_mail_permission'],
  ])
  const rewrittenEvidenceIds = new Map([['generated_evidence_3', 'mail_system_access_log']])
  fixture.suspects = fixture.suspects.map((suspect) => ({
    ...suspect,
    presetQuestions: suspect.presetQuestions.map((question) => ({
      ...question,
      revealFactIds: suspect.id === 'lin-wei'
        ? question.revealFactIds.map((id) => rewrittenFactIds.get(id) ?? id)
        : [],
    })),
  }))
  fixture.evidence = fixture.evidence.map((evidence) => evidence.unlockRequirements ? {
    ...evidence,
    unlockRequirements: {
      ...evidence.unlockRequirements,
      ids: evidence.unlockRequirements.ids.map((id) => evidence.unlockRequirements!.type === 'fact' ? rewrittenFactIds.get(id) ?? id : id),
    },
  } : evidence)
  fixture.contradictions = fixture.contradictions.map((item) => ({
    ...item,
    requiredFactIds: item.requiredFactIds.map((id) => rewrittenFactIds.get(id) ?? id),
    requiredEvidenceIds: item.requiredEvidenceIds.map((id) => rewrittenEvidenceIds.get(id) ?? id),
    requiredPresentedEvidenceIds: item.requiredPresentedEvidenceIds.map((id) => rewrittenEvidenceIds.get(id) ?? id),
  }))
  fixture.scoringConfig.importantFactIds = fixture.facts.map((fact) => fact.id)
  fixture.scoringConfig.keyEvidenceIds = fixture.evidence.filter((evidence) => evidence.isKey).map((evidence) => evidence.id)
  fixture.scoringConfig.culpritEvidenceIds = fixture.evidence.filter((evidence) => evidence.relatedNpcIds.includes(fixture.culpritId)).map((evidence) => evidence.id).slice(0, 4)
  fixture.scoringConfig.minimumCulpritEvidence = Math.min(2, fixture.scoringConfig.culpritEvidenceIds.length)
  return fixture
}

function createSession() {
  const caseDefinition = morningMinutesFixture()
  const validation = validateCaseDefinition(caseDefinition)
  assert.equal(validation.valid, true, JSON.stringify(validation.issues))
  const store = new DynamicCaseSessionStore()
  const session = store.create({ caseDefinition, validation, generationAttempts: 1, retryCount: 0, options: { caseType: 'data-leak', difficulty: 'normal' } })
  return { caseDefinition, store, session }
}

function input(sessionId: string, message: string, npcId = 'lin-wei'): InterrogateInput {
  return { caseSessionId: sessionId, npcId, message, conversationHistory: [], discoveredEvidenceIds: [], discoveredFactIds: [], discoveredContradictionIds: [] }
}

function provider(reply: string, revealedFactIds: string[] = []) {
  return { generateNpcResponse: async (): Promise<InterrogateResult> => ({ reply, emotion: 'calm', revealedFactIds, contradictionIds: [], unlockedEvidenceIds: [], presentedEvidenceIds: [] }) }
}

test('dynamic semantic fallback confirms Lin Wei responsibility with generated fact IDs', async () => {
  const { caseDefinition, store, session } = createSession()
  const result = await interrogateDynamicNpc(input(session.sessionId, '你是谁？你和晨会纪要有什么关系？'), {
    store, provider: provider('我是市场主管，这份纪要是我审核后保存的。'),
  })
  assert.deepEqual(result.revealedFactIds, ['lin_wei_minutes_reviewed'])
  assert.ok(!result.revealedFactIds.some((id) => id.startsWith('jack_') || id.startsWith('alice_') || id.startsWith('tom_')))
  assert.deepEqual(store.get(session.sessionId)?.progress.confirmedFactIds, ['lin_wei_minutes_reviewed'])
  assert.deepEqual(result.factRecords?.map((item) => item.id), ['lin_wei_minutes_reviewed'])
  assert.equal(caseDefinition.facts.find((fact) => fact.id === 'lin_wei_minutes_reviewed')?.npcId, 'lin-wei')
})

test('dynamic prompt exposes only the current NPC fact catalog and direct generated IDs remain valid', async () => {
  const { caseDefinition, store, session } = createSession()
  const prompt = buildDynamicNpcPrompt(caseDefinition, 'lin-wei', [])
  const otherNpcFactId = caseDefinition.facts.find((fact) => fact.npcId === 'zhao-qing')!.id
  const otherNpcPrivateFact = caseDefinition.suspects.find((suspect) => suspect.id === 'zhao-qing')!.privateInformation[0].statement
  assert.match(prompt ?? '', /lin_wei_minutes_reviewed/)
  assert.doesNotMatch(prompt ?? '', new RegExp(otherNpcFactId))
  assert.doesNotMatch(prompt ?? '', new RegExp(otherNpcPrivateFact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  const result = await interrogateDynamicNpc(input(session.sessionId, '你是否审核过纪要？'), {
    store, provider: provider('这份纪要是我审核后保存的。', ['lin_wei_minutes_reviewed']),
  })
  assert.deepEqual(result.revealedFactIds, ['lin_wei_minutes_reviewed'])
})

test('dynamic facts persist across NPC switches and do not trigger twice', async () => {
  const { store, session } = createSession()
  const first = await interrogateDynamicNpc(input(session.sessionId, '你和纪要有什么关系？'), { store, provider: provider('这份纪要是我审核后保存的。') })
  const duplicate = await interrogateDynamicNpc(input(session.sessionId, '请再确认一次。'), { store, provider: provider('这份纪要是我审核后保存的。') })
  const switched = await interrogateDynamicNpc(input(session.sessionId, '你当时在哪里？', 'chen-mo'), { store, provider: provider('我在大厅。') })
  assert.deepEqual(first.revealedFactIds, ['lin_wei_minutes_reviewed'])
  assert.deepEqual(duplicate.revealedFactIds, [])
  assert.deepEqual(switched.revealedFactIds, [])
  assert.deepEqual(store.get(session.sessionId)?.progress.confirmedFactIds, ['lin_wei_minutes_reviewed'])
})

test('dynamic facts unlock evidence and write each discovery into the session', async () => {
  const { store, session } = createSession()
  const timeResult = await interrogateDynamicNpc(input(session.sessionId, '09:33 你在哪里？'), { store, provider: provider('09:33 我还在工位处理邮件。') })
  const permissionResult = await interrogateDynamicNpc(input(session.sessionId, '你有邮件系统权限吗？'), { store, provider: provider('我有公司的邮件系统使用权限，操作记录都在系统里。') })
  assert.deepEqual(timeResult.revealedFactIds, ['lin_wei_email_at_0933'])
  assert.ok(timeResult.unlockedEvidenceIds.includes('mail_system_access_log'))
  assert.deepEqual(permissionResult.revealedFactIds, ['lin_wei_mail_permission'])
  assert.deepEqual(store.get(session.sessionId)?.progress.confirmedFactIds, ['lin_wei_email_at_0933', 'lin_wei_mail_permission'])
  assert.ok(store.get(session.sessionId)?.progress.discoveredEvidenceIds.includes('mail_system_access_log'))
})

test('dynamic semantic matching rejects unrelated replies and model-invented Fact IDs', async () => {
  const { caseDefinition, store, session } = createSession()
  const candidates = extractDynamicSemanticFactCandidates({ npcId: 'lin-wei', reply: '我只是参加了普通会议，没有接触纪要。', caseDefinition })
  const result = await interrogateDynamicNpc(input(session.sessionId, '你做了什么？'), { store, provider: provider('我只是参加了普通会议。', ['invented_dynamic_fact']) })
  assert.deepEqual(candidates, [])
  assert.deepEqual(result.revealedFactIds, [])
  assert.deepEqual(store.get(session.sessionId)?.progress.confirmedFactIds, [])
})

test('dynamic session reset and notebook update clear and reflect generated facts', async () => {
  const { store, session } = createSession()
  const result = await interrogateDynamicNpc(input(session.sessionId, '你和纪要有什么关系？'), { store, provider: provider('这份纪要是我审核后保存的。') })
  const notebook = applySessionUpdate(createInvestigationSession([]), {
    revealedFactIds: result.revealedFactIds,
    contradictionIds: result.contradictionIds,
    unlockedEvidenceIds: result.unlockedEvidenceIds,
    presentedEvidenceIds: result.presentedEvidenceIds,
  })
  assert.deepEqual(notebook.discoveredFactIds, ['lin_wei_minutes_reviewed'])
  assert.deepEqual(notebook.lastDiscovery?.revealedFactIds, ['lin_wei_minutes_reviewed'])
  store.clear()
  assert.equal(store.get(session.sessionId), undefined)
  const newSession = store.create({ caseDefinition: morningMinutesFixture(), validation: validateCaseDefinition(morningMinutesFixture()), generationAttempts: 1, retryCount: 0, options: { caseType: 'data-leak', difficulty: 'normal' } })
  assert.deepEqual(newSession.progress.confirmedFactIds, [])
})
