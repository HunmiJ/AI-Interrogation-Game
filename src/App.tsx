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
import { CaseGeneration } from './components/CaseGeneration'
import { classicRuntimeCase } from './data/gameData'

export default function App() {
  const { state, actions, stageIndex } = useGameState()
  const aiConversations = useNpcConversations(actions.recordAiResult)

  const restartGame = () => {
    aiConversations.reset()
    actions.restart()
  }

  const runtimeCase = state.runtimeCase
  if (state.stage === 'home') return <HomeScreen onClassic={() => { aiConversations.reset(); actions.startCase(classicRuntimeCase) }} onGenerate={() => { aiConversations.reset(); actions.goTo('case-generation') }} />
  if (state.stage === 'result' && state.accusedNpcId) {
    return <GameResult caseData={runtimeCase.case} caseSessionId={runtimeCase.sessionId} accusedNpcId={state.accusedNpcId} collectedEvidenceIds={state.collectedEvidenceIds} discoveredFactIds={state.discoveredFactIds} discoveredContradictionIds={state.discoveredContradictionIds} interviewedNpcIds={state.interviewedNpcIds} questionCount={state.questionCount} onRestart={restartGame} />
  }

  const backTargets = {
    briefing: 'home',
    'suspect-selection': 'briefing',
    interrogation: 'suspect-selection',
    'evidence-review': 'interrogation',
    accusation: 'evidence-review',
    'case-generation': 'home',
  } as const

  return (
    <GameLayout
      activeStep={Math.max(0, stageIndex - 1)}
      evidenceCount={state.stage === 'case-generation' ? 0 : state.collectedEvidenceIds.length}
      aiRuntimeStatus={aiConversations.runtimeStatus}
      onBack={() => actions.goTo(backTargets[state.stage as keyof typeof backTargets])}
    >
      {state.stage === 'case-generation' && <CaseGeneration onReady={(runtimeCase) => { aiConversations.reset(); actions.startCase(runtimeCase) }} />}
      {state.stage === 'briefing' && <CaseBriefing caseData={runtimeCase.case} onContinue={() => actions.goTo('suspect-selection')} />}
      {state.stage === 'suspect-selection' && <SuspectSelection npcs={runtimeCase.npcs} selectedNpcId={state.selectedNpcId} onSelect={actions.selectNpc} onContinue={() => actions.goTo('interrogation')} />}
      {state.stage === 'interrogation' && state.selectedNpcId && (
        <InterrogationRoom
          selectedNpcId={state.selectedNpcId}
          interviewedNpcIds={state.interviewedNpcIds}
          askedDialogueIds={state.askedDialogueIds}
          collectedEvidenceIds={state.collectedEvidenceIds}
          discoveredFactIds={state.discoveredFactIds}
          discoveredContradictionIds={state.discoveredContradictionIds}
          lastDiscovery={state.lastDiscovery}
          questionCount={state.questionCount}
          conversation={aiConversations.conversations[state.selectedNpcId] ?? []}
          isThinking={Boolean(aiConversations.pendingByNpc[state.selectedNpcId])}
          conversationError={aiConversations.errorsByNpc[state.selectedNpcId] ?? null}
          onSelectNpc={actions.selectNpc}
          onAsk={(dialogueId) => {
            aiConversations.markPresetFallback()
            actions.askDialogue(dialogueId)
          }}
          onSendMessage={(message) => aiConversations.sendMessage(
            state.selectedNpcId!, runtimeCase.sessionId, message, state.collectedEvidenceIds, state.presentedEvidenceIds,
            state.discoveredFactIds, state.discoveredContradictionIds,
          )}
          onRetryMessage={() => aiConversations.retry(state.selectedNpcId!)}
          onReview={() => actions.goTo('evidence-review')}
          npcs={runtimeCase.npcs}
          evidence={runtimeCase.evidence}
          evidenceTotal={runtimeCase.evidenceTotal}
          dialogueOptions={runtimeCase.dialogueOptions}
          openingLines={runtimeCase.openingLines}
          facts={runtimeCase.facts}
          contradictions={runtimeCase.contradictions}
          runtimeCase={runtimeCase}
        />
      )}
      {state.stage === 'evidence-review' && <EvidenceReview evidence={runtimeCase.evidence} evidenceTotal={runtimeCase.evidenceTotal} npcs={runtimeCase.npcs} factRecords={runtimeCase.facts} contradictionRecords={runtimeCase.contradictions} collectedEvidenceIds={state.collectedEvidenceIds} discoveredFactIds={state.discoveredFactIds} discoveredContradictionIds={state.discoveredContradictionIds} interviewedNpcCount={state.interviewedNpcIds.length} onContinue={() => actions.goTo('accusation')} />}
      {state.stage === 'accusation' && <FinalAccusation npcs={runtimeCase.npcs} selectedNpcId={state.candidateNpcId} onSelect={actions.selectCandidate} onAccuse={actions.accuse} />}
    </GameLayout>
  )
}
