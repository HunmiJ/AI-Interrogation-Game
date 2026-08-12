import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendNpcMessage, getNpcConversation } from '../src/utils/conversationState'
import type { ConversationMap } from '../src/types/interrogation'

test('preserves separate conversation history when switching NPCs', () => {
  let conversations: ConversationMap = {}
  conversations = appendNpcMessage(conversations, 'jack', { id: 'j1', role: 'user', content: 'Jack 问题' })
  conversations = appendNpcMessage(conversations, 'alice', { id: 'a1', role: 'user', content: 'Alice 问题' })
  conversations = appendNpcMessage(conversations, 'tom', { id: 't1', role: 'user', content: 'Tom 问题' })
  conversations = appendNpcMessage(conversations, 'jack', { id: 'j2', role: 'assistant', content: 'Jack 回答', emotion: 'evasive' })

  assert.deepEqual(getNpcConversation(conversations, 'jack').map((item) => item.id), ['j1', 'j2'])
  assert.deepEqual(getNpcConversation(conversations, 'alice').map((item) => item.id), ['a1'])
  assert.deepEqual(getNpcConversation(conversations, 'tom').map((item) => item.id), ['t1'])
  assert.equal(getNpcConversation(conversations, 'unknown').length, 0)
})
