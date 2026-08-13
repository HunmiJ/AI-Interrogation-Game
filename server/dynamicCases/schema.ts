import { z } from 'zod'

const id = z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/)
const shortText = z.string().trim().min(1).max(240)
const paragraph = z.string().trim().min(1).max(800)
const stringList = (min: number, max: number) => z.array(shortText).min(min).max(max)

const agentFactSchema = z.object({ id, statement: paragraph }).strict()
const presetQuestionSchema = z.object({
  id,
  question: shortText,
  response: paragraph,
  emotion: z.enum(['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealFactIds: z.array(id).max(3),
  followUp: shortText,
}).strict()

export const CaseDefinitionSchema = z.object({
  metadata: z.object({
    mode: z.enum(['classic', 'dynamic']),
    caseId: id,
    title: z.string().trim().min(4).max(60),
    subtitle: shortText,
    caseNumber: z.string().trim().min(3).max(32),
    summary: paragraph,
    location: shortText,
    crimeType: z.enum(['theft', 'data-leak', 'fraud', 'item-swap']),
    incidentTime: shortText,
    difficulty: z.enum(['easy', 'normal', 'hard']),
    estimatedMinutes: z.number().int().min(10).max(20),
    objective: paragraph,
    missingItems: stringList(1, 3),
  }).strict(),
  culpritId: id,
  suspects: z.array(z.object({
    id,
    name: z.string().trim().min(2).max(40),
    occupation: shortText,
    age: z.number().int().min(18).max(75),
    pronouns: z.string().trim().min(1).max(8),
    personality: stringList(2, 5),
    publicInformation: stringList(3, 5),
    privateInformation: z.array(agentFactSchema).min(1).max(5),
    knownFacts: z.array(agentFactSchema).min(2).max(7),
    unknownFacts: stringList(2, 6),
    goal: paragraph,
    alibi: paragraph,
    relationshipWithOthers: z.record(id, shortText),
    speechStyle: stringList(2, 5),
    truthStrategy: stringList(3, 7),
    status: shortText,
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    initials: z.string().trim().min(1).max(3),
    suspiciousPoint: shortText,
    openingLine: paragraph,
    presetQuestions: z.array(presetQuestionSchema).min(2).max(3),
    isCulprit: z.boolean(),
  }).strict()).length(3),
  timeline: z.array(z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    description: shortText,
  }).strict()).min(4).max(8),
  facts: z.array(z.object({
    id,
    title: shortText,
    description: paragraph,
    npcId: id,
    category: z.enum(['timeline', 'access', 'motive', 'behavior', 'testimony']),
    revealConditions: paragraph,
    prerequisiteFactIds: z.array(id).max(4),
    requiredEvidenceIds: z.array(id).max(4),
    scoreValue: z.number().int().min(1).max(5),
  }).strict()).min(5).max(12),
  evidence: z.array(z.object({
    id,
    title: shortText,
    description: paragraph,
    category: z.enum(['physical', 'digital', 'testimony', 'document']),
    source: shortText,
    significance: paragraph,
    relatedNpcIds: z.array(id).min(1).max(3),
    isKey: z.boolean(),
    isInitial: z.boolean(),
    unlockRequirements: z.object({
      type: z.enum(['fact', 'contradiction']),
      ids: z.array(id).min(1).max(4),
    }).strict().optional(),
    presentationKeywords: z.array(z.string().trim().min(2).max(40)).min(2).max(6),
    reactionGuidance: z.record(id, paragraph),
  }).strict()).min(5).max(8),
  contradictions: z.array(z.object({
    id,
    npcId: id,
    title: shortText,
    description: paragraph,
    requiredFactIds: z.array(id).min(1).max(4),
    requiredEvidenceIds: z.array(id).min(1).max(4),
    requiredPresentedEvidenceIds: z.array(id).min(1).max(3),
    scoreValue: z.number().int().min(2).max(8),
  }).strict()).min(2).max(5),
  scoringConfig: z.object({
    keyEvidenceIds: z.array(id).min(2).max(8),
    importantFactIds: z.array(id).min(2).max(10),
    culpritEvidenceIds: z.array(id).min(2).max(6),
    minimumCulpritEvidence: z.number().int().min(2).max(4),
  }).strict(),
  resolution: z.object({
    culpritDescriptor: shortText,
    explanation: z.array(paragraph).min(2).max(4),
    confession: paragraph,
  }).strict(),
}).strict()

export type CaseDefinitionInput = z.input<typeof CaseDefinitionSchema>
