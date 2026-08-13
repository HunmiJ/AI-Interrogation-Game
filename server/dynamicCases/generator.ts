import { ProviderConfigurationError, ProviderRequestError } from '../providers/errors'
import { createLlmProvider } from '../providers/providerFactory'
import {
  buildCaseGenerationInstructions,
  buildInitialGenerationMessage,
  buildTargetedRepairInstructions,
  buildTargetedRepairMessage,
} from './generationPrompt'
import {
  compileGeneratedCaseDraft,
  draftGenerationQualityIssues,
  draftSchemaIssues,
  GeneratedCaseDraftSchema,
  normalizeGeneratedCaseDraftWithReport,
  type DraftRepairIssue,
  type GeneratedCaseDraft,
} from './generatedCaseDraft'
import { dynamicCaseSessionStore, type DynamicCaseSessionStore } from './sessionStore'
import { summarizeValidationIssues, validateCaseDefinition } from './validator'
import type { GenerationOptions } from './types'

export class CaseGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly safeReasons: string[] = [],
  ) { super(message) }
}

export interface CaseTextGenerator {
  generate(instructions: string, message: string): Promise<string | { text: string; finishReason: string | null }>
}

export interface GenerationAttemptTrace {
  attempt: number
  operation: 'generation' | 'targeted_repair'
  jsonParse: 'PASS' | 'FAIL'
  truncation: boolean
  normalizationActions: string[]
  targetedRepair: 'NOT_USED' | 'PASS' | 'FAIL'
  draftSchema: 'NOT_REACHED' | 'PASS' | 'FAIL'
  caseValidator: 'NOT_REACHED' | 'PASS' | 'FAIL'
  dependencyCycle: 'NOT_REACHED' | 'PASS' | 'FAIL'
  solvability: 'NOT_REACHED' | 'PASS' | 'FAIL'
  failureCategories: string[]
}

class ProviderCaseTextGenerator implements CaseTextGenerator {
  async generate(instructions: string, message: string) {
    return createLlmProvider().generateStructuredJson({
      instructions,
      message,
      maxOutputTokens: 8_000,
    })
  }
}

export type GeneratedJsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'EMPTY_OUTPUT' | 'TRUNCATED_JSON' | 'INVALID_JSON' }

export function parseGeneratedCaseJson(output: string, finishReason: string | null = null): GeneratedJsonParseResult {
  const clean = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  if (!clean) return { ok: false, reason: 'EMPTY_OUTPUT' }
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (finishReason === 'length' || start >= 0 && end <= start) return { ok: false, reason: 'TRUNCATED_JSON' }
  if (start < 0) return { ok: false, reason: 'INVALID_JSON' }
  try {
    return { ok: true, value: JSON.parse(clean.slice(start, end + 1)) as unknown }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { ok: false, reason: /end of json|unterminated|unexpected end/i.test(message) ? 'TRUNCATED_JSON' : 'INVALID_JSON' }
  }
}

function pathParts(path: string) {
  return [...path.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((match) => match[2] == null ? match[1] : Number(match[2])) as Array<string | number>
}

function applyPath(target: unknown, path: string, value: unknown) {
  const parts = pathParts(path)
  if (!parts.length || !target || typeof target !== 'object') return false
  let current: unknown = target
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    if (!current || typeof current !== 'object' || !(part in current)) return false
    current = (current as Record<string | number, unknown>)[part]
  }
  const last = parts.at(-1)!
  if (!current || typeof current !== 'object') return false
  ;(current as Record<string | number, unknown>)[last] = structuredClone(value)
  return true
}

function idsIn(value: unknown, result = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => idsIn(item, result))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'id' && typeof item === 'string') result.add(item)
      idsIn(item, result)
    }
  }
  return result
}

export interface TargetedRepairResult {
  accepted: boolean
  candidate: unknown
  rejectedPaths: string[]
  reason?: string
}

