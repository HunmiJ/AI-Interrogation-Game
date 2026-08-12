import { useCallback, useState } from 'react'
import { dialogueOptions } from '../data/dialogues'
import { gameCase } from '../data/gameData'
import type { GameStage } from '../types/game'
import type { InvestigationUpdate } from '../utils/investigationRules'
import { resolveTrustedPresetUpdate } from '../utils/investigationRules'
import { applySessionUpdate, createInvestigationSession } from '../utils/gameSession'

const stages: GameStage[] = ['home', 'briefing', 'suspect-selection', 'interrogation', 'evidence-review', 'accusation', 'result']

export function useGameState() {
  const [stage, setStage] = useState<GameStage>('home')
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const [interviewedNpcIds, setInterviewedNpcIds] = useState<string[]>([])
  const [session, setSession] = useState(() => createInvestigationSession(gameCase.initialEvidenceIds))
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
    setSession((current) => applySessionUpdate(
      { ...current, questionCount: current.questionCount + 1 },
      update,
    ))
  }, [])

  const askDialogue = useCallback((dialogueId: string) => {
    const option = dialogueOptions.find((item) => item.id === dialogueId)
    if (!option) return
    setSession((current) => {
      if (current.askedDialogueIds.includes(dialogueId)) return current
      const update = resolveTrustedPresetUpdate(
        option.revealFactIds ?? [], option.contradictionIds ?? [],
        current.discoveredFactIds, current.discoveredContradictionIds, current.collectedEvidenceIds,
      )
      return applySessionUpdate({
        ...current,
        askedDialogueIds: [...current.askedDialogueIds, dialogueId],
        questionCount: current.questionCount + 1,
      }, update)
    })
  }, [])

  const accuse = useCallback((npcId: string) => {
    setAccusedNpcId(npcId)
    goTo('result')
  }, [goTo])

  const restart = useCallback(() => {
    setStage('home')
    setSelectedNpcId(null)
    setInterviewedNpcIds([])
    setSession(createInvestigationSession(gameCase.initialEvidenceIds))
    setCandidateNpcId(null)
    setAccusedNpcId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    state: {
      stage, selectedNpcId, interviewedNpcIds, ...session,
      candidateNpcId, accusedNpcId,
    },
    actions: { goTo, selectNpc, askDialogue, recordAiResult, selectCandidate: setCandidateNpcId, accuse, restart },
    stageIndex: stages.indexOf(stage),
  }
}
