export type AgentId = string

export type AgentEmotion = 'neutral' | 'calm' | 'nervous' | 'defensive' | 'evasive' | 'angry'

export interface AgentFact {
  id: string
  statement: string
}

export interface AgentProfile {
  id: AgentId
  name: string
  occupation: string
  age: number
  personality: string[]
  publicInformation: string[]
  privateInformation: AgentFact[]
  knownFacts: AgentFact[]
  unknownFacts: string[]
  goal: string
  alibi: string
  relationshipWithOthers: Record<string, string>
  speechStyle: string[]
  truthStrategy: string[]
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface InterrogateInput {
  caseSessionId?: string
  npcId: AgentId
  message: string
  conversationHistory: ConversationTurn[]
  discoveredEvidenceIds: string[]
  presentedEvidenceIds?: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
}

export interface InterrogateResult {
  reply: string
  emotion: AgentEmotion
  revealedFactIds: string[]
  contradictionIds: string[]
  unlockedEvidenceIds: string[]
  presentedEvidenceIds?: string[]
  factRecords?: Array<{ id: string; title: string; description: string; npcId: string }>
  contradictionRecords?: Array<{ id: string; title: string; description: string; npcId: string; scoreValue: number }>
  evidenceRecords?: Array<{ id: string; title: string; description: string; category: string; source: string; significance: string; relatedNpcIds: string[]; isKey: boolean }>
}
