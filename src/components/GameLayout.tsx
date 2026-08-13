import { ArrowLeft, FolderLock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import type { AiRuntimeStatus } from '../hooks/useNpcConversations'

const stepLabels = ['案件', '嫌疑人', '审讯', '线索', '指认', '结案']

interface GameLayoutProps {
  children: ReactNode
  activeStep: number
  onBack?: () => void
  evidenceCount?: number
  aiRuntimeStatus: AiRuntimeStatus
}

export function GameLayout({ children, activeStep, onBack, evidenceCount = 0, aiRuntimeStatus }: GameLayoutProps) {
  const isLive = aiRuntimeStatus === 'live'

  return (
    <div className="min-h-screen bg-ink text-stone-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <Brand compact />
          <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-500 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
            <span>{isLive ? 'AI AGENT / LIVE' : 'AI 离线 / 预设可用'}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-stone-400">
            <FolderLock size={13} className="text-brass" /> <span>{evidenceCount} 份证据</span>
          </div>
        </div>
      </header>

      <div className="border-b border-white/[0.06] bg-[#0c0f12]">
        <div className="mx-auto flex max-w-[1440px] items-center px-5 lg:px-8">
          {onBack && (
            <button onClick={onBack} className="mr-5 flex h-12 items-center gap-2 text-xs text-stone-500 transition hover:text-stone-200" aria-label="返回上一步">
              <ArrowLeft size={15} /> <span className="hidden md:inline">返回</span>
            </button>
          )}
          <div className="flex flex-1 items-center justify-between overflow-hidden">
            {stepLabels.map((label, index) => (
              <div key={label} className={`progress-step ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'done' : ''}`}>
                <span className="step-number">{index < activeStep ? '✓' : String(index + 1).padStart(2, '0')}</span>
                <span className="hidden text-[10px] tracking-[0.2em] sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <main>{children}</main>
    </div>
  )
}
