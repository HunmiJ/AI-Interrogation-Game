import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { InterrogationError, interrogateNpc } from './services/interrogationService'
import type { InterrogateInput, InterrogateResult } from './types/agent'
import { resolveCase } from './data/caseResolution'
import { getProviderStatus } from './providers/providerConfig'
import { isLlmLive } from './services/llmRuntimeStatus'
import { CaseGenerationError, generateValidatedCase } from './dynamicCases/generator'
import { toPublicCaseDefinition } from './dynamicCases/publicCase'
import { dynamicCaseSessionStore } from './dynamicCases/sessionStore'
import { resolveDynamicCase } from './dynamicCases/dynamicResolution'
import type { GenerationOptions } from './dynamicCases/types'

const requestSchema = z.object({
  caseSessionId: z.string().uuid().optional(),
  npcId: z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/),
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
type GenerateCaseHandler = (options: GenerationOptions) => ReturnType<typeof generateValidatedCase>

export function createApp(options: { interrogate?: InterrogateHandler; generateCase?: GenerateCaseHandler } = {}) {
  const app = express()
  const handler = options.interrogate ?? interrogateNpc
  const generationHandler = options.generateCase ?? generateValidatedCase
  let generationInProgress = false

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

    if (!parsed.data.caseSessionId && !['jack', 'alice', 'tom'].includes(parsed.data.npcId)) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: '审讯请求格式无效。', retryable: false } })
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

  app.post('/api/cases/generate', async (request, response) => {
    const parsed = z.object({
      caseType: z.enum(['random', 'theft', 'data-leak', 'fraud', 'item-swap']),
      difficulty: z.enum(['easy', 'normal', 'hard']),
    }).strict().safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: { code: 'INVALID_GENERATION_OPTIONS', message: '案件生成参数无效。', retryable: false } })
      return
    }
    try {
      if (generationInProgress) throw new CaseGenerationError('GENERATION_BUSY', '已有案件正在生成，请稍候。', 409, true)
      generationInProgress = true
      const session = await generationHandler(parsed.data)
      response.json({
        sessionId: session.sessionId,
        case: toPublicCaseDefinition(session.caseDefinition),
        generation: {
          attempts: session.generationAttempts,
          retryCount: session.retryCount,
          validationPassed: session.validation.valid,
          solvabilityPassed: session.validation.solvability.valid,
        },
      })
    } catch (error) {
      const known = error instanceof CaseGenerationError
        ? error
        : new CaseGenerationError('GENERATOR_UNAVAILABLE', '本次案件生成失败，请重新生成。', 503, true)
      response.status(known.status).json({
        error: {
          code: known.code,
          message: known.message,
          retryable: known.retryable,
          reason: known.safeReasons[0] ?? (known.code === 'GENERATOR_OFFLINE' ? 'AI CASE GENERATOR OFFLINE' : '案件证据链未通过完整性验证。'),
        },
      })
    } finally {
      generationInProgress = false
    }
  })

  app.post('/api/case/resolve', (request, response) => {
    const parsed = z.object({
      caseSessionId: z.string().uuid().optional(),
      accusedNpcId: z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/),
      discoveredEvidenceIds: z.array(z.string().min(1).max(80)).max(16).default([]),
      discoveredFactIds: z.array(z.string().min(1).max(80)).max(32).default([]),
      discoveredContradictionIds: z.array(z.string().min(1).max(80)).max(16).default([]),
      questionCount: z.number().int().min(0).max(500).default(0),
      interrogatedNpcIds: z.array(z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/)).max(3).default([]),
    }).strict().safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: { code: 'INVALID_ACCUSATION', message: '指认对象无效。', retryable: false } })
      return
    }
    if (parsed.data.caseSessionId) {
      const session = dynamicCaseSessionStore.get(parsed.data.caseSessionId)
      if (!session) {
        response.status(404).json({ error: { code: 'CASE_SESSION_NOT_FOUND', message: '动态案件会话已失效，请重新生成。', retryable: false } })
        return
      }
      if (!session.caseDefinition.suspects.some((item) => item.id === parsed.data.accusedNpcId)) {
        response.status(400).json({ error: { code: 'INVALID_ACCUSATION', message: '指认对象无效。', retryable: false } })
        return
      }
      response.json(resolveDynamicCase(session.caseDefinition, parsed.data))
      return
    }
    if (!['jack', 'alice', 'tom'].includes(parsed.data.accusedNpcId)) {
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
