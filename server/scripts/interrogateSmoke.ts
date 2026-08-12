import 'dotenv/config'
import type { AddressInfo } from 'node:net'
import { z } from 'zod'
import { createApp } from '../app'
import type { AgentId, ConversationTurn } from '../types/agent'

const responseSchema = z.object({
  reply: z.string().min(1),
  emotion: z.enum(['neutral', 'calm', 'nervous', 'defensive', 'evasive', 'angry']),
  revealedFactIds: z.array(z.string()),
  contradictionIds: z.array(z.string()),
})

type SmokeResponse = z.infer<typeof responseSchema>

async function main() {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const { port } = server.address() as AddressInfo

    async function ask(npcId: AgentId, message: string, history: ConversationTurn[]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/interrogate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          npcId,
          message,
          conversationHistory: history,
          discoveredEvidenceIds: [],
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        throw new Error(`POST /api/interrogate returned HTTP ${response.status}: ${JSON.stringify(body)}`)
      }
      return { status: response.status, result: responseSchema.parse(body) }
    }

    function continueHistory(history: ConversationTurn[], question: string, response: SmokeResponse) {
      history.push(
        { role: 'user', content: question },
        { role: 'assistant', content: response.reply },
      )
    }

    const jackHistory: ConversationTurn[] = []
    const jackQuestions = [
      '你昨晚为什么会去咖啡馆附近？',
      '你确定你没说谎？',
      '那你几点离开的？',
    ]

    for (const [index, question] of jackQuestions.entries()) {
      const { status, result } = await ask('jack', question, jackHistory)
      console.log(
        `[interrogate-smoke] phase=three-round round=${index + 1} status=${status} npc=jack emotion=${result.emotion} reply=${JSON.stringify(result.reply)}`,
      )
      continueHistory(jackHistory, question, result)
    }
    if (jackHistory.length !== 6 || jackHistory[3]?.role !== 'assistant') {
      throw new Error('Jack three-round conversation history was not preserved in user/assistant order.')
    }

    const switchedHistories: Record<'jack' | 'alice', ConversationTurn[]> = { jack: [], alice: [] }
    const jackFirstQuestion = '你昨晚在咖啡馆附近做什么？'
    const jackFirst = await ask('jack', jackFirstQuestion, switchedHistories.jack)
    continueHistory(switchedHistories.jack, jackFirstQuestion, jackFirst.result)

    const aliceQuestion = '你昨晚什么时候离开咖啡馆？'
    if (switchedHistories.alice.length !== 0) throw new Error('Alice unexpectedly received Jack history.')
    const alice = await ask('alice', aliceQuestion, switchedHistories.alice)
    continueHistory(switchedHistories.alice, aliceQuestion, alice.result)

    const jackFollowUpQuestion = '我刚才问过你的话，你还记得吗？'
    if (switchedHistories.jack.length !== 2 || switchedHistories.jack.some((turn) => turn.content === aliceQuestion)) {
      throw new Error('Jack history was lost or contaminated after switching NPCs.')
    }
    const jackFollowUp = await ask('jack', jackFollowUpQuestion, switchedHistories.jack)

    console.log(
      `[interrogate-smoke] phase=npc-switch status=${jackFirst.status}/${alice.status}/${jackFollowUp.status} sequence=jack>alice>jack jackHistoryTurns=${switchedHistories.jack.length} aliceHistoryTurns=${switchedHistories.alice.length}`,
    )
    console.log(`[interrogate-smoke] phase=npc-switch npc=jack-first reply=${JSON.stringify(jackFirst.result.reply)}`)
    console.log(`[interrogate-smoke] phase=npc-switch npc=alice reply=${JSON.stringify(alice.result.reply)}`)
    console.log(`[interrogate-smoke] phase=npc-switch npc=jack-return reply=${JSON.stringify(jackFollowUp.result.reply)}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown interrogation smoke-test failure.'
  console.error(`[interrogate-smoke] failed: ${message}`)
  process.exitCode = 1
})
