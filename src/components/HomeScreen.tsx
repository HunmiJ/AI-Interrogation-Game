import { ArrowUpRight, Clock3, Fingerprint, Headphones, Play, ShieldCheck, Sparkles } from 'lucide-react'
import { Brand } from './Brand'
import { gameCase } from '../data/gameData'

export function HomeScreen({ onClassic, onGenerate }: { onClassic: () => void; onGenerate: () => void }) {
  return (
    <main className="landing min-h-screen overflow-hidden bg-ink text-stone-100">
      <div className="landing-glow" />
      <nav className="relative z-10 mx-auto flex h-24 max-w-[1440px] items-center justify-between px-6 lg:px-12">
        <Brand />
        <div className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> V0.5 / Release Candidate
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-14 px-6 pb-16 pt-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:pb-24">
        <div className="max-w-3xl">
          <div className="eyebrow mb-7"><Fingerprint size={14} /> CASE-DRIVEN SOCIAL DEDUCTION</div>
          <h1 className="font-display text-[clamp(3.2rem,7.4vw,7.5rem)] leading-[0.88] tracking-[-0.055em]">
            真相不会<br />主动<span className="italic text-brass">开口</span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-8 text-stone-400 md:text-lg">
            进入封锁现场，审讯每一位嫌疑人。听见他们说了什么，更要留意他们避而不谈的部分。
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={onClassic} className="primary-button group">
              <span>经典案件</span><Play size={16} fill="currentColor" className="transition group-hover:translate-x-1" />
            </button>
            <button onClick={onGenerate} className="secondary-button"><Sparkles size={15} /> AI 动态案件</button>
            <div className="flex items-center gap-2 text-xs text-stone-500"><Headphones size={15} /> 建议佩戴耳机 · 沉浸式体验</div>
          </div>
          <div className="mt-16 grid max-w-xl grid-cols-3 gap-6 border-t border-white/[0.08] pt-6">
            <LandingStat value="02" label="游戏模式" />
            <LandingStat value="03" label="可审讯角色" />
            <LandingStat value="15m" label="预计用时" />
          </div>
        </div>

        <div className="case-file-wrap">
          <div className="case-file-shadow" />
          <article className="case-file-card">
            <div className="flex items-start justify-between border-b border-black/15 pb-5">
              <div>
                <p className="text-[9px] font-bold tracking-[0.32em] text-black/45">ACTIVE CASE FILE</p>
                <p className="mt-1 font-mono text-xs text-black/60">{gameCase.caseNumber}</p>
              </div>
              <div className="case-stamp">机密<br />CONFIDENTIAL</div>
            </div>
            <div className="py-7">
              <span className="text-[10px] font-semibold tracking-[0.24em] text-red-900/60">午夜特别调查</span>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#171411]">{gameCase.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/55">{gameCase.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-black/15 bg-black/15">
              <CaseMeta icon={<Clock3 size={14} />} label="案发时间" value="7 月 14 日 · 深夜" />
              <CaseMeta icon={<ShieldCheck size={14} />} label="难度等级" value={gameCase.difficulty} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex -space-x-2">
                {['JK', 'AL', 'TM'].map((item, index) => <span key={item} className="suspect-mini" style={{ zIndex: 3 - index }}>{item}</span>)}
              </div>
              <button onClick={onClassic} className="flex items-center gap-2 text-xs font-bold tracking-wider text-black/65 hover:text-black">Classic Case <ArrowUpRight size={14} /></button>
            </div>
          </article>
          <div className="coffee-ring" aria-hidden="true" />
        </div>
      </section>
    </main>
  )
}

function LandingStat({ value, label }: { value: string; label: string }) {
  return <div><div className="font-display text-2xl text-stone-200">{value}</div><div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-600">{label}</div></div>
}

function CaseMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-[#d6d0c2] p-3.5"><div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-black/40">{icon}{label}</div><div className="mt-2 text-xs font-semibold text-black/70">{value}</div></div>
}
