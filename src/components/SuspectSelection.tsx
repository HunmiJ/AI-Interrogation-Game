import { ArrowRight, Crosshair, Search, UserRoundSearch } from 'lucide-react'
import type { NPC } from '../types/game'
import { NPCCard } from './NPCCard'

interface SuspectSelectionProps {
  selectedNpcId: string | null
  onSelect: (npcId: string) => void
  onContinue: () => void
  npcs: NPC[]
}

export function SuspectSelection({ selectedNpcId, onSelect, onContinue, npcs }: SuspectSelectionProps) {
  const selectedNpc = npcs.find((npc) => npc.id === selectedNpcId)

  return (
    <div className="page-shell">
      <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-5"><UserRoundSearch size={13} /> SUBJECT INDEX / 03 PERSONS</div>
          <h1 className="section-title">选择首位审讯对象</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-stone-400">三人都没有说出完整事实。查看人物档案并选择切入点，进入审讯室后仍可随时切换对象。</p>
        </div>
        <div className="selection-hint"><Search size={14} /><span>点击人物档案进行选择</span></div>
      </div>

      <div className="case-roster-heading">
        <div><span>CASE ROSTER</span><b>案发现场相关人员</b></div>
        <div className="hidden sm:flex"><Crosshair size={12} /> 所有人均有未公开信息</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {npcs.map((npc) => <NPCCard key={npc.id} npc={npc} selected={npc.id === selectedNpcId} onClick={() => onSelect(npc.id)} />)}
      </div>

      <div className={`selection-dock ${selectedNpc ? 'is-visible' : ''}`} aria-live="polite">
        {selectedNpc ? (
          <div className="grid gap-5 md:grid-cols-[190px_1fr_auto] md:items-center">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-brass">Selected subject</div>
              <div className="mt-1.5 font-display text-xl text-stone-100">{selectedNpc.name}</div>
              <div className="mt-1 text-[11px] text-stone-500">{selectedNpc.occupation}</div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {selectedNpc.publicInformation.slice(0, 2).map((item) => (
                <div key={item} className="flex gap-2.5 text-xs leading-5 text-stone-300"><span className="mt-2 h-1 w-1 shrink-0 bg-brass" />{item}</div>
              ))}
            </div>
            <button className="primary-button whitespace-nowrap" onClick={onContinue}>进入审讯室 <ArrowRight size={16} /></button>
          </div>
        ) : (
          <div className="py-1 text-center text-xs tracking-wide text-stone-600">从上方档案中选择一名嫌疑人</div>
        )}
      </div>
    </div>
  )
}
