import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateContradictions, findInvestigationDependencyCycles, validateInvestigationSuggestions } from './data/investigationRules'
import { calculateInvestigationScore } from './data/investigationScore'
import { createInvestigationSession, applySessionUpdate } from '../src/utils/gameSession'
import { resolveTrustedPresetUpdate } from '../src/utils/investigationRules'
import { extractSemanticFactCandidates, getTurnDisclosureDirective } from './services/investigationCandidateExtractor'
import { detectPresentedEvidenceIds } from './services/evidencePresentation'

test('unknown fact and contradiction IDs never enter validated game state', () => {
  const result = validateInvestigationSuggestions({
    npcId: 'jack',
    suggestedFactIds: ['invented_fact'],
    suggestedContradictionIds: ['invented_conflict'],
    discoveredFactIds: [], discoveredContradictionIds: [], discoveredEvidenceIds: [],
  })
  assert.deepEqual(result.acceptedFactIds, [])
  assert.deepEqual(result.acceptedContradictionIds, [])
  assert.deepEqual(result.rejectedContradictionIds, [
    { id: 'invented_conflict', reason: 'unknown_contradiction', missingIds: [] },
  ])
})

test('Jack semantic fallback suggests explicit upstairs admissions but not denials', () => {
  const admitted = extractSemanticFactCandidates({
    npcId: 'jack',
    message: '你确定没有去过二楼？',
    conversationHistory: [{ role: 'user', content: '活动结束之后你真的马上离开了吗？' }],
    reply: '准确说我离开了前厅，后面没直接出店。我在二楼储物间拍了几张长曝光。',
  })
  assert.deepEqual(admitted.map((item) => item.id), ['jack_stayed_after_event', 'jack_went_upstairs'])

  const denied = extractSemanticFactCandidates({
    npcId: 'jack', message: '你确定没有去过二楼？', conversationHistory: [],
    reply: '我没有去过二楼，那儿又黑又闷。',
  })
  assert.deepEqual(denied, [])

  const evasiveAdmission = extractSemanticFactCandidates({
    npcId: 'jack', message: '你确定没有去过二楼？',
    conversationHistory: [{ role: 'user', content: '活动结束之后你真的马上离开了吗？' }],
    reply: '二楼？我去二楼干嘛……哦，器材室那边有角度可以拍点夜景，但这跟案子没关系吧。',
  })
  assert.deepEqual(evasiveAdmission.map((item) => item.id), ['jack_stayed_after_event', 'jack_went_upstairs'])

  const photographyDenial = extractSemanticFactCandidates({
    npcId: 'jack', message: '你去过二楼拍照吗？', conversationHistory: [],
    reply: '二楼没有适合拍摄的角度，我没必要去那里。',
  })
  assert.deepEqual(photographyDenial, [])

  const realDeepSeekAdmission = extractSemanticFactCandidates({
    npcId: 'jack', message: '你确定没有去过二楼？',
    conversationHistory: [{ role: 'user', content: '活动结束之后你真的马上离开了吗？' }],
    reply: '好吧，我是没马上离开，去二楼储物间待了会儿。拍了几张长曝光。',
  })
  assert.deepEqual(realDeepSeekAdmission.map((item) => item.id), ['jack_stayed_after_event', 'jack_went_upstairs'])

  const splitSentenceAdmission = extractSemanticFactCandidates({
    npcId: 'jack', message: '你确定没有去过二楼？',
    conversationHistory: [{ role: 'user', content: '活动结束之后你真的马上离开了吗？' }],
    reply: '我确实……上去过。二楼储物间没人管，我就架了相机拍长曝光。没多待就下来了。',
  })
  assert.deepEqual(splitSentenceAdmission.map((item) => item.id), ['jack_stayed_after_event', 'jack_went_upstairs'])
})

