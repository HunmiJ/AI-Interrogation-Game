import 'dotenv/config'
import { createLlmProvider } from '../providers/providerFactory'
import { CaseGenerationError, generateValidatedCase, type CaseTextGenerator, type GenerationAttemptTrace } from '../dynamicCases/generator'
import { toPublicCaseDefinition } from '../dynamicCases/publicCase'
import { dynamicCaseSessionStore } from '../dynamicCases/sessionStore'

const MAX_GENERATION_CALLS = 3
let generationApiCalls = 0
const traces: GenerationAttemptTrace[] = []

const limitedGenerator: CaseTextGenerator = {
  async generate(instructions, message) {
    if (generationApiCalls >= MAX_GENERATION_CALLS) throw new Error('Data Leak generation call cap reached.')
    generationApiCalls += 1
    return createLlmProvider().generateStructuredJson({ instructions, message, maxOutputTokens: 8_000 })
  },
}

function traceSummary() {
  return traces.map((trace) => ({
    attempt: trace.attempt,
    operation: trace.operation,
    jsonParse: trace.jsonParse,
    truncation: trace.truncation,
    normalizationActions: trace.normalizationActions,
    targetedRepair: trace.targetedRepair,
    draftSchema: trace.draftSchema,
    caseValidator: trace.caseValidator,
    dependencyCycle: trace.dependencyCycle,
    solvability: trace.solvability,
    failureCategories: trace.failureCategories,
  }))
}

async function main() {
  dynamicCaseSessionStore.clear()
  try {
    const session = await generateValidatedCase(
      { caseType: 'data-leak', difficulty: 'normal' },
      { generator: limitedGenerator, attemptObserver: (trace) => traces.push(trace) },
    )
    if (generationApiCalls > MAX_GENERATION_CALLS) throw new Error('Generation API call cap was exceeded.')
    const definition = session.caseDefinition
    const validation = session.validation
    const publicCase = toPublicCaseDefinition(definition)
    const culpritUnique = definition.suspects.filter((suspect) => suspect.isCulprit).length === 1
      && definition.suspects.some((suspect) => suspect.id === definition.culpritId && suspect.isCulprit)
    const sessionStored = dynamicCaseSessionStore.get(session.sessionId)?.sessionId === session.sessionId
    const gameEngineReady = sessionStored
      && publicCase.metadata.mode === 'dynamic'
      && publicCase.metadata.crimeType === 'data-leak'
      && publicCase.suspects.length === 3
      && publicCase.initialEvidenceIds.length > 0
    console.log(`[v04-data-leak-final] ${JSON.stringify({
      result: 'PASS',
      title: definition.metadata.title,
      crimeType: definition.metadata.crimeType,
      attempts: session.generationAttempts,
      attemptTrace: traceSummary(),
      exampleReuseEncountered: traces.some((trace) => trace.failureCategories.includes('EXAMPLE_REUSE')),
      semanticMismatchEncountered: traces.some((trace) => trace.failureCategories.includes('CRIME_TYPE_SEMANTIC_MISMATCH')),
      finalExampleReuseValidation: 'PASS',
      finalCrimeTypeSemanticValidation: 'PASS',
      draftSchema: 'PASS',
      caseValidator: validation.valid ? 'PASS' : 'FAIL',
      dependencyCycle: validation.solvability.dependencyCycles.length === 0 ? 'PASS' : 'FAIL',
      solvability: validation.solvability.valid ? 'PASS' : 'FAIL',
      unreachableNodes: validation.solvability.unreachableFactIds.length
        + validation.solvability.unreachableEvidenceIds.length
        + validation.solvability.unreachableContradictionIds.length,
      suspects: definition.suspects.length,
      facts: definition.facts.length,
      evidence: definition.evidence.length,
      contradictions: definition.contradictions.length,
      culpritUnique,
      dynamicSessionCreated: sessionStored,
      gameEngineReady,
      generationApiCalls: `${generationApiCalls}/${MAX_GENERATION_CALLS}`,
    })}`)
    if (!validation.valid || !validation.solvability.valid || !culpritUnique || !gameEngineReady) process.exitCode = 1
  } catch (error) {
    console.error(`[v04-data-leak-final] ${JSON.stringify({
      result: 'FAIL',
      attempts: generationApiCalls,
      attemptTrace: traceSummary(),
      exampleReuseEncountered: traces.some((trace) => trace.failureCategories.includes('EXAMPLE_REUSE')),
      semanticMismatchEncountered: traces.some((trace) => trace.failureCategories.includes('CRIME_TYPE_SEMANTIC_MISMATCH')),
      validatorReasons: error instanceof CaseGenerationError ? error.safeReasons : [error instanceof Error ? error.message : 'Unknown failure.'],
      generationApiCalls: `${generationApiCalls}/${MAX_GENERATION_CALLS}`,
    })}`)
    process.exitCode = 1
  }
}

void main()
