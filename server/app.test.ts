import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from './app'
import type { InterrogateInput } from './types/agent'

test('routes Jack, Alice and Tom as independent NPC requests', async () => {
  const seen: InterrogateInput[] = []
  const app = createApp({
    interrogate: async (input) => {
      seen.push(input)
      return {
        reply: `${input.npcId}:${input.conversationHistory.map((turn) => turn.content).join('|')}`,
        emotion: 'calm',
        revealedFactIds: [],
        contradictionIds: [],
      }
    },
  })

  const cases = [
    { npcId: 'jack', marker: 'jack-only-history' },
    { npcId: 'alice', marker: 'alice-only-history' },
    { npcId: 'tom', marker: 'tom-only-history' },
  ] as const

  for (const item of cases) {
    const response = await request(app).post('/api/interrogate').send({
      npcId: item.npcId,
      message: '你当时在哪里？',
      conversationHistory: [{ role: 'assistant', content: item.marker }],
      discoveredEvidenceIds: ['alarm-log'],
    })

    assert.equal(response.status, 200)
    assert.match(response.body.reply, new RegExp(`^${item.npcId}:${item.marker}$`))
  }

  assert.equal(seen.length, 3)
  assert.deepEqual(seen.map((item) => item.npcId), ['jack', 'alice', 'tom'])
})

test('returns a safe error payload without an API key', async () => {
  const previousKey = process.env.LLM_API_KEY
  delete process.env.LLM_API_KEY
  const app = createApp()

  const response = await request(app).post('/api/interrogate').send({
    npcId: 'jack',
    message: '你为什么撒谎？',
    conversationHistory: [],
    discoveredEvidenceIds: [],
  })

  if (previousKey) process.env.LLM_API_KEY = previousKey

  assert.equal(response.status, 503)
  assert.equal(response.body.error.code, 'LLM_NOT_CONFIGURED')
  assert.equal(response.body.error.retryable, false)
})

test('health route reports the default DeepSeek Responses provider', async () => {
  const previousProvider = process.env.LLM_PROVIDER
  const previousModel = process.env.LLM_MODEL
  const previousBaseUrl = process.env.LLM_BASE_URL
  delete process.env.LLM_PROVIDER
  delete process.env.LLM_MODEL
  delete process.env.LLM_BASE_URL

  const response = await request(createApp()).get('/api/health')

  if (previousProvider) process.env.LLM_PROVIDER = previousProvider
  if (previousModel) process.env.LLM_MODEL = previousModel
  if (previousBaseUrl) process.env.LLM_BASE_URL = previousBaseUrl

  assert.equal(response.status, 200)
  assert.equal(response.body.provider, 'deepseek')
  assert.equal(response.body.configured, Boolean(process.env.LLM_API_KEY))
  assert.equal(typeof response.body.available, 'boolean')
  assert.equal('apiKey' in response.body, false)
  assert.equal('baseURL' in response.body, false)
  assert.equal('model' in response.body, false)
})

test('rejects invalid or oversized interrogation input', async () => {
  const app = createApp()
  const empty = await request(app).post('/api/interrogate').send({
    npcId: 'jack', message: '   ', conversationHistory: [], discoveredEvidenceIds: [],
  })
  const unknownNpc = await request(app).post('/api/interrogate').send({
    npcId: 'unknown', message: 'hello', conversationHistory: [], discoveredEvidenceIds: [],
  })

  assert.equal(empty.status, 400)
  assert.equal(unknownNpc.status, 400)
})

test('keeps case resolution on the server and resolves every accusation', async () => {
  const app = createApp()
  const jack = await request(app).post('/api/case/resolve').send({ accusedNpcId: 'jack' })
  const alice = await request(app).post('/api/case/resolve').send({ accusedNpcId: 'alice' })
  const tom = await request(app).post('/api/case/resolve').send({ accusedNpcId: 'tom' })

  assert.equal(jack.body.correct, false)
  assert.equal(alice.body.correct, false)
  assert.equal(tom.body.correct, true)
  assert.equal(tom.body.culprit.id, 'tom')
})
