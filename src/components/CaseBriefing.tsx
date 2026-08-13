import { ArrowRight, Clock3, FileText, MapPin, PackageOpen, Target } from 'lucide-react'
import type { CaseData } from '../types/game'

export function CaseBriefing({ caseData: gameCase, onContinue }: { caseData: CaseData; onContinue: () => void }) {
  return (
    <div className="page-shell">
      <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="eyebrow mb-5"><FileText size={13} /> CASE BRIEFING / {gameCase.caseNumber}</div>
          <h1 className="section-title">{gameCase.title}</h1>
          <p className="mt-4 text-base text-stone-500">{gameCase.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <InfoPill icon={<MapPin size={14} />} text={gameCase.location} />
          <InfoPill icon={<Clock3 size={14} />} text={gameCase.occurredAt} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-6 md:p-9">
          <div className="panel-heading"><span>01</span>案情摘要</div>
          <p className="mt-7 max-w-3xl text-base leading-8 text-stone-300">{gameCase.summary}</p>
          <div className="mt-8 rounded-sm border-l-2 border-brass bg-brass/[0.06] px-5 py-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brass"><Target size={14} /> 调查目标</div>
            <p className="mt-2 text-sm leading-6 text-stone-400">{gameCase.objective}</p>
          </div>

          <div className="mt-9 border-t border-white/[0.08] pt-8">
            <div className="panel-heading"><span>02</span>失窃物品</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {gameCase.stolenItems.map((item, index) => (
                <div key={item} className="flex items-center gap-4 border border-white/[0.08] bg-white/[0.025] p-4">
                  <PackageOpen size={18} className="text-brass" />
                  <div><div className="text-[9px] uppercase tracking-widest text-stone-600">ITEM 0{index + 1}</div><div className="mt-1 text-sm text-stone-300">{item}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel p-6 md:p-8">
          <div className="panel-heading"><span>03</span>已知时间线</div>
          <div className="relative mt-7 space-y-0">
            {gameCase.timeline.map((event, index) => (
              <div key={event.time} className="timeline-row">
                <div className="timeline-marker"><span className={index === 2 ? 'critical' : ''} /></div>
                <div className="pb-7">
                  <time className={`font-mono text-xs ${index === 2 ? 'text-brass' : 'text-stone-500'}`}>{event.time}</time>
                  <p className="mt-1.5 text-sm leading-6 text-stone-300">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-white/[0.08] pt-5 text-xs leading-5 text-stone-600">
            注意：时间线来自现有记录，嫌疑人口供仍需交叉验证。
          </div>
        </aside>
      </div>

      <div className="mt-8 flex justify-end">
        <button className="primary-button group" onClick={onContinue}>查看嫌疑人 <ArrowRight size={17} className="transition group-hover:translate-x-1" /></button>
      </div>
    </div>
  )
}

function InfoPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-xs text-stone-500">{icon}{text}</div>
}
