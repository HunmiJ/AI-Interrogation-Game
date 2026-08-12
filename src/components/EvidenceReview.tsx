import { ArrowRight, CheckCircle2, FileSearch, Fingerprint, Link2, ShieldQuestion } from 'lucide-react'
import { evidence, npcById } from '../data/gameData'
import type { Evidence } from '../types/game'

const categoryLabels: Record<Evidence['category'], string> = {
  physical: '现场物证', digital: '数字记录', testimony: '人物证词', document: '书面文档',
}

interface EvidenceReviewProps {
  collectedEvidenceIds: string[]
  interviewedNpcCount: number
  onContinue: () => void
}

export function EvidenceReview({ collectedEvidenceIds, interviewedNpcCount, onContinue }: EvidenceReviewProps) {
  const collected = evidence.filter((item) => collectedEvidenceIds.includes(item.id))
  const missingCount = evidence.length - collected.length
  return (
    <div className="page-shell">
      <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-5"><FileSearch size={13} /> EVIDENCE REVIEW / CROSS-REFERENCE</div>
          <h1 className="section-title">整理调查线索</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-500">证据不会替你下结论。寻找时间、权限、动机与口供之间无法同时成立的部分。</p>
        </div>
        <div className="flex gap-3">
          <ReviewStat value={collected.length} label="已收集" />
          <ReviewStat value={interviewedNpcCount} label="已审讯" />
          <ReviewStat value={missingCount} label="未发现" muted />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collected.map((item, index) => (
          <article key={item.id} className="evidence-card group">
            <div className="flex items-center justify-between">
              <span className="evidence-type">{categoryLabels[item.category]}</span>
              <span className="font-mono text-[10px] text-stone-700">EVIDENCE / {String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <div className="rounded-sm border border-brass/20 bg-brass/[0.06] p-2.5 text-brass"><Fingerprint size={19} /></div>
              <div><h3 className="text-base font-semibold text-stone-200">{item.title}</h3><p className="mt-2 text-xs leading-6 text-stone-500">{item.description}</p></div>
            </div>
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-stone-700"><Link2 size={11} /> 关联对象</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.relatedNpcIds.map((id) => <span key={id} className="trait">{npcById[id].name}</span>)}
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 bg-black/20 p-3 text-[11px] leading-5 text-stone-400">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brass/70" /> {item.significance}
            </div>
          </article>
        ))}
      </div>

      {missingCount > 0 && (
        <div className="mt-5 flex items-center gap-3 border border-dashed border-white/[0.08] p-4 text-xs text-stone-600"><ShieldQuestion size={17} /> 还有 {missingCount} 份线索未发现。你仍可继续指认，也可以返回审讯室补充调查。</div>
      )}

      <div className="mt-8 flex justify-end"><button className="danger-button" onClick={onContinue}>进入最终指认 <ArrowRight size={16} /></button></div>
    </div>
  )
}

function ReviewStat({ value, label, muted = false }: { value: number; label: string; muted?: boolean }) {
  return <div className={`min-w-[72px] border px-4 py-3 text-center ${muted ? 'border-white/[0.06] text-stone-700' : 'border-white/[0.1] text-stone-300'}`}><div className="font-display text-xl">{String(value).padStart(2, '0')}</div><div className="mt-1 text-[8px] uppercase tracking-widest">{label}</div></div>
}