test('semantic Jack candidates still pass through prerequisites and unlock evidence deterministically', () => {
  const candidates = extractSemanticFactCandidates({
    npcId: 'jack', message: '你确定没有去过二楼？',
    conversationHistory: [{ role: 'user', content: '活动结束之后你真的马上离开了吗？' }],
    reply: '好吧，我确实去了二楼，在储物间拍了几张长曝光。',
  })
  const result = validateInvestigationSuggestions({
    npcId: 'jack', suggestedFactIds: candidates.map((item) => item.id), suggestedContradictionIds: [],
    discoveredFactIds: [], discoveredContradictionIds: [], discoveredEvidenceIds: ['rear-door-scratches', 'alarm-log'],
  })
  assert.deepEqual(result.acceptedFactIds, ['jack_stayed_after_event', 'jack_went_upstairs'])
  assert.deepEqual(result.unlockedEvidenceIds, ['camera-metadata', 'memory-card-photo'])
})

test('the second direct Jack question activates the intended disclosure turn', () => {
  const directive = getTurnDisclosureDirective({
    npcId: 'jack', message: '你确定没有去过二楼？',
    conversationHistory: [
      { role: 'user', content: '活动结束之后你真的马上离开了吗？' },
      { role: 'assistant', content: '拍完我就走了。' },
    ],
  })
  assert.match(directive, /jack_went_upstairs/)
  assert.equal(getTurnDisclosureDirective({
    npcId: 'jack', message: '你去过二楼吗？', conversationHistory: [],
  }), '')
})

test('the current Fact, Contradiction, and Evidence graph has no dependency cycle', () => {
  assert.deepEqual(findInvestigationDependencyCycles(), [])
})

test('deterministic contradiction evaluation requires both facts and evidence', () => {
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: [],
    discoveredContradictionIds: [],
  }), [])
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: [],
    discoveredEvidenceIds: ['supplier-call-record'],
    discoveredContradictionIds: [],
  }), [])
})

test('Tom supplier-call conflict is derived from confirmed testimony and call record', () => {
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: ['supplier-call-record'],
    discoveredContradictionIds: [],
    presentedEvidenceIds: ['supplier-call-record'],
  }), ['tom_supplier_call_conflict'])
})

test('one Tom response confirms testimony and unlocks evidence without cascading contradiction', () => {
  const result = validateInvestigationSuggestions({
    npcId: 'tom',
    suggestedFactIds: ['tom_claimed_supplier_call'],
    suggestedContradictionIds: [],
    discoveredFactIds: [],
    discoveredEvidenceIds: ['rear-door-scratches', 'alarm-log'],
    discoveredContradictionIds: [],
  })
  assert.deepEqual(result.acceptedFactIds, ['tom_claimed_supplier_call'])
  assert.ok(result.unlockedEvidenceIds.includes('supplier-call-record'))
  assert.deepEqual(result.acceptedContradictionIds, [])
  assert.ok(!result.unlockedEvidenceIds.includes('debt-letter'))

  const session = applySessionUpdate(createInvestigationSession(['rear-door-scratches', 'alarm-log']), {
    revealedFactIds: result.acceptedFactIds,
    contradictionIds: result.acceptedContradictionIds,
    unlockedEvidenceIds: result.unlockedEvidenceIds,
  })
  assert.deepEqual(session.discoveredContradictionIds, [])
})

test('the next turn can present an old call record and derive the supplier contradiction once', () => {
  const result = validateInvestigationSuggestions({
    npcId: 'tom', suggestedFactIds: [], suggestedContradictionIds: [],
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: ['rear-door-scratches', 'alarm-log', 'supplier-call-record'],
    presentedEvidenceIds: ['supplier-call-record'],
    discoveredContradictionIds: [],
  })
  assert.deepEqual(result.acceptedContradictionIds, ['tom_supplier_call_conflict'])
  assert.deepEqual(result.unlockedEvidenceIds, [])

  const duplicate = validateInvestigationSuggestions({
    npcId: 'tom', suggestedFactIds: [], suggestedContradictionIds: [],
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: ['supplier-call-record'], presentedEvidenceIds: ['supplier-call-record'],
    discoveredContradictionIds: ['tom_supplier_call_conflict'],
  })
  assert.deepEqual(duplicate.acceptedContradictionIds, [])
})

