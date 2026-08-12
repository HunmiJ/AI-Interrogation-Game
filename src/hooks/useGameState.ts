import { useCallback, useState } from 'react'
import { gameCase } from '../data/gameData'
import type { GameStage } from '../types/game'

const stages: GameStage[] = [
  'home',
  'briefing',
  'suspect-selection',
  'interrogation',
  'evidence-review',
  'accusation',
  'result',
]

export function useGameState() {
  const [stage, setStage] = useState<GameStage>('home')
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const [interviewedNpcIds, setInterviewedNpcIds] = useState<string[]>([])
  const [askedDialogueIds, setAskedDialogueIds] = useState<string[]>([])
  const [collectedEvidenceIds, setCollectedEvidenceIds] = useState<string[]>(gameCase.initialEvidenceIds)
  const [candidateNpcId, setCandidateNpcId] = useState<string | null>(null)
  const [accusedNpcId, setAccusedNpcId] = useState<string | null>(null)

  const goTo = useCallback((nextStage: GameStage) => {
    setStage(nextStage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const selectNpc = useCallback((npcId: string) => {
    setSelectedNpcId(npcId)
    setInterviewedNpcIds((current) => current.includes(npcId) ? current : [...current, npcId])
  }, [])

  const askDialogue = useCallback((dialogueId: string, evidenceId?: string) => {
    setAskedDialogueIds((current) => current.includes(dialogueId) ? current : [...current, dialogueId])
    if (evidenceId) {
      setCollectedEvidenceIds((current) => current.includes(evidenceId) ? current : [...current, evidenceId])
    }
  }, [])

  const accuse = useCallback((npcId: string) => {
    setAccusedNpcId(npcId)
    goTo('result')
  }, [goTo])

  const restart = useCallback(() => {
    setStage('home')
    setSelectedNpcId(null)
    setInterviewedNpcIds([])
    setAskedDialogueIds([])
    setCollectedEvidenceIds(gameCase.initialEvidenceIds)
    setCandidateNpcId(null)
    setAccusedNpcId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    state: { stage, selectedNpcId, interviewedNpcIds, askedDialogueIds, collectedEvidenceIds, candidateNpcId, accusedNpcId },
    actions: { goTo, selectNpc, askDialogue, selectCandidate: setCandidateNpcId, accuse, restart },
    stageIndex: stages.indexOf(stage),
  }
}
