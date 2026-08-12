import { ProviderConfigurationError } from './errors'
import { resolveProviderConfig } from './providerConfig'
import { ResponsesApiProvider } from './responsesApiProvider'
import type { LlmProvider } from './types'

export function createLlmProvider(): LlmProvider {
  const config = resolveProviderConfig()
  if (!config.apiKey) {
    throw new ProviderConfigurationError('MISSING_API_KEY', 'AI 服务尚未配置。')
  }
  return new ResponsesApiProvider({ ...config, apiKey: config.apiKey })
}
