export type AgentId = 'jack' | 'alice' | 'tom'

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
  npcId: AgentId
  message: string
  conversationHistory: ConversationTurn[]
  discoveredEvidenceIds: string[]
}

export interface InterrogateResult {
  reply: string
  emotion: AgentEmotion
  revealedFactIds: string[]
  contradictionIds: string[]
}
