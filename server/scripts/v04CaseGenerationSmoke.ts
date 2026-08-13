import 'dotenv/config'
import { createHash } from 'node:crypto'
import { createLlmProvider } from '../providers/providerFactory'
import { classicCaseDefinition } from '../dynamicCases/classicCaseDefinition'
import { resolveDynamicCase } from '../dynamicCases/dynamicResolution'
import { interrogateDynamicNpc } from '../dynamicCases/dynamicInterrogation'
import { CaseGenerationError, generateValidatedCase, type CaseTextGenerator, type GenerationAttemptTrace } from '../dynamicCases/generator'
import { toPublicCaseDefinition } from '../dynamicCases/publicCase'
import { validateDynamicInvestigationTurn } from '../dynamicCases/runtime'
import { CaseDefinitionSchema } from '../dynamicCases/schema'
import { validateCaseDefinition } from '../dynamicCases/validator'
import type { DynamicCaseSession } from '../dynamicCases/sessionStore'
import type { DynamicCaseType, GenerationOptions } from '../dynamicCases/types'

const MAX_GENERATION_CALLS = 6
let generationApiCalls = 0

const countingGenerator: CaseTextGenerator = {
  async generate(instructions, template) {
    if (generationApiCalls >= MAX_GENERATION_CALLS) {
      throw new Error(`Generation API call limit (${MAX_GENERATION_CALLS}) reached.`)
    }
    generationApiCalls += 1
    return createLlmProvider().generateStructuredJson({
      instructions,
      message: template,
      maxOutputTokens: 8_000,
    })
  },
}

interface GenerationRun {
  label: string
  options: GenerationOptions
  attempts: number
  session?: DynamicCaseSession
  error?: string
  validationReasons?: string[]
  traces: GenerationAttemptTrace[]
}

function traceSummary(run: GenerationRun) {
  return {
    attemptTrace: run.traces,
    firstJsonParse: run.traces[0]?.jsonParse ?? 'NOT_REACHED',
    truncationOccurred: run.traces.some((trace) => trace.truncation),
    normalizationActions: [...new Set(run.traces.flatMap((trace) => trace.normalizationActions))],
    targetedRepairEntered: run.traces.some((trace) => trace.operation === 'targeted_repair'),
  }
}

function safeSummary(run: GenerationRun) {
  if (!run.session) {
    return {
      label: run.label,
      requestedCrimeType: run.options.caseType,
      difficulty: run.options.difficulty,
      attempts: run.attempts,
      ...traceSummary(run),
      validation: 'FAIL',
      solvability: 'NOT_AVAILABLE',
      error: run.error,
      validationReasons: run.validationReasons,
    }
  }
  const { caseDefinition, validation } = run.session
  const culpritMarkers = caseDefinition.suspects.filter((suspect) => suspect.isCulprit).length
  const unreachableCount = validation.solvability.unreachableFactIds.length
    + validation.solvability.unreachableEvidenceIds.length
    + validation.solvability.unreachableContradictionIds.length
  return {
    label: run.label,
    title: caseDefinition.metadata.title,
    crimeType: caseDefinition.metadata.crimeType,
    difficulty: caseDefinition.metadata.difficulty,
    suspects: caseDefinition.suspects.length,
    facts: caseDefinition.facts.length,
    evidence: caseDefinition.evidence.length,
    contradictions: caseDefinition.contradictions.length,
    culpritUnique: culpritMarkers === 1 && caseDefinition.suspects.some((suspect) => suspect.id === caseDefinition.culpritId && suspect.isCulprit),
    attempts: run.attempts,
    ...traceSummary(run),
    schemaValidation: CaseDefinitionSchema.safeParse(caseDefinition).success ? 'PASS' : 'FAIL',
    caseValidator: validation.valid ? 'PASS' : 'FAIL',
    solvability: validation.solvability.valid ? 'PASS' : 'FAIL',
    unreachableNodes: unreachableCount,
    dependencyCycles: validation.solvability.dependencyCycles.length,
    qualityRules: validation.valid ? 'PASS' : 'FAIL',
  }
}

