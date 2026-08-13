import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Response as OpenAIResponse } from 'openai/resources/responses/responses'
import { ProviderRequestError } from './errors'
import { extractResponseText, ResponsesApiProvider } from './responsesApiProvider'
import type { ProviderDebugLog, ProviderErrorLog, ProviderErrorLogger } from './responsesApiProvider'

function createProvider(
  fetch: typeof globalThis.fetch,
  errorLogger: ProviderErrorLogger = () => undefined,
) {
  return new ResponsesApiProvider({
    provider: 'deepseek',
    apiKey: 'test-placeholder-not-a-real-key',
    model: 'deepseek-v4-flash',
    baseURL: 'https://api.deepseek.com',
    timeoutMs: 60_000,
    apiFormat: 'responses',
  }, { fetch, maxRetries: 0, errorLogger })
}

function createResponsesApiResult(
  outputText: string,
  options: {
    status?: 'completed' | 'incomplete' | 'failed'
    incompleteReason?: 'max_output_tokens' | 'content_filter'
    error?: { code: string; message: string }
  } = {},
) {
  const status = options.status ?? 'completed'
  return new Response(JSON.stringify({
    id: 'resp_test',
    object: 'response',
    status,
    error: options.error ?? null,
    incomplete_details: options.incompleteReason ? { reason: options.incompleteReason } : null,
    model: 'deepseek-v4-flash',
    output: [{
      id: 'msg_test',
      type: 'message',
      status: status === 'failed' ? 'incomplete' : status,
      role: 'assistant',
      content: [{ type: 'output_text', text: outputText, annotations: [] }],
    }],
    usage: {
      input_tokens: 1,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 1,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 2,
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('extractResponseText falls back to message output content when SDK helper is empty', () => {
  const response = {
    output_text: '',
    output: [{
      type: 'message',
      content: [
        { type: 'output_text', text: '第一段' },
        { type: 'output_text', text: '第二段' },
      ],
    }],
  } as unknown as OpenAIResponse

  assert.equal(extractResponseText(response), '第一段第二段')
})

test('DeepSeek adapter uses stateless ordered history and parses output text JSON', async () => {
  const requestedUrls: string[] = []
  let requestBody: Record<string, unknown> | undefined
  const interceptedFetch: typeof globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input))
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return createResponsesApiResult(`\`\`\`json\n${JSON.stringify({
      reply: '我没有说谎。',
      emotion: 'defensive',
      revealedFactIds: [],
      contradictionIds: [],
    })}\n\`\`\``)
  }
  const provider = createProvider(interceptedFetch)

  const result = await provider.generateNpcResponse({
    systemPrompt: 'Stay in character.',
    conversationHistory: [
      { role: 'user', content: '你昨晚为什么会去咖啡馆附近？' },
      { role: 'assistant', content: '我是去拍周年活动的。' },
    ],
    message: '你确定你没说谎？',
  })

  assert.deepEqual(requestedUrls, ['https://api.deepseek.com/responses'])
  assert.deepEqual(requestBody?.reasoning, { effort: 'none' })
  assert.equal(((requestBody?.text as { format?: { type?: string } })?.format?.type), 'json_object')
  assert.match(String(requestBody?.instructions), /只输出一个 JSON 对象/)
  assert.deepEqual(requestBody?.input, [
    { role: 'user', content: '你昨晚为什么会去咖啡馆附近？' },
    { role: 'assistant', content: '我是去拍周年活动的。' },
    { role: 'user', content: '你确定你没说谎？' },
  ])
  assert.equal('previous_response_id' in (requestBody ?? {}), false)
  assert.equal(result.reply, '我没有说谎。')
  assert.deepEqual(result.unlockedEvidenceIds, [])
})

test('plain text is returned as a neutral safe fallback when structured parsing fails', async () => {
  const provider = createProvider(async () => createResponsesApiResult('我说的都是实话，你还想问什么？'))
  const result = await provider.generateNpcResponse({
    systemPrompt: 'Stay in character.',
    conversationHistory: [],
    message: '你说谎了吗？',
  })

  assert.deepEqual(result, {
    reply: '我说的都是实话，你还想问什么？',
    emotion: 'neutral',
    revealedFactIds: [],
    contradictionIds: [],
    unlockedEvidenceIds: [],
  })
})

test('empty structured output retries once without text.format and returns plain text', async () => {
  const requestBodies: Array<Record<string, unknown>> = []
  const debugRecords: ProviderDebugLog[] = []
  const provider = new ResponsesApiProvider({
    provider: 'deepseek',
    apiKey: 'test-placeholder-not-a-real-key',
    model: 'deepseek-v4-flash',
    baseURL: 'https://api.deepseek.com',
    timeoutMs: 60_000,
    apiFormat: 'responses',
  }, {
    maxRetries: 0,
    debugLogger: (record) => { debugRecords.push(record) },
    errorLogger: () => undefined,
    fetch: async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return requestBodies.length === 1
        ? createResponsesApiResult('')
        : createResponsesApiResult('我没有说谎。')
    },
  })

  const result = await provider.generateNpcResponse({
    systemPrompt: 'Stay in character.',
    conversationHistory: [
      { role: 'user', content: '你为什么在咖啡馆附近？' },
      { role: 'assistant', content: '我是去拍照的。' },
    ],
    message: '你确定没说谎？',
  })

  assert.equal(requestBodies.length, 2)
  assert.equal('text' in (requestBodies[0] ?? {}), true)
  assert.equal('text' in (requestBodies[1] ?? {}), false)
  assert.deepEqual(requestBodies[0]?.input, requestBodies[1]?.input)
  assert.equal(debugRecords[0]?.event, 'empty_response_retry')
  assert.deepEqual(result, {
    reply: '我没有说谎。',
    emotion: 'neutral',
    revealedFactIds: [],
    contradictionIds: [],
    unlockedEvidenceIds: [],
  })
})

test('unreadable response shape logs item and content types without response text', async () => {
  const records: ProviderErrorLog[] = []
  const provider = createProvider(
    async () => createResponsesApiResult('{"reply":'),
    (record) => { records.push(record) },
  )

  await assert.rejects(
    provider.generateNpcResponse({
      systemPrompt: 'Stay in character.',
      conversationHistory: [],
      message: '你在哪里？',
    }),
    (error) => error instanceof ProviderRequestError && error.code === 'INVALID_RESPONSE',
  )

  assert.equal(records[0]?.responseParsingError, true)
  assert.equal(records[0]?.responseStatus, 'completed')
  assert.deepEqual(records[0]?.outputItemTypes, ['message'])
  assert.deepEqual(records[0]?.contentTypes, ['output_text'])
  assert.doesNotMatch(JSON.stringify(records[0]), /Stay in character|test-placeholder/)
})

test('incomplete and failed statuses log their safe reasons', async () => {
  const incompleteRecords: ProviderErrorLog[] = []
  const incompleteProvider = createProvider(
    async () => createResponsesApiResult('', { status: 'incomplete', incompleteReason: 'max_output_tokens' }),
    (record) => { incompleteRecords.push(record) },
  )
  await assert.rejects(
    incompleteProvider.generateText({ message: 'hello' }),
    (error) => error instanceof ProviderRequestError && error.code === 'INVALID_RESPONSE',
  )
  assert.equal(incompleteRecords[0]?.responseStatus, 'incomplete')
  assert.match(incompleteRecords[0]?.incompleteDetails ?? '', /max_output_tokens/)

  const failedRecords: ProviderErrorLog[] = []
  const failedProvider = createProvider(
    async () => createResponsesApiResult('', {
      status: 'failed',
      error: { code: 'server_error', message: 'Generation failed safely.' },
    }),
    (record) => { failedRecords.push(record) },
  )
  await assert.rejects(
    failedProvider.generateText({ message: 'hello' }),
    (error) => error instanceof ProviderRequestError && error.code === 'UNAVAILABLE',
  )
  assert.equal(failedRecords[0]?.responseStatus, 'failed')
  assert.equal(failedRecords[0]?.errorCode, 'server_error')
  assert.equal(failedRecords[0]?.errorMessage, 'Generation failed safely.')
})

test('HTTP failures log status and provider code while redacting credentials', async () => {
  const records: ProviderErrorLog[] = []
  const provider = createProvider(
    async () => new Response(JSON.stringify({
      error: {
        message: 'Invalid request with Bearer sk-secretvalue123456',
        type: 'invalid_request_error',
        code: 'bad_request_shape',
      },
    }), { status: 400, headers: { 'content-type': 'application/json' } }),
    (record) => { records.push(record) },
  )

  await assert.rejects(
    provider.generateText({ message: 'hello' }),
    (error) => error instanceof ProviderRequestError && error.code === 'UNAVAILABLE',
  )

  assert.equal(records[0]?.httpStatus, 400)
  assert.equal(records[0]?.errorCode, 'bad_request_shape')
  assert.match(records[0]?.errorMessage ?? '', /\[REDACTED\]/)
  assert.doesNotMatch(records[0]?.errorMessage ?? '', /sk-secretvalue123456/)
})

test('case generation uses the isolated Chat Completions JSON Output adapter', async () => {
  let requestedUrl = ''
  let requestBody: Record<string, unknown> = {}
  const provider = createProvider(async (input, init) => {
    requestedUrl = String(input)
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({
      id: 'chat_case_test',
      object: 'chat.completion',
      model: 'deepseek-v4-flash',
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: '{"case":"ok"}', reasoning_content: null },
        logprobs: null,
      }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  const result = await provider.generateStructuredJson({ instructions: 'Output JSON only.', message: 'Generate JSON.', maxOutputTokens: 8000 })
  assert.equal(requestedUrl, 'https://api.deepseek.com/chat/completions')
  assert.deepEqual(requestBody.response_format, { type: 'json_object' })
  assert.deepEqual(requestBody.thinking, { type: 'disabled' })
  assert.equal(requestBody.max_tokens, 8000)
  assert.equal(result.text, '{"case":"ok"}')
  assert.equal(result.finishReason, 'stop')
})

test('case generation exposes finish_reason length for generator-level retry and truncation reporting', async () => {
  const provider = createProvider(async () => new Response(JSON.stringify({
    id: 'chat_case_truncated',
    object: 'chat.completion',
    model: 'deepseek-v4-flash',
    choices: [{
      index: 0,
      finish_reason: 'length',
      message: { role: 'assistant', content: '{"case":', reasoning_content: null },
      logprobs: null,
    }],
    usage: { prompt_tokens: 1, completion_tokens: 8000, total_tokens: 8001 },
  }), { status: 200, headers: { 'content-type': 'application/json' } }))
  const result = await provider.generateStructuredJson({ instructions: 'Output JSON.', message: 'Generate JSON.', maxOutputTokens: 8000 })
  assert.equal(result.finishReason, 'length')
  assert.equal(result.text, '{"case":')
})
