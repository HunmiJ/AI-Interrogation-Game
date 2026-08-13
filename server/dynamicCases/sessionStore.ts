import { randomUUID } from 'node:crypto'
import type { CaseDefinition, CaseValidationResult, GenerationOptions } from './types'

export interface DynamicCaseSession {
  sessionId: string
  caseDefinition: CaseDefinition
  validation: CaseValidationResult
  generationAttempts: number
  retryCount: number
  options: GenerationOptions
  createdAt: number
  progress: DynamicCaseProgress
}

export interface DynamicCaseProgress {
  confirmedFactIds: string[]
  discoveredEvidenceIds: string[]
  discoveredContradictionIds: string[]
  presentedEvidenceIds: string[]
}

export class DynamicCaseSessionStore {
  private readonly sessions = new Map<string, DynamicCaseSession>()
  private readonly maxSessions = 50
  private readonly ttlMs = 6 * 60 * 60 * 1000

  private prune(now = Date.now(), reserveSlot = false) {
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > this.ttlMs) this.sessions.delete(id)
    }
    const maximumExisting = reserveSlot ? this.maxSessions - 1 : this.maxSessions
    while (this.sessions.size > maximumExisting) {
      const oldestId = this.sessions.keys().next().value as string | undefined
      if (!oldestId) break
      this.sessions.delete(oldestId)
    }
  }

  create(input: Omit<DynamicCaseSession, 'sessionId' | 'createdAt' | 'progress'>) {
    this.prune(Date.now(), true)
    const session: DynamicCaseSession = {
      ...input,
      sessionId: randomUUID(),
      createdAt: Date.now(),
      progress: {
        confirmedFactIds: [],
        discoveredEvidenceIds: input.caseDefinition.evidence.filter((item) => item.isInitial).map((item) => item.id),
        discoveredContradictionIds: [],
        presentedEvidenceIds: [],
      },
    }
    this.sessions.set(session.sessionId, session)
    return session
  }

  get(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    if (Date.now() - session.createdAt > this.ttlMs) {
      this.sessions.delete(sessionId)
      return undefined
    }
    return session
  }

  applyInvestigationUpdate(sessionId: string, update: {
    revealedFactIds: string[]
    unlockedEvidenceIds: string[]
    contradictionIds: string[]
    presentedEvidenceIds: string[]
  }) {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    session.progress = {
      confirmedFactIds: [...new Set([...session.progress.confirmedFactIds, ...update.revealedFactIds])],
      discoveredEvidenceIds: [...new Set([...session.progress.discoveredEvidenceIds, ...update.unlockedEvidenceIds])],
      discoveredContradictionIds: [...new Set([...session.progress.discoveredContradictionIds, ...update.contradictionIds])],
      presentedEvidenceIds: [...new Set([...session.progress.presentedEvidenceIds, ...update.presentedEvidenceIds])],
    }
    return session.progress
  }

  clear() {
    this.sessions.clear()
  }

  get size() {
    this.prune()
    return this.sessions.size
  }
}

export const dynamicCaseSessionStore = new DynamicCaseSessionStore()
