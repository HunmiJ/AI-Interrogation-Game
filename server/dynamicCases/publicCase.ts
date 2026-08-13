import type { CaseDefinition } from './types'

export function toPublicCaseDefinition(caseDefinition: CaseDefinition) {
  return {
    metadata: caseDefinition.metadata,
    suspects: caseDefinition.suspects.map((suspect) => ({
      id: suspect.id,
      name: suspect.name,
      occupation: suspect.occupation,
      age: suspect.age,
      pronouns: suspect.pronouns,
      personality: suspect.personality,
      publicInformation: suspect.publicInformation,
      status: suspect.status,
      accent: suspect.accent,
      initials: suspect.initials,
      openingLine: suspect.openingLine,
      presetQuestions: suspect.presetQuestions.map((question) => ({
        id: question.id,
        npcId: suspect.id,
        question: question.question,
        tone: 'calm' as const,
      })),
    })),
    timeline: caseDefinition.timeline,
    initialEvidenceIds: caseDefinition.evidence.filter((item) => item.isInitial).map((item) => item.id),
    evidence: caseDefinition.evidence.filter((item) => item.isInitial).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      source: item.source,
      significance: item.significance,
      relatedNpcIds: item.relatedNpcIds,
      isKey: item.isKey,
    })),
    facts: [],
    contradictions: [],
    evidenceTotal: caseDefinition.evidence.length,
  }
}

export type PublicCaseDefinition = ReturnType<typeof toPublicCaseDefinition>
