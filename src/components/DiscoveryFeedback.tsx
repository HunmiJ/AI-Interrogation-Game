import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FilePlus2 } from 'lucide-react'
import type { DiscoveryEvent } from '../utils/gameSession'
import type { RuntimeCaseData } from '../types/game'

export function DiscoveryFeedback({ discovery, runtimeCase }: { discovery: DiscoveryEvent | null; runtimeCase: RuntimeCaseData }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!discovery) return
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 4200)
    return () => window.clearTimeout(timer)
  }, [discovery])

  if (!discovery || !visible) return null
  return (
    <div className="fixed right-5 top-20 z-50 w-[min(360px,calc(100vw-2.5rem))] space-y-2" role="status" aria-live="polite">
      {discovery.revealedFactIds.map((id) => (
        <Feedback key={id} icon={<CheckCircle2 size={16} />} label="NEW FACT DISCOVERED" title={runtimeCase.facts.find((item) => item.id === id)?.title ?? id} tone="fact" />
      ))}
      {discovery.contradictionIds.map((id) => (
        <Feedback key={id} icon={<AlertTriangle size={16} />} label="CONTRADICTION DETECTED" title={runtimeCase.contradictions.find((item) => item.id === id)?.title ?? id} tone="contradiction" />
      ))}
      {discovery.unlockedEvidenceIds.map((id) => (
        <Feedback key={id} icon={<FilePlus2 size={16} />} label="EVIDENCE ACQUIRED" title={runtimeCase.evidence.find((item) => item.id === id)?.title ?? id} tone="evidence" />
      ))}
    </div>
  )
}

function Feedback({ icon, label, title, tone }: { icon: React.ReactNode; label: string; title: string; tone: 'fact' | 'contradiction' | 'evidence' }) {
  const tones = {
    fact: 'border-emerald-500/30 text-emerald-400',
    contradiction: 'border-amber-500/35 text-amber-400',
    evidence: 'border-brass/30 text-brass',
  }
  return (
    <div className={`border bg-[#0c0f12] p-4 shadow-[0_12px_35px_rgba(0,0,0,.38)] ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]">{icon}{label}</div>
      <div className="mt-2 text-sm font-medium text-stone-100">{title}</div>
    </div>
  )
}
