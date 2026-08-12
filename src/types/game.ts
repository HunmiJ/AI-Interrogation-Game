export type GameStage =
  | 'home'
  | 'briefing'
  | 'suspect-selection'
  | 'interrogation'
  | 'evidence-review'
  | 'accusation'
  | 'result'

export interface TimelineEvent {
  time: string
  description: string
}

export interface CaseData {
  id: string
  title: string
  subtitle: string
  caseNumber: string
  location: string
  occurredAt: string
  difficulty: string
  estimatedMinutes: number
  summary: string
  objective: string
  stolenItems: string[]
  initialEvidenceIds: string[]
  npcIds: string[]
  timeline: TimelineEvent[]
}

export interface NPC {
  id: string
  name: string
  occupation: string
  age: number
  pronouns: string
  personality: string[]
  publicInformation: string[]
  status: string
  accent: string
  initials: string
}

export type EvidenceCategory = 'physical' | 'digital' | 'testimony' | 'document'

export interface Evidence {
  id: string
  title: string
  description: string
  category: EvidenceCategory
  source: string
  significance: string
  relatedNpcIds: string[]
  isKey: boolean
}

export interface DialogueOption {
  id: string
  npcId: string
  question: string
  response: string
  tone: 'calm' | 'defensive' | 'evasive' | 'tense'
  unlockEvidenceId?: string
  followUp: string
}

export interface ChatMessage {
  id: string
  speaker: 'investigator' | 'npc'
  content: string
  tone?: DialogueOption['tone']
}

export interface GameState {
  stage: GameStage
  selectedNpcId: string | null
  interviewedNpcIds: string[]
  askedDialogueIds: string[]
  collectedEvidenceIds: string[]
  accusedNpcId: string | null
}
