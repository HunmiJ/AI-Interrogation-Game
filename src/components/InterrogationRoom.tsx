import { ArrowRight, CircleAlert, Radio, UsersRound } from 'lucide-react'
import type { DialogueOption, Evidence, NotebookContradictionRecord, NotebookFactRecord, NPC, RuntimeCaseData } from '../types/game'
import { NPCCard } from './NPCCard'
import { ChatBox } from './ChatBox'
import { EvidencePanel } from './EvidencePanel'
import type { AiConversationMessage, InterrogationUiError } from '../types/interrogation'
import type { DiscoveryEvent } from '../utils/gameSession'
import { DiscoveryFeedback } from './DiscoveryFeedback'

interface InterrogationRoomProps {
  selectedNpcId: string
  interviewedNpcIds: string[]
  askedDialogueIds: string[]
  collectedEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  lastDiscovery: DiscoveryEvent | null
  questionCount: number
  conversation: AiConversationMessage[]
  isThinking: boolean
  conversationError: InterrogationUiError | null
  onSelectNpc: (id: string) => void
  onAsk: (id: string, evidenceId?: string) => void
  onSendMessage: (message: string) => void
  onRetryMessage: () => void
  onReview: () => void
  npcs: NPC[]
  evidence: Evidence[]
  evidenceTotal: number
  dialogueOptions: DialogueOption[]
  openingLines: Record<string, string>
  facts: NotebookFactRecord[]
  contradictions: NotebookContradictionRecord[]
  runtimeCase: RuntimeCaseData
}

export function InterrogationRoom(props: InterrogationRoomProps) {
  const npc = props.npcs.find((item) => item.id === props.selectedNpcId)!
  const canReview = props.questionCount >= 3

  return (
    <div className="mx-auto max-w-[1540px] px-4 py-7 lg:px-7 lg:py-8">
      <DiscoveryFeedback discovery={props.lastDiscovery} runtimeCase={props.runtimeCase} />
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-2"><UsersRound size={13} /> INTERROGATION ROOM / SESSION 01</div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-[1.85rem] tracking-tight text-stone-100">审讯与取证</h1>
            <span className="text-[11px] text-stone-500">当前对象：{npc.name} · {npc.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!canReview && <div className="hidden items-center gap-2 text-[11px] text-stone-500 sm:flex"><CircleAlert size={14} /> 至少完成 3 个问题</div>}
          <button disabled={!canReview} onClick={props.onReview} className="primary-button compact">整理线索 <ArrowRight size={15} /></button>
        </div>
      </div>

      <div className="interrogation-grid overflow-hidden border border-white/[0.1] bg-panel shadow-[0_24px_60px_rgba(0,0,0,.25)]">
        <aside className="suspect-rail border-b border-white/[0.08] bg-[#0f1215] p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between px-2 pb-2 pt-1">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500">审讯对象</div>
              <div className="mt-1 text-[10px] text-stone-600">选择人物以切换口供</div>
            </div>
            <Radio size={13} className="hidden text-red-500/70 lg:block" />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {props.npcs.map((item) => (
              <NPCCard key={item.id} npc={item} compact selected={item.id === npc.id} interviewed={props.interviewedNpcIds.includes(item.id)} onClick={() => props.onSelectNpc(item.id)} />
            ))}
          </div>
          <div className="rail-progress hidden lg:block">
            <div className="flex items-center justify-between"><span>审讯进度</span><b>{props.interviewedNpcIds.length} / {props.npcs.length}</b></div>
            <div><i style={{ width: `${(props.interviewedNpcIds.length / props.npcs.length) * 100}%` }} /></div>
            <p>切换人物不会丢失已完成的对话和证据。</p>
          </div>
        </aside>

        <ChatBox
          npc={npc}
          askedDialogueIds={props.askedDialogueIds}
          conversation={props.conversation}
          isThinking={props.isThinking}
          error={props.conversationError}
          onAsk={props.onAsk}
          onSendMessage={props.onSendMessage}
          onRetry={props.onRetryMessage}
          dialogueOptions={props.dialogueOptions}
          openingLine={props.openingLines[npc.id] ?? '请问吧，我会回答我知道的事情。'}
        />
        <div className="hidden xl:block"><EvidencePanel evidence={props.evidence} evidenceTotal={props.evidenceTotal} collectedEvidenceIds={props.collectedEvidenceIds} /></div>
      </div>
    </div>
  )
}
