import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, LoaderCircle, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import { DynamicCaseApiError, generateDynamicCase } from '../services/dynamicCaseApi'
import type { RuntimeCaseData } from '../types/game'
import { defaultCaseGenerationSelection, GenerationSubmissionGate, optionSelectionAttributes, submitGenerationSelection, type CaseDifficultyOption, type CaseTypeOption } from './caseGenerationModel'

const stages = ['Generating scenario...', 'Building suspects...', 'Constructing evidence graph...', 'Validating solvability...']
const typeOptions: Array<[CaseTypeOption, string]> = [['random', 'Random'], ['theft', 'Theft'], ['data-leak', 'Data Leak'], ['fraud', 'Fraud'], ['item-swap', 'Item Swap']]
const difficultyOptions: Array<[CaseDifficultyOption, string]> = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]

export function CaseGeneration({ onReady, onClassic, generateCase = generateDynamicCase }: {
  onReady: (runtimeCase: RuntimeCaseData) => void
  onClassic: () => void
  generateCase?: typeof generateDynamicCase
}) {
  const [caseType, setCaseType] = useState<CaseTypeOption>(defaultCaseGenerationSelection.caseType)
  const [difficulty, setDifficulty] = useState<CaseDifficultyOption>(defaultCaseGenerationSelection.difficulty)
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'failed'>('idle')
  const [stageIndex, setStageIndex] = useState(0)
  const [generatedCase, setGeneratedCase] = useState<RuntimeCaseData | null>(null)
  const [meta, setMeta] = useState<{ attempts: number; retryCount: number } | null>(null)
  const submissionGate = useRef(new GenerationSubmissionGate())
  const [error, setError] = useState<string>('案件证据链未通过完整性验证。')

  useEffect(() => {
    if (status !== 'generating') return
    const timer = window.setInterval(() => setStageIndex((current) => Math.min(stages.length - 1, current + 1)), 2300)
    return () => window.clearInterval(timer)
  }, [status])

  const generate = async () => {
    await submissionGate.current.run(async () => {
      setStatus('generating'); setStageIndex(0); setGeneratedCase(null)
      try {
        const result = await submitGenerationSelection({ caseType, difficulty }, generateCase)
        setGeneratedCase(result.runtimeCase)
        setMeta({ attempts: result.generation.attempts, retryCount: result.generation.retryCount })
        setStatus('ready')
      } catch (generationError) {
        const known = generationError instanceof DynamicCaseApiError ? generationError : null
        setError(friendlyGenerationError(known))
        setStatus('failed')
      }
    })
  }

  return (
    <div className="page-shell max-w-5xl">
      <div className="eyebrow mb-5"><Sparkles size={13} /> AI CASE GENERATOR / VALIDATED CASES ONLY</div>
      <h1 className="section-title">生成一宗新的调查案件</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-500">AI 负责构建角色与案件内容；只有通过确定性结构、依赖图和可解性验证的案件才能进入游戏。</p>

      {status === 'idle' && <div className="mt-10 grid gap-6 md:grid-cols-2">
        <OptionGroup title="CASE TYPE / 案件类型" options={typeOptions} value={caseType} onChange={(value) => setCaseType(value as CaseTypeOption)} />
        <OptionGroup title="DIFFICULTY / 难度" options={difficultyOptions} value={difficulty} onChange={(value) => setDifficulty(value as CaseDifficultyOption)} />
      </div>}

      {status === 'generating' && <div className="panel mt-10 p-8 text-center md:p-12" role="status">
        <LoaderCircle size={32} className="mx-auto animate-spin text-brass" />
        <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-brass">GENERATING CASE</div>
        <h2 className="mt-3 font-display text-3xl text-stone-100">{stages[stageIndex]}</h2>
        <div className="mx-auto mt-7 flex max-w-lg gap-2">{stages.map((_, index) => <span key={index} className={`h-1 flex-1 ${index <= stageIndex ? 'bg-brass' : 'bg-white/[0.07]'}`} />)}</div>
        <p className="mt-5 text-xs text-stone-600">最多验证 3 次。内部 Prompt、私密角色信息和完整解法不会显示。</p>
      </div>}

      {status === 'ready' && generatedCase && <div className="panel mt-10 p-7 md:p-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-emerald-400">CASE READY</div>
        <h2 className="mt-3 font-display text-4xl text-stone-100">{generatedCase.case.title}</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-400">{generatedCase.case.summary}</p>
        <div className="mt-7 flex flex-wrap gap-3 text-xs text-stone-500"><span className="selection-hint"><MapPin size={13} />{generatedCase.case.location}</span><span className="selection-hint"><Clock3 size={13} />{generatedCase.case.estimatedMinutes} 分钟</span><span className="selection-hint">难度 · {generatedCase.case.difficulty}</span></div>
        <p className="mt-5 text-[10px] text-stone-600">Validation PASS · Solvability PASS · Attempts {meta?.attempts} · Retries {meta?.retryCount}</p>
        <button type="button" className="primary-button mt-8" onClick={() => onReady(generatedCase)}>开始调查 <ArrowRight size={16} /></button>
      </div>}

      {status === 'failed' && <div className="panel mt-10 p-8 text-center">
        <AlertTriangle size={30} className="mx-auto text-amber-500" /><div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-400">CASE GENERATION FAILED</div>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-stone-500">{error}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="primary-button compact" onClick={() => void generate()}><RefreshCw size={14} /> 重新生成</button>
          <button type="button" className="secondary-button compact" onClick={() => setStatus('idle')}><ArrowLeft size={14} /> 调整选项</button>
          <button type="button" className="secondary-button compact" onClick={onClassic}>进入经典案件 <ArrowRight size={14} /></button>
        </div>
        <p className="mt-5 text-[10px] text-stone-700">动态案件失败不会自动替换为经典案件；由你决定重试或切换。</p>
      </div>}

      {status === 'idle' && <div className="mt-8 flex justify-end"><button type="button" className="primary-button" onClick={() => void generate()}><Sparkles size={15} /> Generate Case</button></div>}
    </div>
  )
}

function friendlyGenerationError(error: DynamicCaseApiError | null) {
  if (!error) return '案件生成遇到未知错误，请重试。'
  if (error.code === 'GENERATION_TIMEOUT') return '生成等待时间过长。可以重试、调整案件选项，或先体验经典案件。'
  if (error.code === 'GENERATOR_OFFLINE') return 'AI 案件生成服务暂时不可用。经典案件仍可完整游玩。'
  if (error.code === 'GENERATION_RATE_LIMITED') return '短时间内生成次数过多，请稍后再试。经典案件仍可完整游玩。'
  if (error.code === 'GENERATION_BUSY') return '已有案件正在生成，请稍候再试。'
  if (error.code === 'GENERATION_VALIDATION_FAILED') return '生成内容未通过证据链与可解性验证，没有进入游戏。请重新生成。'
  return error.reason ?? error.message
}

export function OptionGroup({ title, options, value, onChange, disabled = false }: { title: string; options: Array<[string, string]>; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <section className="panel p-6"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">{title}</div><div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={title}>{options.map(([id, label]) => {
    const selected = value === id
    return <button key={id} type="button" disabled={disabled} {...optionSelectionAttributes(selected)} onClick={() => onChange(id)} className="question-option generator-option"><span>{label}</span>{selected && <span className="generator-option-check" aria-hidden="true"><Check size={11} /> SELECTED</span>}</button>
  })}</div></section>
}
