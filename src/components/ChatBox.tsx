import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CircleDot, LoaderCircle, MessageSquareText, RefreshCw, Send, Sparkles } from 'lucide-react'
import type { DialogueOption, NPC } from '../types/game'
import type { AiConversationMessage, AiNpcEmotion, InterrogationUiError } from '../types/interrogation'
import { NpcPortrait } from './NPCCard'

interface ChatBoxProps {
  npc: NPC
  askedDialogueIds: string[]
  conversation: AiConversationMessage[]
  isThinking: boolean
  error: InterrogationUiError | null
  onAsk: (dialogueId: string, evidenceId?: string) => void
  onSendMessage: (message: string) => void
  onRetry: () => void
  dialogueOptions: DialogueOption[]
  openingLine: string
}

type DisplayEmotion = DialogueOption['tone'] | AiNpcEmotion

const toneLabels: Record<DisplayEmotion, string> = {
  neutral: '中性',
  calm: '平静',
  nervous: '紧张',
  defensive: '戒备',
  evasive: '回避',
  angry: '恼怒',
  tense: '紧绷',
}

export function ChatBox({ npc, askedDialogueIds, conversation, isThinking, error, onAsk, onSendMessage, onRetry, dialogueOptions, openingLine }: ChatBoxProps) {
  const [input, setInput] = useState('')
  const conversationEnd = useRef<HTMLDivElement | null>(null)
  const options = dialogueOptions.filter((option) => option.npcId === npc.id)
  const askedOptions = options.filter((option) => askedDialogueIds.includes(option.id))
  const lastAiMessage = [...conversation].reverse().find((message) => message.role === 'assistant')
  const visibleStatus = lastAiMessage?.emotion ? toneLabels[lastAiMessage.emotion] : npc.status

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [askedOptions.length, conversation.length, isThinking])

  useEffect(() => {
    setInput('')
  }, [npc.id])

  const handlePresetQuestion = (option: DialogueOption) => {
    if (option.response) onAsk(option.id, option.unlockEvidenceId)
    else onSendMessage(option.question)
  }

  const handleSubmit = () => {
    const message = input.trim()
    if (!message || isThinking || message.length > 500) return
    onSendMessage(message)
    setInput('')
  }

  return (
    <div className="chat-box relative flex min-h-[660px] flex-col bg-[#0b0e11]">
      <div className="interrogation-subject-bar">
        <NpcPortrait npc={npc} size="small" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-stone-100">{npc.name}</h2>
            <span className="subject-live"><CircleDot size={9} /> 正在录音</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-stone-500">{npc.occupation}<span className="mx-2 text-stone-700">/</span>当前状态：{visibleStatus}</p>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600">AI agent / Live</div>
          <div className="mt-1 text-[11px] text-stone-400">{npc.personality.slice(0, 2).join(' · ')}</div>
        </div>
      </div>

      <div className="conversation-area flex-1 space-y-6 overflow-y-auto p-5 md:p-7 lg:p-8">
        <div className="recording-divider"><span>REC 00:00</span><i /><span>ROOM B</span></div>
        <NpcMessage npc={npc} content={openingLine} />

        {askedOptions.map((option) => (
          <div key={option.id} className="conversation-exchange">
            <InvestigatorMessage content={option.question} />
            {option.response && <NpcMessage npc={npc} content={option.response} tone={option.tone} />}
            {option.followUp && <div className="intel-note ml-12">
              <Sparkles size={13} />
              <div><span>调查笔记</span><p>{option.followUp}</p></div>
            </div>}
          </div>
        ))}

        {conversation.length > 0 && <div className="ai-session-divider"><span>AI FREE INTERROGATION</span><i /><span>{conversation.filter((item) => item.role === 'user').length} QUESTIONS</span></div>}

        {conversation.map((message) => message.role === 'user'
          ? <InvestigatorMessage key={message.id} content={message.content} />
          : <NpcMessage key={message.id} npc={npc} content={message.content} tone={message.emotion} />)}

        {isThinking && (
          <div className="npc-message flex max-w-[91%] items-start gap-3.5" role="status" aria-live="polite">
            <NpcPortrait npc={npc} size="small" />
            <div>
              <div className="message-speaker mb-1.5">SUBJECT / {npc.name}</div>
              <div className="thinking-bubble"><span /><span /><span /><b>正在思考回答</b></div>
            </div>
          </div>
        )}

        <div ref={conversationEnd} />
      </div>

      <div className="question-dock">
        <div className="free-interrogation-block">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-brass"><MessageSquareText size={13} /> Free interrogation / 自由审讯</div>
              <div className="mt-1 text-[10px] text-stone-600">直接输入问题，回答将基于角色记忆与已发现证据生成</div>
            </div>
            <span className={`input-count ${input.length > 450 ? 'near-limit' : ''}`}>{input.length}/500</span>
          </div>

          <div className={`interrogation-input-wrap ${isThinking ? 'is-disabled' : ''}`}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSubmit()
                }
              }}
              disabled={isThinking}
              maxLength={500}
              rows={2}
              placeholder={`向 ${npc.name} 提问，例如：你在 23:09 在哪里？`}
              aria-label={`向 ${npc.name} 自由提问`}
            />
            <button type="button" onClick={handleSubmit} disabled={!input.trim() || isThinking} aria-label="发送问题">
              {isThinking ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          <div className="mt-1.5 text-right text-[9px] text-stone-700">Enter 发送 · Shift + Enter 换行</div>

          {error && (
            <div className="ai-error" role="alert">
              <AlertCircle size={15} />
              <span>{error.message}</span>
              {error.retryable && <button type="button" onClick={onRetry} disabled={isThinking}><RefreshCw size={12} /> 重试</button>}
            </div>
          )}
        </div>

        <div className="preset-question-header">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500"><Sparkles size={12} /> 调查切入点 / 离线可用</div>
          <div className="text-[10px] text-stone-600">{askedOptions.length} / {options.length} 已询问</div>
        </div>
        <div className="grid gap-2">
          {options.map((option) => {
            const asked = Boolean(option.response) && askedDialogueIds.includes(option.id)
            return (
              <button type="button" key={option.id} disabled={asked} onClick={() => handlePresetQuestion(option)} className="question-option group">
                <span className="text-left">{option.question}</span>
                {asked ? <span className="asked-state"><Check size={12} /> 已问</span> : <Send size={14} className="shrink-0 text-stone-500 transition group-hover:text-brass" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InvestigatorMessage({ content }: { content: string }) {
  return (
    <div className="investigator-message ml-auto max-w-[82%]">
      <div className="message-speaker">INVESTIGATOR / 调查员</div>
      <p>{content}</p>
    </div>
  )
}

function NpcMessage({ npc, content, tone }: { npc: NPC; content: string; tone?: DisplayEmotion }) {
  return (
    <div className="npc-message flex max-w-[91%] items-start gap-3.5" style={{ '--npc-accent': npc.accent } as React.CSSProperties}>
      <NpcPortrait npc={npc} size="small" />
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="message-speaker">SUBJECT / {npc.name}</span>
          {tone && <span className={`tone-badge tone-${tone}`}>语气 · {toneLabels[tone]}</span>}
        </div>
        <div className="npc-bubble">{content}</div>
      </div>
    </div>
  )
}
