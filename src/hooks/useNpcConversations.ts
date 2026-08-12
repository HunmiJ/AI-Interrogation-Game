import { useCallback, useEffect, useRef, useState } from 'react'
import { InterrogationApiError, requestInterrogation } from '../services/interrogationApi'
import type { AiConversationMessage, ConversationMap, InterrogationUiError } from '../types/interrogation'
import { appendNpcMessage, getNpcConversation } from '../utils/conversationState'

interface FailedRequest {
  message: string
  history: AiConversationMessage[]
  discoveredEvidenceIds: string[]
}

export type AiRuntimeStatus = 'live' | 'offline'

function isLiveDeepSeekHealth(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const health = value as {
    ok?: unknown
    configured?: unknown
    available?: unknown
    provider?: unknown
  }
  return health.ok === true
    && health.configured === true
    && health.available === true
    && health.provider === 'deepseek'
}

function messageId() {
  return crypto.randomUUID()
}

export function useNpcConversations() {
  const [conversations, setConversations] = useState<ConversationMap>({})
  const [pendingByNpc, setPendingByNpc] = useState<Record<string, boolean>>({})
  const [errorsByNpc, setErrorsByNpc] = useState<Record<string, InterrogationUiError | null>>({})
  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus>('offline')
  const isDeepSeekRef = useRef(false)
  const failedByNpc = useRef<Record<string, FailedRequest | undefined>>({})
  const pendingRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void fetch('/api/health', { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((health) => {
        if (!active) return
        const healthRecord = health && typeof health === 'object'
          ? health as { configured?: unknown; provider?: unknown }
          : null
        isDeepSeekRef.current = healthRecord?.configured === true && healthRecord.provider === 'deepseek'
        setRuntimeStatus(isLiveDeepSeekHealth(health) ? 'live' : 'offline')
      })
      .catch(() => {
        if (!active) return
        isDeepSeekRef.current = false
        setRuntimeStatus('offline')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const performRequest = useCallback(async (
    npcId: string,
    message: string,
    history: AiConversationMessage[],
    discoveredEvidenceIds: string[],
    appendUserMessage: boolean,
  ) => {
    if (pendingRef.current[npcId]) return
    pendingRef.current[npcId] = true
    setPendingByNpc((current) => ({ ...current, [npcId]: true }))
    setErrorsByNpc((current) => ({ ...current, [npcId]: null }))

    if (appendUserMessage) {
      const userMessage: AiConversationMessage = { id: messageId(), role: 'user', content: message }
      setConversations((current) => appendNpcMessage(current, npcId, userMessage))
    }

    try {
      const result = await requestInterrogation({ npcId, message, conversationHistory: history, discoveredEvidenceIds })
      const assistantMessage: AiConversationMessage = {
        id: messageId(),
        role: 'assistant',
        content: result.reply,
        emotion: result.emotion,
        revealedFactIds: result.revealedFactIds,
        contradictionIds: result.contradictionIds,
      }
      setConversations((current) => appendNpcMessage(current, npcId, assistantMessage))
      failedByNpc.current[npcId] = undefined
      if (isDeepSeekRef.current) setRuntimeStatus('live')
    } catch (error) {
      const apiError = error instanceof InterrogationApiError
        ? error
        : new InterrogationApiError('UNKNOWN_ERROR', 'AI 审讯暂时不可用。', true)
      failedByNpc.current[npcId] = { message, history, discoveredEvidenceIds }
      setErrorsByNpc((current) => ({
        ...current,
        [npcId]: { code: apiError.code, message: apiError.message, retryable: apiError.retryable },
      }))
      setRuntimeStatus('offline')
    } finally {
      pendingRef.current[npcId] = false
      setPendingByNpc((current) => ({ ...current, [npcId]: false }))
    }
  }, [])

  const sendMessage = useCallback((npcId: string, message: string, discoveredEvidenceIds: string[]) => {
    const trimmed = message.trim()
    if (!trimmed || trimmed.length > 500 || pendingRef.current[npcId]) return
    const history = getNpcConversation(conversations, npcId)
    void performRequest(npcId, trimmed, history, discoveredEvidenceIds, true)
  }, [conversations, performRequest])

  const retry = useCallback((npcId: string) => {
    const failed = failedByNpc.current[npcId]
    if (!failed || pendingRef.current[npcId]) return
    void performRequest(npcId, failed.message, failed.history, failed.discoveredEvidenceIds, false)
  }, [performRequest])

  const reset = useCallback(() => {
    setConversations({})
    setPendingByNpc({})
    setErrorsByNpc({})
    failedByNpc.current = {}
    pendingRef.current = {}
  }, [])

  const markPresetFallback = useCallback(() => {
    setRuntimeStatus('offline')
  }, [])

  return {
    conversations,
    pendingByNpc,
    errorsByNpc,
    runtimeStatus,
    sendMessage,
    retry,
    reset,
    markPresetFallback,
  }
}
