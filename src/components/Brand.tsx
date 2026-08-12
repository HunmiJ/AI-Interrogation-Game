import { ScanEye } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark" aria-hidden="true"><ScanEye size={compact ? 16 : 20} /></div>
      <div>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold tracking-[0.24em] text-stone-100`}>AI INTERROGATION</div>
        {!compact && <div className="mt-0.5 text-[9px] uppercase tracking-[0.32em] text-stone-500">Investigation protocol</div>}
      </div>
    </div>
  )
}