test('Tom supplier-call testimony cannot unlock the debt letter; financial inquiry can', () => {
  const supplier = validateInvestigationSuggestions({
    npcId: 'tom', suggestedFactIds: ['tom_claimed_supplier_call'], suggestedContradictionIds: [],
    discoveredFactIds: [], discoveredEvidenceIds: [], discoveredContradictionIds: [],
  })
  assert.ok(!supplier.unlockedEvidenceIds.includes('debt-letter'))

  const financial = validateInvestigationSuggestions({
    npcId: 'tom', suggestedFactIds: ['tom_financial_pressure'], suggestedContradictionIds: [],
    discoveredFactIds: [], discoveredEvidenceIds: [], discoveredContradictionIds: [],
  })
  assert.ok(financial.unlockedEvidenceIds.includes('debt-letter'))
})

test('Tom merely saying upstairs does not produce a location contradiction', () => {
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: ['memory-card-photo'],
    presentedEvidenceIds: ['memory-card-photo'],
    discoveredContradictionIds: [],
  }), [])
})

test('Tom location conflict requires an explicit incompatible denial and presented photo', () => {
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_denied_office_contact'],
    discoveredEvidenceIds: ['memory-card-photo'],
    discoveredContradictionIds: [],
  }), [])
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_denied_office_contact'],
    discoveredEvidenceIds: ['memory-card-photo'], presentedEvidenceIds: ['memory-card-photo'],
    discoveredContradictionIds: [],
  }), ['tom_location_conflict'])
})

test('deterministic contradiction evaluation never returns an existing contradiction twice', () => {
  assert.deepEqual(evaluateContradictions({
    discoveredFactIds: ['tom_claimed_supplier_call'],
    discoveredEvidenceIds: ['supplier-call-record'],
    discoveredContradictionIds: ['tom_supplier_call_conflict'],
    presentedEvidenceIds: ['supplier-call-record'],
  }), [])
})

test('only already discovered evidence explicitly referenced by the player is presented', () => {
  assert.deepEqual(detectPresentedEvidenceIds(
    '运营商记录显示你22:31以后没有任何通话，你怎么解释？',
    ['supplier-call-record'],
  ), ['supplier-call-record'])
  assert.deepEqual(detectPresentedEvidenceIds(
    '23:09 的照片里你拿着募款箱。',
    [],
  ), [])
})

test('facts and contradictions are not accepted twice', () => {
  const result = validateInvestigationSuggestions({
    npcId: 'jack',
    suggestedFactIds: ['jack_stayed_after_event', 'jack_stayed_after_event'],
    suggestedContradictionIds: ['jack_exit_time_conflict', 'jack_exit_time_conflict'],
    discoveredFactIds: ['jack_stayed_after_event', 'jack_went_upstairs'],
    discoveredContradictionIds: ['jack_exit_time_conflict'],
    discoveredEvidenceIds: ['camera-metadata'],
  })
  assert.deepEqual(result.acceptedFactIds, [])
  assert.deepEqual(result.acceptedContradictionIds, [])

  const session = applySessionUpdate({
    ...createInvestigationSession(['alarm-log']),
    discoveredFactIds: ['jack_stayed_after_event'],
  }, {
    revealedFactIds: ['jack_stayed_after_event'], contradictionIds: [], unlockedEvidenceIds: [],
  })
  assert.deepEqual(session.discoveredFactIds, ['jack_stayed_after_event'])
})

test('fact prerequisites block evidence-gated conclusions and unlock evidence once satisfied', () => {
  const blocked = validateInvestigationSuggestions({
    npcId: 'alice',
    suggestedFactIds: ['alice_left_before_crime'], suggestedContradictionIds: [],
    discoveredFactIds: [], discoveredContradictionIds: [], discoveredEvidenceIds: [],
  })
  assert.deepEqual(blocked.acceptedFactIds, [])
  assert.deepEqual(blocked.unlockedEvidenceIds, [])

  const unlocked = validateInvestigationSuggestions({
    npcId: 'jack',
    suggestedFactIds: ['jack_went_upstairs'], suggestedContradictionIds: [],
    discoveredFactIds: [], discoveredContradictionIds: [],
    discoveredEvidenceIds: [],
  })
  assert.deepEqual(unlocked.acceptedFactIds, ['jack_went_upstairs'])
  assert.deepEqual(unlocked.unlockedEvidenceIds, ['memory-card-photo'])
})

