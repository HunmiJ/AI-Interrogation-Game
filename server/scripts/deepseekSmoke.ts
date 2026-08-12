import 'dotenv/config'
import { createLlmProvider } from '../providers/providerFactory'

async function main() {
  const provider = createLlmProvider()
  if (provider.name !== 'deepseek') {
    throw new Error(`DeepSeek smoke test requires LLM_PROVIDER=deepseek; received ${provider.name}.`)
  }

  const reply = await provider.generateText({
    instructions: '严格遵循用户要求，不添加解释或标点。',
    message: '只回复：连接成功',
    maxOutputTokens: 32,
  })

  console.log(`[deepseek-smoke] provider=${provider.name} model=${provider.model} reply=${JSON.stringify(reply)}`)
  if (reply !== '连接成功') {
    throw new Error('DeepSeek returned text, but it did not exactly match the expected smoke-test reply.')
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown smoke-test failure.'
  console.error(`[deepseek-smoke] failed: ${message}`)
  process.exitCode = 1
})
