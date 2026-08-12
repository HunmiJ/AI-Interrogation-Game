import { ProviderConfigurationError } from './errors'
import type { LlmProviderConfig, LlmProviderName } from './types'

const defaults: Record<LlmProviderName, Pick<LlmProviderConfig, 'model' | 'baseURL'>> = {
  deepseek: {
    model: 'deepseek-v4-flash',
    baseURL: 'https://api.deepseek.com',
  },
  openai: {
    model: 'gpt-4.1-mini',
    baseURL: 'https://api.openai.com/v1',
  },
}

export function resolveProviderConfig(environment: NodeJS.ProcessEnv = process.env): LlmProviderConfig {
  const providerValue = environment.LLM_PROVIDER?.trim().toLowerCase() || 'deepseek'
  if (providerValue !== 'deepseek' && providerValue !== 'openai') {
    throw new ProviderConfigurationError('UNSUPPORTED_PROVIDER', `不支持的 LLM Provider：${providerValue}`)
  }

  const provider = providerValue as LlmProviderName
  return {
    provider,
    apiKey: environment.LLM_API_KEY?.trim() || undefined,
    model: environment.LLM_MODEL?.trim() || defaults[provider].model,
    baseURL: (environment.LLM_BASE_URL?.trim() || defaults[provider].baseURL).replace(/\/$/, ''),
    timeoutMs: Number(environment.LLM_TIMEOUT_MS) || 60_000,
    apiFormat: 'responses',
  }
}

export function getProviderStatus(environment: NodeJS.ProcessEnv = process.env) {
  const config = resolveProviderConfig(environment)
  return {
    provider: config.provider,
    model: config.model,
    baseURL: config.baseURL,
    apiFormat: config.apiFormat,
    configured: Boolean(config.apiKey),
  }
}
