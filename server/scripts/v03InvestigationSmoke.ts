import 'dotenv/config'
import type { AddressInfo } from 'node:net'
import { z } from 'zod'
import { createApp } from '../app'
import type { AgentId, ConversationTurn } from '../types/agent'
import { applySessionUpdate, createInvestigationSession } from '../../src/utils/gameSession'
import { notebookFactById } from '../../src/data/investigationNotebook'

const interrogationSchema = z.object({
  reply: z.string().min(1),
  emotion: z.enum(['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealedFactIds: z.array(z.string()),
  contradictionIds: z.array(z.string()),
  unlockedEvidenceIds: z.array(z.string()),
})

async function main() {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  let session = createInvestigationSession(['rear-door-scratches', 'alarm-log'])
  const histories: Record<AgentId, ConversationTurn[]> = { jack: [], alice: [], tom: [] }
  const interrogatedNpcIds: AgentId[] = []
  let questionCount = 0

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const { port } = server.address() as AddressInfo

    async function ask(npcId: AgentId, message: string) {
      if (!interrogatedNpcIds.includes(npcId)) interrogatedNpcIds.push(npcId)
      const response = await fetch(`http://127.0.0.1:${port}/api/interrogate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          npcId, message, conversationHistory: histories[npcId],
          discoveredEvidenceIds: session.collectedEvidenceIds,
          discoveredFactIds: session.discoveredFactIds,
          discoveredContradictionIds: session.discoveredContradictionIds,
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(`interrogate ${npcId} returned HTTP ${response.status}: ${JSON.stringify(body)}`)
      const result = interrogationSchema.parse(body)
      histories[npcId].push({ role: 'user', content: message }, { role: 'assistant', content: result.reply })
      questionCount += 1
      session = applySessionUpdate({ ...session, questionCount }, result)
      console.log(`[v03-smoke] npc=${npcId} status=${response.status} facts=${result.revealedFactIds.join(',') || '-'} contradictions=${result.contradictionIds.join(',') || '-'} evidence=${result.unlockedEvidenceIds.join(',') || '-'} reply=${JSON.stringify(result.reply)}`)
      return result
    }

    console.log(`[v03-smoke] initial-notebook-facts=${session.discoveredFactIds.length}`)
    await ask('jack', '活动结束之后你真的马上离开了吗？')
    await ask('jack', '你确定没有去过二楼？')

    if (!session.discoveredFactIds.includes('jack_went_upstairs')) {
      throw new Error('Jack did not produce the validated jack_went_upstairs fact.')
    }
    if (!session.collectedEvidenceIds.includes('memory-card-photo')) {
      throw new Error('jack_went_upstairs did not unlock memory-card-photo.')
    }
    if (!session.lastDiscovery?.revealedFactIds.includes('jack_went_upstairs')) {
      throw new Error('React session did not expose jack_went_upstairs as a NEW FACT discovery event.')
    }
    const notebookFact = notebookFactById.jack_went_upstairs
    if (!notebookFact) throw new Error('Notebook cannot render jack_went_upstairs.')
    console.log(`[v03-smoke] feedback=NEW_FACT_DISCOVERED notebook-confirmed-facts=${session.discoveredFactIds.length} contains=${JSON.stringify(notebookFact.title)} evidence=${session.collectedEvidenceIds.join(',')}`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

main().catch((error: unknown) => {
  console.error(`[v03-smoke] failed: ${error instanceof Error ? error.message : 'Unknown failure.'}`)
  process.exitCode = 1
})
