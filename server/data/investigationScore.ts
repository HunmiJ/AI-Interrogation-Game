import { contradictionDefinitions, factDefinitions, normalizeInvestigationProgress } from './investigationRules'
import type { AgentId } from '../types/agent'

const keyEvidenceIds = ['rear-door-scratches', 'alarm-log', 'memory-card-photo', 'transit-record', 'supplier-call-record', 'debt-letter']
const importantFactIds = factDefinitions.filter((fact) => fact.scoreValue >= 3).map((fact) => fact.id)

export interface InvestigationScoreInput {
  accusedNpcId: AgentId
  discoveredEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  questionCount: number
  interrogatedNpcIds: AgentId[]
}

export function calculateInvestigationScore(input: InvestigationScoreInput) {
  const normalized = normalizeInvestigationProgress(input)
  const evidence = new Set(normalized.discoveredEvidenceIds)
  const facts = new Set(normalized.discoveredFactIds)
  const contradictions = new Set(normalized.discoveredContradictionIds)
  const accusation = input.accusedNpcId === 'tom' ? 40 : 0
  const evidenceScore = Math.round((keyEvidenceIds.filter((id) => evidence.has(id)).length / keyEvidenceIds.length) * 30)
  const contradictionScore = Math.min(20, contradictionDefinitions
    .filter((item) => contradictions.has(item.id))
    .reduce((sum, item) => sum + item.scoreValue, 0))
  const efficiencyScore = input.questionCount === 0
    ? 0
    : input.questionCount <= 12 ? 10 : input.questionCount <= 18 ? 8 : input.questionCount <= 24 ? 6 : 4

  const missedDirections: string[] = []
  if (!evidence.has('memory-card-photo')) missedDirections.push('核实 Jack 相机中 23:09 的办公室倒影。')
  if (!evidence.has('supplier-call-record')) missedDirections.push('调取 Tom 所谓供应商通话的运营商详单。')
  if (!contradictions.has('tom_location_conflict')) missedDirections.push('用相机原片追问 Tom 的真实位置。')
  if (!contradictions.has('tom_supplier_call_conflict')) missedDirections.push('对照通话记录拆解 Tom 的不在场证明。')
  if (input.interrogatedNpcIds.length < 3) missedDirections.push('完成对三名嫌疑人的交叉审讯。')
  const missedImportantFacts = importantFactIds.filter((id) => !facts.has(id)).length
  if (missedImportantFacts >= 3) missedDirections.push('仍有多项关键时间线、权限或动机事实未确认。')

  return {
    total: accusation + evidenceScore + contradictionScore + efficiencyScore,
    breakdown: {
      accusation: { earned: accusation, maximum: 40 },
      evidence: { earned: evidenceScore, maximum: 30 },
      contradictions: { earned: contradictionScore, maximum: 20 },
      efficiency: { earned: efficiencyScore, maximum: 10 },
    },
    discoveredFactCount: facts.size,
    discoveredContradictionCount: contradictions.size,
    keyEvidenceCount: keyEvidenceIds.filter((id) => evidence.has(id)).length,
    missedDirections,
  }
}