export function applyTargetedRepairs(candidate: unknown, repairOutput: unknown, issues: DraftRepairIssue[]): TargetedRepairResult {
  if (!candidate || typeof candidate !== 'object') return { accepted: false, candidate, rejectedPaths: [], reason: 'NO_BASE_CANDIDATE' }
  if (!repairOutput || typeof repairOutput !== 'object' || !Array.isArray((repairOutput as { repairs?: unknown }).repairs)) {
    return { accepted: false, candidate, rejectedPaths: [], reason: 'INVALID_REPAIR_ENVELOPE' }
  }
  const repairs = (repairOutput as { repairs: unknown[] }).repairs
  const allowedPaths = new Set(issues.map((issue) => issue.path))
  const original = structuredClone(candidate)
  const repaired = structuredClone(candidate)
  const originalCulprit = (original as { culpritId?: unknown }).culpritId
  const originalIds = idsIn(original)
  const rejectedPaths: string[] = []
  for (const repair of repairs) {
    if (!repair || typeof repair !== 'object') { rejectedPaths.push('<invalid>'); continue }
    const { path, value } = repair as { path?: unknown; value?: unknown }
    if (typeof path !== 'string' || !allowedPaths.has(path) || !applyPath(repaired, path, value)) {
      rejectedPaths.push(typeof path === 'string' ? path : '<invalid>')
    }
  }
  if (rejectedPaths.length) return { accepted: false, candidate: original, rejectedPaths, reason: 'REPAIR_PATH_NOT_ALLOWED' }
  const culpritCanChange = issues.some((issue) => issue.path === 'culpritId')
  if (!culpritCanChange && (repaired as { culpritId?: unknown }).culpritId !== originalCulprit) {
    return { accepted: false, candidate: original, rejectedPaths: ['culpritId'], reason: 'CULPRIT_CHANGE_BLOCKED' }
  }
  const repairedIds = idsIn(repaired)
  const removedIds = [...originalIds].filter((id) => !repairedIds.has(id))
  const addedIds = [...repairedIds].filter((id) => !originalIds.has(id))
  const additionsAllowed = issues.some((issue) => issue.error === 'MIN_ITEMS' || issue.error === 'MISSING_OR_INVALID_TYPE')
  if (removedIds.length || addedIds.length && !additionsAllowed) {
    return { accepted: false, candidate: original, rejectedPaths: [...removedIds, ...addedIds], reason: 'VALID_ID_CHANGE_BLOCKED' }
  }
  return { accepted: true, candidate: repaired, rejectedPaths: [] }
}

function validatorRepairIssues(result: ReturnType<typeof validateCaseDefinition>, draft: GeneratedCaseDraft): DraftRepairIssue[] {
  return result.issues.slice(0, 10).map((issue) => {
    let path = issue.path
    if (issue.code.startsWith('CULPRIT_') && issue.code !== 'CULPRIT_CHAIN_INCOMPLETE') path = 'culpritId'
    else if (issue.code === 'CULPRIT_CHAIN_INCOMPLETE' || issue.code.startsWith('EVIDENCE_') || issue.code.startsWith('INITIAL_EVIDENCE')) path = 'evidence'
    else if (issue.code.startsWith('FACT_') || issue.code === 'INTERROGATION_PATH_MISSING') path = 'facts'
    else if (issue.code.startsWith('CONTRADICTION_') || issue.code === 'PRESENTATION_PATH_MISSING') path = 'contradictions'
    else if (issue.code === 'TIMELINE_INCOHERENT') path = 'timeline'
    else if (issue.code.startsWith('SCORING_')) path = issue.path.includes('Fact') ? 'facts' : 'evidence'
    else {
      const suspect = draft.suspects.findIndex((item) => issue.path.includes(item.id))
      if (suspect >= 0) {
        if (issue.code.startsWith('PRESET_')) path = `suspects[${suspect}].presetQuestions`
        else if (issue.code.startsWith('RELATIONSHIP_')) path = `suspects[${suspect}].relationshipWithOthers`
        else if (issue.code.includes('PUBLIC')) path = `suspects[${suspect}].publicInformation`
        else if (issue.code.includes('OPENING')) path = `suspects[${suspect}].openingLine`
        else path = `suspects[${suspect}]`
      } else if (issue.code === 'RED_HERRING_MISSING' || issue.code === 'INNOCENT_SUSPICION_WEAK') path = 'suspects'
    }
    return { path, error: issue.code, message: issue.message }
  })
}

function parseOutput(output: string | { text: string; finishReason: string | null }) {
  return typeof output === 'string'
    ? parseGeneratedCaseJson(output)
    : parseGeneratedCaseJson(output.text, output.finishReason)
}

