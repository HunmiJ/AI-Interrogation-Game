export type AiNpcEmotion = 'neutral' | 'calm' | 'nervous' | 'defensive' | 'evasive' | 'angry'

export interface AiConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  emotion?: AiNpcEmotion
  revealedFactIds?: string[]
  contradictionIds?: string[]
  unlockedEvidenceIds?: string[]
  presentedEvidenceIds?: string[]
}

export interface InterrogateResponse {
  reply: string
  emotion: AiNpcEmotion
  revealedFactIds: string[]
  contradictionIds: string[]
  unlockedEvidenceIds: string[]
  presentedEvidenceIds: string[]
}

export interface InterrogationUiError {
  code: string
  message: string
  retryable: boolean
}

export type ConversationMap = Record<string, AiConversationMessage[]>
