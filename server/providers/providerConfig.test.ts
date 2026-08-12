import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ProviderConfigurationError } from './errors'
import { getProviderStatus, resolveProviderConfig } from './providerConfig'

test('routes to DeepSeek Responses API by default', () => {
  const config = resolveProviderConfig({})
  assert.equal(config.provider, 'deepseek')
  assert.equal(config.model, 'deepseek-v4-flash')
  assert.equal(config.baseURL, 'https://api.deepseek.com')
  assert.equal(config.apiFormat, 'responses')
  assert.equal(config.timeoutMs, 60_000)
})

test('can switch to OpenAI entirely through environment variables', () => {
  const status = getProviderStatus({
    LLM_PROVIDER: 'openai',
    LLM_API_KEY: 'test-placeholder-not-a-real-key',
    LLM_MODEL: 'gpt-4.1-mini',
    LLM_BASE_URL: 'https://api.openai.com/v1/',
  })

  assert.equal(status.provider, 'openai')
  assert.equal(status.model, 'gpt-4.1-mini')
  assert.equal(status.baseURL, 'https://api.openai.com/v1')
  assert.equal(status.apiFormat, 'responses')
  assert.equal(status.configured, true)
})

test('rejects unknown providers instead of silently misrouting', () => {
  assert.throws(
    () => resolveProviderConfig({ LLM_PROVIDER: 'unknown-provider' }),
    (error) => error instanceof ProviderConfigurationError && error.code === 'UNSUPPORTED_PROVIDER',
  )
})
