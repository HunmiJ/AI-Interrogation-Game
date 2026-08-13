import { useCallback, useState } from 'react'
import { classicRuntimeCase } from '../data/gameData'
import type { GameStage, RuntimeCaseData } from '../types/game'
import type { InvestigationUpdate } from '../utils/investigationRules'
import { resolveTrustedPresetUpdate } from '../utils/investigationRules'
import { applySessionUpdate, createInvestigationSession } from '../utils/gameSession'

const stages: GameStage[] = ['home', 'briefing', 'suspect-selection', 'interrogation', 'evidence-review', 'accusation', 'result']

export function useGameState() {
  const [stage, setStage] = useState<GameStage>('home')
  const [runtimeCase, setRuntimeCase] = useState<RuntimeCaseData>(classicRuntimeCase)
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const [interviewedNpcIds, setInterviewedNpcIds] = useState<string[]>([])
  const [session, setSession] = useState(() => createInvestigationSession(classicRuntimeCase.case.initialEvidenceIds))
  const [candidateNpcId, setCandidateNpcId] = useState<string | null>(null)
  const [accusedNpcId, setAccusedNpcId] = useState<string | null>(null)

  const goTo = useCallback((nextStage: GameStage) => {
    setStage(nextStage)
    setSession((current) => ({ ...current, lastDiscovery: null }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const selectNpc = useCallback((npcId: string) => {
    setSelectedNpcId(npcId)
    setInterviewedNpcIds((current) => current.includes(npcId) ? current : [...current, npcId])
  }, [])

  const recordAiResult = useCallback((update: InvestigationUpdate) => {
    if (update.factRecords?.length || update.contradictionRecords?.length || update.evidenceRecords?.length) {
      setRuntimeCase((current) => ({
        ...current,
        facts: [...current.facts, ...(update.factRecords ?? []).filter((item) => !current.facts.some((known) => known.id === item.id))],
        contradictions: [...current.contradictions, ...(update.contradictionRecords ?? []).filter((item) => !current.contradictions.some((known) => known.id === item.id))],
        evidence: [...current.evidence, ...(update.evidenceRecords ?? []).filter((item) => !current.evidence.some((known) => known.id === item.id))],
      }))
    }
    setSession((current) => applySessionUpdate(
      { ...current, questionCount: current.questionCount + 1 },
      update,
    ))
  }, [])

  const askDialogue = useCallback((dialogueId: string) => {
    const option = runtimeCase.dialogueOptions.find((item) => item.id === dialogueId)
    if (!option) return
    setSession((current) => {
      if (current.askedDialogueIds.includes(dialogueId)) return current
      const update = resolveTrustedPresetUpdate(
        option.revealFactIds ?? [], option.contradictionIds ?? [],
        current.discoveredFactIds, current.discoveredContradictionIds, current.collectedEvidenceIds,
        runtimeCase,
      )
      return applySessionUpdate({
        ...current,
        askedDialogueIds: [...current.askedDialogueIds, dialogueId],
        questionCount: current.questionCount + 1,
      }, update)
    })
  }, [runtimeCase])

  const startCase = useCallback((nextCase: RuntimeCaseData) => {
    setRuntimeCase(nextCase)
    setStage('briefing')
    setSelectedNpcId(null)
    setInterviewedNpcIds([])
    setSession(createInvestigationSession(nextCase.case.initialEvidenceIds))
    setCandidateNpcId(null)
    setAccusedNpcId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const accuse = useCallback((npcId: string) => {
    setAccusedNpcId(npcId)
    goTo('result')
  }, [goTo])

  const restart = useCallback(() => {
    setStage('home')
    setSelectedNpcId(null)
    setInterviewedNpcIds([])
    setRuntimeCase(classicRuntimeCase)
    setSession(createInvestigationSession(classicRuntimeCase.case.initialEvidenceIds))
    setCandidateNpcId(null)
    setAccusedNpcId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    state: {
      stage, runtimeCase, selectedNpcId, interviewedNpcIds, ...session,
      candidateNpcId, accusedNpcId,
    },
    actions: { goTo, startCase, selectNpc, askDialogue, recordAiResult, selectCandidate: setCandidateNpcId, accuse, restart },
    stageIndex: stages.indexOf(stage),
  }
}
