import type { AgentId } from '../types/agent'
import { calculateInvestigationScore } from './investigationScore'
import type { InvestigationScoreInput } from './investigationScore'

const culpritId: AgentId = 'tom'

const names: Record<AgentId, string> = {
  jack: 'Jack',
  alice: 'Alice',
  tom: 'Tom',
}

export function resolveCase(input: InvestigationScoreInput) {
  const accusedNpcId = input.accusedNpcId
  return {
    correct: accusedNpcId === culpritId,
    accusedName: names[accusedNpcId],
    culprit: {
      id: culpritId,
      name: 'Tom',
      descriptor: '被财务缺口困住的人',
    },
    explanation: [
      'Tom 因私人债务挪用了采购款。手写烘焙日志中夹着真实进货记录，一旦日志被检查，账目问题就会暴露。',
      '他在 23:07 用自己掌握的密码解除警报，带走募款和日志，再从店内划伤后门锁，伪造外部闯入。所谓供应商电话从未发生。',
      'Jack 的原片将他定格在 23:09 的办公室门口；Alice 的交通记录则证明后门触发时她已经离开。每个人都撒了谎，但只有一组谎言在掩盖盗窃。',
    ],
    confession: '我只是想填上那个窟窿。等周转过来，我会把钱放回去。',
    score: calculateInvestigationScore(input),
  }
}