async function generateOne(label: string, caseType: Exclude<DynamicCaseType, 'random'>): Promise<GenerationRun> {
  const options: GenerationOptions = { caseType, difficulty: 'normal' }
  const before = generationApiCalls
  const traces: GenerationAttemptTrace[] = []
  try {
    const session = await generateValidatedCase(options, { generator: countingGenerator, attemptObserver: (trace) => traces.push(trace) })
    return { label, options, attempts: generationApiCalls - before, session, traces }
  } catch (error) {
    return {
      label,
      options,
      attempts: generationApiCalls - before,
      error: error instanceof Error ? error.message : 'Unknown generation failure.',
      validationReasons: error instanceof CaseGenerationError ? error.safeReasons : undefined,
      traces,
    }
  }
}

function semanticFingerprint(session: DynamicCaseSession) {
  const definition = session.caseDefinition
  const semanticShape = {
    crimeType: definition.metadata.crimeType,
    summary: definition.metadata.summary,
    objective: definition.metadata.objective,
    missingItems: definition.metadata.missingItems,
    factSemantics: definition.facts.map(({ category, title, description }) => ({ category, title, description })),
    evidenceSemantics: definition.evidence.map(({ category, title, significance }) => ({ category, title, significance })),
    contradictionSemantics: definition.contradictions.map(({ title, description }) => ({ title, description })),
  }
  return createHash('sha256').update(JSON.stringify(semanticShape)).digest('hex')
}

async function verifyDynamicEngine(session: DynamicCaseSession) {
  const definition = session.caseDefinition
  const publicCase = toPublicCaseDefinition(definition)
  if (publicCase.suspects.length !== 3) throw new Error('Dynamic briefing did not expose exactly three public NPCs.')
  const serializedPublicCase = JSON.stringify(publicCase)
  if (/privateInformation|truthStrategy|confession|culpritId/.test(serializedPublicCase)) {
    throw new Error('Dynamic public case leaked private solution fields.')
  }

  const presetOwner = definition.suspects.find((suspect) => suspect.presetQuestions.some((question) => question.revealFactIds.length > 0))
    ?? definition.suspects[0]
  const preset = presetOwner.presetQuestions.find((question) => question.revealFactIds.length > 0)
    ?? presetOwner.presetQuestions[0]
  const liveResult = await interrogateDynamicNpc({
    caseSessionId: session.sessionId,
    npcId: presetOwner.id,
    message: `先明确说明你的姓名和职业，再回答这个问题：${preset.question}`,
    conversationHistory: [],
    discoveredEvidenceIds: publicCase.initialEvidenceIds,
    discoveredFactIds: [],
    discoveredContradictionIds: [],
  })
  const identityGrounded = liveResult.reply.includes(presetOwner.name) || liveResult.reply.includes(presetOwner.occupation)
  if (!liveResult.reply.trim() || !identityGrounded) throw new Error('Dynamic NPC live reply was empty or not grounded in its generated identity.')

  const evidenceWithFactUnlock = definition.evidence.find((item) => !item.isInitial && item.unlockRequirements?.type === 'fact')
  if (!evidenceWithFactUnlock?.unlockRequirements) throw new Error('No fact-driven evidence path was available for engine verification.')
  const targetFactId = evidenceWithFactUnlock.unlockRequirements.ids[0]
  const targetFact = definition.facts.find((fact) => fact.id === targetFactId)
  if (!targetFact) throw new Error('Fact-driven evidence referenced an unknown fact.')
  const priorFactIds = evidenceWithFactUnlock.unlockRequirements.ids.filter((id) => id !== targetFactId)
  const evidenceAtTurnStart = [...new Set([
    ...publicCase.initialEvidenceIds,
    ...targetFact.requiredEvidenceIds,
  ])]
  const directTurn = validateDynamicInvestigationTurn({
    npcId: targetFact.npcId,
    message: '请说明这个事实。',
    conversationHistory: [],
    discoveredEvidenceIds: evidenceAtTurnStart,
    discoveredFactIds: [...new Set([...priorFactIds, ...targetFact.prerequisiteFactIds])],
    discoveredContradictionIds: [],
  }, [targetFact.id], [], definition)
  if (!directTurn.acceptedFactIds.includes(targetFact.id) || !directTurn.unlockedEvidenceIds.includes(evidenceWithFactUnlock.id)) {
    throw new Error('Dynamic fact discovery/evidence unlock path did not advance.')
  }

  const contradiction = definition.contradictions.find((item) => item.requiredPresentedEvidenceIds.length > 0)
  if (!contradiction) throw new Error('No player-presented contradiction path was available.')
  const presentationMessage = contradiction.requiredPresentedEvidenceIds
    .map((id) => definition.evidence.find((item) => item.id === id)?.presentationKeywords[0])
    .filter((keyword): keyword is string => Boolean(keyword))
    .join('，')
  const contradictionTurn = validateDynamicInvestigationTurn({
    npcId: contradiction.npcId,
    message: `我出示这些证据质问你：${presentationMessage}`,
    conversationHistory: [],
    discoveredEvidenceIds: contradiction.requiredEvidenceIds,
    discoveredFactIds: contradiction.requiredFactIds,
    discoveredContradictionIds: [],
  }, [], [], definition)
  if (!contradictionTurn.contradictionIds.includes(contradiction.id)) {
    throw new Error('Dynamic player-presented contradiction path did not advance.')
  }

  const solvability = session.validation.solvability
  const resolution = resolveDynamicCase(definition, {
    accusedNpcId: definition.culpritId,
    discoveredEvidenceIds: solvability.reachableEvidenceIds,
    discoveredFactIds: solvability.reachableFactIds,
    discoveredContradictionIds: solvability.reachableContradictionIds,
    questionCount: 14,
    interrogatedNpcIds: definition.suspects.map((suspect) => suspect.id),
  })
  if (!resolution.correct || resolution.score.total < 80 || resolution.score.total > 100) {
    throw new Error('Dynamic deterministic scoring/resolution did not produce a valid investigated result.')
  }

  return {
    sessionCreated: true,
    briefing: true,
    npcCount: publicCase.suspects.length,
    liveNpcInterrogation: true,
    identityGrounded,
    liveAiAcceptedFacts: liveResult.revealedFactIds.length,
    factDiscovery: true,
    evidenceUnlock: true,
    contradiction: true,
    notebookRecordsAvailable: definition.facts.some((fact) => fact.id === targetFact.id)
      && definition.evidence.some((evidence) => evidence.id === evidenceWithFactUnlock.id)
      && definition.contradictions.some((item) => item.id === contradiction.id),
    scoring: true,
    score: resolution.score.total,
  }
}

