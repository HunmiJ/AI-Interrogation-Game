import { useEffect, useRef, useState } from 'react'
import { Check, FileCheck2, LockKeyhole } from 'lucide-react'
import { evidence } from '../data/gameData'
import type { Evidence } from '../types/game'

const categoryLabels: Record<Evidence['category'], string> = {
  physical: '物证', digital: '数字', testimony: '证词', document: '文档',
}

export function EvidencePanel({ collectedEvidenceIds }: { collectedEvidenceIds: string[] }) {
  const [recentId, setRecentId] = useState<string | null>(null)
  const previousIds = useRef(collectedEvidenceIds)
  const recentTimer = useRef<number | null>(null)
  const collected = evidence.filter((item) => collectedEvidenceIds.includes(item.id))

  useEffect(() => {
    const addedId = collectedEvidenceIds.find((id) => !previousIds.current.includes(id))
    previousIds.current = collectedEvidenceIds
    if (!addedId) return

    setRecentId(addedId)
    if (recentTimer.current) window.clearTimeout(recentTimer.current)
    recentTimer.current = window.setTimeout(() => setRecentId(null), 3500)
  }, [collectedEvidenceIds])

  useEffect(() => () => {
    if (recentTimer.current) window.clearTimeout(recentTimer.current)
  }, [])

  return (
    <aside className="evidence-panel flex h-full min-h-[660px] flex-col border-l border-white/[0.08] bg-[#0d1013]">
      <div className="evidence-panel-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-200"><FileCheck2 size={16} className="text-brass" /> 证据袋</div>
            <div className="mt-1.5 text-[9px] uppercase tracking-[0.18em] text-stone-600">Case evidence archive</div>
          </div>
          <span className="evidence-counter">{String(collected.length).padStart(2, '0')}<i />{String(evidence.length).padStart(2, '0')}</span>
        </div>
        <div className="mt-4 h-[3px] overflow-hidden bg-white/[0.06]"><div className="h-full bg-brass transition-all duration-300" style={{ width: `${(collected.length / evidence.length) * 100}%` }} /></div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {collected.map((item, index) => {
          const isRecent = item.id === recentId
          return (
            <article key={item.id} className={`evidence-mini ${isRecent ? 'is-new' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="evidence-type">{categoryLabels[item.category]}</span>
                {isRecent ? <span className="new-evidence-label">NEW</span> : <span className="archived-label"><Check size={9} /> 已归档</span>}
              </div>
              <h4 className="mt-3 text-sm font-semibold leading-5 text-stone-100">{item.title}</h4>
              <p className="mt-2 text-xs leading-[1.65] text-stone-400">{item.description}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[9px] text-stone-600">
                <span>来源 · {item.source}</span><span className="font-mono">E-{String(index + 1).padStart(2, '0')}</span>
              </div>
            </article>
          )
        })}
        {evidence.length > collected.length && (
          <div className="evidence-locked"><LockKeyhole size={14} /><span>仍有 {evidence.length - collected.length} 份证据未发现</span></div>
        )}
      </div>
    </aside>
  )
}
