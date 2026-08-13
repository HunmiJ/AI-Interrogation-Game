import type { CaseData, DialogueOption, Evidence, NPC, RuntimeCaseData } from '../types/game'
import type { CaseDifficultyOption, CaseTypeOption } from '../components/caseGenerationModel'

export type { CaseDifficultyOption, CaseTypeOption } from '../components/caseGenerationModel'

interface GeneratedCasePayload {
  sessionId: string
  case: {
    metadata: {
      mode: 'dynamic'; caseId: string; title: string; subtitle: string; caseNumber: string; summary: string
      location: string; incidentTime: string; difficulty: CaseDifficultyOption; estimatedMinutes: number
      objective: string; missingItems: string[]
    }
    suspects: Array<NPC & { openingLine: string; presetQuestions: DialogueOption[] }>
    timeline: CaseData['timeline']
    initialEvidenceIds: string[]
    evidence: Evidence[]
    facts: RuntimeCaseData['facts']
    contradictions: RuntimeCaseData['contradictions']
    evidenceTotal: number
  }
  generation: { attempts: number; retryCount: number; validationPassed: boolean; solvabilityPassed: boolean }
}

export class DynamicCaseApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean, public readonly reason?: string) { super(message) }
}

export async function generateDynamicCase(options: { caseType: CaseTypeOption; difficulty: CaseDifficultyOption }) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 185_000)
  try {
    const response = await fetch('/api/cases/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify(options),
    })
    const payload = await response.json().catch(() => null) as GeneratedCasePayload | { error?: { code?: string; message?: string; retryable?: boolean; reason?: string } } | null
    if (!response.ok || !payload || !('case' in payload)) {
      const error = payload && 'error' in payload ? payload.error : undefined
      throw new DynamicCaseApiError(error?.code ?? 'GENERATION_FAILED', error?.message ?? '本次案件生成失败，请重新生成。', error?.retryable ?? true, error?.reason)
    }
    const generated = payload as GeneratedCasePayload
    const runtimeCase: RuntimeCaseData = {
      mode: 'dynamic', sessionId: generated.sessionId,
      case: {
        id: generated.case.metadata.caseId, title: generated.case.metadata.title,
        subtitle: generated.case.metadata.subtitle, caseNumber: generated.case.metadata.caseNumber,
        location: generated.case.metadata.location, occurredAt: generated.case.metadata.incidentTime,
        difficulty: ({ easy: '简单', normal: '普通', hard: '较难' } as const)[generated.case.metadata.difficulty],
        estimatedMinutes: generated.case.metadata.estimatedMinutes, summary: generated.case.metadata.summary,
        objective: generated.case.metadata.objective, stolenItems: generated.case.metadata.missingItems,
        initialEvidenceIds: generated.case.initialEvidenceIds,
        npcIds: generated.case.suspects.map((item) => item.id), timeline: generated.case.timeline,
      },
      npcs: generated.case.suspects.map(({ openingLine: _opening, presetQuestions: _questions, ...npc }) => npc),
      evidence: generated.case.evidence,
      dialogueOptions: generated.case.suspects.flatMap((item) => item.presetQuestions),
      openingLines: Object.fromEntries(generated.case.suspects.map((item) => [item.id, item.openingLine])),
      facts: generated.case.facts,
      contradictions: generated.case.contradictions,
      evidenceTotal: generated.case.evidenceTotal,
    }
    return { runtimeCase, generation: generated.generation }
  } catch (error) {
    if (error instanceof DynamicCaseApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new DynamicCaseApiError('GENERATION_TIMEOUT', '案件生成超时，请重新生成。', true)
    throw new DynamicCaseApiError('GENERATOR_OFFLINE', 'AI CASE GENERATOR OFFLINE', true)
  } finally { window.clearTimeout(timeout) }
}
