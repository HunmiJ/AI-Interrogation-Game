import 'dotenv/config'
import type { AddressInfo } from 'node:net'
import { z } from 'zod'
import { createApp } from '../app'
import type { ConversationTurn } from '../types/agent'
import { applySessionUpdate, createInvestigationSession } from '../../src/utils/gameSession'
import { notebookContradictionById } from '../../src/data/investigationNotebook'

const interrogationSchema = z.object({
  reply: z.string().min(1),
  emotion: z.enum(['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealedFactIds: z.array(z.string()),
  contradictionIds: z.array(z.string()),
  unlockedEvidenceIds: z.array(z.string()),
  presentedEvidenceIds: z.array(z.string()),
})

async function main() {
  const server = createApp().listen(0, '127.0.0.1')
  let session = createInvestigationSession(['rear-door-scratches', 'alarm-log'])
  const history: ConversationTurn[] = []

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const { port } = server.address() as AddressInfo

    async function ask(message: string) {
      const response = await fetch(`http://127.0.0.1:${port}/api/interrogate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          npcId: 'tom',
          message,
          conversationHistory: history,
          discoveredEvidenceIds: session.collectedEvidenceIds,
          presentedEvidenceIds: session.presentedEvidenceIds,
          discoveredFactIds: session.discoveredFactIds,
          discoveredContradictionIds: session.discoveredContradictionIds,
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(`Tom interrogation returned HTTP ${response.status}: ${JSON.stringify(body)}`)
      const result = interrogationSchema.parse(body)
      history.push({ role: 'user', content: message }, { role: 'assistant', content: result.reply })
      session = applySessionUpdate({ ...session, questionCount: session.questionCount + 1 }, result)
      console.log(`[contradiction-smoke] status=${response.status} facts=${result.revealedFactIds.join(',') || '-'} contradictions=${result.contradictionIds.join(',') || '-'} evidence=${result.unlockedEvidenceIds.join(',') || '-'} reply=${JSON.stringify(result.reply)}`)
      return result
    }

    console.log(`[contradiction-smoke] initial-contradictions=${session.discoveredContradictionIds.length}`)
    const first = await ask('23:09的时候你在哪里？')
    if (!session.discoveredFactIds.includes('tom_claimed_supplier_call')) {
      throw new Error('Tom supplier-call testimony was not confirmed as a Fact.')
    }
    if (!session.collectedEvidenceIds.includes('supplier-call-record')) {
      throw new Error('The supplier call record was not unlocked from Tom testimony.')
    }
    if (first.contradictionIds.length !== 0 || session.discoveredContradictionIds.length !== 0) {
      throw new Error('The first turn cascaded into a contradiction.')
    }
    if (session.collectedEvidenceIds.includes('debt-letter')) {
      throw new Error('Supplier-call testimony incorrectly unlocked debt-letter.')
    }
    console.log(`[contradiction-smoke] pacing=first-turn-stop notebook-contradictions=${session.discoveredContradictionIds.length} debt-letter=false`)

    const second = await ask('运营商记录显示你22:31以后没有任何通话，但你刚才说自己在和供应商通话，你怎么解释？')
    if (!second.contradictionIds.includes('tom_supplier_call_conflict')) {
      throw new Error('Presented call record did not produce tom_supplier_call_conflict.')
    }
    if (!session.lastDiscovery?.contradictionIds.includes('tom_supplier_call_conflict')) {
      throw new Error('React session did not expose a CONTRADICTION DETECTED discovery event.')
    }
    const notebookItem = notebookContradictionById.tom_supplier_call_conflict
    if (!notebookItem) throw new Error('Notebook cannot render tom_supplier_call_conflict.')
    console.log(`[contradiction-smoke] feedback=CONTRADICTION_DETECTED notebook-contradictions=${session.discoveredContradictionIds.length} contains=${JSON.stringify(notebookItem.title)}`)

    const third = await ask('我再确认一次：你仍坚持案发时在和供应商通话吗？')
    if (third.contradictionIds.length !== 0) throw new Error(`Duplicate contradiction returned: ${third.contradictionIds.join(',')}`)
    if (session.discoveredContradictionIds.filter((id) => id === 'tom_supplier_call_conflict').length !== 1) {
      throw new Error('Duplicate contradiction entered the React session.')
    }
    console.log(`[contradiction-smoke] duplicate-check=passed notebook-contradictions=${session.discoveredContradictionIds.length}`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

main().catch((error: unknown) => {
  console.error(`[contradiction-smoke] failed: ${error instanceof Error ? error.message : 'Unknown failure.'}`)
  process.exitCode = 1
})