export async function generateValidatedCase(
  options: GenerationOptions,
  dependencies: {
    generator?: CaseTextGenerator
    store?: DynamicCaseSessionStore
    attemptObserver?: (trace: GenerationAttemptTrace) => void
  } = {},
) {
  const generator = dependencies.generator ?? new ProviderCaseTextGenerator()
  const store = dependencies.store ?? dynamicCaseSessionStore
  let candidate: unknown
  let repairIssues: DraftRepairIssue[] = []
  let lastReasons: string[] = []
  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const repairing = candidate !== undefined && repairIssues.length > 0
      const trace: GenerationAttemptTrace = {
        attempt,
        operation: repairing ? 'targeted_repair' : 'generation',
        jsonParse: 'FAIL', truncation: false, normalizationActions: [],
        targetedRepair: repairing ? 'FAIL' : 'NOT_USED', draftSchema: 'NOT_REACHED',
        caseValidator: 'NOT_REACHED', dependencyCycle: 'NOT_REACHED', solvability: 'NOT_REACHED',
        failureCategories: [],
      }
      const output = await generator.generate(
        repairing ? buildTargetedRepairInstructions(options) : buildCaseGenerationInstructions(options),
        repairing ? buildTargetedRepairMessage(candidate, repairIssues) : buildInitialGenerationMessage(),
      )
      const parsedOutput = parseOutput(output)
      if (!parsedOutput.ok) {
        trace.truncation = parsedOutput.reason === 'TRUNCATED_JSON'
        trace.failureCategories.push(parsedOutput.reason)
        dependencies.attemptObserver?.(trace)
        lastReasons = [`${parsedOutput.reason}: 案件 JSON 未完整生成。`]
        candidate = undefined
        repairIssues = []
        continue
      }
      trace.jsonParse = 'PASS'

      if (repairing) {
        const repairResult = applyTargetedRepairs(candidate, parsedOutput.value, repairIssues)
        if (!repairResult.accepted) {
          trace.failureCategories.push('TARGETED_REPAIR_REJECTED')
          dependencies.attemptObserver?.(trace)
          lastReasons = [`TARGETED_REPAIR_REJECTED: ${repairResult.reason ?? 'unknown'}`]
          continue
        }
        trace.targetedRepair = 'PASS'
        candidate = repairResult.candidate
      } else {
        candidate = parsedOutput.value
      }

      const normalization = normalizeGeneratedCaseDraftWithReport(candidate)
      candidate = normalization.candidate
      trace.normalizationActions = normalization.actions
      repairIssues = draftSchemaIssues(candidate)
      if (repairIssues.length) {
        trace.draftSchema = 'FAIL'
        trace.failureCategories.push(...[...new Set(repairIssues.map((issue) => issue.error))])
        dependencies.attemptObserver?.(trace)
        lastReasons = repairIssues.map((issue) => `${issue.error}: ${issue.path} ${issue.message}`).slice(0, 10)
        continue
      }
      trace.draftSchema = 'PASS'

      const draft = GeneratedCaseDraftSchema.parse(candidate) as GeneratedCaseDraft
      const generationQualityIssues = draftGenerationQualityIssues(draft, options)
      if (generationQualityIssues.length) {
        repairIssues = generationQualityIssues
        trace.failureCategories.push(...[...new Set(generationQualityIssues.map((issue) => issue.error))])
        dependencies.attemptObserver?.(trace)
        lastReasons = generationQualityIssues.map((issue) => `${issue.error}: ${issue.path} ${issue.message}`).slice(0, 10)
        continue
      }
      const caseDefinition = compileGeneratedCaseDraft(draft, options)
      const validation = validateCaseDefinition(caseDefinition)
      if (!validation.valid) {
        trace.caseValidator = 'FAIL'
        trace.dependencyCycle = validation.solvability.dependencyCycles.length ? 'FAIL' : 'PASS'
        trace.solvability = validation.solvability.valid ? 'PASS' : 'FAIL'
        trace.failureCategories.push(...[...new Set(validation.issues.map((issue) => issue.code))])
        dependencies.attemptObserver?.(trace)
        repairIssues = validatorRepairIssues(validation, draft)
        lastReasons = summarizeValidationIssues(validation)
        continue
      }
      trace.caseValidator = 'PASS'
      trace.dependencyCycle = 'PASS'
      trace.solvability = 'PASS'
      dependencies.attemptObserver?.(trace)
      const session = store.create({
        caseDefinition,
        validation,
        generationAttempts: attempt,
        retryCount: attempt - 1,
        options,
      })
      return session
    }
    throw new CaseGenerationError(
      'GENERATION_VALIDATION_FAILED',
      '本次案件生成失败，请重新生成。',
      422,
      true,
      lastReasons.length ? lastReasons : ['案件证据链未通过完整性验证。'],
    )
  } catch (error) {
    if (error instanceof CaseGenerationError) throw error
    if (error instanceof ProviderConfigurationError) throw new CaseGenerationError('GENERATOR_OFFLINE', 'AI CASE GENERATOR OFFLINE', 503, false)
    if (error instanceof ProviderRequestError) throw new CaseGenerationError('GENERATOR_UNAVAILABLE', 'AI CASE GENERATOR OFFLINE', error.code === 'TIMEOUT' ? 504 : 503, error.retryable)
    throw new CaseGenerationError('GENERATOR_UNAVAILABLE', '本次案件生成失败，请重新生成。', 503, true)
  }
}
