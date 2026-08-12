import { Check, ChevronRight, Crosshair, FileWarning, ScanFace } from 'lucide-react'
import type { NPC } from '../types/game'

interface NPCCardProps {
  npc: NPC
  selected?: boolean
  interviewed?: boolean
  onClick: () => void
  compact?: boolean
}

export function NPCCard({ npc, selected = false, interviewed = false, onClick, compact = false }: NPCCardProps) {
  if (compact) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={`npc-compact ${selected ? 'selected' : ''}`}>
        <NpcPortrait npc={npc} size="small" />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-stone-100">{npc.name}</span>
            {selected && <span className="text-[8px] uppercase tracking-wider text-brass">Current</span>}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-stone-500">{npc.occupation}</div>
        </div>
        {interviewed && <span className="interviewed-mark" title="已审讯"><Check size={11} /></span>}
      </button>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`npc-card group ${selected ? 'selected' : ''}`}>
      <div className="relative">
        <NpcPortrait npc={npc} />
        <div className="subject-index"><ScanFace size={12} /> SUBJECT 0{['jack', 'alice', 'tom'].indexOf(npc.id) + 1}</div>
        <span className="subject-status"><span />{npc.status}</span>
        {selected && <div className="selected-ribbon"><Check size={11} /> 已选择</div>}
      </div>

      <div className="npc-card-body text-left">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-[1.85rem] leading-none tracking-tight text-stone-50">{npc.name}</h3>
            <p className="mt-2 text-[13px] text-stone-400">{npc.occupation}<span className="mx-2 text-stone-700">/</span>{npc.age} 岁</p>
          </div>
          <div className="card-enter"><ChevronRight size={16} /></div>
        </div>

        <div className="mt-5">
          <div className="card-label"><Crosshair size={11} /> 已知特征</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {npc.personality.map((trait) => <span key={trait} className="trait">{trait}</span>)}
          </div>
        </div>

        <div className="investigation-note">
          <div className="card-label"><FileWarning size={11} /> 调查备注</div>
          <p>{npc.publicInformation[2]}</p>
        </div>
      </div>
    </button>
  )
}

export function NpcPortrait({ npc, size = 'large' }: { npc: NPC; size?: 'small' | 'large' }) {
  if (size === 'small') {
    return (
      <div className="npc-avatar-small" style={{ '--npc-accent': npc.accent } as React.CSSProperties} aria-hidden="true">
        <div className="avatar-head" />
        <div className="avatar-shoulders" />
        <span>{npc.initials}</span>
      </div>
    )
  }

  return (
    <div className="npc-portrait" style={{ '--npc-accent': npc.accent } as React.CSSProperties} aria-label={`${npc.name} 人物立绘占位`}>
      <div className="portrait-grid" />
      <div className="portrait-height-markers"><i /><i /><i /><i /></div>
      <div className="portrait-figure">
        <div className="portrait-head"><div className="portrait-face-shadow" /></div>
        <div className="portrait-neck" />
        <div className="portrait-shoulders" />
      </div>
      <div className="portrait-monogram">{npc.initials}</div>
      <div className="portrait-line" />
      <div className="portrait-slot-label">PORTRAIT SLOT / {npc.id.toUpperCase()}</div>
    </div>
  )
}
