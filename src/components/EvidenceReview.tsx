import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch, Fingerprint, Link2, ShieldQuestion } from 'lucide-react'
import type { Evidence, NotebookContradictionRecord, NotebookFactRecord, NPC } from '../types/game'

const categoryLabels: Record<Evidence['category'], string> = {
  physical: '现场物证', digital: '数字记录', testimony: '人物证词', document: '书面文档',
}

interface EvidenceReviewProps {
  collectedEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  interviewedNpcCount: number
  onContinue: () => void
  evidence: Evidence[]
  evidenceTotal: number
  npcs: NPC[]
  factRecords: NotebookFactRecord[]
  contradictionRecords: NotebookContradictionRecord[]
}

export function EvidenceReview({ collectedEvidenceIds, discoveredFactIds, discoveredContradictionIds, interviewedNpcCount, onContinue, evidence, evidenceTotal, npcs, factRecords, contradictionRecords }: EvidenceReviewProps) {
  const npcById = Object.fromEntries(npcs.map((item) => [item.id, item]))
  const notebookFactById = Object.fromEntries(factRecords.map((item) => [item.id, item]))
  const notebookContradictionById = Object.fromEntries(contradictionRecords.map((item) => [item.id, item]))
  const collected = evidence.filter((item) => collectedEvidenceIds.includes(item.id))
  const facts = discoveredFactIds.map((id) => notebookFactById[id]).filter(Boolean)
  const contradictions = discoveredContradictionIds.map((id) => notebookContradictionById[id]).filter(Boolean)
  const missingCount = evidenceTotal - collected.length

  return (
    <div className="page-shell">
      <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-5"><FileSearch size={13} /> INVESTIGATION NOTEBOOK / CROSS-REFERENCE</div>
          <h1 className="section-title">整理调查笔记</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-500">将已确认事实、口供矛盾和关键证据放在同一条调查链上。</p>
        </div>
        <div className="flex gap-3">
          <ReviewStat value={facts.length} label="已确认事实" />
          <ReviewStat value={contradictions.length} label="发现矛盾" />
          <ReviewStat value={collected.length} label="已获证据" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <NotebookSection title="CONFIRMED FACTS / 已确认事实" empty="尚未通过审讯确认新事实。">
          {facts.map((fact) => <NotebookLine key={fact.id} icon={<CheckCircle2 size={14} />} title={fact.title} description={fact.description} tone="fact" />)}
        </NotebookSection>
        <NotebookSection title="CONTRADICTIONS / 发现矛盾" empty="尚未形成经过验证的口供矛盾。">
          {contradictions.map((item) => <NotebookLine key={item.id} icon={<AlertTriangle size={14} />} title={item.title} description={item.description} tone="contradiction" />)}
        </NotebookSection>
      </div>

      <div className="mb-4 mt-9 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">EVIDENCE / 已获证据</div>
        <div className="font-mono text-xs text-stone-500">{String(collected.length).padStart(2, '0')} / {String(evidenceTotal).padStart(2, '0')}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collected.map((item, index) => (
          <article key={item.id} className="evidence-card group">
            <div className="flex items-center justify-between"><span className="evidence-type">{categoryLabels[item.category]}</span><span className="font-mono text-[10px] text-stone-700">EVIDENCE / {String(index + 1).padStart(2, '0')}</span></div>
            <div className="mt-5 flex items-start gap-4"><div className="rounded-sm border border-brass/20 bg-brass/[0.06] p-2.5 text-brass"><Fingerprint size={19} /></div><div><h3 className="text-base font-semibold text-stone-200">{item.title}</h3><p className="mt-2 text-xs leading-6 text-stone-500">{item.description}</p></div></div>
            <div className="mt-5 border-t border-white/[0.07] pt-4"><div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-stone-700"><Link2 size={11} /> 关联对象</div><div className="mt-2 flex flex-wrap gap-2">{item.relatedNpcIds.map((id) => <span key={id} className="trait">{npcById[id]?.name ?? id}</span>)}</div></div>
            <div className="mt-4 flex items-start gap-2 bg-black/20 p-3 text-[11px] leading-5 text-stone-400"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brass/70" /> {item.significance}</div>
          </article>
        ))}
      </div>

      {missingCount > 0 && <div className="mt-5 flex items-center gap-3 border border-dashed border-white/[0.08] p-4 text-xs text-stone-600"><ShieldQuestion size={17} /> 还有 {missingCount} 份线索未发现；已审讯 {interviewedNpcCount} / 3 名嫌疑人。</div>}
      <div className="mt-8 flex justify-end"><button className="danger-button" onClick={onContinue}>进入最终指认 <ArrowRight size={16} /></button></div>
    </div>
  )
}

function NotebookSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className="border border-white/[0.08] bg-panel p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">{title}</div><div className="mt-4 space-y-3">{hasChildren ? children : <p className="border border-dashed border-white/[0.07] p-4 text-xs text-stone-700">{empty}</p>}</div></section>
}

function NotebookLine({ icon, title, description, tone }: { icon: React.ReactNode; title: string; description: string; tone: 'fact' | 'contradiction' }) {
  return <div className="flex items-start gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"><span className={`mt-0.5 ${tone === 'fact' ? 'text-emerald-500' : 'text-amber-500'}`}>{icon}</span><div><div className="text-sm font-medium text-stone-200">{title}</div><p className="mt-1 text-[11px] leading-5 text-stone-500">{description}</p></div></div>
}

function ReviewStat({ value, label }: { value: number; label: string }) {
  return <div className="min-w-[76px] border border-white/[0.1] px-4 py-3 text-center text-stone-300"><div className="font-display text-xl">{String(value).padStart(2, '0')}</div><div className="mt-1 text-[8px] uppercase tracking-widest">{label}</div></div>
}
