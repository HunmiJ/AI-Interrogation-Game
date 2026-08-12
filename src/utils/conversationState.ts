import type { AiConversationMessage, ConversationMap } from '../types/interrogation'

export function getNpcConversation(conversations: ConversationMap, npcId: string) {
  return conversations[npcId] ?? []
}

export function appendNpcMessage(conversations: ConversationMap, npcId: string, message: AiConversationMessage): ConversationMap {
  return {
    ...conversations,
    [npcId]: [...getNpcConversation(conversations, npcId), message],
  }
}
