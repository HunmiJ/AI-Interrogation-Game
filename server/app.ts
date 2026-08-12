import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { InterrogationError, interrogateNpc } from './services/interrogationService'
import type { InterrogateInput, InterrogateResult } from './types/agent'
import { resolveCase } from './data/caseResolution'
import { getProviderStatus } from './providers/providerConfig'
import { isLlmLive } from './services/llmRuntimeStatus'

const requestSchema = z.object({
  npcId: z.enum(['jack', 'alice', 'tom']),
  message: z.string().trim().min(1).max(500),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(800),
  }).strict()).max(30),
  discoveredEvidenceIds: z.array(z.string().min(1).max(80)).max(16),
  presentedEvidenceIds: z.array(z.string().min(1).max(80)).max(16).default([]),
  discoveredFactIds: z.array(z.string().min(1).max(80)).max(32).default([]),
  discoveredContradictionIds: z.array(z.string().min(1).max(80)).max(16).default([]),
}).strict()

type InterrogateHandler = (input: InterrogateInput) => Promise<InterrogateResult>

export function createApp(options: { interrogate?: InterrogateHandler } = {}) {
  const app = express()
  const handler = options.interrogate ?? interrogateNpc

  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_request, response) => {
    try {
      const status = getProviderStatus()
      response.json({
        ok: true,
        provider: status.provider,
        configured: status.configured,
        available: status.configured && isLlmLive(),
      })
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'LLM Provider 配置无效。',
      })
    }
  })

  app.post('/api/interrogate', async (request, response) => {
    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '审讯请求格式无效。',
          retryable: false,
        },
      })
      return
    }

    try {
      const result = await handler(parsed.data)
      response.json(result)
    } catch (error) {
      const knownError = error instanceof InterrogationError
        ? error
        : new InterrogationError('INTERNAL_ERROR', '审讯服务出现错误，请稍后重试。', 500, true)

      response.status(knownError.status).json({
        error: {
          code: knownError.code,
          message: knownError.message,
          retryable: knownError.retryable,
        },
      })
    }
  })

  app.post('/api/case/resolve', (request, response) => {
    const parsed = z.object({
      accusedNpcId: z.enum(['jack', 'alice', 'tom']),
      discoveredEvidenceIds: z.array(z.string().min(1).max(80)).max(16).default([]),
      discoveredFactIds: z.array(z.string().min(1).max(80)).max(32).default([]),
      discoveredContradictionIds: z.array(z.string().min(1).max(80)).max(16).default([]),
      questionCount: z.number().int().min(0).max(500).default(0),
      interrogatedNpcIds: z.array(z.enum(['jack', 'alice', 'tom'])).max(3).default([]),
    }).strict().safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: { code: 'INVALID_ACCUSATION', message: '指认对象无效。', retryable: false } })
      return
    }
    response.json(resolveCase(parsed.data))
  })

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const distDirectory = path.resolve(currentDirectory, '..', 'dist')
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(path.join(distDirectory, 'index.html'))
  })

  return app
}
