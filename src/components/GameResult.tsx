import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import type { CaseData } from '../types/game'
import { requestCaseResolution } from '../services/caseResolutionApi'
import type { CaseResolution } from '../types/caseResolution'

interface GameResultProps {
  caseData: CaseData
  caseSessionId?: string
  accusedNpcId: string
  collectedEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  interviewedNpcIds: string[]
  questionCount: number
  onRestart: () => void
}

export function GameResult(props: GameResultProps) {
  const [resolution, setResolution] = useState<CaseResolution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadResolution = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setResolution(await requestCaseResolution({
        caseSessionId: props.caseSessionId,
        accusedNpcId: props.accusedNpcId,
        discoveredEvidenceIds: props.collectedEvidenceIds,
        discoveredFactIds: props.discoveredFactIds,
        discoveredContradictionIds: props.discoveredContradictionIds,
        questionCount: props.questionCount,
        interrogatedNpcIds: props.interviewedNpcIds,
      }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法取得结案结果。')
    } finally { setLoading(false) }
  }, [props.accusedNpcId, props.caseSessionId, props.collectedEvidenceIds, props.discoveredContradictionIds, props.discoveredFactIds, props.interviewedNpcIds, props.questionCount])

  useEffect(() => { void loadResolution() }, [loadResolution])

  if (!resolution) return <main className="result-screen grid min-h-screen place-items-center bg-ink px-5 text-stone-100"><div className="result-glow" /><div className="relative w-full max-w-md border border-white/[0.09] bg-panel p-8 text-center">{loading ? <LoaderCircle size={28} className="mx-auto animate-spin text-brass" /> : <AlertCircle size={28} className="mx-auto text-danger" />}<h1 className="mt-5 font-display text-3xl">{loading ? '正在核对证据链' : '结案记录暂时不可用'}</h1><p className="mt-3 text-sm leading-6 text-stone-500">{loading ? '正在封存口供与指认结果……' : error}</p>{!loading && <button type="button" onClick={() => void loadResolution()} className="secondary-button mt-6"><RefreshCw size={14} /> 重试</button>}</div></main>

  const scoreLines = [
    ['正确指认', resolution.score.breakdown.accusation],
    ['关键证据', resolution.score.breakdown.evidence],
    ['发现矛盾', resolution.score.breakdown.contradictions],
    ['审讯效率', resolution.score.breakdown.efficiency],
  ] as const

  return (
    <main className="result-screen min-h-screen bg-ink px-5 py-10 text-stone-100 md:py-[4.5rem]">
      <div className="result-glow" /><div className="relative mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center"><div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${resolution.correct ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-danger/30 bg-danger/10 text-danger'}`}>{resolution.correct ? <CheckCircle2 size={30} /> : <XCircle size={30} />}</div><div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.32em] text-brass/70">CASE {resolution.correct ? 'SOLVED' : 'MISJUDGED'} / {props.caseData.caseNumber}</div><h1 className="mt-3 font-display text-5xl tracking-[-0.035em] text-stone-50 md:text-7xl">{resolution.correct ? '指认成立' : '真相与你擦肩而过'}</h1><p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-stone-400">{resolution.correct ? `证据链评估完成。指认正确并不等于调查完整。` : `你指认了 ${resolution.accusedName}，但完整证据最终指向 ${resolution.culprit.name}。`}</p></div>
        <div className="mt-11 grid overflow-hidden border border-white/[0.1] bg-panel shadow-[0_24px_70px_rgba(0,0,0,.28)] md:grid-cols-[0.82fr_1.18fr]">
          <div className="border-b border-white/[0.08] p-8 md:border-b-0 md:border-r"><div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-white/[0.08]"><div className="text-center"><div><span className="font-display text-6xl text-brass">{resolution.score.total}</span><span className="ml-1 text-xs text-stone-600">/100</span></div><div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-stone-500">Investigation score</div></div></div><div className="mt-7 space-y-3">{scoreLines.map(([label, line]) => <div key={label} className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs"><span className="text-stone-500">{label}</span><span className="font-mono text-stone-200">{line.earned} / {line.maximum}</span></div>)}</div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><ResultStat value={resolution.score.keyEvidenceCount} label="证据" /><ResultStat value={resolution.score.discoveredFactCount} label="事实" /><ResultStat value={resolution.score.discoveredContradictionCount} label="矛盾" /></div></div>
          <div className="p-6 md:p-10"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brass"><ShieldCheck size={15} /> 调查总结</div><h2 className="mt-5 font-display text-3xl leading-tight text-stone-100">{resolution.culprit.name} / {resolution.culprit.descriptor}</h2><div className="mt-5 space-y-4 text-[15px] leading-8 text-stone-300">{resolution.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><blockquote className="mt-7 border-l-2 border-danger/60 bg-danger/[0.035] px-5 py-4 font-display text-lg italic leading-7 text-stone-200">“{resolution.confession}”</blockquote>{resolution.score.missedDirections.length > 0 && <div className="mt-7 border-t border-white/[0.08] pt-5"><div className="text-[9px] uppercase tracking-[0.2em] text-stone-600">遗漏的调查方向</div><ul className="mt-3 space-y-2 text-xs leading-5 text-stone-500">{resolution.score.missedDirections.map((item) => <li key={item}>— {item}</li>)}</ul></div>}</div>
        </div>
        <div className="mt-7 flex justify-center"><button onClick={props.onRestart} className="secondary-button"><RotateCcw size={15} /> 重新调查</button></div>
      </div>
    </main>
  )
}

function ResultStat({ value, label }: { value: number; label: string }) {
  return <div className="border border-white/[0.07] py-3"><div className="font-display text-xl text-stone-300">{String(value).padStart(2, '0')}</div><div className="mt-1 text-[8px] uppercase tracking-widest text-stone-700">{label}</div></div>
}