async function main() {
  const classicValidation = validateCaseDefinition(classicCaseDefinition)
  if (!classicValidation.valid) throw new Error('Classic Case regression validation failed before generation.')

  const runs = [
    await generateOne('Case 1', 'theft'),
    await generateOne('Case 2', 'data-leak'),
  ]
  for (const run of runs) console.log(`[v04-real-generation] ${JSON.stringify(safeSummary(run))}`)
  if (generationApiCalls > MAX_GENERATION_CALLS) throw new Error('Generation API call cap was exceeded.')

  const successful = runs.filter((run): run is GenerationRun & { session: DynamicCaseSession } => Boolean(run.session))
  if (successful.length === 2) {
    const [first, second] = successful.map((run) => run.session)
    const distinct = first.caseDefinition.metadata.crimeType !== second.caseDefinition.metadata.crimeType
      && first.caseDefinition.metadata.caseId !== second.caseDefinition.metadata.caseId
      && semanticFingerprint(first) !== semanticFingerprint(second)
    if (!distinct) throw new Error('The generated cases were reused or only cosmetically different.')
    console.log('[v04-real-generation] distinct-case-definitions=PASS')
  }

  if (!successful.length) throw new Error('Neither generated case passed validation; no dynamic session could be verified.')
  const engine = await verifyDynamicEngine(successful[0].session)
  console.log(`[v04-real-generation] dynamic-engine=${JSON.stringify(engine)}`)
  console.log(`[v04-real-generation] classic-case=PASS generation-api-calls=${generationApiCalls}/${MAX_GENERATION_CALLS}`)
  if (successful.length !== 2) throw new Error('One of the two required dynamic cases did not pass generation validation.')
}

main().catch((error: unknown) => {
  console.error(`[v04-real-generation] failed=${error instanceof Error ? error.message : 'Unknown failure.'}`)
  console.error(`[v04-real-generation] generation-api-calls=${generationApiCalls}/${MAX_GENERATION_CALLS}`)
  process.exitCode = 1
})
