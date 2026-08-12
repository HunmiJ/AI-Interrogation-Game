import { CaseBriefing } from './components/CaseBriefing'
import { EvidenceReview } from './components/EvidenceReview'
import { FinalAccusation } from './components/FinalAccusation'
import { GameLayout } from './components/GameLayout'
import { GameResult } from './components/GameResult'
import { HomeScreen } from './components/HomeScreen'
import { InterrogationRoom } from './components/InterrogationRoom'
import { SuspectSelection } from './components/SuspectSelection'
import { useGameState } from './hooks/useGameState'
import { useNpcConversations } from './hooks/useNpcConversations'

export default function App() {
  const { state, actions, stageIndex } = useGameState()
  const aiConversations = useNpcConversations()

  const restartGame = () => {
    aiConversations.reset()
    actions.restart()
  }

  if (state.stage === 'home') return <HomeScreen onStart={() => actions.goTo('briefing')} />
  if (state.stage === 'result' && state.accusedNpcId) {
    return <GameResult accusedNpcId={state.accusedNpcId} collectedEvidenceIds={state.collectedEvidenceIds} interviewedNpcCount={state.interviewedNpcIds.length} askedCount={state.askedDialogueIds.length} onRestart={restartGame} />
  }

  const backTargets = {
    briefing: 'home',
    'suspect-selection': 'briefing',
    interrogation: 'suspect-selection',
    'evidence-review': 'interrogation',
    accusation: 'evidence-review',
  } as const

  return (
    <GameLayout
      activeStep={Math.max(0, stageIndex - 1)}
      evidenceCount={state.collectedEvidenceIds.length}
      aiRuntimeStatus={aiConversations.runtimeStatus}
      onBack={() => actions.goTo(backTargets[state.stage as keyof typeof backTargets])}
    >
      {state.stage === 'briefing' && <CaseBriefing onContinue={() => actions.goTo('suspect-selection')} />}
      {state.stage === 'suspect-selection' && <SuspectSelection selectedNpcId={state.selectedNpcId} onSelect={actions.selectNpc} onContinue={() => actions.goTo('interrogation')} />}
      {state.stage === 'interrogation' && state.selectedNpcId && (
        <InterrogationRoom
          selectedNpcId={state.selectedNpcId}
          interviewedNpcIds={state.interviewedNpcIds}
          askedDialogueIds={state.askedDialogueIds}
          collectedEvidenceIds={state.collectedEvidenceIds}
          conversation={aiConversations.conversations[state.selectedNpcId] ?? []}
          isThinking={Boolean(aiConversations.pendingByNpc[state.selectedNpcId])}
          conversationError={aiConversations.errorsByNpc[state.selectedNpcId] ?? null}
          onSelectNpc={actions.selectNpc}
          onAsk={(dialogueId, evidenceId) => {
            aiConversations.markPresetFallback()
            actions.askDialogue(dialogueId, evidenceId)
          }}
          onSendMessage={(message) => aiConversations.sendMessage(state.selectedNpcId!, message, state.collectedEvidenceIds)}
          onRetryMessage={() => aiConversations.retry(state.selectedNpcId!)}
          onReview={() => actions.goTo('evidence-review')}
        />
      )}
      {state.stage === 'evidence-review' && <EvidenceReview collectedEvidenceIds={state.collectedEvidenceIds} interviewedNpcCount={state.interviewedNpcIds.length} onContinue={() => actions.goTo('accusation')} />}
      {state.stage === 'accusation' && <FinalAccusation selectedNpcId={state.candidateNpcId} onSelect={actions.selectCandidate} onAccuse={actions.accuse} />}
    </GameLayout>
  )
}
