import { AlertTriangle, Gavel, Scale, ShieldAlert } from 'lucide-react'
import type { NPC } from '../types/game'
import { NpcPortrait } from './NPCCard'

interface FinalAccusationProps {
  selectedNpcId: string | null
  onSelect: (npcId: string) => void
  onAccuse: (npcId: string) => void
  npcs: NPC[]
}

export function FinalAccusation({ selectedNpcId, onSelect, onAccuse, npcs }: FinalAccusationProps) {
  const selected = npcs.find((npc) => npc.id === selectedNpcId)
  return (
    <div className="page-shell max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <div className="eyebrow mx-auto mb-5 w-fit"><Gavel size={13} /> FINAL ACCUSATION</div>
        <h1 className="section-title">谁是盗窃者？</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-500">这是你的最终判断。综合动机、作案条件、时间线与口供矛盾，选择一名嫌疑人结案。</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {npcs.map((npc) => {
          const active = selectedNpcId === npc.id
          return (
            <button key={npc.id} onClick={() => onSelect(npc.id)} className={`accusation-card ${active ? 'selected' : ''}`}>
              <div className="relative mx-auto w-fit"><NpcPortrait npc={npc} size="small" />{active && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white"><Scale size={11} /></span>}</div>
              <h2 className="mt-4 font-display text-2xl text-stone-200">{npc.name}</h2>
              <p className="mt-1 text-xs text-stone-600">{npc.occupation}</p>
              <div className="mt-5 border-t border-white/[0.07] pt-4 text-left">
                <div className="text-[9px] uppercase tracking-widest text-stone-700">核心疑点</div>
                <p className="mt-2 text-xs leading-5 text-stone-400">{npc.publicInformation[2] ?? npc.publicInformation[0]}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mx-auto mt-7 max-w-3xl">
        {selected ? (
          <div className="border border-danger/25 bg-danger/[0.045] p-5 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" /><div><p className="text-sm text-stone-300">你将指认 <strong className="text-white">{selected.name}</strong> 为本案盗窃者</p><p className="mt-1 text-[11px] text-stone-600">提交后将公开完整真相，本轮无法更改。</p></div></div>
            <button onClick={() => onAccuse(selected.id)} className="danger-button mt-4 w-full justify-center sm:mt-0 sm:w-auto"><ShieldAlert size={15} /> 提交指认</button>
          </div>
        ) : (
          <div className="border border-dashed border-white/[0.08] p-5 text-center text-xs text-stone-700">选择一名嫌疑人后提交最终指认</div>
        )}
      </div>
    </div>
  )
}
