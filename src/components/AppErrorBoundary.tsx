import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Brand } from './Brand'

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ui-error-boundary]', error.name, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-5 text-stone-100">
        <section className="w-full max-w-lg border border-white/[0.09] bg-panel p-8 text-center shadow-2xl">
          <Brand compact />
          <AlertTriangle size={30} className="mx-auto mt-8 text-amber-500" />
          <h1 className="mt-5 font-display text-3xl">调查界面需要重新载入</h1>
          <p className="mt-3 text-sm leading-7 text-stone-500">页面遇到意外错误。尚未提交的当前调查进度不会保存。</p>
          <button type="button" className="primary-button mt-7" onClick={() => window.location.reload()}><RotateCcw size={15} /> 重新载入</button>
        </section>
      </main>
    )
  }
}