test('evidence-gated facts and contradictions require evidence and matching NPC', () => {
  const blocked = validateInvestigationSuggestions({
    npcId: 'tom',
    suggestedFactIds: ['tom_seen_at_office'], suggestedContradictionIds: ['tom_location_conflict'],
    discoveredFactIds: [], discoveredContradictionIds: [], discoveredEvidenceIds: [],
  })
  assert.deepEqual(blocked.acceptedFactIds, [])

  const accepted = validateInvestigationSuggestions({
    npcId: 'tom',
    suggestedFactIds: ['tom_seen_at_office'], suggestedContradictionIds: ['tom_location_conflict', 'jack_exit_time_conflict'],
    discoveredFactIds: ['tom_denied_office_contact'], discoveredContradictionIds: [], discoveredEvidenceIds: ['memory-card-photo'],
    presentedEvidenceIds: ['memory-card-photo'],
  })
  assert.deepEqual(accepted.acceptedFactIds, ['tom_seen_at_office'])
  assert.deepEqual(accepted.acceptedContradictionIds, ['tom_location_conflict'])
})

test('guessing Tom without investigation cannot produce a high score', () => {
  const score = calculateInvestigationScore({
    accusedNpcId: 'tom', discoveredEvidenceIds: [], discoveredFactIds: [],
    discoveredContradictionIds: [], questionCount: 1, interrogatedNpcIds: ['tom'],
  })
  assert.equal(score.total, 50)
})

test('forged known IDs cannot bypass the deterministic score graph', () => {
  const score = calculateInvestigationScore({
    accusedNpcId: 'tom',
    discoveredEvidenceIds: ['memory-card-photo', 'supplier-call-record', 'debt-letter'],
    discoveredFactIds: ['tom_seen_at_office', 'tom_fake_supplier_call'],
    discoveredContradictionIds: ['tom_location_conflict', 'tom_supplier_call_conflict'],
    questionCount: 1,
    interrogatedNpcIds: ['tom'],
  })
  assert.equal(score.total, 50)
  assert.equal(score.breakdown.evidence.earned, 0)
  assert.equal(score.breakdown.contradictions.earned, 0)
})

test('a complete evidence chain earns a high investigation score', () => {
  const score = calculateInvestigationScore({
    accusedNpcId: 'tom',
    discoveredEvidenceIds: ['rear-door-scratches', 'alarm-log', 'camera-metadata', 'memory-card-photo', 'transit-record', 'supplier-call-record', 'debt-letter'],
    discoveredFactIds: ['jack_stayed_after_event', 'jack_went_upstairs', 'alice_returned_for_earphones', 'alice_left_before_crime', 'tom_claimed_supplier_call', 'tom_used_alarm_code', 'tom_seen_at_office', 'tom_denied_office_contact', 'tom_fake_supplier_call', 'tom_financial_pressure'],
    discoveredContradictionIds: ['jack_exit_time_conflict', 'tom_supplier_call_conflict', 'tom_location_conflict', 'tom_alarm_statement_conflict'],
    questionCount: 10,
    interrogatedNpcIds: ['jack', 'alice', 'tom'],
  })
  assert.equal(score.total, 100)
})

test('offline preset rules unlock evidence deterministically and reset clears V0.3 session', () => {
  const initial = createInvestigationSession(['rear-door-scratches', 'alarm-log'])
  const update = resolveTrustedPresetUpdate(
    ['jack_stayed_after_event', 'jack_went_upstairs'], ['jack_exit_time_conflict'],
    initial.discoveredFactIds, initial.discoveredContradictionIds, initial.collectedEvidenceIds,
  )
  const progressed = applySessionUpdate(initial, update)
  assert.deepEqual(progressed.discoveredFactIds, ['jack_stayed_after_event', 'jack_went_upstairs'])
  assert.ok(progressed.collectedEvidenceIds.includes('memory-card-photo'))

  const reset = createInvestigationSession(['rear-door-scratches', 'alarm-log'])
  assert.deepEqual(reset.discoveredFactIds, [])
  assert.deepEqual(reset.discoveredContradictionIds, [])
  assert.deepEqual(reset.presentedEvidenceIds, [])
  assert.equal(reset.questionCount, 0)
})
