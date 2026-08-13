import type { AgentEmotion } from '../types/agent'

export type DynamicCaseType = 'random' | 'theft' | 'data-leak' | 'fraud' | 'item-swap'
export type DynamicDifficulty = 'easy' | 'normal' | 'hard'
export type CaseCrimeType = 'theft' | 'data-leak' | 'fraud' | 'item-swap'
export type EvidenceCategory = 'physical' | 'digital' | 'testimony' | 'document'

export interface CaseMetadata {
  mode: 'classic' | 'dynamic'
  caseId: string
  title: string
  subtitle: string
  caseNumber: string
  summary: string
  location: string
  crimeType: CaseCrimeType
  incidentTime: string
  difficulty: DynamicDifficulty
  estimatedMinutes: number
  objective: string
  missingItems: string[]
}

export interface CaseAgentFact {
  id: string
  statement: string
}

export interface CasePresetQuestion {
  id: string
  question: string
  response: string
  emotion: AgentEmotion
  revealFactIds: string[]
  followUp: string
}

export interface CaseSuspect {
  id: string
  name: string
  occupation: string
  age: number
  pronouns: string
  personality: string[]
  publicInformation: string[]
  privateInformation: CaseAgentFact[]
  knownFacts: CaseAgentFact[]
  unknownFacts: string[]
  goal: string
  alibi: string
  relationshipWithOthers: Record<string, string>
  speechStyle: string[]
  truthStrategy: string[]
  status: string
  accent: string
  initials: string
  suspiciousPoint: string
  openingLine: string
  presetQuestions: CasePresetQuestion[]
  isCulprit: boolean
}

export interface CaseTimelineEvent {
  time: string
  description: string
}

export interface CaseFactDefinition {
  id: string
  title: string
  description: string
  npcId: string
  category: 'timeline' | 'access' | 'motive' | 'behavior' | 'testimony'
  revealConditions: string
  prerequisiteFactIds: string[]
  requiredEvidenceIds: string[]
  scoreValue: number
}

export interface CaseEvidenceDefinition {
  id: string
  title: string
  description: string
  category: EvidenceCategory
  source: string
  significance: string
  relatedNpcIds: string[]
  isKey: boolean
  isInitial: boolean
  unlockRequirements?: {
    type: 'fact' | 'contradiction'
    ids: string[]
  }
  presentationKeywords: string[]
  reactionGuidance: Record<string, string>
}

export interface CaseContradictionDefinition {
  id: string
  npcId: string
  title: string
  description: string
  requiredFactIds: string[]
  requiredEvidenceIds: string[]
  requiredPresentedEvidenceIds: string[]
  scoreValue: number
}

export interface CaseScoringConfig {
  keyEvidenceIds: string[]
  importantFactIds: string[]
  culpritEvidenceIds: string[]
  minimumCulpritEvidence: number
}

export interface CaseResolutionDefinition {
  culpritDescriptor: string
  explanation: string[]
  confession: string
}

export interface CaseDefinition {
  metadata: CaseMetadata
  culpritId: string
  suspects: CaseSuspect[]
  timeline: CaseTimelineEvent[]
  facts: CaseFactDefinition[]
  evidence: CaseEvidenceDefinition[]
  contradictions: CaseContradictionDefinition[]
  scoringConfig: CaseScoringConfig
  resolution: CaseResolutionDefinition
}

export interface ValidationIssue {
  code: string
  path: string
  message: string
}

export interface SolvabilityReport {
  valid: boolean
  reachableFactIds: string[]
  reachableEvidenceIds: string[]
  reachableContradictionIds: string[]
  unreachableFactIds: string[]
  unreachableEvidenceIds: string[]
  unreachableContradictionIds: string[]
  dependencyCycles: string[][]
  culpritChainComplete: boolean
  issues: ValidationIssue[]
}

export interface CaseValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  solvability: SolvabilityReport
}

export interface PublicFactRecord {
  id: string
  title: string
  description: string
  npcId: string
}

export interface PublicContradictionRecord extends PublicFactRecord {
  scoreValue: number
}

export interface PublicEvidenceRecord {
  id: string
  title: string
  description: string
  category: EvidenceCategory
  source: string
  significance: string
  relatedNpcIds: string[]
  isKey: boolean
}

export interface GenerationOptions {
  caseType: DynamicCaseType
  difficulty: DynamicDifficulty
}
