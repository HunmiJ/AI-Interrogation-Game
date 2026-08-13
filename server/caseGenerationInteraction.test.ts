import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultCaseGenerationSelection,
  GenerationSubmissionGate,
  optionSelectionAttributes,
  selectCaseType,
  selectDifficulty,
  submitGenerationSelection,
} from '../src/components/caseGenerationModel'

test('page loads with Random selected', () => {
  assert.equal(defaultCaseGenerationSelection.caseType, 'random')
})

test('page loads with Normal selected', () => {
  assert.equal(defaultCaseGenerationSelection.difficulty, 'normal')
})

test('selected and unselected options expose explicit aria-pressed state', () => {
  assert.deepEqual(optionSelectionAttributes(true), { 'aria-pressed': true, 'data-selected': 'true' })
  assert.deepEqual(optionSelectionAttributes(false), { 'aria-pressed': false, 'data-selected': 'false' })
})

test('clicking Data Leak selects data-leak', () => {
  const selected = selectCaseType(defaultCaseGenerationSelection, 'data-leak')
  assert.equal(selected.caseType, 'data-leak')
})

test('clicking Data Leak unselects Random', () => {
  const selected = selectCaseType(defaultCaseGenerationSelection, 'data-leak')
  assert.notEqual(selected.caseType, 'random')
})

test('clicking Hard selects hard', () => {
  const selected = selectDifficulty(defaultCaseGenerationSelection, 'hard')
  assert.equal(selected.difficulty, 'hard')
})

test('clicking Hard unselects Normal', () => {
  const selected = selectDifficulty(defaultCaseGenerationSelection, 'hard')
  assert.notEqual(selected.difficulty, 'normal')
})

test('Data Leak and Normal submit the current generation request to the mock API', async () => {
  const selected = selectDifficulty(selectCaseType(defaultCaseGenerationSelection, 'data-leak'), 'normal')
  const requests: unknown[] = []
  await submitGenerationSelection(selected, async (request) => { requests.push(request); return undefined })
  assert.deepEqual(requests, [{ caseType: 'data-leak', difficulty: 'normal' }])
})

test('Theft and Hard submit the current generation request to the mock API', async () => {
  const selected = selectDifficulty(selectCaseType(defaultCaseGenerationSelection, 'theft'), 'hard')
  const requests: unknown[] = []
  await submitGenerationSelection(selected, async (request) => { requests.push(request); return undefined })
  assert.deepEqual(requests, [{ caseType: 'theft', difficulty: 'hard' }])
})

test('one selection group cannot hold multiple selected values', () => {
  const afterTheft = selectCaseType(defaultCaseGenerationSelection, 'theft')
  const afterDataLeak = selectCaseType(afterTheft, 'data-leak')
  assert.deepEqual(afterDataLeak, { caseType: 'data-leak', difficulty: 'normal' })
})

test('generation submission gate prevents repeated requests while pending', async () => {
  const gate = new GenerationSubmissionGate()
  let requests = 0
  let release: (() => void) | undefined
  const pending = new Promise<void>((resolve) => { release = resolve })
  const first = gate.run(async () => { requests += 1; await pending; return 'ready' })
  const second = await gate.run(async () => { requests += 1; return 'duplicate' })
  assert.equal(second, undefined)
  assert.equal(requests, 1)
  assert.equal(gate.isPending, true)
  release?.()
  assert.equal(await first, 'ready')
  assert.equal(gate.isPending, false)
})
